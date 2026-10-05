import { describe, expect, it } from 'vitest';
import { TREE_WOOD } from './config';
import { GameMap } from './map';
import { adjacentTo, findPath } from './path';

const toTile = (x: number, y: number) => (px: number, py: number) => px === x && py === y;

describe('findPath', () => {
  it('walks around a wall through its gap', () => {
    const map = new GameMap();
    // Wall of trees at x=10 with a single gap at y=30.
    for (let y = 0; y < map.h; y++) if (y !== 30) map.tree[map.idx(10, y)] = TREE_WOOD;
    const path = findPath(map, 5, 5, toTile(15, 5), { x: 15, y: 5, w: 1, h: 1 });
    expect(path).not.toBeNull();
    expect(path!.at(-1)).toEqual({ x: 15, y: 5 });
    expect(path!.some((p) => p.x === 10 && p.y === 30)).toBe(true);
    for (const p of path!) expect(map.passable(p.x, p.y)).toBe(true);
  });

  it('never cuts a blocked corner diagonally', () => {
    const map = new GameMap();
    map.tree[map.idx(6, 5)] = TREE_WOOD;
    map.tree[map.idx(5, 6)] = TREE_WOOD;
    const path = findPath(map, 5, 5, toTile(6, 6), { x: 6, y: 6, w: 1, h: 1 })!;
    expect(path[0]).not.toEqual({ x: 6, y: 6 });
  });

  it('returns null when the goal is sealed off', () => {
    const map = new GameMap();
    for (let y = 0; y < map.h; y++) map.tree[map.idx(10, y)] = TREE_WOOD;
    expect(findPath(map, 5, 5, toTile(15, 5), { x: 15, y: 5, w: 1, h: 1 })).toBeNull();
  });

  it('returns [] when already at the goal', () => {
    const map = new GameMap();
    expect(findPath(map, 5, 5, toTile(5, 5), { x: 5, y: 5, w: 1, h: 1 })).toEqual([]);
  });
});

describe('adjacentTo', () => {
  const r = { x: 4, y: 4, w: 2, h: 2 };
  it('accepts the ring around a rect and rejects inside / far tiles', () => {
    expect(adjacentTo(r, 3, 3)).toBe(true);
    expect(adjacentTo(r, 6, 5)).toBe(true);
    expect(adjacentTo(r, 4, 4)).toBe(false);
    expect(adjacentTo(r, 7, 4)).toBe(false);
  });
});
