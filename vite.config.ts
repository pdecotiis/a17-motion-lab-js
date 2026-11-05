import { defineConfig } from 'vite';
import { resolve } from 'path';
import { scaleApplyPlugin } from './scripts/scale-plugin';
import { pageVersionPlugin } from './scripts/page-version-plugin';

export default defineConfig({
  root: 'lab',
  base: './',
  plugins: [scaleApplyPlugin(__dirname), pageVersionPlugin(__dirname)],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@tokens': resolve(__dirname, 'tokens'),
      '@components': resolve(__dirname, 'components'),
      '@lib': resolve(__dirname, 'lab/lib'),
    },
  },
});
