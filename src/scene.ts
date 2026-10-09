import { Application, Container, Graphics, Sprite, Texture, TextureStyle, TilingSprite } from 'pixi.js';
import bgUrl from './assets/kenney/backgrounds.png';
import tilesUrl from './assets/kenney/tiles.png';
import { BOOTS, CLOTHES, RODS, TIERS, VARIANTS, type FishDef, type Variant } from './data';
import type { Game } from './game';
import {
  HAND, PAL, alertCanvas, baitShopCanvas, boatCanvas, bobberCanvas, harborCanvas, fishCanvas, fisherCanvas, holderCanvas, plankCanvas, schoolCanvas, stallCanvas, type Pose,
} from './pixelart';

export type Place = 'market' | 'school' | 'bait' | 'tackle' | 'dock';

/** Where each place sits along the path, as a fraction of the screen width. */
const PLACE_X: Record<Place, number> = { market: 0.17, school: 0.335, dock: 0.5, bait: 0.665, tackle: 0.84 };
/** Worm holes in the dirt bank, between the stalls and the dock (index = Game worm spot). */
export const WORM_SPOT_X = [0.34, 0.39, 0.44, 0.56, 0.61, 0.66];

/** Key positions. Internally in world pixels (the low-res pixel grid); `L` exposes them in CSS px. */
interface Layout {
  w: number;
  h: number;
  skyBottom: number;
  riverTop: number;
  riverBottom: number;
  path: number; // y the player walks along
  marketX: number;
  tackleX: number;
  schoolX: number;
  baitX: number;
  dockX: number;
  dockEnd: number; // y of the dock's far end (where you fish)
  harborX: number; // the harbor office on the far bank
  bobbers: { x: number; y: number }[]; // where each line's bobber lands
}

interface Shadow { x: number; y: number; speed: number; size: number }
interface Ripple { x: number; y: number; t: number; big: boolean }

const WALK_SPEED = 0.42; // screen widths per second, before boots
const TILE = 18; // Kenney tile size
TextureStyle.defaultOptions.scaleMode = 'nearest';

/** Cut 18×18 tiles (or 24×24 backgrounds) out of a Kenney sheet into canvases. */
function cutter(img: HTMLImageElement, size: number) {
  const cols = Math.floor(img.width / size);
  return (i: number): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    c.getContext('2d')!.drawImage(img, (i % cols) * size, Math.floor(i / cols) * size, size, size, 0, 0, size, size);
    return c;
  };
}
/** Several tiles side by side in one canvas (for tiling strips). */
function strip(parts: HTMLCanvasElement[]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = parts.reduce((w, p) => w + p.width, 0);
  c.height = parts[0]!.height;
  let x = 0;
  for (const p of parts) { c.getContext('2d')!.drawImage(p, x, 0); x += p.width; }
  return c;
}
/** Make every pixel of the top-left pixel's colour transparent (to lift a backdrop off its own sky). */
function colorKey(c: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = c.getContext('2d')!;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const [r, g, b] = img.data;
  for (let i = 0; i < img.data.length; i += 4) if (img.data[i] === r && img.data[i + 1] === g && img.data[i + 2] === b) img.data[i + 3] = 0;
  ctx.putImageData(img, 0, 0);
  return c;
}
const loadImage = (src: string) => new Promise<HTMLImageElement>((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src; });
const tex = (c: HTMLCanvasElement) => Texture.from(c);

/**
 * The riverbank in pixel art, rendered with PixiJS: the world is drawn at a
 * low resolution (2–4× smaller than the screen) and scaled up with
 * nearest-neighbour so every pixel stays crisp. Kenney Pixel Platformer tiles
 * for the land and water; the fisherman, fish and buildings come from
 * pixelart.ts. Owns the player's position and walking; reads the line state
 * from Game.
 */
export class Scene {
  private app = new Application();
  private ready = false;
  private scale = 2;
  private V!: Layout; // world pixels
  private time = 0;
  /** Player position: x along the path (fraction of width), then up the dock (0..1). */
  private px = 0.42;
  private onDock = 0;
  private route: { x?: number; dock?: number }[] = [];
  private arrival: Place | null = null;
  private facing = 1;
  private walkPhase = 0;
  private stepping = 0;
  private shadows: Shadow[] = [];
  private ripples: Ripple[] = [];
  private flying: { fish: FishDef; variant?: Variant; t: number; slot: number; sprite: Sprite }[] = [];
  private lastLines: string[] = [];
  onArrive: (p: Place) => void = () => {};

