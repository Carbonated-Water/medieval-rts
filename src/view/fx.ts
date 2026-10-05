import * as THREE from 'three';

const MAX = 400;
const GRAVITY = -6;

interface Particle { pos: THREE.Vector3; vel: THREE.Vector3; life: number; max: number; size: number; spin: number }

/** Small tumbling cubes: wood chips, dust puffs, gold glints. */
export class Particles {
  readonly mesh: THREE.InstancedMesh;
  private parts: Particle[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private s = new THREE.Vector3();

  constructor() {
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ roughness: 0.8 }),
      MAX,
    );
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
  }

  burst(at: THREE.Vector3, color: THREE.ColorRepresentation, n: number, opts: { speed?: number; up?: number; size?: number; life?: number } = {}): void {
    const c = new THREE.Color(color);
    for (let i = 0; i < n && this.parts.length < MAX; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (opts.speed ?? 1.2) * (0.5 + Math.random() * 0.5);
      const p: Particle = {
        pos: at.clone(),
        vel: new THREE.Vector3(Math.cos(a) * sp, (opts.up ?? 2) * (0.6 + Math.random() * 0.6), Math.sin(a) * sp),
        life: 0,
        max: (opts.life ?? 0.7) * (0.7 + Math.random() * 0.6),
        size: (opts.size ?? 0.05) * (0.7 + Math.random() * 0.6),
        spin: (Math.random() - 0.5) * 20,
      };
      this.mesh.setColorAt(this.parts.length, c.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.12));
      this.parts.push(p);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    let w = 0;
    for (let r = 0; r < this.parts.length; r++) {
      const p = this.parts[r]!;
      p.life += dt;
      if (p.life >= p.max) continue;
      p.vel.y += GRAVITY * dt;
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < 0.01) { p.pos.y = 0.01; p.vel.set(p.vel.x * 0.4, -p.vel.y * 0.25, p.vel.z * 0.4); }
      if (w !== r) {
        this.parts[w] = p;
        const col = new THREE.Color();
        this.mesh.getColorAt(r, col);
        this.mesh.setColorAt(w, col);
      }
      const k = 1 - Math.max(0, (p.life - p.max * 0.6) / (p.max * 0.4)); // shrink out
      this.e.set(p.life * p.spin, p.life * p.spin * 0.7, 0);
      this.m.compose(p.pos, this.q.setFromEuler(this.e), this.s.setScalar(p.size * k));
      this.mesh.setMatrixAt(w++, this.m);
    }
    this.parts.length = w;
    this.mesh.count = w;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

/**
 * Arrows in flight, mirrored from the simulation's projectiles. They follow
 * the sim's straight-line position and add a parabolic height so shots arc.
 */
export class Arrows {
  readonly group = new THREE.Group();
  private pool: THREE.Mesh[] = [];
  private geo = new THREE.CylinderGeometry(0.012, 0.012, 0.32, 5).rotateX(Math.PI / 2);
  private mat = new THREE.MeshStandardMaterial({ color: 0x5b3b1e, roughness: 0.8 });
  private tip = new THREE.ConeGeometry(0.025, 0.07, 6).rotateX(Math.PI / 2).translate(0, 0, 0.19);
  private tipMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc4, metalness: 0.6, roughness: 0.4 });

  /** `shots`: launch point, current point and target point, in tiles. */
  update(shots: { sx: number; sz: number; x: number; z: number; tx: number; tz: number }[]): void {
    shots.forEach((s, i) => {
      const m = this.pool[i] ?? this.make();
      m.visible = true;
      const flown = Math.hypot(s.x - s.sx, s.z - s.sz);
      const left = Math.hypot(s.tx - s.x, s.tz - s.z);
      const total = Math.max(0.01, flown + left);
      const k = flown / total;
      const arc = (t: number) => 0.55 + Math.sin(t * Math.PI) * total * 0.12;
      m.position.set(s.x, arc(k), s.z);
      // Aim along the arc: a point slightly further along the flight.
      const k2 = Math.min(1, k + 0.05);
      m.lookAt(s.sx + (s.tx - s.sx) * k2, arc(k2), s.sz + (s.tz - s.sz) * k2);
    });
    for (let i = shots.length; i < this.pool.length; i++) this.pool[i]!.visible = false;
  }

  private make(): THREE.Mesh {
    const m = new THREE.Mesh(this.geo, this.mat);
    m.add(new THREE.Mesh(this.tip, this.tipMat));
    m.castShadow = true;
    this.group.add(m);
    this.pool.push(m);
    return m;
  }
}

/** Flat ring lying on the ground; `square` makes it axis-aligned with 4 sides. */
export function groundRing(inner: number, outer: number, color: THREE.ColorRepresentation, square = false): THREE.Mesh {
  const geo = square ? new THREE.RingGeometry(inner, outer, 4, 1, Math.PI / 4) : new THREE.RingGeometry(inner, outer, 40);
  geo.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
  ring.position.y = 0.03;
  ring.renderOrder = 2;
  return ring;
}

/** Expanding, fading ring where the player tapped an order. */
export class TapMarker {
  readonly mesh = groundRing(0.28, 0.36, 0x9cff8a);
  private age = Infinity;

  constructor() { this.mesh.visible = false; }

  show(x: number, z: number): void {
    this.mesh.position.set(x, 0.04, z);
    this.age = 0;
  }

  update(dt: number): void {
    this.age += dt;
    const t = this.age / 0.6;
    this.mesh.visible = t < 1;
    if (!this.mesh.visible) return;
    this.mesh.scale.setScalar(1 + t * 1.6);
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
  }
}
