// Dev-only art comparison: the same little village rendered with each
// candidate art pack, with the planned polish layer (shadows, ambient
// occlusion, filmic tone mapping, light bloom). Open /compare.html.
// Delete this folder once an art direction is chosen.

import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const KK = '/.art/kaykit/KayKit-Medieval-Hexagon-Pack-1.0/addons/kaykit_medieval_hexagon_pack/Assets/gltf';
const KKC = '/.art/kaykit/KayKit-Character-Pack-Adventures-1.0/addons/kaykit_character_pack_adventures/Characters/gltf';
const Q = '/.art/quaternius/fantasy-rts/Ultimate Fantasy RTS - Aug 2022/glTF';
const KN = '/.art/kenney/mini-characters/Models/GLB format';

interface Anims { walk: string; idle: string; work: string }
interface Style {
  label: string;
  hall: string;
  houses: string[];
  mill: string;
  mine: string;
  gold: string;
  logs: string;
  trees: string[];
  rocks: string[];
  props: string[];
  people: string[];
  anims: Anims;
}

const STYLES: Record<string, Style> = {
  kaykit: {
    label: 'A · KayKit buildings + KayKit Adventurers',
    hall: `${KK}/buildings/blue/building_castle_blue.gltf`,
    houses: [`${KK}/buildings/blue/building_home_A_blue.gltf`, `${KK}/buildings/blue/building_home_B_blue.gltf`],
    mill: `${KK}/buildings/blue/building_lumbermill_blue.gltf`,
    mine: `${KK}/buildings/blue/building_mine_blue.gltf`,
    gold: `${KK}/decoration/props/resource_stone.gltf`,
    logs: `${KK}/decoration/props/resource_lumber.gltf`,
    trees: [`${KK}/decoration/nature/tree_single_A.gltf`, `${KK}/decoration/nature/tree_single_B.gltf`],
    rocks: [`${KK}/decoration/nature/rock_single_A.gltf`, `${KK}/decoration/nature/rock_single_C.gltf`],
    props: [`${KK}/decoration/props/barrel.gltf`, `${KK}/decoration/props/crate_A_small.gltf`, `${KK}/decoration/props/wheelbarrow.gltf`],
    people: [`${KKC}/Rogue_Hooded.glb`, `${KKC}/Barbarian.glb`, `${KKC}/Rogue.glb`],
    anims: { walk: 'Walking_A', idle: 'Idle', work: '1H_Melee_Attack_Chop' },
  },
  quaternius: {
    label: 'B · Quaternius Fantasy RTS + Kenney Mini Characters',
    hall: `${Q}/TownCenter_FirstAge_Level3.gltf`,
    houses: [`${Q}/Houses_FirstAge_1_Level3.gltf`, `${Q}/Houses_FirstAge_2_Level3.gltf`],
    mill: `${Q}/Storage_FirstAge_Leve3.gltf`,
    mine: `${Q}/Mine.gltf`,
    gold: `${Q}/Resource_Gold_1.gltf`,
    logs: `${Q}/Logs.gltf`,
    trees: [`${Q}/Resource_PineTree.gltf`, `${Q}/Resource_Tree1.gltf`, `${Q}/Resource_Tree2.gltf`],
    rocks: [`${Q}/Resource_Rock_1.gltf`, `${Q}/Resource_Rock_2.gltf`],
    props: [`${Q}/Barrel.gltf`, `${Q}/Crate.gltf`, `${Q}/Crate_Stack1.gltf`],
    people: [`${KN}/character-male-a.glb`, `${KN}/character-female-b.glb`, `${KN}/character-male-c.glb`],
    anims: { walk: 'walk', idle: 'idle', work: 'attack-melee-right' },
  },
};

const params = new URLSearchParams(location.search);
const styleKey = params.get('style') && STYLES[params.get('style')!] ? params.get('style')! : 'kaykit';
const style = STYLES[styleKey]!;
const fx = params.get('fx') !== '0';

// ---------- UI ----------
const bar = document.getElementById('bar')!;
const link = (label: string, s: string, f: boolean) => {
  const on = s === styleKey && f === fx;
  bar.insertAdjacentHTML('beforeend', `<a class="${on ? 'on' : ''}" href="?style=${s}&fx=${f ? 1 : 0}">${label}</a>`);
};
link('A · KayKit', 'kaykit', true);
link('B · Quaternius', 'quaternius', true);
link(`${styleKey === 'kaykit' ? 'A' : 'B'} without effects`, styleKey, false);
const label = document.getElementById('label')!;

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cc4e0);

