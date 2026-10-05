import { describe, expect, it } from 'vitest';
import { BUILDINGS, PEASANT_COST, PEASANT_TRAIN_SECONDS, START_PEASANTS, START_STOCK, TILE } from './config';
import { Game, type Building } from './game';

const run = (game: Game, seconds: number) => {
  for (let t = 0; t < seconds; t += 0.1) game.tick(0.1);
};

const hallOf = (game: Game) => game.buildings.get(game.hallId)!;

/** Nearest tile (to the hall) satisfying `ok`. */
function nearest(game: Game, ok: (x: number, y: number) => boolean) {
  const h = hallOf(game);
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (let y = 0; y < game.map.h; y++)
    for (let x = 0; x < game.map.w; x++) {
      if (!ok(x, y)) continue;
      const d = Math.hypot(x - h.tx, y - h.ty);
      if (d < bestD) { bestD = d; best = { x, y }; }
    }
  return best!;
}

const nearestMine = (game: Game) => {
  const h = hallOf(game);
  return [...game.mines.values()].sort((a, b) => Math.hypot(a.tx - h.tx, a.ty - h.ty) - Math.hypot(b.tx - h.tx, b.ty - h.ty))[0]!;
};

describe('Game setup', () => {
  it('starts with a finished hall, peasants and the starting stock', () => {
    const game = new Game(42);
    expect(hallOf(game).progress).toBe(1);
    expect(game.units).toHaveLength(START_PEASANTS);
    expect(game.stock).toEqual(START_STOCK);
    expect(game.popCap).toBe(BUILDINGS.hall.pop);
    expect(game.mines.size).toBeGreaterThan(0);
  });

  it('is deterministic for a seed', () => {
    const a = new Game(7);
    const b = new Game(7);
    expect(Array.from(a.map.tree)).toEqual(Array.from(b.map.tree));
    expect(hallOf(a).tx).toBe(hallOf(b).tx);
  });
});

describe('gathering', () => {
  it('peasants chop wood, carry it home and keep going', () => {
    const game = new Game(42);
    const tree = nearest(game, (x, y) => game.map.hasTree(x, y));
    game.orderAt(game.units.slice(0, 2), tree.x, tree.y);
    run(game, 90);
    expect(game.stock.wood).toBeGreaterThan(START_STOCK.wood + 50);
    expect(game.units.slice(0, 2).every((u) => u.job?.type === 'gather')).toBe(true);
  });

  it('mines gold and depletes the mine', () => {
    const game = new Game(42);
    const mine = nearestMine(game);
    const before = mine.gold;
    game.orderAt([game.units[2]!], mine.tx, mine.ty);
    run(game, 60);
    expect(game.stock.gold).toBeGreaterThan(START_STOCK.gold);
    expect(mine.gold).toBeLessThan(before);
  });

  it('moves on to another tree when one runs out', () => {
    const game = new Game(42);
    const tree = nearest(game, (x, y) => game.map.hasTree(x, y));
    const version = game.map.treeVersion;
    game.orderAt(game.units, tree.x, tree.y);
    run(game, 120);
    expect(game.map.hasTree(tree.x, tree.y)).toBe(false);
    expect(game.map.treeVersion).toBeGreaterThan(version);
    expect(game.units.some((u) => u.job?.type === 'gather')).toBe(true);
  });
});

describe('building', () => {
  const spotFor = (game: Game, kind: Building['kind']) => nearest(game, (x, y) => game.canPlace(kind, x, y));

  it('cannot place on the hall or on trees', () => {
    const game = new Game(42);
    const h = hallOf(game);
    expect(game.canPlace('house', h.tx, h.ty)).toBe(false);
    const tree = nearest(game, (x, y) => game.map.hasTree(x, y));
    expect(game.canPlace('house', tree.x, tree.y)).toBe(false);
  });

  it('charges the cost, builds over time and raises the pop cap', () => {
    const game = new Game(42);
    game.stock.wood = 500;
    const spot = spotFor(game, 'house');
    expect(game.placeBuilding('house', spot.x, spot.y, [game.units[0]!])).toBe(true);
    expect(game.stock.wood).toBe(500 - BUILDINGS.house.cost.wood!);
    const site = [...game.buildings.values()].find((b) => b.kind === 'house')!;
    expect(site.progress).toBe(0);
    run(game, BUILDINGS.house.buildSeconds + 10);
    expect(site.progress).toBe(1);
    expect(game.popCap).toBe(BUILDINGS.hall.pop + BUILDINGS.house.pop);
  });

  it('refuses when it cannot afford it, with a notice', () => {
    const game = new Game(42);
    game.stock.wood = 10;
    const spot = spotFor(game, 'mill');
    expect(game.placeBuilding('mill', spot.x, spot.y, [])).toBe(false);
    expect(game.notice?.text).toMatch(/need \d+ more wood/);
  });
});

describe('training', () => {
  it('trains a peasant at the hall', () => {
    const game = new Game(42);
    expect(game.train(hallOf(game))).toBe(true);
    expect(game.stock.gold).toBe(START_STOCK.gold - PEASANT_COST.gold!);
    run(game, PEASANT_TRAIN_SECONDS + 1);
    expect(game.units).toHaveLength(START_PEASANTS + 1);
    const hall = hallOf(game);
    const fresh = game.units.at(-1)!;
    // Spawns next to the hall, not inside it.
    expect(game.map.occupantAt(Math.floor(fresh.x / TILE), Math.floor(fresh.y / TILE))).not.toBe(hall.id);
  });

  it('stops at the population cap', () => {
    const game = new Game(42);
    game.stock.gold = 10_000;
    const hall = hallOf(game);
    while (game.popUsed < game.popCap) expect(game.train(hall)).toBe(true);
    expect(game.train(hall)).toBe(false);
    expect(game.notice?.text).toBe('need more houses');
  });
});
