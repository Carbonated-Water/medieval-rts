# medieval-rts changelog

One entry per change: WHAT + WHY.

---

2026-10-09  Fix: dead clicks in busy menus
  WHAT: Panels redraw (innerHTML) whenever money, timers or the crate change,
        which with a running company is almost every frame; a click whose
        button was replaced between press and release never fired (~1 in 5
        taps on The Pier). Taps now act on pointerup, matched by the button's
        data-act rather than the element; redraws pause while pressed; sliding
        off cancels; release / cancel / blur on the window always reset.
        Keyboard activation still uses click. Measured 15-16/20 -> 20/20
        (mouse) and 20/20 touch taps with 30-400 ms holds; one tap buys once.
  WHY:  User: 'a lot of dead clicks on some of these menus'.

---

2026-10-09  Fix: Sell boat did nothing for boats at sea
  WHAT: Selling was only allowed at the pier, and a boat with a Captain sails
        again the moment it returns, so its button stayed disabled. Boats can
        now be sold any time; at sea, the confirm says that trip's catch is
        lost. 70 tests.
  WHY:  User: 'sell boat button not work'. Reproduced in Edge first.

---

2026-10-09  Bait Shop: +100
  WHAT: Every bait row gets a +100 button next to +1 / +10 (slimmer
        buttons in the Bait Shop so three fit a 360 px phone).
  WHY:  User asked for a +100 Golden Lure button (stocking fishermen).

---

2026-10-09  Big lures, big fish (why the supplier bought cheap bait)
  WHAT: Bait gained a size bonus on what it catches (Shiner x1.05, Leech
        x1.15, Glow x1.35, Golden x1.7; weight and price), applied to your
        catches and the fishermen's; the Manager's estimate includes it.
  WHY:  User: the Bait Supplier was buying 'shit tier' bait. It buys what
        the Manager assigns, and the Manager was right by the old numbers:
        at high Fishing levels a pricier lure barely moved the odds, so
        even a maxed Mythril fisherman earned less on Golden (~5.6k/min)
        than on Shiners (~6.7k/min, supplier prices). Now each lure tier
        pays once rod and level can use it: Mythril fishermen go Golden
        (~13.6k/min maxed); the Manager's pick matched the simulated best
        bait in all 8 checked profiles. Player sim: Bamboo still ~5 min.

---

2026-10-09  The pier: 24 fishermen, sections, Manager, Fish Seller
  WHAT: Pier sections (4 spots each, up to 24; decks of 8-12 by screen
        width, stepping toward the bank). Pier staff moved off the Harbor
        into a Pier Staff panel: Manager (best bait per fisherman via
        Game.bestBait, budgeted training / rods, 3% of crate), Bait
        Supplier, Fish Seller (was Fish Buyer; now also sells your bag at
        20 fish). Crate moved off the pier onto the bank. The Pier panel is
        a crate row + a tile per spot (+ to hire) + Staff; Fishing Co. no
        longer shows the pier. Fishermen float "+$" only for Legendaries and
        rare variants. Old saves: Fish Buyer becomes Fish Seller. 68 tests.
  WHY:  User: automate restocking bait for the fishermen, expand the pier
        to 24, hire a manager and someone to auto-sell fish, move the crate
        off the pier, keep pier details out of the boat menu.

---

2026-10-09  Sell a boat
  WHAT: Boat panel gets a red Sell boat row (confirm first): refunds half of
        the boat's base price, upgrades and crew (BOAT_RESALE), sells any haul
        on board, frees the berth; not while at sea. 64 tests.
  WHY:  User: with the harbor full (8 berths) there was no way to swap a
        boat for a different kind.

---

