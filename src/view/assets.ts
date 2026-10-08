import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

// Models are built from the KayKit packs by scripts/build-models.mjs.
export const MODELS = [
  'hex_grass', 'hex_water', 'forest_a', 'forest_b', 'forest_c',
  'mountain_a', 'mountain_b', 'mountain_c', 'capital', 'town', 'soldier',
] as const;
export type ModelName = (typeof MODELS)[number];

/** KayKit hex tiles are 2 units across; the game's hexes are 1. */
export const KAYKIT_SCALE = 0.5;

export class Assets {
  private gltfs = new Map<ModelName, GLTF>();

  async load(onProgress?: (done: number, total: number) => void): Promise<void> {
    const loader = new GLTFLoader();
    let done = 0;
    await Promise.all(MODELS.map(async (name) => {
      const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb`);
      gltf.scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      this.gltfs.set(name, gltf);
      onProgress?.(++done, MODELS.length);
    }));
  }

  animations(name: ModelName): THREE.AnimationClip[] {
    return this.get(name).animations;
  }

  /** A fresh copy of a model at KayKit scale (or `height` world units tall). */
  instance(name: ModelName, height?: number): THREE.Group {
    const gltf = this.get(name);
    const obj = cloneSkinned(gltf.scene);
    let s = KAYKIT_SCALE;
    if (height) s = height / new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3()).y;
    obj.scale.setScalar(s);
    const wrap = new THREE.Group();
    wrap.add(obj);
    return wrap;
  }

  /** Every mesh in a model with its transform at KayKit scale, for instancing. */
  meshes(name: ModelName): { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; matrix: THREE.Matrix4 }[] {
    const root = this.get(name).scene.clone();
    root.scale.setScalar(KAYKIT_SCALE);
    root.updateMatrixWorld(true);
    const out: { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; matrix: THREE.Matrix4 }[] = [];
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) out.push({ geometry: m.geometry, material: m.material, matrix: m.matrixWorld.clone() });
    });
    return out;
  }

  private get(name: ModelName): GLTF {
    const g = this.gltfs.get(name);
    if (!g) throw new Error(`model not loaded: ${name}`);
    return g;
  }
}
