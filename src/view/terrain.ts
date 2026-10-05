import * as THREE from 'three';
import type { Game } from '../game';
import { WATER } from '../map';

/** Value noise in [0,1], smooth at ~1/frequency tiles. */
function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
export function noise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const WATER_DEPTH = 0.5;

/**
 * Ground, lakes and the island's earth sides. One tile = one world unit;
 * tile (tx, ty) spans x ∈ [tx, tx+1], z ∈ [ty, ty+1]. Land is flat at y=0
 * (the simulation is flat); only lake beds dip below the water plane.
 */
export function buildTerrain(game: Game): THREE.Group {
  const { map } = game;
  const group = new THREE.Group();
  const isWater = (x: number, y: number) => map.inBounds(x, y) && map.terrain[map.idx(x, y)] === WATER;

  // Water fraction around a point, averaged over a small neighbourhood so
  // shorelines slope smoothly instead of stepping per tile.
  const waterAt = (x: number, z: number) => {
    let w = 0;
    for (const [dx, dz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]] as const)
      if (isWater(Math.floor(x + dx), Math.floor(z + dz))) w++;
    return w / 4;
  };
  const nearWater = (x: number, z: number, r: number) => {
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++) if (isWater(Math.floor(x + dx), Math.floor(z + dz))) return true;
    return false;
  };

  const hall = game.buildings.get(game.hallId)!;
  const hx = hall.tx + hall.size / 2;
  const hz = hall.ty + hall.size / 2;

  const res = 3; // vertices per tile edge
  const geo = new THREE.PlaneGeometry(map.w, map.h, map.w * res, map.h * res);
  geo.rotateX(-Math.PI / 2);
  geo.translate(map.w / 2, 0, map.h / 2);
  const pos = geo.attributes.position!;
  const colors = new Float32Array(pos.count * 3);
  const grassA = new THREE.Color(0x67a144), grassB = new THREE.Color(0x8cbb52), grassDark = new THREE.Color(0x4f8a39);
  const dirt = new THREE.Color(0xae8b5c), sand = new THREE.Color(0xdcc78c), bed = new THREE.Color(0x7d8f6a);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const w = waterAt(x, z);
    pos.setY(i, -WATER_DEPTH * w * w * (3 - 2 * w));

    const n = noise(x * 0.18, z * 0.18) * 0.65 + noise(x * 0.9, z * 0.9) * 0.35;
    c.copy(grassA).lerp(grassB, n);
    c.lerp(grassDark, Math.max(0, noise(x * 0.07 + 40, z * 0.07) - 0.6) * 1.5);
    // Trodden ground around the town hall.
    const hd = Math.hypot(x - hx, z - hz) + (noise(x * 0.8, z * 0.8) - 0.5) * 1.6;
    if (hd < 3.6) c.lerp(dirt, THREE.MathUtils.smoothstep(3.6 - hd, 0, 1.4) * 0.85);
    if (w > 0) c.copy(sand).lerp(bed, w);
    else if (nearWater(x, z, 1)) c.lerp(sand, 0.85);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  ground.receiveShadow = true;
  ground.name = 'ground';
  group.add(ground);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(map.w, map.h).rotateX(-Math.PI / 2).translate(map.w / 2, -0.14, map.h / 2),
    new THREE.MeshStandardMaterial({ color: 0x3b84c4, roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.88 }),
  );
  water.receiveShadow = true;
  water.name = 'water';
  group.add(water);

  // Earth sides so the map reads as a floating diorama. Only the four side
  // faces: a top face would sit above the lakes and hide them.
  const earth = new THREE.MeshStandardMaterial({ color: 0x7a5534, roughness: 1 });
  const none = new THREE.MeshBasicMaterial({ visible: false });
  const sides = new THREE.Mesh(
    new THREE.BoxGeometry(map.w, 2, map.h).translate(map.w / 2, -1.01, map.h / 2),
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z.
    [earth, earth, none, none, earth, earth],
  );
  group.add(sides);

  return group;
}
