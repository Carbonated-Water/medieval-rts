// Builds public/models/ from the raw art packs in .art/ (gitignored).
// Keeps only the models, meshes and animations the game uses, and writes
// each as a self-contained .glb. Run with `npm run models` after changing
// the lists below; the output is committed so the build doesn't need .art/.
//
// Source packs (CC0, see public/models/LICENSE-*.txt):
//   .art/kaykit/KayKit-Medieval-Hexagon-Pack-1.0         git clone from github.com/KayKit-Game-Assets
//   .art/kaykit/KayKit-Character-Pack-Adventures-1.0     git clone from github.com/KayKit-Game-Assets

import { NodeIO } from '@gltf-transform/core';
import { dedup, prune, resample } from '@gltf-transform/functions';
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { PNG } from 'pngjs';

const KK = '.art/kaykit/KayKit-Medieval-Hexagon-Pack-1.0';
const KC = '.art/kaykit/KayKit-Character-Pack-Adventures-1.0';
const KK_GLTF = `${KK}/addons/kaykit_medieval_hexagon_pack/Assets/gltf`;
const KC_GLTF = `${KC}/addons/kaykit_character_pack_adventures/Characters/gltf`;
const OUT = 'public/models';

/** Output name → source path (without .gltf). */
const STATIC = {
  hex_grass: 'tiles/base/hex_grass',
  hex_water: 'tiles/base/hex_water',
  forest_a: 'decoration/nature/trees_A_medium',
  forest_b: 'decoration/nature/trees_B_medium',
  forest_c: 'decoration/nature/trees_A_large',
  mountain_a: 'decoration/nature/mountain_A_grass',
  mountain_b: 'decoration/nature/mountain_B_grass_trees',
  mountain_c: 'decoration/nature/mountain_C_grass',
};

/**
 * City buildings: the blue team versions with the blue recoloured to a
 * neutral stone, so any nation can own them (nations are told apart by flag
 * and territory colour; KayKit only has four team colours).
 */
const CITIES = {
  capital: 'buildings/blue/building_castle_blue',
  town: 'buildings/blue/building_home_B_blue',
};

/** Output name → [source file, meshes to keep]. Everything else (weapons, shields...) is dropped. */
const CHARACTERS = {
  soldier: ['Knight', /^(1H_Sword$|Round_Shield$|Knight_(Helmet|Cape|Arm|Body|Head|Leg))/],
};

/** Animation clips the game plays (see src/view/armies.ts). */
const ANIMATIONS = new Set(['Idle', 'Walking_A', 'Cheer']);

const io = new NodeIO();

async function convert(src, out, edit) {
  const doc = await io.read(src);
  if (edit) await edit(doc);
  // resample drops keyframes that don't change anything (most of the animation data).
  await doc.transform(resample(), prune(), dedup());
  await io.write(join(OUT, `${out}.glb`), doc);
}

/** Turn saturated blues in a texture into a warm neutral stone of the same lightness. */
function neutraliseBlue(png) {
  const img = PNG.sync.read(Buffer.from(png));
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max === 0 || b !== max) continue;
    const sat = (max - min) / max;
    const hue = 60 * (4 + (r - g) / (max - min || 1)); // blue sector
    if (sat < 0.3 || hue < 190 || hue > 260) continue;
    const l = (max + min) / 2;
    d[i] = Math.round(Math.min(1, l * 1.08 + 0.05) * 255);
    d[i + 1] = Math.round(Math.min(1, l * 1.0 + 0.04) * 255);
    d[i + 2] = Math.round(Math.min(1, l * 0.9 + 0.02) * 255);
  }
  return new Uint8Array(PNG.sync.write(img));
}

/**
 * KayKit's grass is a lime yellow-green (#b9be32) that fights with yellow
 * and orange territory tints; nudge that hue band toward a fresher green.
 */
function freshenGrass(png) {
  const img = PNG.sync.read(Buffer.from(png));
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), c = max - min;
    if (c === 0 || max === b) continue;
    let h = max === r ? 60 * (((g - b) / c) % 6) : 60 * ((b - r) / c + 2);
    if (h < 0) h += 360;
    const s = c / max;
    if (h < 50 || h > 80 || s < 0.45) continue;
    // Same value, hue +32°, a touch less saturated.
    const nh = h + 32, ns = s * 0.88, v = max * 0.94;
    const k = (n) => (n + nh / 60) % 6;
    const f = (n) => v - v * ns * Math.max(0, Math.min(k(n), 4 - k(n), 1));
    d[i] = Math.round(f(5) * 255);
    d[i + 1] = Math.round(f(3) * 255);
    d[i + 2] = Math.round(f(1) * 255);
  }
  return new Uint8Array(PNG.sync.write(img));
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const [out, src] of Object.entries(STATIC)) {
  await convert(`${KK_GLTF}/${src}.gltf`, out, (doc) => {
    for (const tex of doc.getRoot().listTextures()) tex.setImage(freshenGrass(tex.getImage()));
  });
}

for (const [out, src] of Object.entries(CITIES)) {
  await convert(`${KK_GLTF}/${src}.gltf`, out, (doc) => {
    for (const tex of doc.getRoot().listTextures()) tex.setImage(neutraliseBlue(tex.getImage()));
  });
}

for (const [out, [src, keep]] of Object.entries(CHARACTERS)) {
  await convert(`${KC_GLTF}/${src}.glb`, out, (doc) => {
    const root = doc.getRoot();
    for (const node of root.listNodes()) if (node.getMesh() && !keep.test(node.getName())) node.dispose();
    for (const anim of root.listAnimations()) {
      if (ANIMATIONS.has(anim.getName())) continue;
      // Samplers outlive their animation and keep its keyframe data alive, so dispose them too.
      for (const s of anim.listSamplers()) s.dispose();
      for (const c of anim.listChannels()) c.dispose();
      anim.dispose();
    }
  });
}

await copyFile(`${KK}/LICENSE.txt`, join(OUT, 'LICENSE-kaykit-medieval.txt'));
await copyFile(`${KC}/LICENSE.txt`, join(OUT, 'LICENSE-kaykit-adventurers.txt'));

for (const f of (await readdir(OUT)).sort()) console.log(f);
