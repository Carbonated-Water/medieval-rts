// Pointy-top hexes in "odd-r" offset layout: rows are horizontal, every
// odd row is shifted half a hex to the right. Storage is (col, row);
// distance maths goes through cube coordinates.

export interface Hex { col: number; row: number }

const EVEN_ROW: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1]];
const ODD_ROW: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [1, -1], [0, -1], [1, 1], [0, 1]];

/** The six neighbours of a hex (may be off-map; callers bounds-check). */
export function neighbors(col: number, row: number): Hex[] {
  const d = row & 1 ? ODD_ROW : EVEN_ROW;
  return d.map(([dc, dr]) => ({ col: col + dc, row: row + dr }));
}

function toCube(col: number, row: number): [number, number, number] {
  const x = col - (row - (row & 1)) / 2;
  const z = row;
  return [x, -x - z, z];
}

/** Steps between two hexes. */
export function hexDistance(a: Hex, b: Hex): number {
  const [ax, ay, az] = toCube(a.col, a.row);
  const [bx, by, bz] = toCube(b.col, b.row);
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz));
}

/** World-space centre of a hex, with hexes 1 unit from flat side to flat side. */
export const HEX_W = 1; // width (pointy-top: flat sides left/right)
export const HEX_ROW = Math.sqrt(3) / 2; // vertical distance between rows
export function hexCenter(col: number, row: number): { x: number; z: number } {
  return { x: col * HEX_W + (row & 1 ? HEX_W / 2 : 0), z: row * HEX_ROW };
}

/** Hex containing a world point (nearest centre among the candidates). */
export function hexAt(x: number, z: number): Hex {
  const row0 = Math.round(z / HEX_ROW);
  let best: Hex = { col: 0, row: 0 };
  let bestD = Infinity;
  for (let row = row0 - 1; row <= row0 + 1; row++) {
    const col0 = Math.round((x - (row & 1 ? HEX_W / 2 : 0)) / HEX_W);
    for (let col = col0 - 1; col <= col0 + 1; col++) {
      const c = hexCenter(col, row);
      const d = (c.x - x) ** 2 + (c.z - z) ** 2;
      if (d < bestD) { bestD = d; best = { col, row }; }
    }
  }
  return best;
}

/**
 * A* over hexes. `cost(col,row)` is the time to enter a hex, or Infinity
 * if it can't be entered. Returns the hexes to walk (start excluded),
 * [] if already there, or null if unreachable.
 */
export function hexPath(cols: number, rows: number, from: Hex, to: Hex, cost: (col: number, row: number) => number): Hex[] | null {
  if (from.col === to.col && from.row === to.row) return [];
  const n = cols * rows;
  const idx = (c: number, r: number) => r * cols + c;
  const g = new Float32Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const minCost = 0.5; // cheapest terrain step, keeps the heuristic admissible
  const open: number[] = [];
  const f = new Float32Array(n).fill(Infinity);
  const push = (i: number) => {
    // Small maps: a sorted insert is plenty fast and keeps this simple.
    let lo = 0, hi = open.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (f[open[mid]!]! > f[i]!) lo = mid + 1; else hi = mid; }
    open.splice(lo, 0, i);
  };
  const s = idx(from.col, from.row);
  g[s] = 0;
  f[s] = hexDistance(from, to) * minCost;
  push(s);
  const target = idx(to.col, to.row);
  while (open.length) {
    const cur = open.pop()!;
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === target) {
      const out: Hex[] = [];
      for (let i = cur; i !== s; i = prev[i]!) out.push({ col: i % cols, row: Math.floor(i / cols) });
      return out.reverse();
    }
    const cc = cur % cols, cr = Math.floor(cur / cols);
    for (const nb of neighbors(cc, cr)) {
      if (nb.col < 0 || nb.row < 0 || nb.col >= cols || nb.row >= rows) continue;
      const step = cost(nb.col, nb.row);
      if (!Number.isFinite(step)) continue;
      const ni = idx(nb.col, nb.row);
      const ng = g[cur]! + step;
      if (ng < g[ni]!) {
        g[ni] = ng;
        prev[ni] = cur;
        f[ni] = ng + hexDistance(nb, to) * minCost;
        push(ni);
      }
    }
  }
  return null;
}
