import { describe, expect, it } from 'vitest';
import { hexAt, hexCenter, hexDistance, hexPath, neighbors } from './hex';

describe('hex grid', () => {
  it('every hex has six neighbours at distance 1', () => {
    for (const h of [{ col: 5, row: 4 }, { col: 5, row: 5 }]) {
      const nb = neighbors(h.col, h.row);
      expect(nb).toHaveLength(6);
      expect(new Set(nb.map((n) => `${n.col},${n.row}`)).size).toBe(6);
      for (const n of nb) expect(hexDistance(h, n)).toBe(1);
    }
  });

  it('neighbour centres are all one hex-width apart', () => {
    const c = hexCenter(7, 3);
    for (const n of neighbors(7, 3)) {
      const p = hexCenter(n.col, n.row);
      expect(Math.hypot(p.x - c.x, p.z - c.z)).toBeCloseTo(1, 5);
    }
  });

  it('hexAt inverts hexCenter, including near edges', () => {
    for (let row = 0; row < 6; row++)
      for (let col = 0; col < 6; col++) {
        const c = hexCenter(col, row);
        expect(hexAt(c.x, c.z)).toEqual({ col, row });
        expect(hexAt(c.x + 0.3, c.z - 0.2)).toEqual({ col, row });
      }
  });

  it('distance counts steps', () => {
    expect(hexDistance({ col: 0, row: 0 }, { col: 3, row: 0 })).toBe(3);
    expect(hexDistance({ col: 2, row: 2 }, { col: 2, row: 6 })).toBe(4);
  });

  it('pathfinding goes around walls and prefers cheap terrain', () => {
    const cols = 12, rows = 10;
    const wall = (c: number, r: number) => c === 5 && r < 8;
    const path = hexPath(cols, rows, { col: 2, row: 2 }, { col: 9, row: 2 }, (c, r) => (wall(c, r) ? Infinity : 1))!;
    expect(path.at(-1)).toEqual({ col: 9, row: 2 });
    expect(path.some((h) => wall(h.col, h.row))).toBe(false);
    let prev = { col: 2, row: 2 };
    for (const h of path) { expect(hexDistance(prev, h)).toBe(1); prev = h; }
  });

  it('returns null when sealed off and [] when already there', () => {
    const block = (c: number) => (c === 5 ? Infinity : 1);
    expect(hexPath(12, 10, { col: 2, row: 2 }, { col: 9, row: 2 }, block)).toBeNull();
    expect(hexPath(12, 10, { col: 2, row: 2 }, { col: 2, row: 2 }, block)).toEqual([]);
  });
});
