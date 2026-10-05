import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

// Models are built from the KayKit packs by scripts/build-models.mjs.
export const MODELS = [
  'hall', 'house_a', 'house_b', 'mill', 'mine',
  'site_a', 'site_b', 'site_c',
  'tree_a', 'tree_b', 'lumber', 'sack',
  'peasant_hooded', 'peasant_red', 'peasant_axe',
] as const;
export type ModelName = (typeof MODELS)[number];

interface Entry {
  gltf: GLTF;
  /** Bounding box of the untouched model, used to normalise placement. */
  box: THREE.Box3;
}

export class Assets {
  private entries = new Map<ModelName, Entry>();

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
      this.entries.set(name, { gltf, box: new THREE.Box3().setFromObject(gltf.scene) });
      onProgress?.(++done, MODELS.length);
    }));
  }

  animations(name: ModelName): THREE.AnimationClip[] {
    return this.get(name).gltf.animations;
  }

  /**
   * A fresh copy of a model standing on y=0, centred on the origin, scaled
   * so its footprint is `fit` tiles wide, or so it is `height` tiles tall.
   */
  instance(name: ModelName, size: { fit?: number; height?: number }): THREE.Group {
    const { gltf, box } = this.get(name);
    const obj = cloneSkinned(gltf.scene);
    const dim = box.getSize(new THREE.Vector3());
    const s = size.height ? size.height / dim.y : (size.fit ?? 1) / Math.max(dim.x, dim.z);
    obj.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    const inner = new THREE.Group();
    inner.add(obj);
    inner.scale.setScalar(s);
    const wrap = new THREE.Group();
    wrap.add(inner);
    return wrap;
  }

  private get(name: ModelName): Entry {
    const e = this.entries.get(name);
    if (!e) throw new Error(`model not loaded: ${name}`);
    return e;
  }
}
