import { HEAD_STARTS, type HeadStartId, ACHIEVEMENTS, BOATS, DEV_MULTIPLIER, HAND_NAMES, HARBOR_UPGRADES, LETTERS, TRACKS, type GroundId, type HarborUpgradeId, type TrackId, RODS, SKILLS, VARIANTS, baitById, type BaitId, type BoatType, type GearKind, type SkillId, type Tier, LEGENDS, gearById, type GearSlot, FLAGSHIP_UPS, type FlagshipUpId, type MateJob } from './data';
import { Game, type GearItem, fishById, type Line, type SaveData } from './game';
import { Fight } from './fight';
import { FightView } from './fightui';
import { Scene, WORM_SPOT_X } from './scene';
import './ui.css';
import { pixelFishIcon as fishIcon, pixelIcon, gearIcon } from './pixelart';
import { ACH_ICON, BAIT_ICON, GEAR_ICON, SKILL_ICON, UI, type Action } from './ui';

const SAVE_KEY = 'riverside-fishing-v1';

function load(): Partial<SaveData> | undefined {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

const saved = load();
const game = new Game(saved);
// The company kept working while the game was closed (up to the warehouse's hours).
const away = saved?.savedAt ? (Date.now() - saved.savedAt) / 1000 : 0;
const awayEarned = away > 30 ? game.catchUp(away) : 0;
// ?dev=1 switches dev mode on (fish sell for DEV_MULTIPLIER×); the journal has a toggle too.
if (new URLSearchParams(location.search).get('dev') === '1') game.dev = true;
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const scene = new Scene(canvas, game);
const ui = new UI(onAction);
const note = ui.notices;

let dirty = false;

/** The big-fish fight screen (expeditions); results get a banner. */
/** Is the fight on screen a voyage's (its result goes to the voyage) or a practice one? */
let voyageFight = false;
const fightView = new FightView((f) => {
  if (voyageFight) { game.voyageFought(f.end === 'caught'); voyageFight = false; dirty = true; }
});

/** Snapshots of game.made, one a second, for the last minute: the $/sec readout is the difference. */
const madeLog: { t: number; you: number; hands: number; boats: number }[] = [];
function sampleRates(now: number): void {
  const last = madeLog[madeLog.length - 1];
  if (last && now - last.t < 1000) return;
  madeLog.push({ t: now, ...game.made });
  while (madeLog.length > 61) madeLog.shift();
  const first = madeLog[0]!, end = madeLog[madeLog.length - 1]!, secs = (end.t - first.t) / 1000;
  ui.rates = secs < 1 ? null : {
    you: (end.you - first.you) / secs, hands: (end.hands - first.hands) / secs, boats: (end.boats - first.boats) / secs,
  };
}
/** Set by Start over: nothing may be saved again, or the unload save would bring the old game back. */
let wiping = false;
const save = () => {
  if (!dirty || wiping) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(game.save())); dirty = false; } catch { /* storage full or blocked: keep playing */ }
};
setInterval(() => { if (game.company) dirty = true; save(); }, 2000); // an open company always has news to save
addEventListener('pagehide', save);

// Arriving at a shop opens it: the market only if there's something to sell.
scene.onArrive = (p) => {
  if (p === 'market') ui.open = 'market';
  if (p === 'tackle') ui.open = 'tackle';
  if (p === 'school') ui.open = 'training';
  if (p === 'bait') ui.open = 'baitshop';
};

canvas.addEventListener('click', (e) => {
  if (ui.open) return;
  // The harbor across the river opens its panel from anywhere.
  if (scene.hitBobber(e.clientX, e.clientY) >= 0) { game.reel(scene.hitBobber(e.clientX, e.clientY)); return; }
  if (scene.hitJetty(e.clientX, e.clientY)) { ui.open = 'exotic'; return; }
  if (scene.hitGearShop(e.clientX, e.clientY)) { ui.open = 'gearshop'; return; }
  if (scene.hitPub(e.clientX, e.clientY)) { ui.open = 'pub'; return; }
  // Your fisher opens the Character screen, unless you're tapping the shop you stand in front of.
  const shopTap = ['market', 'tackle', 'school', 'bait'].includes(scene.hit(e.clientX, e.clientY));
  if (!shopTap && scene.hitPlayer(e.clientX, e.clientY)) { ui.charTab = 'gear'; ui.open = 'character'; return; }
  if (scene.hitLighthouse(e.clientX, e.clientY)) { ui.open = game.voyage ? 'voyage' : 'lighthouse'; return; }
  if (scene.hitHarbor(e.clientX, e.clientY)) { ui.open = 'harbor'; return; }
  // Hired fishermen and the crate on the wide pier.
  const hand = scene.hitHand(e.clientX, e.clientY);
  if (hand >= 0) { ui.handSel = hand; ui.open = 'hand'; return; }
  if (scene.hitCrate(e.clientX, e.clientY)) { ui.open = 'pier'; return; }
  // Tapping a worm walks over to dig it up (it's picked up on the way past).
  const worm = scene.hitWorm(e.clientX, e.clientY);
  if (worm) { scene.walkTo('ground', worm.x); return; }
  // On the dock, tapping a bobber reels that one line.
  const slot = scene.hitBobber(e.clientX, e.clientY);
  if (slot >= 0) { game.reel(slot); return; }
  const target = scene.hit(e.clientX, e.clientY);
  if (target === 'dock' && scene.place === 'dock') return; // already there; don't put the lines away
  if (target !== 'dock' && target === scene.place && !scene.walking) { scene.onArrive(target); return; } // already standing here: open it
  scene.walkTo(target, e.clientX);
});

