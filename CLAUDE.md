# medieval-rts — Riverside Fishing

A cozy mobile-first 2D fishing game: catch 20 kinds of fish, sell them at
the market, buy better rods (each lands a higher tier) and train fishing
skill (shifts the odds toward rarer fish). Vite + TypeScript + Canvas 2D,
no runtime dependencies.

**Read `plan.md` (scope) and `changelog.md` (latest state) before
changing anything.** Earlier games are git tags `rts-v1` and `hex-v1`.

## Rules

- **One game, kept small.** Anything under "Not yet" in `plan.md` needs
  the user's go-ahead first.
- All fish, rods and balance numbers live in `src/data.ts`.
- `game.ts` is pure logic (no DOM) and takes an RNG, so it is testable;
  `scene.ts` draws the world, `fishart.ts` draws fish, `ui.ts` is the DOM
  interface, `main.ts` wires them up and saves.
- After balance changes, re-run a progression sim (see changelog) so the
  first rod still arrives in a few minutes.
- Append a short WHAT + WHY entry to `changelog.md` after each change.

## Commands

- `npm install`, then `npm run dev`: http://localhost:5175
- `npm test` (Vitest), `npm run typecheck`, `npm run build` (into `dist/`)
- Pushing to `main` deploys to https://carbonated-water.github.io/medieval-rts/
  via GitHub Actions (typecheck + tests + build). Never commit build output.

## Gotchas

- Save key in localStorage is `riverside-fishing-v1`; change it if the save
  format changes incompatibly. The journal's "Start over" button wipes it.
- `window.game` and `window.scene` are debug handles.
- The REEL! button pulses; automated clicks need `force: true`.
