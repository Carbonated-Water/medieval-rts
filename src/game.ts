import {
  ARROW_SPEED, BUILDINGS, CARRY_CAP, ENEMY, GATHER_SECONDS, MINE_GOLD, MINE_SIZE, PLAYER, POP_MAX,
  SITE_HP_SHARE, START_PEASANTS, START_STOCK, TILE, TRAIN_QUEUE_MAX, UNITS,
  type BuildingKind, type Cost, type Owner, type ResourceKind, type UnitKind,
} from './config';
import { GameMap, generateTerrain, mulberry32 } from './map';
import { adjacentTo, findPath, type Pt, type Rect } from './path';

export interface Building {
  id: number;
  owner: Owner;
  kind: BuildingKind;
  tx: number;
  ty: number;
  size: number;
  /** 0..1 construction progress; 1 = complete. */
  progress: number;
  hp: number;
  maxHp: number;
  /** Units waiting to be trained, front first. */
  queue: UnitKind[];
  trainTimer: number;
}

export interface Mine {
  id: number;
  tx: number;
  ty: number;
  size: number;
  gold: number;
}

/**
 * What a unit is doing. `phase` says which leg of the job it's on:
 * walking to the work, working, or carrying the load home.
 */
export type Job =
  | { type: 'move' }
  | { type: 'gather'; kind: 'wood'; tx: number; ty: number; phase: 'go' | 'work' | 'return' }
  | { type: 'gather'; kind: 'gold'; mineId: number; phase: 'go' | 'work' | 'return' }
  | { type: 'build'; siteId: number; phase: 'go' | 'work' }
  /** Chase and hit `targetId`; when it dies, go after `then` if given. */
  | { type: 'attack'; targetId: number; then?: number; repathAt: number };

export interface Unit {
  id: number;
  owner: Owner;
  kind: UnitKind;
  x: number; // world px (tile centre = tile*TILE + TILE/2)
  y: number;
  hp: number;
  maxHp: number;
  path: Pt[];
  job: Job | null;
  carry: { kind: ResourceKind; amount: number } | null;
  work: number; // seconds into current work cycle
  cooldown: number; // seconds until the next attack is ready
  /** Game time of the last attack swing / shot (for the view). */
  lastAttack: number;
}

/** An arrow in flight. Homes on its target; hits when it arrives. */
export interface Projectile {
  id: number;
  owner: Owner;
  attackerId: number;
  targetId: number;
  x: number; // world px
  y: number;
  sx: number; // launch point, world px
  sy: number;
  damage: number;
}

export type GameEvent = { seq: number; at: number } & (
  | { type: 'death'; unit: Unit }
  | { type: 'destroyed'; building: Building }
);

type Entity = Unit | Building;

export const tileCenter = (t: number) => t * TILE + TILE / 2;
export const tileOf = (px: number) => Math.floor(px / TILE);
export const isUnit = (e: Entity): e is Unit => 'path' in e;
const rectOf = (e: { tx: number; ty: number; size: number }): Rect => ({ x: e.tx, y: e.ty, w: e.size, h: e.size });
/** Tile distance from a unit to an entity's centre. */
const distTo = (u: Unit, e: { tx: number; ty: number; size: number }) =>
  Math.hypot(e.tx + e.size / 2 - u.x / TILE, e.ty + e.size / 2 - u.y / TILE);

const ACQUIRE_EVERY = 0.4; // seconds between idle units scanning for enemies
const REPATH_EVERY = 0.7; // seconds between re-planning a chase

export class Game {
  readonly map = new GameMap();
  readonly units: Unit[] = [];
  readonly buildings = new Map<number, Building>();
  readonly mines = new Map<number, Mine>();
  readonly projectiles: Projectile[] = [];
  readonly stocks: [Record<ResourceKind, number>, Record<ResourceKind, number>] = [{ ...START_STOCK }, { ...START_STOCK }];
  /** Town hall id per owner. */
  readonly hallIds: [number, number] = [0, 0];
  readonly seed: number;
  /** True once the player has damaged anything of the AI's: from then on it's war. */
  provoked = false;
  winner: Owner | null = null;
  /** Things the view animates (deaths, destroyed buildings). Trimmed as it grows. */
  readonly events: GameEvent[] = [];
  /** Latest player-facing error ("not enough wood"); HUD shows it briefly. */
  notice: { text: string; at: number } | null = null;
  time = 0;
  private nextId = 1;
  private unitById = new Map<number, Unit>();
  private eventSeq = 0;
  private acquireTimer = 0;