/** What the big button / Space does right now: reel a bite, else cast what's out, else reel (too early). */
const primaryAction = (): Action =>
  game.lines.some((l) => l.type === 'bite') ? 'reel'
    : game.lines.some((l) => l.type === 'idle' || l.type === 'result') ? 'cast' : 'reel';

// Keyboard: A/D or arrows walk, Space casts / reels, E opens the building you're at.
const held = new Set<string>();
addEventListener('keydown', (e) => {
  if (['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'].includes(e.code)) { held.add(e.code); e.preventDefault(); }
  if (e.code === 'Space' && !e.repeat) {
    e.preventDefault();
    if (scene.place === 'dock' && !ui.open) onAction(primaryAction());
  }
  const shop = scene.place === 'school' ? 'training' : scene.place === 'bait' ? 'baitshop' : scene.place === 'market' || scene.place === 'tackle' ? scene.place : null;
  if (e.code === 'KeyE' && shop) onAction(ui.open ? 'close' : shop);
  if (e.code === 'Escape') onAction(ui.parentOf(ui.open) ? 'back' : 'close');
});
addEventListener('keyup', (e) => held.delete(e.code));
addEventListener('blur', () => held.clear());

function onAction(a: Action): void {
  if (a === 'cast') {
    if (!game.cast() && !game.activeBait) { const at = scene.fisherScreen(); note.float('NO BAIT', at.x, at.y, 'bad'); }
  }
  else if (a === 'reel') game.reel();
  else if (a === 'market' || a === 'tackle' || a === 'baitshop' || a === 'pouch' || a === 'harbor' || a === 'pier' || a === 'shipyard' || a === 'harborup' || a === 'pierstaff' || a === 'ledger' || a === 'training' || a === 'journal' || a === 'trophies' || a === 'inbox' || a === 'settings' || a === 'tree' || a === 'retire' || a === 'lighthouse' || a === 'exotic' || a === 'voyage' || a === 'gearshop' || a === 'character' || a === 'pub') ui.open = ui.open === a ? null : a;
  else if (a.startsWith('bait:')) game.selectBait(a.slice(5) as BaitId);
  else if (a === 'buyCompany') {
    if (game.buyCompany()) { ui.open = null; note.clearBanners(); note.banner(pixelIcon('boat'), 'THE FISHING CO.', 'is yours', 'rare'); }
  } else if (a.startsWith('buyBoat:')) {
    const type = a.slice(8) as BoatType;
    if (game.buyBoat(type)) { note.banner(pixelIcon('boat'), 'BOUGHT', game.boatName(game.boats.length - 1)); ui.open = 'harbor'; }
  } else if (a.startsWith('sellBoat:')) {
    const i = Number(a.slice(9)), name = game.boatName(i);
    const atSea = game.boats[i]?.trip ? " It's at sea: this trip's catch is lost." : '';
    if (confirm(`Sell ${name} for $${game.boatResale(i).toLocaleString()}? Its upgrades and crew go with it.${atSea}`)) {
      const paid = game.sellBoat(i);
      if (paid) { note.banner(pixelIcon('boat'), `SOLD ${name.toUpperCase()}`, `$${paid.toLocaleString()}`); ui.open = 'harbor'; }
    }
  } else if (a.startsWith('boat:')) { ui.boatSel = Number(a.slice(5)); ui.trackSel = 'hull'; ui.open = 'boat'; }
  else if (a === 'buyPierSection') { if (game.buyPierSection()) note.banner(pixelIcon('anchor'), 'PIER EXTENDED', `${game.pierSpots} spots`); }
  else if (a.startsWith('budget:')) game.setManagerBudget(Number(a.slice(7)));
  else if (a.startsWith('shipBudget:')) game.setShipBudget(Number(a.slice(11)));
  else if (a === 'hire') { if (game.hireHand()) note.banner(pixelIcon('crew'), 'HIRED', HAND_NAMES[game.hands.length - 1]!); }
  else if (a === 'sellCrate') { const n = game.sellCrate(); if (n) note.banner(pixelIcon('fish'), 'CRATE SOLD', `$${n.toLocaleString()}`); }
  else if (a.startsWith('hand:')) { ui.handSel = Number(a.slice(5)); ui.open = 'hand'; }
  else if (a.startsWith('handRod:')) {
    const i = Number(a.slice(8)), next = game.handNextRod(i);
    if (next && game.upgradeHandRod(i)) note.banner(pixelIcon('rod'), HAND_NAMES[i]!.toUpperCase(), next.name);
  } else if (a.startsWith('handTrain:')) {
    const i = Number(a.slice(10));
    if (game.trainHandN(i, ui.buyN || Infinity)) note.banner(pixelIcon('hook'), HAND_NAMES[i]!.toUpperCase(), `Fishing ${game.hands[i]!.skill}`);
  } else if (a.startsWith('handBait:')) {
    const [, i, bait] = a.split(':') as [string, string, BaitId];
    game.setHandBait(Number(i), bait);
  }
  else if (a.startsWith('send:')) game.sendBoat(Number(a.slice(5)));
  else if (a.startsWith('collect:')) {
    const paid = game.collectHaul(Number(a.slice(8)));
    if (paid) note.banner(pixelIcon('boat'), 'HAUL SOLD', `$${paid.toLocaleString()}`);
  } else if (a.startsWith('crew:')) { if (game.hireCrew(Number(a.slice(5)))) note.banner(pixelIcon('crew'), 'HIRED', 'A new deckhand'); }
  else if (a.startsWith('track:')) ui.trackSel = a.slice(6) as TrackId;
  else if (a.startsWith('upgrade:')) {
    const [, i, id] = a.split(':') as [string, string, TrackId];
    if (game.upgradeTrackN(Number(i), id, ui.buyN || Infinity)) note.banner(pixelIcon('anchor'), game.boatName(Number(i)).toUpperCase(), `${TRACKS[id].name} ${game.boats[Number(i)]!.tracks[id]}`);
  } else if (a.startsWith('bestBuy:')) {
    const i = Number(a.slice(8)), best = game.bestBuy(i);
    if (best?.buy()) note.banner(pixelIcon('anchor'), game.boatName(i).toUpperCase(), best.name, 'plain');
  } else if (a.startsWith('buyFitted:')) {
    const type = a.slice(10) as BoatType;
    if (game.buyFittedBoat(type)) { note.banner(pixelIcon('boat'), 'BOUGHT', `${game.boatName(game.boats.length - 1)}, fitted`); ui.open = 'harbor'; }
  } else if (a.startsWith('ground:')) {
    const [, i, id] = a.split(':') as [string, string, GroundId];
    game.setGround(Number(i), id);
  } else if (a === 'sendAll') game.boats.forEach((_, i) => game.sendBoat(i));
  else if (a === 'collectAll') {
    const paid = game.boats.reduce((s, _, i) => s + game.collectHaul(i), 0);
    if (paid) note.banner(pixelIcon('boat'), 'HAULS SOLD', `$${paid.toLocaleString()}`);
  } else if (a === 'buyBerth') { if (game.buyBerth()) note.banner(pixelIcon('anchor'), 'NEW BERTH', `Room for ${game.berthCount} boats`); }
  else if (a === 'buyWarehouse') { if (game.buyWarehouse()) note.banner(pixelIcon('trap'), 'WAREHOUSE', `${game.offlineHours} hours`); }
  else if (a.startsWith('buyHarbor:')) {
    const k = a.slice(10) as HarborUpgradeId;
    if (game.buyHarbor(k)) note.banner(pixelIcon('captain'), 'HIRED', HARBOR_UPGRADES[k].name);
  }
  else if (a.startsWith('buyBait:')) {
    const [, id, n] = a.split(':') as [string, BaitId, string];
    if (game.buyBait(id, Number(n))) note.banner(pixelIcon(BAIT_ICON[id], 3), 'BOUGHT', `${n} x ${baitById(id).name}`, 'plain');
  }
  else if (a === 'claimAll') { const paid = game.claim(); if (paid) note.banner(pixelIcon('coin'), 'COLLECTED', `$${paid.toLocaleString()}`); }
  else if (a.startsWith('achTab:')) { ui.achTab = a.slice(7) as 'base' | 'tree'; ui.pick = null; }
  else if (a.startsWith('trophy:')) {
    // Tap a trophy: show it; if it's ready, collect it too.
    ui.pick = a.slice(7);
    const paid = game.claim(ui.pick);
    if (paid) note.banner(pixelIcon('coin'), 'COLLECTED', `$${paid.toLocaleString()}`);
  }
  else if (a === 'close') ui.open = null;
  else if (a.startsWith('gsMode:')) ui.gsMode = a.slice(7) as 'buy' | 'sell';
  else if (a.startsWith('buyN:')) ui.buyN = a.slice(5) === 'max' ? 0 : Number(a.slice(5)) as 1 | 5;
  else if (a === 'trainAll') { const k = game.trainAll(ui.buyN || Infinity); if (k) note.banner(pixelIcon('hook'), 'TRAINED', `${k} level${k === 1 ? '' : 's'}`, 'plain'); }
  else if (a.startsWith('pubTab:')) ui.pubTab = a.slice(7) as 'board' | 'crew' | 'mate';
  else if (a === 'hireMate') { if (game.hireMate()) note.banner(pixelIcon('captain'), 'HIRED', 'A First Mate', 'plain'); }
  else if (a.startsWith('mateBudget:')) game.setMateBudget(Number(a.slice(11)));
  else if (a.startsWith('mate:')) game.toggleMate(a.slice(5) as MateJob);
  else if (a.startsWith('lhWho:')) ui.lhWho = a.slice(6) as 'you' | 'crew';
  else if (a.startsWith('sign:')) { const s = game.pubBoard.find((x) => x.id === Number(a.slice(5))); if (s && game.signSailor(s.id)) note.banner(pixelIcon('crew'), 'SIGNED', `${s.name}, ${s.role}`, 'plain'); }
  else if (a === 'pubRefresh') game.refreshBoard();
  else if (a === 'flagship') ui.open = 'flagship';
  else if (a.startsWith('flagshipUp:')) { if (game.buyFlagshipUp(a.slice(11) as FlagshipUpId)) note.banner(pixelIcon('boat'), 'FLAGSHIP', FLAGSHIP_UPS[a.slice(11) as FlagshipUpId].name, 'plain'); }
  else if (a.startsWith('crewSail:')) { if (game.sendCrew(a.slice(9))) { note.banner(pixelIcon('boat'), 'CREW SAILED', LEGENDS.find((l) => l.id === a.slice(9))!.spot, 'plain'); ui.open = null; } }
  else if (a.startsWith('charTab:')) ui.charTab = a.slice(8) as 'gear' | 'bag';
  else if (a.startsWith('gpick:')) ui.gsPick = a.slice(6);
  else if (a === 'stats') ui.open = 'stats';
  else if (a === 'keenEye') { if (game.buyKeenEye()) note.banner(pixelIcon('pearl'), 'KEEN EYE', `Level ${game.keenEye}`, 'rare'); }
  else if (a.startsWith('gbuy:')) {
    const r = game.buyGearPiece(a.slice(5));
    if (r) note.banner(gearIcon(gearById(a.slice(5))!), 'EQUIPPED', gearById(a.slice(5))!.name + (r.sold ? ` · bag full, old one sold $${r.sold.toLocaleString()}` : ''), 'rare');
  } else if (a.startsWith('gsel:')) {
    const [, where, key] = a.split(':') as [string, 'bag' | 'eq', string];
    ui.gsel = { where, key };
    ui.open = 'gearitem';
  } else if (a.startsWith('gequip:')) { if (game.equipGear(Number(a.slice(7)))) ui.open = ui.gearFrom; }
  else if (a.startsWith('gunequip:')) { if (game.unequipGear(a.slice(9) as GearSlot)) ui.open = ui.gearFrom; }
  else if (a.startsWith('gsell:')) { const n = game.sellGear(Number(a.slice(6))); if (n) { note.float(`+$${n.toLocaleString()}`, innerWidth / 2, innerHeight / 2, 'good'); ui.open = ui.gearFrom; } }
  else if (a === 'gsellall') { const n = game.sellAllGear(); if (n) note.banner(pixelIcon('coin'), 'SOLD ALL', `$${n.toLocaleString()}`, 'plain'); }
  else if (a.startsWith('fight:')) {
    const legend = LEGENDS.find((l) => l.id === a.slice(6));
    if (legend) { ui.open = null; fightView.start(new Fight(legend, Math.random, undefined, game.fightPower())); }
  } else if (a === 'fightDone') { fightView.close(); ui.open = game.voyage ? 'voyage' : 'lighthouse'; }
  else if (a === 'buyFlagship') { if (game.buyFlagship()) note.banner(pixelIcon('boat'), 'THE FLAGSHIP', 'Ready to sail', 'rare'); }
  else if (a.startsWith('sail:')) { if (game.startVoyage(a.slice(5))) ui.open = 'voyage'; }
  else if (a.startsWith('vsail:')) game.voyageSail(Number(a.slice(6)));
  else if (a.startsWith('vchoose:')) game.voyageChoose(Number(a.slice(8)));
  else if (a === 'vlegend') game.voyageToLegend();
  else if (a === 'vfight' && game.voyage?.stage === 'fight') {
    // The real thing: the result goes to the voyage.
    voyageFight = true;
    ui.open = null;
    fightView.start(new Fight(LEGENDS.find((l) => l.id === game.voyage!.legend)!, Math.random, undefined, game.fightPower()));
  } else if (a === 'vhome') {
    const out = game.endVoyage();
    if (out?.result === 'caught') note.banner(pixelIcon('trophy'), 'HOME WITH A LEGEND', `+${out.pearls} Pearls${out.sold ? ` · hold full, sold $${out.sold.toLocaleString()}` : ''}`, 'rare');
    else if (out) note.banner(pixelIcon('boat'), 'HOME', out.haul ? `Haul ${out.haul.toLocaleString()}` : 'Empty-handed', 'plain');
    if (out?.gear) voyageFind(out.gear);
    ui.open = 'lighthouse';
  }
  else if (a.startsWith('exTab:')) ui.exTab = a.slice(6) as 'hold' | 'listed' | 'wanted';
  else if (a.startsWith('lhRegion:')) ui.lhRegion = a.slice(9) as 'coast' | 'ocean' | 'abyss';
  else if (a === 'exDev' && game.dev) { const l = LEGENDS[Math.floor(Math.random() * LEGENDS.length)]!; game.addExotic(l.id); }
  else if (a.startsWith('exList:')) { if (game.listExotic(Number(a.slice(7)))) note.float('LISTED', innerWidth / 2, innerHeight / 2, 'plain'); }
  else if (a.startsWith('exOpen:')) { ui.exSel = Number(a.slice(7)); ui.open = 'listing'; }
  else if (a.startsWith('exUnlist:')) { if (game.unlistExotic(Number(a.slice(9)))) ui.open = 'exotic'; }
  else if (a.startsWith('exSell:')) {
    const [, id, i] = a.split(':');
    const n = game.sellToOffer(Number(id), Number(i));
    if (n) { note.banner(pixelIcon('coin'), 'SOLD', `$${n.toLocaleString()}`, 'rare'); ui.open = 'exotic'; }
  } else if (a.startsWith('exGive:')) {
    const w = game.wanted.find((x) => x.id === Number(a.slice(7)));
    const match = w && [...game.exoticHold, ...game.listings.map((l) => l.exotic)].filter((e) => game.meetsWanted(w, e)).sort((x, y) => x.kg - y.kg)[0];
    if (w && match) { const n = game.fulfillWanted(w.id, match.id); if (n) note.banner(pixelIcon('coin'), `${w.buyer.toUpperCase()} PAID`, `$${n.toLocaleString()}`, 'rare'); }
  }
  else if (a === 'back') ui.open = ui.parentOf(ui.open);
  else if (a.startsWith('coTab:')) ui.open = a.slice(6) as 'harbor' | 'ledger' | 'harborup';
  else if (a === 'boatPrev' || a === 'boatNext') {
    const n = game.boats.length;
    if (n) { ui.boatSel = (ui.boatSel + (a === 'boatNext' ? 1 : n - 1)) % n; ui.trackSel = 'hull'; }
  }
  else if (a === 'sellAll') { const n = game.sellAll(); if (n) note.banner(pixelIcon('coin'), 'SOLD', `$${n.toLocaleString()}`); }
  else if (a.startsWith('sellFish:')) {
    const f = fishById(a.slice(9));
    const n = game.sellSpecies(f.id);
    if (n) note.banner(fishIcon(f, false, 48, 28), `SOLD ${f.name.toUpperCase()}`, `$${n.toLocaleString()}`);
  }
  else if (a.startsWith('buy:')) {
    const kind = a.slice(4) as GearKind;
    const next = game.nextGear(kind);
    if (next && game.buyGear(kind)) note.banner(pixelIcon(GEAR_ICON[kind]), 'BOUGHT', next.name);
  } else if (a.startsWith('skillTip:')) {
    const id = a.slice(9) as SkillId;
    ui.skillTip = ui.skillTip === id ? null : id;
  } else if (a.startsWith('train:')) {
    const id = a.slice(6) as SkillId;
    if (game.train(id)) note.banner(pixelIcon(SKILL_ICON[id]), 'TRAINED', `${SKILLS[id].name} ${game.level(id)}`);
  } else if (a === 'toggleBuzz') {
    ui.buzz = !ui.buzz;
    try { localStorage.setItem(BUZZ_KEY, ui.buzz ? '1' : '0'); } catch { /* blocked: just for this visit */ }
    if (ui.buzz) navigator.vibrate?.(BUZZ);
  } else if (a === 'toggleDev') {
    game.dev = !game.dev;
    note.banner(pixelIcon('coin'), 'DEV MODE', game.dev ? `On, prices x${DEV_MULTIPLIER}` : 'Off', 'plain');
  } else if (a.startsWith('treeTier:')) { const t = Number(a.slice(9)) as Tier | 0; ui.treeTier = t; ui.treeSel = ''; }
  else if (a.startsWith('perk:')) {
    const id = a.slice(5) as HeadStartId, p = HEAD_STARTS.find((x) => x.id === id);
    if (p && game.buyPerk(id)) note.banner(pixelIcon('pearl'), 'HEAD START', p.name, 'rare');
  }
  else if (a.startsWith('treeSel:')) ui.treeSel = a.slice(8);
  else if (a.startsWith('journalTier:')) ui.journalTier = Number(a.slice(12)) as Tier;
  else if (a.startsWith('unlock:')) {
    const id = a.slice(7), f = fishById(id);
    if (game.unlockFish(id)) note.banner(fishIcon(f, false, 48, 28), 'UNLOCKED', f.name, 'rare');
  } else if (a.startsWith('retireTab:')) ui.retireTab = a.slice(10) as 'retire' | 'family';
  else if (a.startsWith('heir:')) ui.heirSel = Number(a.slice(5));
  else if (a === 'heirloom') {
    // Cycle through what you could hand down.
    const items = ui.heirloomItems(game), at = items.findIndex((g) => g.id === ui.heirloom);
    if (items.length) ui.heirloom = items[(Math.max(0, at) + 1) % items.length]!.id;
  } else if (a === 'doRetire') {
    const gain = game.pearlsOnRetire(), heir = game.offerHeirs()[ui.heirSel]!;
    const items = ui.heirloomItems(game), item = items.find((g) => g.id === ui.heirloom) ?? items[0];
    if (gain >= 1 && confirm(`Hand the rod to ${heir.name} with +${gain} Pearls${item ? ` and your ${game.gearDef(item).name}` : ''}? Money, gear, skills, boats and pier start over. Pearls, the Fish Tree, head starts, journal and achievements stay in the family.`)) {
      const next = game.retire(ui.heirSel, item?.id);
      if (next) {
        wiping = true; // nothing may save the old run over the new one
        localStorage.setItem(SAVE_KEY, JSON.stringify(next));
        location.reload();
        return;
      }
    }
  } else if (a === 'reset') {
    if (confirm('Start over? Your money, gear, skills and journal will be wiped.')) {
      wiping = true;
      localStorage.removeItem(SAVE_KEY);
      location.reload();
      return;
    }
  }
  dirty = true;
}

