# medieval-rts — plan of record

A **classic medieval base-builder RTS** (Age of Empires / Warcraft feel),
mobile-first. This is the only game in this repo.

Decided with the user 2026-09-25:

- **Genre:** classic base-builder — gather, build, train, (later) fight.
- **Theme:** medieval. Peasants, Town Hall, wood + gold.
- **Platform:** mobile-first web (360×740 is the test viewport),
  deployed to GitHub Pages at `/medieval-rts/` by GitHub Actions.
- **Stack:** Vite + TypeScript + Three.js, nothing else at runtime.

## Look (decided 2026-10-04)

**3D low-poly diorama seen from a fixed isometric-style camera**, rendered
with Three.js. Art is **KayKit** (CC0, Kay Lousberg), picked by the user
from a side-by-side against Quaternius: Medieval Hexagon pack for
buildings / trees / props (blue = player team colour, red / green / yellow
exist for future opponents) and the Adventurers pack for peasants (three
looks, weapons stripped, Barbarian keeps his axe). The Knight is reserved
for future soldiers.

Polish layer: soft shadows, ambient occlusion (GTAO), ACES filmic tone
mapping, light bloom, wood-chip / dust particles, buildings pop in when
finished. AO + bloom are off by default on touch devices for performance
(`?fx=1` / `?fx=0` to override).

The simulation stays a flat square grid; the 3D view only reads it.
Models are built from the raw packs by `scripts/build-models.mjs`
(`npm run models`), which keeps only used meshes and animations.

## Milestone 1 — economy only (current)

No combat, no enemies. Prove that gathering and building feel good on a phone.

- 48×48 tile map: grass, lakes, forests, 3 gold mines (one near start).
- Town Hall + 3 peasants at start. 100 wood, 150 gold.
- Peasants gather wood (trees deplete) and gold (mines deplete), carry
  10 per trip to the nearest drop-off, and loop automatically. When a
  tree runs out they move on to the next nearest one.
- Buildings: **House** (60 wood, +5 pop), **Lumber Mill** (80 wood, wood
  drop-off). Town Hall trains peasants (50 gold, 10 s, queue of 5).
- Population cap from Town Hall (5) + houses.

### Input model (one visible expectation at a time)

The bottom panel always says what the next tap does.

- Drag = pan, pinch / wheel = zoom.
- Tap peasant → select it. HUD buttons: "Idle peasants", "All peasants".
- With peasants selected: tap tree / mine = gather, construction site =
  help build, ground = move. ✕ deselects.
- Tap building → select it (Town Hall shows Train).
- Build: pick a building in the panel → a ghost appears at screen centre
  → tap the map to move it (green = ok, red = blocked) → ✓ Build here.

## Not yet (ask before adding)

Combat, enemy AI, military units / barracks, fog of war, more resources
(food, stone), unit collision, multi-select by drag, win condition,
save/load, sound, camera rotation, smoother (non-tile) shorelines.
