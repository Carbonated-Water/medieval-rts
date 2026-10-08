import * as THREE from 'three';
import { NEUTRAL, NEUTRAL_COLOR } from '../config';
import type { City, Game } from '../game';
import { hexCenter } from '../hex';
import type { Assets } from './assets';
import type { Particles } from './fx';

const POLE_HEIGHT = { capital: 2.35, town: 1.05 };
const FLAG_SIZE = { capital: [0.42, 0.28], town: [0.3, 0.2] } as const;

interface Entry { root: THREE.Group; flag: THREE.Mesh; owner: number; pop: number }

/** City buildings (shared stone palette) with a waving flag in the owner's colour. */
export class Cities {
  readonly group = new THREE.Group();
  private entries = new Map<number, Entry>();
  private pole = new THREE.CylinderGeometry(0.015, 0.015, 1, 6).translate(0, 0.5, 0);
  private poleMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.8 });
  private time = 0;

  constructor(private game: Game, private assets: Assets, private particles: Particles) {
    for (const c of game.cities) this.create(c);
  }

  update(dt: number): void {
    this.time += dt;
    for (const c of this.game.cities) {
      const e = this.entries.get(c.id)!;
      if (e.owner !== c.owner) {
        e.owner = c.owner;
        (e.flag.material as THREE.MeshStandardMaterial).color.set(this.color(c.owner));
        e.pop = 0;
        const { x, z } = hexCenter(c.col, c.row);
        this.particles.burst(new THREE.Vector3(x, 0.4, z), this.color(c.owner), 18, { speed: 1.6, up: 2.2, size: 0.05, life: 0.9 });
      }
      // Flag wave, and a little bounce when a city changes hands.
      e.flag.rotation.y = Math.sin(this.time * 2.2 + c.id) * 0.25;
      if (e.pop < 1) {
        e.pop = Math.min(1, e.pop + dt * 2.5);
        e.flag.scale.setScalar(1 + Math.sin(e.pop * Math.PI) * 0.6);
      }
    }
  }

  private color(owner: number): number {
    return owner === NEUTRAL ? NEUTRAL_COLOR : this.game.nations[owner]!.color;
  }

  private create(c: City): void {
    const kind = c.capital ? 'capital' : 'town';
    const root = new THREE.Group();
    const { x, z } = hexCenter(c.col, c.row);
    root.position.set(x, 0, z);

    const building = this.assets.instance(kind);
    building.rotation.y = Math.PI / 6;
    if (!c.capital) building.scale.setScalar(1.6); // the house model is small for a whole town
    root.add(building);

    const h = POLE_HEIGHT[kind];
    const pole = new THREE.Mesh(this.pole, this.poleMat);
    pole.scale.y = h;
    pole.position.set(c.capital ? 0 : 0.2, 0, c.capital ? 0 : -0.15);
    pole.castShadow = true;
    const [w, fh] = FLAG_SIZE[kind];
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(w, fh).translate(w / 2, -fh / 2, 0),
      new THREE.MeshStandardMaterial({ color: this.color(c.owner), roughness: 0.6, side: THREE.DoubleSide }),
    );
    flag.position.set(pole.position.x, h, pole.position.z);
    flag.castShadow = true;
    root.add(pole, flag);

    this.group.add(root);
    this.entries.set(c.id, { root, flag, owner: c.owner, pop: 1 });
  }
}
