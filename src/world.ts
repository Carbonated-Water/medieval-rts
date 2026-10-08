import { CAPITAL_SPACING, MAP_COLS, MAP_ROWS, STEP_SECONDS, type Terrain } from './config';
import { hexCenter, hexDistance, neighbors, type Hex } from './hex';

export const TERRAINS: Terrain[] = ['grass', 'forest', 'mountain', 'water'];
export const GRASS = 0, FOREST = 1, MOUNTAIN = 2, WATER = 3;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded 2D value noise in [0, 1]. */
function makeNoise(rng: () => number): (x: number, y: number) => number {
  const P = 256;
  const table = Array.from({ length: P * P }, () => rng());
  const at = (x: number, y: number) => table[(((y % P) + P) % P) * P + (((x % P) + P) % P)]!;
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/** The hex map: terrain and (mutable) ownership per hex. */
export class World {
  readonly cols = MAP_COLS;
  readonly rows = MAP_ROWS;
  readonly terrain = new Uint8Array(MAP_COLS * MAP_ROWS);
  /** Owning nation per hex, -1 = nobody. */
  readonly owner = new Int8Array(MAP_COLS * MAP_ROWS).fill(-1);

  idx(col: number, row: number): number {
    return row * this.cols + col;
  }
  inBounds(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
  }
  terrainAt(col: number, row: number): Terrain {
    return TERRAINS[this.terrain[this.idx(col, row)]!]!;
  }
  passable(col: number, row: number): boolean {
    return this.inBounds(col, row) && Number.isFinite(STEP_SECONDS[this.terrainAt(col, row)]);
  }
  /** Seconds to step into a hex (Infinity if impassable or off-map). */
  stepCost(col: number, row: number): number {
    return this.inBounds(col, row) ? STEP_SECONDS[this.terrainAt(col, row)] : Infinity;
  }
  ownerAt(col: number, row: number): number {
    return this.owner[this.idx(col, row)]!;
  }
}

/**
 * Generates terrain, then picks `capitals` start hexes spread far apart and
 * `towns` neutral town hexes between them. Deterministic for a seed.
 */
export function generateWorld(seed: number, capitals: number, towns: number): { world: World; capitals: Hex[]; towns: Hex[] } {
  const rng = mulberry32(seed);
  const world = new World();
  const { cols, rows } = world;
  const height = makeNoise(rng), ridge = makeNoise(rng), woods = makeNoise(rng);
  const off = [rng() * 100, rng() * 100];

  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const { x, z } = hexCenter(col, row);
      // Distance to the nearest map edge, 0 at the edge, ~1 in the middle.
      const edge = Math.min(col, cols - 1 - col, row, rows - 1 - row) / 5;
      const h = height(x * 0.13 + off[0]!, z * 0.13 + off[1]!) * 0.75 + height(x * 0.4, z * 0.4) * 0.25
        - Math.max(0, 1 - edge) * 0.55;
      let t = GRASS;
      if (h < 0.3) t = WATER;
      else if (ridge(x * 0.18 + 40, z * 0.18) > 0.72 && h > 0.45) t = MOUNTAIN;
      else if (woods(x * 0.22, z * 0.22 + 70) > 0.6) t = FOREST;
      world.terrain[world.idx(col, row)] = t;
    }

  // Keep only the largest walkable region; drown the rest so every city is reachable.
  const region = new Int32Array(cols * rows).fill(-1);
  const sizes: number[] = [];
  for (let i = 0; i < region.length; i++) {
    const c0 = i % cols, r0 = Math.floor(i / cols);
    if (region[i] !== -1 || !world.passable(c0, r0)) continue;
    const id = sizes.length;
    let size = 0;
    const stack = [i];
    region[i] = id;
    while (stack.length) {
      const cur = stack.pop()!;
      size++;
      for (const nb of neighbors(cur % cols, Math.floor(cur / cols))) {
        if (!world.passable(nb.col, nb.row)) continue;
        const ni = world.idx(nb.col, nb.row);
        if (region[ni] === -1) { region[ni] = id; stack.push(ni); }
      }
    }
    sizes.push(size);
  }
  const main = sizes.indexOf(Math.max(...sizes));
  for (let i = 0; i < region.length; i++) if (region[i] !== -1 && region[i] !== main) world.terrain[i] = WATER;

  // Spread capitals with farthest-point sampling over open grass.
  const open: Hex[] = [];
  for (let row = 2; row < rows - 2; row++)
    for (let col = 2; col < cols - 2; col++)
      if (world.terrain[world.idx(col, row)] === GRASS) open.push({ col, row });
  const picked: Hex[] = [];
  const spread = (count: number, minDist: number, avoid: Hex[]) => {
    const out: Hex[] = [];
    for (let k = 0; k < count; k++) {
      let best: Hex | null = null;
      let bestD = -1;
      for (let tries = 0; tries < 400; tries++) {
        const h = open[Math.floor(rng() * open.length)]!;
        const d = Math.min(Infinity, ...[...avoid, ...out].map((a) => hexDistance(a, h)));
        if (d > bestD) { bestD = d; best = h; }
      }
      if (best && (out.length + avoid.length === 0 || bestD >= minDist)) out.push(best);
      else if (best && bestD >= 3) out.push(best); // map too tight: accept a closer spot
    }
    return out;
  };
  // Capitals need land all around them (no coastal starts boxed in by water).
  const inland = (h: Hex) => neighbors(h.col, h.row).every((n) => world.inBounds(n.col, n.row) && world.terrain[world.idx(n.col, n.row)] !== WATER);
  const grass = open.splice(0, open.length);
  open.push(...grass.filter(inland));
  picked.push(...spread(capitals, CAPITAL_SPACING, []));
  open.splice(0, open.length, ...grass);
  const townHexes = spread(towns, 4, picked);

  // Clear mountains and forest right around capitals so starts are fair.
  for (const c of picked)
    for (const nb of [c, ...neighbors(c.col, c.row)])
      if (world.inBounds(nb.col, nb.row) && world.terrain[world.idx(nb.col, nb.row)] !== WATER)
        world.terrain[world.idx(nb.col, nb.row)] = GRASS;

  return { world, capitals: picked, towns: townHexes };
}
