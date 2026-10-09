# plan of record — Riverside Fishing

A cozy 2D fishing game, mobile-first. You start next to a river, walk to
the dock, cast, reel in fish, carry them to the market, sell, and spend
the money on better rods and fishing skill.

Earlier games in this repo are git tags: `rts-v1` (medieval base-builder)
and `hex-v1` (hex conquest). They are not coming back in this branch.

Asked for by the user 2026-10-08: a river with lots of fish, a rod you
cast, ~20 fish types, rods that can only land certain tiers, a fishing
skill bought with money that changes catch probability, a market to sell
at, the upgrade system and an interface. Wanted 2D graphics.

## Rules (all numbers in `src/data.ts`)

- **20 fish in 5 tiers** (4 each): Common, Uncommon, Rare, Epic,
  Legendary. Each catch has a random weight (±40%) that scales its price.
- **5 rods**, bought in order: Twig (free, Common) → Bamboo $100
  (Uncommon) → Fiberglass $900 (Rare) → Carbon $5,000 (Epic) → Mythril
  $25,000 (Legendary). A rod lands fish up to its tier. 12% of bites are a
  fish one tier above the rod, which snaps the line ("you need a …").
- **More gear lines** (5 levels each, bought in order; the market only
  shows what you have and the next level): **Bait** (bites up to 60%
  sooner + a small rare-fish boost), **Clothes** (fish up to 55% bigger
  and pricier; changes the fisher's outfit), **Boots** (walk up to 110%
  faster; shown on the fisher).
- **Skills**, trained with money: **Fishing 1–20** (each level multiplies
  every tier's bite weight by (1 + 0.14·(level−1))^(tier−1)), **Reflexes
  0–10** (+0.06 s reel window each), **Haggling 0–10** (+5% sale price
  each), **Strength 0–10** (+4% chance each to land a fish one tier above
  your rod instead of snapping).
- **Rod Holders** (gear line): 1 → 4 lines ( / ,000 / ,000). Cast
  throws every idle line; each bites on its own; REEL! pulls in every biting
  line, tapping a bobber reels just that one; an early press scares one line.
- **Rare variants** on every catch: Giant 5% (2.5× weight/price), Golden 1.5%
  (×5), Shiny 0.3% (×12). Tracked per species in the journal (x/60).
- **Dev mode**: fish sell for 20×. Toggle in the journal or ?dev=1;
  a DEV ×20 badge shows while it's on.
- **Fishing:** Cast → wait 2–6.5 s for a bite → the bobber dips and you
  have ~0.9 s (more with skill) to reel. Too early scares the fish, too
  late it escapes.
- **Market:** tabs Sell / Gear / Skills.
- **Journal:** all 20 species, caught ones with count and best weight.
- Progress saves to the browser (localStorage) every 2 s.

Pacing (sim of a decent player buying the cheapest upgrade, saving for
rods): Bamboo ≈ 5.5 min, Fiberglass ≈ 35 min, Carbon ≈ 75 min, Mythril
≈ 99 min, every gear line and skill maxed ≈ 1 h 45.

## Look & input

Plain Canvas 2D, everything drawn in code (sky, hills, river with fish
shadows, dock, striped market stall, straw-hat fisher, 20 fish drawings).
DOM interface on top. Tap the river or the market to walk there; A/D or
arrows walk, Space casts / reels, E opens the market.

## Roadmap (agreed order, 2026-10-09)

1. ~~Multiple lines + rare variants~~ (done)
2. Town begins: building plots on the bank, Smokehouse, Apprentice helper +
   offline earnings
3. Living market: daily demand, orders, Ice House, Aquarium
4. Bigger world: Boathouse, Lake, Ocean, day/night, weather
5. Endgame: retire/prestige, achievements, journal rewards, Trophy Hall

## Not yet (ask before adding)

Bag capacity, more locations / rivers, bait, weather or time of day,
fishing minigame beyond timing (tension bar), achievements, sound.
