import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { NEUTRAL, NEUTRAL_COLOR, PLAYER } from '../config';
import type { Army, Game } from '../game';
import { HEX_ROW, hexAt, hexCenter, type Hex } from '../hex';
import type { PanZoom } from '../input';
import { Armies } from './armies';
import { Assets } from './assets';
import { Cities } from './cities';
import { Particles, TapMarker } from './fx';
import { HexMap } from './hexmap';

/** Direction from the camera's look-at point to the camera (≈ isometric, a touch steeper). */
const CAMERA_DIR = new THREE.Vector3(0.7, 1.35, 1).normalize();
const MIN_VIEW = 5; // world units visible vertically, fully zoomed in
const MAX_VIEW = 34;
const MAX_PATH_DOTS = 80;

/**
 * Everything on screen except the DOM HUD: the Three.js renderer, the
 * camera rig (pan / zoom / picking) and the per-frame sync from game state
 * to scene objects. Game logic never depends on this.
 */
export class View implements PanZoom {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private composer: EffectComposer | null = null;
  private sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
  private assets = new Assets();
  private particles = new Particles();
  private marker = new TapMarker();
  private map!: HexMap;
  private cities!: Cities;
  private armies!: Armies;
  private pathDots: THREE.InstancedMesh;
  private raycaster = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private target = new THREE.Vector3();
  private viewH = 12;
  private eventSeq = 0;

  constructor(private parent: HTMLElement, private game: Game, opts: { effects: boolean }) {
    const mobile = matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // Neutral keeps greens green; ACES pushed the KayKit grass toward yellow.
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.canvas = this.renderer.domElement;
    parent.appendChild(this.canvas);

    this.scene.background = new THREE.Color(0x8fc4e8);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);

    this.scene.add(new THREE.HemisphereLight(0xe2efff, 0x55663a, 1.2));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    this.pathDots = new THREE.InstancedMesh(
      new THREE.CircleGeometry(0.07, 12).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }),
      MAX_PATH_DOTS,
    );
    this.pathDots.count = 0;
    this.pathDots.renderOrder = 4;
    this.pathDots.frustumCulled = false;

    if (opts.effects) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      const ao = new GTAOPass(this.scene, this.camera, innerWidth, innerHeight);
      ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.4, thickness: 1, scale: 1.1 });
      ao.blendIntensity = 0.8;
      this.composer.addPass(ao);
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.14, 0.5, 0.92));
      this.composer.addPass(new OutputPass());
    }

    addEventListener('resize', () => this.resize());
  }

  async load(onProgress?: (done: number, total: number) => void): Promise<void> {
    await this.assets.load(onProgress);
    this.map = new HexMap(this.game, this.assets);
    this.cities = new Cities(this.game, this.assets, this.particles);
    this.armies = new Armies(this.game, this.assets, this.parent);
    this.scene.add(this.map.group, this.cities.group, this.armies.group, this.particles.mesh, this.marker.mesh, this.pathDots);

    const cap = this.game.cities.find((c) => c.id === this.game.player.capitalId)!;
    this.focus(cap);
    // ~13 hexes across the narrow side: portrait phones zoom out, desktops stay closer.
    const aspect = innerWidth / innerHeight;
    this.viewH = THREE.MathUtils.clamp(aspect < 1 ? 13 / aspect : 14, 10, 30);
    this.resize();
  }

  // ---------- per frame ----------

  update(dt: number, selected: number | null): void {
    for (const e of this.game.events) {
      if (e.seq <= this.eventSeq) continue;
      this.eventSeq = e.seq;
      if (e.type === 'battle') {
        const { x, z } = hexCenter(e.col, e.row);
        const color = e.winner === NEUTRAL ? NEUTRAL_COLOR : this.game.nations[e.winner]!.color;
        this.particles.burst(new THREE.Vector3(x, 0.3, z), 0xd8d0c0, 10, { speed: 1.4, up: 1.6, size: 0.05, life: 0.6 });
        this.particles.burst(new THREE.Vector3(x, 0.35, z), color, 6, { speed: 1.2, up: 2, size: 0.04, life: 0.6 });
      }
    }
    this.map.update(dt);
    this.cities.update(dt);
    this.armies.update(dt, selected, (p) => this.toScreen(p));
    this.updatePath(selected);
    this.particles.update(dt);
    this.marker.update(dt);
    this.applyCamera();
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  showMarker(h: Hex): void {
    const { x, z } = hexCenter(h.col, h.row);
    this.marker.show(x, z);
  }

  focus(h: Hex): void {
    const { x, z } = hexCenter(h.col, h.row);
    this.target.set(x, 0, z);
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

  groundAt(sx: number, sy: number): THREE.Vector3 | null {
    const ndc = new THREE.Vector2((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1);
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.ray.intersectPlane(this.ground, new THREE.Vector3());
  }

  /** Hex under a screen point (may be off the map; callers bounds-check). */
  hexAtScreen(sx: number, sy: number): Hex | null {
    const p = this.groundAt(sx, sy);
    return p ? hexAt(p.x, p.z) : null;
  }

  /** Nearest army to a screen point within `radius` px; own armies win ties. */
  pickArmy(sx: number, sy: number, radius: number): Army | null {
    let best: Army | null = null;
    let bestD = radius;
    const p = new THREE.Vector3();
    for (const a of this.game.armies) {
      this.armies.positionOf(a, p);
      p.y = 0.25;
      const s = this.toScreen(p);
      const d = Math.hypot(s.x - sx, s.y - sy) - (a.owner === PLAYER ? 6 : 0);
      if (d < bestD) { bestD = d; best = a; }
    }
    return best;
  }

  toScreen(p: THREE.Vector3): { x: number; y: number } {
    const v = p.clone().project(this.camera);
    return { x: (v.x + 1) * innerWidth / 2, y: (1 - v.y) * innerHeight / 2 };
  }

  // ---------- internals ----------

  /** Dots along the selected army's remaining route. */
  private updatePath(selected: number | null): void {
    const a = selected !== null ? this.game.army(selected) : undefined;
    const path = a?.path ?? [];
    const m = new THREE.Matrix4();
    let n = 0;
    for (const h of path) {
      if (n >= MAX_PATH_DOTS) break;
      const { x, z } = hexCenter(h.col, h.row);
      this.pathDots.setMatrixAt(n++, m.makeTranslation(x, 0.06, z));
    }
    this.pathDots.count = n;
    this.pathDots.instanceMatrix.needsUpdate = true;
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
    this.target.x = THREE.MathUtils.clamp(this.target.x, 0, this.game.world.cols);
    this.target.z = THREE.MathUtils.clamp(this.target.z, 0, this.game.world.rows * HEX_ROW);
    this.target.y = 0;
  }

  private resize(): void {
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer?.setSize(innerWidth, innerHeight);
    this.applyCamera();
  }
}
