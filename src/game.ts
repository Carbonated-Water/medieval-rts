import {
  ACHIEVEMENTS, AUTO, BAITS, BOAT_PRICE, COMPANY_PRICE, COMPANY_UNLOCK_EARNED, CREW_COST, CREW_HAUL, CREW_MAX, CREW_SPEED,
  LETTERS, NETS, SEA_FISH, TRIP_SECONDS, BITE_WAIT, BOOTS, CLOTHES, DEV_MULTIPLIER, FISH, GEAR, HAGGLE_PER_LEVEL, HOLDERS, MAX_GROUND_WORMS,
  MIN_BITE_WAIT, REEL_WINDOW, REFLEX_PER_LEVEL, RODS, SKILLS, SKILL_TIER_BONUS, START_MONEY, START_WORMS, STRENGTH_PER_LEVEL, TIERS,
  TOO_STRONG_WEIGHT, VARIANTS, VARIANT_ORDER, WORMS_PER_PICK, WORM_SPAWN_SECONDS, WORM_SPOTS, baitById,
  type AchStat, type AchievementDef, type BaitId, type FishDef, type GearKind, type SkillId, type Tier, type Variant,
} from './data';

export interface Catch {
  id: number;
  fish: string; // FishDef id
  kg: number;
  /** Base price (weight, clothes and variant included); Haggling and dev mode apply at sale. */
  value: number;
  variant?: Variant;
}

/** One company boat: its net, crew, the trip it's on, and the haul waiting at the pier. */
export interface Boat {
  net: number;
  crew: number;
  trip: { t: number; dur: number } | null;
  haul: { fish: string; n: number; value: number }[] | null;
}

export interface JournalEntry { count: number; bestKg: number; variants?: Partial<Record<Variant, number>> }

/** Everything that gets saved. Fields added later default sensibly for old saves. */
export interface SaveData {
  money: number;
  rod: number;
  holders: number;
  auto: number;
  /** Bait in the pouch, by kind. */
  baits: Partial<Record<BaitId, number>>;
  /** Bait the next cast uses. */
  baitSel: BaitId;
  /** Old saves: the bait gear level from before bait was used up (converted to stock on load). */
  bait?: number;
  clothes: number;
  boots: number;
  /** Fishing skill level (named `skill` since the first save format). */
  skill: number;
  reflexes: number;
  haggling: number;
  strength: number;
  dev: boolean;
  bag: Catch[];
  journal: Record<string, JournalEntry>;
  nextId: number;
  earned: number;
  /** Achievement ids whose reward has been collected. */
  claimed: string[];
  /** The Fishing Company: bought or not, letters already delivered, its boats. */
  company: boolean;
  letters: number;
  boats: Boat[];
}

const CAST_SECONDS = 0.6;
const RESULT_SECONDS = 2.2;

/**
 * One fishing line's state. Cast → wait for a bite → the bobber dips and
 * you have a short window to reel. Reeling early scares the fish, late lets
 * it go; a fish too strong for your rod snaps the line unless Strength
 * lands it anyway. With rod holders you fish several lines at once.
 */
export type Line =
  | { type: 'idle' }
  | { type: 'casting'; t: number; bait: BaitId }
  | { type: 'waiting'; t: number; biteAt: number; bait: BaitId }
  | { type: 'bite'; t: number; window: number; fish: FishDef; tooStrong: boolean }
  | { type: 'result'; t: number; outcome: 'caught' | 'escaped' | 'snapped' | 'scared'; fish?: FishDef; caught?: Catch; strong?: boolean };

export const fishById = (id: string): FishDef => FISH.find((f) => f.id === id)!;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

export class Game {
  money = START_MONEY;
  rod = 0;
  holders = 0;
  auto = 0;
  baits: Partial<Record<BaitId, number>> = { worm: START_WORMS };
  baitSel: BaitId = 'worm';
  /** Worms showing on the bank: which hole (0..WORM_SPOTS-1), with an id so the scene can track them. */
  groundWorms: { id: number; spot: number }[] = [];
  private wormClock = 0;
  private nextWormId = 1;
  clothes = 0;
  boots = 0;
  skill = SKILLS.fishing.start;
  reflexes = SKILLS.reflexes.start;
  haggling = SKILLS.haggling.start;
  strength = SKILLS.strength.start;
  /** Dev mode: fish sell for DEV_MULTIPLIER× their price. */
  dev = false;
  bag: Catch[] = [];
  journal: Record<string, JournalEntry> = {};
  /** Lifetime earnings. */
  earned = 0;
  /** One entry per line in the water (length = lineCount). */
  lines: Line[] = [{ type: 'idle' }];
  claimed: string[] = [];
  company = false;
  letters = 0;
  boats: Boat[] = [];
  private nextId = 1;
  /** Autofisher reaction time picked for each line's current bite. */
  private autoReact: (number | undefined)[] = [];

