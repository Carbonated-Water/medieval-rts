import * as THREE from 'three';
import { TILE, type Owner, type UnitKind } from '../config';
import { isUnit, type Game, type Unit } from '../game';
import type { Assets, ModelName } from './assets';
import { groundRing, type Particles } from './fx';

export const TEAM_COLORS: Record<Owner, number> = { 0: 0x2f6fd6, 1: 0xd63b2f };

const LOOKS: Record<UnitKind, ModelName[]> = {
  peasant: ['peasant_hooded', 'peasant_red', 'peasant_axe'],
  swordsman: ['swordsman'],
  archer: ['archer'],
};
const HEIGHT: Record<UnitKind, number> = { peasant: 0.85, swordsman: 0.95, archer: 0.9 }; // tiles
const TURN_RATE = 12; // rad/s
const FADE = 0.2; // animation cross-fade, seconds
const CORPSE_SECONDS = 3;

/** Clip names inside the KayKit character files (kept by scripts/build-models.mjs). */
const CLIPS = {
  idle: 'Idle',
  walk: 'Walking_A',
  chop: '1H_Melee_Attack_Chop',
  build: 'Interact',
  death: 'Death_A',
} as const;
const ATTACK_CLIP: Record<UnitKind, string> = {
  peasant: '1H_Melee_Attack_Chop',
  swordsman: '1H_Melee_Attack_Slice_Diagonal',
  archer: '1H_Ranged_Shoot',
};
type Pose = keyof typeof CLIPS | 'attack';

/** Fraction into the chop clip where the blow lands; chips fly then. */
const IMPACT = 0.42;

interface Entry {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: Record<Pose, THREE.AnimationAction>;
  pose: Pose;
  ring: THREE.Mesh;
  disc: THREE.Mesh;
  load: { wood: THREE.Group; gold: THREE.Group };
  lastX: number;
  lastZ: number;
  prevChop: number;
  lastAttack: number;
  /** Seconds since death; undefined while alive. */
  dead?: number;
}

export class Units {
  readonly group = new THREE.Group();
  private entries = new Map<number, Entry>();
  private capes: Record<Owner, THREE.Material> = {
    0: new THREE.MeshStandardMaterial({ color: TEAM_COLORS[0], roughness: 0.75 }),
    1: new THREE.MeshStandardMaterial({ color: TEAM_COLORS[1], roughness: 0.75 }),
  };
  private discGeo = new THREE.CircleGeometry(0.2, 24).rotateX(-Math.PI / 2);
  private discMats: Record<Owner, THREE.Material> = {
    0: new THREE.MeshBasicMaterial({ color: TEAM_COLORS[0], transparent: true, opacity: 0.55, depthWrite: false }),
    1: new THREE.MeshBasicMaterial({ color: TEAM_COLORS[1], transparent: true, opacity: 0.55, depthWrite: false }),
  };

  constructor(private game: Game, private assets: Assets, private particles: Particles) {}

