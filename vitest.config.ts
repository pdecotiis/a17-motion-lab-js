import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@tokens': resolve(__dirname, 'tokens'),
      '@components': resolve(__dirname, 'components'),
      '@motion-maps': resolve(__dirname, 'motion-maps'),
      '@lib': resolve(__dirname, 'lab/lib'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
  },
});
