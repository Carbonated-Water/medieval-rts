import { describe, expect, it } from 'vitest';
import {
  ARMY_MAX, CAPITAL_SPAWN, CITY_DEFENSE, NATIONS, NEUTRAL, NEUTRAL_TOWNS, PLAYER, SPAWN_EVERY, START_ARMY,
} from './config';
import { Game, type Army } from './game';
import { hexDistance } from './hex';

const run = (g: Game, seconds: number) => { for (let t = 0; t < seconds; t += 0.05) g.tick(0.05); };
const capitalOf = (g: Game, n: number) => g.cities.find((c) => c.id === g.nations[n]!.capitalId)!;
const armyOn = (g: Game, n: number, col: number, row: number) => g.armiesAt(col, row).find((a) => a.owner === n);
/** Put an army somewhere for a test (bypasses the rules). */
const place = (g: Game, owner: number, col: number, row: number, count: number): Army => {
  const a: Army = { id: 10_000 + g.armies.length, owner, count, col, row, path: [], step: 0 };
  g.armies.push(a);
  return a;
};

describe('world setup', () => {
  it('gives every nation a capital, starting land and an army; towns are neutral', () => {
    const g = new Game(42);
    expect(g.nations).toHaveLength(NATIONS.length);
    for (const n of g.nations) {
      const cap = capitalOf(g, n.id);
      expect(cap.capital).toBe(true);
      expect(cap.owner).toBe(n.id);
      expect(n.territory).toBeGreaterThanOrEqual(4);
      expect(armyOn(g, n.id, cap.col, cap.row)?.count).toBe(START_ARMY);
    }
    const towns = g.cities.filter((c) => !c.capital);
    expect(towns.length).toBeGreaterThanOrEqual(NEUTRAL_TOWNS - 4);
    expect(towns.every((t) => t.owner === NEUTRAL && armyOn(g, NEUTRAL, t.col, t.row))).toBe(true);
  });

  it('spreads capitals apart and keeps every city reachable', () => {
    const g = new Game(7);
    const caps = g.cities.filter((c) => c.capital);
    for (const a of caps) for (const b of caps) if (a !== b) expect(hexDistance(a, b)).toBeGreaterThanOrEqual(3);
    const player = capitalOf(g, PLAYER);
    for (const c of g.cities) {
      const army = place(g, PLAYER, player.col, player.row, 1);
      expect(g.move(army.id, c.col, c.row)).not.toBeNull();
    }
  });

  it('is deterministic for a seed', () => {
    const a = new Game(99), b = new Game(99);
    expect(Array.from(a.world.terrain)).toEqual(Array.from(b.world.terrain));
    expect(a.cities.map((c) => [c.col, c.row])).toEqual(b.cities.map((c) => [c.col, c.row]));
  });
});

describe('spawning', () => {
  it('capitals add troops to the army standing on them', () => {
    const g = new Game(42);
    const cap = capitalOf(g, PLAYER);
    cap.spawnTimer = 0;
    run(g, SPAWN_EVERY + 0.01);
    expect(armyOn(g, PLAYER, cap.col, cap.row)!.count).toBe(START_ARMY + g.spawnSize(cap));
    expect(g.spawnSize(cap)).toBeGreaterThanOrEqual(CAPITAL_SPAWN);
  });

  it('caps armies at ARMY_MAX and neutral towns do not grow', () => {
    const g = new Game(42);
    const cap = capitalOf(g, PLAYER);
    armyOn(g, PLAYER, cap.col, cap.row)!.count = ARMY_MAX - 1;
    const town = g.cities.find((c) => c.owner === NEUTRAL)!;
    const before = armyOn(g, NEUTRAL, town.col, town.row)!.count;
    run(g, SPAWN_EVERY * 2);
    expect(armyOn(g, PLAYER, cap.col, cap.row)!.count).toBe(ARMY_MAX);
    expect(armyOn(g, NEUTRAL, town.col, town.row)!.count).toBe(before);
  });
});

