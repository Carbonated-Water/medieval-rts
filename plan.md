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

## Milestone 1 — economy (done)

Gather wood + gold, build houses / lumber mills, train peasants, on a
phone. Still the base of everything below.

## Milestone 2 — combat + enemy AI (current, decided 2026-10-04)

- **64×64 map, two towns:** player (blue) bottom-left, AI (red) top-right
  as seen by the camera. Each starts with a Town Hall, 3 peasants, a
  nearby forest and gold mine; 3 contested mines in the middle.
- **The AI plays by the player's rules** (`src/ai.ts`): same costs, build
  times and orders. It gathers (~55% wood), builds houses as pop runs
  short, a lumber mill, then a barracks, trains peasants to 14 and a
  2:1 swordsman:archer army.
- **Passive until provoked:** nobody picks fights until the player damages
  anything of the AI's (`game.provoked`). Before that the AI's army
  (cap 8) stands guard in front of its hall.
- **Then full war:** immediate counter-attack, defend anything within 12
  tiles of its hall, and attack waves at the player's hall that grow
  (5, 7, 9 … 14 soldiers). Army cap rises to 30; it adds up to 3
  barracks when rich.
- **Barracks** (120 wood, 25 s, 350 hp) trains **Swordsman** (80 hp, 10
  dmg melee, 60 gold + 20 wood) and **Archer** (35 hp, 7 dmg at 5 tiles,
  30 gold + 40 wood). Arrows are real projectiles. Peasants: 25 hp, only
  hit back at someone right next to them. All numbers in `config.ts`.
- **Win / lose:** destroy the enemy Town Hall / lose yours.

### Input model (one visible expectation at a time)

The bottom panel always says what the next tap does.

- Drag = pan, pinch / wheel = zoom. **Box** toggle: drag draws a
  selection box instead (pinch still zooms).
- HUD buttons with nothing selected: Idle peasants, Peasants, Army, Box.
- Tap own unit → select it. Tap own finished building → select it (train
  there), unless a selected peasant carries something it accepts (then
  drop off).
- With units selected: tap enemy unit / building = attack; tree / mine =
  gather (peasants); construction site = help build; ground = move.
- Tap an enemy with nothing selected → info panel.
- Build: pick a building in the panel → a ghost appears at screen centre
  → tap the map to move it (green = ok, red = blocked) → ✓ Build here.

## Not yet (ask before adding)

Fog of war, more resources (food, stone), unit collision / formations,
upgrades / tech, towers & walls, multiple AI opponents or difficulty
levels, save/load, sound, camera rotation, minimap, smoother (non-tile)
shorelines.