/**
 * Feedback for finished casts, the way pixel games do it: the money floats
 * up from the fisherman, the fish goes in the pickup log (repeats merge),
 * and only firsts and rare variants get a banner. Misses just float a word,
 * and only while you fish by hand.
 */
const lastKeys: string[] = [];
function announce(): void {
  game.lines.forEach((line, slot) => {
    const key = line.type === 'result' ? `result:${line.outcome}:${line.caught?.id ?? ''}` : line.type;
    const fresh = key !== lastKeys[slot] && line.type === 'result';
    lastKeys[slot] = key;
    if (fresh) { dirty = true; announceLine(line, slot); }
  });
  lastKeys.length = game.lines.length;
}

function announceLine(line: Extract<Line, { type: 'result' }>, slot: number): void {
  const f = line.fish;
  const at = scene.fisherScreen();
  const x = at.x + (slot % 2 ? -1 : 1) * Math.min(slot, 2) * 18; // lines side by side don't overlap
  if (line.outcome === 'caught' && f && line.caught) {
    const c = line.caught, v = c.variant;
    const pic = fishIcon(f, false, 48, 28, v);
    note.float(`+$${game.priceOf(c).toLocaleString()}`, x, at.y, v ? 'rare' : 'good');
    if (game.journal[f.id]!.count === 1) note.banner(pic, 'NEW FISH', f.name, 'rare');
    else if (v === 'shiny') note.banner(pic, 'SHINY', f.name, 'rare');
    else if (v) note.quiet(pic, `<b>${VARIANTS[v].name}</b> ${f.name}`, 'rare');
    if (line.perfect) note.float('PERFECT!', x, at.y - 22, 'rare');
    if (line.strong) note.float('HELD!', x, at.y - 40, 'plain');
  } else if (line.outcome === 'snapped' && f) {
    const need = RODS.find((r) => r.tier >= f.tier)!;
    note.float('SNAP!', x, at.y, 'bad');
    note.quiet(fishIcon(f, true, 48, 28), `Snapped: needs ${need.name}`, 'bad');
  } else if (!game.auto && line.outcome === 'escaped') {
    note.float('TOO SLOW', x, at.y, 'plain');
  } else if (!game.auto && line.outcome === 'scared') {
    note.float('TOO EARLY', x, at.y, 'plain');
  }
}