describe('marching', () => {
  it('walks hex by hex and paints the land it crosses', () => {
    const g = new Game(42);
    const cap = capitalOf(g, PLAYER);
    const home = armyOn(g, PLAYER, cap.col, cap.row)!;
    const dest = g.cities.filter((c) => c.owner === NEUTRAL).sort((a, b) => hexDistance(a, cap) - hexDistance(b, cap))[0]!;
    // Pick an empty passable hex 3 steps short of that town.
    const army = g.move(home.id, dest.col, dest.row, 4)!;
    expect(army).not.toBe(home); // split off
    expect(home.count).toBe(START_ARMY - 4);
    const route = [...army.path];
    run(g, 2);
    expect(g.world.ownerAt(route[0]!.col, route[0]!.row)).toBe(PLAYER);
  });
});

describe('battle and capture', () => {
  it('numbers subtract; the winner keeps the difference', () => {
    const g = new Game(42);
    const cap = capitalOf(g, PLAYER);
    const empty = findEmptyNear(g, cap.col, cap.row);
    const enemy = place(g, 1, empty.col, empty.row, 7);
    const mine = g.move(armyOn(g, PLAYER, cap.col, cap.row)!.id, empty.col, empty.row)!;
    run(g, 20);
    expect(g.army(enemy.id)).toBeUndefined();
    expect(mine.count).toBe(START_ARMY - 7);
    expect(g.events.some((e) => e.type === 'battle' && e.winner === PLAYER)).toBe(true);
  });

  it('city garrisons defend at 1.5× and a stronger attacker takes the town', () => {
    const g = new Game(42);
    const town = g.cities.find((c) => c.owner === NEUTRAL)!;
    const garrison = armyOn(g, NEUTRAL, town.col, town.row)!;
    garrison.count = 10; // defends like 15
    const near = findEmptyNear(g, town.col, town.row);
    const weak = place(g, PLAYER, near.col, near.row, 14);
    g.move(weak.id, town.col, town.row);
    run(g, 5);
    expect(g.army(weak.id)).toBeUndefined();
    expect(town.owner).toBe(NEUTRAL);
    expect(garrison.count).toBe(Math.round((10 * CITY_DEFENSE - 14) / CITY_DEFENSE));

    const strong = place(g, PLAYER, near.col, near.row, 30);
    g.move(strong.id, town.col, town.row);
    run(g, 5);
    expect(town.owner).toBe(PLAYER);
    expect(g.events.some((e) => e.type === 'capture' && e.cityId === town.id)).toBe(true);
  });

  it('taking a capital eliminates the nation: cities to the conqueror, land goes blank', () => {
    const g = new Game(42);
    const target = capitalOf(g, 1);
    for (const a of g.armiesAt(target.col, target.row)) a.count = 1;
    const near = findEmptyNear(g, target.col, target.row);
    const army = place(g, PLAYER, near.col, near.row, 50);
    g.move(army.id, target.col, target.row);
    run(g, 5);
    expect(g.nations[1]!.alive).toBe(false);
    expect(target.owner).toBe(PLAYER);
    expect(g.world.ownerAt(target.col, target.row)).toBe(PLAYER);
    expect(g.nations[1]!.territory).toBe(0);
    expect(Array.from(g.world.owner).includes(1)).toBe(false);
    expect(g.armies.some((a) => a.owner === 1)).toBe(false);
    // Territory counts stay consistent with the map.
    for (const n of g.nations) expect(n.territory).toBe(Array.from(g.world.owner).filter((o) => o === n.id).length);
  });

  it('the last nation standing wins', () => {
    const g = new Game(42, 1); // player + one bot
    const target = capitalOf(g, 1);
    for (const a of g.armiesAt(target.col, target.row)) a.count = 1;
    const near = findEmptyNear(g, target.col, target.row);
    g.move(place(g, PLAYER, near.col, near.row, 50).id, target.col, target.row);
    run(g, 5);
    expect(g.winner).toBe(PLAYER);
  });
});

function findEmptyNear(g: Game, col: number, row: number) {
  for (let r = 1; r < 6; r++)
    for (let dr = -r; dr <= r; dr++)
      for (let dc = -r; dc <= r; dc++) {
        const c = col + dc, w = row + dr;
        if (hexDistance({ col, row }, { col: c, row: w }) !== r) continue;
        if (g.world.passable(c, w) && !g.cityAt(c, w) && g.armiesAt(c, w).length === 0) return { col: c, row: w };
      }
  throw new Error('no empty hex nearby');
}