  constructor(seed: number) {
    this.seed = seed;
    const rng = mulberry32(seed);
    const map = this.map;
    const jitter = () => Math.floor(rng() * 5) - 2;
    // Player bottom-left, AI top-right (as seen by the camera, which looks from +x,+z).
    const starts = [
      { x: Math.round(map.w * 0.22) + jitter(), y: Math.round(map.h * 0.78) + jitter() },
      { x: Math.round(map.w * 0.78) + jitter(), y: Math.round(map.h * 0.22) + jitter() },
    ];
    generateTerrain(map, rng, starts);
    for (const s of starts) map.clearArea(s.x, s.y, 4);

    starts.forEach((s, owner) => {
      const hall = this.addBuilding(owner as Owner, 'hall', s.x - 1, s.y - 1, 1);
      this.hallIds[owner] = hall.id;
    });
    // A starter gold mine near each town, and three contested ones in the middle.
    for (const s of starts) this.placeMine(rng, s.x, s.y, 6, 8);
    for (let i = 0; i < 3; i++) this.placeMine(rng, map.w / 2, map.h / 2, 0, 9);

    for (const owner of [PLAYER, ENEMY]) {
      const hall = this.buildings.get(this.hallIds[owner])!;
      for (let i = 0; i < START_PEASANTS; i++) this.spawnUnitNear(hall, 'peasant');
    }
  }

  // ---------- queries ----------

  /** The player's stock (the AI's is `stocks[ENEMY]`). */
  get stock(): Record<ResourceKind, number> {
    return this.stocks[PLAYER];
  }
  get hallId(): number {
    return this.hallIds[PLAYER];
  }
  get popCap(): number {
    return this.popCapOf(PLAYER);
  }
  get popUsed(): number {
    return this.popUsedOf(PLAYER);
  }
  popCapOf(owner: Owner): number {
    let cap = 0;
    for (const b of this.buildings.values()) if (b.owner === owner && b.progress >= 1) cap += BUILDINGS[b.kind].pop;
    return Math.min(cap, POP_MAX);
  }
  popUsedOf(owner: Owner): number {
    let n = 0;
    for (const u of this.units) if (u.owner === owner) n++;
    for (const b of this.buildings.values()) if (b.owner === owner) n += b.queue.length;
    return n;
  }
  canAfford(cost: Cost, owner: Owner = PLAYER): boolean {
    return (Object.keys(cost) as ResourceKind[]).every((k) => this.stocks[owner][k] >= (cost[k] ?? 0));
  }
  /** "need 20 wood" for the largest shortfall, or null if affordable. */
  shortfall(cost: Cost, owner: Owner = PLAYER): string | null {
    let worst: string | null = null;
    let gap = 0;
    for (const k of Object.keys(cost) as ResourceKind[]) {
      const d = (cost[k] ?? 0) - this.stocks[owner][k];
      if (d > gap) { gap = d; worst = `need ${d} more ${k}`; }
    }
    return worst;
  }
  canPlace(kind: BuildingKind, tx: number, ty: number): boolean {
    return this.map.areaFree(tx, ty, BUILDINGS[kind].size);
  }
  idleUnits(owner: Owner = PLAYER, kind?: UnitKind): Unit[] {
    return this.units.filter((u) => u.owner === owner && u.job === null && (!kind || u.kind === kind));
  }
  unit(id: number): Unit | undefined {
    return this.unitById.get(id);
  }
  entity(id: number): Entity | undefined {
    return this.unitById.get(id) ?? this.buildings.get(id);
  }

