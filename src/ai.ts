import { BUILDINGS, ENEMY, POP_MAX, TILE, type BuildingKind, type Owner, type UnitKind } from './config';
import type { Building, Game, Unit } from './game';

// The AI plays by the player's rules: same costs, build times and orders.
// It only ever calls Game's public order methods.

const THINK_EVERY = 1; // seconds
const PEASANT_TARGET = 14;
const WOOD_SHARE = 0.55; // of gatherers on wood, the rest on gold
const ARMY_CAP_PEACE = 8;
const ARMY_CAP_WAR = 30;
const FIRST_WAVE = 5;
const WAVE_GROWTH = 2;
const MAX_WAVE = 14;
const DEFEND_RADIUS = 12; // tiles around the town hall
const MAX_BARRACKS = 3;

export class EnemyAI {
  private timer = 0;
  private wave = FIRST_WAVE;
  private wasProvoked = false;

  constructor(private game: Game, private owner: Owner = ENEMY) {}

  tick(dt: number): void {
    this.timer += dt;
    if (this.timer < THINK_EVERY) return;
    this.timer = 0;
    if (this.game.winner === null) this.think();
  }

  private think(): void {
    const g = this.game, o = this.owner;
    const hall = g.buildings.get(g.hallIds[o]);
    if (!hall) return;
    const units = g.units.filter((u) => u.owner === o);
    const peasants = units.filter((u) => u.kind === 'peasant');
    const soldiers = units.filter((u) => u.kind !== 'peasant');
    const buildings = [...g.buildings.values()].filter((b) => b.owner === o);
    const has = (k: BuildingKind) => buildings.some((b) => b.kind === k);

    this.assignGatherers(peasants, hall);

    // Construction: one project at a time, and keep a builder on it.
    const site = buildings.find((b) => b.progress < 1);
    if (site) {
      if (!peasants.some((p) => p.job?.type === 'build' && p.job.siteId === site.id)) {
        const builder = this.nearest(peasants, site);
        if (builder) g.orderAt([builder], site.tx, site.ty);
      }
    } else if (g.popCapOf(o) - g.popUsedOf(o) <= 2 && g.popCapOf(o) < POP_MAX) {
      this.build('house', hall, peasants);
    } else if (!has('mill') && peasants.length >= 5) {
      const tree = this.nearestTree(hall.tx + 1, hall.ty + 1, 14);
      if (tree) this.build('mill', { tx: tree.x, ty: tree.y, size: 1 }, peasants);
    } else if (!has('barracks') && peasants.length >= 7) {
      this.build('barracks', hall, peasants);
    } else if (g.provoked && g.stocks[o].wood >= 300 && buildings.filter((b) => b.kind === 'barracks').length < MAX_BARRACKS) {
      // At war with money in the bank: more barracks to spend it faster.
      this.build('barracks', hall, peasants);
    }

    // Training.
    const queuedPeasants = hall.queue.length;
    if (peasants.length + queuedPeasants < PEASANT_TARGET && hall.queue.length < 2) g.train(hall, 'peasant');
    const armyCap = g.provoked ? ARMY_CAP_WAR : ARMY_CAP_PEACE;
    for (const b of buildings) {
      if (b.kind !== 'barracks' || b.progress < 1 || b.queue.length >= 2) continue;
      const army = soldiers.length + buildings.reduce((n, x) => n + (x.kind === 'barracks' ? x.queue.length : 0), 0);
      // Economy first: don't drain gold into soldiers until the town has workers.
      if (army < armyCap && peasants.length >= 8) g.train(b, this.nextSoldier(soldiers));
    }

    this.command(soldiers, hall);
  }

  /** Idle peasants go to wood or gold, keeping roughly WOOD_SHARE on wood. */
  private assignGatherers(peasants: Unit[], hall: Building): void {
    const g = this.game;
    let wood = 0, gold = 0;
    for (const p of peasants) {
      if (p.job?.type !== 'gather') continue;
      if (p.job.kind === 'wood') wood++; else gold++;
    }
    for (const p of peasants) {
      if (p.job !== null) continue;
      const wantWood = wood <= (wood + gold) * WOOD_SHARE || g.mines.size === 0;
      if (wantWood) {
        const t = this.nearestTree(p.x / TILE, p.y / TILE, 20);
        if (t) { g.orderAt([p], t.x, t.y); wood++; continue; }
      }
      const m = this.nearestMine(hall);
      if (m) { g.orderAt([p], m.tx, m.ty); gold++; }
    }
  }

