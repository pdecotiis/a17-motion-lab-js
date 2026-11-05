import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The template ships sample content (the `card` and `side-panel` components and the `home` page) so
 * its own tests have something to run the lab's features on. A project repo holds client content only
 * and deletes the samples. Tests that need them then skip themselves, so a project's `npm run check`
 * tests the project's own components and pages, and the template's feature tests stay in the template.
 *
 * To add a test that uses a sample: if the whole file needs it, list it below; if only some tests do,
 * start those with `test.skip(!SAMPLES_PRESENT, SAMPLES_NEEDED)` (or `it.skipIf` / `describe.skipIf`).
 * `tests/unit/samples.test.ts` fails for a file that uses a sample and does neither.
 */
export const SAMPLE_FILES = [
  'components/card/motion.ts',
  'components/side-panel/motion.ts',
  'pages/home/page.json',
];

/** Every sample is there. Deleting any one of them counts as removing the samples. */
export const SAMPLES_PRESENT = SAMPLE_FILES.every(f => existsSync(join(process.cwd(), f)));

export const SAMPLES_NEEDED = 'needs the template\'s sample content (card, side-panel, home)';

/** Unit test files that cannot even load without the samples (they import them). */
export const SAMPLE_UNIT_FILES = [
  'tests/unit/card.test.ts',
  'tests/unit/export-code.test.ts',
  'tests/unit/interaction-exports.test.ts',
  'tests/unit/interaction-summary.test.ts',
  'tests/unit/interaction.test.ts',
  'tests/unit/side-panel.test.ts',
  'tests/unit/spec.test.ts',
];

/** E2E spec files that run on the samples throughout. */
export const SAMPLE_E2E_FILES = [
  'tests/e2e/compare-view.spec.ts',
  'tests/e2e/component-view.spec.ts',
  'tests/e2e/engine-tokens.spec.ts',
  'tests/e2e/interactions.spec.ts',
  'tests/e2e/page-scroll.spec.ts',
  'tests/e2e/page-versions.spec.ts',
  'tests/e2e/page-view.spec.ts',
  'tests/e2e/side-panel.spec.ts',
];
