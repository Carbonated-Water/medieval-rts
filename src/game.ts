import {
  ARMY_MAX, CAPITAL_SPAWN, CITY_DEFENSE, NATIONS, NEUTRAL, NEUTRAL_GARRISON, NEUTRAL_TOWNS, PLAYER,
  SPAWN_EVERY, START_ARMY, START_RADIUS, TERRITORY_BONUS_MAX, TERRITORY_PER_BONUS, TOWN_SPAWN,
} from './config';
import { hexDistance, hexPath, type Hex } from './hex';
import { generateWorld, mulberry32, type World } from './world';

export interface Nation {
  id: number;
  name: string;
  color: number;
  alive: boolean;
  capitalId: number;
  /** Hexes owned. */
  territory: number;
}

export interface City {
  id: number;
  col: number;
  row: number;
  capital: boolean;
  owner: number; // nation id or NEUTRAL
  spawnTimer: number;
}

export interface Army {
  id: number;
  owner: number; // nation id or NEUTRAL (town garrisons)
  count: number;
  /** The hex the army is on (or leaving, while mid-step). */
  col: number;
  row: number;
  /** Hexes still to walk; path[0] is the hex being stepped into. */
  path: Hex[];
  /** 0..1 progress of the current step. */
  step: number;
}

export type GameEvent = { seq: number; at: number } & (
  | { type: 'battle'; col: number; row: number; winner: number; loser: number; lost: number }
  | { type: 'capture'; cityId: number; from: number; to: number }
  | { type: 'eliminated'; nation: number; by: number }
);
type EventBody = GameEvent extends infer E ? (E extends unknown ? Omit<E, 'seq' | 'at'> : never) : never;

export class Game {
  readonly world: World;
  readonly nations: Nation[];
  readonly cities: City[] = [];
  readonly armies: Army[] = [];
  readonly seed: number;
  readonly events: GameEvent[] = [];
  /** Last nation standing (set when only one is left). */
  winner: number | null = null;
  time = 0;
  private nextId = 1;
  private eventSeq = 0;
  private landCache = 0;

  constructor(seed: number, bots = NATIONS.length - 1) {
    this.seed = seed;
    const count = Math.min(bots + 1, NATIONS.length);
    const gen = generateWorld(seed, count, NEUTRAL_TOWNS);
    this.world = gen.world;
    const rng = mulberry32(seed ^ 0x9e3779b9);

    this.nations = gen.capitals.map((_, i) => ({
      id: i, name: NATIONS[i]!.name, color: NATIONS[i]!.color, alive: true, capitalId: 0, territory: 0,
    }));
    gen.capitals.forEach((h, i) => {
      const city = this.addCity(h, true, i, rng);
      this.nations[i]!.capitalId = city.id;
      for (let r = 0; r < this.world.rows; r++)
        for (let c = 0; c < this.world.cols; c++)
          if (hexDistance(h, { col: c, row: r }) <= START_RADIUS && this.world.passable(c, r)) this.claim(c, r, i);
      this.addArmy(i, h.col, h.row, START_ARMY);
    });
    for (const h of gen.towns) {
      this.addCity(h, false, NEUTRAL, rng);
      const [lo, hi] = NEUTRAL_GARRISON;
      this.addArmy(NEUTRAL, h.col, h.row, lo + Math.floor(rng() * (hi - lo + 1)));
    }
  }

  // ---------- queries ----------

  get player(): Nation {
    return this.nations[PLAYER]!;
  }
  cityAt(col: number, row: number): City | undefined {
    return this.cities.find((c) => c.col === col && c.row === row);
  }
  /** Armies standing on (or leaving) a hex. */
  armiesAt(col: number, row: number): Army[] {
    return this.armies.filter((a) => a.col === col && a.row === row);
  }
  army(id: number): Army | undefined {
    return this.armies.find((a) => a.id === id);
  }
  /** Troops per spawn: towns a flat amount, capitals more plus a bonus for land owned. */
  spawnSize(city: City): number {
    if (city.owner === NEUTRAL) return 0;
    if (!city.capital) return TOWN_SPAWN;
    return CAPITAL_SPAWN + Math.min(TERRITORY_BONUS_MAX, Math.floor(this.nations[city.owner]!.territory / TERRITORY_PER_BONUS));
  }
  /** Share of all passable hexes owned by a nation, 0..1. */
  share(nation: number): number {
    return this.nations[nation]!.territory / this.land;
  }
  /** Passable hexes on the map (terrain never changes, so counted once). */
  get land(): number {
    if (this.landCache === 0)
      for (let i = 0; i < this.world.terrain.length; i++)
        if (this.world.passable(i % this.world.cols, Math.floor(i / this.world.cols))) this.landCache++;
    return this.landCache;
  }
  alive(): Nation[] {
    return this.nations.filter((n) => n.alive);
  }

  // ---------- orders ----------

  /**
   * March an army to a hex. With `amount` (less than the army, army
   * standing still), only that many troops split off and march; the rest
   * stay. Returns the marching army, or null if there's no route.
   */
  move(armyId: number, col: number, row: number, amount?: number): Army | null {
    const a = this.army(armyId);
    if (!a || a.owner === NEUTRAL || !this.world.passable(col, row)) return null;
    // Mid-step, the new route starts from the hex being stepped into.
    const from = a.step > 0 && a.path[0] ? a.path[0] : { col: a.col, row: a.row };
    const path = hexPath(this.world.cols, this.world.rows, from, { col, row }, (c, r) => this.world.stepCost(c, r));
    if (!path) return null;
    let mover = a;
    if (amount !== undefined && amount >= 1 && amount < a.count && a.path.length === 0) {
      a.count -= amount;
      mover = this.addArmy(a.owner, a.col, a.row, amount);
    }
    // Mid-step: keep stepping into the current hex, then follow the new route.
    mover.path = mover.step > 0 && mover.path[0] ? [mover.path[0], ...path] : path;
    if (mover.step === 0 && path.length === 0) mover.path = [];
    return mover;
  }