  // Pixi objects.
  private world = new Container();
  private clouds?: TilingSprite;
  private waterTop?: TilingSprite;
  private fx = new Graphics(); // shadows, ripples, lines, rings
  private rodLine = new Graphics();
  private wormFx = new Graphics();
  private harbor = new Sprite();
  private ship = new Sprite();
  private boatSprites: Sprite[] = [];
  private boatAlerts: Sprite[] = [];
  private builtCompany = false;
  /** Seconds into the zoom-out fade (null when not fading). */
  private fading: number | null = null;
  private fadeEl?: HTMLDivElement;
  private bobbers: Sprite[] = [];
  private alerts: Sprite[] = [];
  private holders: Sprite[] = [];
  private player = new Sprite();
  private flyLayer = new Container();
  private textures = new Map<string, Texture>();
  private tile!: (i: number) => HTMLCanvasElement;
  private bg!: (i: number) => HTMLCanvasElement;

  constructor(private canvas: HTMLCanvasElement, private game: Game) {
    for (let i = 0; i < 9; i++) this.shadows.push(this.newShadow(Math.random()));
    this.measure();
    addEventListener('resize', () => { this.measure(); if (this.ready) this.resize(); });
    void this.init();
  }

  private async init(): Promise<void> {
    const [tiles, bgs] = await Promise.all([loadImage(tilesUrl), loadImage(bgUrl)]);
    this.tile = cutter(tiles, TILE);
    this.bg = cutter(bgs, 24);
    await this.app.init({ canvas: this.canvas, width: this.V.w, height: this.V.h, antialias: false, resolution: 1, autoStart: false, background: '#dff6f5' });
    this.app.stage.addChild(this.world);
    this.ready = true;
    this.resize();
  }

  /** Pick the pixel scale and world size for this screen. */
  private measure(): void {
    const w = innerWidth, h = innerHeight;
    const company = this.game.company;
    this.builtCompany = company;
    // Owning the company zooms out: a wider river, less sky and foreground, and on big screens smaller pixels.
    const base = Math.max(2, Math.round(Math.min(w, h) / 240));
    this.scale = company ? Math.max(2, base - 1) : base;
    const vw = Math.ceil(w / this.scale), vh = Math.ceil(h / this.scale);
    const F = company ? { sky: 0.14, top: 0.22, bottom: 0.68, path: 0.775 } : { sky: 0.24, top: 0.36, bottom: 0.66, path: 0.76 };
    const riverTop = Math.round(vh * F.top), riverBottom = Math.round(vh * F.bottom);
    const dockX = Math.round(vw * PLACE_X.dock);
    this.V = {
      w: vw, h: vh,
      skyBottom: Math.round(vh * F.sky),
      riverTop, riverBottom,
      path: Math.round(vh * F.path),
      marketX: Math.round(vw * PLACE_X.market),
      tackleX: Math.round(vw * PLACE_X.tackle),
      schoolX: Math.round(vw * PLACE_X.school),
      baitX: Math.round(vw * PLACE_X.bait),
      dockX,
      dockEnd: Math.round(riverTop + (riverBottom - riverTop) * (company ? 0.6 : 0.42)),
      harborX: Math.round(vw * 0.86),
      // One spot per line: right, left, then further out right and left of the dock.
      bobbers: [
        [Math.max(28, vw * 0.2), 0.3], [-Math.max(28, vw * 0.2), 0.3],
        [Math.max(17, vw * 0.11), 0.1], [-Math.max(17, vw * 0.11), 0.1],
      ].map(([dx, f]) => ({
        x: Math.round(Math.max(8, Math.min(vw - 8, dockX + dx!))),
        y: Math.round(riverTop + (riverBottom - riverTop) * f!),
      })),
    };
  }

  /** Layout in CSS pixels (for debugging and tests). */
  get L(): Layout {
    const s = this.scale, V = this.V;
    const k = (v: number) => v * s;
    return {
      w: k(V.w), h: k(V.h), skyBottom: k(V.skyBottom), riverTop: k(V.riverTop), riverBottom: k(V.riverBottom), path: k(V.path),
      marketX: k(V.marketX), tackleX: k(V.tackleX), schoolX: k(V.schoolX), baitX: k(V.baitX), dockX: k(V.dockX), dockEnd: k(V.dockEnd), harborX: k(V.harborX),
      bobbers: V.bobbers.map((b) => ({ x: k(b.x), y: k(b.y) })),
    };
  }

  private resize(): void {
    const { w, h } = this.V;
    this.app.renderer.resize(w, h);
    this.canvas.style.width = `${w * this.scale}px`;
    this.canvas.style.height = `${h * this.scale}px`;
    this.canvas.style.imageRendering = 'pixelated';
    this.build();
  }

