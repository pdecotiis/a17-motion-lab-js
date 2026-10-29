import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'lab',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@tokens': resolve(__dirname, 'tokens'),
      '@components': resolve(__dirname, 'components'),
      '@motion-maps': resolve(__dirname, 'motion-maps'),
      '@lib': resolve(__dirname, 'lab/lib'),
    },
  },
});
