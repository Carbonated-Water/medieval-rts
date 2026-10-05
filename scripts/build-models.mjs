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

const KK = '.art/kaykit/KayKit-Medieval-Hexagon-Pack-1.0';
const KC = '.art/kaykit/KayKit-Character-Pack-Adventures-1.0';
const KK_GLTF = `${KK}/addons/kaykit_medieval_hexagon_pack/Assets/gltf`;
const KC_GLTF = `${KC}/addons/kaykit_character_pack_adventures/Characters/gltf`;
const OUT = 'public/models';

/** Output name → source path (without .gltf). */
const STATIC = {
  hall: 'buildings/blue/building_castle_blue',
  house_a: 'buildings/blue/building_home_A_blue',
  house_b: 'buildings/blue/building_home_B_blue',
  mill: 'buildings/blue/building_lumbermill_blue',
  barracks: 'buildings/blue/building_barracks_blue',
  hall_red: 'buildings/red/building_castle_red',
  house_a_red: 'buildings/red/building_home_A_red',
  house_b_red: 'buildings/red/building_home_B_red',
  mill_red: 'buildings/red/building_lumbermill_red',
  barracks_red: 'buildings/red/building_barracks_red',
  rubble: 'buildings/neutral/building_destroyed',
  mine: 'buildings/blue/building_mine_blue',
  site_a: 'buildings/neutral/building_stage_A',
  site_b: 'buildings/neutral/building_stage_B',
  site_c: 'buildings/neutral/building_stage_C',
  tree_a: 'decoration/nature/tree_single_A',
  tree_b: 'decoration/nature/tree_single_B',
  lumber: 'decoration/props/resource_lumber',
  sack: 'decoration/props/sack',
};

/** Output name → [source file, meshes to keep]. Everything else (weapons, shields...) is dropped. */
const CHARACTERS = {
  peasant_hooded: ['Rogue_Hooded', /^Rogue_(Cape|Arm|Body|Head|Leg)/],
  peasant_red: ['Rogue', /^Rogue_(Arm|Body|Head|Leg)/],
  peasant_axe: ['Barbarian', /^(1H_Axe$|Barbarian_(Cape|Arm|Body|Head|Leg))/],
  swordsman: ['Knight', /^(1H_Sword$|Round_Shield$|Knight_(Helmet|Cape|Arm|Body|Head|Leg))/],
  archer: ['Rogue', /^(1H_Crossbow$|Rogue_(Cape|Arm|Body|Head|Leg))/],
};

/** Animation clips the game plays (see src/view/units.ts). */
const ANIMATIONS = new Set([
  'Idle', 'Walking_A', '1H_Melee_Attack_Chop', 'Interact',
  '1H_Melee_Attack_Slice_Diagonal', '1H_Ranged_Shoot', 'Death_A',
]);

const io = new NodeIO();

async function convert(src, out, edit) {
  const doc = await io.read(src);
  if (edit) edit(doc);
  // resample drops keyframes that don't change anything (most of the animation data).
  await doc.transform(resample(), prune(), dedup());
  await io.write(join(OUT, `${out}.glb`), doc);
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const [out, src] of Object.entries(STATIC)) await convert(`${KK_GLTF}/${src}.gltf`, out);

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
