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
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'], D: ['##.', '#.#', '#.#', '#.#', '##.'], G: ['.##', '#..', '#.#', '#.#', '.##'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'], P: ['##.', '#.#', '##.', '#..', '#..'], U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'], Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  '<': ['..#', '.#.', '#..', '.#.', '..#'], '>': ['#..', '.#.', '..#', '.#.', '#..'], R: ['##.', '#.#', '##.', '#.#', '#.#'], S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'], ' ': ['.', '.', '.', '.', '.'], '?': ['##.', '..#', '.#.', '...', '.#.'], '.': ['.', '.', '.', '.', '#'],
};
/** A letter's pixels (unknown characters draw as a space rather than breaking the sign). */
const glyph = (ch: string) => GLYPHS[ch] ?? GLYPHS[' ']!;
const textWidth = (s: string) => [...s].reduce((w, ch) => w + glyph(ch)[0]!.length + 1, -1);
function text(ctx: Ctx, s: string, x: number, y: number, color: string): void {
  for (const ch of s) {
    const g = glyph(ch);
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

/** What a boat's upgrades look like on deck. */
export interface BoatLook { hull: number; engine: number; sonar: number; ice: number; captain: number }
const PLAIN: BoatLook = { hull: 0, engine: 0, sonar: 0, ice: 0, captain: 0 };

/**
 * A company boat: hull (longer per hull level), cabin, its fishing gear (net
 * boom / trap stack / outriggers), and the upgrades you can see: a sonar dish,
 * an ice box, an exhaust stack, a captain at the wheel, one head per deckhand.
 */
export function boatCanvas(crew: number, silhouette = false, kind: BoatKind = 'net', look: BoatLook = PLAIN): HTMLCanvasElement {
  const ext = look.hull * 4; // each hull level adds 4 px of boat
  const W = 40 + ext, H = 26;
  const c = (col: string) => (silhouette ? '#2b3a4a' : col);
  const canvas = makeCanvas(W, H, (ctx) => {
    // Hull: white topsides, red below the waterline stripe.
    for (let y = 0; y < 7; y++) rect(ctx, 2 + Math.floor(y / 2), 17 + y, W - 4 - Math.floor(y / 2) * 2 - (y > 3 ? 2 : 0), 1, c(y < 3 ? PAL.white : PAL.red));
    rect(ctx, 2, 19, W - 4, 1, c(PAL.waterDeeper));
    // Cabin (moves aft as the hull grows) with its window, and the captain inside.
    const cx = 22 + ext;
    rect(ctx, cx, 10, 11, 7, c(PAL.white));
    rect(ctx, cx - 1, 9, 13, 2, c(PAL.waterDeep));
    rect(ctx, cx + 3, 12, 5, 3, c(PAL.waterLight));
    if (look.captain) { rect(ctx, cx + 4, 13, 2, 2, c(PAL.skin)); rect(ctx, cx + 3, 12, 4, 1, c(PAL.outline)); px(ctx, cx + 4, 11, c(PAL.white)); }
    // Sonar dish on the roof; exhaust stack for a strong engine.
    if (look.sonar) { rect(ctx, cx + 8, 6, 1, 3, c(PAL.greyDark)); rect(ctx, cx + 6, 4, 5, 2, c(PAL.grey)); if (look.sonar >= 3) px(ctx, cx + 8, 3, c(PAL.red)); }
    if (look.engine >= 2) { rect(ctx, cx + 1, 5, 2, 4, c(PAL.greyDark)); rect(ctx, cx + 1, 5, 2, 1, c(PAL.red)); }
    // Ice box on deck (bigger with more ice).
    if (look.ice) { const w = 4 + Math.min(look.ice, 3) * 2; rect(ctx, cx - w - 2, 13, w, 4, c(PAL.white)); rect(ctx, cx - w - 2, 15, w, 1, c(PAL.waterLight)); }
    const gx = 0; // gear sits at the bow end
    if (kind === 'net') {
      rect(ctx, gx + 12, 3, 1, 14, c(PAL.dirtDeep));
      for (let k = 0; k < 9; k++) px(ctx, gx + 12 - k, 3 + k, c(PAL.dirtDark));
      for (let y = 11; y < 17; y++) for (let x = gx + 3; x < gx + 7; x++) if ((x + y) % 2 === 0) px(ctx, x, y, c(PAL.sand));
    } else if (kind === 'lobster') {
      for (const [x, y] of [[3, 12], [9, 12], [6, 7]] as const) {
        rect(ctx, x, y, 6, 5, c(PAL.dirt));
        for (let k = 1; k < 6; k += 2) rect(ctx, x + k, y, 1, 5, c(PAL.dirtDeep));
      }
      rect(ctx, 16, 11, 3, 4, c(PAL.goldLight));
      rect(ctx, 16, 13, 3, 1, c(PAL.red));
    } else {
      for (let k = 0; k < 14; k++) { px(ctx, 14 - Math.floor(k / 3), 16 - k, c(PAL.greyDark)); px(ctx, 18 + Math.floor(k / 3), 16 - k, c(PAL.greyDark)); }
      rect(ctx, 4, 12, 6, 5, c(PAL.greyMid));
      rect(ctx, 5, 13, 4, 3, c(PAL.white));
      rect(ctx, 6, 14, 2, 1, c(PAL.outline));
    }
    // Deckhands: a straw hat and a face each, spread along the deck.
    for (let k = 0; k < crew; k++) {
      const x = 15 + ((k * 5) % Math.max(6, ext + 6)) + (k >= 3 ? 2 : 0);
      rect(ctx, x, 14, 2, 2, c(PAL.skin));
      rect(ctx, x - 1 + (k % 2), 13, 3, 1, c(PAL.goldLight));
    }
  });
  return outline(canvas, silhouette ? '#1d2834' : PAL.outline);
}

/** The company warehouse next to the harbor office (bought for earnings while away). */
export function warehouseCanvas(): HTMLCanvasElement {
  return outline(makeCanvas(30, 24, (ctx) => {
    rect(ctx, 1, 8, 28, 15, PAL.greyMid);
    for (let x = 3; x < 29; x += 3) rect(ctx, x, 8, 1, 15, PAL.greyDark);
    for (let y = 0; y < 7; y++) rect(ctx, 1 + y, 1 + y, 28 - y * 2, 1, PAL.red);
    rect(ctx, 10, 13, 10, 10, PAL.dirtDeep);
    rect(ctx, 10, 13, 10, 1, PAL.dirt);
  }));
}

/** A cargo crane on the harbor pier (comes with the Harbor Master). */
export function craneCanvas(): HTMLCanvasElement {
  return outline(makeCanvas(26, 34, (ctx) => {
    rect(ctx, 4, 6, 3, 27, PAL.gold);
    for (let y = 8; y < 33; y += 4) px(ctx, 5, y, PAL.dirtDeep);
    rect(ctx, 2, 4, 23, 3, PAL.gold);
    rect(ctx, 0, 30, 11, 3, PAL.greyDark);
    rect(ctx, 21, 7, 1, 12, PAL.outline);
    rect(ctx, 18, 19, 7, 5, PAL.waterDeep);
  }));
}

// ---------- the town ----------

/** The Processing Plant: a brick factory with two chimneys, a loading door and a sign. */
export function plantCanvas(): HTMLCanvasElement {
  const W = 64, H = 50;
  return outline(makeCanvas(W, H, (ctx) => {
    rect(ctx, 2, 18, W - 4, H - 19, '#a04a3a');
    for (let y = 21; y < H - 1; y += 3) for (let x = 2 + ((y / 3) % 2) * 3; x < W - 2; x += 6) rect(ctx, x, y, 1, 1, '#7a3428');
    // Saw-tooth roof.
    for (let k = 0; k < 4; k++) for (let y = 0; y < 6; y++) rect(ctx, 2 + k * 15, 12 + y, 15 - y * 2 + 2, 1, y < 2 ? PAL.greyMid : PAL.greyDark);
    rect(ctx, 6, 0, 6, 14, '#7a3428'); rect(ctx, 6, 0, 6, 2, PAL.greyDark);
    rect(ctx, 50, 4, 6, 10, '#7a3428'); rect(ctx, 50, 4, 6, 2, PAL.greyDark);
    // A long window onto the production floor (the conveyor is drawn over it), loading door.
    rect(ctx, 5, 22, 54, 9, PAL.outline); rect(ctx, 6, 23, 52, 7, '#3d4357');
    rect(ctx, 6, 28, 52, 1, PAL.greyMid);
    for (let x = 8; x < 58; x += 6) rect(ctx, x, 29, 1, 1, PAL.greyDark);
    rect(ctx, 26, 32, 12, 17, PAL.greyDark);
    for (let y = 34; y < 49; y += 3) rect(ctx, 26, y, 12, 1, PAL.greyMid);
    sign(ctx, W / 2, 20, 'PLANT');
  }));
}

/** The Export Office: a little office with stacked shipping containers. */
export function exportCanvas(): HTMLCanvasElement {
  const W = 52, H = 40;
  return outline(makeCanvas(W, H, (ctx) => {
    // Containers.
    ([[0, 26, '#2f6fd6'], [0, 18, '#dd442c'], [14, 26, '#2eb082'], [36, 26, '#f4b41b'], [36, 18, '#2f6fd6']] as const).forEach(([x, y, c]) => {
      rect(ctx, x, y, 15, 8, c);
      for (let k = 2; k < 15; k += 3) rect(ctx, x + k, y + 1, 1, 6, shade(c, -0.25));
    });
    // Office.
    rect(ctx, 16, 10, 20, 16, PAL.sand);
    rect(ctx, 14, 8, 24, 3, PAL.dirtDeep);
    rect(ctx, 23, 17, 6, 9, PAL.dirtDeep);
    rect(ctx, 18, 13, 4, 4, PAL.waterLight); rect(ctx, 30, 13, 4, 4, PAL.waterLight);
    sign(ctx, W / 2, 0, 'EXPORT');
  }));
}

/**
 * Where things are on each restaurant look, relative to the sprite's bottom
 * centre: the door (or the cart's hatch) customers walk to, the outside table
 * a diner sits at (none on the cart), the window the SOLD OUT board hangs on.
 */
export interface RestaurantSpots { w: number; h: number; door: number; table: number | null; window: { x: number; y: number } }
export const RESTAURANT_SPOTS: RestaurantSpots[] = [
  { w: 34, h: 32, door: 0, table: null, window: { x: 0, y: 13 } },
  { w: 44, h: 40, door: 12, table: -14, window: { x: -7, y: 13 } },
  { w: 56, h: 44, door: 18, table: -24, window: { x: -1, y: 15 } },
  { w: 56, h: 58, door: 18, table: -24, window: { x: -1, y: 15 } },
  { w: 64, h: 66, door: 20, table: -28, window: { x: 0, y: 15 } },
];

/** Striped awning across [x, x+w) at row y. */
function awning(ctx: Ctx, x: number, y: number, w: number, color: string): void {
  rect(ctx, x, y, w, 2, shade(color, -0.25));
  for (let k = 0; k < w; k++) rect(ctx, x + k, y + 2, 1, 3 + (Math.floor(k / 4) % 2), Math.floor(k / 4) % 2 ? color : PAL.white);
}

/** The ground floor of a shop: wall, awning, big lit window, door. Bottom at y0 + 22. */
function shopFloor(ctx: Ctx, x: number, w: number, y0: number, color: string, doorX: number, winX: number, winW: number): void {
  rect(ctx, x, y0, w, 22, PAL.sandLight);
  awning(ctx, x - 1, y0, w + 2, color);
  rect(ctx, winX, y0 + 8, winW, 10, PAL.outline); rect(ctx, winX + 1, y0 + 9, winW - 2, 8, PAL.goldLight);
  rect(ctx, winX + 1, y0 + 9, winW - 2, 2, '#fff3b0');
  rect(ctx, doorX, y0 + 8, 9, 14, shade(color, -0.35)); px(ctx, doorX + 7, y0 + 15, PAL.gold);
}

/** A café table with two stools. */
function table(ctx: Ctx, x: number, y: number): void {
  rect(ctx, x, y, 10, 2, PAL.dirtDark); rect(ctx, x + 4, y + 2, 2, 3, PAL.dirtDark);
  rect(ctx, x - 3, y + 3, 2, 2, PAL.dirtDeep); rect(ctx, x + 11, y + 3, 2, 2, PAL.dirtDeep);
}

/**
 * A restaurant at one of its five looks: 0 food cart, 1 shop, 2 shop with a
 * terrace, 3 two floors with a balcony and a lit sign, 4 a landmark with a
 * gold fish on the roof. Sizes in RESTAURANT_SPOTS; anchored bottom-centre.
 */
export function restaurantCanvas(label: string, color: string, tier = 1): HTMLCanvasElement {
  const S = RESTAURANT_SPOTS[tier]!, W = S.w, H = S.h, B = H - 1;
  return outline(makeCanvas(W, H, (ctx) => {
    if (tier === 0) {
      // Food cart: umbrella, counter, wheels, name on the front.
      rect(ctx, 16, 7, 2, 12, PAL.greyDark);
      for (let y = 0; y < 6; y++) rect(ctx, 6 - y, 2 + y, 22 + y * 2, 1, y % 2 ? color : PAL.white);
      for (let x = 1; x < 33; x += 6) rect(ctx, x, 8, 3, 1, color);
      rect(ctx, 3, 17, 28, 9, PAL.sandLight); rect(ctx, 3, 17, 28, 2, shade(color, -0.2));
      rect(ctx, 6, 14, 8, 3, PAL.greyMid); rect(ctx, 20, 15, 6, 2, PAL.gold);
      text(ctx, label.slice(0, 5), 17 - Math.floor(textWidth(label.slice(0, 5)) / 2), 20, PAL.dirtDeep);
      for (const x of [8, 25]) { rect(ctx, x - 2, B - 5, 5, 5, PAL.outline); rect(ctx, x - 1, B - 4, 3, 3, PAL.greyMid); }
      return;
    }
    if (tier === 1) {
      shopFloor(ctx, 2, W - 4, H - 23, color, 30, 5, 20);
      table(ctx, 5, H - 6);
      sign(ctx, W / 2, H - 31, label);
      return;
    }
    // Tiers 2-4: shop on the right, terrace on the left.
    const shopX = tier === 4 ? 18 : 16, ground = H - 23;
    // Terrace: low fence, a big umbrella over the table.
    rect(ctx, 1, B - 5, shopX - 2, 1, PAL.dirtDark);
    for (let x = 1; x < shopX - 1; x += 3) rect(ctx, x, B - 5, 1, 5, PAL.dirtDark);
    rect(ctx, 8, ground + 2, 1, 14, PAL.greyDark);
    for (let y = 0; y < 4; y++) rect(ctx, 6 - y * 2, ground - 1 + y, 6 + y * 4, 1, y % 2 ? PAL.white : color);
    table(ctx, 3, B - 4);
    shopFloor(ctx, shopX, W - shopX - 1, ground, color, W - 13, shopX + 4, W - shopX - 20);
    if (tier === 2) {
      // Flower boxes under the window, the sign on the roof.
      for (let x = shopX + 4; x < W - 16; x += 4) { rect(ctx, x, ground + 18, 3, 2, PAL.dirtDark); px(ctx, x + 1, ground + 17, PAL.redLight); }
      sign(ctx, shopX + (W - shopX) / 2, ground - 9, label);
      return;
    }
    // Upper floor(s): wall, windows, balcony rail.
    const floors = tier === 4 ? 2 : 1, up = ground - floors * 14;
    rect(ctx, shopX, up, W - shopX - 1, floors * 14, shade(color, 0.55));
    for (let f = 0; f < floors; f++) {
      for (let x = shopX + 3; x < W - 6; x += 9) { rect(ctx, x, up + 3 + f * 14, 5, 7, PAL.outline); rect(ctx, x + 1, up + 4 + f * 14, 3, 5, f % 2 ? PAL.waterLight : PAL.goldLight); }
    }
    rect(ctx, shopX - 1, ground - 2, W - shopX + 1, 1, PAL.greyDark);
    for (let x = shopX; x < W - 1; x += 3) rect(ctx, x, ground - 4, 1, 2, PAL.greyDark);
    // Roof line, the lit sign (its letters in the shop colour on dark), and on the landmark a gold fish.
    rect(ctx, shopX - 2, up - 2, W - shopX + 3, 2, PAL.dirtDeep);
    const sw = textWidth(label) + 6, sx = Math.round(shopX + (W - shopX - sw) / 2);
    rect(ctx, sx, up - 10, sw, 8, PAL.outline);
    text(ctx, label, sx + 3, up - 8, tier === 4 ? PAL.gold : PAL.goldLight);
    if (tier === 4) {
      const fx = shopX - 6, fy = up - 6;
      rect(ctx, fx, fy, 10, 5, PAL.gold); rect(ctx, fx + 10, fy + 1, 3, 3, PAL.gold); rect(ctx, fx - 3, fy - 1, 3, 2, PAL.gold); rect(ctx, fx - 3, fy + 4, 3, 2, PAL.gold);
      px(ctx, fx + 2, fy + 1, PAL.outline); rect(ctx, fx + 3, fy + 3, 5, 1, PAL.goldLight);
      rect(ctx, fx + 4, fy + 5, 2, ground - fy - 5, PAL.greyDark);
      // String lights along the terrace.
      for (let x = 1; x < shopX; x += 3) px(ctx, x, ground - 3 + (x % 2), x % 6 === 1 ? PAL.redLight : PAL.goldLight);
    }
  }));
}

/** A gold coin, for the till bursts. */
export function coinCanvas(): HTMLCanvasElement {
  return outline(makeCanvas(8, 8, (ctx) => {
    rect(ctx, 2, 1, 4, 6, PAL.gold); rect(ctx, 1, 2, 6, 4, PAL.gold);
    rect(ctx, 2, 2, 2, 2, PAL.goldLight); rect(ctx, 5, 4, 1, 2, '#c8890f');
  }));
}

/** How a townsperson looks. */
export interface WalkerLook { shirt: string; trousers: string; hair: string }
export type WalkerPose = 'stand' | 'walk1' | 'walk2' | 'sit';

/** A townsperson facing right, 7×13 plus outline: hair, face, shirt, trousers, legs that swing; or seated. */
export function walkerCanvas(o: WalkerLook, pose: WalkerPose): HTMLCanvasElement {
  return outline(makeCanvas(9, 15, (ctx) => {
    const r = (x: number, y: number, w: number, h: number, c: string) => rect(ctx, 1 + x, 1 + y, w, h, c);
    if (pose === 'sit') { r(1, 9, 6, 2, o.trousers); r(5, 11, 2, 2, o.trousers); }
    else {
      const [a, b] = pose === 'walk1' ? [-1, 1] : pose === 'walk2' ? [1, -1] : [0, 0];
      r(1 + a, 10, 2, 3, o.trousers); r(4 + b, 10, 2, 3, o.trousers);
    }
    r(1, 5, 5, 5, o.shirt); r(1, 9, 5, 1, shade(o.shirt, -0.25));
    r(5, 6, 1, 3, PAL.skin);
    r(2, 1, 4, 4, PAL.skin); r(5, 2, 1, 1, PAL.outline);
    r(1, 0, 5, 2, o.hair); r(1, 2, 1, 2, o.hair);
  }));
}

export type Vehicle = 'fish' | 'van' | 'market' | 'lorry';

/** Town traffic, facing right: fish truck (crates on the bed when loaded), delivery van, market box truck, export lorry. */
export function vehicleCanvas(kind: Vehicle, loaded = true): HTMLCanvasElement {
  const W = kind === 'lorry' ? 44 : kind === 'van' ? 24 : 30, H = kind === 'lorry' ? 19 : 17;
  return outline(makeCanvas(W, H, (ctx) => {
    const wheel = (x: number) => { rect(ctx, x - 2, H - 5, 5, 4, PAL.outline); rect(ctx, x - 1, H - 4, 3, 2, PAL.greyMid); };
    const cab = (x: number, w: number, color: string) => {
      rect(ctx, x, H - 13, w, 9, color); rect(ctx, x, H - 13, w, 1, shade(color, 0.3));
      rect(ctx, x + w - 4, H - 12, 3, 4, PAL.waterLight); rect(ctx, x + w - 1, H - 7, 1, 2, PAL.goldLight);
    };
    if (kind === 'fish') {
      rect(ctx, 1, H - 9, 20, 5, PAL.dirtDark); rect(ctx, 1, H - 9, 20, 1, PAL.dirt);
      if (loaded) for (const x of [2, 8, 14]) { rect(ctx, x, H - 14, 6, 5, PAL.sandLight); rect(ctx, x, H - 12, 6, 1, PAL.sandMid); rect(ctx, x + 2, H - 15, 2, 1, PAL.waterLight); }
      cab(21, 8, '#2f6fd6');
      wheel(6); wheel(24);
    } else if (kind === 'van') {
      rect(ctx, 1, H - 14, 22, 10, PAL.white); rect(ctx, 1, H - 6, 22, 2, PAL.grey);
      rect(ctx, 17, H - 13, 4, 4, PAL.waterLight);
      rect(ctx, 4, H - 11, 8, 3, PAL.waterDeep); rect(ctx, 12, H - 10, 2, 1, PAL.waterDeep);
      wheel(5); wheel(18);
    } else if (kind === 'market') {
      rect(ctx, 1, H - 16, 20, 12, PAL.green); rect(ctx, 1, H - 16, 20, 1, PAL.greenLight);
      for (let x = 4; x < 20; x += 4) rect(ctx, x, H - 14, 1, 9, shade(PAL.green, -0.2));
      cab(21, 8, PAL.redLight);
      wheel(6); wheel(24);
    } else {
      rect(ctx, 1, H - 17, 32, 12, '#dd442c');
      for (let x = 3; x < 32; x += 3) rect(ctx, x, H - 16, 1, 10, '#a8321f');
      rect(ctx, 1, H - 5, 32, 1, PAL.greyDark);
      cab(33, 10, PAL.gold);
      wheel(6); wheel(14); wheel(38);
    }
  }));
}

/** SOLD OUT board hung over a restaurant window. */
export function soldOutCanvas(): HTMLCanvasElement {
  const w = textWidth('SOLD OUT') + 6;
  return outline(makeCanvas(w + 2, 9, (ctx) => {
    rect(ctx, 1, 1, w, 7, PAL.red);
    text(ctx, 'SOLD OUT', 4, 2, PAL.white);
  }));
}

/** A speech bubble with a red X (a customer who found nothing to eat). */
export function bubbleCanvas(): HTMLCanvasElement {
  return outline(makeCanvas(9, 10, (ctx) => {
    rect(ctx, 1, 1, 7, 6, PAL.white); rect(ctx, 2, 7, 2, 1, PAL.white);
    for (let k = 0; k < 4; k++) { px(ctx, 2 + k, 2 + k, PAL.red); px(ctx, 5 - k, 2 + k, PAL.red); }
  }));
}

/** An empty lot with a FOR SALE board. */
export function lotCanvas(): HTMLCanvasElement {
  const W = 44, H = 40;
  return makeCanvas(W, H, (ctx) => {
    rect(ctx, 2, 34, W - 4, 5, PAL.dirt);
    for (let x = 4; x < W - 4; x += 5) rect(ctx, x, 35, 2, 1, PAL.dirtDark);
    rect(ctx, 20, 22, 2, 13, PAL.dirtDark);
    sign(ctx, 21, 14, 'FOR SALE');
  });
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
  up: ['...oo...', '..oGGo..', '.oGGGGo.', 'oGGgGGGo', 'ooogGooo', '..ogGo..', '..ogGo..', '..oooo..'],
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
  engine: ['...ooo...', '.oowkwoo.', '.okkkkko.', 'owkkokkwo', 'okkoookko', 'owkkokkwo', '.okkkkko.', '.oowkwoo.', '...ooo...'],
  sonar: ['oo.....oo', 'oUo...oUo', '.oUoooUo.', '..oUUUo..', '...owo...', '....o....', '...ooo...', '..okkko..'],
  ice: ['oooooooo', 'owUwwUwo', 'oUwwwwUo', 'owwUUwwo', 'owwUUwwo', 'oUwwwwUo', 'owUwwUwo', 'oooooooo'],
  captain: ['..ooooo..', '.owwwwwo.', 'oooooooooo'.slice(0, 9), '.ossssso.', '.osossso.', '.ossssso.', '..ooooo..', '.ouuuuuo.', 'ouuyuuuuo'],
  trap: ['ooooooooo', 'oBoBoBoBo', 'oBoBoBoBo', 'ooooooooo', 'oBoBoBoBo', 'oBoBoBoBo', 'ooooooooo'],
  storm: ['..oooo...', '.okkkkoo.', 'okkkkkkko', 'okkkkkkko', '.ooooooo.', '...oyo...', '..oyo....', '..oo.....'],
  anchor: ['...oo...', '..okko..', '...oo...', 'oooooooo', '...ok...', '...ok...', 'o..ok..o', 'ok.ok.ko', '.okkkko.', '..oooo..'],
  plus: ['..ooo..', '..ogo..', 'ooogooo', 'ogggggo', 'ooogooo', '..ogo..', '..ooo..'],
  can: ['.oooooo.', 'okkkkkko', 'oooooooo', 'oUUUUUUo', 'oUwwwwUo', 'oUwUUwUo', 'oUUUUUUo', 'oooooooo', 'okkkkkko', '.oooooo.'],
  smoked: ['....ooo...', '..ooBBBo..', '.oBBbbBBo.', 'oBbbBBbbBo', 'oBBbbbbBBo', '.oBBBBBBo.', '..oooooo..'],
  dish: ['....ooo....', '...oyyyo...', '..oyYYYyo..', '.oyYrrrYyo.', 'ooooooooooo', 'owwwwwwwwwo', '.owwwwwwwo.', '..ooooooo..'],
  factory: ['.oo....oo..', '.oko...oko.', '.oko...oko.', 'oooooooooooo'.slice(0, 11), 'orrrrrrrrro', 'oryyrrryyro', 'orrrrrrrrro', 'orrrokkorro', 'ooooooooooo'],
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
