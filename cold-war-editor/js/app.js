/* The Editor's Desk: screens, desk interaction and flow.
   All historical content is read from data/manuscripts.json and shown exactly as written. */
(function () {
  'use strict';
  var CWE = window.CWE;
  var px = CWE.pixelText, art = CWE.art, audio = CWE.audio, store = CWE.store;

  var SAVE_KEY = 'save-v1';
  var SETTINGS_KEY = 'settings-v1';
  var TIMER_SECONDS = 180;
  var TIMER_LOW = 30;

  /* Board memos (game framing, not historical content). */
  var MEMOS = {
    pleased: {
      seal: 'APPROVED',
      text: "The board has reviewed today's list and is pleased. Your decisions followed the directive closely. Keep this up and your name will come up when promotions are discussed."
    },
    neutral: {
      seal: 'NOTED',
      text: "The board has reviewed today's list. Several of your decisions did not follow the directive. We expect closer attention to the rulebook tomorrow."
    },
    displeased: {
      seal: 'REPRIMAND',
      text: "The board is displeased with today's list. Too many of your decisions went against the directive. This memo will be placed on your file as a formal reprimand."
    }
  };

  var DATA = null, game = null, S = null, problems = [];
  var settings = { sound: false, textSize: 'normal', timer: false };
  var ui = { tab: 'dossier', busy: false, timerId: null, msStart: 0, warned: false, panelObserver: null };
  var appEl = document.getElementById('app');
  var overlaysEl = document.getElementById('overlays');

  /* ---------- DOM helper ---------- */
  function h(tag, props) {
    var e = document.createElement(tag);
    props = props || {};
    for (var k in props) {
      var v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'on') { for (var ev in v) e.addEventListener(ev, v[ev]); }
      else if (k === 'data') { for (var d in v) e.setAttribute('data-' + d, v[d]); }
      else if (k === 'style') e.setAttribute('style', v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (var i = 2; i < arguments.length; i++) append(e, arguments[i]);
    return e;
  }
  function append(parent, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(parent, c); }); return; }
    if (typeof child === 'string' || typeof child === 'number') child = document.createTextNode(String(child));
    parent.appendChild(child);
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function btn(label, onClick, cls, extra) {
    var props = { type: 'button', class: 'btn ' + (cls || ''), on: { click: onClick } };
    if (extra) for (var k in extra) props[k] = extra[k];
    return h('button', props, label);
  }
  function iconBtn(iconName, label, onClick, cls) {
    return h('button', { type: 'button', class: 'icon-btn ' + (cls || ''), 'aria-label': label, title: label, on: { click: onClick } },
      art.icon(iconName));
  }

  /* ---------- Settings ---------- */
  function loadSettings() {
    var s = store.get(SETTINGS_KEY) || {};
    settings.sound = !!s.sound;
    settings.textSize = s.textSize === 'large' ? 'large' : 'normal';
    settings.timer = !!s.timer;
    applySettings();
    if (settings.sound) {
      // Audio may only start after a tap on iOS.
      var unlock = function () {
        document.removeEventListener('click', unlock, true);
        if (settings.sound) audio.setEnabled(true);
      };
      document.addEventListener('click', unlock, true);
    }
  }
  function saveSettings() { store.set(SETTINGS_KEY, settings); }
  function applySettings() {
    document.documentElement.setAttribute('data-text', settings.textSize);
    document.querySelectorAll('[data-sound-toggle]').forEach(updateSoundBtn);
  }
  function setSound(on) {
    settings.sound = !!on;
    audio.setEnabled(settings.sound);
    saveSettings(); applySettings();
    if (settings.sound) audio.tick();
  }
  function updateSoundBtn(b) {
    clear(b);
    b.appendChild(art.icon(settings.sound ? 'soundOn' : 'soundOff'));
    b.setAttribute('aria-label', settings.sound ? 'Sound on (tap to mute)' : 'Sound off (tap to turn on)');
    b.setAttribute('aria-pressed', settings.sound ? 'true' : 'false');
  }
  function soundBtn() {
    var b = h('button', { type: 'button', class: 'icon-btn', 'data-sound-toggle': '1', on: { click: function () { setSound(!settings.sound); } } });
    updateSoundBtn(b);
    return b;
  }

  /* ---------- Save state ---------- */
  function newState(name) {
    return { v: 3, name: name, day: 0, ms: 0, phase: 'briefing', answers: {}, draft: null, finishedAt: null };
  }
  function loadState() {
    var s = store.get(SAVE_KEY);
    if (!s || s.v !== 3 || !s.answers) return null;
    if (s.day >= game.days.length) { s.day = game.days.length - 1; s.phase = 'final'; }
    return s;
  }
  function save() { if (S) store.set(SAVE_KEY, S); }

  /* ---------- Screens ---------- */
  function setScreen(node, era) {
    stopTimer();
    if (ui.panelObserver) { ui.panelObserver.disconnect(); ui.panelObserver = null; }
    closeOverlays();
    clear(appEl);
    appEl.appendChild(node);
    document.body.setAttribute('data-era', era == null ? 'title' : String(era));
    try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
  }
  function eraOf(dayIndex) {
    var d = game.days[dayIndex];
    return d ? ((dayIndex % 4) + 1) : 'title';
  }

  function resumeLabel(s) {
    var d = game.days[s.day];
    if (!d) return '';
    if (s.phase === 'final' || s.phase === 'results') return 'Final report';
    if (s.phase === 'review') return 'Day ' + d.day + ' review · ' + d.year;
    if (s.phase === 'desk') return 'Day ' + d.day + ' · ' + d.year + ' · manuscript ' + (s.ms + 1) + ' of ' + game.manuscriptsFor(s.day).length;
    return 'Day ' + d.day + ' briefing · ' + d.year;
  }

  function showTitle() {
    var meta = DATA.meta;
    var saved = loadState();
    var nameInput = h('input', {
      id: 'player-name', type: 'text', maxlength: '40', autocomplete: 'off', autocapitalize: 'words',
      spellcheck: 'false', placeholder: 'First name and surname', value: (saved && saved.name) || store.get('last-name') || ''
    });
    var nameMsg = h('p', { class: 'field-msg', role: 'alert' });
    function readName() {
      var n = nameInput.value.replace(/\s+/g, ' ').trim();
      if (!n) { nameMsg.textContent = 'Please type your name first. It appears on your results card.'; nameInput.focus(); return null; }
      nameMsg.textContent = '';
      store.set('last-name', n);
      return n;
    }
    function startNew() {
      var n = readName(); if (!n) return;
      S = newState(n); save(); audio.paper(); route();
    }
    var actions = h('div', { class: 'title-actions' });
    if (saved) {
      actions.appendChild(btn([h('span', { class: 'btn-main' }, 'Continue'), h('span', { class: 'btn-sub' }, resumeLabel(saved))], function () {
        var n = readName(); if (!n) return;
        S = saved; S.name = n; save(); route();
      }, 'btn-primary btn-big', { 'data-action': 'continue' }));
      actions.appendChild(btn('Restart game', function () {
        var n = readName(); if (!n) return;
        confirmDialog('Restart the game?', 'This clears your saved progress and starts again at Day 1.', 'Restart', 'Cancel').then(function (ok) {
          if (!ok) return;
          store.remove(SAVE_KEY); S = newState(n); save(); route();
        });
      }, 'btn-secondary', { 'data-action': 'restart' }));
    } else {
      actions.appendChild(btn('Start work', startNew, 'btn-primary btn-big', { 'data-action': 'start' }));
    }

    var probBox = null;
    if (problems.length) {
      probBox = h('details', { class: 'content-check' },
        h('summary', null, 'Content check: ' + problems.length + ' problem' + (problems.length === 1 ? '' : 's') + ' found in manuscripts.json (for teachers)'),
        h('ul', null, problems.map(function (p) { return h('li', { text: p }); })));
    }

    var node = h('main', { class: 'screen title-screen' },
      h('div', { class: 'title-card' },
        h('div', { class: 'title-art' }, art.building()),
        h('h1', { class: 'title-h1' }, px(meta.title)),
        h('p', { class: 'title-sub' }, px(meta.subtitle)),
        h('p', { class: 'title-course', text: meta.course }),
        h('p', { class: 'title-intro' },
          'You are a junior editor at Meridian Press, an American academic publisher. Over four working days between 1953 and 1997, historians send you manuscripts about the origins of the Cold War. For each one: flag the main argument, classify the interpretation, flag the concession, identify the approach, then stamp it. The board watches your stamps. Your scholarly integrity is revealed at the end of each day.'),
        h('div', { class: 'field' },
          h('label', { for: 'player-name' }, 'Your name'),
          nameInput, nameMsg),
        actions,
        h('div', { class: 'title-tools' },
          btn('Settings', openSettings, 'btn-ghost', { 'data-action': 'settings' }),
          soundBtn()),
        probBox));
    setScreen(node, 'title');
  }

  function route() {
    if (!S) return showTitle();
    if (S.phase === 'briefing') return showBriefing();
    if (S.phase === 'desk') return showDesk(false);
    if (S.phase === 'review') return showReview(S.day, false);
    if (S.phase === 'results') return showResults();
    return showFinal();
  }

  /* ---------- Morning briefing ---------- */
  function newSinceYesterday(dayIndex) {
    if (dayIndex === 0) return { schools: [], tip: false, directive: false };
    var prev = game.days[dayIndex - 1], d = game.days[dayIndex];
    return {
      schools: (d.schoolOptions || []).filter(function (s) { return (prev.schoolOptions || []).indexOf(s) < 0; }),
      tip: d.rulebookTip !== prev.rulebookTip,
      directive: d.directive !== prev.directive
    };
  }

  function showBriefing() {
    var d = game.days[S.day];
    var news = newSinceYesterday(S.day);
    var newList = null;
    if (S.day > 0 && (news.schools.length || news.tip)) {
      newList = h('section', { class: 'brief-new' },
        h('h2', null, h('span', { class: 'new-tag' }, 'NEW'), ' in your rulebook today'),
        h('ul', null,
          news.schools.map(function (s) { return h('li', { text: game.schoolLabel(s) }); }),
          news.tip ? h('li', null, 'A new tip') : null));
    }
    var node = h('main', { class: 'screen briefing-screen' },
      h('article', { class: 'briefing paper-sheet' },
        h('header', { class: 'brief-head' },
          px('MORNING BRIEFING', 'brief-kicker'),
          h('span', { class: 'brief-day', text: 'Day ' + d.day + ' of ' + game.days.length })),
        h('div', { class: 'brief-year' }, px(String(d.year))),
        h('h1', { class: 'brief-title' }, px(d.title)),
        h('section', { class: 'brief-climate' },
          h('h2', null, 'The climate'),
          h('p', { text: d.climate })),
        h('section', { class: 'brief-directive memo' },
          h('h2', null, "Today's directive"),
          h('p', { text: d.directive })),
        newList,
        btn('Go to my desk', function () {
          S.phase = 'desk'; S.ms = 0; save(); audio.paper(); showDesk(true);
        }, 'btn-primary btn-big', { 'data-action': 'to-desk' })));
    setScreen(node, eraOf(S.day));
  }

  /* ---------- Rulebook ---------- */
  function rulebookContent(dayIndex) {
    var d = game.days[dayIndex];
    var news = newSinceYesterday(dayIndex);
    function newTag(on) { return on ? h('span', { class: 'new-tag' }, 'NEW') : null; }
    return h('div', { class: 'rulebook-content' },
      h('section', { class: 'rb-section rb-directive' },
        h('h3', null, "Today's directive ", newTag(news.directive)),
        h('p', { text: d.directive })),
      h('section', { class: 'rb-section' },
        h('h3', null, 'Interpretations'),
        h('dl', { class: 'rb-schools' }, (d.schoolOptions || []).map(function (id) {
          var s = DATA.schools[id] || {};
          return [h('dt', null, h('span', { text: s.label || id }), ' ', newTag(news.schools.indexOf(id) >= 0)),
            h('dd', { text: s.definition || '' })];
        }))),
      h('section', { class: 'rb-section' },
        h('h3', null, 'Approaches'),
        h('ul', { class: 'rb-approaches' }, DATA.approaches.map(function (a) { return h('li', { text: a }); }))),
      h('section', { class: 'rb-section rb-tip' },
        h('h3', null, 'Tip ', newTag(news.tip)),
        h('p', { text: d.rulebookTip })));
  }

  function openRulebook() {
    var d = game.days[S.day];
    audio.paper();
    openOverlay('rulebook', h('div', { class: 'book' },
      h('header', { class: 'book-head' },
        h('h2', { id: 'ov-title' }, px('RULEBOOK')),
        h('span', { class: 'book-day', text: 'Day ' + d.day + ' · ' + d.year }),
        iconBtn('close', 'Close rulebook', closeOverlays, 'book-close')),
      h('div', { class: 'book-pages' }, rulebookContent(S.day))));
  }

  /* ---------- Overlays ---------- */
  var lastFocus = null;
  function openOverlay(kind, content) {
    closeOverlays();
    lastFocus = document.activeElement;
    var ov = h('div', { class: 'overlay overlay-' + kind, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ov-title' },
      h('div', { class: 'overlay-backdrop', on: { click: closeOverlays } }),
      h('div', { class: 'overlay-body' }, content));
    overlaysEl.appendChild(ov);
    document.documentElement.classList.add('modal-open');
    var f = ov.querySelector('button');
    if (f) try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    return ov;
  }
  function closeOverlays() {
    var had = overlaysEl.querySelector('.overlay');
    overlaysEl.querySelectorAll('.overlay').forEach(function (o) {
      if (o._resolve) o._resolve(false);
      o.parentNode.removeChild(o);
    });
    document.documentElement.classList.remove('modal-open');
    if (had && lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeOverlays(); });

  function confirmDialog(title, body, okLabel, cancelLabel) {
    return new Promise(function (resolve) {
      var ov;
      function done(v) { if (ov) ov._resolve = null; closeOverlays(); resolve(v); }
      ov = openOverlay('confirm', h('div', { class: 'dialog paper-sheet' },
        h('h2', { id: 'ov-title', text: title }),
        h('p', { text: body }),
        h('div', { class: 'dialog-actions' },
          btn(cancelLabel || 'Cancel', function () { done(false); }, 'btn-secondary', { 'data-action': 'cancel' }),
          btn(okLabel || 'OK', function () { done(true); }, 'btn-primary', { 'data-action': 'ok' }))));
      ov._resolve = resolve;
    });
  }

  function segmented(label, options, current, onPick, name) {
    var group = h('div', { class: 'seg', role: 'group', 'aria-label': label, 'data-setting': name });
    options.forEach(function (o) {
      group.appendChild(h('button', {
        type: 'button', class: 'seg-btn', 'aria-pressed': o.value === current ? 'true' : 'false', 'data-value': String(o.value),
        on: {
          click: function () {
            onPick(o.value);
            group.querySelectorAll('.seg-btn').forEach(function (b) { b.setAttribute('aria-pressed', b === this ? 'true' : 'false'); }, this);
          }
        }
      }, o.label));
    });
    return h('div', { class: 'setting-row' }, h('span', { class: 'setting-label', text: label }), group);
  }

  function openSettings() {
    openOverlay('settings', h('div', { class: 'dialog paper-sheet settings' },
      h('header', { class: 'book-head' },
        h('h2', { id: 'ov-title' }, px('SETTINGS')),
        iconBtn('close', 'Close settings', closeOverlays, 'book-close')),
      segmented('Sound', [{ label: 'Off', value: false }, { label: 'On', value: true }], settings.sound, setSound, 'sound'),
      segmented('Text size', [{ label: 'Normal', value: 'normal' }, { label: 'Large', value: 'large' }], settings.textSize, function (v) {
        settings.textSize = v; saveSettings(); applySettings();
      }, 'text'),
      segmented('Day timer', [{ label: 'Off', value: false }, { label: '3 min each', value: true }], settings.timer, function (v) {
        settings.timer = !!v; saveSettings();
        if (document.querySelector('.desk')) { ui.msStart = Date.now(); ui.warned = false; startTimer(); }
      }, 'timer'),
      h('p', { class: 'setting-note', text: 'The timer is a gentle guide: 3 minutes per manuscript. It never submits for you.' }),
      btn('Done', closeOverlays, 'btn-primary', { 'data-action': 'settings-done' })));
  }

  function toast(msg) {
    var old = document.querySelector('.toast');
    if (old) old.parentNode.removeChild(old);
    var t = h('div', { class: 'toast', role: 'status' }, msg);
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 20);
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 400); }, 6000);
  }

  /* ---------- Desk ---------- */
  function currentMs() { return game.manuscriptsFor(S.day)[S.ms]; }
  function ensureDraft(m) {
    if (!S.draft || S.draft.msId !== m.id) S.draft = { msId: m.id, step: 'A', main: null, concession: null, school: null, approach: null };
    return S.draft;
  }
  function tabsVisible() {
    var t = document.querySelector('.desk .tabs');
    return !!(t && window.getComputedStyle(t).display !== 'none');
  }
  function setTab(tab) {
    ui.tab = tab;
    var desk = document.querySelector('.desk');
    if (!desk) return;
    desk.setAttribute('data-tab', tab);
    desk.querySelectorAll('.tab').forEach(function (b) {
      var on = b.getAttribute('data-tab-target') === tab;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (tabsVisible()) try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
    renderPanel();
  }

  function fieldValue(v, redacted) {
    if (v == null || v === '') return redacted ? h('span', { class: 'redacted redacted-empty', 'aria-label': 'Redacted' }) : h('span', { text: '' });
    var s = String(v);
    if (/\[Redacted\]/i.test(s)) return h('span', { class: 'redacted', text: s });
    return h('span', { text: s });
  }

  function dossierCard(m) {
    var d = m.dossier || {};
    var red = !!d.redacted;
    var sources = Array.isArray(d.sources) ? d.sources : (d.sources ? [d.sources] : []);
    return h('div', { class: 'dossier folder' + (red ? ' is-redacted' : '') },
      h('div', { class: 'folder-tab' }, px('DOSSIER')),
      h('div', { class: 'dossier-head' },
        h('div', { class: 'portrait-frame' }, art.portrait(d.name, red)),
        h('div', { class: 'dossier-name' },
          h('span', { class: 'dl-label', text: 'Author' }),
          h('h2', null, fieldValue(d.name, red)))),
      h('dl', { class: 'dossier-fields' },
        h('dt', null, 'Role'), h('dd', null, fieldValue(d.role, red)),
        h('dt', null, 'Nationality'), h('dd', null, fieldValue(d.nationality, red)),
        h('dt', null, 'Year written'), h('dd', null, fieldValue(d.yearWritten, red)),
        h('dt', null, 'Sources'), h('dd', null, h('ul', { class: 'sources' }, sources.map(function (s) { return h('li', null, fieldValue(s, red)); })))),
      h('button', { type: 'button', class: 'btn btn-secondary phone-only', 'data-action': 'read-extract', on: { click: function () { setTab('extract'); } } }, 'Read the extract'));
  }

  function extractPaper(m, msIndex, count) {
    var p = h('p', { class: 'extract', lang: 'en' });
    m.sentences.forEach(function (s, i) {
      var idx = i + 1;
      var sp = h('span', {
        class: 'sentence', role: 'button', tabindex: '0', 'data-index': String(idx), 'aria-pressed': 'false',
        on: {
          click: function () { onSentence(idx); },
          keydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSentence(idx); } }
        }
      }, s);
      p.appendChild(sp);
      if (i < m.sentences.length - 1) p.appendChild(document.createTextNode(' '));
    });
    return h('article', { class: 'paper manuscript', 'aria-label': 'Manuscript extract', 'data-ms-id': m.id },
      h('header', { class: 'paper-head' },
        px('MANUSCRIPT', 'paper-kicker'),
        h('span', { class: 'paper-count', text: (msIndex + 1) + ' / ' + count })),
      p);
  }

  function showDesk(fresh) {
    var d = game.days[S.day];
    var list = game.manuscriptsFor(S.day);
    if (S.ms >= list.length) { S.phase = 'review'; save(); return showReview(S.day, false); }
    var m = list[S.ms];
    var draft = ensureDraft(m);
    if (fresh || draft.step === 'A') ui.tab = 'dossier';
    save();

    var timerEl = settings.timer ? h('span', { class: 'timer', role: 'timer', 'aria-live': 'off' }, art.icon('clock'), h('span', { class: 'timer-text' }, '3:00')) : null;

    var desk = h('div', { class: 'screen desk', 'data-tab': ui.tab, 'data-step': draft.step },
      h('div', { class: 'desk-head' },
        h('header', { class: 'topbar' },
          h('div', { class: 'tb-where' },
            px('DAY ' + d.day + ' · ' + d.year, 'tb-day'),
            h('span', { class: 'tb-sub' },
              h('span', { class: 'tb-count', text: 'Manuscript ' + (S.ms + 1) + ' of ' + list.length }),
              timerEl)),
          h('div', { class: 'tb-tools' },
            iconBtn('book', 'Open rulebook', openRulebook, 'tb-rulebook'),
            soundBtn(),
            iconBtn('gear', 'Settings', openSettings),
            h('button', { type: 'button', class: 'btn btn-ghost tb-menu', 'data-action': 'menu', on: { click: function () { save(); showTitle(); } } }, 'Menu'))),
        h('nav', { class: 'tabs', role: 'tablist', 'aria-label': 'Desk' },
          [['dossier', 'Dossier'], ['extract', 'Extract'], ['rulebook', 'Rulebook']].map(function (t) {
            return h('button', {
              type: 'button', class: 'tab', role: 'tab', 'data-tab-target': t[0], 'aria-selected': ui.tab === t[0] ? 'true' : 'false',
              on: { click: function () { setTab(t[0]); } }
            }, t[1]);
          }))),
      h('div', { class: 'desk-surface' },
        h('section', { class: 'pane pane-dossier', 'aria-label': 'Dossier' }, dossierCard(m)),
        h('section', { class: 'pane pane-extract', 'aria-label': 'Extract' }, extractPaper(m, S.ms, list.length)),
        h('section', { class: 'pane pane-rulebook', 'aria-label': 'Rulebook' },
          h('button', { type: 'button', class: 'closed-book', 'data-action': 'open-rulebook', on: { click: openRulebook } },
            h('span', { class: 'closed-book-cover' }, px('RULEBOOK'), h('span', { class: 'closed-book-hint' }, 'Tap to open'))),
          h('div', { class: 'rb-inline paper-sheet' }, rulebookContent(S.day)),
          h('div', { class: 'decor', 'aria-hidden': 'true' }, art.lamp(), art.mug())),
        h('section', { class: 'pane pane-decision', 'aria-label': 'Decision' }, h('div', { class: 'decision' }))));

    setScreen(desk, eraOf(S.day));
    if (fresh) {
      var paper = desk.querySelector('.manuscript');
      paper.classList.add('slide-in');
      setTimeout(function () { paper.classList.remove('slide-in'); }, 600);
    }
    renderSentences();
    renderPanel();
    observePanel(desk);
    ui.msStart = Date.now(); ui.warned = false;
    startTimer();
  }

  function observePanel(desk) {
    var panel = desk.querySelector('.pane-decision');
    function upd() { desk.style.setProperty('--panel-h', panel.offsetHeight + 'px'); }
    upd();
    if (window.ResizeObserver) { ui.panelObserver = new ResizeObserver(upd); ui.panelObserver.observe(panel); }
    else window.addEventListener('resize', upd);
  }

  /* Steps: A main argument, B interpretation, C concession, D approach, E stamp.
     draft.concession: null = not chosen yet, 0 = "No concession", n = sentence n. */
  var STEPS = ['A', 'B', 'C', 'D', 'E'];
  var NO_CONCESSION = 0;
  function flagStep(step) { return step === 'A' || step === 'C'; }

  function renderSentences() {
    var draft = S.draft;
    var desk = document.querySelector('.desk');
    if (!desk || !draft) return;
    desk.setAttribute('data-step', draft.step);
    desk.querySelectorAll('.sentence').forEach(function (sp) {
      var idx = +sp.getAttribute('data-index');
      var isMain = draft.main === idx;
      var isCon = draft.concession === idx;
      sp.classList.toggle('selected', isMain);
      sp.classList.toggle('selected-con', isCon);
      var pressed = draft.step === 'C' ? isCon : isMain;
      sp.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      var locked = !flagStep(draft.step) || (draft.step === 'C' && isMain);
      if (locked) sp.setAttribute('aria-disabled', 'true'); else sp.removeAttribute('aria-disabled');
    });
  }

  function onSentence(idx) {
    if (ui.busy || !S.draft) return;
    var draft = S.draft;
    if (draft.step === 'A') {
      draft.main = draft.main === idx ? null : idx;
      if (draft.main != null && draft.concession === draft.main) draft.concession = null;
    }
    else if (draft.step === 'C') {
      if (idx === draft.main) return; // the main argument cannot also be the concession
      draft.concession = draft.concession === idx ? null : idx;
    } else return;
    save(); audio.tick();
    renderSentences(); renderPanel();
  }

  function tally(list) {
    var wrap = h('div', { class: 'tally', 'aria-label': 'Board compliance so far' },
      h('span', { class: 'tally-label' }, 'Board'));
    var pips = h('span', { class: 'pips' });
    var ok = 0, done = 0;
    list.forEach(function (m) {
      var a = S.answers[m.id];
      var cls = 'pip', label = 'not yet stamped';
      if (a && a.stamp) {
        done++;
        var good = a.stamp === m.key.stamp;
        if (good) ok++;
        cls += good ? ' pip-ok' : ' pip-bad';
        label = good ? 'followed the directive' : 'went against the directive';
      }
      pips.appendChild(h('span', { class: cls, title: label }));
    });
    wrap.appendChild(pips);
    wrap.appendChild(h('span', { class: 'tally-num', 'data-compliance': ok + '/' + done }, ok + '/' + done));
    return wrap;
  }

  /* Finished steps are buttons: tapping one goes back to it with the earlier answers still
     selected, so the player only changes what they want and confirms forward again. */
  function stepper(draft) {
    var cur = STEPS.indexOf(draft.step);
    var skipD = game.skipsApproach(draft.school) && cur >= 2;
    return h('ol', { class: 'stepper', 'aria-label': 'Progress' }, STEPS.map(function (s, i) {
      if (s === 'D' && skipD) return h('li', { class: 'step skipped', 'aria-label': 'Step D: skipped' }, s);
      if (i < cur) {
        return h('li', { class: 'step done' },
          h('button', {
            type: 'button', class: 'step-back', 'data-step-back': s, 'aria-label': 'Step ' + s + ': done. Tap to go back and change it',
            on: { click: function () { if (!ui.busy && S.draft) goTo(s); } }
          }, s));
      }
      if (i === cur) return h('li', { class: 'step current', 'aria-label': 'Step ' + s + ': current', 'aria-current': 'step' }, s);
      return h('li', { class: 'step', 'aria-label': 'Step ' + s + ': to do' }, s);
    }));
  }

  function optionGrid(items, selected, onPick, attr) {
    return h('div', { class: 'options' }, items.map(function (it) {
      var b = h('button', {
        type: 'button', class: 'opt', 'aria-pressed': it.value === selected ? 'true' : 'false',
        on: { click: function () { onPick(it.value); } }
      }, it.label);
      b.setAttribute(attr, it.value);
      return b;
    }));
  }

  function goTo(step) {
    S.draft.step = step; save(); audio.tick(); renderSentences(); renderPanel();
  }

  function stepTitle(letter, text) {
    return h('h3', null, h('span', { class: 'step-letter' }, letter), text);
  }

  function renderPanel() {
    var panel = document.querySelector('.desk .decision');
    if (!panel || !S || !S.draft) return;
    var d = game.days[S.day];
    var list = game.manuscriptsFor(S.day);
    var draft = S.draft;
    clear(panel);
    panel.appendChild(h('div', { class: 'decision-top' }, tally(list), stepper(draft)));
    var body = h('div', { class: 'step-body', 'data-step': draft.step });
    panel.appendChild(body);
    var openExtract = (tabsVisible() && ui.tab !== 'extract')
      ? btn('Open the extract', function () { setTab('extract'); }, 'btn-secondary', { 'data-action': 'open-extract' }) : null;

    if (draft.step === 'A') {
      body.appendChild(stepTitle('A', 'Flag the main argument'));
      body.appendChild(h('p', { class: 'step-help' }, "Tap the sentence that carries the historian's central claim. You can change it until you confirm."));
      body.appendChild(h('p', { class: 'flag-status' + (draft.main ? ' has-flag' : '') }, art.icon('flag'), draft.main ? ' One sentence flagged' : ' Nothing flagged yet'));
      body.appendChild(h('div', { class: 'step-actions' }, openExtract,
        btn('Confirm flag', function () { if (draft.main) goTo('B'); }, 'btn-primary', { 'data-action': 'confirm', disabled: draft.main ? null : true })));
    } else if (draft.step === 'B') {
      body.appendChild(stepTitle('B', 'Classify the interpretation'));
      body.appendChild(optionGrid((d.schoolOptions || []).map(function (id) { return { value: id, label: game.schoolLabel(id) }; }), draft.school, function (v) {
        draft.school = v; save(); audio.tick(); renderPanel();
      }, 'data-school'));
      body.appendChild(h('div', { class: 'step-actions' }, btn('Confirm', function () {
        if (draft.school) goTo('C');
      }, 'btn-primary', { 'data-action': 'confirm', disabled: draft.school ? null : true })));
    } else if (draft.step === 'C') {
      var chosen = draft.concession != null;
      body.appendChild(stepTitle('C', 'Flag the concession'));
      body.appendChild(h('p', { class: 'step-help' }, 'Tap the sentence where the historian admits a point for the other side. If they never do, choose No concession.'));
      body.appendChild(h('p', { class: 'flag-status con' + (chosen ? ' has-flag' : '') }, art.icon('flag', { r: '#2d6fb3' }),
        draft.concession ? ' One sentence flagged' : (draft.concession === NO_CONCESSION ? ' No concession chosen' : ' Nothing flagged yet')));
      body.appendChild(h('div', { class: 'step-actions' }, openExtract,
        h('button', {
          type: 'button', class: 'btn btn-secondary btn-none', 'data-action': 'no-concession', 'aria-pressed': draft.concession === NO_CONCESSION ? 'true' : 'false',
          on: { click: function () { draft.concession = draft.concession === NO_CONCESSION ? null : NO_CONCESSION; save(); audio.tick(); renderSentences(); renderPanel(); } }
        }, 'No concession')));
      body.appendChild(h('div', { class: 'step-actions' },
        btn('Confirm', function () {
          if (draft.concession == null) return;
          if (game.skipsApproach(draft.school)) { draft.approach = null; goTo('E'); }
          else goTo('D');
        }, 'btn-primary', { 'data-action': 'confirm', disabled: chosen ? null : true })));
    } else if (draft.step === 'D') {
      body.appendChild(stepTitle('D', 'Identify the approach'));
      body.appendChild(optionGrid(DATA.approaches.map(function (a) { return { value: a, label: a }; }), draft.approach, function (v) {
        draft.approach = v; save(); audio.tick(); renderPanel();
      }, 'data-approach'));
      body.appendChild(h('div', { class: 'step-actions' }, btn('Confirm', function () {
        if (draft.approach) goTo('E');
      }, 'btn-primary', { 'data-action': 'confirm', disabled: draft.approach ? null : true })));
    } else if (draft.step === 'E') {
      body.appendChild(stepTitle('E', 'Stamp the manuscript'));
      body.appendChild(h('p', { class: 'step-help' }, "Follow today's directive. The board will see your decision."));
      body.appendChild(h('div', { class: 'stamps' },
        h('button', { type: 'button', class: 'stamp-btn stamp-publish', 'data-stamp': 'PUBLISH', on: { click: function () { onStamp('PUBLISH'); } } },
          h('span', { class: 'stamp-handle', 'aria-hidden': 'true' }), h('span', { class: 'stamp-face' }, px('PUBLISH')), h('span', { class: 'sr-only' }, 'Stamp: publish')),
        h('button', { type: 'button', class: 'stamp-btn stamp-reject', 'data-stamp': 'REJECT', on: { click: function () { onStamp('REJECT'); } } },
          h('span', { class: 'stamp-handle', 'aria-hidden': 'true' }), h('span', { class: 'stamp-face' }, px('REJECT')), h('span', { class: 'sr-only' }, 'Stamp: reject'))));
    }

    var cur = STEPS.indexOf(draft.step);
    if (cur > 0) {
      var chips = h('ul', { class: 'choices', 'aria-label': 'Your choices so far' });
      chips.appendChild(h('li', null, h('b', null, 'A'), ' flagged'));
      if (cur > 1) chips.appendChild(h('li', null, h('b', null, 'B'), ' ' + game.schoolLabel(draft.school)));
      if (cur > 2) chips.appendChild(h('li', null, h('b', null, 'C'), draft.concession === NO_CONCESSION ? ' no concession' : ' flagged'));
      if (cur > 3) chips.appendChild(h('li', null, h('b', null, 'D'), ' ' + (game.skipsApproach(draft.school) ? 'skipped' : draft.approach)));
      panel.appendChild(chips);
      panel.appendChild(h('p', { class: 'back-hint' }, 'Tap a finished letter above to go back and change an answer.'));
    }
  }

  function onStamp(kind) {
    if (ui.busy || !S.draft || S.draft.step !== 'E') return;
    ui.busy = true;
    var m = currentMs();
    var d = game.days[S.day];
    var draft = S.draft;
    S.answers[m.id] = { main: draft.main, concession: draft.concession, school: draft.school, approach: game.skipsApproach(draft.school) ? null : draft.approach, stamp: kind };
    S.draft = null;
    S.ms++;
    var last = S.ms >= game.manuscriptsFor(S.day).length;
    if (last) S.phase = 'review';
    save();

    if (tabsVisible()) setTab('extract');
    var desk = document.querySelector('.desk');
    desk.querySelectorAll('.stamp-btn, .opt, .btn').forEach(function (b) { b.disabled = true; });
    var paper = desk.querySelector('.manuscript');
    var pressed = desk.querySelector('.stamp-btn[data-stamp="' + kind + '"]');
    if (pressed) pressed.classList.add('pressing');
    var mark = art.stampMark(kind, d.year);
    paper.appendChild(mark);
    audio.stamp();
    paper.classList.add('thud');
    var tallyEl = desk.querySelector('.tally');
    if (tallyEl) tallyEl.parentNode.replaceChild(tally(game.manuscriptsFor(S.day)), tallyEl);

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(function () {
      paper.classList.add('slide-out');
      audio.paper();
      setTimeout(function () {
        ui.busy = false;
        if (last) showReview(S.day, false);
        else showDesk(true);
      }, reduce ? 50 : 420);
    }, reduce ? 500 : 1100);
  }

  /* ---------- Timer (optional, never submits) ---------- */
  function stopTimer() { if (ui.timerId) { clearInterval(ui.timerId); ui.timerId = null; } }
  function startTimer() {
    stopTimer();
    var desk = document.querySelector('.desk');
    var existing = desk && desk.querySelector('.timer');
    if (!settings.timer) { if (existing) existing.parentNode.removeChild(existing); return; }
    if (!desk) return;
    if (!existing) {
      existing = h('span', { class: 'timer', role: 'timer', 'aria-live': 'off' }, art.icon('clock'), h('span', { class: 'timer-text' }, '3:00'));
      desk.querySelector('.tb-sub').appendChild(existing);
    }
    function tick() {
      var left = TIMER_SECONDS - Math.floor((Date.now() - ui.msStart) / 1000);
      var t = existing.querySelector('.timer-text');
      var a = Math.max(0, left);
      t.textContent = Math.floor(a / 60) + ':' + ('0' + (a % 60)).slice(-2);
      existing.classList.toggle('low', left <= TIMER_LOW && left > 0);
      existing.classList.toggle('over', left <= 0);
      if (left <= 0 && !ui.warned) {
        ui.warned = true;
        toast("Three minutes are up for this manuscript. There's no penalty: finish your decision when you're ready.");
      }
    }
    tick();
    ui.timerId = setInterval(tick, 1000);
  }

  /* ---------- End-of-day review ---------- */
  function legend() {
    return h('ul', { class: 'legend', 'aria-label': 'Key' },
      h('li', null, h('span', { class: 'sw sw-main' }), 'Main argument'),
      h('li', null, h('span', { class: 'sw sw-con' }), 'Concession'),
      h('li', null, h('span', { class: 'sw sw-sub' }), 'Sub-message'),
      h('li', null, h('span', { class: 'sw sw-flag' }), 'Your main-argument flag'),
      h('li', null, h('span', { class: 'sw sw-cflag' }), 'Your concession flag'));
  }

  function numberedExtract(m, a) {
    var k = m.key || {};
    var p = h('p', { class: 'extract numbered' });
    m.sentences.forEach(function (s, i) {
      var idx = i + 1;
      var cls = 'rs';
      var role = null;
      if ((k.mainArgument || []).indexOf(idx) >= 0) { cls += ' rs-main'; role = 'main argument'; }
      else if ((k.concessions || []).indexOf(idx) >= 0) { cls += ' rs-con'; role = 'concession'; }
      else if ((k.subMessages || []).indexOf(idx) >= 0) { cls += ' rs-sub'; role = 'sub-message'; }
      var yours = a && a.main === idx;
      var yoursCon = a && a.concession === idx;
      if (yours) cls += ' rs-flag';
      if (yoursCon) cls += ' rs-cflag';
      var label = 'Sentence ' + idx + (role ? ', ' + role : '') + (yours ? ', your main-argument flag' : '') + (yoursCon ? ', your concession flag' : '');
      p.appendChild(h('span', { class: cls, 'data-index': String(idx) },
        h('span', { class: 'num', 'aria-label': label }, String(idx)),
        yours ? h('span', { class: 'flag-mark', 'aria-hidden': 'true' }, art.icon('flag')) : null,
        yoursCon ? h('span', { class: 'flag-mark', 'aria-hidden': 'true' }, art.icon('flag', { r: '#2d6fb3' })) : null,
        ' ', s));
      if (i < m.sentences.length - 1) p.appendChild(document.createTextNode(' '));
    });
    return p;
  }

  function mark(ok) {
    return h('span', { class: 'mark ' + (ok ? 'mark-ok' : 'mark-bad') }, art.icon(ok ? 'check' : 'cross'), h('span', { class: 'sr-only' }, ok ? 'Correct' : 'Incorrect'));
  }

  function reviewCard(m, a, n) {
    var k = m.key || {};
    var s = game.score(m, a);
    a = a || {};
    var mainCorrect = 'Sentence ' + (k.mainArgument || [])[0];
    if ((k.mainArgument || []).length > 1) mainCorrect += ' (also accepted: ' + k.mainArgument.slice(1).join(', ') + ')';
    var cons = k.concessions || [];
    var conCorrect = cons.length ? 'Sentence ' + cons.join(' or ') : 'No concession';
    var conYours = a.concession == null ? 'None' : (a.concession === 0 ? 'No concession' : 'Sentence ' + a.concession);
    var apCorrect;
    if (k.school === CWE.NOT_BLAME) apCorrect = 'Skipped';
    else {
      apCorrect = String(k.approach);
      if ((k.approachAlsoAccept || []).length) apCorrect += ' (also accepted: ' + k.approachAlsoAccept.join(', ') + ')';
    }
    var rows = [
      ['A', 'Main argument', a.main ? 'Sentence ' + a.main : 'None', mainCorrect, s.mainOk],
      ['B', 'Interpretation', a.school ? game.schoolLabel(a.school) : 'None', game.schoolLabel(k.school), s.schoolOk],
      ['C', 'Concession', conYours, conCorrect, s.concessionOk],
      ['D', 'Approach', s.approachSkipped ? 'Skipped' : (a.approach || 'None'), apCorrect, s.approachOk],
      ['E', 'Stamp', a.stamp || 'None', k.stamp, s.stampOk]
    ];
    var name = (m.dossier && m.dossier.name) || '';
    return h('article', { class: 'review-card paper-sheet', 'data-ms-id': m.id },
      h('header', { class: 'rc-head' },
        h('div', null,
          h('span', { class: 'rc-num', text: 'Manuscript ' + n }),
          h('h3', null, fieldValue(name, m.dossier && m.dossier.redacted))),
        h('div', { class: 'rc-score' },
          h('span', { class: 'rc-int', 'data-points': s.points + '/' + s.max }, 'Integrity ' + s.points + '/' + s.max),
          h('span', { class: 'rc-comp ' + (s.stampOk ? 'ok' : 'bad') }, 'Board ', mark(s.stampOk)))),
      numberedExtract(m, a),
      h('div', { class: 'answers', role: 'table', 'aria-label': 'Your answers' },
        h('div', { class: 'ans-row ans-head', role: 'row' },
          h('span', { role: 'columnheader' }, 'Step'), h('span', { role: 'columnheader' }, 'Your answer'), h('span', { role: 'columnheader' }, 'Correct answer')),
        rows.map(function (r) {
          return h('div', { class: 'ans-row ' + (r[4] ? 'is-ok' : 'is-bad'), role: 'row', 'data-step': r[0] },
            h('span', { class: 'ans-step', role: 'cell' }, h('b', null, r[0]), ' ', r[1]),
            h('span', { class: 'ans-you', role: 'cell' }, mark(r[4]), ' ', r[2]),
            h('span', { class: 'ans-key', role: 'cell', text: r[3] }));
        })),
      h('section', { class: 'rc-expl' }, h('h4', null, 'Explanation'), h('p', { text: m.explanation || '' })),
      (m.anchors && m.anchors.length) ? h('section', { class: 'rc-anchors' }, h('h4', null, 'Historical anchors'),
        h('ul', null, m.anchors.map(function (x) { return h('li', { text: x }); }))) : null,
      s.trapHit ? h('section', { class: 'rc-trap', 'data-trap': m.trap }, h('h4', null, 'Trap'), h('p', { text: (DATA.traps || {})[m.trap] || '' })) : null);
  }

  function memoFor(t) {
    var r = t.complianceMax ? t.compliance / t.complianceMax : 0;
    if (r >= 0.8) return MEMOS.pleased;
    if (r >= 0.5) return MEMOS.neutral;
    return MEMOS.displeased;
  }

  function showReview(dayIndex, fromFinal) {
    var d = game.days[dayIndex];
    var list = game.manuscriptsFor(dayIndex);
    var t = game.dayTotals(dayIndex, S.answers);
    var memo = memoFor(t);
    var lastDay = dayIndex >= game.days.length - 1;
    var next;
    if (fromFinal) next = btn('Back to final report', function () { showFinal(); }, 'btn-primary btn-big', { 'data-action': 'back-final' });
    else next = btn(lastDay ? 'See the final report' : 'Go home for the night', function () {
      if (lastDay) { S.phase = 'final'; S.finishedAt = S.finishedAt || Date.now(); }
      else { S.day = dayIndex + 1; S.ms = 0; S.phase = 'briefing'; }
      save(); audio.paper(); route();
    }, 'btn-primary btn-big', { 'data-action': 'next' });

    var node = h('main', { class: 'screen review-screen' },
      h('header', { class: 'review-head' },
        px('END OF DAY ' + d.day + ' · ' + d.year, 'rv-kicker'),
        h('h1', null, px(d.title)),
        h('p', null, "The senior editor has marked today's manuscripts. Sentence numbers are shown for review.")),
      legend(),
      h('div', { class: 'review-list' }, list.map(function (m, i) { return reviewCard(m, S.answers[m.id], i + 1); })),
      h('section', { class: 'board-memo paper-sheet memo', 'data-memo': memo.seal },
        h('header', { class: 'memo-head' },
          h('div', { class: 'memo-portrait' }, art.portrait('Board of Directors, Meridian Press')),
          h('div', null,
            h('h2', null, px('MEMO')),
            h('p', { class: 'memo-meta' }, 'From: The Board of Directors, Meridian Press', h('br'), 'To: ' + S.name + ', Junior Editor', h('br'), 'Re: Your decisions, ' + d.year))),
        h('p', { class: 'memo-text', text: memo.text }),
        h('p', { class: 'memo-score' }, 'Board compliance today: ' + t.compliance + ' / ' + t.complianceMax),
        h('div', { class: 'memo-seal seal-' + memo.seal.toLowerCase(), 'aria-hidden': 'true' }, px(memo.seal))),
      h('section', { class: 'integrity-day paper-sheet' },
        h('h2', null, 'Scholarly integrity today'),
        h('p', { class: 'big-score', 'data-day-integrity': t.pct }, t.points + ' / ' + t.max, h('span', { class: 'pct' }, ' (' + t.pct + '%)'))),
      h('div', { class: 'screen-actions' }, next));
    setScreen(node, eraOf(dayIndex));
  }

  /* ---------- Final screen and results card ---------- */
  function showFinal() {
    S.phase = 'final'; S.finishedAt = S.finishedAt || Date.now(); save();
    var t = game.totals(S.answers);
    var band = game.band(t.pct) || { rank: '', text: '' };
    var traps = game.commonTraps(S.answers);
    var db = DATA.debrief || {};
    var node = h('main', { class: 'screen final-screen' },
      h('header', { class: 'review-head' },
        px('FINAL REPORT', 'rv-kicker'),
        h('h1', null, px(DATA.meta.title)),
        h('p', { text: DATA.meta.subtitle })),
      h('section', { class: 'rank-block paper-sheet' },
        h('h2', null, 'Scholarly integrity'),
        h('p', { class: 'big-score', 'data-total-integrity': t.pct }, t.pct + '%', h('span', { class: 'pct' }, ' (' + t.points + ' / ' + t.max + ')')),
        h('p', { class: 'rank' }, px(band.rank)),
        h('p', { text: band.text })),
      h('section', { class: 'paper-sheet' },
        h('h2', null, 'Board compliance'),
        h('p', { class: 'big-score small', 'data-total-compliance': t.compliance + '/' + t.complianceMax }, t.compliance + ' / ' + t.complianceMax, h('span', { class: 'pct' }, ' (' + t.compliancePct + '%)')),
        h('p', { class: 'note', text: DATA.endings.twoAxisNote })),
      h('section', { class: 'paper-sheet trap-summary' },
        h('h2', null, 'The trap that caught you most often'),
        traps.ids.length
          ? h('div', null, traps.ids.map(function (id) { return h('p', { class: 'rc-trap', 'data-trap': id, text: DATA.traps[id] }); }),
            h('p', { class: 'note' }, 'Caught you ' + traps.count + ' time' + (traps.count === 1 ? '' : 's') + '.'))
          : h('p', null, 'No traps caught you.')),
      h('section', { class: 'paper-sheet days-summary' },
        h('h2', null, 'Day by day'),
        h('ul', { class: 'day-list' }, game.days.map(function (d, i) {
          var dt = t.days[i];
          return h('li', null,
            h('span', { class: 'dl-name', text: 'Day ' + d.day + ' · ' + d.year }),
            h('span', { class: 'dl-score', text: dt.pct + '%' }),
            btn('Review', function () { showReview(i, true); }, 'btn-secondary btn-small', { 'data-action': 'review-day', 'data-day': String(i) }));
        }))),
      h('section', { class: 'paper-sheet debrief' },
        h('h2', null, 'How the debate developed'),
        h('ul', { class: 'era-list' }, (db.summary || []).map(function (x) { return h('li', { text: x }); })),
        h('h3', null, 'Reflect'),
        h('p', { class: 'reflect', text: db.reflectionPrompt || '' }),
        h('h3', null, 'Remember'),
        h('p', { class: 'exam', text: db.examReminder || '' })),
      h('div', { class: 'screen-actions' },
        btn('Show my results card', function () { S.phase = 'results'; save(); showResults(); }, 'btn-primary btn-big', { 'data-action': 'results' }),
        btn('Play again', function () {
          confirmDialog('Play again?', 'This clears your results and starts again at Day 1.', 'Play again', 'Cancel').then(function (ok) {
            if (!ok) return;
            var n = S.name; store.remove(SAVE_KEY); S = newState(n); save(); route();
          });
        }, 'btn-secondary', { 'data-action': 'play-again' }),
        btn('Title screen', function () { showTitle(); }, 'btn-ghost', { 'data-action': 'title' })));
    setScreen(node, 'final');
  }

  function showResults() {
    var t = game.totals(S.answers);
    var band = game.band(t.pct) || { rank: '' };
    var traps = game.commonTraps(S.answers);
    var when = new Date(S.finishedAt || Date.now());
    var dateStr;
    try { dateStr = when.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { dateStr = when.toDateString(); }
    var card = h('div', { class: 'results-card', id: 'results-card' },
      h('header', { class: 'res-head' },
        h('p', { class: 'res-title' }, px(DATA.meta.title)),
        h('p', { class: 'res-course', text: DATA.meta.course })),
      h('div', { class: 'res-name' },
        h('span', { class: 'res-label' }, 'Editor'),
        h('strong', { class: 'res-player', text: S.name }),
        h('span', { class: 'res-date', text: dateStr })),
      h('div', { class: 'res-overall' },
        h('div', null, h('span', { class: 'res-label' }, 'Scholarly integrity'), h('strong', { class: 'res-big' }, t.pct + '%')),
        h('div', null, h('span', { class: 'res-label' }, 'Rank'), h('strong', { class: 'res-rank' }, px(band.rank)))),
      h('ul', { class: 'res-days' }, game.days.map(function (d, i) {
        var pct = t.days[i].pct;
        return h('li', null,
          h('span', { class: 'res-day', text: 'Day ' + d.day + ' · ' + d.year }),
          h('span', { class: 'res-bar', 'aria-hidden': 'true' }, h('span', { class: 'res-fill', style: 'width:' + pct + '%' })),
          h('span', { class: 'res-pct', text: pct + '%' }));
      })),
      h('div', { class: 'res-foot' },
        h('div', null, h('span', { class: 'res-label' }, 'Board compliance'), h('strong', null, t.compliance + ' / ' + t.complianceMax)),
        h('div', null, h('span', { class: 'res-label' }, 'Most common trap'),
          h('strong', null, traps.ids.length ? traps.ids.map(function (id) { return game.trapName(id); }).join(' / ') : 'None'))));
    var node = h('main', { class: 'screen results-screen' },
      card,
      h('p', { class: 'res-hint' }, 'Take a screenshot of this card to show your teacher.'),
      h('div', { class: 'screen-actions' },
        btn('Back to final report', function () { showFinal(); }, 'btn-secondary', { 'data-action': 'back-final' })));
    setScreen(node, 'final');
  }

  /* ---------- Boot ---------- */
  function showError(msg) {
    clear(appEl);
    appEl.appendChild(h('main', { class: 'screen title-screen' },
      h('div', { class: 'title-card' },
        h('h1', { class: 'title-h1' }, px('MERIDIAN PRESS')),
        h('p', { text: msg }),
        btn('Try again', boot, 'btn-primary'))));
  }

  function boot() {
    loadSettings();
    fetch('data/manuscripts.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        DATA = data;
        problems = CWE.validate(data);
        if (problems.length && window.console) console.warn('manuscripts.json content check:\n' + problems.join('\n'));
        game = new CWE.Game(data);
        CWE._debug = { game: game, data: data, problems: problems, state: function () { return S; } };
        showTitle();
      })
      .catch(function (e) {
        showError('The manuscripts could not be loaded (' + (e && e.message ? e.message : 'unknown error') + '). Check your connection and try again.');
      });
  }

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline support is optional */ });
    });
  }

  boot();
})();