const VIEW = 15; // tiles visible vertically
const aspect = () => innerWidth / innerHeight;
const camera = new THREE.OrthographicCamera(-VIEW * aspect() / 2, VIEW * aspect() / 2, VIEW / 2, -VIEW / 2, 0.1, 200);
camera.position.set(30, 26, 30);
camera.lookAt(0, 0, 0);

scene.add(new THREE.HemisphereLight(0xe4f0ff, 0x56663a, 1.3));
const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
sun.position.set(-10, 18, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -14;
sun.shadow.camera.right = 14;
sun.shadow.camera.top = 14;
sun.shadow.camera.bottom = -14;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun);

// ---------- ground ----------
function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const POND = new THREE.Vector2(-6, 5);
/** Distance from point p to segment ab, for dirt paths. */
function segDist(p: THREE.Vector2, a: THREE.Vector2, b: THREE.Vector2): number {
  const ab = b.clone().sub(a);
  const t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
  return p.distanceTo(a.clone().add(ab.multiplyScalar(t)));
}
const PATHS: [THREE.Vector2, THREE.Vector2][] = [
  [new THREE.Vector2(0, 0), new THREE.Vector2(4.5, -3)],
  [new THREE.Vector2(0, 0), new THREE.Vector2(4, 3)],
  [new THREE.Vector2(0, 0), new THREE.Vector2(-4, 0.5)],
];
{
  const size = 30;
  const geo = new THREE.PlaneGeometry(size, size, 150, 150);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position!;
  const colors = new Float32Array(pos.count * 3);
  const grassA = new THREE.Color(0x6fa64a), grassB = new THREE.Color(0x8cb854);
  const dirt = new THREE.Color(0xb39060), sand = new THREE.Color(0xe0cc8e);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const p = new THREE.Vector2(x, z);
    const n = noise(x * 0.35, z * 0.35) * 0.7 + noise(x * 1.7, z * 1.7) * 0.3;
    c.copy(grassA).lerp(grassB, n);
    const path = Math.min(...PATHS.map(([a, b]) => segDist(p, a, b)));
    if (path < 0.95) c.lerp(dirt, 1 - THREE.MathUtils.smoothstep(path, 0.25, 0.75 + noise(x * 2, z * 2) * 0.2));
    const pd = p.distanceTo(POND);
    if (pd < 3.2) c.lerp(sand, 1 - THREE.MathUtils.smoothstep(pd, 2.4, 3.2));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  ground.receiveShadow = true;
  scene.add(ground);

  const water = new THREE.Mesh(
    new THREE.CircleGeometry(2.5, 48).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x3f86c4, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.9 }),
  );
  water.position.set(POND.x, 0.02, POND.y);
  water.receiveShadow = true;
  scene.add(water);
}

// ---------- model loading ----------
const loader = new GLTFLoader();
const cache = new Map<string, Promise<GLTF>>();
const load = (url: string) => {
  if (!cache.has(url)) cache.set(url, loader.loadAsync(encodeURI(url)));
  return cache.get(url)!;
};

/**
 * Place a model so it stands on the ground at (x, z), centred, scaled so its
 * footprint is `fit` tiles wide (or `height` tall when given).
 */
async function place(url: string, x: number, z: number, opts: { fit?: number; height?: number; rot?: number } = {}) {
  const gltf = await load(url);
  const obj = cloneSkinned(gltf.scene);
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const s = opts.height ? opts.height / size.y : (opts.fit ?? 1) / Math.max(size.x, size.z);
  const wrap = new THREE.Group();
  obj.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  wrap.add(obj);
  wrap.scale.setScalar(s);
  wrap.position.set(x, 0, z);
  wrap.rotation.y = opts.rot ?? 0;
  scene.add(wrap);
  return { wrap, obj, gltf };
}

// ---------- the village ----------
const mixers: THREE.AnimationMixer[] = [];
const walkers: { g: THREE.Group; a: THREE.Vector3; b: THREE.Vector3; t: number; speed: number }[] = [];

