/**
 * Headless playtest: a bot plays Riverside Fishing from a fresh save on the
 * real game logic (no DOM, no Pixi) and reports how the run goes: when each
 * milestone lands, how income grows and where it comes from, how many taps
 * each stage takes, and where it stalls.
 *
 * The bot is a "decent player": reels after a human reaction time, goes on an
 * errand (sell, shop, manage) every `errand` seconds, buys by simple rules
 * (spend up to a share of your money on the next thing), sails voyages and
 * fights legends with a hold/release rule, retires when the Pearls are worth it.
 * Walking is modelled as time away from the dock, not paths.
 *
 * Run: npm run playtest -- --hours 6 --seed 1 [--errand 60] [--runs 3] [--json out.json]
 */
import {
  AUTO, BAITS, BERTHS, BITE_WAIT, BOATS, BOAT_ORDER, COMPANY_PRICE, GEAR_ITEMS, GEAR_SLOTS, GEAR_TIERS, HARBOR_UPGRADES, HOLDERS,
  LEGENDS, PIER_STAFF, SKILLS, TREE_FISH, VOYAGE, type GearKind, type HarborUpgradeId, type SkillId,
} from '../src/data';
import { Game } from '../src/game';
import { Fight } from '../src/fight';
import * as V from '../src/voyage';

export interface Options { hours: number; seed: number; errand: number; runs: number; quiet?: boolean }

/** Seeded RNG (mulberry32), so a seed replays the same run. */
const mulberry = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type TapKind = 'fish' | 'sell' | 'shop' | 'fleet' | 'pier' | 'voyage' | 'fight' | 'other';
const DT = 0.1;
/** Seconds away from the dock for an errand, plus per extra stop. */
const WALK = 6, STOP = 3;

