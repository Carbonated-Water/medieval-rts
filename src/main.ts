import { ACHIEVEMENTS, DEV_MULTIPLIER, RODS, SKILLS, TIERS, type GearKind, type SkillId, type Tier } from './data';
import { Game, fishById, type Line, type SaveData } from './game';
import { Scene } from './scene';
import { fishIcon } from './fishart';
import { UI, variantTag, type Action } from './ui';

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
  else if (a === 'claimAll' || a.startsWith('claim:')) {
    const paid = game.claim(a === 'claimAll' ? undefined : a.slice(6));
    if (paid) ui.say(`🏆 Collected <b>$${paid.toLocaleString()}</b>`, 2, 'good');
  }
  else if (a === 'close') ui.open = null;
  else if (a === 'sellAll') { const n = game.sellAll(); if (n) ui.say(`Sold everything for <b>$${n.toLocaleString()}</b>`, 2, 'good'); }
  else if (a.startsWith('sellFish:')) {
    const f = fishById(a.slice(9));
    const n = game.sellSpecies(f.id);
    if (n) ui.say(`Sold your <b>${f.name}</b> for <b>$${n.toLocaleString()}</b>`, 2, 'good');
  }
  else if (a.startsWith('buy:')) {
    const kind = a.slice(4) as GearKind;
    const next = game.nextGear(kind);
    if (next && game.buyGear(kind)) {
      const extra = kind === 'rod' ? ` ${TIERS[RODS[next.level]!.tier].name} fish can be landed now.` : ` ${next.blurb}`;
      ui.say(`Bought <b>${next.name}</b>!${extra}`, 3, 'good');
    }
  } else if (a.startsWith('train:')) {
    const id = a.slice(6) as SkillId;
    if (game.train(id)) ui.say(`${SKILLS[id].name} is now level <b>${game.level(id)}</b>`, 2, 'good');
  } else if (a === 'toggleDev') {
    game.dev = !game.dev;
    ui.say(game.dev ? `Dev mode ON — fish sell for <b>${DEV_MULTIPLIER}×</b>` : 'Dev mode OFF', 2);
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
 * Announce how casts ended: one notification card per line, so with several
 * lines every catch (fish, weight, value) stays readable in the stack.
 * Misses only show while you fish by hand, and aren't kept in 🔔.
 */
const lastKeys: string[] = [];
function announce(): void {
  game.lines.forEach((line, slot) => {
    const key = line.type === 'result' ? `result:${line.outcome}:${line.caught?.id ?? ''}` : line.type;
    const fresh = key !== lastKeys[slot] && line.type === 'result';
    lastKeys[slot] = key;
    if (fresh) { dirty = true; announceLine(line); }
  });
  lastKeys.length = game.lines.length;
}

function announceLine(line: Extract<Line, { type: 'result' }>): void {
  const f = line.fish;
  const tier = (t: Tier) => `<span class="tier" style="--c:${TIERS[t].color}">${TIERS[t].name}</span>`;
  if (line.outcome === 'caught' && f && line.caught) {
    const c = line.caught;
    const first = game.journal[f.id]!.count === 1;
    const strong = line.strong ? ' 💪' : '';
    const variant = c.variant ? `${variantTag(c.variant)} ` : '';
    ui.say(`${variant}${first ? '<span class="new">NEW!</span> ' : ''}<b>${f.name}</b>${strong} ${tier(f.tier)}<br><small>${c.kg} kg</small> · <b class="cash">$${game.priceOf(c).toLocaleString()}</b>`,
      c.variant || first ? 7 : 5, c.variant ? 'rare' : 'good', fishIcon(f, false, 96, 56, c.variant));
  } else if (line.outcome === 'snapped' && f) {
    const need = RODS.find((r) => r.tier >= f.tier)!;
    ui.say(`Snap! A <b>${f.name}</b> ${tier(f.tier)} broke your line<br><small>you need a <b>${need.name}</b></small>`, 5, 'bad', fishIcon(f, true));
  } else if (!game.auto && line.outcome === 'escaped') {
    ui.say('Too slow — it got away…', 2.5, 'bad', '💨', false);
  } else if (!game.auto && line.outcome === 'scared') {
    ui.say(`Too early! You scared ${game.lineCount > 1 ? 'one' : 'it'} off.`, 2.5, 'bad', '🙀', false);
  }
}

/** Toast newly completed achievements (ones already done at load stay quiet). */
const done = new Set(ACHIEVEMENTS.filter((a) => game.achieved(a)).map((a) => a.id));
let achCheck = 0;
function announceAchievements(): void {
  if (++achCheck % 15) return; // a few times a second is plenty
  for (const a of ACHIEVEMENTS) {
    if (done.has(a.id) || !game.achieved(a)) continue;
    done.add(a.id);
    dirty = true;
    ui.say(`Achievement: <b>${a.name}</b><br><small>${a.desc} · collect <b>$${a.reward.toLocaleString()}</b> in 🏆</small>`, 7, 'rare', a.icon);
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
