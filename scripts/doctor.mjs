// npm run doctor
//
// Says whether this computer is ready to run the lab, and what to do if not, in plain words.
//   npm run doctor                  everything
//   npm run doctor -- --json        the same, for Claude to read
//   node scripts/doctor.mjs --quick  only what stops the lab starting (runs before `npm run dev`; silent when fine)
//   node scripts/doctor.mjs --for check   adds what `npm run check` needs (runs before it)
// Exits 1 when something that stops the work is wrong. Plain Node, no dependencies: it has to run on an old Node.

import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { runChecks, formatResults } from './doctor-lib.mjs';

const args = process.argv.slice(2);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const quick = args.includes('--quick');
const forCheck = args.includes('--for') && args[args.indexOf('--for') + 1] === 'check';
const mode = quick ? 'quick' : forCheck ? 'check' : 'full';

const results = runChecks(root, mode);
const failed = results.some(r => r.status === 'fail');

if (args.includes('--json')) {
  console.log(JSON.stringify({ ready: !failed, mode, results }, null, 2));
} else {
  const text = formatResults(results, { quiet: quick || forCheck });
  if (text) console.log(text);
  else if (!quick && !forCheck) console.log('Everything looks fine.');
}
process.exit(failed ? 1 : 0);