const fmtT = (s: number) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}h${String(m).padStart(2, '0')}` : `${m}m`; };
const kmb = (n: number) => { const a = Math.abs(n); return (n < 0 ? '-' : '') + (a >= 1e9 ? `${(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${(a / 1e3).toFixed(1)}k` : String(Math.round(a))); };

export interface Report {
  seed: number;
  milestones: { t: number; run: number; what: string }[];
  snapshots: { t: number; run: number; money: number; earned: number; perMin: number; you: number; hands: number; boats: number; taps: number }[];
  taps: Record<TapKind, number>;
  fights: { legend: string; won: boolean; secs: number }[];
  voyages: { t: number; legend: string; result: string; haul: number }[];
  gaps: { from: number; to: number; what: string }[];
  retires: { t: number; pearls: number; earned: number }[];
}

class Bot {
  g: Game;
  t = 0;
  run = 1;
  runStart = 0;
  rng: () => number;
  away = 0;
  nextErrand: number;
  react = new Map<number, number>();
  taps: Record<TapKind, number> = { fish: 0, sell: 0, shop: 0, fleet: 0, pier: 0, voyage: 0, fight: 0, other: 0 };
  seen = new Set<string>();
  lastBuy = 0;
  rep: Report;
  /** Rolling income: earned at each snapshot. */
  lastEarned = 0;
  made = { you: 0, hands: 0, boats: 0 };

  constructor(readonly o: Options, seed: number) {
    this.rng = mulberry(seed);
    this.g = new Game({}, mulberry(seed * 7919 + 1));
    this.nextErrand = o.errand;
    this.rep = { seed, milestones: [], snapshots: [], taps: this.taps, fights: [], voyages: [], gaps: [], retires: [] };
  }

  tap(k: TapKind, n = 1) { this.taps[k] += n; }

  mark(what: string) {
    if (this.seen.has(`${this.run}:${what}`)) return;
    this.seen.add(`${this.run}:${what}`);
    this.rep.milestones.push({ t: this.t, run: this.run, what });
  }

  /** Spend at most this share of money on one thing. */
  can(price: number, share: number) { return price <= this.g.money * share; }

  bought() {
    if (this.t - this.lastBuy > 600) this.rep.gaps.push({ from: this.lastBuy, to: this.t, what: 'no purchase' });
    this.lastBuy = this.t;
  }

  // ---------- fishing ----------

  fish() {
    const g = this.g;
    if (this.away > 0) { this.away -= DT; return; }
    // Worms on the bank get dug while you wait (one tap each).
    if (g.groundWorms.length && g.baitCount('worm') < 30) this.digWorms();
    if (g.auto > 0) { g.autoFish(); return; }
    // Manual: reel biting lines after a reaction time, recast when out of the water.
    let reel = false;
    g.lines.forEach((l, i) => {
      if (l.type !== 'bite') { this.react.delete(i); return; }
      if (!this.react.has(i)) this.react.set(i, 0.3 + this.rng() * 0.4);
      if (l.t >= this.react.get(i)!) reel = true;
    });
    if (reel) { g.reel(); this.tap('fish'); this.react.clear(); }
    if (g.lines.some((l) => l.type === 'idle' || (l.type === 'result' && l.t > 0.4))) {
      if (g.cast()) this.tap('fish');
    }
  }

  digWorms() {
    for (const w of [...this.g.groundWorms]) { this.g.pickWorm(w.id); this.tap('other'); }
  }

  /** Best bait to fish with by value per second (what you'd buy). */
  bestBait() {
    const g = this.g;
    let best = BAITS[0]!, bestRate = -Infinity;
    for (const b of BAITS) {
      const ev = g.odds(g.skill, b.id).reduce((s, o) => s + (o.tooStrong ? 0 : o.p * o.fish.price), 0) * b.size;
      const rate = (ev - b.price) / (((BITE_WAIT[0] + BITE_WAIT[1]) / 2) * b.wait + 2.5);
      if (rate > bestRate) { bestRate = rate; best = b; }
    }
    return best;
  }

  // ---------- an errand: sell, shop, manage ----------

  errand() {
    const g = this.g;
    let stops = 0;
    const stop = () => { stops++; };
    g.stopFishing();
    if (g.bag.length) { g.sellAll(); this.tap('sell', 2); stop(); }
    if (g.claimable().length) { g.claim(); this.tap('other', 2); }
    let k = 0;
    while (k++ < 60 && this.buyOne(stop)) this.bought();
    this.exotics();
    this.pub();
    this.away = WALK + STOP * stops;
    this.tap('other', 1); // walk back
  }

  /** The next rod tier up from the one you hold, if any. */
  nextRod() {
    const tiers = Object.keys(GEAR_TIERS), cur = tiers.indexOf(this.g.gearOf('rod')!.tier);
    return GEAR_ITEMS.filter((d) => d.slot === 'rod' && d.tier !== 'legendary' && tiers.indexOf(d.tier) > cur).sort((a, b) => a.price - b.price)[0] ?? null;
  }

  /** One purchase by the rules, or false when nothing is worth it now. */
  buyOne(stop: () => void): boolean {
    const g = this.g;
    // Saving for the next rod tier once it's in sight: only small buys meanwhile.
    const rod = this.nextRod(), saving = !!rod && rod.price <= g.money * 3;
    const can0 = this.can.bind(this);
    this.can = (price: number, share: number) => can0(price, saving && !(rod && price === rod.price) ? Math.min(share, 0.05) : share);
    try { return this.buyOneInner(stop); } finally { this.can = can0; }
  }

  buyOneInner(stop: () => void): boolean {
    const g = this.g;
    // Tackle: lines and the Autofisher first, then the rest.
    for (const [kind, share] of [['holders', 0.6], ['auto', 0.6], ['net', 0.3], ['chum', 0.3], ['icebox', 0.3]] as [GearKind, number][]) {
      const next = g.nextGear(kind);
      if (next && this.can(next.price, share) && g.buyGear(kind)) {
        this.tap('shop', 2); stop();
        if (kind === 'holders') this.mark(`${HOLDERS[g.holders]!.lines} lines`);
        if (kind === 'auto') this.mark(AUTO[g.auto]!.name);
        return true;
      }
    }
    // Gear Shop: a better rod (higher tier first), then better pieces.
    for (const slot of GEAR_SLOTS) {
      const cur = g.gearOf(slot);
      const score = (d: typeof GEAR_ITEMS[number]) => (slot === 'rod' ? Object.keys(GEAR_TIERS).indexOf(d.tier) * 1000 : 0) + Object.values(d.stats).reduce((s, v) => s + (v ?? 0), 0);
      const have = cur ? score(cur) : -1;
      const pick = GEAR_ITEMS.filter((d) => d.slot === slot && d.tier !== 'legendary' && score(d) > have && this.can(d.price, slot === 'rod' ? 0.6 : 0.25))
        .sort((a, b) => score(b) - score(a))[0];
      if (pick && g.buyGearPiece(pick.id)) {
        this.tap('shop', 3); stop();
        if (slot === 'rod') this.mark(`rod ${pick.tier}`);
        return true;
      }
    }
    // Skills.
    for (const id of ['fishing', 'reflexes', 'haggling', 'strength'] as SkillId[]) {
      const c = g.nextSkillCost(id);
      if (c !== null && this.can(c, id === 'fishing' ? 0.3 : 0.2) && g.train(id)) {
        this.tap('shop', 1); stop();
        if (id === 'fishing' && g.skill === SKILLS.fishing.max) this.mark('fishing maxed');
        return true;
      }
    }
    // Bait: keep a stock of the best one.
    const b = this.bestBait();
    const n = this.can(b.price * 100, 0.2) ? 100 : 20;
    if (b.price > 0 && g.baitCount(b.id) < 40 && this.can(b.price * n, 0.3) && g.buyBait(b.id, n)) { g.selectBait(b.id); this.tap('shop', 2); stop(); return true; }
    if (g.baitSel !== b.id && g.baitCount(b.id) > 0) g.selectBait(b.id);
    // The Fishing Company.
    if (!g.company) {
      if (g.companyRevealed) this.mark('company for sale');
      if (g.companyRevealed && g.money >= COMPANY_PRICE && g.buyCompany()) { this.tap('fleet', 2); stop(); this.mark('company'); return true; }
      return false;
    }
    if (this.fleet(stop)) return true;
    if (this.pier(stop)) return true;
    // The Flagship.
    if (!g.flagship && this.can(VOYAGE.flagship, 0.7) && g.buyFlagship()) { this.tap('voyage', 2); stop(); this.mark('flagship'); return true; }
    // The Fish Tree (Pearls).
    const fish = TREE_FISH.filter((f) => g.canUnlock(f.id)).sort((a, b) => a.cost - b.cost)[0];
    if (fish && g.unlockFish(fish.id)) { this.tap('other', 2); this.mark(`tree ${g.fishTree.length}`); return true; }
    return false;
  }

  fleet(stop: () => void): boolean {
    const g = this.g;
    // Staff first when affordable: they save the most taps.
    for (const [k, share] of [['master', 0.5], ['shipwright', 0.5]] as [HarborUpgradeId, number][]) {
      if (!g.harbor[k] && this.can(HARBOR_UPGRADES[k].price, share) && g.buyHarbor(k)) { this.tap('fleet', 3); stop(); this.mark(HARBOR_UPGRADES[k].name); return true; }
    }
    // Boats: a fitted copy if it's in reach, else a bare boat.
    if (g.boats.length < g.berthCount) {
      for (const type of BOAT_ORDER) {
        const fitted = g.fittedPrice(type);
        if (fitted !== null && this.can(fitted, 0.5) && g.buyFittedBoat(type)) { this.tap('fleet', 3); stop(); this.mark(`boat ${g.boats.length}`); return true; }
      }
      const type = [...BOAT_ORDER].reverse().find((t) => this.can(g.boatPrice(t), 0.4));
      if (type && g.buyBoat(type)) { this.tap('fleet', 3); stop(); this.mark(`boat ${g.boats.length}`); if (type !== 'net') this.mark(BOATS[type].name); return true; }
    } else if (g.nextBerth() && this.can(g.nextBerth()!.price, 0.3) && g.buyBerth()) { this.tap('fleet', 2); stop(); if (g.berthCount === BERTHS[BERTHS.length - 1]!.boats) this.mark('berths maxed'); return true; }
    // Without a Shipwright: Best buy on each boat (one tap each, plus opening it).
    if (!g.harbor.shipwright) {
      for (let i = 0; i < g.boats.length; i++) {
        const best = g.bestBuy(i);
        if (best && this.can(best.cost, 0.25) && best.buy()) { this.tap('fleet', 2); stop(); return true; }
      }
    }
    // Send idle boats (captains do it by themselves) and sell hauls (the Harbor Master does).
    g.boats.forEach((b, i) => {
      if (b.haul) { g.collectHaul(i); this.tap('fleet'); }
      if (!b.trip && !b.haul && g.sendBoat(i)) this.tap('fleet');
    });
    if (g.boats.length && g.boats.every((b) => Object.values(b.tracks).every((l) => l === 5))) this.mark('fleet maxed');
    return false;
  }

  pier(stop: () => void): boolean {
    const g = this.g;
    if (!g.pierOpen) return false;
    for (const k of PIER_STAFF) {
      if (!g.harbor[k] && this.can(HARBOR_UPGRADES[k].price, 0.5) && g.buyHarbor(k)) { this.tap('pier', 3); stop(); this.mark(HARBOR_UPGRADES[k].name); return true; }
    }
    const hire = g.nextHandCost();
    if (hire !== null && this.can(hire, 0.3) && g.hireHand()) { this.tap('pier', 2); stop(); if ([1, 4, 8, 16].includes(g.hands.length)) this.mark(`fishermen ${g.hands.length}`); return true; }
    const section = g.nextPierSection();
    if (hire === null && section !== null && this.can(section, 0.3) && g.buyPierSection()) { this.tap('pier', 3); stop(); return true; }
    if (!g.harbor.manager) {
      // By hand: Train all (x1 is one tap per level per fisherman; MAX is one tap) and rods.
      for (let i = 0; i < g.hands.length; i++) {
        const rod = g.handNextRod(i);
        if (rod && this.can(rod.price, 0.2) && g.upgradeHandRod(i)) { this.tap('pier', 2); stop(); return true; }
      }
      const levels = g.trainAll(Infinity);
      if (levels) { this.tap('pier', 2); stop(); return true; }
    }
    return false;
  }

  // ---------- the Exotic Market, the Pub ----------

  exotics() {
    const g = this.g;
    for (const w of [...g.wanted]) {
      const e = [...g.exoticHold, ...g.listings.map((l) => l.exotic)].find((x) => g.meetsWanted(w, x));
      if (e && g.fulfillWanted(w.id, e.id)) { this.tap('voyage', 3); this.mark('wanted filled'); }
    }
    for (const e of [...g.exoticHold]) if (g.listExotic(e.id)) this.tap('voyage', 2);
    for (const l of [...g.listings]) {
      const best = l.offers.map((o, k) => ({ o, k })).sort((a, b) => b.o.amount - a.o.amount)[0];
      if (best && (best.o.amount >= l.exotic.value * 0.9 || l.age > 600)) { g.sellToOffer(l.exotic.id, best.k); this.tap('voyage', 2); this.mark('exotic sold'); }
    }
  }

  pub() {
    const g = this.g;
    if (!g.flagship) return;
    for (const s of [...g.pubBoard]) {
      const seat = g.crew[s.role];
      if ((!seat || seat.stars < s.stars) && this.can(g.signFee(s), 0.2) && g.signSailor(s.id)) { this.tap('voyage', 2); this.mark(`crew ${Object.keys(g.crew).length}`); }
    }
  }

  // ---------- voyages and fights ----------

  /** The legend to go for: the hardest open one not landed yet, else the richest open one. */
  pickLegend() {
    const g = this.g;
    const open = LEGENDS.filter((l) => g.legendOpen(l));
    const order = ['coast', 'ocean', 'abyss'];
    return open.filter((l) => !g.landed[l.id]).sort((a, b) => order.indexOf(b.region) - order.indexOf(a.region))[0]
      ?? open.sort((a, b) => b.price - a.price)[0];
  }

  voyage() {
    const g = this.g;
    if (!g.flagship) return;
    if (!g.voyage && g.canSail()) {
      const l = this.pickLegend();
      if (l && g.startVoyage(l.id)) { this.tap('voyage', 3); this.mark('first voyage'); }
    }
    const v = g.voyage;
    if (!v) {
      // The Flagship is resting: send the crew if there's a Captain.
      if (g.canSendCrew()) { const l = this.pickLegend(); if (l && g.sendCrew(l.id)) { this.tap('voyage', 2); this.mark('crew voyage'); } }
      return;
    }
    for (let guard = 0; guard < 40 && g.voyage && g.voyage.stage !== 'over'; guard++) {
      const movesLeft = v.rows.length - 1 - v.row + 1;
      if (v.stage === 'map') {
        if (v.row === v.rows.length - 1) { g.voyageToLegend(); this.tap('voyage'); continue; }
        const next = v.rows[v.row + 1]!.map((s, i) => ({ s, i })).filter(({ i }) => V.canReach(v, i));
        const want = (k: string) => next.find(({ s }) => s.kind === k);
        const pick = (v.hull < 2 || v.supplies <= movesLeft) ? want('trader') ?? want('fish') ?? next[0] : want('fish') ?? want('wreck') ?? want('trader') ?? next[0];
        if (!pick || !g.voyageSail(pick.i)) break;
        this.tap('voyage');
      } else if (v.stage === 'spot') {
        const s = v.rows[v.row]![v.at]!, list = V.choices(v);
        let k = list.length - 1; // sail on
        if (!v.used) {
          if (s.kind === 'fish') k = 0;
          else if (s.kind === 'wreck') k = v.hull >= 2 ? 0 : 1;
          else if (s.kind === 'trader') k = v.supplies <= movesLeft ? 0 : v.hull < VOYAGE.hull ? 1 : 2;
          else if (s.kind === 'event') k = v.supplies > movesLeft ? 0 : list.length - 1;
        } else if (s.kind === 'fish' && v.supplies > movesLeft + 1) k = 0;
        g.voyageChoose(k);
        this.tap('voyage');
      } else if (v.stage === 'fight') {
        const l = V.legendOf(v), won = this.fight(l);
        g.voyageFought(won);
      }
    }
    if (g.voyage?.stage === 'over') {
      const out = g.endVoyage();
      this.tap('voyage');
      if (out) {
        this.rep.voyages.push({ t: this.t, legend: v.legend, result: out.result ?? '?', haul: out.haul });
        if (out.result === 'caught') this.mark(`legend ${V.legendOf(v).region}`);
      }
    }
  }

  /** The fight, played by a rule: hold in the low/slack zone, let go when high or when it runs (after a reaction delay). */
  fight(l: typeof LEGENDS[number]): boolean {
    const f = new Fight(l, this.rng);
    let holding = false, decideIn = 0, secs = 0;
    while (!f.end && secs < 300) {
      if ((decideIn -= 1 / 60) <= 0) {
        decideIn = 0.15 + this.rng() * 0.1;
        const z = f.lit ? f.zone : 'green';
        const want = f.snagged ? true : f.surging || f.warn > 0 ? false : z === 'slack' || z === 'low' || (z === 'green' && f.tension < (f.band[0] + f.band[1]) / 2);
        if (want !== holding) { holding = want; this.tap('fight'); }
      }
      f.update(1 / 60, holding);
      secs += 1 / 60;
    }
    const won = f.end === 'caught';
    this.rep.fights.push({ legend: l.id, won, secs: Math.round(secs) });
    return won;
  }

  // ---------- retiring ----------

  maybeRetire() {
    const g = this.g, gain = g.pearlsOnRetire(), runFor = this.t - this.runStart;
    // Worth it once the run pays at least 5 Pearls and half again what you have.
    if (runFor < 1800 || g.voyage || gain < Math.max(5, g.pearls * 1.5)) return;
    // Not before trying a voyage, unless the run has gone on a long time.
    if (!this.rep.voyages.some((v) => v.t >= this.runStart) && runFor < 8 * 3600) return;
    const save = g.retire();
    if (!save) return;
    this.rep.retires.push({ t: this.t, pearls: gain, earned: g.earned });
    this.mark(`retire (+${gain} Pearls)`);
    this.tap('other', 3);
    this.g = new Game(save, mulberry(this.rep.seed * 31 + this.run));
    this.run++;
    this.runStart = this.t;
    this.lastEarned = 0;
  }

  snapshot() {
    const g = this.g, earnedNow = g.earned;
    const perMin = (earnedNow - this.lastEarned) / 10;
    this.lastEarned = earnedNow;
    const m = g.made, tot = m.you + m.hands + m.boats || 1;
    this.rep.snapshots.push({ t: this.t, run: this.run, money: g.money, earned: earnedNow, perMin, you: m.you / tot, hands: m.hands / tot, boats: m.boats / tot, taps: Object.values(this.taps).reduce((s, n) => s + n, 0) });
  }

  play() {
    const end = this.o.hours * 3600;
    let nextSnap = 600;
    while (this.t < end) {
      this.g.tick(DT);
      this.fish();
      this.t += DT;
      if (this.t >= this.nextErrand && this.away <= 0) {
        this.nextErrand = this.t + this.o.errand;
        this.errand();
        this.voyage();
        this.maybeRetire();
      }
      if (this.t >= nextSnap) { nextSnap += 600; this.snapshot(); }
    }
    if (this.t - this.lastBuy > 600) this.rep.gaps.push({ from: this.lastBuy, to: this.t, what: 'no purchase (to the end)' });
    return this.rep;
  }
}

export function print(r: Report): string {
  const out: string[] = [];
  out.push(`=== Playtest, seed ${r.seed} ===`, '', 'MILESTONES');
  for (const m of r.milestones) out.push(`  ${fmtT(m.t).padStart(6)}  ${r.retires.length ? `run ${m.run}  ` : ''}${m.what}`);
  out.push('', 'INCOME (every 10 min)', '    time   $/min    money   earned  split you/hands/boats   taps');
  for (const s of r.snapshots) {
    out.push(`  ${fmtT(s.t).padStart(6)} ${kmb(s.perMin).padStart(7)} ${kmb(s.money).padStart(8)} ${kmb(s.earned).padStart(8)}   ${[s.you, s.hands, s.boats].map((x) => `${Math.round(x * 100)}%`.padStart(4)).join(' ')}          ${String(s.taps).padStart(6)}`);
  }
  const total = Object.values(r.taps).reduce((s, n) => s + n, 0);
  out.push('', `TAPS: ${total} total  ` + Object.entries(r.taps).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(' · '));
  if (r.voyages.length) {
    const won = r.fights.filter((f) => f.won).length;
    out.push('', `VOYAGES: ${r.voyages.length} (${r.voyages.filter((v) => v.result === 'caught').length} legends, ${r.voyages.filter((v) => v.result === 'failed').length} failed) · fights won ${won}/${r.fights.length}`);
  }
  if (r.gaps.length) {
    out.push('', 'STALLS (10+ min with nothing worth buying)');
    for (const g of r.gaps) out.push(`  ${fmtT(g.from)} to ${fmtT(g.to)} (${fmtT(g.to - g.from)}) ${g.what}`);
  }
  return out.join('\n');
}

export function run(o: Options): Report[] {
  const reports: Report[] = [];
  for (let k = 0; k < o.runs; k++) {
    const r = new Bot(o, o.seed + k).play();
    reports.push(r);
    if (!o.quiet) console.log(print(r) + '\n');
  }
  if (o.runs > 1) {
    // Across seeds: when each milestone lands (median).
    const by = new Map<string, number[]>();
    for (const r of reports) for (const m of r.milestones) if (m.run === 1) by.set(m.what, [...(by.get(m.what) ?? []), m.t]);
    console.log(`=== ${o.runs} seeds: milestone times (median, min-max, how many seeds reached it) ===`);
    for (const [what, ts] of [...by].sort((a, b) => a[1].sort((x, y) => x - y)[Math.floor(a[1].length / 2)]! - b[1].sort((x, y) => x - y)[Math.floor(b[1].length / 2)]!)) {
      ts.sort((a, b) => a - b);
      console.log(`  ${fmtT(ts[Math.floor(ts.length / 2)]!).padStart(6)}  (${fmtT(ts[0]!)}-${fmtT(ts[ts.length - 1]!)}, ${ts.length}/${o.runs})  ${what}`);
    }
  }
  return reports;
}

