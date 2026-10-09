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
- **More gear lines** (bought in order; the Tackle Shop only shows the next
  level): **Clothes** (fish up to 55% bigger and pricier; changes the
  fisher's outfit), **Boots** (walk up to 110% faster; shown on the fisher).
- **Bait is used up** (Bait Shop, 2026-10-09): one bait per line per cast.
  Ground Worm (free: worms poke out of holes in the dirt bank, max 3, one
  every 9 s, 2-4 per hole; walk past or tap to dig), Cricket $1, Shiner $5,
  Leech $25, Glow Lure $150, Golden Lure $400. Pricier bait adds to every
  tier step (like Fishing levels) and bites sooner, but is still a roll.
  Fish can bite up to one tier above your rod (at 0.4x weight, steady: not
  raised by levels or bait) and snap the line unless Strength holds. Out of
  bait = can't cast (autofisher stops). The pouch slot by CAST shows the
  bait in use and how many are left; tap it to choose. Each rod has a
  sweet-spot bait and a gamble one step above it.
- **Skills**, trained with money: **Fishing 1–25** (each level multiplies
  every tier's bite weight by (1 + 0.14·(level−1))^(tier−1)), **Reflexes
  0–10** (+0.06 s reel window each), **Haggling 0–10** (+5% sale price
  each), **Strength 0–10** (+4% chance each to land a fish one tier above
  your rod instead of snapping).
- **Rod Holders** (gear line): 1 → 4 lines ($500 / $6,000 / $35,000). Cast
  throws every idle line; each bites on its own; REEL! pulls in every biting
  line, tapping a bobber reels just that one; an early press scares one line.
- **Rare variants** on every catch: Giant 5% (2.5× weight/price), Golden 1.5%
  (×5), Shiny 0.3% (×12). Tracked per species in the journal (x/60).
- **Autofisher** (gear line, Tackle Shop): I $750 / II $5,000 / III $22,000
  / IV $60,000. While you stand on the dock it recasts empty lines and reels
  bites after a random reaction time (I: 0.45–1.2 s, so it misses some; IV:
  0.25–0.55 s). You can still reel by hand.
- **Achievements**: 20, each paying a one-time cash reward (≈ $50k total)
  collected in the 🏆 panel; a toast announces each one.
- **Dev mode**: fish sell for 20×. Toggle in ⚙ Settings or ?dev=1;
  a DEV ×20 badge shows while it's on.
- **Fishing:** Cast → wait 2–6.5 s for a bite → the bobber dips and you
  have ~0.9 s (more with skill) to reel. Too early scares the fish, too
  late it escapes.
- **One place, one job** (guiding principle; no panel ever scrolls):
  - **Fish Market** (stall left of the dock): sells fish only. One chip per
    species (×count, total price); tap a chip to sell that kind, or Sell all.
  - **Tackle Shop** (stall right of the dock): sells gear only. One row per
    gear line showing just the next upgrade.
  - **Fishing School** (log cabin on the grass below the path, between
    the market and the dock): the four skills, one row each.
  - **Achievements** (🏆 in the top bar, red count when rewards wait): 4×5
    trophy grid; tap a glowing one or "Collect all".
  - **Journal** (📖): the 20 species as a 4×5 grid, one row per tier, with
    variant badges.
  - **Settings** (⚙): lifetime earnings, dev mode, start over.
- Progress saves to the browser (localStorage) every 2 s.

Pacing (sim of a decent player buying the cheapest upgrade, saving for
rods): Bamboo ≈ 5.5 min, Fiberglass ≈ 35 min, Carbon ≈ 75 min, Mythril
≈ 99 min, every gear line and skill maxed ≈ 1 h 45.

## Look & input

Pixel art rendered with PixiJS at low resolution and scaled up crisp:
Kenney Pixel Platformer tiles (CC0) for the sky, clouds, forest backdrop,
water and bank; code-drawn pixel sprites in the same palette for the
straw-hat fisher (walk / cast poses, outfit and boots by gear), all 20 fish
(+ Golden / Shiny / silhouette), the red Fish Market, blue Tackle Shop,
log-cabin School, dock, bobbers and "!" alerts. The HUD uses the same pixel
fish.

UI (since 2026-10-09): wood & parchment pixel style (see CLAUDE.md). Top
bar: coin plaque + icon buttons (journal, trophies, log, menu). Panels use
Kenney's riveted wood frame with parchment rows and item slots; levels show
as pips. Catches: +$ floats up from the fisherman, a pickup log bottom-left
(max 3 lines, repeats merge "x3"), and a banner only for new fish, rare
variants, achievements and purchases. The log panel keeps the last 8.
DOM interface on top. Tap the river or a shop to walk there; A/D or
arrows walk, Space casts / reels, E opens the building you stand at.

## The Fishing Company (late game, phases 1 and 2 done 2026-10-09)

- **Teaser** (before $25k lifetime earnings): a boarded-up harbor office
  ("?" sign, padlock) on the far bank with a pier; a dark ship silhouette
  drifts along the far bank (20 s every 45 s). Tapping it shows only
  "Someone is watching you..." and a progress bar. Letters from "H." at
  $5k / $10k / $20k (banner + log; full text in the harbor panel).
- **Reveal** at $25k: last letter, banner "The old harbor is for sale", the
  office turns to wood with a FOR SALE sign. Panel lists boats, crew, nets
  and two locked "???" rows ("something with claws / with a sword").
- **Buy for $100,000**: fade, then the view zooms out: river 46% of the
  screen (sky and foreground squeezed), one pixel scale smaller on big
  screens. Office becomes FISH CO.; tapping it opens Fishing Co. from
  anywhere (it's across the river).
- **The fleet** (phase 3, 2026-10-09). Boats: Net Boat $20k, Lobster Boat
  $60k, Longliner $150k; any mix, up to the harbor's berths (3, buy up to
  8); each extra boat of a kind +50%. Every boat has six upgrade tracks,
  levels 0-5 (cost: base x share x 2.5^level): **Hull** (+15% hold, +1 crew
  slot, -18% storms), **Engine** (-8% trip, unlocks grounds), **Gear** (6
  named levels per kind, e.g. Hand Net to Megatrawl), **Sonar** (+0.2 rarity
  step), **Ice Hold** (+8% value), **Captain** (sails again by himself, +5%
  catch, -6% storms, takes 8% wages). Crew: 2 + hull slots, +15% catch and
  -4% trip each. Upgrades show on the boat (longer hull, dish, ice box,
  stack, captain).
- **Fishing grounds** per boat: Coast (1:00) / Reef (1:50, Engine 1) / Open
  Sea (3:00, Engine 2 Hull 1) / Arctic (4:30, Engine 3 Hull 2 Sonar 1) /
  The Deep (6:40, Engine 4 Hull 3 Sonar 2): farther = rarer, bigger, more
  storms. **Events** on return: storm (lose half), lucky school (x2, 8%),
  trophy sighting (Open Sea+, 2%).
- **Harbor**: berths; Harbor Master $200k (sells hauls as they come in, 5%
  fee; brings a crane); Fish Buyer $80k (sells the pier crate every minute,
  5%); Bait Supplier $120k (tops fishermen up 20 at a time, +25%);
  Warehouse (earnings while closed: 1h, 2h $100k, 4h $300k, 8h $900k).
- **Ladder** (simulated, prompt resends): starter Net Boat on the Coast
  ~$550/min; each tier of upgrades pays back in ~65-130 min; maxed on The
  Deep: Net $61k, Lobster $88k, Longliner $158k per minute.
- **Wide pier + hired fishermen** (opens with the first boat): the dock
  becomes a T-pier. Hire up to 4 (Ada, Bo, Cy, Dee: $8k/16k/28k/45k). Each
  has their own Rod (bought like yours) and Fishing level (to 25, $60 x
  1.35^level), and an assigned bait drawn from YOUR pouch, one per cast; out
  of it they stop (red "!" sign, banner). Slow hands at low levels miss
  bites (reaction max 1.2 s minus 0.02 per level vs a 0.9 s window); they
  rest 2.5 s between catches. Catches go to the crate on the pier (sell
  from The Pier panel). Your role: keep them in bait and train them up.
  A maxed fisherman on Glow Lures ~= $8.5k/min (Golden is slightly worse
  for them: the bait choice still matters).

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
