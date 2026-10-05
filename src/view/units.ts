import * as THREE from 'three';
import { TILE } from '../config';
import type { Game, Unit } from '../game';
import type { Assets, ModelName } from './assets';
import { groundRing, type Particles } from './fx';

const LOOKS: ModelName[] = ['peasant_hooded', 'peasant_red', 'peasant_axe'];
const HEIGHT = 0.85; // tiles
const TURN_RATE = 12; // rad/s
const FADE = 0.2; // animation cross-fade, seconds

/** Clip names inside the KayKit character files (kept by scripts/build-models.mjs). */
const CLIP = {
  idle: 'Idle',
  walk: 'Walking_A',
  chop: '1H_Melee_Attack_Chop',
  build: 'Interact',
} as const;
type Pose = keyof typeof CLIP;

/** Fraction into the chop clip where the blow lands; chips fly then. */
const IMPACT = 0.42;

interface Entry {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: Record<Pose, THREE.AnimationAction>;
  pose: Pose;
  ring: THREE.Mesh;
  load: { wood: THREE.Group; gold: THREE.Group };
  lastX: number;
  lastZ: number;
  prevChop: number;
}

export class Units {
  readonly group = new THREE.Group();
  private entries = new Map<number, Entry>();

  constructor(private game: Game, private assets: Assets, private particles: Particles) {}

  update(dt: number, selected: Set<number>): void {
    const live = new Set<number>();
    for (const u of this.game.units) {
      live.add(u.id);
      const e = this.entries.get(u.id) ?? this.create(u);
      const x = u.x / TILE, z = u.y / TILE;
      e.root.position.set(x, 0, z);

      const moving = u.path.length > 0;
      const working = !moving && u.job !== null && 'phase' in u.job && u.job.phase === 'work';
      const pose: Pose = moving ? 'walk' : working ? (u.job!.type === 'build' ? 'build' : 'chop') : 'idle';
      this.setPose(e, pose);

      // Face the way we're walking, or the thing we're working on.
      let dx = x - e.lastX, dz = z - e.lastZ;
      if (working) {
        const t = this.workTarget(u);
        if (t) { dx = t.x - x; dz = t.z - z; }
      }
      if (dx * dx + dz * dz > 1e-6) {
        const want = Math.atan2(dx, dz);
        let d = want - e.root.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        e.root.rotation.y += Math.sign(d) * Math.min(Math.abs(d), TURN_RATE * dt);
      }
      e.lastX = x;
      e.lastZ = z;

      e.load.wood.visible = u.carry?.kind === 'wood';
      e.load.gold.visible = u.carry?.kind === 'gold';
      e.ring.visible = selected.has(u.id);

      e.mixer.update(dt);
      if (pose === 'chop') this.chips(u, e);
    }
    for (const [id, e] of this.entries) {
      if (live.has(id)) continue;
      this.group.remove(e.root);
      this.entries.delete(id);
    }
  }

  /** Screen-space picking support: world point at a unit's chest. */
  chestOf(u: Unit, out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(u.x / TILE, HEIGHT * 0.55, u.y / TILE);
  }

  private create(u: Unit): Entry {
    const look = LOOKS[u.id % LOOKS.length]!;
    const root = new THREE.Group();
    const model = this.assets.instance(look, { height: HEIGHT });
    root.add(model);

    const mixer = new THREE.AnimationMixer(model);
    const clips = this.assets.animations(look);
    const action = (name: string) => {
      const clip = clips.find((c) => c.name === name) ?? clips[0]!;
      return mixer.clipAction(clip);
    };
    const actions = { idle: action(CLIP.idle), walk: action(CLIP.walk), chop: action(CLIP.chop), build: action(CLIP.build) };
    // Peasants move ~2.25 tiles/s, brisker than the walk cycle was authored for.
    actions.walk.timeScale = 1.7;
    actions.idle.play();
    mixer.update(Math.random() * 2); // desync idles

    const ring = groundRing(0.26, 0.32, 0xffffff);
    ring.visible = false;

    // Loads ride on the back.
    const wood = this.assets.instance('lumber', { fit: 0.32 });
    wood.position.set(0, HEIGHT * 0.45, -0.16);
    wood.rotation.y = Math.PI / 2;
    const gold = this.assets.instance('sack', { fit: 0.24 });
    gold.position.set(0, HEIGHT * 0.42, -0.16);
    gold.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = new THREE.MeshStandardMaterial({ color: 0xf2c440, roughness: 0.35, metalness: 0.4 });
    });
    root.add(ring, wood, gold);

    this.group.add(root);
    const e: Entry = { root, mixer, actions, pose: 'idle', ring, load: { wood, gold }, lastX: u.x / TILE, lastZ: u.y / TILE, prevChop: 0 };
    this.entries.set(u.id, e);
    return e;
  }

  private setPose(e: Entry, pose: Pose): void {
    if (e.pose === pose) return;
    const next = e.actions[pose];
    next.reset().fadeIn(FADE).play();
    e.actions[e.pose].fadeOut(FADE);
    e.pose = pose;
  }

  private workTarget(u: Unit): { x: number; z: number } | null {
    const job = u.job;
    if (!job) return null;
    if (job.type === 'gather' && job.kind === 'wood') return { x: job.tx + 0.5, z: job.ty + 0.5 };
    const e = job.type === 'gather' ? this.game.mines.get(job.mineId) : job.type === 'build' ? this.game.buildings.get(job.siteId) : undefined;
    return e ? { x: e.tx + e.size / 2, z: e.ty + e.size / 2 } : null;
  }

  /** Wood chips / gold glints when an axe blow lands. */
  private chips(u: Unit, e: Entry): void {
    const a = e.actions.chop;
    const dur = a.getClip().duration;
    const t = (a.time % dur) / dur;
    if (e.prevChop < IMPACT && t >= IMPACT) {
      const target = this.workTarget(u);
      if (target) {
        const x = u.x / TILE, z = u.y / TILE;
        const p = new THREE.Vector3(x + (target.x - x) * 0.45, 0.35, z + (target.z - z) * 0.45);
        const gold = u.job?.type === 'gather' && u.job.kind === 'gold';
        this.particles.burst(p, gold ? 0xf4cc4a : 0xc9955a, gold ? 4 : 6, { speed: 1.3, up: 1.8, size: gold ? 0.045 : 0.055, life: 0.6 });
      }
    }
    e.prevChop = t;
  }
}
