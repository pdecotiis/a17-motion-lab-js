import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { SAMPLES_PRESENT, SAMPLE_UNIT_FILES } from './tests/samples';

export default defineConfig({
  resolve: {
    alias: {
      '@tokens': resolve(__dirname, 'tokens'),
      '@components': resolve(__dirname, 'components'),
      '@lib': resolve(__dirname, 'lab/lib'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
    // A project that removed the template's samples skips the tests that need them (tests/samples.ts).
    exclude: ['**/node_modules/**', ...(SAMPLES_PRESENT ? [] : SAMPLE_UNIT_FILES)],
  },
});