2026-10-09  The fleet (company phase 3): upgrade trees, grounds, automation, harbor growth
  WHAT: Boats now have six upgrade tracks (Hull, Engine, Gear, Sonar, Ice
        Hold, Captain, 5 levels each), crew slots from the hull, a fishing
        ground per trip (Coast, Reef, Open Sea, Arctic, The Deep: unlocked
        by engine / hull / sonar), trip events (storm, lucky school, trophy
        sighting), any number of each kind up to the berths (3 to 8).
        Harbor: berths, Harbor Master (auto-sell, crane), Fish Buyer
        (auto-sells crate), Bait Supplier (restocks fishermen), Warehouse
        (offline earnings 1-8 h, "While you were away"). Automation costs
        upkeep (captain wages 8%, fees 5%, supplier +25%). Boats draw their
        upgrades. UI: fleet grid (+ for empty berths, SEND ALL / SELL ALL),
        Shipyard, Harbor and a boat panel with grounds bar, track grid and
        detail strip. Fleet news (events, auto-sales) drives banners / log.
        Banners no longer block taps; bobber taps win over the harbor.
        Old boats keep their gear and crew. 63 tests.
  WHY:  User: the boat phase was underwhelming (three upgrades, then
        nothing) and a $2,500 haul is "like 1 fish for me"; wanted upgrades
        for each boat, automated shipping, and a vast, creative boat game as
        the next step. Chose all four pillars, idle with upkeep, and risk.
  Balance: upgrade costs per boat use an upgrade base (20k / 30k / 45k), not
        the boat's price, so every boat's steps pay back in ~1-2 hours;
        maxed boats on The Deep make $61k / $88k / $158k per minute.

---

2026-10-09  The Fishing Company, phase 2: hired fishermen, wide pier, more boats
  WHAT: data: SHELLFISH, BILLFISH, BOATS (net / lobster / sword with their
        own gear, trip and catch), HANDS tables. game: typed boats (one of
        each), catch maths parameterised by rod tier / level so hired hands
        share it; Hand (rod, skill, bait, line) fishing on their own from
        your pouch into a crate; hire / rod / train / bait / sell crate.
        pixelart: crab and lobster sprites, billed fish, three boat looks.
        scene: T-pier once you own a boat, four fishermen with their own
        lines (slots 4-7 share the bobber / splash / leaping-fish code), crate
        and "needs bait" sign; fixed a return-in-loop that would have frozen
        splashes. ui: Fishing Co. overview, Boat, The Pier and Fisherman
        panels (close goes back to the overview). 57 tests.
  WHY:  User: on unlocking the boat, a wider pier; hire fishermen whose
        upkeep is your job (golden bait, upgrades "so they can be like me");
        plus lobster and swordfish boats, all in phase 2.
  Balance (simulated): a rookie only profits on worms; each rod / training
        step unlocks the next bait; maxed ~$8.5k/min on Glow (Golden a bit
        worse). Training cost set to $60 x 1.35^level (~$230k each to 25).

---

2026-10-09  The Fishing Company, phase 1: teaser, reveal, boats
  WHAT: data: COMPANY_UNLOCK_EARNED 25k, COMPANY_PRICE 100k, LETTERS (5k,
        10k, 20k, reveal at 25k), SEA_FISH (6), boat / crew / net tables.
        game: company, letters, boats (net, crew, trip, haul) with
        takeLetters, buyCompany, buyBoat, hireCrew, upgradeNet, sendBoat,
        collectHaul, trips advanced in tick; saves past 25k skip to the last
        letter. pixelart: harbor office (boarded / for sale / FISH CO.),
        boat with visible crew (and a silhouette for the teaser ship), icons
        lock, letter, boat, crew, net; '?' and '.' glyphs. scene: far-bank
        harbor + pier, drifting mystery ship, boats sailing out and back
        with a "!" when a haul is in, zoom-out layout (wider river, smaller
        pixels on big screens) behind a fade when the company is bought.
        ui: Old Harbor / Fishing Co. panel. 50 tests.
  WHY:  User: after $25k earnings, unlock a fishing company bought for
        $100k; the map zooms out and the river widens; boats, crew, nets
        (lobster and swordfish later); tease it creatively without saying
        what it is. Chose: mystery harbor + letters, timed trips, lifetime
        earnings, phased build.
  Balance: sea fish x3 from the first draft so a fully kitted boat (~$223k
        invested) is worth ~$2.9k/min, about doubling late-game income.

---

2026-10-09  Fix: Start over didn't wipe the game
  WHAT: Start over removed the save and reloaded, but the pagehide autosave
        (any action had set dirty) wrote the old game straight back. A
        `wiping` flag now blocks every save once Start over is confirmed.
  WHY:  User: "start over button doesn't work". Reproduced in Edge first.

---

