# medieval-rts — Hex Conquest

A mobile-first real-time hex conquest game: territorial.io meets Hex
Empire. Cities spawn armies, armies march across a hex map painting land,
numbers subtract in battle, last nation standing wins. 3D low-poly
KayKit art. Vite + TypeScript + Three.js.

**Read `plan.md` (scope) and `changelog.md` (latest state) before
changing anything.** The previous game (medieval base-builder RTS) is the
git tag `rts-v1`.

## Rules

- **One game, kept small.** Don't add a system until the current one is
  fun on a phone. Anything under "Not yet" in `plan.md` needs the user's
  go-ahead first.
- Ask clarifying questions before making design calls `plan.md` doesn't
  cover.
- Tunables live in `src/config.ts`; bot tuning constants at the top of
  `src/ai.ts`.
- Simulation (`hex.ts`, `world.ts`, `game.ts`) has no rendering imports.
  Bots (`ai.ts`) only use Game's public `move` order, like the player.
- Hexes are pointy-top, odd rows shifted right ("odd-r"); one hex is 1
  world unit across (`hex.ts`). KayKit models are 2 units, so everything
  KayKit is drawn at 0.5 scale.
- Balance changes: re-run a bot-only pacing check (see changelog) — the
  first version snowballed to a winner in 3 minutes.
- Append a short WHAT + WHY entry to `changelog.md` after each change.

## Commands

- `npm install`, then `npm run dev`: http://localhost:5175
- `npm test` (Vitest), `npm run typecheck`, `npm run build` (into `dist/`)
- `npm run models`: rebuild `public/models/` from the raw packs in
  `.art/` (gitignored; see `scripts/build-models.mjs` for sources). It
  also recolours KayKit's blue buildings to stone and its lime grass to
  a fresher green.
- Pushing to `main` deploys to https://carbonated-water.github.io/medieval-rts/
  via GitHub Actions (typecheck + tests + build). Never commit build output.

## Gotchas

- `?seed=N` pins the map; `?fx=0|1` forces ambient occlusion + bloom.
  `window.game`, `window.view`, `window.bots` are debug handles.
- Vite must not watch `.art/` (configured in `vite.config.ts`): on Windows
  it crashes with EBUSY while packs are being unzipped.
- KayKit character files ship with every weapon attached; the model
  script keeps only the meshes listed per character.
