import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { TILE, UNITS, type BuildingKind, type Owner } from '../config';
import { isUnit, type Building, type Game, type Mine, type Unit } from '../game';
import type { PanZoom } from '../input';
import { Assets } from './assets';
import { Forest } from './forest';
import { Arrows, Particles, TapMarker } from './fx';
import { Structures } from './structures';
import { buildTerrain } from './terrain';
import { Units } from './units';

/** Direction from the camera's look-at point to the camera (≈ isometric, a touch steeper). */
const CAMERA_DIR = new THREE.Vector3(1, 1.15, 1).normalize();
const MIN_VIEW = 5; // tiles visible vertically, fully zoomed in
const MAX_VIEW = 30;

export interface Overlay {
  selectedUnits: Set<number>;
  selectedBuilding: number | null;
  ghost: { kind: BuildingKind; tx: number; ty: number; ok: boolean } | null;
}

/**
 * Everything on screen except the DOM HUD. Owns the Three.js renderer,
 * the camera rig (pan / zoom / picking) and the per-frame sync from game
 * state to scene objects. Game logic never depends on this.
 */
export class View implements PanZoom {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private composer: EffectComposer | null = null;
  private sun = new THREE.DirectionalLight(0xfff0d8, 2.7);
  private assets = new Assets();
  private particles = new Particles();
  private marker = new TapMarker();
  private arrows = new Arrows();
  private eventSeq = 0;
  private forest!: Forest;
  private structures!: Structures;
  private units!: Units;
  private raycaster = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private target = new THREE.Vector3();
  private viewH = 10;
  private bars: HTMLElement;
  private barPool: HTMLElement[] = [];

  constructor(parent: HTMLElement, private game: Game, opts: { effects: boolean }) {
    const mobile = matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.canvas = this.renderer.domElement;
    parent.appendChild(this.canvas);

    this.bars = document.createElement('div');
    this.bars.id = 'bars';
    parent.appendChild(this.bars);

    this.scene.background = new THREE.Color(0x8fbcdf);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);

