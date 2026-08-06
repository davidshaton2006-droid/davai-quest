import { defineConfig } from 'vite';

// GitHub Pages serves project sites under /<repo-name>/, so the build needs
// that base path — the dev server stays at the root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/davai-quest/' : '/',
  server: { port: 5173 },
  build: { outDir: 'dist' }
}));
