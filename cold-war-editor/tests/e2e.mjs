/* End-to-end checks for The Editor's Desk.
   Run from the repository root (needs Node 18+ and Playwright):
     python3 -m http.server 8765 &
     node cold-war-editor/tests/e2e.mjs
   Options: BASE_URL=http://127.0.0.1:8765/cold-war-editor/  ENGINES=webkit,chromium  SHOTS=dir */
import { createRequire } from 'module';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  const tries = [process.cwd()];
  try { tries.push(execSync('npm root -g').toString().trim()); } catch (e) { /* ignore */ }
  for (const p of tries) {
    try { return require(require.resolve('playwright', { paths: [p] })); } catch (e) { /* next */ }
  }
  throw new Error('Playwright not found. Install it with: npm i -D playwright');
}
const pw = loadPlaywright();

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8765/cold-war-editor/';
const ENGINES = (process.env.ENGINES || 'webkit,chromium').split(',');
const SHOTS = process.env.SHOTS || '';
const VIEWPORTS = [
  { name: 'iphone-390x844', width: 390, height: 844, mobile: true },
  { name: 'iphone-large-430x932', width: 430, height: 932, mobile: true },
  { name: 'ipad-portrait-820x1180', width: 820, height: 1180, mobile: true },
  { name: 'ipad-landscape-1180x820', width: 1180, height: 820, mobile: true }
];
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const DATA = JSON.parse(fs.readFileSync(new URL('../data/manuscripts.json', import.meta.url)));

let failures = 0, passes = 0;
function check(cond, msg) {
  if (cond) passes++;
  else { failures++; console.log('   FAIL: ' + msg); }
}

/* Layout: no horizontal scroll; every visible control is at least 44x44, reachable and not overlapping another. */
async function layoutCheck(page, where) {
  const res = await page.evaluate(() => {
    const out = { scroll: [document.documentElement.scrollWidth, window.innerWidth], small: [], overlap: [], covered: [] };
    const sel = 'button, input, [role=button]:not(.sentence), a[href], summary';
    const els = [...document.querySelectorAll(sel)].filter(e => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !e.closest('[aria-hidden=true]');
    });
    for (const e of els) {
      const r = e.getBoundingClientRect();
      if (r.width < 43.5 || r.height < 43.5) out.small.push((e.dataset.action || e.className || e.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    }
    for (let i = 0; i < els.length; i++) {
      for (let j = i + 1; j < els.length; j++) {
        const a = els[i], b = els[j];
        if (a.contains(b) || b.contains(a)) continue;
        // Controls in a fixed layer (decision panel, overlay) may scroll past page content: reachability covers that.
        if (a.closest('.pane-decision, .overlay') !== b.closest('.pane-decision, .overlay')) continue;
        const r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect();
        const w = Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left);
        const h = Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top);
        if (w > 2 && h > 2) {
          // Only a problem if both are visible at the same time (not one hidden behind a fixed panel).
          out.overlap.push((a.dataset.action || a.className) + ' / ' + (b.dataset.action || b.className));
        }
      }
    }
    return out;
  });
  check(res.scroll[0] <= res.scroll[1], `${where}: horizontal scroll (${res.scroll[0]} > ${res.scroll[1]})`);
  check(res.small.length === 0, `${where}: tap targets under 44px: ${res.small.join(', ')}`);
  check(res.overlap.length === 0, `${where}: overlapping controls: ${res.overlap.join('; ')}`);
  // Reachability: scroll each control into view and confirm a tap there would hit it.
  const covered = await page.evaluate(async () => {
    const bad = [];
    const els = [...document.querySelectorAll('button:not(:disabled), input, summary')].filter(e => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
    });
    for (const e of els) {
      e.scrollIntoView({ block: 'center', inline: 'nearest' });
      await new Promise(r => requestAnimationFrame(() => r()));
      const r = e.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(hit === e || e.contains(hit))) bad.push((e.dataset.action || e.className || e.tagName) + ' covered by ' + (hit ? hit.className || hit.tagName : 'nothing'));
    }
    window.scrollTo(0, 0);
    return bad;
  });
  check(covered.length === 0, `${where}: unreachable controls: ${covered.join('; ')}`);
}

async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: false });
}

