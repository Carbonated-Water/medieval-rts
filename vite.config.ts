import { defineConfig } from 'vite';

// Production builds are served by GitHub Pages at /medieval-rts/.
// The deploy workflow (.github/workflows/deploy.yml) builds dist/ on push;
// build output is never committed.
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/medieval-rts/' : '/',
  build: {
    target: 'es2022',
    sourcemap: false,
    // Three.js alone is ~170 KB gzipped; one chunk is fine for this game.
    chunkSizeWarningLimit: 900,
  },
  server: {
    host: true,
    port: 5175,
    // .art/ holds downloaded asset packs; watching them crashes on Windows
    // (EBUSY while zips are written) and is pointless anyway.
    watch: { ignored: ['**/.art/**'] },
  },
}));