  // ---------- building the world ----------

  private cached(key: string, make: () => HTMLCanvasElement): Texture {
    let t = this.textures.get(key);
    if (!t) { t = tex(make()); this.textures.set(key, t); }
    return t;
  }

  private build(): void {
    const V = this.V;
    this.world.removeChildren();
    const layer = new Container();
    const add = <T extends Container>(o: T, parent: Container = layer): T => { parent.addChild(o); return o; };
    const tiling = (canvas: HTMLCanvasElement, x: number, y: number, w: number, h: number) =>
      add(new TilingSprite({ texture: tex(canvas), width: w, height: Math.max(0, h), x, y }));

    // Sky, sun, drifting clouds.
    tiling(this.bg(0), 0, 0, V.w, V.skyBottom);
    add(new Graphics()).circle(V.w - 22, 16, 8).fill(PAL.goldLight).circle(V.w - 22, 16, 6).fill('#fff3b0');
    this.clouds = tiling(strip([8, 9, 10, 11].map((i) => this.bg(i))), 0, V.skyBottom - 22, V.w, 24);
    // Far bank: forest silhouette lifted off its own sky, dark green below it.
    tiling(this.bg(16), 0, V.skyBottom + 2, V.w, V.riverTop - V.skyBottom);
    tiling(colorKey(strip([14, 15].map((i) => this.bg(i)))), 0, V.skyBottom - 6, V.w, 24);
    tiling(this.bg(22), 0, V.skyBottom + 18, V.w, V.riverTop - V.skyBottom - 18);
    // River: a wavy surface row over open water, a little darker toward the near bank.
    tiling(this.tile(73), 0, V.riverTop, V.w, V.riverBottom - V.riverTop);
    this.waterTop = tiling(this.tile(33), 0, V.riverTop - 6, V.w, TILE);
    add(new Graphics()).rect(0, V.riverBottom - 14, V.w, 14).fill({ color: PAL.waterDeep, alpha: 0.35 });
    // The old harbor on the far bank, with a short pier.
    const pier = add(new Graphics());
    pier.rect(V.harborX - 34, V.riverTop - 2, 30, 3).fill(PAL.sand).rect(V.harborX - 34, V.riverTop + 1, 30, 1).fill(PAL.dirtDark);
    for (let x = V.harborX - 32; x < V.harborX - 4; x += 8) pier.rect(x, V.riverTop + 1, 2, 5).fill(PAL.dirtDeep);
    this.harbor = add(new Sprite());
    this.harbor.anchor.set(0.5, 1);
    this.harbor.position.set(V.harborX, V.riverTop + 1);
    this.ship = add(new Sprite(this.cached('ship', () => boatCanvas(0, true))));
    this.ship.anchor.set(0.5, 1);
    this.ship.alpha = 0.75;
    // Shadows, ripples and lines are redrawn every frame on top of the water.
    add(this.fx);
    // Near bank: grass-topped dirt, the sandy path, then a meadow with tufts.
    // (Middle tiles only: Kenney's end caps would draw a seam every few tiles.)
    tiling(this.tile(2), 0, V.riverBottom - 3, V.w, TILE);
    tiling(this.tile(122), 0, V.riverBottom - 3 + TILE, V.w, V.path - 5 - (V.riverBottom - 3 + TILE));
    tiling(this.tile(42), 0, V.path - 5, V.w, TILE);
    const meadow = add(new Graphics());
    meadow.rect(0, V.path + 13, V.w, V.h - V.path - 13).fill(PAL.green);
    meadow.rect(0, V.path + 13, V.w, 2).fill(PAL.greenLight);
    // Little grass tufts and flowers, kept clear of the school.
    for (let i = 0; i < Math.round(V.w / 9); i++) {
      const x = Math.round((i * 37 + 11) % V.w), y = Math.round(V.path + 20 + ((i * 53) % Math.max(1, V.h - V.path - 40)));
      if ((Math.abs(x - V.schoolX) < 26 || Math.abs(x - V.baitX) < 24) && y < V.path + 56) continue;
      if (i % 4 === 0) meadow.rect(x, y, 1, 1).fill([PAL.white, PAL.goldLight, PAL.redLight][i % 3]!).rect(x, y + 1, 1, 2).fill(PAL.greenDark);
      else meadow.rect(x, y, 1, 3).fill(PAL.greenLight).rect(x - 1, y + 1, 1, 2).fill(PAL.greenLight).rect(x + 1, y + 1, 1, 2).fill(PAL.greenDark);
    }
    // Dock: planks from the bank out to the fishing spot, posts down into the water.
    const dockW = 14;
    tiling(plankCanvas(dockW), V.dockX - dockW / 2, V.dockEnd - 4, dockW, V.riverBottom - V.dockEnd + 2);
    const posts = add(new Graphics());
    for (let y = V.dockEnd; y < V.riverBottom - 4; y += 14) {
      posts.rect(V.dockX - dockW / 2 - 1, y, 2, 6).fill(PAL.dirtDeep);
      posts.rect(V.dockX + dockW / 2 - 1, y, 2, 6).fill(PAL.dirtDeep);
    }
    // Shops on the path, the school cabin on the meadow below it.
    const shop = (key: string, make: () => HTMLCanvasElement, x: number, y: number, ay: number) => {
      const s = add(new Sprite(this.cached(key, make)));
      s.anchor.set(0.5, ay);
      s.position.set(Math.round(x), Math.round(y));
    };
    shop('market', () => stallCanvas('MARKET', [PAL.red, PAL.white], PAL.redDark, 'fish'), V.marketX, V.path - 2, 1);
    shop('tackle', () => stallCanvas('TACKLE', [PAL.waterDeep, PAL.sky], PAL.waterDeeper, 'tackle'), V.tackleX, V.path - 2, 1);
    shop('school', schoolCanvas, V.schoolX, V.path + 12, 0);
    shop('baitshop', baitShopCanvas, V.baitX, V.path + 12, 0);
    // Worms poke out of the dirt bank (redrawn every frame).
    this.wormFx = add(new Graphics());
    this.world.addChild(layer);

    // Moving things on top: holder rods, bobbers, "!", the rod, the player, leaping fish.
    this.holders = [1, 2, 3].map(() => add(new Sprite(this.cached('holder', holderCanvas)), this.world));
    this.bobbers = [0, 1, 2, 3].map(() => add(new Sprite(this.cached('bobber', bobberCanvas)), this.world));
    this.alerts = [0, 1, 2, 3].map(() => add(new Sprite(this.cached('alert', alertCanvas)), this.world));
    for (const s of [...this.bobbers, ...this.alerts, ...this.holders]) s.anchor.set(0.5, 1);
    this.world.addChild(this.rodLine);
    this.player.anchor.set(0.5, 1);
    this.world.addChild(this.player);
    // Company boats (sprites are retextured each frame as crew changes).
    this.boatSprites = [0, 1, 2].map(() => { const s = add(new Sprite(), this.world); s.anchor.set(0.5, 1); s.visible = false; return s; });
    this.boatAlerts = [0, 1, 2].map(() => { const s = add(new Sprite(this.cached('alert', alertCanvas)), this.world); s.anchor.set(0.5, 1); s.visible = false; return s; });
    for (const f of this.flying) f.sprite.destroy();
    this.flying = [];
    this.flyLayer = add(new Container(), this.world);
  }