async function tabsVisible(page) {
  return page.evaluate(() => { const t = document.querySelector('.desk .tabs'); return !!t && getComputedStyle(t).display !== 'none'; });
}

async function startGame(page, name) {
  await page.goto(BASE);
  await page.waitForSelector('.title-screen');
  await page.fill('#player-name', name);
  const restart = await page.$('[data-action=restart]');
  if (restart) { await restart.click(); await page.click('.overlay [data-action=ok]'); }
  else await page.click('[data-action=start]');
  await page.waitForSelector('.briefing');
}

/* Play one manuscript. mode: 'correct' or 'wrong'. */
async function playManuscript(page, m, day, mode, doLayout, tag) {
  const k = m.key;
  await page.waitForSelector(`.manuscript[data-ms-id="${m.id}"]`, { state: "attached" });
  const n = await page.$$eval('.manuscript .sentence', s => s.length);
  check(n === m.sentences.length, `${m.id}: expected ${m.sentences.length} sentences, found ${n}`);
  const texts = await page.$$eval('.manuscript .sentence', s => s.map(x => x.textContent));
  check(JSON.stringify(texts) === JSON.stringify(m.sentences), `${m.id}: sentence text differs from JSON`);
  const numbersShown = await page.$$eval('.manuscript .num', s => s.length);
  check(numbersShown === 0, `${m.id}: sentence numbers visible during play`);
  if (doLayout) await layoutCheck(page, `${tag} ${m.id} step A`);
  if (await tabsVisible(page)) await page.click('.tab[data-tab-target=extract]');

  let main = k.mainArgument[0];
  if (mode === 'wrong') main = [...Array(m.sentences.length).keys()].map(i => i + 1).find(i => !k.mainArgument.includes(i));
  // Change of mind before confirming must be allowed.
  const other = main === 1 ? 2 : 1;
  await page.click(`.sentence[data-index="${other}"]`);
  await page.click(`.sentence[data-index="${main}"]`);
  check(await page.$eval(`.sentence[data-index="${main}"]`, e => e.classList.contains('selected')), `${m.id}: flagged sentence not highlighted`);
  check(await page.$$eval('.sentence.selected', s => s.length) === 1, `${m.id}: more than one sentence selected`);
  await page.click('[data-action=confirm]');

  // Step B: concession. The main-argument sentence must not be selectable as the concession.
  await page.waitForSelector('[data-action=no-concession]');
  if (doLayout) await layoutCheck(page, `${tag} ${m.id} step B`);
  check(await page.$eval(`.sentence[data-index="${main}"]`, e => e.getAttribute('aria-disabled')) === 'true', `${m.id}: main sentence not locked in step B`);
  await page.click(`.sentence[data-index="${main}"]`, { force: true });
  check(await page.$$eval('.sentence.selected-con', s => s.length) === 0, `${m.id}: main-argument sentence could be flagged as the concession`);
  const cons = k.concessions;
  const nonKey = [...Array(m.sentences.length).keys()].map(i => i + 1).find(i => i !== main && !cons.includes(i));
  const wantNone = mode === 'correct' ? cons.length === 0 : cons.length > 0;
  const pick = wantNone ? null : (mode === 'correct' ? cons[0] : nonKey);
  if (nonKey && nonKey !== pick) await page.click(`.sentence[data-index="${nonKey}"]`); // change of mind
  if (wantNone) {
    await page.click('[data-action=no-concession]');
    check(await page.$$eval('.sentence.selected-con', s => s.length) === 0, `${m.id}: sentence still flagged after choosing No concession`);
  } else {
    await page.click(`.sentence[data-index="${pick}"]`);
    check(await page.$$eval('.sentence.selected-con', s => s.length) === 1, `${m.id}: expected exactly one concession flagged`);
  }
  await page.click('[data-action=confirm]');

  let school = k.school;
  if (mode === 'wrong') school = day.schoolOptions.find(s => s !== k.school);
  const opts = await page.$$eval('[data-school]', b => b.map(x => x.getAttribute('data-school')));
  check(JSON.stringify(opts) === JSON.stringify(day.schoolOptions), `${m.id}: school options ${opts} differ from day ${day.day} schoolOptions`);
  await page.click(`[data-school="${school}"]`);
  if (doLayout) await layoutCheck(page, `${tag} ${m.id} step C`);
  await page.click('[data-action=confirm]');

  if (school !== 'not_blame') {
    await page.waitForSelector('[data-approach]');
    let ap = k.approach;
    if (mode === 'wrong' || ap == null) ap = DATA.approaches.find(a => a !== k.approach && !(k.approachAlsoAccept || []).includes(a));
    await page.click(`[data-approach="${ap}"]`);
    if (doLayout) await layoutCheck(page, `${tag} ${m.id} step D`);
    await page.click('[data-action=confirm]');
  } else {
    check(await page.$('.step.skipped') !== null, `${m.id}: step D not shown as skipped`);
  }
  await page.waitForSelector('[data-stamp]');
  if (doLayout) await layoutCheck(page, `${tag} ${m.id} step E`);
  const stamp = mode === 'wrong' ? (k.stamp === 'PUBLISH' ? 'REJECT' : 'PUBLISH') : k.stamp;
  await page.click(`[data-stamp="${stamp}"]`);
  await page.waitForSelector('.stamp-mark');
}

