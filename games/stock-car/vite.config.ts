import { defineConfig } from 'vite';

// Playables bundles are served from an arbitrary path, so all asset URLs must be relative.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
  },
});