  // ---------- where things are ----------

  /** Where the player is standing, if at a named place. */
  get place(): Place | null {
    if (this.route.length) return null;
    if (this.onDock >= 1) return 'dock';
    if (this.onDock === 0) for (const p of ['market', 'school', 'bait', 'tackle'] as const) if (Math.abs(this.px - PLACE_X[p]) < 0.04) return p;
    return null;
  }

  get walking(): boolean {
    return this.route.length > 0;
  }

  /** Where a worm hole is, in world pixels. */
  private wormPos(spot: number): { x: number; y: number } {
    const V = this.V;
    return { x: Math.round(WORM_SPOT_X[spot]! * V.w), y: Math.min(V.riverBottom + 20 + (spot % 2) * 6, V.path - 8) };
  }

  /** Is a screen point on the harbor (office, pier or a moored boat)? */
  hitHarbor(cx: number, cy: number): boolean {
    const V = this.V, x = cx / this.scale, y = cy / this.scale;
    return Math.abs(x - (V.harborX - 12)) < 34 && y > V.riverTop - 40 && y < V.riverTop + 22;
  }

  /** The worm under a screen point (CSS px), or null. */
  hitWorm(cx: number, cy: number): { id: number; x: number } | null {
    const x = cx / this.scale, y = cy / this.scale;
    for (const w of this.game.groundWorms) {
      const p = this.wormPos(w.spot);
      if (Math.abs(p.x - x) < 12 && Math.abs(p.y - y) < 12) return { id: w.id, x: p.x * this.scale };
    }
    return null;
  }

  /** The player's spot along the path (fraction of width) while on the path, else null. */
  get pathX(): number | null {
    return this.onDock === 0 ? this.px : null;
  }

  /** Just above the fisherman's head, in CSS pixels. */
  fisherScreen(): { x: number; y: number } {
    const f = this.feet();
    return { x: f.x * this.scale, y: (f.y - 30) * this.scale };
  }

