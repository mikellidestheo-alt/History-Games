/* Check data/manuscripts.json with the same rules the game uses at start-up.
   Run from the repository root:  node cold-war-editor/tests/validate-content.mjs */
import fs from 'fs';
import vm from 'vm';

const code = fs.readFileSync(new URL('../js/validate.js', import.meta.url), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(code, sandbox);
const data = JSON.parse(fs.readFileSync(new URL('../data/manuscripts.json', import.meta.url), 'utf8'));
const problems = sandbox.window.CWE.validate(data);
const perDay = {};
for (const m of data.manuscripts) perDay[m.day] = (perDay[m.day] || 0) + 1;
console.log(`${data.manuscripts.length} manuscripts across ${data.days.length} days:`, perDay);
if (problems.length) {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) console.log(' - ' + p);
  process.exit(1);
}
console.log('No problems: every key refers to valid sentence numbers, schools, approaches, stamps and traps.');