  update(dt: number, selected: Set<number>): void {
    const live = new Set<number>();
    for (const u of this.game.units) {
      live.add(u.id);
      const e = this.entries.get(u.id) ?? this.create(u);
      const x = u.x / TILE, z = u.y / TILE;
      e.root.position.set(x, 0, z);

      const moving = u.path.length > 0;
      const job = u.job;
      const working = !moving && job !== null && 'phase' in job && job.phase === 'work';
      const fighting = !moving && job?.type === 'attack';
      const pose: Pose = moving ? 'walk' : fighting ? 'attack' : working ? (job!.type === 'build' ? 'build' : 'chop') : 'idle';
      this.setPose(e, pose);
      // Restart the swing whenever a new blow / shot is struck so it lines up.
      if (u.lastAttack !== e.lastAttack) {
        e.lastAttack = u.lastAttack;
        if (pose === 'attack') e.actions.attack.time = 0;
      }

      // Face the way we're walking, or the thing we're working on / fighting.
      let dx = x - e.lastX, dz = z - e.lastZ;
      if (working || fighting) {
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
      if (e.dead === undefined) { this.group.remove(e.root); this.entries.delete(id); continue; }
      e.dead += dt;
      e.mixer.update(dt);
      if (e.dead > CORPSE_SECONDS - 1) e.root.position.y = -(e.dead - (CORPSE_SECONDS - 1)) * 0.5; // sink
      if (e.dead >= CORPSE_SECONDS) { this.group.remove(e.root); this.entries.delete(id); }
    }
  }

  /** A unit died: play its death animation, then let it sink away. */
  died(u: Unit): void {
    const e = this.entries.get(u.id);
    if (!e || e.dead !== undefined) return;
    e.dead = 0;
    e.ring.visible = false;
    e.disc.visible = false;
    e.load.wood.visible = e.load.gold.visible = false;
    const death = e.actions.death;
    death.setLoop(THREE.LoopOnce, 1);
    death.clampWhenFinished = true;
    this.setPose(e, 'death');
    this.particles.burst(new THREE.Vector3(u.x / TILE, 0.3, u.y / TILE), 0x9a2020, 6, { speed: 0.8, up: 1.2, size: 0.04, life: 0.5 });
  }

  /** World point at a unit's chest (picking, health bars). */
  chestOf(u: Unit, out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(u.x / TILE, HEIGHT[u.kind] * 0.55, u.y / TILE);
  }

  headHeight(u: Unit): number {
    return HEIGHT[u.kind] * 1.15;
  }

  private create(u: Unit): Entry {
    const looks = LOOKS[u.kind];
    const look = looks[u.id % looks.length]!;
    const root = new THREE.Group();
    const model = this.assets.instance(look, { height: HEIGHT[u.kind] });
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && /Cape/.test(m.name)) m.material = this.capes[u.owner];
    });
    root.add(model);

    const mixer = new THREE.AnimationMixer(model);
    const clips = this.assets.animations(look);
    const action = (name: string) => mixer.clipAction(clips.find((c) => c.name === name) ?? clips[0]!);
    const actions: Record<Pose, THREE.AnimationAction> = {
      idle: action(CLIPS.idle), walk: action(CLIPS.walk), chop: action(CLIPS.chop),
      build: action(CLIPS.build), death: action(CLIPS.death), attack: action(ATTACK_CLIP[u.kind]),
    };
    // Units move ~2 tiles/s, brisker than the walk cycle was authored for.
    actions.walk.timeScale = 1.7;
    actions.idle.play();
    mixer.update(Math.random() * 2); // desync idles

    const ring = groundRing(0.26, 0.32, 0xffffff);
    ring.visible = false;
    const disc = new THREE.Mesh(this.discGeo, this.discMats[u.owner]);
    disc.position.y = 0.02;
    disc.renderOrder = 1;

    // Loads ride on the back.
    const wood = this.assets.instance('lumber', { fit: 0.32 });
    wood.position.set(0, HEIGHT[u.kind] * 0.45, -0.16);
    wood.rotation.y = Math.PI / 2;
    const gold = this.assets.instance('sack', { fit: 0.24 });
    gold.position.set(0, HEIGHT[u.kind] * 0.42, -0.16);
    gold.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = new THREE.MeshStandardMaterial({ color: 0xf2c440, roughness: 0.35, metalness: 0.4 });
    });
    root.add(ring, disc, wood, gold);

    this.group.add(root);
    const e: Entry = {
      root, mixer, actions, pose: 'idle', ring, disc, load: { wood, gold },
      lastX: u.x / TILE, lastZ: u.y / TILE, prevChop: 0, lastAttack: u.lastAttack,
    };
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
    if (job.type === 'attack') {
      const t = this.game.entity(job.targetId);
      if (!t) return null;
      return isUnit(t) ? { x: t.x / TILE, z: t.y / TILE } : { x: t.tx + t.size / 2, z: t.ty + t.size / 2 };
    }
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
