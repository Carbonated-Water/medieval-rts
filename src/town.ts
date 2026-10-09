import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { LINE_ORDER, PLANT_BACKLOG_MIN, RESTAURANTS, restaurantRate, restaurantTier, type LineId, type RestaurantId } from './data';
import type { Game, TownEvent } from './game';
import { PAL, RESTAURANT_SPOTS, bubbleCanvas, coinCanvas, soldOutCanvas, vehicleCanvas, walkerCanvas, type Vehicle, type WalkerLook, type WalkerPose } from './pixelart';

/**
 * Life on the town street: everything the empire does, shown as it happens.
 * Fish trucks bring hauls to the plant (crates pile at its door while it's
 * behind); its window conveyor runs while lines work; vans take products to
 * the restaurants; customers walk in, eat at the table and pay (+$ over the
 * door), queue when a restaurant can't keep up, and turn away at SOLD OUT;
 * a market truck carries off the extra and a lorry leaves with each contract.
 * Driven by game.townNews plus the game's state; the scene owns the layout.
 */

export interface TownLayout {
  w: number; back: number; road: number; plantX: number; exportX: number;
  /** Restaurant lots: one row on wide screens, two on phones; `front` is where each stands (its sidewalk is just below). */
  lots: { id: RestaurantId; x: number; front: number }[];
  /** Sidewalks in use: the first row's always, the second once something stands on it. */
  fronts: number[];
}
export interface TownFloat { text: string; x: number; y: number; tone: 'good' | 'rare' | 'plain' }
type Cached = (key: string, make: () => HTMLCanvasElement) => Texture;

interface Walker {
  s: Sprite; look: number; x: number; y: number; dir: 1 | -1; to: number; speed: number;
  phase: 'walk' | 'inside' | 'eat' | 'refuse' | 'leave'; t: number; rest?: RestaurantId; paid: number; bubble?: Sprite;
}
interface Car {
  s: Sprite; kind: Vehicle; x: number; lane: 0 | 1; dir: 1 | -1; to: number; phase: 'go' | 'stop' | 'away'; t: number;
  load: number; rest?: RestaurantId; wait: number; then: 'back' | 'on' | 'off';
}

const LOOKS: WalkerLook[] = [
  { shirt: '#dd442c', trousers: '#434a5f', hair: '#6f3e43' }, { shirt: '#2f6fd6', trousers: '#9f5a52', hair: '#f4b41b' },
  { shirt: '#2eb082', trousers: '#434a5f', hair: '#434a5f' }, { shirt: '#f4b41b', trousers: '#2f6fd6', hair: '#9f5a52' },
  { shirt: '#b45ad6', trousers: '#747a90', hair: '#6f3e43' }, { shirt: '#ffffff', trousers: '#345551', hair: '#cb815e' },
  { shirt: '#fc683b', trousers: '#434a5f', hair: '#dce1e7' }, { shirt: '#4ce5fd', trousers: '#6f3e43', hair: '#434a5f' },
];
/** The restaurant manager: dark suit. */
const MANAGER: WalkerLook = { shirt: '#262b3a', trousers: '#262b3a', hair: '#6f3e43' };
/** A coin flying from a till to your money, a puff of smoke, a firework spark. */
interface Coin { s: Sprite; x0: number; y0: number; x1: number; y1: number; t: number; dur: number }
interface Spark { x: number; y: number; vx: number; vy: number; t: number; life: number; color: string; size: number; gravity: number }

/** Vehicle lengths, for keeping a gap in traffic. */
const WIDTH: Record<Vehicle, number> = { fish: 30, van: 24, market: 30, lorry: 44 };
/** Conveyor items, by line: frozen fillets, cans, smoked fish, dishes. */
const ITEM: Record<LineId, string> = { freezer: '#a8e4ff', cannery: '#dce1e7', smokehouse: '#9f5a52', kitchen: '#fc683b' };