  // ---------- simulation ----------

  tick(dt: number): void {
    if (this.winner !== null) return;
    this.time += dt;

    for (const city of this.cities) {
      if (city.owner === NEUTRAL) continue;
      city.spawnTimer += dt;
      if (city.spawnTimer < SPAWN_EVERY) continue;
      city.spawnTimer -= SPAWN_EVERY;
      this.spawnAt(city);
    }

    for (const a of [...this.armies]) {
      if (a.count <= 0 || a.path.length === 0) continue;
      const next = a.path[0]!;
      a.step += dt / this.world.stepCost(next.col, next.row);
      if (a.step < 1) continue;
      a.step = 0;
      a.col = next.col;
      a.row = next.row;
      a.path.shift();
      this.arrive(a);
    }
  }

  private spawnAt(city: City): void {
    const n = this.spawnSize(city);
    // Join an army of ours that's standing on the city (not one marching off).
    const home = this.armiesAt(city.col, city.row).find((a) => a.owner === city.owner && a.path.length === 0);
    if (home) home.count = Math.min(ARMY_MAX, home.count + n);
    else if (!this.armiesAt(city.col, city.row).some((a) => a.owner !== city.owner)) this.addArmy(city.owner, city.col, city.row, n);
  }

  /** An army just stepped onto a hex: fight, merge, claim, capture. */
  private arrive(a: Army): void {
    const city = this.cityAt(a.col, a.row);
    for (const other of this.armiesAt(a.col, a.row)) {
      if (other === a || other.count <= 0) continue;
      if (other.owner === a.owner) {
        // Merge into a stationary army; marching ones just pass through.
        if (other.path.length === 0 && a.path.length === 0) {
          other.count = Math.min(ARMY_MAX, other.count + a.count);
          this.removeArmy(a);
          return;
        }
        continue;
      }
      // Battle. Defenders in a city they hold fight bigger.
      const defending = city && city.owner === other.owner ? CITY_DEFENSE : 1;
      const def = other.count * defending;
      if (a.count > def) {
        const lost = other.count;
        a.count = Math.max(1, Math.round(a.count - def));
        this.emit({ type: 'battle', col: a.col, row: a.row, winner: a.owner, loser: other.owner, lost });
        this.removeArmy(other);
      } else {
        const left = Math.round((def - a.count) / defending);
        this.emit({ type: 'battle', col: a.col, row: a.row, winner: other.owner, loser: a.owner, lost: a.count });
        if (left <= 0) this.removeArmy(other);
        else other.count = left;
        this.removeArmy(a);
        return;
      }
    }
    this.claim(a.col, a.row, a.owner);
    if (city && city.owner !== a.owner) this.capture(city, a.owner);
  }

  private capture(city: City, by: number): void {
    const from = city.owner;
    city.owner = by;
    city.spawnTimer = 0;
    this.emit({ type: 'capture', cityId: city.id, from, to: by });
    if (city.capital && from !== NEUTRAL) this.eliminate(from, by);
  }

  /**
   * A nation lost its capital: its cities go to the conqueror, its land goes
   * blank (handing over the land too snowballed games in a few minutes).
   */
  private eliminate(loser: number, by: number): void {
    const n = this.nations[loser]!;
    if (!n.alive) return;
    n.alive = false;
    for (const c of this.cities) if (c.owner === loser) c.owner = by;
    for (let i = 0; i < this.world.owner.length; i++) if (this.world.owner[i] === loser) this.world.owner[i] = -1;
    n.territory = 0;
    for (const c of this.cities) if (c.owner === by) this.claim(c.col, c.row, by);
    for (const a of [...this.armies]) if (a.owner === loser) this.removeArmy(a);
    this.emit({ type: 'eliminated', nation: loser, by });
    const left = this.alive();
    if (left.length === 1) this.winner = left[0]!.id;
  }

  private claim(col: number, row: number, nation: number): void {
    if (nation === NEUTRAL) return;
    const i = this.world.idx(col, row);
    const prev = this.world.owner[i]!;
    if (prev === nation) return;
    if (prev >= 0) this.nations[prev]!.territory--;
    this.world.owner[i] = nation;
    this.nations[nation]!.territory++;
  }

  private addCity(h: Hex, capital: boolean, owner: number, rng: () => number): City {
    // Stagger spawn timers so all cities don't tick on the same frame.
    const city: City = { id: this.nextId++, col: h.col, row: h.row, capital, owner, spawnTimer: rng() * SPAWN_EVERY };
    this.cities.push(city);
    return city;
  }

  private addArmy(owner: number, col: number, row: number, count: number): Army {
    const a: Army = { id: this.nextId++, owner, count, col, row, path: [], step: 0 };
    this.armies.push(a);
    return a;
  }

  private removeArmy(a: Army): void {
    a.count = 0;
    const i = this.armies.indexOf(a);
    if (i >= 0) this.armies.splice(i, 1);
  }

  private emit(e: EventBody): void {
    this.events.push({ ...e, seq: ++this.eventSeq, at: this.time } as GameEvent);
    if (this.events.length > 400) this.events.splice(0, 200);
  }
}
