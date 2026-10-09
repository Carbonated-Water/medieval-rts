import type { FishDef, Variant } from './data';

/**
 * Pixel sprites drawn in code, in the Kenney Pixel Platformer palette (dark
 * navy outline, flat colours) so they sit next to its tiles: the fisherman,
 * all 20 fish, the shops, the school cabin, the dock, bobbers. Each returns a
 * small canvas; the scene turns them into textures, the HUD scales them up
 * for icons. No Pixi here.
 */
export const PAL = {
  outline: '#434a5f',
  dirt: '#cb815e', dirtDark: '#9f5a52', dirtDeep: '#6f3e43',
  green: '#2eb082', greenLight: '#36e377', greenDark: '#345551',
  water: '#2cc5f6', waterLight: '#4ce5fd', waterDeep: '#1490c3', waterDeeper: '#0f688d',
  sky: '#dff6f5', sand: '#f4ac66', sandLight: '#fcc782', sandMid: '#eea160',
  red: '#dd442c', redLight: '#fc683b', redDark: '#7e3125',
  gold: '#f4b41b', goldLight: '#fee481', skin: '#f4cca1', skinDark: '#e29f7b',
  grey: '#dce1e7', greyMid: '#959ab1', greyDark: '#747a90', white: '#ffffff',
};

type Ctx = CanvasRenderingContext2D;

function makeCanvas(w: number, h: number, draw: (ctx: Ctx) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  return c;
}

const rect = (ctx: Ctx, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};
const px = (ctx: Ctx, x: number, y: number, color: string) => rect(ctx, x, y, 1, 1, color);

/** Kenney-style outline: every empty pixel touching a filled one becomes the outline colour. */
function outline(c: HTMLCanvasElement, color = PAL.outline): HTMLCanvasElement {
  const ctx = c.getContext('2d')!;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const a = (x: number, y: number) => (x < 0 || y < 0 || x >= c.width || y >= c.height ? 0 : img.data[(y * c.width + x) * 4 + 3]!);
  const edge: [number, number][] = [];
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (a(x, y) > 0) continue;
    if (a(x - 1, y) > 128 || a(x + 1, y) > 128 || a(x, y - 1) > 128 || a(x, y + 1) > 128) edge.push([x, y]);
  }
  ctx.fillStyle = color;
  for (const [x, y] of edge) ctx.fillRect(x, y, 1, 1);
  return c;
}

/** Lighten (k > 0) or darken (k < 0) a hex colour. */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

// ---------- 3×5 pixel font (only the letters the signs use) ----------

const GLYPHS: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'], E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'], H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'], M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'], R: ['##.', '#.#', '##.', '#.#', '#.#'], S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'], ' ': ['.', '.', '.', '.', '.'], '?': ['##.', '..#', '.#.', '...', '.#.'], '.': ['.', '.', '.', '.', '#'],
};
const textWidth = (s: string) => [...s].reduce((w, ch) => w + GLYPHS[ch]![0]!.length + 1, -1);
function text(ctx: Ctx, s: string, x: number, y: number, color: string): void {
  for (const ch of s) {
    const g = GLYPHS[ch]!;
    g.forEach((row, gy) => [...row].forEach((v, gx) => v === '#' && px(ctx, x + gx, y + gy, color)));
    x += g[0]!.length + 1;
  }
}

/** A wooden sign board with pixel lettering. */
function sign(ctx: Ctx, cx: number, y: number, label: string): void {
  const w = textWidth(label) + 6;
  const x = Math.round(cx - w / 2);
  rect(ctx, x, y, w, 9, PAL.sandLight);
  rect(ctx, x, y + 8, w, 1, PAL.sandMid);
  text(ctx, label, x + 3, y + 2, PAL.dirtDeep);
}

// ---------- fish ----------

const STRIPES = new Set(['perch', 'walleye', 'zander', 'bass']);
const SPOTS = new Set(['trout', 'pike', 'ghostpike', 'salmon', 'crystaltrout', 'sturgeon']);

