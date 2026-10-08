import * as THREE from 'three';
import type { Game } from '../game';
import { HEX_ROW, hexCenter, neighbors } from '../hex';
import { FOREST, MOUNTAIN, WATER } from '../world';
import type { Assets, ModelName } from './assets';

const FORESTS: ModelName[] = ['forest_a', 'forest_b', 'forest_c'];
const MOUNTAINS: ModelName[] = ['mountain_a', 'mountain_b', 'mountain_c'];
const TINT_OPACITY = 0.42;
const BORDER_WIDTH = 0.07; // as a fraction of the way from edge to centre
const BORDER_REBUILD = 0.15; // seconds; borders are rebuilt at most this often

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Pointy-top hex corner `i` (0..5) around a centre, at radius r. */
function corner(cx: number, cz: number, i: number, r: number): THREE.Vector3 {
  const a = (Math.PI / 3) * i + Math.PI / 6;
  return new THREE.Vector3(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r);
}

/**
 * The static hex terrain (instanced KayKit tiles and decorations) plus the
 * live layer on top: a nation-coloured tint per owned hex and painted
 * borders wherever ownership changes between neighbours.
 */
export class HexMap {
  readonly group = new THREE.Group();
  private tint: THREE.InstancedMesh;
  private borders: THREE.Mesh;
  private seenOwner: Int8Array;
  private dirty = true;
  private sinceBorders = 0;
  private colors: THREE.Color[];

  constructor(private game: Game, assets: Assets) {
    const { world } = game;
    this.colors = game.nations.map((n) => new THREE.Color(n.color));

    // Group hexes by the model that should stand there.
    const placements = new Map<ModelName, THREE.Matrix4[]>();
    const add = (name: ModelName, m: THREE.Matrix4) => {
      if (!placements.has(name)) placements.set(name, []);
      placements.get(name)!.push(m);
    };
    for (let row = 0; row < world.rows; row++)
      for (let col = 0; col < world.cols; col++) {
        const t = world.terrain[world.idx(col, row)]!;
        const { x, z } = hexCenter(col, row);
        const at = new THREE.Matrix4().makeTranslation(x, 0, z);
        add(t === WATER ? 'hex_water' : 'hex_grass', at);
        // Decorations get one of six hex-aligned turns so they don't all look the same.
        const turn = new THREE.Matrix4().makeRotationY(Math.floor(hash(col, row) * 6) * (Math.PI / 3));
        if (t === FOREST) add(FORESTS[Math.floor(hash(row, col) * FORESTS.length)]!, at.clone().multiply(turn));
        if (t === MOUNTAIN) add(MOUNTAINS[Math.floor(hash(row, col) * MOUNTAINS.length)]!, at.clone().multiply(turn));
      }
    for (const [name, mats] of placements) {
      for (const part of assets.meshes(name)) {
        const inst = new THREE.InstancedMesh(part.geometry, part.material, mats.length);
        mats.forEach((m, i) => inst.setMatrixAt(i, m.clone().multiply(part.matrix)));
        inst.castShadow = name !== 'hex_water' && name !== 'hex_grass';
        inst.receiveShadow = true;
        inst.computeBoundingSphere();
        this.group.add(inst);
      }
    }

    // Open sea around the island.
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x4a9fd8, roughness: 0.25 }),
    );
    sea.position.set(world.cols / 2, -0.12, (world.rows * HEX_ROW) / 2);
    sea.receiveShadow = true;
    this.group.add(sea);

    // Territory tint: one flat hexagon per hex, hidden while unowned.
    const hexShape = new THREE.CircleGeometry(1 / Math.sqrt(3), 6, Math.PI / 6).rotateX(-Math.PI / 2);
    this.tint = new THREE.InstancedMesh(
      hexShape,
      new THREE.MeshBasicMaterial({ transparent: true, opacity: TINT_OPACITY, depthWrite: false }),
      world.cols * world.rows,
    );
    this.tint.renderOrder = 1;
    this.tint.frustumCulled = false;
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < world.cols * world.rows; i++) {
      this.tint.setMatrixAt(i, hidden);
      this.tint.setColorAt(i, new THREE.Color(0xffffff));
    }
    this.group.add(this.tint);

    this.borders = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.borders.renderOrder = 2;
    this.borders.frustumCulled = false;
    this.group.add(this.borders);

    this.seenOwner = new Int8Array(world.owner.length).fill(-2);
  }

  /** Bring tint and borders in line with current ownership. */
  update(dt: number): void {
    const { world } = this.game;
    let changed = false;
    const m = new THREE.Matrix4();
    for (let i = 0; i < world.owner.length; i++) {
      const o = world.owner[i]!;
      if (o === this.seenOwner[i]) continue;
      this.seenOwner[i] = o;
      changed = true;
      const col = i % world.cols, row = Math.floor(i / world.cols);
      if (o < 0 || !world.passable(col, row)) {
        this.tint.setMatrixAt(i, m.makeScale(0, 0, 0));
      } else {
        const { x, z } = hexCenter(col, row);
        this.tint.setMatrixAt(i, m.makeTranslation(x, 0.02, z));
        this.tint.setColorAt(i, this.colors[o]!);
      }
    }
    if (changed) {
      this.tint.instanceMatrix.needsUpdate = true;
      if (this.tint.instanceColor) this.tint.instanceColor.needsUpdate = true;
      this.dirty = true;
    }
    this.sinceBorders += dt;
    if (this.dirty && this.sinceBorders >= BORDER_REBUILD) this.rebuildBorders();
  }

  /** A strip along every hex edge where the owner on the other side differs. */
  private rebuildBorders(): void {
    this.dirty = false;
    this.sinceBorders = 0;
    const { world } = this.game;
    const pos: number[] = [];
    const col: number[] = [];
    const R = 1 / Math.sqrt(3);
    const dark = new THREE.Color();
    for (let row = 0; row < world.rows; row++)
      for (let c = 0; c < world.cols; c++) {
        const o = world.ownerAt(c, row);
        if (o < 0) continue;
        const ctr = hexCenter(c, row);
        const center = new THREE.Vector3(ctr.x, 0, ctr.z);
        dark.copy(this.colors[o]!).multiplyScalar(0.7);
        for (const nb of neighbors(c, row)) {
          const other = world.inBounds(nb.col, nb.row) ? world.ownerAt(nb.col, nb.row) : -1;
          if (other === o) continue;
          // The edge facing this neighbour: the two corners closest to it.
          const nc = hexCenter(nb.col, nb.row);
          const dir = new THREE.Vector2(nc.x - ctr.x, nc.z - ctr.z).normalize();
          const corners = [0, 1, 2, 3, 4, 5]
            .map((i) => corner(ctr.x, ctr.z, i, R))
            .sort((a, b) => (b.x - ctr.x) * dir.x + (b.z - ctr.z) * dir.y - ((a.x - ctr.x) * dir.x + (a.z - ctr.z) * dir.y));
          const a = corners[0]!, b = corners[1]!;
          const a2 = a.clone().lerp(center, BORDER_WIDTH * 2), b2 = b.clone().lerp(center, BORDER_WIDTH * 2);
          const y = 0.035;
          for (const v of [a, b, b2, a, b2, a2]) {
            pos.push(v.x, y, v.z);
            col.push(dark.r, dark.g, dark.b);
          }
        }
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.borders.geometry.dispose();
    this.borders.geometry = geo;
  }
}