  constructor(save?: Partial<SaveData>, private rng: () => number = Math.random) {
    if (save) {
      const { bait: oldBait, ...rest } = save;
      Object.assign(this, { ...rest, nextId: save.nextId ?? 1, baits: { ...(save.baits ?? { worm: START_WORMS }) } });
      // Bought bait upgrades from before bait was used up become a stock of the matching bait.
      if (!save.baits && oldBait) this.baits[BAITS[Math.min(oldBait, BAITS.length - 1)]!.id] = 25;
    }
    if (!BAITS.some((b) => b.id === this.baitSel)) this.baitSel = 'worm';
    // Saves already past the reveal skip the earlier letters and get just the last one.
    if (!this.company && this.earned >= COMPANY_UNLOCK_EARNED) this.letters = Math.max(this.letters, LETTERS.length - 1);
    this.rod = clamp(this.rod, 0, RODS.length - 1);
    this.holders = clamp(this.holders, 0, HOLDERS.length - 1);
    this.syncLines();
    this.auto = clamp(this.auto, 0, AUTO.length - 1);
    this.clothes = clamp(this.clothes, 0, CLOTHES.length - 1);
    this.boots = clamp(this.boots, 0, BOOTS.length - 1);
    for (const id of Object.keys(SKILLS) as SkillId[]) this.setLevel(id, clamp(this.level(id), SKILLS[id].start, SKILLS[id].max));
  }

  get rodTier(): Tier {
    return RODS[this.rod]!.tier;
  }

  // ---------- upgrade levels ----------

  gearLevel(kind: GearKind): number {
    return this[kind];
  }

  level(id: SkillId): number {
    return id === 'fishing' ? this.skill : this[id];
  }

  private setLevel(id: SkillId, v: number): void {
    if (id === 'fishing') this.skill = v; else this[id] = v;
  }

  // ---------- odds & effects ----------

  /** Fish that can bite: everything your rod lands, plus one tier above it. */
  private biters(): FishDef[] {
    return FISH.filter((f) => f.tier <= this.rodTier + 1);
  }

  /**
   * How likely each fish is per bite, with a given fishing level and bait
   * (default: yours). `tooStrong` fish snap the line unless Strength holds.
   */
  odds(skill = this.skill, bait: BaitId = this.activeBait ?? 'worm'): { fish: FishDef; p: number; tooStrong: boolean }[] {
    const weights = this.biters().map((f) => ({ fish: f, w: this.weight(f, skill, bait) }));
    const total = weights.reduce((s, x) => s + x.w, 0);
    return weights.map(({ fish, w }) => ({ fish, p: w / total, tooStrong: fish.tier > this.rodTier }));
  }

  /** Share of bites per tier you can land (too-strong tiers left out), for the UI. */
  tierOdds(skill = this.skill, bait?: BaitId): Record<number, number> {
    const out: Record<number, number> = {};
    for (const { fish, p, tooStrong } of this.odds(skill, bait)) if (!tooStrong) out[fish.tier] = (out[fish.tier] ?? 0) + p;
    return out;
  }

  /** Bite weight: tier base × rarity × step^(tier-1); fishing level and bait both add to the step. */
  private weight(f: FishDef, skill: number, bait: BaitId): number {
    const step = 1 + SKILL_TIER_BONUS * (skill - 1) + baitById(bait).lure;
    // Too-strong fish bite at a steady share of your rod's top tier: levels and bait don't make snaps more common.
    if (f.tier > this.rodTier) return TIERS[f.tier].weight * f.rarity * Math.pow(step, this.rodTier - 1) * TOO_STRONG_WEIGHT;
    return TIERS[f.tier].weight * f.rarity * Math.pow(step, f.tier - 1);
  }

  /** Which fish bites (bait as cast). */
  rollFish(bait: BaitId = 'worm'): { fish: FishDef; tooStrong: boolean } {
    const list = this.biters();
    const fish = this.pick(list, (f) => this.weight(f, this.skill, bait));
    return { fish, tooStrong: fish.tier > this.rodTier };
  }