  // ---------- orders ----------

  /**
   * Contextual order for units of one owner: tapping a tree / mine / site /
   * enemy building / ground. Only peasants gather and build; soldiers sent
   * to a resource or site just walk there.
   */
  orderAt(units: Unit[], tx: number, ty: number): void {
    if (units.length === 0) return;
    const owner = units[0]!.owner;
    const map = this.map;
    const peasants = units.filter((u) => u.kind === 'peasant');
    const soldiers = units.filter((u) => u.kind !== 'peasant');

    const occ = map.occupantAt(tx, ty);
    const b = this.buildings.get(occ);
    if (b && b.owner !== owner) return this.orderAttack(units, b.id);

    if (map.hasTree(tx, ty)) {
      for (const u of peasants) this.startGather(u, { type: 'gather', kind: 'wood', tx, ty, phase: 'go' });
      return this.moveGroup(soldiers, tx, ty);
    }
    const mine = this.mines.get(occ);
    if (mine) {
      for (const u of peasants) this.startGather(u, { type: 'gather', kind: 'gold', mineId: mine.id, phase: 'go' });
      return this.moveGroup(soldiers, tx, ty);
    }
    if (b && b.progress < 1) {
      for (const u of peasants) this.assignBuild(u, b);
      return this.moveGroup(soldiers, tx, ty);
    }
    if (b) {
      // Tapped an own finished building: drop off what they carry if it
      // accepts it, otherwise just walk up to it.
      for (const u of units) {
        if (u.job?.type === 'gather' && u.carry && BUILDINGS[b.kind].dropOff.includes(u.carry.kind)) {
          u.job.phase = 'return';
          u.path = this.pathTo(u, rectOf(b)) ?? [];
        } else {
          u.job = { type: 'move' };
          u.path = this.pathTo(u, rectOf(b)) ?? [];
        }
      }
      return;
    }
    this.moveGroup(units, tx, ty);
  }

  /** Send units after an enemy unit or building. `then` = who to go after next. */
  orderAttack(units: Unit[], targetId: number, then?: number): void {
    const target = this.entity(targetId);
    if (!target) return;
    for (const u of units) {
      if (u.owner === target.owner) continue;
      u.job = { type: 'attack', targetId, then, repathAt: 0 };
      u.path = [];
    }
  }

  placeBuilding(kind: BuildingKind, tx: number, ty: number, builders: Unit[], owner: Owner = PLAYER): boolean {
    const def = BUILDINGS[kind];
    if (!this.canPlace(kind, tx, ty)) return this.fail(owner, 'can\'t build there');
    const short = this.shortfall(def.cost, owner);
    if (short) return this.fail(owner, short);
    this.pay(owner, def.cost);
    const site = this.addBuilding(owner, kind, tx, ty, 0);
    for (const u of builders) if (u.kind === 'peasant' && u.owner === owner) this.assignBuild(u, site);
    return true;
  }

  /** Queue a unit at a building. `kind` defaults to the first unit it trains. */
  train(b: Building, kind: UnitKind | undefined = BUILDINGS[b.kind].trains[0]): boolean {
    if (!kind || !BUILDINGS[b.kind].trains.includes(kind) || b.progress < 1) return false;
    const owner = b.owner;
    if (b.queue.length >= TRAIN_QUEUE_MAX) return this.fail(owner, 'queue full');
    if (this.popUsedOf(owner) >= this.popCapOf(owner)) return this.fail(owner, 'need more houses');
    const cost = UNITS[kind].cost;
    const short = this.shortfall(cost, owner);
    if (short) return this.fail(owner, short);
    this.pay(owner, cost);
    b.queue.push(kind);
    return true;
  }

  // ---------- simulation ----------