  /** Player's feet, in world pixels. */
  private feet(): { x: number; y: number } {
    const V = this.V;
    const x = this.onDock > 0 ? V.dockX : this.px * V.w;
    return { x: Math.round(x), y: Math.round(V.path + 2 - (V.path + 2 - V.dockEnd) * this.onDock) };
  }

  /** Holder base for line `slot` (1..3) at the dock's end; slot 0 is the player's own rod. */
  private holderBase(slot: number): { x: number; y: number } {
    const side = slot % 2 === 1 ? -1 : 1;
    return { x: this.V.dockX + side * 5, y: this.V.dockEnd + 2 + (slot >= 2 ? 5 : 0) };
  }

  /** Where line `slot` leaves its rod, in world pixels. */
  private rodTip(slot = 0): { x: number; y: number } {
    const line = this.game.lines[slot];
    const pull = line?.type === 'bite' ? Math.round(Math.sin(this.time * 30)) : 0;
    if (slot === 0) {
      const hand = this.handPos(this.feet());
      return { x: hand.x + this.facing * 11, y: hand.y - 13 + pull };
    }
    const base = this.holderBase(slot);
    const dir = Math.sign(this.V.bobbers[slot]!.x - base.x) || 1;
    return { x: base.x + dir * 8, y: base.y - 15 + pull };
  }

  private handPos(f: { x: number; y: number }): { x: number; y: number } {
    const h = HAND[this.pose()];
    // The sprite is 15×24, anchored bottom-centre, mirrored when facing left.
    return { x: f.x + this.facing * (h.x - 7), y: f.y - 24 + h.y };
  }

  private pose(): Pose {
    if (this.route.length > 0 || this.stepping > 0) return Math.sin(this.walkPhase) > 0 ? 'walk1' : 'walk2';
    return this.game.lines[0]?.type === 'casting' ? 'cast' : 'idle';
  }

  // ---------- input (CSS pixel coordinates in, world pixels inside) ----------

  hit(cx: number, cy: number): Place | 'ground' {
    const V = this.V, x = cx / this.scale, y = cy / this.scale;
    if (y > V.path + 10 && y < V.path + 54 && Math.abs(x - V.schoolX) < 24) return 'school';
    if (y > V.path + 10 && y < V.path + 54 && Math.abs(x - V.baitX) < 22) return 'bait';
    const nearShop = y > V.path - 52 && y < V.path + 12;
    if (nearShop && Math.abs(x - V.marketX) < 26) return 'market';
    if (nearShop && Math.abs(x - V.tackleX) < 26) return 'tackle';
    if (y < V.riverBottom + 4 && y > V.skyBottom) return 'dock';
    return 'ground';
  }

  walkTo(place: Place | 'ground', groundX?: number): void {
    const target = place === 'ground' ? Math.max(0.06, Math.min(0.94, (groundX ?? 0) / this.scale / this.V.w)) : PLACE_X[place];
    this.route = [];
    if (this.onDock > 0) this.route.push({ dock: 0 });
    this.route.push({ x: target });
    if (place === 'dock') this.route.push({ dock: 1 });
    this.arrival = place === 'ground' ? null : place;
    if (this.route.length && this.game.fishing) this.game.stopFishing();
  }

  /** Keyboard walking: -1 / +1 along the path (steps off the dock first). */
  nudge(dir: number, dt: number): void {
    if (dir === 0) return;
    this.route = [];
    this.arrival = null;
    if (this.game.fishing) this.game.stopFishing();
    if (this.onDock > 0) { this.onDock = Math.max(0, this.onDock - dt * 2.5); this.walkPhase += dt * 10; return; }
    this.px = Math.max(0.06, Math.min(0.94, this.px + dir * WALK_SPEED * this.game.walkSpeed() * dt));
    this.facing = dir;
    this.stepping = 0.1;
    this.walkPhase += dt * 10;
  }