function fishColors(f: FishDef, variant: Variant | undefined, silhouette: boolean): [string, string, string] {
  if (silhouette) return ['#5b6478', '#5b6478', '#5b6478'];
  if (variant === 'golden') return [PAL.gold, PAL.goldLight, '#c88a10'];
  if (variant === 'shiny') return ['#e05ad0', '#9af0ff', '#7a5ae0'];
  return f.colors;
}

/** Crabs and lobsters aren't fish-shaped: drawn from little maps (b body, l belly, d claws/legs, w eye). */
const SHELL_MAPS: Record<string, string[]> = {
  crab: ['..d........d..', '.dd........dd.', '.d.d......d.d.', '...bb....bb...', '..bbbbbbbbbb..', '.bbbwbbbbwbbb.', '.bbbbbbbbbbbb.', '..llllllllll..', '.d.d.d..d.d.d.'],
  lobster: ['..........dd.ddd..', '...........dddd...', 'd.d.......bb......', 'dddbbbbbbbbbbw....', 'ddbbbbbbbbbbbbb...', 'dddbbbbbbbbbbw....', 'd.d.......bb......', '...........dddd...', '..........dd.ddd..'],
};
SHELL_MAPS.kingcrab = SHELL_MAPS.crab!;
SHELL_MAPS.spiny = SHELL_MAPS.lobster!;
/** Fish with a long bill on the nose (and a sail, for the sailfish). */
const BILLED = new Set(['sailfish', 'swordfish', 'marlin']);

function shellCanvas(f: FishDef, variant: Variant | undefined, silhouette: boolean): HTMLCanvasElement {
  const map = SHELL_MAPS[f.id]!;
  const [body, belly, fin] = fishColors(f, variant, silhouette);
  const k = f.id === 'kingcrab' ? 2 : 1; // the king crab is twice the size
  return outline(makeCanvas(map[0]!.length * k + 2, map.length * k + 2, (ctx) => {
    map.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const c = ch === 'b' ? body : ch === 'l' ? belly : ch === 'd' ? fin : silhouette ? body : PAL.outline;
      rect(ctx, 1 + x * k, 1 + y * k, k, k, c);
    }));
  }));
}

