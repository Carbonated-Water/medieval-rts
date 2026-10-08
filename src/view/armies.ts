import * as THREE from 'three';
import { NEUTRAL, NEUTRAL_COLOR } from '../config';
import type { Army, Game } from '../game';
import { hexCenter } from '../hex';
import type { Assets } from './assets';
import { groundRing } from './fx';

const HEIGHT = 0.42; // world units, for a small army
const TURN_RATE = 10; // rad/s
const FADE = 0.2;

interface Entry {
  root: THREE.Group;
  model: THREE.Group;
  mixer: THREE.AnimationMixer;
  idle: THREE.AnimationAction;
  walk: THREE.AnimationAction;
  walking: boolean;
  ring: THREE.Mesh;
  label: HTMLElement;
  lastCount: number;
}

/**
 * One soldier figure per army (bigger armies stand a bit taller), cape and
 * disc in the nation colour, and an HTML number banner that follows it.
 */
export class Armies {
  readonly group = new THREE.Group();
  private entries = new Map<number, Entry>();
  private labels: HTMLElement;
  private discGeo = new THREE.CircleGeometry(0.17, 24).rotateX(-Math.PI / 2);
  private teamMats = new Map<number, { cape: THREE.Material; disc: THREE.Material }>();

  constructor(private game: Game, private assets: Assets, parent: HTMLElement) {
    this.labels = document.createElement('div');
    this.labels.id = 'labels';
    parent.appendChild(this.labels);
  }

  /** World position of an army right now (interpolated mid-step). */
  positionOf(a: Army, out = new THREE.Vector3()): THREE.Vector3 {
    const from = hexCenter(a.col, a.row);
    const next = a.path[0];
    if (!next || a.step <= 0) return out.set(from.x, 0, from.z);
    const to = hexCenter(next.col, next.row);
    return out.set(from.x + (to.x - from.x) * a.step, 0, from.z + (to.z - from.z) * a.step);
  }

  update(dt: number, selected: number | null, toScreen: (p: THREE.Vector3) => { x: number; y: number }): void {
    const live = new Set<number>();
    const p = new THREE.Vector3();
    for (const a of this.game.armies) {
      live.add(a.id);
      const e = this.entries.get(a.id) ?? this.create(a);
      this.positionOf(a, p);
      const moving = a.path.length > 0;

      if (moving) {
        const next = hexCenter(a.path[0]!.col, a.path[0]!.row);
        const want = Math.atan2(next.x - p.x, next.z - p.z);
        let d = want - e.root.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        e.root.rotation.y += Math.sign(d) * Math.min(Math.abs(d), TURN_RATE * dt);
      }
      if (moving !== e.walking) {
        e.walking = moving;
        (moving ? e.walk : e.idle).reset().fadeIn(FADE).play();
        (moving ? e.idle : e.walk).fadeOut(FADE);
      }
      e.mixer.update(dt);

      // Several armies can share a hex for a moment (passing through); nudge so both show.
      const others = this.game.armies.filter((o) => o !== a && o.col === a.col && o.row === a.row && o.path.length === 0 && !moving);
      const nudge = others.length && a.path.length === 0 ? (a.id % 2 ? 0.18 : -0.18) : 0;
      e.root.position.set(p.x + nudge, 0, p.z);
      const s = 1 + Math.min(0.6, Math.log10(Math.max(1, a.count)) * 0.35);
      e.model.scale.setScalar(s);
      e.ring.visible = a.id === selected;

      if (a.count !== e.lastCount) {
        e.lastCount = a.count;
        e.label.textContent = String(a.count);
      }
      const head = toScreen(p.set(p.x + nudge, HEIGHT * s + 0.12, p.z));
      e.label.style.transform = `translate(${head.x}px, ${head.y}px)`;
      e.label.classList.toggle('selected', a.id === selected);
    }
    for (const [id, e] of this.entries) {
      if (live.has(id)) continue;
      this.group.remove(e.root);
      e.label.remove();
      this.entries.delete(id);
    }
  }

  private mats(owner: number) {
    let m = this.teamMats.get(owner);
    if (!m) {
      const color = owner === NEUTRAL ? NEUTRAL_COLOR : this.game.nations[owner]!.color;
      m = {
        cape: new THREE.MeshStandardMaterial({ color, roughness: 0.75 }),
        disc: new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false }),
      };
      this.teamMats.set(owner, m);
    }
    return m;
  }

  private create(a: Army): Entry {
    const root = new THREE.Group();
    const model = new THREE.Group();
    const figure = this.assets.instance('soldier', HEIGHT);
    const mats = this.mats(a.owner);
    figure.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && /Cape/.test(m.name)) m.material = mats.cape;
    });
    model.add(figure);
    root.add(model);

    const mixer = new THREE.AnimationMixer(figure);
    const clips = this.assets.animations('soldier');
    const clip = (name: string) => mixer.clipAction(clips.find((c) => c.name === name) ?? clips[0]!);
    const idle = clip('Idle'), walk = clip('Walking_A');
    walk.timeScale = 1.6;
    idle.play();
    mixer.update(Math.random() * 2);

    const disc = new THREE.Mesh(this.discGeo, mats.disc);
    disc.position.y = 0.04;
    disc.renderOrder = 3;
    const ring = groundRing(0.22, 0.28, 0xffffff);
    ring.position.y = 0.05;
    ring.visible = false;
    root.add(disc, ring);
    this.group.add(root);

    const label = document.createElement('div');
    label.className = 'army-label';
    label.style.setProperty('--team', `#${(a.owner === NEUTRAL ? NEUTRAL_COLOR : this.game.nations[a.owner]!.color).toString(16).padStart(6, '0')}`);
    label.textContent = String(a.count);
    this.labels.appendChild(label);

    const e: Entry = { root, model, mixer, idle, walk, walking: false, ring, label, lastCount: a.count };
    this.entries.set(a.id, e);
    return e;
  }
}