async function playDay(page, dayIndex, mode, doLayout, tag) {
  const day = DATA.days[dayIndex];
  const list = DATA.manuscripts.filter(m => m.day === day.day);
  await page.waitForSelector('.briefing');
  const briefText = await page.textContent('.briefing');
  check(briefText.includes(day.climate) && briefText.includes(day.directive) && briefText.includes(String(day.year)), `day ${day.day}: briefing text missing`);
  if (doLayout) await layoutCheck(page, `${tag} day ${day.day} briefing`);
  await page.click('[data-action=to-desk]');
  await page.waitForSelector('.desk');
  if (dayIndex === 0) await shot(page, `${tag}-desk`);

  // Rulebook: open (tab on phones, overlay elsewhere), check content and NEW markers.
  if (await tabsVisible(page)) await page.click('.tab[data-tab-target=rulebook]');
  else await page.click('[data-action=open-rulebook]');
  const rb = (await tabsVisible(page)) ? '.rb-inline' : '.overlay .rulebook-content';
  await page.waitForSelector(rb);
  const rbText = await page.textContent(rb);
  check(rbText.includes(day.directive) && rbText.includes(day.rulebookTip), `day ${day.day}: rulebook missing directive or tip`);
  for (const s of day.schoolOptions) check(rbText.includes(DATA.schools[s].definition), `day ${day.day}: rulebook missing definition of ${s}`);
  for (const a of DATA.approaches) check(rbText.includes(a), `day ${day.day}: rulebook missing approach ${a}`);
  const newCount = await page.$$eval(rb + ' .new-tag', t => t.length);
  if (dayIndex === 0) check(newCount === 0, 'day 1: rulebook should have no NEW markers');
  else {
    const prev = DATA.days[dayIndex - 1];
    const added = day.schoolOptions.filter(s => !prev.schoolOptions.includes(s));
    const newSchools = await page.$$eval(rb + ' dt .new-tag', t => t.length);
    check(newSchools === added.length, `day ${day.day}: expected ${added.length} NEW school markers, found ${newSchools}`);
  }
  if (dayIndex === 1) await shot(page, `${tag}-rulebook`);
  if (await tabsVisible(page)) await page.click('.tab[data-tab-target=dossier]');
  else await page.click('.overlay .book-close');

  for (const m of list) await playManuscript(page, m, day, mode, doLayout && m === list[0], tag);

  await page.waitForSelector('.review-screen');
  const cards = await page.$$eval('.review-card', c => c.map(x => x.getAttribute('data-ms-id')));
  check(JSON.stringify(cards) === JSON.stringify(list.map(m => m.id)), `day ${day.day}: review cards ${cards} differ from manuscripts`);
  for (const m of list) {
    const card = `.review-card[data-ms-id="${m.id}"]`;
    const pts = await page.$eval(card + ' .rc-int', e => e.getAttribute('data-points'));
    const trap = await page.$(card + ' .rc-trap');
    const expl = await page.textContent(card + ' .rc-expl p');
    check(expl === m.explanation, `${m.id}: explanation not shown exactly`);
    for (const a of m.anchors) check((await page.textContent(card)).includes(a), `${m.id}: anchor missing`);
    const mains = await page.$$eval(card + ' .rs-main', e => e.map(x => +x.dataset.index));
    check(JSON.stringify(mains.sort()) === JSON.stringify([...m.key.mainArgument].sort()), `${m.id}: main-argument highlights wrong`);
    const cons = await page.$$eval(card + ' .rs-con', e => e.map(x => +x.dataset.index));
    check(JSON.stringify(cons.sort()) === JSON.stringify([...m.key.concessions].sort()), `${m.id}: concession highlights wrong`);
    const subs = await page.$$eval(card + ' .rs-sub', e => e.map(x => +x.dataset.index));
    check(JSON.stringify(subs.sort()) === JSON.stringify([...m.key.subMessages].sort()), `${m.id}: sub-message highlights wrong`);
    if (mode === 'correct') {
      check(pts === '5/5', `${m.id}: expected 5/5 integrity, got ${pts}`);
      check(!trap, `${m.id}: trap shown although answers were correct`);
    } else {
      check(pts === '0/5', `${m.id}: expected 0/5 integrity, got ${pts}`);
      check(!!trap, `${m.id}: trap feedback missing`);
      if (trap) check((await trap.textContent()).includes(DATA.traps[m.trap]), `${m.id}: trap text differs from traps.${m.trap}`);
    }
  }
  const memo = await page.$eval('.board-memo', e => e.getAttribute('data-memo'));
  check(memo === (mode === 'correct' ? 'APPROVED' : 'REPRIMAND'), `day ${day.day}: memo ${memo} unexpected`);
  const dayPct = await page.$eval('[data-day-integrity]', e => e.getAttribute('data-day-integrity'));
  check(dayPct === (mode === 'correct' ? '100' : '0'), `day ${day.day}: day integrity ${dayPct}%`);
  if (doLayout) await layoutCheck(page, `${tag} day ${day.day} review`);
  if (dayIndex === 0) await shot(page, `${tag}-review-${mode}`);
  await page.click('[data-action=next]');
}

