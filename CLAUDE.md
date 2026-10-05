# medieval-rts

A mobile-first medieval base-builder RTS (Age of Empires / Warcraft feel),
rendered as a 3D low-poly diorama. Vite + TypeScript + Three.js.

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
- The simulation (`game.ts`, `map.ts`, `path.ts`) is a flat square tile
  grid with no rendering imports. `src/view/` only reads it; one tile =
  one Three.js world unit, tile (tx, ty) spans x ∈ [tx, tx+1], z ∈ [ty, ty+1].
- Append a short WHAT + WHY entry to `changelog.md` after each
  meaningful change.

## Commands

- `npm install`, then `npm run dev`: dev server on http://localhost:5175
- `npm test` (Vitest, game logic), `npm run typecheck`, `npm run build`
  (into `dist/`, gitignored)
- `npm run models`: rebuild `public/models/` from the raw art packs in
  `.art/` (gitignored; see the header of `scripts/build-models.mjs` for
  where to get them). Only needed when adding/removing models or clips.
- Pushing to `main` deploys to https://carbonated-water.github.io/medieval-rts/
  via GitHub Actions (typecheck + tests + build). Never commit build output.

## Gotchas

- `?seed=N` pins the map; `?fx=0|1` forces ambient occlusion + bloom off/on
  (default: on for mouse devices, off for touch). `window.game` and
  `window.view` are debug handles.
- Vite must not watch `.art/` (configured in `vite.config.ts`): on Windows
  it crashes with EBUSY while packs are being unzipped.
- KayKit character files ship with every weapon attached; the model
  script keeps only the meshes listed per character.
