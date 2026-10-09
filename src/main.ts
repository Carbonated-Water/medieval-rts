import { ACHIEVEMENTS, DEV_MULTIPLIER, RODS, SKILLS, VARIANTS, type GearKind, type SkillId } from './data';
import { Game, fishById, type Line, type SaveData } from './game';
import { Scene } from './scene';
import './ui.css';
import { pixelFishIcon as fishIcon, pixelIcon } from './pixelart';
import { ACH_ICON, GEAR_ICON, SKILL_ICON, UI, type Action } from './ui';

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
// ?dev=1 switches dev mode on (fish sell for DEV_MULTIPLIER×); the journal has a toggle too.
if (new URLSearchParams(location.search).get('dev') === '1') game.dev = true;
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const scene = new Scene(canvas, game);
const ui = new UI(onAction);
const note = ui.notices;

let dirty = false;
const save = () => {
  if (!dirty) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(game.save())); dirty = false; } catch { /* storage full or blocked: keep playing */ }
};
setInterval(save, 2000);
addEventListener('pagehide', save);

// Arriving at a shop opens it: the market only if there's something to sell.
scene.onArrive = (p) => {
  if (p === 'market' && game.bag.length) ui.open = 'market';
  if (p === 'tackle') ui.open = 'tackle';
  if (p === 'school') ui.open = 'training';
};

canvas.addEventListener('click', (e) => {
  if (ui.open) return;
  // On the dock, tapping a bobber reels that one line.
  const slot = scene.hitBobber(e.clientX, e.clientY);
  if (slot >= 0) { game.reel(slot); return; }
  const target = scene.hit(e.clientX, e.clientY);
  if (target === 'dock' && scene.place === 'dock') return; // already there; don't put the lines away
  scene.walkTo(target, e.clientX);
});

/** What the big button / Space does right now: reel a bite, else cast what's out, else reel (too early). */
const primaryAction = (): Action =>
  game.lines.some((l) => l.type === 'bite') ? 'reel'
    : game.lines.some((l) => l.type === 'idle' || l.type === 'result') ? 'cast' : 'reel';

// Keyboard: A/D or arrows walk, Space casts / reels, E opens the building you're at.
const held = new Set<string>();
addEventListener('keydown', (e) => {
  if (['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'].includes(e.code)) { held.add(e.code); e.preventDefault(); }
  if (e.code === 'Space' && !e.repeat) {
    e.preventDefault();
    if (scene.place === 'dock' && !ui.open) onAction(primaryAction());
  }
  const shop = scene.place === 'school' ? 'training' : scene.place === 'market' || scene.place === 'tackle' ? scene.place : null;
  if (e.code === 'KeyE' && shop) onAction(ui.open ? 'close' : shop);
  if (e.code === 'Escape') onAction('close');
});
addEventListener('keyup', (e) => held.delete(e.code));
addEventListener('blur', () => held.clear());

function onAction(a: Action): void {
  if (a === 'cast') game.cast();
  else if (a === 'reel') game.reel();
  else if (a === 'market' || a === 'tackle' || a === 'training' || a === 'journal' || a === 'trophies' || a === 'inbox' || a === 'settings') ui.open = ui.open === a ? null : a;
  else if (a === 'claimAll') { const paid = game.claim(); if (paid) note.banner(pixelIcon('coin'), 'COLLECTED', `$${paid.toLocaleString()}`); }
  else if (a.startsWith('trophy:')) {
    // Tap a trophy: show it; if it's ready, collect it too.
    ui.pick = a.slice(7);
    const paid = game.claim(ui.pick);
    if (paid) note.banner(pixelIcon('coin'), 'COLLECTED', `$${paid.toLocaleString()}`);
  }
  else if (a === 'close') ui.open = null;
  else if (a === 'sellAll') { const n = game.sellAll(); if (n) note.banner(pixelIcon('coin'), 'SOLD', `$${n.toLocaleString()}`); }
  else if (a.startsWith('sellFish:')) {
    const f = fishById(a.slice(9));
    const n = game.sellSpecies(f.id);
    if (n) note.banner(fishIcon(f, false, 48, 28), `SOLD ${f.name.toUpperCase()}`, `$${n.toLocaleString()}`);
  }
  else if (a.startsWith('buy:')) {
    const kind = a.slice(4) as GearKind;
    const next = game.nextGear(kind);
    if (next && game.buyGear(kind)) note.banner(pixelIcon(GEAR_ICON[kind]), 'BOUGHT', next.name);
  } else if (a.startsWith('train:')) {
    const id = a.slice(6) as SkillId;
    if (game.train(id)) note.banner(pixelIcon(SKILL_ICON[id]), 'TRAINED', `${SKILLS[id].name} ${game.level(id)}`);
  } else if (a === 'toggleDev') {
    game.dev = !game.dev;
    note.banner(pixelIcon('coin'), 'DEV MODE', game.dev ? `On, prices x${DEV_MULTIPLIER}` : 'Off', 'plain');
  } else if (a === 'reset') {
    if (confirm('Start over? Your money, gear, skills and journal will be wiped.')) {
      localStorage.removeItem(SAVE_KEY);
      location.reload();
      return;
    }
  }
  dirty = true;
}