async function runViewport(browserType, vp) {
  const tag = `${browserType.name()} ${vp.name}`;
  console.log(`\n== ${tag}`);
  const browser = await browserType.launch();
  const ctxOpts = { viewport: { width: vp.width, height: vp.height }, hasTouch: true, reducedMotion: 'reduce' };
  if (browserType.name() !== 'firefox') Object.assign(ctxOpts, { isMobile: vp.mobile, deviceScaleFactor: 2, userAgent: IOS_UA });
  const errors = [];

  // 1. Correct playthrough, with layout checks.
  let ctx = await browser.newContext(ctxOpts);
  let page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForSelector('.title-screen');
  const info = await page.evaluate(() => ({ n: window.CWE._debug.data.manuscripts.length, problems: window.CWE._debug.problems }));
  check(info.n === 20, `expected 20 manuscripts, loaded ${info.n}`);
  check(info.problems.length === 0, 'content check reported: ' + info.problems.join(' | '));
  await layoutCheck(page, `${tag} title`);
  await shot(page, `${tag.replace(' ', '-')}-title`);
  await startGame(page, 'Test Student');
  for (let d = 0; d < DATA.days.length; d++) await playDay(page, d, 'correct', true, tag.replace(' ', '-'));
  await page.waitForSelector('.final-screen');
  const total = await page.$eval('[data-total-integrity]', e => e.getAttribute('data-total-integrity'));
  check(total === '100', `correct run: total integrity ${total}% (expected 100%)`);
  const comp = await page.$eval('[data-total-compliance]', e => e.getAttribute('data-total-compliance'));
  check(comp === '20/20', `correct run: compliance ${comp} (expected 20/20)`);
  const finalText = await page.textContent('.final-screen');
  check(finalText.includes(DATA.endings.integrityBands[0].rank), 'correct run: top rank missing');
  check(finalText.includes(DATA.endings.twoAxisNote), 'final: twoAxisNote missing');
  check(finalText.includes(DATA.debrief.reflectionPrompt) && finalText.includes(DATA.debrief.examReminder), 'final: debrief missing');
  for (const s of DATA.debrief.summary) check(finalText.includes(s), 'final: era summary item missing');
  await layoutCheck(page, `${tag} final`);
  await page.click('[data-action=results]');
  await page.waitForSelector('#results-card');
  const card = await page.textContent('#results-card');
  check(card.includes('Test Student') && card.includes('100%') && card.includes('20 / 20'), 'results card incomplete');
  const cardBox = await page.$eval('#results-card', e => { const r = e.getBoundingClientRect(); return [r.width, r.height]; });
  check(cardBox[0] <= vp.width && cardBox[1] <= vp.height, `results card ${cardBox} does not fit one screen`);
  await layoutCheck(page, `${tag} results`);
  await shot(page, `${tag.replace(' ', '-')}-results`);
  await ctx.close();

  // 2. Wrong playthrough: trap feedback must appear on every card.
  ctx = await browser.newContext(ctxOpts);
  page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await startGame(page, 'Wrong Answers');
  for (let d = 0; d < DATA.days.length; d++) await playDay(page, d, 'wrong', false, tag.replace(' ', '-'));
  await page.waitForSelector('.final-screen');
  const wt = await page.$eval('[data-total-integrity]', e => e.getAttribute('data-total-integrity'));
  check(wt === '0', `wrong run: total integrity ${wt}% (expected 0%)`);
  check(await page.$('.trap-summary .rc-trap') !== null, 'wrong run: most common trap not shown');
  check((await page.textContent('.final-screen')).includes(DATA.endings.integrityBands[DATA.endings.integrityBands.length - 1].rank), 'wrong run: lowest rank missing');
  await ctx.close();

  // 3. Save and resume mid-day; then storage that throws.
  ctx = await browser.newContext(ctxOpts);
  page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await startGame(page, 'Resume Test');
  await page.click('[data-action=to-desk]');
  const m0 = DATA.manuscripts[0];
  await playManuscript(page, m0, DATA.days[0], 'correct', false, tag);
  await page.waitForSelector(`.manuscript[data-ms-id="${DATA.manuscripts[1].id}"]`, { state: "attached" });
  await page.reload();
  await page.waitForSelector('[data-action=continue]');
  await page.click('[data-action=continue]');
  check(!!(await page.waitForSelector(`.manuscript[data-ms-id="${DATA.manuscripts[1].id}"]`, { state: "attached", timeout: 5000 }).catch(() => null)), 'resume did not return to manuscript 2');
  await ctx.close();

  ctx = await browser.newContext(ctxOpts);
  await ctx.addInitScript(() => {
    const boom = () => { throw new Error('storage disabled'); };
    try { Object.defineProperty(window, 'localStorage', { get: boom, configurable: true }); } catch (e) { /* ignore */ }
  });
  page = await ctx.newPage();
  const storageErrors = [];
  page.on('pageerror', e => storageErrors.push(e.message));
  await startGame(page, 'No Storage');
  await page.click('[data-action=to-desk]');
  await playManuscript(page, m0, DATA.days[0], 'correct', false, tag);
  check(!!(await page.waitForSelector(`.manuscript[data-ms-id="${DATA.manuscripts[1].id}"]`, { state: "attached", timeout: 5000 }).catch(() => null)), 'game stalled when storage is unavailable');
  check(storageErrors.length === 0, 'errors with storage disabled: ' + storageErrors.join('; '));
  // Settings: timer and text size.
  await page.click('.tb-tools [aria-label=Settings]');
  await page.click('[data-setting=timer] [data-value=true]');
  await page.click('[data-setting=text] [data-value=large]');
  await page.click('[data-action=settings-done]');
  check(await page.$('.timer') !== null, 'timer not shown after enabling it');
  check(await page.evaluate(() => document.documentElement.getAttribute('data-text')) === 'large', 'large text not applied');
  await layoutCheck(page, `${tag} desk with large text + timer`);
  await shot(page, `${tag.replace(' ', '-')}-large-text`);
  await ctx.close();

  check(errors.length === 0, 'page errors: ' + errors.join('; '));
  await browser.close();
}

(async () => {
  let ran = 0;
  for (const name of ENGINES) {
    const bt = pw[name];
    if (!bt) continue;
    try { const b = await bt.launch(); await b.close(); }
    catch (e) { console.log(`\n(${name} is not installed here: skipped)`); continue; }
    for (const vp of VIEWPORTS) await runViewport(bt, vp);
    ran++;
  }
  console.log(`\n${passes} checks passed, ${failures} failed, ${ran} engine(s) run.`);
  process.exit(failures || !ran ? 1 : 0);
})();
