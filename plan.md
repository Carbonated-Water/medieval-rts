# plan of record — hex conquest

A **real-time hex conquest game**, a blend of **territorial.io** (fast,
real-time, many bots, painted borders, territory = strength) and **Hex
Empire** (hex map, cities, armies with a number marching between hexes,
capitals). Mobile-first web, 3D low-poly KayKit art.

The previous game (medieval base-builder RTS) is tagged **`rts-v1`** and
is not coming back in this branch.

Decided with the user 2026-10-07:

- **Real-time.** No turns.
- **Armies on the map** (Hex Empire), not a troop pool.
- **Cities spawn armies** on a timer.
- **Numbers subtract** in battle.
- **Many bots (8+).**
- **Win = last one standing.**
- **Look = 3D KayKit hexes** (Medieval Hexagon pack).
- Same repo and URL; the old game is tagged and deleted.

## Rules (milestone 1)

Numbers are starting defaults in `src/config.ts`.

- **Map:** ~40×30 pointy-top hexes. Grass (passable), forest (passable,
  slower), mountain (impassable), water (impassable). Generated from a
  seed; `?seed=N` pins it.
- **Nations:** the player + 8 bots. Each starts with a **capital** and the
  hexes around it. ~18 **neutral towns** with garrisons sit between them.
- **Spawning:** every few seconds each city adds troops to the army on
  its hex (creating one if empty): capitals more, towns fewer, plus a
  bonus that grows with the nation's territory. Armies cap at 99.
- **Movement:** an army walks a hex path to its destination and claims
  every hex it enters for its nation. The whole army moves, or half of
  it (the player picks).
- **Battle:** an army entering a hex with an enemy army fights at once:
  bigger number wins and keeps the difference. An army defending a city
  hex counts 1.5×. Own armies on the same hex merge.
- **Capture:** winning on a city hex takes the city. Taking a
  **capital eliminates** that nation: its cities and land go to the
  captor and its armies disband.
- **End:** you win when you're the last nation; you lose when your
  capital falls.

## Look

KayKit hex tiles (grass, water, coast, hills, mountains, forests) drawn
instanced. Ownership = territory tint on the hex + a flag in the nation
colour on each city + coloured army banners. KayKit only has 4 team
colours, so all cities use one stone palette and nations are told apart
by colour accents. Armies are small soldier figures with a number banner.

## Input

- Drag / WASD = pan, pinch / wheel = zoom.
- Tap own army (or an own city with a garrison) → select it; tap a hex →
  march there. Panel toggles **all / half**.
- Leaderboard shows every nation's colour, name and share of the map.

## Not yet (ask before adding)

Online multiplayer, boats / sea movement, roads / rivers as gameplay,
upgrades, diplomacy, difficulty levels, sound, save/load.