  tick(dt: number): void {
    if (this.winner !== null) return;
    this.time += dt;
    for (const u of [...this.units]) if (u.hp > 0) this.tickUnit(u, dt);
    this.tickProjectiles(dt);
    for (const b of [...this.buildings.values()]) {
      const next = b.queue[0];
      if (!next || b.progress < 1) continue;
      b.trainTimer += dt;
      if (b.trainTimer >= UNITS[next].trainSeconds) {
        b.trainTimer = 0;
        b.queue.shift();
        this.spawnUnitNear(b, next);
      }
    }
    this.acquireTimer += dt;
    if (this.acquireTimer >= ACQUIRE_EVERY) {
      this.acquireTimer = 0;
      this.autoAcquire();
    }
  }

  private tickUnit(u: Unit, dt: number): void {
    u.cooldown = Math.max(0, u.cooldown - dt);
    const job = u.job;
    if (job?.type === 'attack') return this.tickAttack(u, job, dt);
    if (u.path.length > 0) {
      this.step(u, dt);
      if (u.path.length === 0) this.arrive(u);
      return;
    }
    if (!job) return;
    if (job.type === 'gather' && job.phase === 'work') {
      if (!this.resourceExists(job)) return this.retargetGather(u, job);
      u.work += dt;
      if (u.work >= GATHER_SECONDS[job.kind]) {
        u.work = 0;
        u.carry = { kind: job.kind, amount: this.takeResource(job) };
        job.phase = 'return';
        this.headHome(u, job.kind);
      }
    } else if (job.type === 'build' && job.phase === 'work') {
      const site = this.buildings.get(job.siteId);
      if (!site || site.progress >= 1) { u.job = null; return; }
      const gain = Math.min(1 - site.progress, dt / BUILDINGS[site.kind].buildSeconds);
      site.progress += gain;
      site.hp = Math.min(site.maxHp, site.hp + site.maxHp * (1 - SITE_HP_SHARE) * gain);
      if (site.progress >= 1) {
        site.progress = 1;
        for (const other of this.units)
          if (other.job?.type === 'build' && other.job.siteId === site.id) other.job = null;
      }
    }
  }

  private tickAttack(u: Unit, job: Extract<Job, { type: 'attack' }>, dt: number): void {
    const target = this.entity(job.targetId);
    if (!target || target.owner === u.owner) {
      const next = job.then !== undefined ? this.entity(job.then) : undefined;
      if (next && next.owner !== u.owner) u.job = { type: 'attack', targetId: next.id, repathAt: 0 };
      else { u.job = null; u.path = []; }
      return;
    }
    const def = UNITS[u.kind];
    if (this.distToEntity(u, target) <= def.range) {
      u.path = [];
      if (u.cooldown <= 0) {
        this.strike(u, target);
        u.cooldown = def.cooldown;
      }
      return;
    }
    if (u.path.length === 0 || this.time >= job.repathAt) {
      job.repathAt = this.time + REPATH_EVERY;
      const path = this.pathInRange(u, target, def.range);
      if (!path) { u.job = null; u.path = []; return; }
      // Already on an in-range tile but off its centre: step to the centre.
      u.path = path.length > 0 ? path : [{ x: tileOf(u.x), y: tileOf(u.y) }];
    }
    this.step(u, dt);
  }

  private strike(u: Unit, target: Entity): void {
    const def = UNITS[u.kind];
    u.lastAttack = this.time;
    if (def.ranged) {
      this.projectiles.push({
        id: this.nextId++, owner: u.owner, attackerId: u.id, targetId: target.id,
        x: u.x, y: u.y, sx: u.x, sy: u.y, damage: def.damage,
      });
    } else {
      this.damage(target, def.damage, u.owner, u);
    }
  }