2026-10-09  Bait becomes a budget: Bait Shop, worms, pouch; Fishing to 25
  WHAT: The permanent Bait gear line is gone. Bait is now consumable (one
        per line per cast; casting with none is impossible, the autofisher
        stops). New Bait Shop shack below the path (sells x1 / x10, shows the
        odds each bait gives with your rod and level), Bait Pouch panel (choose
        bait, see next cast's odds and snap chance) and a pouch slot beside
        CAST with the count. Ground worms appear in holes in the dirt bank
        (walk past or tap to dig). Bite rules: fish up to one tier above the
        rod can bite at a steady 0.4x weight (snap unless Strength); bait's
        lure adds to the per-tier step like Fishing levels. Fishing max 25.
        Old saves: bait upgrade level becomes 25 of the matching bait.
  WHY:  User: early game was linear; wanted a store with bait tiers, an
        inventory of what's left, free ground worms to fall back on, and a
        real gamble ("$100 bait might catch a $2 fish or a $1000 one,
        depending on fishing level"); fishing level up to 25.
  Balance: EV table per rod x level x bait: each rod has a sweet-spot bait
        and a gamble one step up (e.g. Golden Lure loses money on Carbon at
        Fishing 1, wins at 25; on Mythril it's 26% Legendary at Fishing 1).
        Snap chance no longer rises with level. Fishing cost growth kept at
        1.4. Sim (best-EV bait, dig worms when broke): Bamboo 4.2 min,
        Mythril 42 min, all maxed 48.5 min. 44 tests.

---

2026-10-09  UI revamp: wood & parchment pixel style
  WHAT: All menus and feedback redone. New src/ui.css (index.html's inline
        CSS removed): Kenney Pixel UI Pack wood frame (CC0) for panels, flat
        2px bevels for rows / slots / buttons, Kenney Pixel + Mini fonts
        (CC0), all in src/assets/ui with licences. pixelart.ts gained
        pixelIcon(): coin, book, trophy, bell, menu, rod, holder, robot,
        worm, shirt, boot, hook, bolt, bag, fist, close, check, star, fish,
        replacing every emoji (achievement data no longer has icons; the UI
        maps them by stat). Shops use slot rows with level pips and coin
        price buttons; market / journal / trophies are slot grids (trophies
        have a detail strip, tap to inspect or collect). notify.ts rewritten:
        float (+$ rising from the fisherman, Scene.fisherScreen), a 3-line
        pickup log that merges repeats, one banner at a time for firsts,
        rare variants, achievements, purchases. Gear blurbs shortened to
        game labels ("Speed +75%"). Every panel still fits 360x640.
  WHY:  User: menus and the mobile notifications "look very AI" (cards,
        emojis, clutter); asked to revamp them the way other games do.
        Mocked three directions (wood, dark minimal, arcade) over the real
        game; user chose wood & parchment + floating +$ and a small log.

---

2026-10-09  Deployed
  WHAT: Pushed 83775dc..10a67a5 (gear/skills/dev, lines + variants, shop
        split, school/autofisher/achievements, notifications, pixel art)
        to main; Pages deploy passed and the live site was checked.
  WHY:  User: "push to prod".

---

2026-10-09  Pixel art on PixiJS (replaces hand-drawn Canvas 2D)
  WHAT: scene.ts rewritten on PixiJS 8: the world renders at screen ÷ 2–4
        (195×422 on a phone) and is upscaled nearest-neighbour. Kenney Pixel
        Platformer (CC0) tiles/backdrops for sky, clouds, forest, water and
        bank (src/assets/kenney + License.txt). New pixelart.ts draws the
        rest as pixel sprites in Kenney's palette with its dark outline: the
        fisherman (idle / walk / cast, outfit + boots by gear), 20 fish with
        species patterns (+ Golden, Shiny, silhouette), market / tackle
        stalls with a 3×5 pixel-font sign, the school cabin, dock, bobbers,
        "!" alerts. HUD icons use the same pixel fish; fishart.ts removed.
        Scene API unchanged (L is now a getter in CSS px). Production
        build checked in vite preview.
  WHY:  User: "it's 2D but it's ugly 2D", asked for a different 2D library.
        Chose pixel art + PixiJS. Only CC0 art: CraftPix's fishing pack was
        rejected because its licence forbids redistribution in a public repo.

---

2026-10-09  Facebook-style notifications
  WHAT: New src/notify.ts. Every event is its own card (fish picture,
        name, tier, weight, $value; achievements with their icon) in a
        stack under the top bar: newest on top, up to 4, each ~5 s (rare /
        new fish 7 s), slide in, fade out, tap to dismiss. 🔔 in the top
        bar with a red unread count opens the last 8 events (fits without
        scrolling). Misses only show while fishing by hand and aren't kept.
        Cards sit under open panels so they never cover a ✕. The single
        toast is gone.
  WHY:  User (everything maxed, 4 lines): catches came too fast, one toast
        replaced the next before the fish and value could be read.
---

2026-10-09  Fishing School, Autofisher, achievements
  WHAT: Skills moved out of the top bar into a Fishing School: a log cabin
        on the grass between the market and the dock (walk there, it opens).
        New gear line Autofisher (I–IV, $750 → $60,000) in the Tackle Shop:
        on the dock it recasts and reels by itself with a reaction time
        that shortens per level (Game.autoFish, called each frame on the
        dock). 20 achievements with cash rewards (data.ts ACHIEVEMENTS,
        Game.stat / claimable / claim, saved as `claimed`): toast on unlock,
        🏆 top-bar button with a red count, 4×5 trophy grid panel, Collect
        all. Tackle rows trimmed to one line ("2/5" level instead of
        "(have: …)") so six rows fit. 37 tests.
  WHY:  User: the skill upgrades' location wasn't intuitive; asked for an
        achievement system and an autofisher upgrade path. Chose a School
        building, full auto from level 1, and cash rewards.
  Pacing: sim with rewards: everything maxed ≈ 47 min (was ≈ 58); a player
        who goes fully idle after Autofisher I keeps pace with a perfect
        active one. All panels fit 360×640 without scrolling.

---

2026-10-09  One place, one job: Tackle Shop split from the Fish Market
  WHAT: The market's Sell / Gear / Skills tabs are gone. Fish Market (left)
        only sells fish: a 4-wide grid with one chip per species (×count,
        total), tap to sell that kind (Game.sellSpecies) or Sell all. New
        Tackle Shop stall (right, blue awning, rods + tackle box) only sells
        gear: one row per line, next upgrade only. Training opens from the
        "💪 Fishing" badge anywhere. Journal is just the collection (4×5,
        one row per tier); dev mode + start over moved to a new ⚙ Settings
        panel. Dock moved to the middle. E opens the shop you stand at, T
        trains. Fixed plan.md holder prices mangled by the shell.
  WHY:  User: the gear tab was overloaded and needed scrolling; wanted a
        separate tackle shop and a market that only buys fish, and made
        "separation of responsibilities" + "simplicity" guiding principles
        (now in CLAUDE.md). Checked: every panel fits without scrolling at
        390×844 and 360×640, even with all 20 species in the bag.

---

2026-10-09  Multiple lines (rod holders) + rare variants
  WHAT: Game.line → Game.lines[]. New gear line "Rod Holders" (1 → 4
        lines: $500 / $6,000 / $35,000). Cast throws every line out of the
        water (staggered); each line bites on its own timer; the big
        button reels every biting line, tapping a bobber reels that one;
        reeling with nothing biting scares only the line closest to biting.
        Scene draws holder rods on the dock, a bobber per line, "!" over
        each bite. Rare variants rolled on every catch: Giant 5% (2.5×
        weight/price), Golden 1.5% (×5), Shiny 0.3% (×12) — recoloured,
        sparkling fish, tags in the bag, badges + "variants found x/60" in
        the journal, special toasts. Old saves get 1 line.
  WHY:  User picked Stage 1 of the roadmap: multiple lines + rare variants
        (makes waiting into juggling; adds rare excitement and a long-tail
        collection goal).
  Pacing: perfect-juggling sim maxes everything in ~58 min (was 1h45 with
        one line) and finds ~30/60 variant types in that hour. Real players
        juggle worse; revisit prices when buildings add new sinks. 29 tests.

---

2026-10-09  Gear lines, more skills, dev mode, next-only upgrades
  WHAT: Market tabs are now Sell / Gear / Skills. Gear: Rod, plus new
        Bait (faster bites, slight rare boost), Clothes (bigger, pricier
        fish; shown on the fisher) and Boots (faster walking; shown on
        the fisher), 5 levels each, bought in order. Every gear line shows
        only the equipped item and the next one (later rods etc. hidden).
        Skills: Fishing (odds only now), Reflexes (reel window), Haggling
        (sale price), Strength (chance to land a too-strong fish). Dev
        mode toggle in the journal / ?dev=1: fish sell for 20×. Old saves
        load with the new fields at their defaults.
  WHY:  User asked: show only the n+1 rod upgrade; add fishing clothes,
        boots and bait upgrades plus more skill upgrades; add a dev mode
        with 20× money per fish.
  Pacing: re-simulated (cheapest-upgrade buyer saving for rods): Bamboo
        ≈ 5.5 min, everything maxed ≈ 1h45. 22 tests.

---

2026-10-08  Rebuilt as Riverside Fishing (2D)
  WHAT: Hex Conquest is tagged hex-v1 and removed, along with Three.js,
        the KayKit models and the model pipeline (no runtime deps now).
        New: data.ts (20 fish in 5 tiers, 5 rods, skill cost curve and
        odds tuning), game.ts (cast → wait → bite → reel line state,
        weighted catch rolls with skill bonus, too-strong fish snap the
        line, weight-scaled prices, bag, journal, sell / buy rod / train
        skill, save data), fishart.ts (all fish drawn in code), scene.ts
        (Canvas 2D riverbank: sky, hills, river with fish shadows, dock,
        market stall, walking fisher, cast arc, bobber, splashes, caught
        fish leaping out), ui.ts (top bar, context action button, market
        with Sell / Rods / Skill tabs and odds preview, journal),
        main.ts (input, toasts, localStorage autosave).
  WHY:  User: "scratch this whole game" — wanted a fishing game: river,
        rod, ~20 fish, rod tiers, a fishing skill bought with money that
        changes catch odds, a market, upgrades and an interface; and 2D.
  Pacing: simulated a decent player (perfect reels, sells every 8 fish,
        buys the next rod when affordable). Bamboo was 6 min; lowered to
        $100 and cheaper early skill → Bamboo ≈ 4 min, all maxed ≈ 1h40.

---

2026-10-08  Rebuilt as Hex Conquest (territorial.io × Hex Empire)
  WHAT: The medieval base-builder (tagged rts-v1) is replaced. New sim:
        hex.ts (odd-r hex maths + A*), world.ts (seeded island map:
        grass / forest / mountain / water, largest region only, fair
        inland capitals, neutral towns), game.ts (9 nations, cities that
        spawn troops into the army on their hex, armies that march and
        paint land, numbers-subtract battles with a 1.5× city defence,
        capture, capital = elimination, last one standing). ai.ts: bots
        with personalities (aggressive / cautious / expansionist) that
        defend, grab towns, prey on weaker targets, paint land and gang
        up on cities no single army can take. View: instanced KayKit hex
        tiles / forests / mountains, territory tint + painted borders,
        stone cities with nation flags, knight armies with number
        banners, path dots, battle particles. HUD: troops / land / nations
        pills, leaderboard, army panel with Send all / Send half, toasts,
        victory / defeat. Input simplified (box-select removed).
  WHY:  User: "scrap this whole game and make a blend of territorial.io
        and hex empire". Chose real-time, armies on the map, cities spawn
        armies, numbers subtract, 8+ bots, last one standing, 3D KayKit.
  Balance: a bot-only check (player idle) first snowballed to a winner in
        ~3 min. Fixes: land bonus only for capitals and capped (+6),
        conquered land goes blank (cities still transfer), capital
        garrisons grow over time (8 → 40), bots gang up on strong cities.
        Now first elimination ≈ 7–20 min, idle player overrun ≈ 10–24
        min, 8/10 seeds end within 25 min.
  Art: KayKit's grass is lime (#b9be32) and clashed with yellow / orange
        territory; build-models shifts it greener. Thornwick is white
        (green vanished on grass).

---

2026-10-04  Milestone 2: combat, enemy AI, barracks, win/lose
  WHAT: Everything has an owner (player / AI). Units have kinds
        (peasant / swordsman / archer), hp, cooldowns and an 'attack'
        job that chases and strikes; archers fire homing arrows. Buildings
        have hp (sites build up theirs), barracks trains soldiers, and
        destroyed buildings free their tiles. Losing a Town Hall ends the
        game. src/ai.ts runs a same-rules AI: economy, houses, mill,
        barracks, army, guard duty; once provoked (player deals damage) it
        counter-attacks, defends and sends growing waves. Map is 64×64
        with two towns. View: red/blue KayKit buildings, Knight swordsmen
        and crossbow archers with team capes + discs, attack / death
        animations, flying arrows, rubble, health bars, War/Peace badge,
        victory/defeat screen. Input: Army button, tap enemy = attack,
        Box toggle for drag-select. Tapping an own finished building now
        selects it even with units selected (found by the play-test:
        the barracks was unreachable without ✕ first).
  WHY:  User asked for combat + enemy AI next; chose same-rules AI,
        swordsman + archer, passive until provoked, full war after,
        64×64 map, Town-Hall win condition, and drag-box select.
  Tests: 24 (combat, provocation, archers, win, AI economy / peace / war).

---

2026-10-04  Three.js renderer + KayKit art (replaces Pixi)
  WHAT: New src/view/ (assets, terrain, forest, structures, units, fx,
        view) renders the unchanged simulation in 3D through an angled
        orthographic camera. Instanced trees, KayKit buildings with
        construction stages and a pop-in, animated peasants (walk / chop /
        build / idle) carrying logs or gold, wood-chip and dust particles,
        GTAO + bloom + ACES tone mapping (off on touch devices by default),
        HTML progress bars. Taps pick by raycast (buildings, mines, trees)
        and screen distance (peasants). Pixi, render.ts, iso.ts and
        camera.ts are deleted. Models come from scripts/build-models.mjs,
        which strips unused meshes/animations: 11.4 MB raw -> 2.45 MB.
  WHY:  User wanted better graphics now that we're on their PC (where the
        asset sites are reachable). Chose Three.js + full polish layer and
        KayKit after a side-by-side comparison with Quaternius.

2026-10-04  Tooling upgrade
  WHAT: Vite 8, TypeScript 7, Vitest suite (pathfinding, gathering,
        building, training) run in CI; CI actions bumped to current majors
        on Node 24.
  WHY:  Safety net before the renderer rewrite, and the old actions were
        deprecated.

---

2026-10-04  Split out into its own repo
  WHAT: Moved from rts/ in armandoxh/Territorygame to this standalone
        repo. Builds to dist/ (gitignored) and deploys to GitHub Pages
        via .github/workflows/deploy.yml instead of committing builds.
        Pages path is now /medieval-rts/.
  WHY:  User wanted one game per repo; Territorygame had grown to
        ~425k lines across seven games and experiments.

---

2026-09-25  Isometric view + medieval HUD (stand-in art)
  WHAT: Renderer switched to isometric (2:1 diamonds, src/iso.ts). Sim is
        unchanged: still a square grid; only drawing and tap-picking
        project. Every tree / mine / building / peasant is its own
        display object in a depth-sorted container, so each can become a
        sprite independently. Taps resolve what is visibly hit first
        (peasant > building/mine silhouette > tree canopy > ground tile).
        New code-drawn art: pines + broadleaf trees, beaches, raised map
        slab, timber-framed buildings with hip roofs, rising construction
        sites, rock-mound gold mine, straw-hat peasants with walk cycle,
        tool swings and carried loads. HUD restyled as wood + gold-trim
        panels with inline SVG icons. New peasants now spawn on the
        camera-facing side of the hall.
  WHY:  User: "Graphics suck." Chose isometric / 2.5D using a free asset
        pack. kenney.nl is blocked by this environment's network policy,
        so this lands the isometric engine with stand-in art first; Kenney
        sprites replace the drawn objects once access is allowed.

---

2026-09-25  Milestone 1: economy-only base-builder
  WHAT: New standalone project in rts/ (Vite + TS + Pixi 8) building
        to docs/rts/. Seeded map gen (lakes, forests, mines), A*
        pathfinding, peasants with gather → return → gather loops,
        construction sites, House / Lumber Mill, peasant training at
        the Town Hall, pop cap, touch pan / pinch / tap input, DOM HUD
        with a single context panel.
  WHY:  User asked for a new RTS game: a separate classic medieval
        base-builder, mobile-first, starting with only the economy.
  Note: startup is wrapped in an async boot() because top-level await in
        the entry chunk deadlocks against Pixi's lazy renderer chunks in
        the production build (the page loaded blank). `?seed=N` in the
        URL pins the map; `window.game` / `window.cam` are debug handles.