  /** Place a building on free ground near `anchor`, keeping a 1-tile gap so paths stay open. */
  private build(kind: BuildingKind, anchor: { tx: number; ty: number; size: number }, peasants: Unit[]): void {
    const g = this.game;
    const size = BUILDINGS[kind].size;
    const cx = anchor.tx + anchor.size / 2, cy = anchor.ty + anchor.size / 2;
    let spot: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (let y = Math.floor(cy) - 9; y <= cy + 9; y++)
      for (let x = Math.floor(cx) - 9; x <= cx + 9; x++) {
        const d = Math.hypot(x + size / 2 - cx, y + size / 2 - cy);
        if (d >= bestD || d < anchor.size / 2 + 2) continue;
        if (!g.map.areaFree(x - 1, y - 1, size + 2)) continue;
        spot = { x, y };
        bestD = d;
      }
    if (!spot) return;
    const builder = this.nearest(peasants.filter((p) => p.job?.type !== 'build'), { tx: spot.x, ty: spot.y, size });
    if (builder) g.placeBuilding(kind, spot.x, spot.y, [builder], this.owner);
  }

  /** Two swordsmen per archer. */
  private nextSoldier(soldiers: Unit[]): UnitKind {
    const archers = soldiers.filter((s) => s.kind === 'archer').length;
    return archers * 2 < soldiers.length - archers ? 'archer' : 'swordsman';
  }

  private command(soldiers: Unit[], hall: Building): void {
    const g = this.game;
    const hx = hall.tx + hall.size / 2, hy = hall.ty + hall.size / 2;
    if (!g.provoked) {
      // Peacetime: stand guard in front of the hall (towards the map centre).
      const rx = Math.round(hx + Math.sign(g.map.w / 2 - hx) * 4);
      const ry = Math.round(hy + Math.sign(g.map.h / 2 - hy) * 4);
      const idle = soldiers.filter((s) => s.job === null && Math.hypot(s.x / TILE - rx, s.y / TILE - ry) > 3);
      if (idle.length) g.orderAt(idle, rx, ry);
      return;
    }

    // Defend: anyone near our hall gets dealt with first.
    const intruders = g.units.filter((u) => u.owner !== this.owner && Math.hypot(u.x / TILE - hx, u.y / TILE - hy) <= DEFEND_RADIUS);
    if (intruders.length) {
      for (const s of soldiers) {
        if (s.job?.type === 'attack' && intruders.some((i) => i.id === (s.job as { targetId: number }).targetId)) continue;
        const foe = this.nearest(intruders, { tx: s.x / TILE, ty: s.y / TILE, size: 0 });
        if (foe) g.orderAttack([s], foe.id);
      }
      return;
    }

    const target = this.playerTarget();
    if (!target) return;
    const free = soldiers.filter((s) => s.job === null || s.job.type === 'move');
    // The first provocation triggers an immediate counter-attack; after
    // that, attack in waves that grow each time.
    const counter = !this.wasProvoked && free.length >= 2;
    this.wasProvoked = true;
    if (counter || free.length >= this.wave) {
      g.orderAttack(free, target.id);
      if (!counter) this.wave = Math.min(MAX_WAVE, this.wave + WAVE_GROWTH);
    }
  }

  /** The enemy town hall, or failing that any enemy building. */
  private playerTarget(): Building | undefined {
    const g = this.game;
    const other = this.owner === ENEMY ? 0 : 1;
    return g.buildings.get(g.hallIds[other]) ?? [...g.buildings.values()].find((b) => b.owner !== this.owner);
  }

  private nearest<T extends { x: number; y: number }>(list: T[], to: { tx: number; ty: number; size: number }): T | undefined {
    const cx = to.tx + to.size / 2, cy = to.ty + to.size / 2;
    let best: T | undefined;
    let bestD = Infinity;
    for (const u of list) {
      const d = Math.hypot(u.x / TILE - cx, u.y / TILE - cy);
      if (d < bestD) { bestD = d; best = u; }
    }
    return best;
  }

  private nearestTree(fx: number, fy: number, radius: number): { x: number; y: number } | null {
    const map = this.game.map;
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (let y = Math.floor(fy) - radius; y <= fy + radius; y++)
      for (let x = Math.floor(fx) - radius; x <= fx + radius; x++) {
        if (!map.hasTree(x, y)) continue;
        // Skip the map's edge row: those trees are a border, not a forest.
        if (x === 0 || y === 0 || x === map.w - 1 || y === map.h - 1) continue;
        const d = Math.hypot(x - fx, y - fy);
        if (d < bestD) { bestD = d; best = { x, y }; }
      }
    return best;
  }

  private nearestMine(hall: Building) {
    let best;
    let bestD = Infinity;
    for (const m of this.game.mines.values()) {
      const d = Math.hypot(m.tx - hall.tx, m.ty - hall.ty);
      if (d < bestD) { bestD = d; best = m; }
    }
    return best;
  }
}