  /** The line whose bobber is under a screen point (only lines in the water). */
  hitBobber(cx: number, cy: number): number {
    if (this.place !== 'dock') return -1;
    const x = cx / this.scale, y = cy / this.scale;
    let best = -1, bestD = 40 / this.scale;
    this.game.lines.forEach((line, slot) => {
      if (line.type !== 'waiting' && line.type !== 'bite') return;
      const b = this.V.bobbers[slot]!;
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < bestD) { bestD = d; best = slot; }
    });
    return best;
  }

  // ---------- frame ----------

  update(dt: number): void {
    this.time += dt;
    this.stepping = Math.max(0, this.stepping - dt);
    this.walk(dt);
    for (const s of this.shadows) {
      s.x += s.speed * dt;
      if (s.x < -0.1 || s.x > 1.1) Object.assign(s, this.newShadow(s.speed > 0 ? -0.05 : 1.05));
    }
    this.ripples = this.ripples.filter((r) => (r.t += dt) < (r.big ? 1.2 : 0.9));
    if (!this.ready) return;
    if (this.game.company !== this.builtCompany && this.fading === null) this.fading = 0;
    if (this.fading !== null) this.fade(dt);
    this.trackLines();
    for (const f of this.flying) f.t += dt;
    for (const f of this.flying.filter((f) => f.t > 1.6)) f.sprite.destroy();
    this.flying = this.flying.filter((f) => f.t <= 1.6);
    this.draw();
    this.app.render();
  }

  private walk(dt: number): void {
    const step = this.route[0];
    if (!step) return;
    this.walkPhase += dt * 10;
    if (step.x !== undefined) {
      const d = step.x - this.px;
      const move = WALK_SPEED * this.game.walkSpeed() * dt;
      if (Math.abs(d) <= move) { this.px = step.x; this.route.shift(); } else { this.px += Math.sign(d) * move; this.facing = Math.sign(d); }
    } else if (step.dock !== undefined) {
      const d = step.dock - this.onDock;
      const move = dt * 2.2;
      if (Math.abs(d) <= move) { this.onDock = step.dock; this.route.shift(); } else this.onDock += Math.sign(d) * move;
    }
    if (!this.route.length && this.arrival) {
      const p = this.arrival;
      this.arrival = null;
      if (p === 'dock') this.facing = 1;
      this.onArrive(p);
    }
  }

  /** React to each line's state changes: splashes, caught fish leaping out. */
  private trackLines(): void {
    this.game.lines.forEach((line, slot) => {
      const key = line.type + (line.type === 'result' ? line.outcome : '');
      if (key === this.lastLines[slot]) return;
      this.lastLines[slot] = key;
      const b = this.V.bobbers[slot]!;
      if (line.type === 'waiting') this.ripples.push({ x: b.x, y: b.y, t: 0, big: false });
      if (line.type === 'bite' || (line.type === 'result' && line.outcome === 'snapped')) this.ripples.push({ x: b.x, y: b.y, t: 0, big: true });
      if (line.type === 'result' && line.outcome === 'caught' && line.fish) {
        const fish = line.fish, variant = line.caught?.variant;
        const sprite = new Sprite(this.cached(`fish:${fish.id}:${variant ?? ''}`, () => fishCanvas(fish, variant)));
        sprite.anchor.set(0.5);
        if (variant === 'giant') sprite.scale.set(2);
        this.flyLayer.addChild(sprite);
        this.flying.push({ fish, variant, t: 0, slot, sprite });
        this.ripples.push({ x: b.x, y: b.y, t: 0, big: true });
      }
    });
    this.lastLines.length = this.game.lines.length;
  }

  /** The zoom-out: fade to white, rebuild with the wide-river layout, fade back in. */
  private fade(dt: number): void {
    if (!this.fadeEl) {
      this.fadeEl = document.createElement('div');
      this.fadeEl.style.cssText = 'position:fixed;inset:0;background:#dff6f5;pointer-events:none;z-index:4;opacity:0';
      document.body.appendChild(this.fadeEl);
    }
    const before = this.fading!;
    this.fading = before + dt;
    if (before < 0.6 && this.fading >= 0.6) { this.measure(); this.resize(); }
    const k = this.fading < 0.6 ? this.fading / 0.6 : Math.max(0, 1 - (this.fading - 0.6) / 0.9);
    this.fadeEl.style.opacity = String(k);
    if (this.fading >= 1.5) { this.fading = null; this.fadeEl.style.opacity = '0'; }
  }

  private newShadow(x: number): Shadow {
    return { x, y: 0.15 + Math.random() * 0.7, speed: (Math.random() < 0.5 ? -1 : 1) * (0.02 + Math.random() * 0.05), size: 0.6 + Math.random() * 0.9 };
  }

  // ---------- drawing ----------

  private draw(): void {
    const V = this.V, g = this.fx;
    // Clouds drift, the water surface rolls.
    if (this.clouds) this.clouds.tilePosition.x = Math.round(this.time * 3);
    if (this.waterTop) this.waterTop.tilePosition.x = Math.round(Math.sin(this.time * 0.8) * 4);
    g.clear();
    // Fish shadows under the surface.
    for (const s of this.shadows) {
      const x = Math.round(s.x * V.w), y = Math.round(V.riverTop + 10 + s.y * (V.riverBottom - V.riverTop - 20));
      const w = Math.round(5 + s.size * 5), dir = Math.sign(s.speed);
      g.ellipse(x, y, w, Math.max(2, Math.round(w / 3))).fill({ color: PAL.waterDeeper, alpha: 0.45 });
      g.poly([x - dir * w, y, x - dir * (w + 4), y - 2, x - dir * (w + 4), y + 2]).fill({ color: PAL.waterDeeper, alpha: 0.45 });
    }
    // A few twinkling glints.
    for (let i = 0; i < 6; i++) {
      if (Math.sin(this.time * 2 + i * 1.7) < 0.6) continue;
      g.rect(Math.round((i * 47 + 13) % V.w), Math.round(V.riverTop + 12 + ((i * 29) % Math.max(1, V.riverBottom - V.riverTop - 20))), 2, 1).fill(PAL.white);
    }
    for (const r of this.ripples) {
      const k = r.t / (r.big ? 1.2 : 0.9);
      const rx = Math.round(3 + k * (r.big ? 14 : 8));
      g.ellipse(r.x, r.y + 1, rx, Math.max(1, Math.round(rx / 3))).stroke({ color: PAL.white, width: 1, alpha: 1 - k });
    }
    this.drawWorms();
    this.drawHarbor(g);
    this.drawLines(g);
    this.drawPlayer();
    this.drawFlyingFish(g);
  }

  /** The harbor office (by state), the mystery ship before the company, and the company's boats. */
  private drawHarbor(g: Graphics): void {
    const V = this.V, game = this.game;
    const state = game.company ? 'open' : game.companyRevealed ? 'forsale' : 'boarded';
    this.harbor.texture = this.cached(`harbor:${state}`, () => harborCanvas(state));
    // Teaser: a dark ship drifts along the far bank now and then (20 s across, every 45 s).
    const cycle = this.time % 45;
    this.ship.visible = !game.company && cycle < 20;
    if (this.ship.visible) this.ship.position.set(Math.round(-30 + (cycle / 20) * (V.w + 60)), V.riverTop + 4);
    // Boats: moored at the pier, or sailing off to the left and back.
    const pierX = V.harborX - 22, y = V.riverTop + 12;
    this.boatSprites.forEach((s, i) => {
      const b = game.boats[i];
      const alert = this.boatAlerts[i]!;
      s.visible = !!b;
      alert.visible = false;
      if (!b) return;
      s.texture = this.cached(`boat:${b.crew}`, () => boatCanvas(b.crew));
      let x = pierX - i * 44;
      if (b.trip) {
        const p = b.trip.t / b.trip.dur, far = -40;
        if (p < 0.15) x = x + (far - x) * (p / 0.15);
        else if (p > 0.85) x = far + (x - far) * ((p - 0.85) / 0.15);
        else s.visible = false;
        s.scale.x = p < 0.5 ? -1 : 1; // facing the way it's going
      } else s.scale.x = 1;
      s.position.set(Math.round(x), y + Math.round(Math.sin(this.time * 2 + i)));
      if (s.visible && b.trip && (b.trip.t / b.trip.dur < 0.15 || b.trip.t / b.trip.dur > 0.85)) {
        g.rect(Math.round(x) + (s.scale.x < 0 ? 18 : -22), y - 1, 4, 1).fill({ color: PAL.white, alpha: 0.8 }); // wake
      }
      if (b.haul) { alert.visible = true; alert.position.set(Math.round(x), y - 24 + Math.round(Math.sin(this.time * 6))); }
    });
  }

  /** A little dirt mound with a pink worm wiggling out of it, per worm hole. */
  private drawWorms(): void {
    const g = this.wormFx.clear();
    for (const w of this.game.groundWorms) {
      const { x, y } = this.wormPos(w.spot);
      const up = Math.sin(this.time * 6 + w.id) > 0 ? 1 : 0;
      g.rect(x - 4, y, 9, 2).fill(PAL.dirtDeep).rect(x - 3, y - 1, 7, 1).fill(PAL.dirtDark);
      g.rect(x - 1, y - 4 - up, 2, 4 + up).fill('#fc8bb0').rect(x + 1, y - 4 - up, 1, 1).fill('#fc8bb0').rect(x - 1, y - 5 - up, 1, 1).fill(PAL.outline);
    }
  }

  private drawPlayer(): void {
    const f = this.feet();
    const o = CLOTHES[this.game.clothes]!, boots = BOOTS[this.game.boots]!.color;
    const pose = this.pose();
    this.player.texture = this.cached(`fisher:${o.shirt}:${o.trousers}:${boots ?? ''}:${pose}`,
      () => fisherCanvas({ shirt: o.shirt, trousers: o.trousers, boots: boots ?? undefined }, pose));
    this.player.position.set(f.x, f.y);
    this.player.scale.x = this.facing;
    // The rod in hand.
    const hand = this.handPos(f), tip = this.rodTip(0);
    this.rodLine.clear().moveTo(hand.x, hand.y).lineTo(tip.x, tip.y).stroke({ color: RODS[this.game.rod]!.color, width: 1 });
  }

  /** Every line in the water: its rod (holders), the line, the bobber, and a "!" when it bites. */
  private drawLines(g: Graphics): void {
    const V = this.V, lines = this.game.lines;
    this.holders.forEach((h, i) => {
      const slot = i + 1;
      h.visible = slot < this.game.lineCount;
      if (!h.visible) return;
      const base = this.holderBase(slot), tip = this.rodTip(slot);
      h.position.set(base.x, base.y + 2);
      g.moveTo(base.x, base.y - 4).lineTo(tip.x, tip.y).stroke({ color: RODS[this.game.rod]!.color, width: 1 });
    });
    this.bobbers.forEach((b, slot) => { b.visible = false; this.alerts[slot]!.visible = false; });
    lines.forEach((line, slot) => {
      if (line.type === 'idle' || (line.type === 'result' && line.outcome !== 'caught' && line.t > 0.4)) return;
      const tip = this.rodTip(slot), home = V.bobbers[slot]!;
      let bx = home.x, by = home.y;
      if (line.type === 'casting') {
        const k = Math.max(0, Math.min(1, line.t / 0.6));
        bx = tip.x + (home.x - tip.x) * k;
        by = tip.y + (home.y - tip.y) * k - Math.sin(k * Math.PI) * V.h * 0.12;
      } else if (line.type === 'waiting') {
        by += Math.round(Math.sin(this.time * 3 + slot));
      } else if (line.type === 'bite') {
        by += 2 + Math.round(Math.sin(this.time * 25));
      } else if (line.type === 'result') {
        const k = Math.min(1, line.t / 0.5);
        bx = home.x + (tip.x - home.x) * k;
        by = home.y + (tip.y - home.y) * k;
      }
      bx = Math.round(bx); by = Math.round(by);
      g.moveTo(tip.x, tip.y).quadraticCurveTo((tip.x + bx) / 2, Math.max(tip.y, by) + 6, bx, by).stroke({ color: PAL.white, width: 1, alpha: 0.85 });
      if (line.type === 'result') return;
      const b = this.bobbers[slot]!;
      b.visible = true;
      b.position.set(bx, by + 3);
      if (line.type === 'bite') {
        const a = this.alerts[slot]!;
        a.visible = true;
        a.position.set(home.x, home.y - 6 + Math.round(Math.sin(this.time * 18 + slot)));
      }
    });
  }

  private drawFlyingFish(g: Graphics): void {
    const V = this.V;
    for (const { fish, variant, t, slot, sprite } of this.flying) {
      const tip = this.rodTip(slot), from = V.bobbers[slot]!;
      const k = Math.min(1, t / 0.7);
      const x = Math.round(from.x + (tip.x - from.x) * k);
      const y = Math.round(from.y + (tip.y + 8 - from.y) * k - Math.sin(k * Math.PI) * V.h * 0.12);
      const alpha = t > 1.3 ? Math.max(0, 1 - (t - 1.3) / 0.3) : 1;
      sprite.position.set(x, y);
      sprite.alpha = alpha;
      sprite.scale.x = -Math.abs(sprite.scale.x); // leaps toward the fisher
      sprite.rotation = Math.round(Math.sin(t * 14) * 2) * 0.15;
      // Pixel ring in the tier colour (a second ring for rare variants and Legendaries).
      const r = Math.round(Math.abs(sprite.width) * 0.6 + Math.sin(t * 12) * 1.5);
      const color = variant ? VARIANTS[variant].color : TIERS[fish.tier].color;
      g.circle(x, y, r).stroke({ color, width: 1, alpha });
      if (variant || fish.tier === 5) g.circle(x, y, r + 3).stroke({ color, width: 1, alpha: alpha * 0.6 });
      if (variant === 'golden' || variant === 'shiny') {
        for (let i = 0; i < 5; i++) {
          const a = i * 1.26 + t * 3;
          g.rect(Math.round(x + Math.cos(a) * (r + 1)), Math.round(y + Math.sin(a) * (r + 1) * 0.7), 1, 1).fill({ color: PAL.white, alpha });
        }
      }
    }
  }
}