/** A side-on pixel fish facing right: tail, body with belly, fin, pattern, eye, outline. */
export function fishCanvas(f: FishDef, variant?: Variant, silhouette = false): HTMLCanvasElement {
  if (SHELL_MAPS[f.id]) return shellCanvas(f, variant, silhouette);
  const bill = BILLED.has(f.id) ? 7 : 0;
  const W = 11 + f.tier * 3 + (f.shape > 5 ? 6 : 0);
  const H = Math.max(4, Math.round((W / f.shape) * 1.25));
  const [body, belly, fin] = fishColors(f, variant, silhouette);
  const top = 3; // room above for the fin + outline
  return outline(makeCanvas(W + 2 + bill, H + top + 2, (ctx) => {
    const tw = Math.max(3, Math.round(W * 0.22));
    const x0 = tw - 1, x1 = W - 1;
    const bx = (x0 + x1) / 2 + 0.5, rx = (x1 - x0) / 2 + 0.5;
    const cy = H / 2, ry = H / 2;
    const inBody = (x: number, y: number) => ((x + 0.5 - bx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
    // Dorsal fin (two rows on bigger fish), then the forked tail.
    const finRows = f.id === 'sailfish' ? 3 : f.tier >= 3 ? 2 : 1;
    for (let r = 1; r <= finRows; r++) rect(ctx, 1 + Math.round(bx - rx * 0.35), top - r, Math.max(2, Math.round(rx * (0.7 - r * 0.15))), 1, fin);
    for (let x = 0; x < tw; x++) {
      const half = 1 + ((tw - x) / tw) * H * 0.45;
      for (let y = 0; y < H; y++) {
        const dy = Math.abs(y + 0.5 - cy);
        if (dy <= half && !(x === 0 && dy < 1)) px(ctx, x + 1, y + top, fin);
      }
    }
    // Body, belly, top highlight, pattern.
    for (let y = 0; y < H; y++) for (let x = x0; x <= x1; x++) {
      if (!inBody(x, y)) continue;
      let c = y + 0.5 > cy + ry * 0.2 ? belly : body;
      if (!inBody(x, y - 1)) c = silhouette ? c : shade(body, 0.25);
      const upper = y + 0.5 < cy;
      if (!silhouette && !variant) {
        if (STRIPES.has(f.id) && upper && (x - x0) % 3 === 1 && x < x1 - 2) c = shade(body, -0.3);
        if (SPOTS.has(f.id) && upper && (x * 3 + y * 5) % 7 === 0) c = f.id === 'ghostpike' || f.id === 'crystaltrout' ? PAL.white : shade(body, -0.35);
        if (f.id === 'koi' && ((x >> 2) + (y >> 1)) % 3 === 0) c = belly;
        if (f.id === 'eel' && Math.abs(y + 0.5 - cy) < 1) c = belly;
        if (f.id === 'riverdragon' && upper && x % 2 === 0) c = fin;
      }
      px(ctx, x + 1, y + top, c);
    }
    // Eye near the head.
    const ex = x1 + 1 - Math.max(2, Math.round(rx * 0.3)), ey = top + Math.floor(cy) - 1;
    if (W >= 20) px(ctx, ex - 1, ey, PAL.white);
    px(ctx, ex, ey, silhouette ? '#3a4050' : PAL.outline);
    // A long bill on the nose.
    if (bill) rect(ctx, x1 + 2, top + Math.floor(cy), bill, 1, silhouette ? body : shade(body, -0.25));
    // Catfish whiskers.
    if (f.id === 'catfish' && !silhouette) { px(ctx, x1 + 1, top + Math.ceil(cy) + 1, fin); px(ctx, x1 + 2, top + Math.ceil(cy) + 2, fin); }
  }));
}

// ---------- the fisherman ----------

export interface Outfit { shirt: string; trousers: string; boots?: string }
export type Pose = 'idle' | 'walk1' | 'walk2' | 'cast';

/** Fisherman facing right, 13×22 plus outline. Where his hand is (for the rod) is `HAND[pose]`. */
export function fisherCanvas(o: Outfit, pose: Pose): HTMLCanvasElement {
  return outline(makeCanvas(15, 24, (ctx) => {
    const X = 1, Y = 1;
    const r = (x: number, y: number, w: number, h: number, c: string) => rect(ctx, X + x, Y + y, w, h, c);
    // Legs and feet (walk frames swing them).
    const [back, front] = pose === 'walk1' ? [-1, 1] : pose === 'walk2' ? [1, -1] : [0, 0];
    r(3 + back, 16, 2, 4, o.trousers);
    r(7 + front, 16, 2, 4, o.trousers);
    const foot = o.boots ?? PAL.skin;
    r(3 + back, o.boots ? 18 : 20, 3, o.boots ? 3 : 1, foot);
    r(7 + front, o.boots ? 18 : 20, 3, o.boots ? 3 : 1, foot);
    // Trousers, shirt.
    r(3, 13, 6, 3, o.trousers);
    r(3, 7, 6, 6, o.shirt);
    r(3, 12, 6, 1, shade(o.shirt, -0.2));
    // Arm: forward holding the rod, or raised for the cast.
    if (pose === 'cast') { r(8, 6, 2, 3, o.shirt); r(9, 4, 2, 2, PAL.skin); } else { r(8, 8, 2, 3, o.shirt); r(9, 10, 2, 2, PAL.skin); }
    // Head, eye, straw hat with a red band.
    r(3, 3, 6, 4, PAL.skin);
    r(8, 4, 1, 2, PAL.skinDark);
    r(7, 4, 1, 1, PAL.outline);
    r(1, 2, 10, 1, PAL.goldLight);
    r(3, 0, 6, 2, PAL.goldLight);
    r(3, 1, 6, 1, PAL.red);
  }));
}
/** Hand position in the fisherman canvas, per pose. */
export const HAND: Record<Pose, { x: number; y: number }> = {
  idle: { x: 11, y: 11 }, walk1: { x: 11, y: 11 }, walk2: { x: 11, y: 11 }, cast: { x: 11, y: 5 },
};

// ---------- buildings ----------

/** A market stall: posts, plank counter with goods, striped scalloped awning, sign. */
export function stallCanvas(label: string, stripe: [string, string], trim: string, goods: 'fish' | 'tackle'): HTMLCanvasElement {
  const W = 48, H = 50;
  return outline(makeCanvas(W, H, (ctx) => {
    const awnY = 14, counterY = H - 16;
    sign(ctx, W / 2, 1, label);
    // Posts.
    rect(ctx, 4, awnY, 3, H - awnY - 1, PAL.dirtDark);
    rect(ctx, W - 7, awnY, 3, H - awnY - 1, PAL.dirtDark);
    // Counter with plank lines and a light top edge.
    rect(ctx, 2, counterY, W - 4, H - counterY - 1, PAL.dirt);
    for (let y = counterY + 4; y < H - 1; y += 4) rect(ctx, 2, y, W - 4, 1, PAL.dirtDark);
    rect(ctx, 1, counterY - 1, W - 2, 2, PAL.sand);
    if (goods === 'fish') {
      // Three crates with fish poking out.
      ['#9fc3d8', '#f0a868', '#c8d0a0'].forEach((c, i) => {
        const x = 7 + i * 12;
        rect(ctx, x, counterY - 6, 9, 5, PAL.sandMid);
        rect(ctx, x, counterY - 4, 9, 1, PAL.dirtDark);
        rect(ctx, x + 2, counterY - 8, 5, 2, c);
        px(ctx, x + 6, counterY - 8, PAL.outline);
      });
    } else {
      // Rods leaning on the counter and a blue tackle box.
      ['#c8b060', PAL.grey, '#303438', PAL.waterLight].forEach((c, i) => {
        for (let k = 0; k < 16; k++) px(ctx, 6 + i * 3 + Math.floor(k / 4), counterY - 1 - k, c);
      });
      rect(ctx, 28, counterY - 7, 13, 6, PAL.waterDeep);
      rect(ctx, 28, counterY - 7, 13, 1, PAL.water);
      rect(ctx, 33, counterY - 8, 3, 2, PAL.gold);
    }
    // Awning: trim, stripes, scalloped bottom edge.
    rect(ctx, 0, awnY - 3, W, 3, trim);
    for (let x = 0; x < W; x++) {
      const c = stripe[Math.floor(x / 6) % 2]!;
      const scallop = Math.round(Math.sin(((x % 6) / 6) * Math.PI) * 2);
      rect(ctx, x, awnY, 1, 6 + scallop, c);
    }
  }));
}

/** The Fishing School: a log cabin with a green roof, door, window and sign. */
export function schoolCanvas(): HTMLCanvasElement {
  const W = 42, H = 40;
  return outline(makeCanvas(W, H, (ctx) => {
    const wallTop = 18;
    // Log walls.
    rect(ctx, 4, wallTop, W - 8, H - wallTop - 1, PAL.dirt);
    for (let y = wallTop + 2; y < H - 1; y += 3) rect(ctx, 4, y, W - 8, 1, PAL.dirtDark);
    // Door and window.
    rect(ctx, W / 2 - 4, H - 14, 8, 13, PAL.dirtDeep);
    px(ctx, W / 2 + 2, H - 8, PAL.gold);
    rect(ctx, 8, wallTop + 4, 7, 6, PAL.outline);
    rect(ctx, 9, wallTop + 5, 5, 4, PAL.waterLight);
    rect(ctx, 11, wallTop + 5, 1, 4, PAL.outline);
    // Pitched roof.
    for (let y = 0; y < 15; y++) {
      const half = 3 + y * 1.35;
      rect(ctx, W / 2 - half, y + 4, half * 2, 1, y % 3 === 2 ? PAL.greenDark : PAL.green);
    }
    rect(ctx, 0, 18, W, 2, PAL.greenDark);
    sign(ctx, W / 2, 9, 'SCHOOL');
  }));
}

/** The Bait Shop: a small shack with a red roof, a worm barrel and a sign. */
export function baitShopCanvas(): HTMLCanvasElement {
  const W = 38, H = 38;
  return outline(makeCanvas(W, H, (ctx) => {
    const wallTop = 16;
    // Plank walls and a counter window.
    rect(ctx, 5, wallTop, W - 10, H - wallTop - 1, PAL.sand);
    for (let x = 8; x < W - 6; x += 4) rect(ctx, x, wallTop, 1, H - wallTop - 1, PAL.sandMid);
    rect(ctx, 9, wallTop + 5, W - 18, 7, PAL.dirtDeep);
    rect(ctx, 8, wallTop + 12, W - 16, 2, PAL.dirt);
    // Flat red roof with a striped edge.
    rect(ctx, 2, 10, W - 4, 6, PAL.red);
    for (let x = 2; x < W - 2; x += 4) rect(ctx, x, 14, 2, 2, PAL.redLight);
    rect(ctx, 2, 10, W - 4, 1, PAL.redLight);
    sign(ctx, W / 2, 1, 'BAIT');
    // A barrel of worms by the door.
    rect(ctx, W - 12, H - 9, 8, 8, PAL.dirtDark);
    rect(ctx, W - 12, H - 6, 8, 1, PAL.dirtDeep);
    rect(ctx, W - 11, H - 10, 6, 1, '#fc8bb0');
    px(ctx, W - 9, H - 11, '#fc8bb0');
  }));
}

export type HarborState = 'boarded' | 'forsale' | 'open';

/** The harbor office on the far bank: boarded up (teaser), for sale (revealed), or the Fishing Co. */
export function harborCanvas(state: HarborState): HTMLCanvasElement {
  const W = 44, H = 34;
  return outline(makeCanvas(W, H, (ctx) => {
    const wallTop = 14;
    const wall = state === 'boarded' ? PAL.greyDark : PAL.dirt;
    rect(ctx, 3, wallTop, W - 6, H - wallTop - 1, wall);
    for (let y = wallTop + 2; y < H - 1; y += 3) rect(ctx, 3, y, W - 6, 1, state === 'boarded' ? '#5f6578' : PAL.dirtDark);
    // Grey slate roof.
    for (let y = 0; y < 8; y++) rect(ctx, 1 + y, 6 + y, W - 2 - y * 2, 1, y % 3 === 2 ? '#5a6a7a' : '#7a8a9a');
    // Door: planks nailed across and a padlock, or open.
    const dx = W - 15;
    rect(ctx, dx, H - 13, 8, 12, state === 'open' ? '#2a2018' : PAL.dirtDeep);
    if (state === 'boarded') {
      for (let k = 0; k < 8; k++) { px(ctx, dx + k, H - 12 + k, PAL.sand); px(ctx, dx + 7 - k, H - 12 + k, PAL.sand); }
      rect(ctx, dx + 2, H - 7, 4, 3, PAL.gold);
      px(ctx, dx + 3, H - 9, PAL.greyMid); px(ctx, dx + 4, H - 9, PAL.greyMid);
    }
    // Window (dark when boarded).
    rect(ctx, 7, wallTop + 4, 8, 6, PAL.outline);
    rect(ctx, 8, wallTop + 5, 6, 4, state === 'boarded' ? '#30343e' : PAL.waterLight);
    if (state === 'boarded') rect(ctx, 6, wallTop + 6, 10, 2, PAL.sand);
    sign(ctx, W / 2, 0, state === 'boarded' ? '?' : state === 'forsale' ? 'FOR SALE' : 'FISH CO.');
  }));
}

export type BoatKind = 'net' | 'lobster' | 'sword';

/** A company boat: hull, cabin, its fishing gear (net boom / trap stack / outriggers), and one little head per crew member. */
export function boatCanvas(crew: number, silhouette = false, kind: BoatKind = 'net'): HTMLCanvasElement {
  const W = 40, H = 24;
  const c = (col: string) => (silhouette ? '#2b3a4a' : col);
  const canvas = makeCanvas(W, H, (ctx) => {
    // Hull: red below the waterline stripe, white above.
    for (let y = 0; y < 7; y++) rect(ctx, 2 + Math.floor(y / 2), 15 + y, W - 4 - Math.floor(y / 2) * 2 - (y > 3 ? 2 : 0), 1, c(y < 3 ? PAL.white : PAL.red));
    rect(ctx, 2, 17, W - 4, 1, c(PAL.waterDeeper));
    // Cabin and window.
    rect(ctx, 22, 8, 11, 7, c(PAL.white));
    rect(ctx, 21, 7, 13, 2, c(PAL.waterDeep));
    rect(ctx, 25, 10, 5, 3, c(PAL.waterLight));
    if (kind === 'net') {
      // Mast and net boom with a hanging net.
      rect(ctx, 12, 1, 1, 14, c(PAL.dirtDeep));
      for (let k = 0; k < 9; k++) px(ctx, 12 - k, 1 + k, c(PAL.dirtDark));
      for (let y = 9; y < 15; y++) for (let x = 3; x < 7; x++) if ((x + y) % 2 === 0) px(ctx, x, y, c(PAL.sand));
    } else if (kind === 'lobster') {
      // A stack of wooden lobster traps and a buoy.
      for (const [x, y] of [[3, 10], [9, 10], [6, 5]] as const) {
        rect(ctx, x, y, 6, 5, c(PAL.dirt));
        for (let k = 1; k < 6; k += 2) rect(ctx, x + k, y, 1, 5, c(PAL.dirtDeep));
      }
      rect(ctx, 16, 9, 3, 4, c(PAL.goldLight));
      rect(ctx, 16, 11, 3, 1, c(PAL.red));
    } else {
      // Two tall outrigger poles and a big line reel.
      for (let k = 0; k < 14; k++) { px(ctx, 14 - Math.floor(k / 3), 14 - k, c(PAL.greyDark)); px(ctx, 18 + Math.floor(k / 3), 14 - k, c(PAL.greyDark)); }
      rect(ctx, 4, 10, 6, 5, c(PAL.greyMid));
      rect(ctx, 5, 11, 4, 3, c(PAL.white));
      rect(ctx, 6, 12, 2, 1, c(PAL.outline));
    }
    // Crew: a straw hat and a face each, on deck.
    for (let k = 0; k < crew; k++) {
      const x = 15 + k * 3 - (k >= 2 ? 10 : 0);
      rect(ctx, x, 12, 2, 2, c(PAL.skin));
      rect(ctx, x - 1 + (k % 2), 11, 3, 1, c(PAL.goldLight));
    }
  });
  return outline(canvas, silhouette ? '#1d2834' : PAL.outline);
}

/** One stretch of dock planks (tiles vertically). */
export function plankCanvas(w: number): HTMLCanvasElement {
  return makeCanvas(w, 4, (ctx) => {
    rect(ctx, 0, 0, w, 3, PAL.sand);
    rect(ctx, 0, 3, w, 1, PAL.dirtDark);
    px(ctx, 2, 1, PAL.dirtDark);
    px(ctx, w - 3, 1, PAL.dirtDark);
    rect(ctx, 0, 0, 1, 4, PAL.outline);
    rect(ctx, w - 1, 0, 1, 4, PAL.outline);
  });
}

export function bobberCanvas(): HTMLCanvasElement {
  return outline(makeCanvas(5, 6, (ctx) => {
    rect(ctx, 1, 1, 3, 2, PAL.white);
    rect(ctx, 1, 3, 3, 2, PAL.red);
  }));
}

/** The "!" over a biting bobber. */
export function alertCanvas(): HTMLCanvasElement {
  return outline(makeCanvas(5, 10, (ctx) => {
    rect(ctx, 1, 1, 3, 5, PAL.gold);
    rect(ctx, 1, 7, 3, 2, PAL.gold);
    rect(ctx, 1, 1, 3, 1, PAL.goldLight);
  }));
}

/** A small rod standing in a holder (one per extra line). */
export function holderCanvas(): HTMLCanvasElement {
  return outline(makeCanvas(6, 7, (ctx) => {
    rect(ctx, 1, 1, 4, 5, PAL.dirtDark);
    rect(ctx, 1, 1, 4, 1, PAL.dirt);
  }));
}

const iconCache = new Map<string, string>();
/** A fish as a crisp, scaled-up pixel icon (data URL) for the HUD. */
export function pixelFishIcon(f: FishDef, silhouette = false, w = 96, h = 56, variant?: Variant): string {
  const key = `${f.id}:${silhouette}:${w}x${h}:${variant ?? ''}`;
  let url = iconCache.get(key);
  if (!url) {
    const src = fishCanvas(f, variant, silhouette);
    const scale = Math.max(1, Math.floor(Math.min((w * 2) / src.width, (h * 2) / src.height)));
    const c = makeCanvas(w * 2, h * 2, (ctx) => {
      ctx.drawImage(src, Math.round(w - (src.width * scale) / 2), Math.round(h - (src.height * scale) / 2), src.width * scale, src.height * scale);
    });
    url = c.toDataURL();
    iconCache.set(key, url);
  }
  return url;
}

// ---------- UI icons (replace emojis; same palette and outline as the sprites) ----------

const ICON_COLORS: Record<string, string> = {
  o: PAL.outline, y: PAL.gold, Y: PAL.goldLight, b: PAL.dirtDark, B: PAL.dirt, w: PAL.white, k: PAL.greyMid, K: PAL.greyDark,
  r: PAL.red, p: '#fc8bb0', v: '#7a4a8a', u: PAL.waterDeep, U: PAL.waterLight, s: PAL.skin, g: PAL.green, G: PAL.greenLight,
};
const ICON_ROWS = {
  coin: ['..oooo..', '.oYYYyo.', 'oYYyyyyo', 'oYyYyyyo', 'oYyYyyyo', 'oyyyyyyo', '.oyyyyo.', '..oooo..'],
  trophy: ['oo.oooo.oo', 'oyoYyyyoyo', 'oyoYyyyoyo', '.ooYyyyoo.', '..oyyyyo..', '...oyyo...', '....oo....', '...oyyo...', '..oooooo..', '..oyyyyo..', '..oooooo..'],
  book: ['.oooo.oooo.', 'owwwwowwwwo', 'owkkwowkkwo', 'owwwwowwwwo', 'owkkwowkkwo', 'owwwwowwwwo', 'orrrrorrrro', '.oooo.oooo.'],
  bell: ['....o....', '...oyo...', '..oYyyo..', '.oYyyyyo.', '.oYyyyyo.', '.oYyyyyo.', 'oYyyyyyyo', 'ooooooooo', '...oyo...', '....o....'],
  menu: ['ooooooooo', 'owwwwwwwo', 'ooooooooo', '.........', 'ooooooooo', 'owwwwwwwo', 'ooooooooo', '.........', 'ooooooooo', 'owwwwwwwo', 'ooooooooo'],
  rod: ['.........o', '........ok', '.......ok.', '......ok..', '.....ok...', '....oB....', '..koBb....', '.kKobb....', '..kbb.....', '.obb......', 'obb.......'],
  holder: ['.o...o...o', 'ok..ok..ok', 'ok..ok..ok', 'ok..ok..ok', 'ok..ok..ok', 'ok..ok..ok', 'ob..ob..ob', 'oBBBBBBBBo', 'obbbbbbbbo', 'oooooooooo'],
  auto: ['....o....', '...oyo...', '.ooooooo.', 'okkkkkkko', 'okUkkkUko', 'okkkkkkko', 'okkoookko', '.ooooooo.', '..okkko..', '.ookkkoo.'],
  bait: ['.oo.......', 'oppo..oo..', 'opo.oppo..', 'oppoppo...', '.oppoo....', '..oo......'],
  shirt: ['.ooo..ooo.', 'orrrooorro', 'orrrrrrrro', '.oorrrroo.', '..orrrro..', '..orrrro..', '..orrrro..', '..oooooo..'],
  boot: ['.oooo....', '.oBBo....', '.oBBo....', '.oBBo....', '.oBBo....', '.oBBBooo.', '.oBBBBBBo', '.obbbbbbo', '.oooooooo'],
  hook: ['...ooo...', '..okkko..', '...oko...', '...oko...', '...oko...', 'o..oko...', 'oo.oko...', 'okokko...', '.okkoo...', '..oo.....'],
  bolt: ['....ooo.', '...oyyo.', '..oyyo..', '.oyyyooo', 'ooooyyyo', '...oyyo.', '..oyyo..', '..oyo...', '.oyo....', '.oo.....'],
  bag: ['...ooo...', '..oBBBo..', '...oBo...', '..oBBBo..', '.oBBBBBo.', 'oBByyyBBo', 'oBByBBBBo', 'oBBByyBBo', 'oBBBBByBo', 'oBByyyBBo', '.oBBBBBo.', '..ooooo..'],
  fist: ['..oo......', '.osso.....', '.osso..oo.', '.osso.osso', '.ossoossso', '.osssssso.', '..oSssso..', '..osssso..', '...oooo...'],
  close: ['oo...oo', 'owo.owo', '.owowo.', '..owo..', '.owowo.', 'owo.owo', 'oo...oo'],
  check: ['......oo', '.....ogo', 'oo..ogo.', 'ogoogo..', '.oggo...', '..oo....'],
  star: ['....o....', '...oyo...', 'oooyYyooo', 'oyyYYYyyo', '.oyyyyyo.', '..oyyyo..', '.oyyoyyo.', '.oyo.oyo.', '.oo...oo.'],
  cricket: ['..o....o..', '...o..o...', '.ooooooo..', 'oGGGgGGGoo', 'oggggggGGo', '.oooooooo.', '.o.o..o.o.'],
  shiner: ['...ooo....', 'o.okkkoo..', 'ookkkkkwo.', 'okwwwwkkoo', 'oo.ooooo..'],
  leech: ['.oo.......', 'ovvoo.oo..', 'ovvvvovvo.', '.oovvvvvvo', '...oooooo.'],
  glow: ['...o.....', '..oUo....', '.oUUUo...', 'oUUwUUo..', 'oUUUUUo..', '.oUuUo...', '..ouo....', '...o.....', '..ooo....', '..o.o....'],
  gold: ['...o.....', '..oYo....', '.oYYyo...', 'oYYwyyo..', 'oYyyyyo..', '.oyyyo...', '..oyo....', '...o.....', '..ooo....', '..o.o....'],
  lock: ['..ooo..', '.ok.ko.', '.ok.ko.', 'ooooooo', 'oyyyyyo', 'oyyoyyo', 'oyyoyyo', 'oyyyyyo', 'ooooooo'],
  letter: ['ooooooooooo', 'owowwwwwowo', 'owwowwwowwo', 'owwwowowwwo', 'owwwwowwwwo', 'owwwwrwwwwo', 'owwwwwwwwwo', 'ooooooooooo'],
  boat: ['.....o.....', '.....ok....', '.....okk...', '.....okkk..', '.....o.....', 'ooooooooooo', 'orwwwwwwwro', '.orrrrrrro.', '..ooooooo..'],
  crew: ['..ooo..', '.oYYYo.', 'oooooooo'.slice(0, 7), '.osso..'.slice(0, 7), '.ossso.', '..ooo..', '.orrro.', 'orrrrro', 'ooooooo'],
  net: ['o.o.o.o.o', '.o.o.o.o.', 'o.o.o.o.o', '.o.o.o.o.', 'o.o.o.o.o', '.o.o.o.o.', 'o.o.o.o.o'],
  fish: ['...ooo....', 'o.oUUUo...', 'oouUUUUo..', 'ouuuuuowo.', 'oouuuuuoo.', 'o.ouuuo...', '...ooo....'],
};
export type IconName = keyof typeof ICON_ROWS;

const iconUrls = new Map<string, string>();
/** A UI icon as a crisp data URL, `scale` screen pixels per art pixel. */
export function pixelIcon(name: IconName, scale = 3): string {
  const key = `${name}:${scale}`;
  let url = iconUrls.get(key);
  if (!url) {
    const rows = ICON_ROWS[name];
    url = makeCanvas(rows[0]!.length * scale, rows.length * scale, (ctx) => {
      rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === '.') return;
        rect(ctx, x * scale, y * scale, scale, scale, ch === 'S' ? PAL.skinDark : ICON_COLORS[ch]!);
      }));
    }).toDataURL();
    iconUrls.set(key, url);
  }
  return url;
}
