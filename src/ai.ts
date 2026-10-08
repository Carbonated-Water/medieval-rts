import { CITY_DEFENSE, NEUTRAL, PLAYER } from './config';
import { hexDistance, type Hex } from './hex';
import type { Army, City, Game } from './game';
import { mulberry32 } from './world';

// Bots only use Game's public orders (move), same as the player.

interface Personality {
  name: string;
  /** Appetite for attacking other nations (cities, armies). */
  attack: number;
  /** Appetite for neutral towns and empty land. */
  expand: number;
  /** Troops kept home at the capital. */
  keep: number;
  /** Required strength over a target's defence before attacking. */
  margin: number;
}

const PERSONALITIES: Personality[] = [
  { name: 'aggressive', attack: 1.6, expand: 0.8, keep: 4, margin: 1.1 },
  { name: 'cautious', attack: 0.7, expand: 1.0, keep: 10, margin: 1.5 },
  { name: 'expansionist', attack: 1.0, expand: 1.6, keep: 6, margin: 1.25 },
];

const THINK_EVERY = 1.2; // seconds
const THREAT_RADIUS = 4; // hexes around the capital
const PAINT_RADIUS = 6; // how far a detachment wanders to grab empty land
const MIN_SEND = 3;
/** Capital garrisons grow by this many troops per minute of game time... */
const GARRISON_PER_MINUTE = 4;
/** ...from at least this, up to MAX_GARRISON. */
const MIN_GARRISON = 8;
/** How far away armies can be to join a combined attack. */
const GANG_RADIUS = 16;
const MAX_GARRISON = 40;

export class Bots {
  readonly personalities = new Map<number, Personality>();
  private timers = new Map<number, number>();
  private rng: () => number;

  constructor(private game: Game) {
    this.rng = mulberry32(game.seed ^ 0x5bd1e995);
    for (const n of game.nations) {
      if (n.id === PLAYER) continue;
      this.personalities.set(n.id, PERSONALITIES[Math.floor(this.rng() * PERSONALITIES.length)]!);
      this.timers.set(n.id, this.rng() * THINK_EVERY); // stagger
    }
  }

  tick(dt: number): void {
    if (this.game.winner !== null) return;
    for (const [id, t] of this.timers) {
      if (!this.game.nations[id]!.alive) continue;
      const next = t + dt;
      if (next < THINK_EVERY) { this.timers.set(id, next); continue; }
      this.timers.set(id, next - THINK_EVERY);
      this.think(id);
    }
  }

  private think(n: number): void {
    const g = this.game;
    const p = this.personalities.get(n)!;
    const capital = g.cities.find((c) => c.id === g.nations[n]!.capitalId)!;
    const mine = g.armies.filter((a) => a.owner === n);

    // Defend: if enemies near the capital outnumber its garrison, recall nearby idle armies.
    const threat = g.armies
      .filter((a) => a.owner !== n && a.owner !== NEUTRAL && hexDistance(a, capital) <= THREAT_RADIUS)
      .reduce((s, a) => s + a.count, 0);
    const garrison = mine.filter((a) => a.col === capital.col && a.row === capital.row && a.path.length === 0)
      .reduce((s, a) => s + a.count, 0);
    if (threat > garrison * CITY_DEFENSE) {
      for (const a of mine)
        if (a.path.length === 0 && hexDistance(a, capital) <= 10 && !(a.col === capital.col && a.row === capital.row))
          g.move(a.id, capital.col, capital.row);
    }

    // Troops an army must leave behind: capitals keep a garrison that grows
    // over the game (stripping capitals bare made nations fall in a
    // cascade), towns keep a token guard, field armies keep nothing.
    const keepFor = (a: Army) => {
      const home = g.cityAt(a.col, a.row);
      if (!home || home.owner !== n) return 0;
      if (!home.capital) return 2;
      const garrison = Math.min(MAX_GARRISON, Math.max(MIN_GARRISON, p.keep) + Math.floor((g.time / 60) * GARRISON_PER_MINUTE));
      return garrison + Math.ceil(threat / CITY_DEFENSE);
    };
    const used = this.gangUp(n, p, mine.filter((a) => a.path.length === 0), keepFor);

    const taken = new Set<string>(); // targets already chosen this think, to spread out
    for (const a of mine) {
      if (a.path.length > 0 || used.has(a.id)) continue;
      const home = g.cityAt(a.col, a.row);
      const spare = a.count - keepFor(a);
      if (spare < MIN_SEND) continue;
      const target = this.pickTarget(n, p, a, spare, taken);
      if (!target) continue;
      taken.add(`${target.hex.col},${target.hex.row}`);
      // From a city, send what the target needs and leave the rest home;
      // armies in the field move as a whole.
      const send = Math.min(spare, Math.max(target.need, MIN_SEND));
      g.move(a.id, target.hex.col, target.hex.row, home && home.owner === n && send < a.count ? send : undefined);
    }
  }

