import { defineConfig } from 'vite';

// Served from the domain root with deep links (/ABCD), so asset URLs are absolute.
export default defineConfig({
  base: '/',
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
  },
});
