import {
  ACHIEVEMENTS, AUTO, BAITS, BERTHS, BOATS, BOAT_REPEAT, CAPTAIN_CATCH, CAPTAIN_STORM, CAPTAIN_WAGE, COMPANY_PRICE, COMPANY_UNLOCK_EARNED,
  CREW_BASE, CREW_HAUL, CREW_SPEED, ENGINE_SPEED, GROUNDS, HARBOR_UPGRADES, HULL_HOLD, HULL_STORM, ICE_VALUE, SCHOOL_CHANCE,
  SIGHTING_CHANCE, SONAR_STEP, STORM_LOSS, TRACKS, TRACK_GROWTH, TRACK_MAX, WAREHOUSE, crewCost,
  type GroundDef, type GroundId, type HarborUpgradeId, type TrackId,
  HANDS_MAX, HAND_COST, HAND_REACT, HAND_REACT_PER_LEVEL, HAND_REST, HAND_SKILL_MAX, LETTERS, handSkillCost, type BoatType, BITE_WAIT, BOOTS, CLOTHES, DEV_MULTIPLIER, FISH, GEAR, HAGGLE_PER_LEVEL, HOLDERS, MAX_GROUND_WORMS,
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

export interface HaulItem { fish: string; n: number; value: number }
export type TripEvent = 'storm' | 'school' | 'sighting';

/** One company boat: its upgrade tracks, crew, where it fishes, the trip it's on, and the haul waiting at the pier. */
export interface Boat {
  type: BoatType;
  tracks: Record<TrackId, number>;
  crew: number;
  ground: GroundId;
  trip: { t: number; dur: number; ground: GroundId } | null;
  haul: HaulItem[] | null;
  /** What happened on the last trip, for the haul screen. */
  event: TripEvent | null;
  /** Old saves: the gear level before boats had tracks. */
  net?: number;
}

const NO_TRACKS = (): Record<TrackId, number> => ({ hull: 0, engine: 0, gear: 0, sonar: 0, ice: 0, captain: 0 });

/** A hired fisherman on the wide pier: their own rod and level, the bait you assigned, one line. */
export interface Hand {
  rod: number;
  skill: number;
  bait: BaitId;
  line: Line;
  /** Reaction time picked for the current bite. */
  react: number | null;
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
  /** Harbor: berth level, automation bought, warehouse level. */
  berths: number;
  harbor: Partial<Record<HarborUpgradeId, boolean>>;
  warehouse: number;
  /** When this was saved (ms), for earnings while away. */
  savedAt: number;
  hands: Hand[];
  /** Hired fishermen's catches, waiting to be sold. */
  crate: Catch[];
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
  berths = 0;
  harbor: Partial<Record<HarborUpgradeId, boolean>> = {};
  warehouse = 0;
  /** What just happened in the fleet (boats back, sold, events), for the UI to announce; not saved. */
  fleetNews: { boat: number; paid: number; event: TripEvent | null }[] = [];
  private buyerClock = 0;
  private supplierClock = 0;
  hands: Hand[] = [];
  crate: Catch[] = [];
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
    // Boats from before upgrade tracks: keep their gear level and crew.
    this.boats = this.boats.map((b) => ({
      ...b, type: b.type ?? 'net', tracks: { ...NO_TRACKS(), ...(b.tracks ?? { gear: Math.min(b.net ?? 0, TRACK_MAX) }) },
      ground: b.ground ?? 'coast', event: b.event ?? null,
      trip: b.trip ? { ...b.trip, ground: b.trip.ground ?? b.ground ?? 'coast' } : null,
    }));
    for (const b of this.boats) delete b.net;
    this.berths = clamp(this.berths, 0, BERTHS.length - 1);
    this.warehouse = clamp(this.warehouse, 0, WAREHOUSE.length - 1);
    for (const h of this.hands) { h.line = { type: 'idle' }; h.react = null; }
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

  /** Fish that can bite: everything a rod lands, plus one tier above it. */
  private biters(rodTier: Tier = this.rodTier): FishDef[] {
    return FISH.filter((f) => f.tier <= rodTier + 1);
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
  private weight(f: FishDef, skill: number, bait: BaitId, rodTier: Tier = this.rodTier): number {
    const step = 1 + SKILL_TIER_BONUS * (skill - 1) + baitById(bait).lure;
    // Too-strong fish bite at a steady share of the rod's top tier: levels and bait don't make snaps more common.
    if (f.tier > rodTier) return TIERS[f.tier].weight * f.rarity * Math.pow(step, rodTier - 1) * TOO_STRONG_WEIGHT;
    return TIERS[f.tier].weight * f.rarity * Math.pow(step, f.tier - 1);
  }

  /** Which fish bites (bait as cast). */
  rollFish(bait: BaitId = 'worm', rodTier: Tier = this.rodTier, skill = this.skill): { fish: FishDef; tooStrong: boolean } {
    const list = this.biters(rodTier);
    const fish = this.pick(list, (f) => this.weight(f, skill, bait, rodTier));
    return { fish, tooStrong: fish.tier > rodTier };
  }

  /** Odds for a hired fisherman (their rod and level, their bait). */
  handOdds(h: Hand): { fish: FishDef; p: number; tooStrong: boolean }[] {
    const tier = RODS[h.rod]!.tier;
    const weights = this.biters(tier).map((f) => ({ fish: f, w: this.weight(f, h.skill, h.bait, tier) }));
    const total = weights.reduce((s, x) => s + x.w, 0);
    return weights.map(({ fish, w }) => ({ fish, p: w / total, tooStrong: fish.tier > tier }));
  }

  private pick(list: FishDef[], w: (f: FishDef) => number): FishDef {
    const total = list.reduce((s, f) => s + w(f), 0);
    let r = this.rng() * total;
    for (const f of list) { r -= w(f); if (r <= 0) return f; }
    return list[list.length - 1]!;
  }

  /** Bites come sooner with better bait and rods. */
  biteWait(bait: BaitId = 'worm', rod = this.rod): number {
    const [lo, hi] = BITE_WAIT;
    const wait = (lo + this.rng() * (hi - lo)) * baitById(bait).wait * (1 - 0.06 * rod);
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
    this.tickHarbor(dt);
    this.tickHands(dt);
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
  /** A fish is landed (by you, or by a hired hand into the pier crate): variant, weight, price, journal. */
  private land(fish: FishDef, byHand = false): Catch {
    const variant = this.rollVariant();
    const v = variant ? VARIANTS[variant] : { size: 1, value: 1 };
    const ratio = (0.6 + this.rng() * 0.8) * (byHand ? 1 : 1 + CLOTHES[this.clothes]!.size) * v.size;
    const kg = Math.round(fish.kg * ratio * 100) / 100;
    const value = Math.max(1, Math.round(fish.price * ratio * v.value));
    const c: Catch = { id: this.nextId++, fish: fish.id, kg, value, ...(variant ? { variant } : {}) };
    (byHand ? this.crate : this.bag).push(c);
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

  // ---------- the fleet ----------

  /** How many boats the harbor's berths hold. */
  get berthCount(): number {
    return BERTHS[this.berths]!.boats;
  }

  nextBerth(): { boats: number; price: number } | null {
    return BERTHS[this.berths + 1] ?? null;
  }

  buyBerth(): boolean {
    const next = this.nextBerth();
    if (!this.company || !next || this.money < next.price) return false;
    this.money -= next.price;
    this.berths++;
    return true;
  }

  /** Price of the next boat of a kind: each extra one of the same kind costs more. */
  boatPrice(type: BoatType): number {
    const owned = this.boats.filter((b) => b.type === type).length;
    return Math.round(BOATS[type].price * (1 + BOAT_REPEAT * owned));
  }

  canBuyBoat(type: BoatType = 'net'): boolean {
    return this.company && this.boats.length < this.berthCount && !!BOATS[type];
  }

  buyBoat(type: BoatType = 'net'): boolean {
    const price = this.boatPrice(type);
    if (!this.canBuyBoat(type) || this.money < price) return false;
    this.money -= price;
    this.boats.push({ type, tracks: NO_TRACKS(), crew: 0, ground: 'coast', trip: null, haul: null, event: null });
    return true;
  }

  /** A boat's name in the fleet: "Net Boat", "Net Boat 2", ... */
  boatName(i: number): string {
    const b = this.boats[i]!;
    const n = this.boats.slice(0, i + 1).filter((x) => x.type === b.type).length;
    return n > 1 ? `${BOATS[b.type].name} ${n}` : BOATS[b.type].name;
  }

  /** Cost of the next level of an upgrade track on a boat, or null at max. */
  nextTrackCost(i: number, id: TrackId): number | null {
    const b = this.boats[i];
    if (!b || b.tracks[id] >= TRACK_MAX) return null;
    return Math.round((BOATS[b.type].upgrade * TRACKS[id].cost * Math.pow(TRACK_GROWTH, b.tracks[id])) / 100) * 100;
  }

  upgradeTrack(i: number, id: TrackId): boolean {
    const cost = this.nextTrackCost(i, id);
    if (cost === null || this.money < cost) return false;
    this.money -= cost;
    this.boats[i]!.tracks[id]++;
    return true;
  }

  /** Crew slots: a bigger hull holds more hands. */
  crewMax(b: Boat): number {
    return CREW_BASE + b.tracks.hull;
  }

  nextCrewCost(i: number): number | null {
    const b = this.boats[i];
    return b && b.crew < this.crewMax(b) ? crewCost(BOATS[b.type].upgrade, b.crew) : null;
  }

  hireCrew(i: number): boolean {
    const cost = this.nextCrewCost(i);
    if (cost === null || this.money < cost) return false;
    this.money -= cost;
    this.boats[i]!.crew++;
    return true;
  }

  /** Can this boat reach a fishing ground (engine / hull / sonar levels)? */
  groundOpen(b: Boat, g: GroundDef): boolean {
    return (Object.entries(g.need) as [TrackId, number][]).every(([id, lvl]) => b.tracks[id] >= lvl);
  }

  setGround(i: number, id: GroundId): boolean {
    const b = this.boats[i], g = GROUNDS.find((x) => x.id === id);
    if (!b || !g || !this.groundOpen(b, g)) return false;
    b.ground = id;
    return true;
  }

  private groundOf(id: GroundId): GroundDef {
    return GROUNDS.find((g) => g.id === id) ?? GROUNDS[0]!;
  }

  tripSeconds(b: Boat, ground: GroundId = b.ground): number {
    return this.groundOf(ground).trip * BOATS[b.type].tripFactor * (1 - ENGINE_SPEED * b.tracks.engine) * (1 - CREW_SPEED * b.crew);
  }

  haulSize(b: Boat): number {
    const gear = BOATS[b.type].gear[b.tracks.gear]!;
    return Math.round(gear * (1 + CREW_HAUL * b.crew) * (1 + HULL_HOLD * b.tracks.hull) * (1 + CAPTAIN_CATCH * b.tracks.captain));
  }

  stormChance(b: Boat, ground: GroundId = b.ground): number {
    return Math.max(0, this.groundOf(ground).storm * (1 - HULL_STORM * b.tracks.hull) * (1 - CAPTAIN_STORM * b.tracks.captain));
  }

  /** Send a boat out to its fishing ground (only when it's at the pier with nothing to unload). */
  sendBoat(i: number): boolean {
    const b = this.boats[i];
    if (!b || b.trip || b.haul) return false;
    b.trip = { t: 0, dur: this.tripSeconds(b), ground: b.ground };
    b.event = null;
    return true;
  }

  /** What a haul sells for: Haggling and dev mode, less a captain's wages and any harbor fee. */
  haulValue(b: Boat, fee = 0): number {
    const raw = (b.haul ?? []).reduce((s, h) => s + h.value, 0);
    const wage = b.tracks.captain > 0 ? CAPTAIN_WAGE : 0;
    return Math.round(raw * (1 + HAGGLE_PER_LEVEL * this.haggling) * (this.dev ? DEV_MULTIPLIER : 1) * (1 - wage) * (1 - fee));
  }

  /** Sell a boat's haul straight from the harbor. Returns the money. */
  collectHaul(i: number, fee = 0): number {
    const b = this.boats[i];
    if (!b?.haul) return 0;
    const paid = this.haulValue(b, fee);
    b.haul = null;
    this.money += paid;
    this.earned += paid;
    return paid;
  }

  /**
   * A trip's catch, grouped by kind: farther grounds and better sonar mean
   * rarer catch, farther grounds and the ice hold mean bigger value. Then the
   * sea has its say: a storm, a lucky school, or a sighting.
   */
  private rollHaul(b: Boat, groundId: GroundId): HaulItem[] {
    const ground = this.groundOf(groundId), def = BOATS[b.type];
    const step = 1 + ground.step + SONAR_STEP * b.tracks.sonar;
    const worth = ground.size * (1 + ICE_VALUE * b.tracks.ice);
    const out = new Map<string, HaulItem>();
    const add = (fish: FishDef, mult = 1) => {
      const e = out.get(fish.id) ?? { fish: fish.id, n: 0, value: 0 };
      e.n++;
      e.value += Math.round(fish.price * worth * mult * (0.6 + this.rng() * 0.8));
      out.set(fish.id, e);
    };
    for (let k = this.haulSize(b); k > 0; k--) add(this.pick(def.catch, (x) => TIERS[x.tier].weight * x.rarity * Math.pow(step, x.tier - 1)));
    b.event = null;
    const roll = this.rng();
    const storm = this.stormChance(b, groundId);
    if (roll < storm) {
      b.event = 'storm';
      for (const e of out.values()) { e.n = Math.max(0, Math.round(e.n * (1 - STORM_LOSS))); e.value = Math.round(e.value * (1 - STORM_LOSS)); }
    } else if (roll < storm + SCHOOL_CHANCE) {
      b.event = 'school';
      for (const e of out.values()) { e.n *= 2; e.value *= 2; }
    } else if (GROUNDS.indexOf(ground) >= 2 && roll < storm + SCHOOL_CHANCE + SIGHTING_CHANCE) {
      b.event = 'sighting';
      add(def.catch[def.catch.length - 1]!, 3);
    }
    return def.catch.filter((x) => (out.get(x.id)?.n ?? 0) > 0).map((x) => out.get(x.id)!);
  }

  private tickBoats(dt: number): void {
    this.boats.forEach((b, i) => {
      if (b.trip) {
        b.trip.t += dt;
        if (b.trip.t >= b.trip.dur) {
          const g = b.trip.ground;
          b.trip = null;
          b.haul = this.rollHaul(b, g);
          // Automation: the harbor master sells hauls as they come in.
          const paid = this.harbor.master ? this.collectHaul(i, HARBOR_UPGRADES.master.fee) : 0;
          this.fleetNews.push({ boat: i, paid, event: b.event });
        }
      }
      if (b.haul && this.harbor.master) this.collectHaul(i, HARBOR_UPGRADES.master.fee);
      // A captain sails again by himself.
      if (!b.trip && !b.haul && b.tracks.captain > 0) this.sendBoat(i);
    });
  }

  // ---------- the harbor: automation and the warehouse ----------

  buyHarbor(id: HarborUpgradeId): boolean {
    const u = HARBOR_UPGRADES[id];
    if (!this.company || this.harbor[id] || this.money < u.price) return false;
    this.money -= u.price;
    this.harbor[id] = true;
    return true;
  }

  nextWarehouse(): { hours: number; price: number } | null {
    return WAREHOUSE[this.warehouse + 1] ?? null;
  }

  buyWarehouse(): boolean {
    const next = this.nextWarehouse();
    if (!this.company || !next || this.money < next.price) return false;
    this.money -= next.price;
    this.warehouse++;
    return true;
  }

  /** Hours of earnings the company keeps while the game is closed. */
  get offlineHours(): number {
    return WAREHOUSE[this.warehouse]!.hours;
  }

  /** Fish Buyer empties the pier crate every minute; Bait Supplier tops up each fisherman's bait (at a markup). */
  private tickHarbor(dt: number): void {
    if (this.harbor.buyer && (this.buyerClock += dt) >= 60) {
      this.buyerClock = 0;
      const total = Math.round(this.crateValue() * (1 - HARBOR_UPGRADES.buyer.fee));
      this.crate = [];
      this.money += total;
      this.earned += total;
    }
    if (this.harbor.supplier && (this.supplierClock += dt) >= 5) {
      this.supplierClock = 0;
      for (const h of this.hands) {
        const price = BAITS.find((x) => x.id === h.bait)!.price * (1 + HARBOR_UPGRADES.supplier.fee);
        if (price <= 0 || this.baitCount(h.bait) >= 5 || this.money < price * 20) continue;
        this.money -= Math.round(price * 20);
        this.baits[h.bait] = this.baitCount(h.bait) + 20;
      }
    }
  }

  /**
   * Time passed with the game closed: the company keeps working (boats,
   * captains, the harbor master, fishermen, buyer, supplier) for up to the
   * warehouse's hours. Returns the money made.
   */
  catchUp(seconds: number): number {
    if (!this.company) return 0;
    const before = this.money;
    const total = Math.min(seconds, this.offlineHours * 3600);
    for (let t = 0; t < total; t += 0.5) this.tick(0.5);
    this.fleetNews = [];
    return Math.round(this.money - before);
  }

  // ---------- hired fishermen on the wide pier ----------

  /** The wide pier (and hiring) opens with your first boat. */
  get pierOpen(): boolean {
    return this.boats.length > 0;
  }

  nextHandCost(): number | null {
    return this.pierOpen && this.hands.length < HANDS_MAX ? HAND_COST[this.hands.length]! : null;
  }

  hireHand(): boolean {
    const cost = this.nextHandCost();
    if (cost === null || this.money < cost) return false;
    this.money -= cost;
    this.hands.push({ rod: 0, skill: 1, bait: 'worm', line: { type: 'idle' }, react: null });
    return true;
  }

  handNextRod(i: number): { level: number; name: string; price: number } | null {
    const h = this.hands[i];
    const r = h ? RODS[h.rod + 1] : undefined;
    return h && r ? { level: h.rod + 1, name: r.name, price: r.price } : null;
  }

  upgradeHandRod(i: number): boolean {
    const next = this.handNextRod(i);
    if (!next || this.money < next.price) return false;
    this.money -= next.price;
    this.hands[i]!.rod = next.level;
    return true;
  }

  handTrainCost(i: number): number | null {
    const h = this.hands[i];
    return h && h.skill < HAND_SKILL_MAX ? handSkillCost(h.skill) : null;
  }

  trainHand(i: number): boolean {
    const cost = this.handTrainCost(i);
    if (cost === null || this.money < cost) return false;
    this.money -= cost;
    this.hands[i]!.skill++;
    return true;
  }

  setHandBait(i: number, bait: BaitId): void {
    const h = this.hands[i];
    if (h) h.bait = bait;
  }

  /** Is this fisherman stuck for want of their bait? */
  handStarved(h: Hand): boolean {
    return h.line.type === 'idle' && this.baitCount(h.bait) === 0;
  }

  crateValue(): number {
    return this.crate.reduce((s, c) => s + this.priceOf(c), 0);
  }

  /** Sell everything the fishermen caught. */
  sellCrate(): number {
    const total = this.crateValue();
    this.money += total;
    this.earned += total;
    this.crate = [];
    return total;
  }

  /** Each fisherman runs their own line: bait from your pouch, cast, wait, reel after a reaction time, recast. */
  private tickHands(dt: number): void {
    for (const h of this.hands) {
      const line = h.line;
      const tier = RODS[h.rod]!.tier;
      if (line.type === 'idle') {
        if (this.baitCount(h.bait) > 0) {
          this.baits[h.bait] = this.baitCount(h.bait) - 1;
          h.line = { type: 'casting', t: 0, bait: h.bait };
        }
        continue;
      }
      line.t += dt;
      if (line.type === 'casting' && line.t >= CAST_SECONDS) {
        h.line = { type: 'waiting', t: 0, biteAt: this.biteWait(line.bait, h.rod), bait: line.bait };
      } else if (line.type === 'waiting' && line.t >= line.biteAt) {
        const { fish, tooStrong } = this.rollFish(line.bait, tier, h.skill);
        h.line = { type: 'bite', t: 0, window: REEL_WINDOW, fish, tooStrong };
        const slow = Math.max(HAND_REACT[0], HAND_REACT[1] - HAND_REACT_PER_LEVEL * (h.skill - 1));
        h.react = HAND_REACT[0] + this.rng() * (slow - HAND_REACT[0]);
      } else if (line.type === 'bite' && line.t >= (h.react ?? 0)) {
        if (h.react! > line.window) h.line = { type: 'result', t: 0, outcome: 'escaped', fish: line.fish };
        else if (line.tooStrong) h.line = { type: 'result', t: 0, outcome: 'snapped', fish: line.fish };
        else h.line = { type: 'result', t: 0, outcome: 'caught', fish: line.fish, caught: this.land(line.fish, true) };
        h.react = null;
      } else if (line.type === 'result' && line.t >= HAND_REST) {
        h.line = { type: 'idle' };
      }
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
      berths: this.berths, harbor: { ...this.harbor }, warehouse: this.warehouse, savedAt: Date.now(),
      hands: this.hands.map((h) => ({ ...h, line: { type: 'idle' as const }, react: null })), crate: this.crate,
    };
  }
}
