import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    open: true,
    watch: {
      // Visual Studio keeps files under .vs/ open/locked, which crashes Vite's
      // watcher (EBUSY) if it tries to watch them.
      ignored: ['**/.vs/**'],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