  /**
   * A city no single army can take, but nearby armies together can: send
   * them all. Battles subtract linearly, so they needn't arrive together.
   * Returns the ids of armies sent.
   */
  private gangUp(n: number, p: Personality, idle: Army[], keepFor: (a: Army) => number): Set<number> {
    const g = this.game;
    const spare = idle.map((a) => ({ a, spare: a.count - keepFor(a) })).filter((x) => x.spare >= MIN_SEND);
    const bestSingle = Math.max(0, ...spare.map((x) => x.spare));
    let best: { city: City; group: typeof spare; score: number } | null = null;
    for (const city of g.cities) {
      if (city.owner === n) continue;
      const need = Math.ceil(this.defence(city) * p.margin) + 1;
      if (need <= bestSingle) continue; // a single army can do it; handled below
      const group = spare.filter((x) => hexDistance(x.a, city) <= GANG_RADIUS);
      const total = group.reduce((s, x) => s + x.spare, 0);
      if (total < need) continue;
      const value = city.owner === NEUTRAL ? 5 * p.expand : (city.capital ? 9 : 5) * p.attack;
      const dist = group.reduce((s, x) => s + hexDistance(x.a, city), 0) / group.length;
      const score = value / (dist + 2);
      if (!best || score > best.score) best = { city, group, score };
    }
    const sent = new Set<number>();
    if (!best) return sent;
    for (const { a, spare: s } of best.group) {
      g.move(a.id, best.city.col, best.city.row, s < a.count ? s : undefined);
      sent.add(a.id);
    }
    return sent;
  }

  /** Best thing this army can beat: a city, an enemy army, or empty land to paint. */
  private pickTarget(n: number, p: Personality, a: Army, spare: number, taken: Set<string>): { hex: Hex; need: number } | null {
    const g = this.game;
    let best: { hex: Hex; need: number } | null = null;
    let bestScore = 0;
    const consider = (hex: Hex, need: number, value: number) => {
      if (need > spare || taken.has(`${hex.col},${hex.row}`)) return;
      const score = value / (hexDistance(a, hex) + 2);
      if (score > bestScore) { bestScore = score; best = { hex, need }; }
    };

    for (const city of g.cities) {
      if (city.owner === n) continue;
      const need = Math.ceil(this.defence(city) * p.margin) + 1;
      const value = city.owner === NEUTRAL ? 5 * p.expand : (city.capital ? 9 : 5) * p.attack;
      consider(city, need, value);
    }
    for (const e of g.armies) {
      if (e.owner === n || e.owner === NEUTRAL || hexDistance(a, e) > 8) continue;
      consider(e.path[e.path.length - 1] ?? e, Math.ceil(e.count * p.margin) + 1, 2 * p.attack);
    }
    // Empty or enemy land nearby: worth painting when nothing better is around.
    for (let tries = 0; tries < 24; tries++) {
      const col = a.col + Math.round((this.rng() * 2 - 1) * PAINT_RADIUS);
      const row = a.row + Math.round((this.rng() * 2 - 1) * PAINT_RADIUS);
      if (!g.world.passable(col, row) || g.world.ownerAt(col, row) === n) continue;
      if (g.armiesAt(col, row).some((x) => x.owner !== n)) continue;
      consider({ col, row }, MIN_SEND, 1.2 * p.expand);
    }
    return best;
  }

  /** Strength needed to take a city right now (garrison × city bonus). */
  private defence(city: City): number {
    return this.game.armiesAt(city.col, city.row)
      .filter((x) => x.owner === city.owner && x.path.length === 0)
      .reduce((s, x) => s + x.count, 0) * CITY_DEFENSE;
  }
}