/** The harbor's story beats: letters, the reveal, and boats coming home. */
function announceHarbor(): void {
  for (const text of game.takeLetters()) {
    const reveal = game.letters === LETTERS.length;
    note.banner(pixelIcon('letter'), reveal ? 'THE OLD HARBOR' : 'A LETTER', reveal ? 'is for sale' : 'from H.', reveal ? 'rare' : 'plain');
    note.log(`letter:${text}`, pixelIcon('letter'), 'A letter from H.', 'plain');
    dirty = true;
  }
  if (game.sellerNews) { note.log('seller', pixelIcon('coin'), `Fish Seller sold your bag $${game.sellerNews.toLocaleString()}`, 'plain'); game.sellerNews = 0; }
  for (const n of game.fleetNews.splice(0)) {
    const name = game.boatName(n.boat), b = game.boats[n.boat]!;
    if (n.event === 'storm') note.banner(pixelIcon('storm'), `${name.toUpperCase()}: STORM`, 'Lost half the catch', 'bad');
    else if (n.event === 'school') note.banner(pixelIcon('boat'), `${name.toUpperCase()}: LUCKY SCHOOL`, 'Double haul!', 'rare');
    else if (n.event === 'sighting') note.banner(pixelIcon('star'), `${name.toUpperCase()}: TROPHY`, 'A giant on the line!', 'rare');
    if (n.paid) note.log(`sold:${n.boat}`, pixelIcon('boat'), `${name} sold $${n.paid.toLocaleString()}`, 'plain');
    else if (!n.event) note.banner(pixelIcon('boat'), `${name.toUpperCase()} IS BACK`, `$${game.haulValue(b).toLocaleString()}`, 'rare');
  }
  game.hands.forEach((h, i) => {
    const starved = game.handStarved(h);
    if (starved && !handStarved[i]) note.banner(pixelIcon('bait'), `${HAND_NAMES[i]!.toUpperCase()} NEEDS BAIT`, 'Restock your pouch', 'plain');
    handStarved[i] = starved;
  });
}
const handStarved: boolean[] = [];

