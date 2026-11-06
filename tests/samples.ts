import { existsSync, readFileSync } from 'node:fs';
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

/**
 * The template's default presets, as shipped in tokens/presets.json. A project edits that file (its own
 * presets, its own names), so the tests that pin these exact presets (their names, values and the CSS and
 * code written from them) run only while the file is still the default; everything about the file's shape,
 * its tokens and the pairing rules is tested for any project (tests/unit/presets-table.test.ts).
 */
export const TEMPLATE_DEFAULT_PRESETS = {
  separateFade: true,
  presets: {
    eyebrow: { rise: 'distance.20', move: { duration: 'duration.700', easing: 'easing.expressive-entrance' }, fade: { duration: 'duration.250', easing: 'easing.productive-entrance' }, status: 'experimental' },
    title: { rise: 'distance.20', move: { duration: 'duration.700', easing: 'easing.expressive-entrance' }, fade: { duration: 'duration.250', easing: 'easing.productive-entrance' }, status: 'experimental' },
    text: { rise: 'distance.20', move: { duration: 'duration.700', easing: 'easing.expressive-entrance' }, fade: { duration: 'duration.250', easing: 'easing.productive-entrance' }, status: 'experimental' },
    card: { rise: 'distance.20', scale: 'scale.95', move: { duration: 'duration.700', easing: 'easing.expressive-entrance' }, fade: { duration: 'duration.250', easing: 'easing.productive-entrance' }, status: 'experimental' },
    media: { rise: 'distance.20', scale: 'scale.95', move: { duration: 'duration.700', easing: 'easing.expressive-entrance' }, fade: { duration: 'duration.250', easing: 'easing.productive-entrance' }, status: 'experimental' },
    ui: { rise: 'distance.8', move: { duration: 'duration.150', easing: 'easing.productive-standard' }, fade: { duration: 'duration.100', easing: 'easing.productive-entrance' }, status: 'experimental' },
  },
};

// The same value whatever order the keys are written in.
const canonical = (v: unknown): string => JSON.stringify(v, (_k, val: unknown) =>
  val && typeof val === 'object' && !Array.isArray(val) ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b))) : val);

/** tokens/presets.json is still exactly the template's default. */
export const TEMPLATE_PRESETS: boolean = (() => {
  try {
    const file = JSON.parse(readFileSync(join(process.cwd(), 'tokens/presets.json'), 'utf8')) as unknown;
    return canonical(file) === canonical(TEMPLATE_DEFAULT_PRESETS);
  } catch {
    return false;
  }
})();

export const PRESETS_NEEDED = 'needs the template\'s default presets (tokens/presets.json is customised)';

/** Files that pin the template's default presets, left out entirely when tokens/presets.json is customised. */
export const PRESET_UNIT_FILES = ['tests/unit/entrance-presets.test.ts'];
export const PRESET_E2E_FILES = ['tests/e2e/presets.spec.ts'];
