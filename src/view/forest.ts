import * as THREE from 'three';
import type { GameMap } from '../map';
import type { Assets, ModelName } from './assets';

const VARIANTS: ModelName[] = ['tree_a', 'tree_b'];
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

const hash = (x: number, y: number) => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

interface Variant {
  meshes: THREE.InstancedMesh[];
  /** Each mesh's transform inside the normalised model. */
  local: THREE.Matrix4[];
  /** slot → tile index, and tile index → slot. */
  tiles: number[];
  slotOf: Map<number, number>;
}

/**
 * All trees, drawn as one InstancedMesh per tree-model mesh, so hundreds of
 * trees cost a handful of draw calls. Felled trees are hidden in place.
 */
export class Forest {
  readonly group = new THREE.Group();
  private variants: Variant[] = [];
  private version = -1;

  constructor(private map: GameMap, assets: Assets) {
    const counts = VARIANTS.map(() => 0);
    const pick = (i: number) => Math.floor(hash(i % map.w, Math.floor(i / map.w)) * VARIANTS.length);
    for (let i = 0; i < map.tree.length; i++) if (map.tree[i]! > 0) counts[pick(i)]!++;

    VARIANTS.forEach((name, v) => {
      const model = assets.instance(name, { fit: 0.95 });
      model.updateMatrixWorld(true);
      const variant: Variant = { meshes: [], local: [], tiles: [], slotOf: new Map() };
      model.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const inst = new THREE.InstancedMesh(m.geometry, m.material, Math.max(1, counts[v]!));
        inst.castShadow = true;
        inst.receiveShadow = true;
        inst.count = counts[v]!;
        variant.meshes.push(inst);
        variant.local.push(m.matrixWorld.clone());
        this.group.add(inst);
      });
      this.variants.push(variant);
    });

    const place = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < map.tree.length; i++) {
      if (map.tree[i] === 0) continue;
      const x = i % map.w, y = Math.floor(i / map.w);
      const v = this.variants[pick(i)]!;
      const slot = v.tiles.length;
      v.tiles.push(i);
      v.slotOf.set(i, slot);
      const s = 0.85 + hash(y, x) * 0.35;
      q.setFromAxisAngle(up, hash(x + 3, y + 7) * Math.PI * 2);
      place.compose(
        new THREE.Vector3(x + 0.5 + (hash(x, y + 1) - 0.5) * 0.25, 0, y + 0.5 + (hash(x + 1, y) - 0.5) * 0.25),
        q, new THREE.Vector3(s, s * (0.9 + hash(x + 5, y) * 0.25), s),
      );
      v.meshes.forEach((mesh, k) => mesh.setMatrixAt(slot, place.clone().multiply(v.local[k]!)));
    }
    for (const v of this.variants) for (const m of v.meshes) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); }
    this.version = map.treeVersion;
  }

  /** Hide trees that have been chopped down. */
  sync(): void {
    if (this.version === this.map.treeVersion) return;
    for (const v of this.variants) {
      let dirty = false;
      for (const [tile, slot] of v.slotOf) {
        if (this.map.tree[tile]! > 0) continue;
        for (const m of v.meshes) m.setMatrixAt(slot, HIDDEN);
        v.slotOf.delete(tile);
        dirty = true;
      }
      if (dirty) for (const m of v.meshes) m.instanceMatrix.needsUpdate = true;
    }
    this.version = this.map.treeVersion;
  }

  get pickables(): THREE.Object3D[] {
    return this.variants.flatMap((v) => v.meshes);
  }

  /** Tile of the tree hit by a raycast against `pickables`. */
  tileOf(hit: THREE.Intersection): { x: number; y: number } | null {
    for (const v of this.variants) {
      if (!v.meshes.includes(hit.object as THREE.InstancedMesh) || hit.instanceId === undefined) continue;
      const tile = v.tiles[hit.instanceId];
      if (tile === undefined || !v.slotOf.has(tile)) return null;
      return { x: tile % this.map.w, y: Math.floor(tile / this.map.w) };
    }
    return null;
  }
}