export class TownLife {
  readonly layer = new Container();
  /** "+$" to float up from buildings, in world pixels (the scene converts). */
  floats: TownFloat[] = [];
  private fx = new Graphics();
  private carLayer = new Container();
  private walkLayer = new Container();
  private walkers: Walker[] = [];
  private cars: Car[] = [];
  private seats: Partial<Record<RestaurantId, Walker>> = {};
  private queues: Partial<Record<RestaurantId, Sprite[]>> = {};
  private soldOut: Partial<Record<RestaurantId, Sprite>> = {};
  private managers: Partial<Record<RestaurantId, Sprite>> = {};
  private coins: Coin[] = [];
  private sparks: Spark[] = [];
  private fxTop = new Graphics();
  private coinLayer = new Container();
  private sinceVan: Partial<Record<RestaurantId, number>> = {};
  private refuseClock: Partial<Record<RestaurantId, number>> = {};
  private wholesale = 0;
  /** Fish waiting for the next truck (one unloads at a time). */
  private pendingFish = 0;
  /** Vans and trucks waiting for room to pull out of the plant. */
  private departures: { kind: Vehicle; rest?: RestaurantId }[] = [];
  private wholesaleClock = 0;
  private passClock = 0;
  private time = 0;
  private T!: TownLayout;

  constructor(private game: Game, private cached: Cached) {}

  /** Rebuild for a new layout (resize): everything in flight is dropped. */
  reset(T: TownLayout): void {
    this.T = T;
    this.layer.removeChildren();
    this.fx = this.layer.addChild(new Graphics());
    this.carLayer = this.layer.addChild(new Container());
    this.walkLayer = this.layer.addChild(new Container());
    this.fxTop = this.layer.addChild(new Graphics());
    this.coinLayer = this.layer.addChild(new Container());
    this.coins = [];
    this.sparks = [];
    this.walkers = [];
    this.cars = [];
    this.seats = {};
    for (const lot of T.lots) {
      this.queues[lot.id] = [0, 1, 2].map((k) => {
        const s = this.walkLayer.addChild(new Sprite(this.look(k + lot.x, 'stand')));
        s.anchor.set(0.5, 1);
        s.scale.x = -1;
        s.visible = false;
        return s;
      });
      const so = this.layer.addChild(new Sprite(this.cached('soldout', soldOutCanvas)));
      so.anchor.set(0.5, 0.5);
      so.visible = false;
      this.soldOut[lot.id] = so;
      const m = this.walkLayer.addChild(new Sprite(this.cached('walker:mgr', () => walkerCanvas(MANAGER, 'stand'))));
      m.anchor.set(0.5, 1);
      m.visible = false;
      this.managers[lot.id] = m;
    }
  }

  // ---------- places ----------

  private laneY = (lane: 0 | 1) => this.T.road + (lane ? 21 : 12);
  private lot = (id: RestaurantId) => this.T.lots.find((l) => l.id === id)!;
  private lotX = (id: RestaurantId) => this.lot(id).x;
  /** The restaurant's current look (cart, shop, ...) and where its door, table and window are. */
  private spots = (id: RestaurantId) => RESTAURANT_SPOTS[restaurantTier(this.game.restaurants[id]?.level ?? 1)]!;
  private door = (id: RestaurantId) => this.lotX(id) + this.spots(id).door;
  private look = (k: number, pose: WalkerPose) => {
    const i = ((Math.round(k) % LOOKS.length) + LOOKS.length) % LOOKS.length;
    return this.cached(`walker:${i}:${pose}`, () => walkerCanvas(LOOKS[i]!, pose));
  };
  private float(text: string, x: number, y: number, tone: TownFloat['tone'] = 'good'): void {
    this.floats.push({ text, x, y, tone });
  }

  // ---------- spawning ----------

  private walker(to: number, rest: RestaurantId | undefined, paid: number, fromLeft = Math.random() < 0.5): Walker {
    const look = Math.floor(Math.random() * LOOKS.length);
    const x = fromLeft ? -6 : this.T.w + 6;
    // Customers use their restaurant's sidewalk; passers-by pick one.
    const fronts = this.T.fronts;
    const y = (rest ? this.lot(rest).front : fronts[Math.floor(Math.random() * fronts.length)]!) + 4;
    const s = this.walkLayer.addChild(new Sprite(this.look(look, 'stand')));
    s.anchor.set(0.5, 1);
    const w: Walker = { s, look, x, y, dir: to > x ? 1 : -1, to, speed: 13 + Math.random() * 6, phase: 'walk', t: 0, rest, paid };
    this.walkers.push(w);
    return w;
  }

