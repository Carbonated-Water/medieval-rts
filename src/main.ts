import { BUILDINGS } from './config';
import { Game, type Unit } from './game';
import { Hud, type HudAction, type Mode } from './hud';
import { attachInput } from './input';
import { View } from './view/view';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed')) || Math.floor(Math.random() * 1e9);
const game = new Game(seed);

// Ambient occlusion + bloom are on for mouse devices, off for touch (phones),
// unless ?fx=1 / ?fx=0 says otherwise.
const effects = params.has('fx') ? params.get('fx') !== '0' : !matchMedia('(pointer: coarse)').matches;

async function boot(): Promise<void> {
  const view = new View(document.getElementById('app')!, game, { effects });
  const loading = document.getElementById('loading')!;
  await view.load((done, total) => { loading.textContent = `Loading ${Math.round((done / total) * 100)}%`; });
  loading.remove();

  let mode: Mode = { type: 'none' };

  const selectedUnits = (): Unit[] =>
    mode.type === 'units' ? game.units.filter((u) => (mode as { ids: Set<number> }).ids.has(u.id)) : [];

  function onTap(sx: number, sy: number): void {
    const ground = view.tileAt(sx, sy);

    if (mode.type === 'place') {
      const half = Math.floor(BUILDINGS[mode.kind].size / 2);
      mode = { ...mode, tx: ground.tx - half, ty: ground.ty - half };
      return;
    }

    const unit = view.pickUnit(sx, sy, 28);
    if (unit) {
      mode = { type: 'units', ids: new Set([unit.id]) };
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

    if (mode.type === 'units') {
      const units = selectedUnits();
      if (units.length > 0) {
        game.orderAt(units, tx, ty);
        if (structure) view.showMarker(structure.tx + structure.size / 2, structure.ty + structure.size / 2);
        else if (tree) view.showMarker(tree.x + 0.5, tree.y + 0.5);
        else {
          const p = view.groundAt(sx, sy);
          if (p) view.showMarker(p.x, p.z);
        }
        return;
      }
    }

    const b = structure && game.buildings.get(structure.id);
    mode = b ? { type: 'building', id: b.id } : { type: 'none' };
  }

  function onAction(a: HudAction): void {
    if (a === 'clear') {
      mode = mode.type === 'place' ? { type: 'units', ids: mode.builders } : { type: 'none' };
    } else if (a === 'idle' || a === 'all') {
      const list = a === 'idle' ? game.idleUnits() : game.units;
      if (list.length) mode = { type: 'units', ids: new Set(list.map((u) => u.id)) };
    } else if (a === 'train' && mode.type === 'building') {
      const b = game.buildings.get(mode.id);
      if (b) game.train(b);
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

  attachInput(view.canvas, view, onTap);
  const hud = new Hud(onAction);

  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    game.tick(dt);

    // Drop selections that no longer exist.
    if (mode.type === 'building' && !game.buildings.has(mode.id)) mode = { type: 'none' };

    view.update(dt, {
      selectedUnits: mode.type === 'units' ? mode.ids : new Set(),
      selectedBuilding: mode.type === 'building' ? mode.id : null,
      ghost: mode.type === 'place'
        ? { kind: mode.kind, tx: mode.tx, ty: mode.ty, ok: game.canPlace(mode.kind, mode.tx, mode.ty) }
        : null,
    });
    hud.update(game, mode);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // Debug handles for poking at state from the console.
  Object.assign(window, { game, view });
}

boot().catch((e) => {
  const loading = document.getElementById('loading');
  if (loading) loading.textContent = `Failed to start: ${e?.message ?? e}`;
  console.error(e);
});
