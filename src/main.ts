import { Bots } from './ai';
import { PLAYER } from './config';
import { Game } from './game';
import { Hud, type HudAction } from './hud';
import { attachInput } from './input';
import { View } from './view/view';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed')) || Math.floor(Math.random() * 1e9);
const game = new Game(seed);
const bots = new Bots(game);

// Ambient occlusion + bloom are on for mouse devices, off for touch (phones),
// unless ?fx=1 / ?fx=0 says otherwise.
const effects = params.has('fx') ? params.get('fx') !== '0' : !matchMedia('(pointer: coarse)').matches;

async function boot(): Promise<void> {
  const view = new View(document.getElementById('app')!, game, { effects });
  const loading = document.getElementById('loading')!;
  await view.load((done, total) => { loading.textContent = `Loading ${Math.round((done / total) * 100)}%`; });
  loading.remove();

  let selected: number | null = null;
  let half = false;

  function onTap(sx: number, sy: number): void {
    const picked = view.pickArmy(sx, sy, 30);
    if (picked && picked.owner === PLAYER) {
      selected = picked.id;
      return;
    }
    const hex = picked ? { col: picked.col, row: picked.row } : view.hexAtScreen(sx, sy);
    if (!hex || !game.world.inBounds(hex.col, hex.row)) return;

    // Tapping your own city selects the army standing guard there.
    const guard = game.armiesAt(hex.col, hex.row).find((a) => a.owner === PLAYER && a.path.length === 0);
    const army = selected !== null ? game.army(selected) : undefined;
    if (!army) {
      if (guard) selected = guard.id;
      return;
    }
    if (guard && guard.id !== army.id && !game.cityAt(hex.col, hex.row)) {
      selected = guard.id;
      return;
    }
    const moved = game.move(army.id, hex.col, hex.row, half && army.count >= 2 ? Math.floor(army.count / 2) : undefined);
    if (moved) {
      view.showMarker(hex);
      selected = moved.id;
    }
  }

  function onAction(a: HudAction): void {
    if (a === 'clear') selected = null;
    else if (a === 'all') half = false;
    else if (a === 'half') half = true;
    else if (a === 'capital') {
      const cap = game.cities.find((c) => c.id === game.player.capitalId)!;
      view.focus(cap);
      const guard = game.armiesAt(cap.col, cap.row).find((x) => x.owner === PLAYER && x.path.length === 0);
      if (guard) selected = guard.id;
    } else if (a === 'restart') {
      params.delete('seed');
      location.search = params.toString();
    }
  }

  const keyPan = attachInput(view.canvas, view, onTap);
  const hud = new Hud(onAction);

  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    keyPan(dt);
    game.tick(dt);
    bots.tick(dt);
    if (selected !== null && !game.army(selected)) selected = null;
    view.update(dt, selected);
    hud.update(game, selected, half);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // Debug handles for poking at state from the console.
  Object.assign(window, { game, view, bots });
}

boot().catch((e) => {
  const loading = document.getElementById('loading');
  if (loading) loading.textContent = `Failed to start: ${e?.message ?? e}`;
  console.error(e);
});