  private car(kind: Vehicle, x: number, lane: 0 | 1, to: number, then: Car['then'], extra: Partial<Car> = {}): Car {
    const s = this.carLayer.addChild(new Sprite(this.cached(`car:${kind}:1`, () => vehicleCanvas(kind, true))));
    s.anchor.set(0.5, 1);
    const c: Car = { s, kind, x, lane, dir: to > x ? 1 : -1, to, phase: 'go', t: 0, load: 0, wait: 1.2, then, ...extra };
    this.cars.push(c);
    return c;
  }

  private onEvent(e: TownEvent): void {
    const T = this.T;
    if (e.kind === 'fish') {
      this.pendingFish += e.n;
    } else if (e.kind === 'sale') {
      if (!T.lots.some((l) => l.id === e.id)) return;
      // Each sale is a customer on the way in; when the street is busy, later sales ride on the last one's bill.
      const coming = this.walkers.filter((w) => w.rest === e.id && w.phase === 'walk' && w.paid > 0);
      if (coming.length >= 3) coming[coming.length - 1]!.paid += e.paid;
      else this.walker(this.door(e.id), e.id, e.paid, this.door(e.id) > T.w / 2 ? Math.random() < 0.3 : Math.random() < 0.7);
      this.sinceVan[e.id] = (this.sinceVan[e.id] ?? 0) + 1;
      if (this.sinceVan[e.id]! >= 4 && !this.cars.some((c) => c.kind === 'van' && c.rest === e.id)) {
        this.sinceVan[e.id] = 0;
        this.departures.push({ kind: 'van', rest: e.id });
      }
    } else if (e.kind === 'wholesale') {
      this.wholesale += e.paid;
    } else {
      this.car('lorry', T.exportX, 1, T.w + 30, 'off');
      this.float(`+$${e.paid.toLocaleString()}`, T.exportX, T.back - 44, 'rare');
    }
  }

  // ---------- each frame ----------