    this.scene.add(new THREE.HemisphereLight(0xe2efff, 0x55663a, 1.25));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    if (opts.effects) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      const ao = new GTAOPass(this.scene, this.camera, innerWidth, innerHeight);
      ao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.4, thickness: 1, scale: 1.1 });
      ao.blendIntensity = 0.85;
      this.composer.addPass(ao);
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.16, 0.5, 0.92));
      this.composer.addPass(new OutputPass());
    }

    addEventListener('resize', () => this.resize());
  }

  async load(onProgress?: (done: number, total: number) => void): Promise<void> {
    await this.assets.load(onProgress);
    this.scene.add(buildTerrain(this.game));
    this.forest = new Forest(this.game.map, this.assets);
    this.structures = new Structures(this.game, this.assets, this.particles);
    this.units = new Units(this.game, this.assets, this.particles);
    this.scene.add(this.forest.group, this.structures.group, this.units.group, this.particles.mesh, this.marker.mesh, this.arrows.group);

    const hall = this.game.buildings.get(this.game.hallId)!;
    this.target.set(hall.tx + hall.size / 2, 0, hall.ty + hall.size / 2);
    // Show ~11 tiles across the narrow side: portrait phones zoom out, desktops stay close.
    const aspect = innerWidth / innerHeight;
    this.viewH = THREE.MathUtils.clamp(aspect < 1 ? 11 / aspect : 13, 9, 24);
    this.resize();
  }

  // ---------- per frame ----------

  update(dt: number, o: Overlay): void {
    // Deaths and destructions first, so the dying are animated, not just removed.
    for (const e of this.game.events) {
      if (e.seq <= this.eventSeq) continue;
      this.eventSeq = e.seq;
      if (e.type === 'death') this.units.died(e.unit);
      else this.structures.destroyed(e.building);
    }
    this.forest.sync();
    this.structures.update(dt, o.selectedBuilding);
    this.structures.setGhost(o.ghost);
    this.units.update(dt, o.selectedUnits);
    this.arrows.update(this.game.projectiles.map((p) => {
      const t = this.game.entity(p.targetId);
      const tx = t ? (isUnit(t) ? t.x / TILE : t.tx + t.size / 2) : p.x / TILE;
      const tz = t ? (isUnit(t) ? t.y / TILE : t.ty + t.size / 2) : p.y / TILE;
      return { sx: p.sx / TILE, sz: p.sy / TILE, x: p.x / TILE, z: p.y / TILE, tx, tz };
    }));
    this.particles.update(dt);
    this.marker.update(dt);
    this.applyCamera();
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
    this.updateBars();
  }

  showMarker(x: number, z: number): void {
    this.marker.show(x, z);
  }

  // ---------- camera (PanZoom) ----------

  panBy(dx: number, dy: number): void {
    const cx = innerWidth / 2, cy = innerHeight / 2;
    const a = this.groundAt(cx, cy), b = this.groundAt(cx + dx, cy + dy);
    if (a && b) this.target.sub(b.sub(a));
    this.clampTarget();
  }

  zoomAt(factor: number, sx: number, sy: number): void {
    const before = this.groundAt(sx, sy);
    this.viewH = THREE.MathUtils.clamp(this.viewH / factor, MIN_VIEW, MAX_VIEW);
    this.applyCamera();
    const after = this.groundAt(sx, sy);
    if (before && after) this.target.add(before.sub(after));
    this.clampTarget();
  }

  // ---------- picking ----------

  /** Ground point (world units) under a screen point. */
  groundAt(sx: number, sy: number): THREE.Vector3 | null {
    this.ray(sx, sy);
    return this.raycaster.ray.intersectPlane(this.ground, new THREE.Vector3());
  }

  /** Ground tile under a screen point. */
  tileAt(sx: number, sy: number): { tx: number; ty: number } {
    const p = this.groundAt(sx, sy) ?? new THREE.Vector3(-1, 0, -1);
    return { tx: Math.floor(p.x), ty: Math.floor(p.z) };
  }

  /** Units of `owner` whose chest is inside a screen rectangle. */
  unitsInBox(x0: number, y0: number, x1: number, y1: number, owner: Owner): Unit[] {
    const [l, r] = x0 < x1 ? [x0, x1] : [x1, x0];
    const [t, b] = y0 < y1 ? [y0, y1] : [y1, y0];
    const p = new THREE.Vector3();
    return this.game.units.filter((u) => {
      if (u.owner !== owner) return false;
      const s = this.toScreen(this.units.chestOf(u, p));
      return s.x >= l && s.x <= r && s.y >= t && s.y <= b;
    });
  }

  /** Nearest unit (either side) to a screen point, within `radius` pixels. */
  pickUnit(sx: number, sy: number, radius: number): Unit | null {
    let best: Unit | null = null;
    let bestD = radius;
    const p = new THREE.Vector3();
    for (const u of this.game.units) {
      const s = this.toScreen(this.units.chestOf(u, p));
      const d = Math.hypot(s.x - sx, s.y - sy);
      if (d < bestD) { bestD = d; best = u; }
    }
    return best;
  }

  /** Building, mine or tree visibly under a screen point (front-most wins). */
  pickObject(sx: number, sy: number): { structure: Building | Mine } | { tree: { x: number; y: number } } | null {
    this.ray(sx, sy);
    const hits = this.raycaster.intersectObjects([...this.structures.pickables, ...this.forest.pickables], true);
    for (const h of hits) {
      if (!h.object.visible) continue;
      const tree = this.forest.tileOf(h);
      if (tree) return { tree };
      const s = this.structures.ownerOf(h.object);
      if (s) return { structure: s };
    }
    return null;
  }

  // ---------- internals ----------

  private ray(sx: number, sy: number): void {
    const ndc = new THREE.Vector2((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1);
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(ndc, this.camera);
  }

  private toScreen(p: THREE.Vector3): { x: number; y: number } {
    const v = p.clone().project(this.camera);
    return { x: (v.x + 1) * innerWidth / 2, y: (1 - v.y) * innerHeight / 2 };
  }

  private applyCamera(): void {
    const aspect = innerWidth / innerHeight;
    const h = this.viewH / 2;
    this.camera.left = -h * aspect;
    this.camera.right = h * aspect;
    this.camera.top = h;
    this.camera.bottom = -h;
    this.camera.position.copy(this.target).addScaledVector(CAMERA_DIR, 100);
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();

    // The sun follows the view so the shadow map's resolution goes where we look.
    const reach = this.viewH * Math.max(1, aspect) * 0.9 + 3;
    const cam = this.sun.shadow.camera;
    cam.left = -reach; cam.right = reach; cam.top = reach; cam.bottom = -reach;
    cam.near = 1; cam.far = 120;
    cam.updateProjectionMatrix();
    this.sun.target.position.copy(this.target);
    this.sun.position.copy(this.target).add(new THREE.Vector3(-18, 34, 12));
  }

  private clampTarget(): void {
    this.target.x = THREE.MathUtils.clamp(this.target.x, 0, this.game.map.w);
    this.target.z = THREE.MathUtils.clamp(this.target.z, 0, this.game.map.h);
    this.target.y = 0;
  }

  private resize(): void {
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer?.setSize(innerWidth, innerHeight);
    this.applyCamera();
  }

  /**
   * HTML bars: construction / training progress over buildings, and health
   * over anything damaged (team-coloured). Positioned by projecting each
   * entity to the screen every frame.
   */
  private updateBars(): void {
    let n = 0;
    const p = new THREE.Vector3();
    const show = (at: THREE.Vector3, frac: number, kind: string, small = false) => {
      let el = this.barPool[n];
      if (!el) {
        el = document.createElement('div');
        el.className = 'bar';
        el.innerHTML = '<i></i>';
        this.bars.appendChild(el);
        this.barPool.push(el);
      }
      const s = this.toScreen(at);
      el.style.display = 'block';
      el.style.transform = `translate(${s.x}px, ${s.y}px)`;
      el.dataset.kind = kind;
      el.classList.toggle('small', small);
      (el.firstChild as HTMLElement).style.width = `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%`;
      n++;
    };
    for (const b of this.game.buildings.values()) {
      const top = (h: number) => p.set(b.tx + b.size / 2, h, b.ty + b.size / 2);
      if (b.progress < 1) show(top(1.4), b.progress, 'build');
      else if (b.queue.length > 0) show(top(b.size * 1.15), b.trainTimer / UNITS[b.queue[0]!].trainSeconds, 'train');
      if (b.progress >= 1 && b.hp < b.maxHp) show(top(b.size * 1.15 + 0.35), b.hp / b.maxHp, `hp${b.owner}`);
    }
    for (const u of this.game.units) {
      if (u.hp >= u.maxHp) continue;
      show(p.set(u.x / TILE, this.units.headHeight(u), u.y / TILE), u.hp / u.maxHp, `hp${u.owner}`, true);
    }
    for (let i = n; i < this.barPool.length; i++) this.barPool[i]!.style.display = 'none';
  }
}
