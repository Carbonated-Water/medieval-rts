# medieval-rts changelog

One entry per change: WHAT + WHY.

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