  update(dt: number, T: TownLayout, showing: boolean): void {
    this.T = T;
    const news = this.game.townNews.splice(0);
    if (!showing) return;
    this.time += dt;
    this.fxTop.clear();
    for (const e of news) this.onEvent(e);
    const game = this.game;

    // One fish truck at a time brings in whatever has been unloaded since the last.
    if (this.pendingFish > 0 && !this.cars.some((c) => c.kind === 'fish')) {
      this.car('fish', -20, 0, T.plantX - 4, 'back', { load: this.pendingFish, wait: 1.6 });
      this.pendingFish = 0;
    }
    // The market truck takes the extra products every so often.
    if ((this.wholesaleClock += dt) >= 9 && this.wholesale > 0 && !this.cars.some((c) => c.kind === 'market')) {
      this.wholesaleClock = 0;
      this.departures.push({ kind: 'market' });
      this.float(`+$${Math.round(this.wholesale).toLocaleString()}`, T.plantX + 12, T.back - 34, 'good');
      this.wholesale = 0;
    }
    // Pull out of the plant one at a time.
    const next = this.departures[0];
    if (next && !this.cars.some((c) => c.lane === 1 && Math.abs(c.x - (T.plantX + 8)) < 34)) {
      this.departures.shift();
      if (next.kind === 'van') this.car('van', T.plantX + 8, 1, this.lotX(next.rest!), 'on', { rest: next.rest });
      else this.car(next.kind, T.plantX + 8, 1, T.w + 24, 'off');
    }
    // Passers-by keep the street alive.
    if ((this.passClock += dt) >= 3.5 && this.walkers.length < 7) {
      this.passClock = 0;
      const left = Math.random() < 0.5;
      this.walker(left ? T.w + 8 : -8, undefined, 0, left);
    }
    for (const lot of T.lots) {
      const r = game.restaurants[lot.id];
      const menu = RESTAURANTS[lot.id].menu.reduce((s, m) => s + (game.products[m]?.n ?? 0), 0);
      const out = !!r && menu === 0;
      const sp = this.spots(lot.id);
      this.soldOut[lot.id]!.visible = out;
      this.soldOut[lot.id]!.position.set(lot.x + sp.window.x, lot.front - sp.window.y);
      const mgr = this.managers[lot.id]!;
      mgr.visible = !!r?.manager;
      mgr.position.set(this.door(lot.id) - 8, lot.front + 3);
      if (r && game.hustling(lot.id)) {
        // Speed lines either side while it's hustling.
        for (let k = 0; k < 4; k++) {
          const p = (this.time * 3 + k / 4) % 1, y = lot.front - 6 - k * Math.max(6, sp.h / 5);
          this.fxTop.rect(Math.round(lot.x - sp.w / 2 - 6 - p * 10), y, 6, 2).fill({ color: PAL.gold, alpha: 1 - p })
            .rect(Math.round(lot.x + sp.w / 2 + p * 10), y + 3, 6, 2).fill({ color: PAL.gold, alpha: 1 - p });
        }
      }
      // A queue when the plant makes more than this restaurant can serve: upgrade it.
      const busy = !!r && menu >= restaurantRate(r.level) * 0.8;
      this.queues[lot.id]!.forEach((s, k) => {
        s.visible = busy && k < 1 + Math.min(2, Math.floor(menu / restaurantRate(r!.level)));
        s.position.set(this.door(lot.id) + 9 + k * 7, lot.front + 4 - (Math.sin(this.time * 2 + k * 1.7) > 0.95 ? 1 : 0));
      });
      // Sold out: hungry customers still come, and turn away.
      if (out) {
        const every = (60 / restaurantRate(r.level)) * 1.5;
        if ((this.refuseClock[lot.id] = (this.refuseClock[lot.id] ?? 0) + dt) >= every) {
          this.refuseClock[lot.id] = 0;
          if (this.walkers.filter((w) => w.rest === lot.id && w.paid === 0).length < 2) this.walker(this.door(lot.id), lot.id, 0);
        }
      }
    }
    this.stepWalkers(dt);
    this.stepCars(dt);
    this.drawPlant();
    this.stepEffects(dt);
  }

  // ---------- juice ----------

  /** Coins burst out of a till and fly to your money (world pixels). */
  burst(id: RestaurantId, amount: number, toX: number, toY: number): void {
    const lot = this.lot(id), sp = this.spots(id);
    const x0 = lot.x, y0 = lot.front - sp.h - 4;
    const n = Math.max(6, Math.min(24, Math.round(Math.log10(Math.max(10, amount)) * 4)));
    for (let k = 0; k < n; k++) {
      const s = this.coinLayer.addChild(new Sprite(this.cached('coin', coinCanvas)));
      s.anchor.set(0.5);
      this.coins.push({ s, x0: x0 + (Math.random() - 0.5) * 16, y0: y0 + (Math.random() - 0.5) * 8, x1: toX, y1: toY, t: -k * 0.035, dur: 0.6 + Math.random() * 0.2 });
    }
    for (let k = 0; k < 10; k++) this.spark(x0, y0, PAL.goldLight, 1.4, 0.5);
  }

