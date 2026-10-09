# medieval-rts changelog

One entry per change: WHAT + WHY.

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
