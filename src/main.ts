import { EnemyAI } from './ai';
import { BUILDINGS, PLAYER, TILE, type UnitKind } from './config';
import { Game, type Unit } from './game';
import { Hud, type HudAction, type Mode } from './hud';
import { attachInput } from './input';
import { View } from './view/view';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed')) || Math.floor(Math.random() * 1e9);
const game = new Game(seed);
const ai = new EnemyAI(game);

// Ambient occlusion + bloom are on for mouse devices, off for touch (phones),
// unless ?fx=1 / ?fx=0 says otherwise.
const effects = params.has('fx') ? params.get('fx') !== '0' : !matchMedia('(pointer: coarse)').matches;

async function boot(): Promise<void> {
  const view = new View(document.getElementById('app')!, game, { effects });
  const loading = document.getElementById('loading')!;
  await view.load((done, total) => { loading.textContent = `Loading ${Math.round((done / total) * 100)}%`; });
  loading.remove();

  let mode: Mode = { type: 'none' };
  let boxOn = false;

  const selectedUnits = (): Unit[] =>
    mode.type === 'units' ? game.units.filter((u) => u.owner === PLAYER && (mode as { ids: Set<number> }).ids.has(u.id)) : [];
  const select = (units: Unit[]) => {
    if (units.length) mode = { type: 'units', ids: new Set(units.map((u) => u.id)) };
  };

  function onTap(sx: number, sy: number): void {
    const ground = view.tileAt(sx, sy);

    if (mode.type === 'place') {
      const half = Math.floor(BUILDINGS[mode.kind].size / 2);
      mode = { ...mode, tx: ground.tx - half, ty: ground.ty - half };
      return;
    }

    const sel = selectedUnits();
    const unit = view.pickUnit(sx, sy, 28);
    if (unit) {
      if (unit.owner === PLAYER) select([unit]);
      else if (sel.length) {
        game.orderAttack(sel, unit.id);
        view.showMarker(unit.x / TILE, unit.y / TILE);
      } else mode = { type: 'inspect', id: unit.id };
      return;
    }

    // Tall things (buildings, mines, trees) cover the ground behind them, so
    // resolve what was visibly tapped before falling back to the ground tile.
    const hit = view.pickObject(sx, sy);
    const structure = hit && 'structure' in hit ? hit.structure : null;
    const tree = hit && 'tree' in hit ? hit.tree : null;
    const tx = structure ? structure.tx : tree ? tree.x : ground.tx;
    const ty = structure ? structure.ty : tree ? tree.y : ground.ty;
    if (!game.map.inBounds(tx, ty)) return;

    // Own finished building: select it, unless someone selected is carrying
    // something it accepts (then the tap means "drop it off here").
    const own = structure && game.buildings.get(structure.id);
    if (own && own.owner === PLAYER && own.progress >= 1) {
      const dropOff = BUILDINGS[own.kind].dropOff;
      if (!sel.some((u) => u.carry && dropOff.includes(u.carry.kind))) {
        mode = { type: 'building', id: own.id };
        return;
      }
    }

    if (sel.length) {
      game.orderAt(sel, tx, ty);
      if (structure) view.showMarker(structure.tx + structure.size / 2, structure.ty + structure.size / 2);
      else if (tree) view.showMarker(tree.x + 0.5, tree.y + 0.5);
      else {
        const p = view.groundAt(sx, sy);
        if (p) view.showMarker(p.x, p.z);
      }
      return;
    }

    const b = structure && game.buildings.get(structure.id);
    mode = b ? { type: 'building', id: b.id } : { type: 'none' };
  }

  function onBox(x0: number, y0: number, x1: number, y1: number): void {
    const units = view.unitsInBox(x0, y0, x1, y1, PLAYER);
    if (units.length) select(units);
  }

  function onAction(a: HudAction): void {
    if (a === 'clear') {
      mode = mode.type === 'place' ? { type: 'units', ids: mode.builders } : { type: 'none' };
    } else if (a === 'idle') {
      select(game.idleUnits(PLAYER, 'peasant'));
    } else if (a === 'all') {
      select(game.units.filter((u) => u.owner === PLAYER && u.kind === 'peasant'));
    } else if (a === 'army') {
      select(game.units.filter((u) => u.owner === PLAYER && u.kind !== 'peasant'));
    } else if (a === 'box') {
      boxOn = !boxOn;
    } else if (a === 'restart') {
      params.delete('seed');
      location.search = params.toString();
    } else if (a.startsWith('train:') && mode.type === 'building') {
      const b = game.buildings.get(mode.id);
      if (b && b.owner === PLAYER) game.train(b, a.slice(6) as UnitKind);
    } else if (a === 'confirm' && mode.type === 'place') {
      const builders = game.units.filter((u) => (mode as { builders: Set<number> }).builders.has(u.id));
      if (game.placeBuilding(mode.kind, mode.tx, mode.ty, builders)) mode = { type: 'units', ids: mode.builders };
    } else if (a.startsWith('build:') && mode.type === 'units') {
      const kind = a.slice(6) as keyof typeof BUILDINGS;
      const short = game.shortfall(BUILDINGS[kind].cost);
      if (short) {
        game.notice = { text: short, at: game.time };
        return;
      }
      // Ghost starts at screen centre; user taps to move it.
      const c = view.tileAt(innerWidth / 2, innerHeight / 2);
      const half = Math.floor(BUILDINGS[kind].size / 2);
      mode = { type: 'place', kind, tx: c.tx - half, ty: c.ty - half, builders: mode.ids };
    }
  }

  attachInput(view.canvas, view, { onTap, onBox, boxMode: () => boxOn });
  const hud = new Hud(onAction);

  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    game.tick(dt);
    ai.tick(dt);

    // Drop selections that no longer exist.
    if (mode.type === 'building' && !game.buildings.has(mode.id)) mode = { type: 'none' };
    if (mode.type === 'inspect' && !game.unit(mode.id)) mode = { type: 'none' };
    if (mode.type === 'units' && selectedUnits().length === 0) mode = { type: 'none' };

    view.update(dt, {
      selectedUnits: mode.type === 'units' ? mode.ids : new Set(),
      selectedBuilding: mode.type === 'building' ? mode.id : null,
      ghost: mode.type === 'place'
        ? { kind: mode.kind, tx: mode.tx, ty: mode.ty, ok: game.canPlace(mode.kind, mode.tx, mode.ty) }
        : null,
    });
    hud.update(game, mode, boxOn);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // Debug handles for poking at state from the console.
  Object.assign(window, { game, view, ai });
}

boot().catch((e) => {
  const loading = document.getElementById('loading');
  if (loading) loading.textContent = `Failed to start: ${e?.message ?? e}`;
  console.error(e);
});
