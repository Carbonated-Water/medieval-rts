import { defineConfig } from 'vite';

// Production builds are served by GitHub Pages at /medieval-rts/.
// The deploy workflow (.github/workflows/deploy.yml) builds dist/ on push;
// build output is never committed.
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/medieval-rts/' : '/',
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  server: {
    host: true,
    port: 5175,
  },
}));