/** Hired fishermen: with up to 24 of them, only Legendaries and rare variants float up. */
const handKeys: string[] = [];
function announceHands(): void {
  game.hands.forEach((h, i) => {
    const l = h.line;
    const key = l.type === 'result' ? `${l.outcome}:${l.caught?.id ?? ''}` : l.type;
    if (key === handKeys[i]) return;
    handKeys[i] = key;
    if (l.type !== 'result' || !l.fish) return;
    const at = scene.handScreen(i);
    if (l.outcome === 'caught' && l.caught && (l.fish.tier >= 5 || l.caught.variant)) {
      note.float(`+$${game.priceOf(l.caught).toLocaleString()}`, at.x, at.y, l.caught.variant ? 'rare' : 'good');
      dirty = true;
    }
  });
}

/** Banner for newly completed achievements (ones already done at load stay quiet). */
const done = new Set(ACHIEVEMENTS.filter((a) => game.achieved(a)).map((a) => a.id));
let achCheck = 0;
function announceAchievements(): void {
  if (++achCheck % 15) return; // a few times a second is plenty
  announceHarbor();
  for (const a of ACHIEVEMENTS) {
    if (done.has(a.id) || !game.achieved(a)) continue;
    done.add(a.id);
    dirty = true;
    note.banner(pixelIcon(ACH_ICON[a.stat]), 'ACHIEVEMENT', a.name, 'rare');
  }
}

