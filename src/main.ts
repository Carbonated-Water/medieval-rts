import { RODS, TIERS } from './data';
import { Game, fishById, type SaveData } from './game';
import { Scene } from './scene';
import { UI, type Action } from './ui';

const SAVE_KEY = 'riverside-fishing-v1';

function load(): Partial<SaveData> | undefined {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

const game = new Game(load());
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const scene = new Scene(canvas, game);
const ui = new UI(onAction);

let dirty = false;
const save = () => {
  if (!dirty) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(game.save())); dirty = false; } catch { /* storage full or blocked: keep playing */ }
};
setInterval(save, 2000);
addEventListener('pagehide', save);

scene.onArrive = (p) => {
  if (p === 'market') { ui.open = 'market'; ui.tab = game.bag.length ? 'sell' : 'rods'; }
};

canvas.addEventListener('click', (e) => {
  if (ui.open) return;
  const target = scene.hit(e.clientX, e.clientY);
  scene.walkTo(target, e.clientX);
});

// Keyboard: A/D or arrows walk, Space casts / reels, E opens the market.
const held = new Set<string>();
addEventListener('keydown', (e) => {
  if (['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'].includes(e.code)) { held.add(e.code); e.preventDefault(); }
  if (e.code === 'Space' && !e.repeat) {
    e.preventDefault();
    if (scene.place === 'dock' && !ui.open) onAction(game.line.type === 'idle' || game.line.type === 'result' ? 'cast' : 'reel');
  }
  if (e.code === 'KeyE' && scene.place === 'market') onAction(ui.open ? 'close' : 'market');
  if (e.code === 'Escape') onAction('close');
});
addEventListener('keyup', (e) => held.delete(e.code));
addEventListener('blur', () => held.clear());

function onAction(a: Action): void {
  if (a === 'cast') game.cast();
  else if (a === 'reel') game.reel();
  else if (a === 'market') { ui.open = 'market'; ui.tab = game.bag.length ? 'sell' : 'rods'; }
  else if (a === 'journal') ui.open = ui.open === 'journal' ? null : 'journal';
  else if (a === 'close') ui.open = null;
  else if (a.startsWith('tab:')) ui.tab = a.slice(4) as UI['tab'];
  else if (a === 'sellAll') { const n = game.sellAll(); if (n) ui.say(`Sold everything for <b>$${n.toLocaleString()}</b>`, 2, 'good'); }
  else if (a.startsWith('sell:')) game.sell(Number(a.slice(5)));
  else if (a.startsWith('buyRod:')) {
    const lvl = Number(a.slice(7));
    if (game.buyRod(lvl)) ui.say(`Bought the <b>${RODS[lvl]!.name}</b>! ${TIERS[RODS[lvl]!.tier].name} fish can be landed now.`, 3, 'good');
  } else if (a === 'upgradeSkill') {
    if (game.upgradeSkill()) ui.say(`Fishing skill is now <b>${game.skill}</b>`, 2, 'good');
  } else if (a === 'reset') {
    if (confirm('Start over? Your money, rods, skill and journal will be wiped.')) {
      localStorage.removeItem(SAVE_KEY);
      location.reload();
      return;
    }
  }
  dirty = true;
}

/** Announce how a cast ended. */
let lastLine = '';
function announce(): void {
  const line = game.line;
  const key = line.type === 'result' ? `result:${line.outcome}:${line.caught?.id ?? ''}` : line.type;
  if (key === lastLine) return;
  lastLine = key;
  if (line.type !== 'result') return;
  dirty = true;
  const f = line.fish;
  if (line.outcome === 'caught' && f && line.caught) {
    const first = game.journal[f.id]!.count === 1;
    ui.say(`${first ? '<span class="new">NEW!</span> ' : ''}<b>${f.name}</b> <span class="tier" style="--c:${TIERS[f.tier].color}">${TIERS[f.tier].name}</span> · ${line.caught.kg} kg · <b>$${line.caught.value}</b>`, 2.6, 'good');
  } else if (line.outcome === 'snapped' && f) {
    const need = RODS.find((r) => r.tier >= f.tier)!;
    ui.say(`Snap! A <b>${f.name}</b> <span class="tier" style="--c:${TIERS[f.tier].color}">${TIERS[f.tier].name}</span> broke your line — you need a <b>${need.name}</b>.`, 3.2, 'bad');
  } else if (line.outcome === 'escaped') {
    ui.say('Too slow — it got away…', 2, 'bad');
  } else if (line.outcome === 'scared') {
    ui.say('Too early! You scared it off.', 2, 'bad');
  }
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  const dir = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
  if (!ui.open) scene.nudge(dir, dt);
  game.tick(dt);
  announce();
  scene.update(dt);
  ui.update(dt, game, scene.place, scene.walking);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug handles for poking at state from the console.
Object.assign(window, { game, scene, fishById });
