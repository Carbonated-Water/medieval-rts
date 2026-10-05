import * as THREE from 'three';
import { BUILDINGS, type BuildingKind } from '../config';
import type { Building, Game, Mine } from '../game';
import type { Assets, ModelName } from './assets';
import { groundRing, type Particles } from './fx';

/** Finished-building model per kind (houses alternate between two looks). */
const FINAL: Record<BuildingKind, ModelName[]> = {
  hall: ['hall'],
  house: ['house_a', 'house_b'],
  mill: ['mill'],
};
/** Construction stages shown as progress climbs. */
const STAGES: ModelName[] = ['site_a', 'site_b', 'site_c'];
/** Models are scaled to this fraction of the footprint so neighbours don't touch. */
const FILL = 0.92;
/** Turn models so their fronts face the camera (which looks from +x,+z). */
const FACING = Math.PI / 4;

const POP_SECONDS = 0.45;

interface Entry {
  root: THREE.Group;
  model: THREE.Group | null;
  modelKey: string;
  ring: THREE.Mesh;
  popT: number; // seconds since completion, for the pop-in bounce
}

const finalModel = (b: Building): ModelName => {
  const options = FINAL[b.kind];
  return options[b.id % options.length]!;
};
const stageModel = (b: Building): ModelName => STAGES[Math.min(STAGES.length - 1, Math.floor(b.progress * STAGES.length))]!;

/** Buildings, construction sites and gold mines. */
export class Structures {
  readonly group = new THREE.Group();
  private entries = new Map<number, Entry>();
  private ghost: { root: THREE.Group; kind: BuildingKind; ok: boolean | null; footprint: THREE.Mesh } | null = null;
  private ghostMats = {
    ok: new THREE.MeshStandardMaterial({ color: 0x8cff8c, transparent: true, opacity: 0.55, depthWrite: false }),
    bad: new THREE.MeshStandardMaterial({ color: 0xff6b6b, transparent: true, opacity: 0.55, depthWrite: false }),
  };

  constructor(private game: Game, private assets: Assets, private particles: Particles) {}

  update(dt: number, selected: number | null): void {
    const live = new Set<number>();
    for (const b of this.game.buildings.values()) {
      live.add(b.id);
      const e = this.entry(b);
      const key = b.progress >= 1 ? finalModel(b) : stageModel(b);
      if (e.modelKey !== key) {
        const finishing = e.modelKey.startsWith('site') && b.progress >= 1;
        this.swapModel(e, key, b.size);
        if (finishing) {
          e.popT = 0;
          const c = this.center(b);
          this.particles.burst(new THREE.Vector3(c.x, 0.2, c.z), 0xd8c39a, 28, { speed: 2.4, up: 1.6, size: 0.09, life: 0.9 });
        }
      }
      if (e.popT < POP_SECONDS) {
        e.popT += dt;
        const t = Math.min(1, e.popT / POP_SECONDS);
        // Overshoot then settle.
        const s = 1 + Math.sin(t * Math.PI) * 0.12 * (1 - t);
        e.root.scale.set(s, 1 + Math.sin(t * Math.PI) * 0.18 * (1 - t), s);
      }
      e.ring.visible = b.id === selected;
    }
    for (const m of this.game.mines.values()) {
      live.add(m.id);
      const e = this.entry(m);
      if (!e.model) this.swapModel(e, 'mine', m.size);
      e.ring.visible = false;
    }
    for (const [id, e] of this.entries) {
      if (live.has(id)) continue;
      this.group.remove(e.root);
      this.entries.delete(id);
    }
  }

  /** Translucent preview of a building at a tile, green if it can be placed. */
  setGhost(g: { kind: BuildingKind; tx: number; ty: number; ok: boolean } | null): void {
    if (!g) {
      if (this.ghost) this.group.remove(this.ghost.root);
      this.ghost = null;
      return;
    }
    const size = BUILDINGS[g.kind].size;
    if (!this.ghost || this.ghost.kind !== g.kind) {
      if (this.ghost) this.group.remove(this.ghost.root);
      const root = new THREE.Group();
      const model = this.assets.instance(FINAL[g.kind][0]!, { fit: size * FILL });
      model.rotation.y = FACING;
      model.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = false; });
      const footprint = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x8cff8c, transparent: true, opacity: 0.35, depthWrite: false }),
      );
      footprint.position.y = 0.03;
      root.add(model, footprint);
      this.group.add(root);
      this.ghost = { root, kind: g.kind, ok: null, footprint };
    }
    if (this.ghost.ok !== g.ok) {
      const mat = g.ok ? this.ghostMats.ok : this.ghostMats.bad;
      this.ghost.root.children[0]!.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = mat; });
      (this.ghost.footprint.material as THREE.MeshBasicMaterial).color.set(g.ok ? 0x8cff8c : 0xff6b6b);
      this.ghost.ok = g.ok;
    }
    this.ghost.root.position.set(g.tx + size / 2, 0, g.ty + size / 2);
  }

  get pickables(): THREE.Object3D[] {
    return [...this.entries.values()].map((e) => e.root);
  }

  /** The building or mine whose model contains `obj`. */
  ownerOf(obj: THREE.Object3D): Building | Mine | null {
    for (let o: THREE.Object3D | null = obj; o; o = o.parent) {
      const id = o.userData.entityId as number | undefined;
      if (id !== undefined) return this.game.buildings.get(id) ?? this.game.mines.get(id) ?? null;
    }
    return null;
  }

  center(e: { tx: number; ty: number; size: number }): { x: number; z: number } {
    return { x: e.tx + e.size / 2, z: e.ty + e.size / 2 };
  }

  private entry(e: Building | Mine): Entry {
    let entry = this.entries.get(e.id);
    if (entry) return entry;
    const root = new THREE.Group();
    const c = this.center(e);
    root.position.set(c.x, 0, c.z);
    root.userData.entityId = e.id;
    const r = (e.size / 2 + 0.08) * Math.SQRT2;
    const ring = groundRing(r - 0.06 * Math.SQRT2, r, 0xffffff, true);
    ring.visible = false;
    root.add(ring);
    this.group.add(root);
    entry = { root, model: null, modelKey: '', ring, popT: Infinity };
    this.entries.set(e.id, entry);
    return entry;
  }

  private swapModel(e: Entry, key: ModelName, size: number): void {
    if (e.model) e.root.remove(e.model);
    e.model = this.assets.instance(key, { fit: size * FILL });
    e.model.rotation.y = FACING;
    e.root.add(e.model);
    e.modelKey = key;
  }
}