  private tickProjectiles(dt: number): void {
    const step = ARROW_SPEED * TILE * dt;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]!;
      const target = this.entity(p.targetId);
      if (!target) { this.projectiles.splice(i, 1); continue; }
      const { x: tx, y: ty } = this.centerPx(target);
      const d = Math.hypot(tx - p.x, ty - p.y);
      if (d <= step) {
        this.projectiles.splice(i, 1);
        this.damage(target, p.damage, p.owner, this.unitById.get(p.attackerId));
      } else {
        p.x += ((tx - p.x) / d) * step;
        p.y += ((ty - p.y) / d) * step;
      }
    }
  }

  /** Apply damage; handles provocation, retaliation, deaths and destruction. */
  private damage(target: Entity, amount: number, by: Owner, attacker: Unit | undefined): void {
    if (target.hp <= 0) return;
    if (by === PLAYER && target.owner === ENEMY) this.provoked = true;
    target.hp -= amount;
    if (target.hp <= 0) {
      if (isUnit(target)) this.kill(target);
      else this.destroy(target);
      return;
    }
    // Hit back: soldiers always, peasants only against someone right next to them.
    if (isUnit(target) && attacker && attacker.hp > 0 && target.job?.type !== 'attack') {
      const close = Math.hypot(attacker.x - target.x, attacker.y - target.y) / TILE <= 2.5;
      if (target.kind !== 'peasant' || close) {
        target.job = { type: 'attack', targetId: attacker.id, repathAt: 0 };
        target.path = [];
      }
    }
  }

  private kill(u: Unit): void {
    u.hp = 0;
    const i = this.units.indexOf(u);
    if (i >= 0) this.units.splice(i, 1);
    this.unitById.delete(u.id);
    this.emit({ type: 'death', unit: u });
  }

  private destroy(b: Building): void {
    b.hp = 0;
    this.buildings.delete(b.id);
    this.map.setOccupant(b.tx, b.ty, b.size, 0);
    this.emit({ type: 'destroyed', building: b });
    if (b.id === this.hallIds[b.owner]) this.winner = b.owner === PLAYER ? ENEMY : PLAYER;
  }

  /**
   * Once at war, idle soldiers pick a fight with the nearest enemy unit in
   * their aggro range, and soldiers attacking a building switch to enemy
   * units that come close (then resume on the building).
   */
  private autoAcquire(): void {
    if (!this.provoked) return;
    for (const u of this.units) {
      const def = UNITS[u.kind];
      if (def.aggro === 0) continue;
      const job = u.job;
      const sieging = job?.type === 'attack' && !this.unitById.has(job.targetId);
      if (job !== null && !sieging) continue;
      const foe = this.nearestEnemyUnit(u, sieging ? def.aggro * 0.7 : def.aggro);
      if (!foe) continue;
      u.job = { type: 'attack', targetId: foe.id, then: sieging ? job!.targetId : undefined, repathAt: 0 };
      u.path = [];
    }
  }

  private nearestEnemyUnit(u: Unit, range: number): Unit | null {
    let best: Unit | null = null;
    let bestD = range * TILE;
    for (const o of this.units) {
      if (o.owner === u.owner) continue;
      const d = Math.hypot(o.x - u.x, o.y - u.y);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }

  private step(u: Unit, dt: number): void {
    let budget = UNITS[u.kind].speed * dt;
    while (budget > 0 && u.path.length > 0) {
      const next = u.path[0]!;
      // Re-plan if something got built on the path since we planned it.
      if (!this.map.passable(next.x, next.y) && !(tileOf(u.x) === next.x && tileOf(u.y) === next.y)) {
        this.replan(u);
        return;
      }
      const nx = tileCenter(next.x);
      const ny = tileCenter(next.y);
      const d = Math.hypot(nx - u.x, ny - u.y);
      if (d <= budget) {
        u.x = nx;
        u.y = ny;
        budget -= d;
        u.path.shift();
      } else {
        u.x += ((nx - u.x) / d) * budget;
        u.y += ((ny - u.y) / d) * budget;
        budget = 0;
      }
    }
  }

  private replan(u: Unit): void {
    const job = u.job;
    const last = u.path[u.path.length - 1]!;
    u.path = [];
    if (!job || job.type === 'move') {
      u.path = this.pathToTile(u, last.x, last.y) ?? [];
      if (u.path.length === 0) u.job = null;
    } else if (job.type === 'attack') {
      job.repathAt = 0;
    } else if (job.type === 'gather') {
      if (job.phase === 'return') this.headHome(u, job.kind);
      else this.startGather(u, job);
    } else {
      const site = this.buildings.get(job.siteId);
      if (site) this.assignBuild(u, site);
      else u.job = null;
    }
  }

  private arrive(u: Unit): void {
    const job = u.job;
    if (!job || job.type === 'attack') return;
    if (job.type === 'move') { u.job = null; return; }
    if (job.type === 'build') {
      const site = this.buildings.get(job.siteId);
      if (site && adjacentTo(rectOf(site), tileOf(u.x), tileOf(u.y))) job.phase = 'work';
      else if (site) this.assignBuild(u, site);
      else u.job = null;
      return;
    }
    if (job.phase === 'go') {
      if (!this.resourceExists(job)) return this.retargetGather(u, job);
      job.phase = 'work';
      u.work = 0;
    } else if (job.phase === 'return') {
      const drop = this.dropOffNextTo(u);
      if (!drop || !u.carry) { this.headHome(u, job.kind); return; }
      this.stocks[u.owner][u.carry.kind] += u.carry.amount;
      u.carry = null;
      if (this.resourceExists(job)) this.startGather(u, { ...job, phase: 'go' });
      else this.retargetGather(u, job);
    }
  }

  // ---------- helpers ----------

  private fail(owner: Owner, text: string): false {
    if (owner === PLAYER) this.notice = { text, at: this.time };
    return false;
  }

  private pay(owner: Owner, cost: Cost): void {
    for (const k of Object.keys(cost) as ResourceKind[]) this.stocks[owner][k] -= cost[k] ?? 0;
  }

  private emit(e: { type: 'death'; unit: Unit } | { type: 'destroyed'; building: Building }): void {
    this.events.push({ ...e, seq: ++this.eventSeq, at: this.time } as GameEvent);
    if (this.events.length > 400) this.events.splice(0, 200);
  }

  private addBuilding(owner: Owner, kind: BuildingKind, tx: number, ty: number, progress: number): Building {
    const maxHp = BUILDINGS[kind].hp;
    const b: Building = {
      id: this.nextId++, owner, kind, tx, ty, size: BUILDINGS[kind].size, progress,
      hp: progress >= 1 ? maxHp : maxHp * SITE_HP_SHARE, maxHp, queue: [], trainTimer: 0,
    };
    this.buildings.set(b.id, b);
    this.map.setOccupant(tx, ty, b.size, b.id);
    return b;
  }

  private placeMine(rng: () => number, sx: number, sy: number, minD: number, maxD: number): void {
    const map = this.map;
    for (let tries = 0; tries < 200; tries++) {
      const a = rng() * Math.PI * 2;
      const d = minD + rng() * (maxD - minD);
      const tx = Math.round(sx + Math.cos(a) * d);
      const ty = Math.round(sy + Math.sin(a) * d);
      if (tx < 2 || ty < 2 || tx + MINE_SIZE > map.w - 2 || ty + MINE_SIZE > map.h - 2) continue;
      // Clear the footprint + a 1-tile ring so it's always approachable.
      for (let y = ty - 1; y <= ty + MINE_SIZE; y++)
        for (let x = tx - 1; x <= tx + MINE_SIZE; x++) map.tree[map.idx(x, y)] = 0;
      if (!map.areaFree(tx, ty, MINE_SIZE)) continue;
      const m: Mine = { id: this.nextId++, tx, ty, size: MINE_SIZE, gold: MINE_GOLD };
      this.mines.set(m.id, m);
      map.setOccupant(tx, ty, MINE_SIZE, m.id);
      map.treeVersion++;
      return;
    }
  }

  /** Put a new unit on the first free tile around a building (training, and tests). */
  spawnUnitNear(b: Building, kind: UnitKind): Unit | null {
    // First free tile in the ring around the building, walking outward.
    // Scan from the far corner back so new units appear on the front
    // (camera-facing) side of the building rather than hidden behind it.
    for (let r = 1; r < 6; r++)
      for (let y = b.ty + b.size + r - 1; y >= b.ty - r; y--)
        for (let x = b.tx + b.size + r - 1; x >= b.tx - r; x--) {
          if (!this.map.passable(x, y)) continue;
          if (this.units.some((u) => tileOf(u.x) === x && tileOf(u.y) === y)) continue;
          const def = UNITS[kind];
          const u: Unit = {
            id: this.nextId++, owner: b.owner, kind, x: tileCenter(x), y: tileCenter(y),
            hp: def.hp, maxHp: def.hp, path: [], job: null, carry: null, work: 0, cooldown: 0, lastAttack: -Infinity,
          };
          this.units.push(u);
          this.unitById.set(u.id, u);
          return u;
        }
    return null;
  }

  private centerPx(e: Entity): { x: number; y: number } {
    return isUnit(e) ? { x: e.x, y: e.y } : { x: (e.tx + e.size / 2) * TILE, y: (e.ty + e.size / 2) * TILE };
  }

  /** Tiles from a unit to a unit's centre, or to the nearest edge of a building. */
  private distToEntity(u: Unit, e: Entity): number {
    const ux = u.x / TILE, uy = u.y / TILE;
    if (isUnit(e)) return Math.hypot(e.x / TILE - ux, e.y / TILE - uy);
    const dx = Math.max(e.tx - ux, 0, ux - (e.tx + e.size));
    const dy = Math.max(e.ty - uy, 0, uy - (e.ty + e.size));
    return Math.hypot(dx, dy);
  }

  /** Path to the nearest tile from which `target` is within `range`. */
  private pathInRange(u: Unit, target: Entity, range: number): Pt[] | null {
    const reach = range * 0.9;
    const near = (x: number, y: number) => {
      const cx = x + 0.5, cy = y + 0.5;
      if (isUnit(target)) return Math.hypot(target.x / TILE - cx, target.y / TILE - cy) <= reach;
      const dx = Math.max(target.tx - cx, 0, cx - (target.tx + target.size));
      const dy = Math.max(target.ty - cy, 0, cy - (target.ty + target.size));
      return Math.hypot(dx, dy) <= reach;
    };
    const rect = isUnit(target) ? { x: tileOf(target.x), y: tileOf(target.y), w: 1, h: 1 } : rectOf(target);
    return findPath(this.map, tileOf(u.x), tileOf(u.y), near, rect);
  }

  private pathTo(u: Unit, r: Rect): Pt[] | null {
    return findPath(this.map, tileOf(u.x), tileOf(u.y), (x, y) => adjacentTo(r, x, y), r);
  }
  private pathToTile(u: Unit, tx: number, ty: number): Pt[] | null {
    return findPath(this.map, tileOf(u.x), tileOf(u.y), (x, y) => x === tx && y === ty, { x: tx, y: ty, w: 1, h: 1 });
  }

  private moveGroup(units: Unit[], tx: number, ty: number): void {
    // Hand each unit its own free tile, spiralling out from the tap.
    const taken = new Set<number>();
    for (const u of units) {
      let dest: Pt | null = null;
      for (let r = 0; r < 5 && !dest; r++)
        for (let y = ty - r; y <= ty + r && !dest; y++)
          for (let x = tx - r; x <= tx + r && !dest; x++) {
            if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) !== r) continue;
            if (this.map.passable(x, y) && !taken.has(this.map.idx(x, y))) dest = { x, y };
          }
      if (!dest) continue;
      taken.add(this.map.idx(dest.x, dest.y));
      const path = this.pathToTile(u, dest.x, dest.y);
      if (!path) continue;
      u.job = { type: 'move' };
      u.path = path;
      u.work = 0;
    }
  }

  private startGather(u: Unit, job: Extract<Job, { type: 'gather' }>): void {
    if (u.carry && u.carry.kind !== job.kind) u.carry = null; // switching jobs drops the load
    u.work = 0;
    const r = this.resourceRect(job);
    const path = r && this.pathTo(u, r);
    if (!path) {
      if (job.kind === 'wood') return this.retargetGather(u, job);
      u.job = null;
      u.path = [];
      return;
    }
    u.job = { ...job, phase: 'go' };
    u.path = path;
    if (path.length === 0) this.arrive(u);
  }

  private assignBuild(u: Unit, site: Building): void {
    const path = this.pathTo(u, rectOf(site));
    if (!path) { u.job = null; u.path = []; return; }
    u.job = { type: 'build', siteId: site.id, phase: path.length === 0 ? 'work' : 'go' };
    u.path = path;
  }

  private resourceRect(job: Extract<Job, { type: 'gather' }>): Rect | null {
    if (job.kind === 'wood') return { x: job.tx, y: job.ty, w: 1, h: 1 };
    const m = this.mines.get(job.mineId);
    return m ? rectOf(m) : null;
  }

  private resourceExists(job: Extract<Job, { type: 'gather' }>): boolean {
    if (job.kind === 'wood') return this.map.hasTree(job.tx, job.ty);
    return (this.mines.get(job.mineId)?.gold ?? 0) > 0;
  }

  private takeResource(job: Extract<Job, { type: 'gather' }>): number {
    if (job.kind === 'wood') {
      const i = this.map.idx(job.tx, job.ty);
      const got = Math.min(CARRY_CAP, this.map.tree[i]!);
      this.map.tree[i] = this.map.tree[i]! - got;
      if (this.map.tree[i] === 0) this.map.treeVersion++;
      return got;
    }
    const m = this.mines.get(job.mineId)!;
    const got = Math.min(CARRY_CAP, m.gold);
    m.gold -= got;
    if (m.gold === 0) {
      this.mines.delete(m.id);
      this.map.setOccupant(m.tx, m.ty, m.size, 0);
      this.map.treeVersion++;
    }
    return got;
  }

  /** Current resource ran out: find the nearest reachable replacement of the same kind. */
  private retargetGather(u: Unit, job: Extract<Job, { type: 'gather' }>): void {
    const ux = tileOf(u.x);
    const uy = tileOf(u.y);
    if (job.kind === 'wood') {
      const R = 10;
      const trees: Pt[] = [];
      for (let y = uy - R; y <= uy + R; y++)
        for (let x = ux - R; x <= ux + R; x++) if (this.map.hasTree(x, y)) trees.push({ x, y });
      trees.sort((a, b) => Math.hypot(a.x - ux, a.y - uy) - Math.hypot(b.x - ux, b.y - uy));
      for (const t of trees.slice(0, 12)) {
        const path = this.pathTo(u, { x: t.x, y: t.y, w: 1, h: 1 });
        if (!path) continue;
        u.job = { type: 'gather', kind: 'wood', tx: t.x, ty: t.y, phase: 'go' };
        u.path = path;
        if (path.length === 0) this.arrive(u);
        return;
      }
    } else {
      const mines = [...this.mines.values()].sort(
        (a, b) => Math.hypot(a.tx - ux, a.ty - uy) - Math.hypot(b.tx - ux, b.ty - uy));
      const m = mines[0];
      if (m) return this.startGather(u, { type: 'gather', kind: 'gold', mineId: m.id, phase: 'go' });
    }
    u.job = null;
    u.path = [];
  }

  private dropOffNextTo(u: Unit): Building | null {
    if (!u.carry) return null;
    const ux = tileOf(u.x);
    const uy = tileOf(u.y);
    for (const b of this.buildings.values())
      if (b.owner === u.owner && b.progress >= 1 && BUILDINGS[b.kind].dropOff.includes(u.carry.kind) && adjacentTo(rectOf(b), ux, uy)) return b;
    return null;
  }

  private headHome(u: Unit, kind: ResourceKind): void {
    const drops = [...this.buildings.values()]
      .filter((b) => b.owner === u.owner && b.progress >= 1 && BUILDINGS[b.kind].dropOff.includes(kind))
      .sort((a, b) => distTo(u, a) - distTo(u, b));
    for (const b of drops) {
      const path = this.pathTo(u, rectOf(b));
      if (!path) continue;
      u.path = path;
      if (path.length === 0) this.arrive(u);
      return;
    }
    u.job = null;
    u.path = [];
  }
}