/** Walking past a worm hole on the path digs it up. */
function digWorms(): void {
  const x = scene.pathX;
  if (x === null) return;
  for (const w of [...game.groundWorms]) {
    if (Math.abs(WORM_SPOT_X[w.spot]! - x) > 0.025) continue;
    const n = game.pickWorm(w.id);
    const at = scene.fisherScreen();
    note.float(`+${n} WORMS`, at.x, at.y, 'plain');
    dirty = true;
  }
}

let last = performance.now();
/** Buzz on bite: a short double pulse when one of your lines gets a bite (not when the Autofisher reels for you, or a panel is open). */
const BUZZ_KEY = 'riverside-buzz', BUZZ = [60, 50, 60];
try { ui.buzz = ui.canBuzz && localStorage.getItem(BUZZ_KEY) !== '0'; } catch { ui.buzz = ui.canBuzz; }
let bitesBefore = 0;
function buzzOnBite(): void {
  const bites = game.lines.filter((l) => l.type === 'bite').length;
  if (bites > bitesBefore && ui.buzz && !game.auto && !ui.open && scene.place === 'dock') navigator.vibrate?.(BUZZ);
  bitesBefore = bites;
}

/** Keep banners just below the top bar (and its rates board); with a panel open, over the top bar so the panel's header stays clear. */
let bannerTop = -1;
function placeBanner(): void {
  const top = document.getElementById('top');
  const box = top?.getBoundingClientRect();
  const y = !box ? 70 : ui.open ? Math.round(box.top + 2) : Math.round(box.bottom + 8);
  if (y !== bannerTop) { bannerTop = y; document.documentElement.style.setProperty('--banner-top', `${y}px`); }
}