/**
 * Feedback for finished casts, the way pixel games do it: the money floats
 * up from the fisherman, the fish goes in the pickup log (repeats merge),
 * and only firsts and rare variants get a banner. Misses just float a word,
 * and only while you fish by hand.
 */
const lastKeys: string[] = [];
function announce(): void {
  game.lines.forEach((line, slot) => {
    const key = line.type === 'result' ? `result:${line.outcome}:${line.caught?.id ?? ''}` : line.type;
    const fresh = key !== lastKeys[slot] && line.type === 'result';
    lastKeys[slot] = key;
    if (fresh) { dirty = true; announceLine(line, slot); }
  });
  lastKeys.length = game.lines.length;
}

function announceLine(line: Extract<Line, { type: 'result' }>, slot: number): void {
  const f = line.fish;
  const at = scene.fisherScreen();
  const x = at.x + (slot % 2 ? -1 : 1) * Math.min(slot, 2) * 18; // lines side by side don't overlap
  if (line.outcome === 'caught' && f && line.caught) {
    const c = line.caught, v = c.variant;
    const name = v ? `${VARIANTS[v].name} ${f.name}` : f.name;
    const pic = fishIcon(f, false, 48, 28, v);
    note.float(`+$${game.priceOf(c).toLocaleString()}`, x, at.y, v ? 'rare' : 'good');
    note.log(`${f.id}:${v ?? ''}`, pic, name, v ? 'rare' : 'plain');
    if (game.journal[f.id]!.count === 1) note.banner(pic, 'NEW FISH', f.name, 'rare');
    else if (v) note.banner(pic, VARIANTS[v].name.toUpperCase(), f.name, 'rare');
    if (line.strong) note.float('HELD!', x, at.y - 40, 'plain');
  } else if (line.outcome === 'snapped' && f) {
    const need = RODS.find((r) => r.tier >= f.tier)!;
    note.float('SNAP!', x, at.y, 'bad');
    note.log('snap', fishIcon(f, true, 48, 28), `Snapped: needs ${need.name}`, 'bad');
  } else if (!game.auto && line.outcome === 'escaped') {
    note.float('TOO SLOW', x, at.y, 'plain');
  } else if (!game.auto && line.outcome === 'scared') {
    note.float('TOO EARLY', x, at.y, 'plain');
  }
}

/** Banner for newly completed achievements (ones already done at load stay quiet). */
const done = new Set(ACHIEVEMENTS.filter((a) => game.achieved(a)).map((a) => a.id));
let achCheck = 0;
function announceAchievements(): void {
  if (++achCheck % 15) return; // a few times a second is plenty
  for (const a of ACHIEVEMENTS) {
    if (done.has(a.id) || !game.achieved(a)) continue;
    done.add(a.id);
    dirty = true;
    note.banner(pixelIcon(ACH_ICON[a.stat]), 'ACHIEVEMENT', a.name, 'rare');
  }
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  const dir = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
  if (!ui.open) scene.nudge(dir, dt);
  game.tick(dt);
  if (scene.place === 'dock') game.autoFish();
  announce();
  announceAchievements();
  scene.update(dt);
  ui.update(dt, game, scene.place, scene.walking);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug handles for poking at state from the console.
Object.assign(window, { game, scene, fishById });
