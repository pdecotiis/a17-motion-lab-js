/**
 * `npm run typecheck`: tsc --noEmit over the project.
 * The unit tests in SAMPLE_UNIT_FILES import the template's sample components, which a project repo
 * deletes (see tests/samples.ts); without them they cannot compile, so they are left out of the check
 * when the samples are gone. With the samples present this is exactly `tsc --noEmit`.
 */
import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { SAMPLES_PRESENT, SAMPLE_UNIT_FILES } from '../tests/samples.js';

const args = ['tsc', '--noEmit'];
const temp = 'tsconfig.no-samples.json';
if (!SAMPLES_PRESENT) {
  writeFileSync(temp, JSON.stringify({ extends: './tsconfig.json', exclude: ['node_modules', 'dist', ...SAMPLE_UNIT_FILES] }, null, 2));
  args.push('-p', temp);
}
const result = spawnSync('npx', args, { stdio: 'inherit' });
rmSync(temp, { force: true });
process.exit(result.status ?? 1);