/** A voyage brought home a voyage-only set piece. */
function voyageFind(item: GearItem): void {
  const def = game.gearDef(item);
  note.banner(gearIcon(def), 'VOYAGE FIND', `${def.name}${game.gearBag.includes(item) ? '' : ' (bag full, sold)'}`, 'rare');
}

/** Tackle news: a frenzy starts (Chum Bucket), the Landing Net brings in a second fish. */
function tackleNews(): void {
  if (game.frenzyNews) { game.frenzyNews = false; note.banner(pixelIcon('bait'), 'FRENZY!', 'Bites come fast', 'rare'); }
  // The First Mate's work: a line each in the pickup log.
  for (const m of game.mateNews.splice(0)) note.log(`mate-${m.kind}-${m.text}`, pixelIcon(({ sail: 'boat', sell: 'coin', sign: 'crew', upgrade: 'anchor' } as const)[m.kind]), `<b>First Mate</b> ${m.text}`, m.kind === 'sell' ? 'good' : 'plain');
  for (const r of game.crewNews.splice(0)) {
    const l = LEGENDS.find((x) => x.id === r.legend)!;
    note.banner(pixelIcon(r.caught ? 'trophy' : 'boat'), r.caught ? `CREW BROUGHT ${l.name.toUpperCase()}` : 'CREW HOME', `Haul ${r.haul.toLocaleString()}${r.caught ? '' : ' · the legend got away'}${r.pearls ? ` · +${r.pearls} Pearl${r.pearls > 1 ? 's' : ''}` : ''}${r.rough ? ' · rough seas' : ''}`, r.caught ? 'rare' : 'plain');
    if (r.gear) voyageFind(r.gear);
  }
  // Gear found fishing: a line in the pickup log (gold for a fine roll; "sold" when the bag was full).
  for (const d of game.dropNews.splice(0)) {
    const def = game.gearDef(d.item);
    note.log(`drop-${def.id}`, gearIcon(def), `<b>${def.name}</b>${d.sold ? ' sold' : ''}`, d.item.fine ? 'rare' : 'good');
  }
  for (; game.doubleNews > 0; game.doubleNews--) { const at = scene.fisherScreen(); note.float('DOUBLE!', at.x, at.y - 30, 'rare'); }
}

function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  fightView.update(dt);
  const dir = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
  if (!ui.open) scene.nudge(dir, dt);
  game.tick(dt);
  if (scene.place === 'dock') game.autoFish();
  digWorms();
  announceHands();
  announce();
  tackleNews();
  placeBanner();
  buzzOnBite();
  announceAchievements();
  scene.update(dt);
  sampleRates(now);
  ui.update(dt, game, scene.place, scene.walking);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if (awayEarned > 0) note.banner(pixelIcon('anchor'), 'WHILE YOU WERE AWAY', `The company made $${awayEarned.toLocaleString()}`, 'rare');

// Debug handles for poking at state from the console.
Object.assign(window, { game, scene, fishById });
