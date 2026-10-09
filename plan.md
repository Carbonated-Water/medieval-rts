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
- **Fishing skill 1–20**, bought at the market (cost grows ×1.4 per
  level). Each level multiplies every tier's bite weight by
  (1 + 0.14·(skill−1))^(tier−1), so rarer tiers grow fastest; bites also
  come sooner and the reel window widens.
- **Fishing:** Cast → wait 2–6.5 s for a bite → the bobber dips and you
  have ~0.9 s (more with skill) to reel. Too early scares the fish, too
  late it escapes.
- **Market:** sell one fish or everything; buy the next rod; train skill.
- **Journal:** all 20 species, caught ones with count and best weight.
- Progress saves to the browser (localStorage) every 2 s.

Pacing (bot-free sim of a decent player, see changelog): Bamboo ≈ 4 min,
Fiberglass ≈ 22 min, Carbon ≈ 55 min, Mythril ≈ 97 min, everything maxed
≈ 1 h 40.

## Look & input

Plain Canvas 2D, everything drawn in code (sky, hills, river with fish
shadows, dock, striped market stall, straw-hat fisher, 20 fish drawings).
DOM interface on top. Tap the river or the market to walk there; A/D or
arrows walk, Space casts / reels, E opens the market.

## Not yet (ask before adding)

Bag capacity, more locations / rivers, bait, weather or time of day,
fishing minigame beyond timing (tension bar), achievements, sound.