function play(obj: THREE.Object3D, gltf: GLTF, name: string) {
  const clip = gltf.animations.find((a) => a.name === name) ?? gltf.animations[0];
  if (!clip) return;
  const mixer = new THREE.AnimationMixer(obj);
  mixer.clipAction(clip).play();
  mixer.update(Math.random() * 2);
  mixers.push(mixer);
}

async function build() {
  const R = (a: number, b: number) => a + Math.random() * (b - a);
  const jobs: Promise<unknown>[] = [
    place(style.hall, 0, 0, { fit: 3, rot: Math.PI / 4 }),
    place(style.houses[0]!, -4, 0.5, { fit: 2, rot: Math.PI / 2 }),
    place(style.houses[1]!, -3.5, -3, { fit: 2, rot: 0.2 }),
    place(style.mill, 4, 3, { fit: 2.2, rot: -Math.PI / 2 }),
    place(style.mine, 4.5, -3, { fit: 2.2, rot: Math.PI }),
    place(style.gold, 2.9, -4.3, { fit: 0.8 }),
    place(style.logs, 2.5, 3.8, { fit: 1 }),
    place(style.props[0]!, 1.8, -1.9, { fit: 0.4 }),
    place(style.props[1]!, 2.3, -1.6, { fit: 0.5, rot: 0.4 }),
    place(style.props[2]!, -1.9, 2.1, { fit: 0.7, rot: 1.2 }),
  ];
  // Forest along the back edge and a grove on the right.
  const treeSpots: [number, number][] = [];
  for (let i = 0; i < 40; i++) treeSpots.push([R(-9, 3), R(-9, -6.2)]);
  for (let i = 0; i < 18; i++) treeSpots.push([R(6.5, 10), R(-2, 6)]);
  for (let i = 0; i < 10; i++) treeSpots.push([R(-1, 3), R(5.5, 8)]);
  treeSpots.forEach(([x, z], i) =>
    jobs.push(place(style.trees[i % style.trees.length]!, x, z, { fit: R(0.8, 1.15), rot: R(0, 6.28) })));
  [[-1.5, -4.5], [6.2, -4.5], [-7.4, 2.2], [1.2, 6]].forEach(([x, z], i) =>
    jobs.push(place(style.rocks[i % style.rocks.length]!, x!, z!, { fit: R(0.6, 1), rot: R(0, 6.28) })));

  // People: one walking to the mine, one chopping, one idling by the hall.
  const H = 0.85;
  const walker = await place(style.people[0]!, 1, -1, { height: H });
  play(walker.obj, walker.gltf, style.anims.walk);
  walkers.push({ g: walker.wrap, a: new THREE.Vector3(1.4, 0, -0.9), b: new THREE.Vector3(3.6, 0, -2.5), t: 0, speed: 0.12 });
  const chopper = await place(style.people[1]!, 1.4, 5.1, { height: H, rot: Math.PI * 0.9 });
  play(chopper.obj, chopper.gltf, style.anims.work);
  const idler = await place(style.people[2]!, -1.6, 1.8, { height: H, rot: 0.8 });
  play(idler.obj, idler.gltf, style.anims.idle);

  await Promise.all(jobs);
  label.textContent = `${style.label}${fx ? '' : ' (no effects)'}`;
  document.body.dataset.ready = '1';
}
build().catch((e) => { label.textContent = `load error: ${e?.message ?? e}`; console.error(e); });

// ---------- post-processing ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
if (fx) {
  const ao = new GTAOPass(scene, camera, innerWidth, innerHeight);
  ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1, scale: 1.1 });
  ao.blendIntensity = 0.9;
  composer.addPass(ao);
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.18, 0.5, 0.92));
}
composer.addPass(new OutputPass());

addEventListener('resize', () => {
  camera.left = -VIEW * aspect() / 2;
  camera.right = VIEW * aspect() / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  for (const m of mixers) m.update(dt);
  for (const w of walkers) {
    w.t += dt * w.speed;
    const k = w.t % 2 < 1 ? w.t % 1 : 1 - (w.t % 1); // ping-pong
    const dir = w.t % 2 < 1 ? 1 : -1;
    w.g.position.lerpVectors(w.a, w.b, k);
    const d = w.b.clone().sub(w.a).multiplyScalar(dir);
    w.g.rotation.y = Math.atan2(d.x, d.z);
  }
  composer.render();
});