  private pick(list: FishDef[], w: (f: FishDef) => number): FishDef {
    const total = list.reduce((s, f) => s + w(f), 0);
    let r = this.rng() * total;
    for (const f of list) { r -= w(f); if (r <= 0) return f; }
    return list[list.length - 1]!;
  }

  /** Bites come sooner with better bait and rods. */
  biteWait(bait: BaitId = 'worm'): number {
    const [lo, hi] = BITE_WAIT;
    const wait = (lo + this.rng() * (hi - lo)) * baitById(bait).wait * (1 - 0.06 * this.rod);
    return Math.max(MIN_BITE_WAIT, wait);
  }

  // ---------- bait ----------

  baitCount(id: BaitId): number {
    return this.baits[id] ?? 0;
  }

  /** The bait the next cast will use: the selected one, or the next cheaper one you have. Null = none left. */
  get activeBait(): BaitId | null {
    const sel = BAITS.findIndex((b) => b.id === this.baitSel);
    for (let i = sel; i >= 0; i--) if (this.baitCount(BAITS[i]!.id) > 0) return BAITS[i]!.id;
    for (const b of BAITS) if (this.baitCount(b.id) > 0) return b.id;
    return null;
  }

  selectBait(id: BaitId): void {
    this.baitSel = id;
  }

  buyBait(id: BaitId, n: number): boolean {
    const cost = baitById(id).price * n;
    if (id === 'worm' || n <= 0 || this.money < cost) return false;
    this.money -= cost;
    this.baits[id] = this.baitCount(id) + n;
    return true;
  }

  /** Take one bait for a cast. */
  private takeBait(): BaitId | null {
    const id = this.activeBait;
    if (id) this.baits[id] = this.baitCount(id) - 1;
    return id;
  }

  /** Dig up the worms in one hole on the bank. Returns how many you got. */
  pickWorm(wormId: number): number {
    const i = this.groundWorms.findIndex((w) => w.id === wormId);
    if (i < 0) return 0;
    this.groundWorms.splice(i, 1);
    const [lo, hi] = WORMS_PER_PICK;
    const n = lo + Math.floor(this.rng() * (hi - lo + 1));
    this.baits.worm = this.baitCount('worm') + n;
    return n;
  }

  private spawnWorms(dt: number): void {
    if (this.groundWorms.length >= MAX_GROUND_WORMS) { this.wormClock = 0; return; }
    this.wormClock += dt;
    if (this.wormClock < WORM_SPAWN_SECONDS) return;
    this.wormClock = 0;
    const free = Array.from({ length: WORM_SPOTS }, (_, i) => i).filter((s) => !this.groundWorms.some((w) => w.spot === s));
    const spot = free[Math.floor(this.rng() * free.length)];
    if (spot !== undefined) this.groundWorms.push({ id: this.nextWormId++, spot });
  }

  reelWindow(): number {
    return REEL_WINDOW + REFLEX_PER_LEVEL * this.reflexes;
  }

  /** Chance to land a fish one tier above the rod instead of snapping. */
  strengthChance(): number {
    return STRENGTH_PER_LEVEL * this.strength;
  }

  /** Walking speed multiplier from boots. */
  walkSpeed(): number {
    return 1 + BOOTS[this.boots]!.speed;
  }

  /** What a catch sells for right now (Haggling, dev mode). */
  priceOf(c: Catch): number {
    return Math.round(c.value * (1 + HAGGLE_PER_LEVEL * this.haggling) * (this.dev ? DEV_MULTIPLIER : 1));
  }

  // ---------- fishing ----------

  /** Lines you can have in the water (rod holders). */
  get lineCount(): number {
    return HOLDERS[this.holders]!.lines;
  }

  /** Keep `lines` the right length after buying holders or loading a save. */
  private syncLines(): void {
    while (this.lines.length < this.lineCount) this.lines.push({ type: 'idle' });
    this.lines.length = this.lineCount;
  }

  /** Throw every line that's out of the water (idle or showing a result), one bait each. Staggered a little. */
  cast(): boolean {
    return this.castWhere((line) => line.type === 'idle' || line.type === 'result');
  }

  private castWhere(ready: (line: Line) => boolean): boolean {
    let n = 0;
    this.lines.forEach((line, i) => {
      if (!ready(line)) return;
      const bait = this.takeBait();
      if (!bait) return; // out of bait: this line stays out of the water
      this.lines[i] = { type: 'casting', t: -0.18 * n++, bait };
    });
    return n > 0;
  }