  /** Smoke puff around a restaurant on a level-up; on a milestone, fireworks too. */
  puff(id: RestaurantId, milestone: boolean): void {
    const lot = this.lot(id), sp = this.spots(id);
    for (let k = 0; k < (milestone ? 26 : 12); k++) {
      const a = (k / 12) * Math.PI * 2;
      this.sparks.push({ x: lot.x + Math.cos(a) * sp.w * 0.3, y: lot.front - sp.h / 2 + Math.sin(a) * sp.h * 0.3, vx: Math.cos(a) * 30, vy: Math.sin(a) * 20 - 10, t: 0, life: 0.5, color: PAL.white, size: 4, gravity: 0 });
    }
    if (!milestone) return;
    // Fireworks: five big bursts over the building, one after another.
    const colors = [PAL.redLight, PAL.goldLight, PAL.waterLight, '#b45ad6', PAL.greenLight];
    for (let b = 0; b < 5; b++) {
      const cx = lot.x + (Math.random() - 0.5) * 70, cy = lot.front - sp.h - 30 - Math.random() * 40;
      for (let k = 0; k < 28; k++) {
        const a = (k / 28) * Math.PI * 2, v = 45 + Math.random() * 35;
        this.sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: -b * 0.3, life: 1.3, color: colors[(b + k) % colors.length]!, size: 3, gravity: 45 });
      }
    }
  }

  private spark(x: number, y: number, color: string, life: number, speed: number): void {
    const a = Math.random() * Math.PI * 2, v = (20 + Math.random() * 40) * speed;
    this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, t: 0, life, color, size: 2, gravity: 60 });
  }

  private stepEffects(dt: number): void {
    for (const c of this.coins) {
      c.t += dt;
      const p = Math.max(0, Math.min(1, c.t / c.dur)), e = p * p * (3 - 2 * p);
      // A hop up out of the till, then an arc to the money.
      const x = c.x0 + (c.x1 - c.x0) * e, y = c.y0 + (c.y1 - c.y0) * e - Math.sin(p * Math.PI) * 30;
      c.s.visible = c.t >= 0;
      c.s.position.set(Math.round(x), Math.round(y));
      c.s.scale.set(1 + Math.sin(p * Math.PI) * 0.6);
    }
    const landed = this.coins.filter((c) => c.t >= c.dur);
    for (const c of landed) c.s.destroy();
    this.coins = this.coins.filter((c) => c.t < c.dur);
    const g = this.fxTop;
    for (const s of this.sparks) {
      s.t += dt;
      if (s.t < 0) continue;
      s.vy += s.gravity * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const k = 1 - s.t / s.life;
      g.rect(Math.round(s.x), Math.round(s.y), s.size, s.size).fill({ color: s.color, alpha: Math.max(0, k) });
    }
    this.sparks = this.sparks.filter((s) => s.t < s.life);
  }

  private stepWalkers(dt: number): void {
    const T = this.T;
    for (const w of this.walkers) {
      w.t += dt;
      if (w.phase === 'walk' || w.phase === 'leave') {
        w.x += w.dir * w.speed * dt;
        if ((w.dir > 0 && w.x >= w.to) || (w.dir < 0 && w.x <= w.to)) {
          w.x = w.to;
          if (w.phase === 'leave' || !w.rest) { w.phase = 'leave'; w.t = -1; continue; }
          if (w.paid > 0) {
            w.phase = 'inside'; w.t = 0; w.s.visible = false;
            if (this.game.restaurants[w.rest]?.manager) this.float(`+$${w.paid.toLocaleString()}`, this.door(w.rest), this.lot(w.rest).front - 24, 'good');
          } else {
            w.phase = 'refuse'; w.t = 0;
            w.bubble = this.walkLayer.addChild(new Sprite(this.cached('bubble', bubbleCanvas)));
            w.bubble.anchor.set(0.5, 1);
          }
        }
      } else if (w.phase === 'inside' && w.t > 2.5) {
        // Take the outside table if it's free, else just head off.
        const table = this.spots(w.rest!).table;
        if (table !== null && !this.seats[w.rest!]) { this.seats[w.rest!] = w; w.phase = 'eat'; w.t = 0; w.s.visible = true; w.x = this.lotX(w.rest!) + table - 6; w.dir = 1; }
        else this.leave(w);
      } else if (w.phase === 'eat' && w.t > 5) {
        delete this.seats[w.rest!];
        w.x = this.door(w.rest!);
        this.leave(w);
      } else if (w.phase === 'refuse' && w.t > 1.3) {
        w.bubble?.destroy();
        w.bubble = undefined;
        w.dir = w.dir > 0 ? -1 : 1;
        w.to = w.dir > 0 ? T.w + 8 : -8;
        w.phase = 'leave';
      }
      const moving = w.phase === 'walk' || w.phase === 'leave';
      const pose: WalkerPose = w.phase === 'eat' ? 'sit' : moving ? (Math.floor(w.t * 7) % 2 ? 'walk1' : 'walk2') : 'stand';
      w.s.texture = this.look(w.look, pose);
      w.s.scale.x = w.dir;
      w.s.position.set(Math.round(w.x), w.phase === 'eat' ? this.lot(w.rest!).front - 1 : w.y);
      w.bubble?.position.set(Math.round(w.x), w.y - 14);
    }
    const gone = this.walkers.filter((w) => w.phase === 'leave' && (w.x < -10 || w.x > T.w + 10));
    for (const w of gone) w.s.destroy();
    this.walkers = this.walkers.filter((w) => !gone.includes(w));
  }

  private leave(w: Walker): void {
    w.s.visible = true;
    w.phase = 'leave';
    w.t = 0;
    w.dir = w.x > this.T.w / 2 ? 1 : -1;
    w.to = w.dir > 0 ? this.T.w + 12 : -12;
  }

  private stepCars(dt: number): void {
    for (const c of this.cars) {
      c.t += dt;
      if (c.phase === 'stop') {
        if (c.t > c.wait) {
          c.phase = 'away';
          if (c.then === 'on') c.to = this.T.w + 24; // delivered: drive on
          else {
            // Unloaded: the fish truck heads back, its bed empty.
            if (c.kind === 'fish') c.s.texture = this.cached('car:fish:0', () => vehicleCanvas('fish', false));
            c.dir = c.dir > 0 ? -1 : 1;
            c.to = -30;
          }
        }
      } else {
        // Wait behind whatever is ahead in the lane.
        const ahead = this.cars.some((o) => o !== c && o.lane === c.lane && o.dir === c.dir && (o.x - c.x) * c.dir > 0 && (o.x - c.x) * c.dir < (WIDTH[o.kind] + WIDTH[c.kind]) / 2 + 3);
        const speed = ahead ? 0 : c.kind === 'lorry' ? 30 : 38;
        c.x += c.dir * speed * dt * (c.phase === 'go' && Math.abs(c.to - c.x) < 10 ? 0.5 : 1);
        if ((c.dir > 0 && c.x >= c.to) || (c.dir < 0 && c.x <= c.to)) {
          c.x = c.to;
          if (c.phase === 'go' && c.then !== 'off') { c.phase = 'stop'; c.t = 0; }
          else { c.phase = 'away'; c.t = -1; }
        }
      }
      c.s.scale.x = c.dir;
      c.s.position.set(Math.round(c.x), this.laneY(c.lane));
    }
    // Gone: off the screen, or a van back inside the plant.
    const done = this.cars.filter((c) => c.phase === 'away' && c.t < 0);
    for (const c of done) c.s.destroy();
    this.cars = this.cars.filter((c) => !done.includes(c));
  }

  /** Crates of fish waiting at the plant door (a tall pile: the lines can't keep up) and the window conveyor. */
  private drawPlant(): void {
    const T = this.T, g = this.fx.clear(), game = this.game;
    if (!game.plant) return;
    const cap = game.plantCapacity() * PLANT_BACKLOG_MIN, stock = game.stockCount();
    const crates = stock ? Math.max(1, Math.min(9, Math.ceil((stock / Math.max(1, cap)) * 9))) : 0;
    for (let k = 0; k < crates; k++) {
      const x = T.plantX - 28 + (k % 3) * 7, y = T.back - 6 - Math.floor(k / 3) * 5;
      g.rect(x, y, 7, 6).fill(PAL.outline).rect(x + 1, y + 1, 5, 4).fill(PAL.sandLight).rect(x + 1, y + 3, 5, 1).fill(PAL.sandMid).rect(x + 2, y, 3, 1).fill(PAL.waterLight);
    }
    const running = LINE_ORDER.filter((id) => game.plantLines[id]?.jobs.length);
    if (!running.length) return;
    const y = T.back - 23, x0 = T.plantX - 26, len = 52;
    for (let k = 0; k < 8; k++) {
      const x = x0 + ((this.time * 9 + k * (len / 8)) % len);
      g.rect(Math.round(x), y, 3, 2).fill(ITEM[running[k % running.length]!]);
    }
  }
}
