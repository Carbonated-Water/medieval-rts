import { ACHIEVEMENTS, DEV_MULTIPLIER, LETTERS, RODS, SKILLS, VARIANTS, baitById, type BaitId, type GearKind, type SkillId } from './data';
import { Game, fishById, type Line, type SaveData } from './game';
import { Scene, WORM_SPOT_X } from './scene';
import './ui.css';
import { pixelFishIcon as fishIcon, pixelIcon } from './pixelart';
import { ACH_ICON, BAIT_ICON, GEAR_ICON, SKILL_ICON, UI, type Action } from './ui';

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
/** Set by Start over: nothing may be saved again, or the unload save would bring the old game back. */
let wiping = false;
const save = () => {
  if (!dirty || wiping) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(game.save())); dirty = false; } catch { /* storage full or blocked: keep playing */ }
};
setInterval(save, 2000);
addEventListener('pagehide', save);

// Arriving at a shop opens it: the market only if there's something to sell.
scene.onArrive = (p) => {
  if (p === 'market' && game.bag.length) ui.open = 'market';
  if (p === 'tackle') ui.open = 'tackle';
  if (p === 'school') ui.open = 'training';
  if (p === 'bait') ui.open = 'baitshop';
};

canvas.addEventListener('click', (e) => {
  if (ui.open) return;
  // The harbor across the river opens its panel from anywhere.
  if (scene.hitHarbor(e.clientX, e.clientY)) { ui.open = 'harbor'; return; }
  // Tapping a worm walks over to dig it up (it's picked up on the way past).
  const worm = scene.hitWorm(e.clientX, e.clientY);
  if (worm) { scene.walkTo('ground', worm.x); return; }
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
  const shop = scene.place === 'school' ? 'training' : scene.place === 'bait' ? 'baitshop' : scene.place === 'market' || scene.place === 'tackle' ? scene.place : null;
  if (e.code === 'KeyE' && shop) onAction(ui.open ? 'close' : shop);
  if (e.code === 'Escape') onAction('close');
});
addEventListener('keyup', (e) => held.delete(e.code));
addEventListener('blur', () => held.clear());

function onAction(a: Action): void {
  if (a === 'cast') {
    if (!game.cast() && !game.activeBait) { const at = scene.fisherScreen(); note.float('NO BAIT', at.x, at.y, 'bad'); }
  }
  else if (a === 'reel') game.reel();
  else if (a === 'market' || a === 'tackle' || a === 'baitshop' || a === 'pouch' || a === 'harbor' || a === 'training' || a === 'journal' || a === 'trophies' || a === 'inbox' || a === 'settings') ui.open = ui.open === a ? null : a;
  else if (a.startsWith('bait:')) game.selectBait(a.slice(5) as BaitId);
  else if (a === 'buyCompany') {
    if (game.buyCompany()) { ui.open = null; note.clearBanners(); note.banner(pixelIcon('boat'), 'THE FISHING CO.', 'is yours', 'rare'); }
  } else if (a === 'buyBoat') { if (game.buyBoat()) note.banner(pixelIcon('boat'), 'BOUGHT', 'Net Boat'); }
  else if (a.startsWith('send:')) game.sendBoat(Number(a.slice(5)));
  else if (a.startsWith('collect:')) {
    const paid = game.collectHaul(Number(a.slice(8)));
    if (paid) note.banner(pixelIcon('boat'), 'HAUL SOLD', `$${paid.toLocaleString()}`);
  } else if (a.startsWith('crew:')) { if (game.hireCrew(Number(a.slice(5)))) note.banner(pixelIcon('crew'), 'HIRED', 'A new deckhand'); }
  else if (a.startsWith('net:')) {
    const i = Number(a.slice(4)), next = game.nextNet(i);
    if (next && game.upgradeNet(i)) note.banner(pixelIcon('net'), 'BOUGHT', next.name);
  }
  else if (a.startsWith('buyBait:')) {
    const [, id, n] = a.split(':') as [string, BaitId, string];
    if (game.buyBait(id, Number(n))) note.banner(pixelIcon(BAIT_ICON[id], 3), 'BOUGHT', `${n} x ${baitById(id).name}`, 'plain');
  }
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
      wiping = true;
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

/** The harbor's story beats: letters, the reveal, and boats coming home. */
const hauls = game.boats.map((b) => !!b.haul);
function announceHarbor(): void {
  for (const text of game.takeLetters()) {
    const reveal = game.letters === LETTERS.length;
    note.banner(pixelIcon('letter'), reveal ? 'THE OLD HARBOR' : 'A LETTER', reveal ? 'is for sale' : 'from H.', reveal ? 'rare' : 'plain');
    note.log(`letter:${text}`, pixelIcon('letter'), 'A letter from H.', 'plain');
    dirty = true;
  }
  game.boats.forEach((b, i) => {
    if (b.haul && !hauls[i]) note.banner(pixelIcon('boat'), 'BOAT IS BACK', `$${game.haulValue(b).toLocaleString()}`, 'rare');
    hauls[i] = !!b.haul;
  });
}

/** Banner for newly completed achievements (ones already done at load stay quiet). */
const done = new Set(ACHIEVEMENTS.filter((a) => game.achieved(a)).map((a) => a.id));
let achCheck = 0;
function announceAchievements(): void {
  if (++achCheck % 15) return; // a few times a second is plenty
  announceHarbor();
  for (const a of ACHIEVEMENTS) {
    if (done.has(a.id) || !game.achieved(a)) continue;
    done.add(a.id);
    dirty = true;
    note.banner(pixelIcon(ACH_ICON[a.stat]), 'ACHIEVEMENT', a.name, 'rare');
  }
}

/** Walking past a worm hole on the path digs it up. */
function digWorms(): void {
  const x = scene.pathX;
  if (x === null) return;
  for (const w of [...game.groundWorms]) {
    if (Math.abs(WORM_SPOT_X[w.spot]! - x) > 0.025) continue;
    const n = game.pickWorm(w.id);
    const at = scene.fisherScreen();
    note.float(`+${n} WORMS`, at.x, at.y, 'plain');
    dirty = true;
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
  digWorms();
  announce();
  announceAchievements();
  scene.update(dt);
  ui.update(dt, game, scene.place, scene.walking);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug handles for poking at state from the console.
Object.assign(window, { game, scene, fishById });