  /**
   * Pull in. With a `slot`, just that line (tapping its bobber). Without one
   * (the big button), every line that's biting — or, if none is, the line
   * that was about to bite gets scared off (only that one).
   */
  reel(slot?: number): void {
    if (slot !== undefined) return this.reelLine(slot);
    const biting = this.lines.map((l, i) => (l.type === 'bite' ? i : -1)).filter((i) => i >= 0);
    if (biting.length) { for (const i of biting) this.reelLine(i); return; }
    let soonest = -1, left = Infinity;
    this.lines.forEach((l, i) => {
      const remaining = l.type === 'waiting' ? l.biteAt - l.t : l.type === 'casting' ? 99 - l.t : Infinity;
      if (remaining < left) { left = remaining; soonest = i; }
    });
    if (soonest >= 0) this.reelLine(soonest);
  }

  private reelLine(i: number): void {
    const line = this.lines[i];
    if (!line) return;
    if (line.type === 'waiting' || line.type === 'casting') {
      this.lines[i] = { type: 'result', t: 0, outcome: 'scared' };
    } else if (line.type === 'bite') {
      const strong = line.tooStrong && this.rng() < this.strengthChance();
      if (line.tooStrong && !strong) this.lines[i] = { type: 'result', t: 0, outcome: 'snapped', fish: line.fish };
      else this.lines[i] = { type: 'result', t: 0, outcome: 'caught', fish: line.fish, caught: this.land(line.fish), strong };
    }
  }

  /** Put all lines away (walking off, opening the market). */
  stopFishing(): void {
    this.lines = this.lines.map(() => ({ type: 'idle' }));
  }

  /** True while any line is in the water. */
  get fishing(): boolean {
    return this.lines.some((l) => l.type !== 'idle');
  }

  tick(dt: number): void {
    this.spawnWorms(dt);
    this.tickBoats(dt);
    this.lines.forEach((line, i) => {
      if (line.type === 'idle') return;
      line.t += dt;
      if (line.type === 'casting' && line.t >= CAST_SECONDS) {
        this.lines[i] = { type: 'waiting', t: 0, biteAt: this.biteWait(line.bait), bait: line.bait };
      } else if (line.type === 'waiting' && line.t >= line.biteAt) {
        const { fish, tooStrong } = this.rollFish(line.bait);
        this.lines[i] = { type: 'bite', t: 0, window: this.reelWindow(), fish, tooStrong };
      } else if (line.type === 'bite' && line.t >= line.window) {
        this.lines[i] = { type: 'result', t: 0, outcome: 'escaped', fish: line.fish };
      } else if (line.type === 'result' && line.t >= RESULT_SECONDS) {
        this.lines[i] = { type: 'idle' };
      }
    });
  }

  /**
   * The autofisher's turn (call each frame while the player is on the dock):
   * recast empty lines and reel bites after a human-ish reaction time.
   */
  autoFish(): void {
    if (this.auto === 0) return;
    const a = AUTO[this.auto]!;
    this.lines.forEach((line, i) => {
      if (line.type !== 'bite') { this.autoReact[i] = undefined; return; }
      const react = (this.autoReact[i] ??= a.react[0] + this.rng() * (a.react[1] - a.react[0]));
      if (line.t >= react) { this.autoReact[i] = undefined; this.reelLine(i); }
    });
    this.castWhere((line) => line.type === 'idle' || (line.type === 'result' && line.t >= a.recast));
  }

  /** Roll for a rare variant (rarest first, at most one). */
  rollVariant(): Variant | undefined {
    for (const v of VARIANT_ORDER) if (this.rng() < VARIANTS[v].chance) return v;
    return undefined;
  }

  /** A fish is landed: maybe a variant, weigh it (clothes make it bigger), price it, bag it, log it. */
  private land(fish: FishDef): Catch {
    const variant = this.rollVariant();
    const v = variant ? VARIANTS[variant] : { size: 1, value: 1 };
    const ratio = (0.6 + this.rng() * 0.8) * (1 + CLOTHES[this.clothes]!.size) * v.size;
    const kg = Math.round(fish.kg * ratio * 100) / 100;
    const value = Math.max(1, Math.round(fish.price * ratio * v.value));
    const c: Catch = { id: this.nextId++, fish: fish.id, kg, value, ...(variant ? { variant } : {}) };
    this.bag.push(c);
    const j = this.journal[fish.id] ?? { count: 0, bestKg: 0 };
    const variants = { ...j.variants };
    if (variant) variants[variant] = (variants[variant] ?? 0) + 1;
    this.journal[fish.id] = { count: j.count + 1, bestKg: Math.max(j.bestKg, kg), ...(Object.keys(variants).length ? { variants } : {}) };
    return c;
  }

