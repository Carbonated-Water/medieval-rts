# medieval-rts

A mobile-first isometric medieval base-builder RTS (Age of Empires /
Warcraft feel). Vite + TypeScript + Pixi 8, nothing else.

**Read `plan.md` (scope) and `changelog.md` (latest state) before
changing anything.**

## Rules

- **One game, kept small.** This repo was split out of a larger repo
  that drowned in half-finished ideas. Don't add a system until the
  current one is fun on a phone. Anything listed under "Not yet" in
  `plan.md` needs the user's go-ahead first.
- Ask clarifying questions before making design calls `plan.md`
  doesn't cover.
- Tunables live in `src/config.ts`.
- The simulation is a square tile grid; only rendering and tap-picking
  are isometric (`src/iso.ts`).
- Append a short WHAT + WHY entry to `changelog.md` after each
  meaningful change.

## Commands

- `npm install`, then `npm run dev`: dev server on http://localhost:5175
- `npm run typecheck`, `npm run build`: production build into `dist/`
  (gitignored)
- Pushing to `main` deploys to https://armandoxh.github.io/medieval-rts/
  via GitHub Actions. Never commit build output.

## Gotchas

- Startup is wrapped in an async `boot()` in `main.ts`. Top-level await
  in the entry chunk deadlocks against Pixi's lazily loaded renderer
  chunks in production builds, which gives a blank page.
- `?seed=N` in the URL pins the map. `window.game` and `window.cam` are
  debug handles.