  /** Distinct (species, variant) pairs found, out of 20 × 3. */
  variantsFound(): number {
    return Object.values(this.journal).reduce((s, j) => s + Object.keys(j.variants ?? {}).length, 0);
  }

  // ---------- market ----------

  sell(catchId: number): number {
    const i = this.bag.findIndex((c) => c.id === catchId);
    if (i < 0) return 0;
    const price = this.priceOf(this.bag[i]!);
    this.bag.splice(i, 1);
    this.money += price;
    this.earned += price;
    return price;
  }

  /** Sell every catch of one species (all variants). */
  sellSpecies(fishId: string): number {
    return this.bag.filter((c) => c.fish === fishId).reduce((s, c) => s + this.sell(c.id), 0);
  }

  sellAll(): number {
    const total = this.bagValue();
    this.money += total;
    this.earned += total;
    this.bag = [];
    return total;
  }

  bagValue(): number {
    return this.bag.reduce((s, c) => s + this.priceOf(c), 0);
  }

  /** The next level of a gear line, or null when maxed. */
  nextGear(kind: GearKind): { level: number; name: string; price: number; blurb: string } | null {
    const level = this.gearLevel(kind) + 1;
    const def = GEAR[kind].levels[level];
    return def ? { level, ...def } : null;
  }

  /** Buy the next level of a gear line. */
  buyGear(kind: GearKind): boolean {
    const next = this.nextGear(kind);
    if (!next || this.money < next.price) return false;
    this.money -= next.price;
    this[kind] = next.level;
    if (kind === 'holders') this.syncLines();
    return true;
  }

  nextSkillCost(id: SkillId = 'fishing'): number | null {
    const l = this.level(id);
    return l >= SKILLS[id].max ? null : SKILLS[id].cost(l);
  }

  train(id: SkillId = 'fishing'): boolean {
    const cost = this.nextSkillCost(id);
    if (cost === null || this.money < cost) return false;
    this.money -= cost;
    this.setLevel(id, this.level(id) + 1);
    return true;
  }

  // ---------- the Fishing Company ----------

  /** The old harbor is for sale once you've earned enough (and stays revealed once bought). */
  get companyRevealed(): boolean {
    return this.company || this.earned >= COMPANY_UNLOCK_EARNED;
  }

  /** Letters from the harbor's owner that are now due; each is returned once. */
  takeLetters(): string[] {
    const out: string[] = [];
    while (this.letters < LETTERS.length && this.earned >= LETTERS[this.letters]!.at) out.push(LETTERS[this.letters++]!.text);
    return out;
  }

  buyCompany(): boolean {
    if (this.company || !this.companyRevealed || this.money < COMPANY_PRICE) return false;
    this.money -= COMPANY_PRICE;
    this.company = true;
    this.letters = LETTERS.length;
    return true;
  }

  /** Phase 1: one boat. */
  get canBuyBoat(): boolean {
    return this.company && this.boats.length < 1;
  }

  buyBoat(): boolean {
    if (!this.canBuyBoat || this.money < BOAT_PRICE) return false;
    this.money -= BOAT_PRICE;
    this.boats.push({ net: 0, crew: 0, trip: null, haul: null });
    return true;
  }

  nextCrewCost(i: number): number | null {
    const b = this.boats[i];
    return b && b.crew < CREW_MAX ? CREW_COST[b.crew]! : null;
  }

  hireCrew(i: number): boolean {
    const cost = this.nextCrewCost(i);
    if (cost === null || this.money < cost) return false;
    this.money -= cost;
    this.boats[i]!.crew++;
    return true;
  }

  nextNet(i: number): { level: number; name: string; price: number; fish: number } | null {
    const b = this.boats[i];
    const level = (b?.net ?? 99) + 1;
    return b && NETS[level] ? { level, ...NETS[level]! } : null;
  }

  upgradeNet(i: number): boolean {
    const next = this.nextNet(i);
    if (!next || this.money < next.price) return false;
    this.money -= next.price;
    this.boats[i]!.net = next.level;
    return true;
  }

  tripSeconds(b: Boat): number {
    return TRIP_SECONDS * (1 - CREW_SPEED * b.crew);
  }

  haulSize(b: Boat): number {
    return Math.round(NETS[b.net]!.fish * (1 + CREW_HAUL * b.crew));
  }

  /** Send a boat out (only when it's at the pier with nothing to unload). */
  sendBoat(i: number): boolean {
    const b = this.boats[i];
    if (!b || b.trip || b.haul) return false;
    b.trip = { t: 0, dur: this.tripSeconds(b) };
    return true;
  }

  /** Sell a boat's haul straight from the harbor. Returns the money. */
  collectHaul(i: number): number {
    const b = this.boats[i];
    if (!b?.haul) return 0;
    const raw = b.haul.reduce((s, h) => s + h.value, 0);
    const paid = Math.round(raw * (1 + HAGGLE_PER_LEVEL * this.haggling) * (this.dev ? DEV_MULTIPLIER : 1));
    b.haul = null;
    this.money += paid;
    this.earned += paid;
    return paid;
  }

  /** What a haul sells for right now. */
  haulValue(b: Boat): number {
    const raw = (b.haul ?? []).reduce((s, h) => s + h.value, 0);
    return Math.round(raw * (1 + HAGGLE_PER_LEVEL * this.haggling) * (this.dev ? DEV_MULTIPLIER : 1));
  }

  /** A net full of sea fish, grouped by kind. */
  private rollHaul(b: Boat): { fish: string; n: number; value: number }[] {
    const out = new Map<string, { fish: string; n: number; value: number }>();
    for (let k = this.haulSize(b); k > 0; k--) {
      const f = this.pick(SEA_FISH, (x) => TIERS[x.tier].weight * x.rarity);
      const e = out.get(f.id) ?? { fish: f.id, n: 0, value: 0 };
      e.n++;
      e.value += Math.round(f.price * (0.6 + this.rng() * 0.8));
      out.set(f.id, e);
    }
    return SEA_FISH.filter((f) => out.has(f.id)).map((f) => out.get(f.id)!);
  }

  private tickBoats(dt: number): void {
    for (const b of this.boats) {
      if (!b.trip) continue;
      b.trip.t += dt;
      if (b.trip.t >= b.trip.dur) { b.trip = null; b.haul = this.rollHaul(b); }
    }
  }

  // ---------- achievements ----------

  /** The number an achievement measures. */
  stat(s: AchStat): number {
    const entries = Object.values(this.journal);
    const variantCount = (v: Variant) => entries.reduce((n, j) => n + (j.variants?.[v] ?? 0), 0);
    switch (s) {
      case 'catches': return entries.reduce((n, j) => n + j.count, 0);
      case 'species': return entries.length;
      case 'tier': return Math.max(0, ...Object.keys(this.journal).map((id) => fishById(id).tier));
      case 'giant': case 'golden': case 'shiny': return variantCount(s);
      case 'variants': return this.variantsFound();
      case 'earned': return this.earned;
      case 'lines': return this.lineCount;
      case 'auto': return this.auto;
      case 'fishing': return this.skill;
    }
  }

  achieved(a: AchievementDef): boolean {
    return this.stat(a.stat) >= a.goal;
  }

  /** Done but reward not collected yet. */
  claimable(): AchievementDef[] {
    return ACHIEVEMENTS.filter((a) => this.achieved(a) && !this.claimed.includes(a.id));
  }

  /** Collect one achievement's reward (or every ready one without an id). Returns the cash paid. */
  claim(id?: string): number {
    let paid = 0;
    for (const a of this.claimable()) {
      if (id && a.id !== id) continue;
      this.claimed.push(a.id);
      this.money += a.reward;
      paid += a.reward;
    }
    return paid;
  }

  save(): SaveData {
    return {
      money: this.money, rod: this.rod, holders: this.holders, auto: this.auto, baits: { ...this.baits }, baitSel: this.baitSel,
      clothes: this.clothes, boots: this.boots,
      skill: this.skill, reflexes: this.reflexes, haggling: this.haggling, strength: this.strength, dev: this.dev,
      bag: this.bag, journal: this.journal, nextId: this.nextId, earned: this.earned, claimed: this.claimed,
      company: this.company, letters: this.letters, boats: this.boats,
    };
  }
}
