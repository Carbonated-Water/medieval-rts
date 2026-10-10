import {
  ACHIEVEMENTS, AUTO, BAITS, BERTHS, BOATS, BOAT_REPEAT, BOAT_RESALE, CAPTAIN_CATCH, CAPTAIN_STORM, CAPTAIN_WAGE, COMPANY_PRICE, COMPANY_UNLOCK_EARNED,
  CREW_BASE, CREW_HAUL, CREW_SPEED, ENGINE_SPEED, GROUNDS, HARBOR_UPGRADES, HULL_HOLD, HULL_STORM, ICE_VALUE, SCHOOL_CHANCE,
  SIGHTING_CHANCE, SONAR_STEP, STORM_LOSS, TRACKS, TRACK_GROWTH, TRACK_MAX, WAREHOUSE, crewCost,
  type GroundDef, type GroundId, type HarborUpgradeId, type TrackId,
  HANDS_MAX, MANAGER_BUDGETS, PIER_SECTIONS, PIER_SPOTS, SELLER_BAG, handCost, HAND_REACT, HAND_REACT_PER_LEVEL, HAND_REST, HAND_SKILL_MAX, LETTERS, handSkillCost, type BoatType, BITE_WAIT, BOOTS, CLOTHES, DEV_MULTIPLIER, FISH, GEAR, HAGGLE_PER_LEVEL, HOLDERS, MAX_GROUND_WORMS,
  MIN_BITE_WAIT, REEL_WINDOW, REFLEX_PER_LEVEL, RODS, SKILLS, SKILL_TIER_BONUS, START_MONEY, START_WORMS, STRENGTH_PER_LEVEL, TIERS,
  TOO_STRONG_WEIGHT, VARIANTS, VARIANT_ORDER, WORMS_PER_PICK, WORM_SPAWN_SECONDS, WORM_SPOTS, baitById,
  type AchStat, type AchievementDef, type BaitId, type FishDef, type GearKind, type SkillId, type Tier, type Variant,
  BILLFISH, SEA_FISH, SHELLFISH, TREE_FISH, pearlsFor, treeFishById, type TreeFish, COLLECTORS, EXOTIC, LEGENDS,
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
  /** The ledger: money put into this boat, money it has brought in, trips made. */
  invested: number;
  earned: number;
  trips: number;
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
  /** Prestige: Pearls in the pouch, fish unlocked in the Fish Tree, times retired. These survive retiring. */
  pearls?: number;
  fishTree?: string[];
  retirements?: number;
  /** Sea species your boats have ever landed (the sea's journal); survives retiring. */
  seaSeen?: string[];
  /** The Exotic Market. */
  exoticHold?: Exotic[];
  listings?: Listing[];
  wanted?: Wanted[];
  nextExoticId?: number;
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
  /** Pier sections bought (4 fishing spots each) and the Manager's spending limit (index into MANAGER_BUDGETS). */
  pierSections: number;
  managerBudget: number;
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
  | { type: 'bite'; t: number; window: number; fish: FishDef; tooStrong: boolean; bait?: BaitId }
  | { type: 'result'; t: number; outcome: 'caught' | 'escaped' | 'snapped' | 'scared'; fish?: FishDef; caught?: Catch; strong?: boolean };

/** Every fish in the game: river, sea, the Fish Tree, and the expedition legends. */
const ALL_FISH: FishDef[] = [...FISH, ...SEA_FISH, ...SHELLFISH, ...BILLFISH, ...TREE_FISH, ...LEGENDS];

/** An expedition fish in the exotic hold: which legend, how heavy, what it's worth. */
export interface Exotic { id: number; fish: string; kg: number; value: number }
/** A collector's offer on a listed fish (seconds left before it's withdrawn). */
export interface Offer { buyer: string; amount: number; left: number }
/** A fish up for offers: the offers in, seconds to the next one, how long it has been listed. */
export interface Listing { exotic: Exotic; offers: Offer[]; next: number; age: number }
/** A WANTED notice: a collector wants this legend, at least this heavy, for this reward, before time runs out. */
export interface Wanted { id: number; buyer: string; fish: string; minKg: number; reward: number; left: number }
export const fishById = (id: string): FishDef => ALL_FISH.find((f) => f.id === id)!;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

/**
 * Unlocked fish split their tier's share of bites with the old ones instead
 * of adding to it (more Common fish mustn't crowd out the rare tiers): a
 * fish's weight is scaled by the tier's original total rarity over its total
 * rarity now. A tier with no original fish (the sea's Legendary) is left as is.
 */
function tierShare(base: FishDef[], pool: FishDef[], f: FishDef): number {
  const sum = (list: FishDef[]) => list.reduce((s, x) => s + (x.tier === f.tier ? x.rarity : 0), 0);
  const was = sum(base);
  return was > 0 ? was / sum(pool) : 1;
}

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
  pearls = 0;
  fishTree: string[] = [];
  retirements = 0;
  seaSeen: string[] = [];
  exoticHold: Exotic[] = [];
  listings: Listing[] = [];
  wanted: Wanted[] = [];
  nextExoticId = 1;
  private wantedClock = 0;
  /** Value made so far this session, by source (fish caught at their price, boat hauls). For the $/sec readout; not saved. */
  made = { you: 0, hands: 0, boats: 0 };
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
  /** Money the Fish Seller made from your bag since the UI last looked; not saved. */
  sellerNews = 0;
  pierSections = 1;
  managerBudget = 2;
  private buyerClock = 0;
  private supplierClock = 0;
  private managerClock = 0;
  private trainClock = 0;
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
      ground: b.ground ?? 'coast', event: b.event ?? null, earned: b.earned ?? 0, trips: b.trips ?? 0, invested: b.invested ?? -1,
      trip: b.trip ? { ...b.trip, ground: b.trip.ground ?? b.ground ?? 'coast' } : null,
    }));
    for (const b of this.boats) delete b.net;
    this.boats.forEach((b, i) => { if (b.invested < 0) b.invested = this.boatResale(i) * 2; });
    this.berths = clamp(this.berths, 0, BERTHS.length - 1);
    this.warehouse = clamp(this.warehouse, 0, WAREHOUSE.length - 1);
    // The Fish Buyer became the Fish Seller (who also sells your bag).
    const oldHarbor = this.harbor as Record<string, boolean | undefined>;
    if (oldHarbor.buyer) { this.harbor = { ...this.harbor, seller: true }; delete oldHarbor.buyer; }
    this.pierSections = clamp(this.pierSections, 1, PIER_SECTIONS.length);
    this.managerBudget = clamp(this.managerBudget, 0, MANAGER_BUDGETS.length - 1);
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
    return this.riverFish().filter((f) => f.tier <= rodTier + 1);
  }

  // ---------- prestige: Pearls and the Fish Tree ----------

  /** River fish that can bite you and your fishermen: the 20 originals plus those unlocked in the tree. */
  riverFish(): FishDef[] {
    return [...FISH, ...TREE_FISH.filter((f) => f.side === 'river' && this.fishTree.includes(f.id))];
  }

  /** What a boat can bring back from a ground: its own catch plus tree fish of that boat from this ground or shallower; cheapest first. */
  seaPool(type: BoatType, ground: GroundId): FishDef[] {
    const depth = GROUNDS.findIndex((g) => g.id === ground);
    const extra = TREE_FISH.filter((f) => f.side === 'sea' && f.boat === type && this.fishTree.includes(f.id) && GROUNDS.findIndex((g) => g.id === f.ground) <= depth);
    return [...BOATS[type].catch, ...extra].sort((a, b) => a.price - b.price);
  }

  /** A tier of the tree opens once you own any fish of the tier below. */
  treeTierOpen(tier: Tier): boolean {
    return tier === 1 || TREE_FISH.some((f) => f.tier === tier - 1 && this.fishTree.includes(f.id));
  }

  /** Can this tree fish be unlocked now (tier open, its parent owned, enough Pearls)? */
  canUnlock(id: string): boolean {
    const f = treeFishById(id);
    return !!f && !this.fishTree.includes(id) && this.treeTierOpen(f.tier) && (!f.parent || this.fishTree.includes(f.parent)) && this.pearls >= f.cost;
  }

  /** Reachable but maybe not affordable: tier open and parent owned. */
  treeReachable(f: TreeFish): boolean {
    return this.treeTierOpen(f.tier) && (!f.parent || this.fishTree.includes(f.parent));
  }

  unlockFish(id: string): boolean {
    if (!this.canUnlock(id)) return false;
    this.pearls -= treeFishById(id)!.cost;
    this.fishTree.push(id);
    return true;
  }

  // ---------- the Exotic Market ----------

  private span = ([lo, hi]: [number, number]) => lo + this.rng() * (hi - lo);

  /** What an expedition fish of this weight is worth. */
  exoticValue(fish: string, kg: number): number {
    const l = LEGENDS.find((x) => x.id === fish)!;
    return Math.round((l.price * kg) / l.kg / 1000) * 1000;
  }

  /** A landed legend goes into the exotic hold (null if the hold is full). Voyages call this. */
  addExotic(fish: string, kg?: number): Exotic | null {
    if (this.exoticHold.length >= EXOTIC.hold) return null;
    const l = LEGENDS.find((x) => x.id === fish);
    if (!l) return null;
    const w = kg ?? Math.round(l.kg * (0.7 + this.rng() * 0.7));
    const e: Exotic = { id: this.nextExoticId++, fish, kg: w, value: this.exoticValue(fish, w) };
    this.exoticHold.push(e);
    return e;
  }

  /** Put a fish from the hold up for offers (if a listing slot is free). */
  listExotic(id: number): boolean {
    const i = this.exoticHold.findIndex((e) => e.id === id);
    if (i < 0 || this.listings.length >= EXOTIC.slots) return false;
    const [exotic] = this.exoticHold.splice(i, 1);
    this.listings.push({ exotic: exotic!, offers: [], next: this.span([4, 10]), age: 0 });
    return true;
  }

  /** Take a fish off the market, back into the hold. */
  unlistExotic(id: number): boolean {
    const i = this.listings.findIndex((l) => l.exotic.id === id);
    if (i < 0 || this.exoticHold.length >= EXOTIC.hold) return false;
    this.exoticHold.push(this.listings.splice(i, 1)[0]!.exotic);
    return true;
  }

  /** Sell a listed fish to one of its offers. */
  sellToOffer(id: number, offer: number): number {
    const i = this.listings.findIndex((l) => l.exotic.id === id), o = this.listings[i]?.offers[offer];
    if (!o) return 0;
    this.listings.splice(i, 1);
    this.money += o.amount;
    this.earned += o.amount;
    return o.amount;
  }

  /** Does this fish meet that notice? */
  meetsWanted(w: Wanted, e: Exotic): boolean {
    return e.fish === w.fish && e.kg >= w.minKg;
  }

  /** Hand a fish (from the hold or a listing) to a WANTED notice. */
  fulfillWanted(wantedId: number, exoticId: number): number {
    const w = this.wanted.find((x) => x.id === wantedId);
    const inHold = this.exoticHold.find((e) => e.id === exoticId), listed = this.listings.find((l) => l.exotic.id === exoticId);
    const e = inHold ?? listed?.exotic;
    if (!w || !e || !this.meetsWanted(w, e)) return 0;
    if (inHold) this.exoticHold = this.exoticHold.filter((x) => x !== inHold); else this.listings = this.listings.filter((x) => x !== listed);
    this.wanted = this.wanted.filter((x) => x !== w);
    this.money += w.reward;
    this.earned += w.reward;
    return w.reward;
  }

  /** Offers come and go on listed fish; WANTED notices are posted and expire. */
  private tickExotic(dt: number): void {
    for (const l of this.listings) {
      l.age += dt;
      for (const o of l.offers) o.left -= dt;
      l.offers = l.offers.filter((o) => o.left > 0);
      if ((l.next -= dt) <= 0) {
        l.next = this.span(EXOTIC.offerEvery);
        const used = new Set(l.offers.map((o) => o.buyer));
        const buyer = COLLECTORS.filter((b) => !used.has(b))[Math.floor(this.rng() * (COLLECTORS.length - used.size))] ?? COLLECTORS[0]!;
        const amount = Math.round((l.exotic.value * (this.span(EXOTIC.offerRange) + EXOTIC.offerTrend * (l.age / 60))) / 1000) * 1000;
        l.offers.push({ buyer, amount, left: this.span(EXOTIC.offerLife) });
        l.offers.sort((a, b) => b.amount - a.amount);
        l.offers = l.offers.slice(0, EXOTIC.maxOffers);
      }
    }
    if (!this.company) return;
    for (const w of this.wanted) w.left -= dt;
    this.wanted = this.wanted.filter((w) => w.left > 0);
    if (this.wanted.length < EXOTIC.wanted && (this.wantedClock += dt) >= EXOTIC.wantedEvery) {
      this.wantedClock = 0;
      const l = LEGENDS[Math.floor(this.rng() * LEGENDS.length)]!;
      const minKg = Math.round((l.kg * (0.8 + this.rng() * 0.4)) / 10) * 10;
      this.wanted.push({
        id: this.nextExoticId++, buyer: COLLECTORS[Math.floor(this.rng() * COLLECTORS.length)]!, fish: l.id, minKg,
        reward: Math.round((this.exoticValue(l.id, minKg) * this.span(EXOTIC.wantedPay)) / 1000) * 1000, left: this.span(EXOTIC.wantedLife),
      });
    }
  }

  /** Pearls you'd get for retiring now. */
  pearlsOnRetire(): number {
    return pearlsFor(this.earned);
  }

  /**
   * Retire: the save for the next run. Pearls (old plus new), the Fish Tree,
   * the journal and claimed achievements carry over; everything else starts
   * fresh. Returns null if this run hasn't earned a Pearl yet.
   */
  retire(): Partial<SaveData> | null {
    const gain = this.pearlsOnRetire();
    if (gain < 1) return null;
    return {
      pearls: this.pearls + gain, fishTree: [...this.fishTree], retirements: this.retirements + 1, seaSeen: [...this.seaSeen],
      journal: this.journal, claimed: [...this.claimed], dev: this.dev,
    };
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
    const share = tierShare(FISH, this.riverFish(), f);
    if (f.tier > rodTier) return TIERS[f.tier].weight * f.rarity * share * Math.pow(step, rodTier - 1) * TOO_STRONG_WEIGHT;
    return TIERS[f.tier].weight * f.rarity * share * Math.pow(step, f.tier - 1);
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
      else this.lines[i] = { type: 'result', t: 0, outcome: 'caught', fish: line.fish, caught: this.land(line.fish, false, line.bait), strong };
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
    this.tickExotic(dt);
    this.tickHands(dt);
    this.lines.forEach((line, i) => {
      if (line.type === 'idle') return;
      line.t += dt;
      if (line.type === 'casting' && line.t >= CAST_SECONDS) {
        this.lines[i] = { type: 'waiting', t: 0, biteAt: this.biteWait(line.bait), bait: line.bait };
      } else if (line.type === 'waiting' && line.t >= line.biteAt) {
        const { fish, tooStrong } = this.rollFish(line.bait);
        this.lines[i] = { type: 'bite', t: 0, window: this.reelWindow(), fish, tooStrong, bait: line.bait };
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
  private land(fish: FishDef, byHand = false, bait: BaitId = 'worm'): Catch {
    const variant = this.rollVariant();
    const v = variant ? VARIANTS[variant] : { size: 1, value: 1 };
    const ratio = (0.6 + this.rng() * 0.8) * (byHand ? 1 : 1 + CLOTHES[this.clothes]!.size) * v.size * baitById(bait).size;
    const kg = Math.round(fish.kg * ratio * 100) / 100;
    const value = Math.max(1, Math.round(fish.price * ratio * v.value));
    const c: Catch = { id: this.nextId++, fish: fish.id, kg, value, ...(variant ? { variant } : {}) };
    (byHand ? this.crate : this.bag).push(c);
    this.made[byHand ? 'hands' : 'you'] += this.priceOf(c);
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
    this.boats.push({ type, tracks: NO_TRACKS(), crew: 0, ground: 'coast', trip: null, haul: null, event: null, invested: price, earned: 0, trips: 0 });
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
    this.boats[i]!.invested += cost;
    return true;
  }

  /**
   * What a boat is expected to make per minute, worked out from its stats (not
   * luck): catches per trip x average value at its ground, storms and lucky
   * schools averaged in, less wages and the harbor master's fee, over the trip
   * time. With `change`, the same for the boat after one more level of a
   * track, one more deckhand, or another ground: that's the upgrade preview.
   */
  boatRate(b: Boat, change: { track?: TrackId; crew?: boolean; ground?: GroundId } = {}): number {
    const x: Boat = { ...b, tracks: { ...b.tracks }, crew: b.crew + (change.crew ? 1 : 0), ground: change.ground ?? b.ground };
    if (change.track) x.tracks[change.track] = Math.min(TRACK_MAX, x.tracks[change.track] + 1);
    const ground = this.groundOf(x.ground), def = BOATS[x.type];
    const step = 1 + ground.step + SONAR_STEP * x.tracks.sonar;
    const worth = ground.size * (1 + ICE_VALUE * x.tracks.ice);
    const pool = this.seaPool(x.type, x.ground);
    const weights = pool.map((c) => TIERS[c.tier].weight * c.rarity * tierShare(def.catch, pool, c) * Math.pow(step, c.tier - 1));
    const total = weights.reduce((s, w) => s + w, 0);
    const avg = pool.reduce((s, c, k) => s + (weights[k]! / total) * c.price, 0) * worth;
    const storm = this.stormChance(x);
    const luck = 1 - STORM_LOSS * storm + SCHOOL_CHANCE * (1 - storm);
    const sighting = GROUNDS.indexOf(ground) >= 2 ? SIGHTING_CHANCE * 3 * pool[pool.length - 1]!.price * worth : 0;
    const raw = this.haulSize(x) * avg * luck + sighting;
    const keep = (1 + HAGGLE_PER_LEVEL * this.haggling) * (this.dev ? DEV_MULTIPLIER : 1)
      * (x.tracks.captain > 0 ? 1 - CAPTAIN_WAGE : 1) * (this.harbor.master ? 1 - HARBOR_UPGRADES.master.fee : 1);
    return (raw * keep) / (this.tripSeconds(x) / 60);
  }

  /** What selling a boat pays: half of its base price, its upgrades and its crew. */
  boatResale(i: number): number {
    const b = this.boats[i];
    if (!b) return 0;
    const def = BOATS[b.type];
    let spent = def.price;
    for (const id of Object.keys(b.tracks) as TrackId[]) {
      for (let l = 0; l < b.tracks[id]; l++) spent += def.upgrade * TRACKS[id].cost * Math.pow(TRACK_GROWTH, l);
    }
    for (let n = 0; n < b.crew; n++) spent += crewCost(def.upgrade, n);
    return Math.round((spent * BOAT_RESALE) / 100) * 100;
  }

  /** Sell a boat (any haul on board is sold first; a trip at sea is abandoned). Frees its berth. Returns the money. */
  sellBoat(i: number): number {
    const b = this.boats[i];
    if (!b) return 0;
    const haul = this.collectHaul(i);
    const refund = this.boatResale(i);
    this.boats.splice(i, 1);
    this.money += refund;
    return refund + haul;
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
    this.boats[i]!.invested += cost;
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
    b.earned += paid;
    this.made.boats += paid;
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
    const pool = this.seaPool(b.type, groundId);
    for (let k = this.haulSize(b); k > 0; k--) add(this.pick(pool, (x) => TIERS[x.tier].weight * x.rarity * tierShare(def.catch, pool, x) * Math.pow(step, x.tier - 1)));
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
      add(pool[pool.length - 1]!, 3);
    }
    for (const id of out.keys()) if ((out.get(id)?.n ?? 0) > 0 && !this.seaSeen.includes(id)) this.seaSeen.push(id);
    return pool.filter((x) => (out.get(x.id)?.n ?? 0) > 0).map((x) => out.get(x.id)!);
  }

  private tickBoats(dt: number): void {
    this.boats.forEach((b, i) => {
      if (b.trip) {
        b.trip.t += dt;
        if (b.trip.t >= b.trip.dur) {
          const g = b.trip.ground;
          b.trip = null;
          b.haul = this.rollHaul(b, g);
          b.trips++;
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
    const pierJob = id !== 'master';
    if (!this.company || (pierJob && !this.pierOpen) || this.harbor[id] || this.money < u.price) return false;
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

  /**
   * Pier staff at work: the Fish Seller sells the crate every minute and your
   * bag once it's full; the Bait Supplier tops each fisherman up (at a markup);
   * the Manager picks everyone's bait and spends within budget on training
   * and rods, cheapest first.
   */
  private tickHarbor(dt: number): void {
    if (this.harbor.seller) {
      if ((this.buyerClock += dt) >= 60) { this.buyerClock = 0; this.sellCrate(HARBOR_UPGRADES.seller.fee); }
      if (this.bag.length >= SELLER_BAG) {
        const total = Math.round(this.bagValue() * (1 - HARBOR_UPGRADES.seller.fee));
        this.bag = [];
        this.money += total;
        this.earned += total;
        this.sellerNews += total;
      }
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
    if (this.harbor.manager) {
      if ((this.managerClock += dt) >= 3) {
        this.managerClock = 0;
        for (const h of this.hands) h.bait = this.bestBait(h);
      }
      const share = MANAGER_BUDGETS[this.managerBudget]!;
      if (share > 0 && (this.trainClock += dt) >= 10) {
        this.trainClock = 0;
        // The cheapest useful upgrade across the crew, if it fits the budget.
        let pick: { cost: number; buy: () => boolean } | null = null;
        this.hands.forEach((_, i) => {
          const rod = this.handNextRod(i), train = this.handTrainCost(i);
          if (rod && (!pick || rod.price < pick.cost)) pick = { cost: rod.price, buy: () => this.upgradeHandRod(i) };
          if (train !== null && (!pick || train < pick.cost)) pick = { cost: train, buy: () => this.trainHand(i) };
        });
        const chosen = pick as { cost: number; buy: () => boolean } | null;
        if (chosen && chosen.cost <= this.money * share) chosen.buy();
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
    this.sellerNews = 0;
    return Math.round(this.money - before);
  }

  // ---------- hired fishermen on the wide pier ----------

  /** The wide pier (and hiring) opens with your first boat. */
  get pierOpen(): boolean {
    return this.boats.length > 0;
  }

  /** Fishing spots on the pier right now. */
  get pierSpots(): number {
    return Math.min(HANDS_MAX, this.pierSections * PIER_SPOTS);
  }

  nextHandCost(): number | null {
    return this.pierOpen && this.hands.length < this.pierSpots ? handCost(this.hands.length) : null;
  }

  nextPierSection(): number | null {
    return this.pierOpen && this.pierSections < PIER_SECTIONS.length ? PIER_SECTIONS[this.pierSections]! : null;
  }

  buyPierSection(): boolean {
    const price = this.nextPierSection();
    if (price === null || this.money < price) return false;
    this.money -= price;
    this.pierSections++;
    return true;
  }

  /**
   * The most profitable bait a fisherman can use right now: what they'd earn
   * per minute with it (catch value minus bait price, over the time a cast
   * takes). Only bait you have, unless the Bait Supplier can bring it.
   */
  bestBait(h: Hand): BaitId {
    let best: BaitId = 'worm', bestRate = -Infinity;
    const tier = RODS[h.rod]!.tier;
    for (const b of BAITS) {
      if (this.baitCount(b.id) <= 0 && !(this.harbor.supplier && b.price > 0)) continue;
      const odds = this.handOdds({ ...h, bait: b.id });
      const ev = odds.reduce((s, o) => s + (o.tooStrong ? 0 : o.p * o.fish.price), 0) * b.size;
      const cost = b.price * (this.harbor.supplier ? 1 + HARBOR_UPGRADES.supplier.fee : 1);
      const secs = ((BITE_WAIT[0] + BITE_WAIT[1]) / 2) * b.wait * (1 - 0.06 * h.rod) + 4.5;
      const rate = (ev - cost) / secs;
      if (rate > bestRate && tier >= 1) { bestRate = rate; best = b.id; }
    }
    return best;
  }

  /** Index into MANAGER_BUDGETS (Off / 5% / 10% / 25%). */
  setManagerBudget(i: number): void {
    this.managerBudget = clamp(i, 0, MANAGER_BUDGETS.length - 1);
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
  sellCrate(fee = 0): number {
    const wage = this.harbor.manager ? HARBOR_UPGRADES.manager.fee : 0;
    const total = Math.round(this.crateValue() * (1 - fee) * (1 - wage));
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
        h.line = { type: 'bite', t: 0, window: REEL_WINDOW, fish, tooStrong, bait: line.bait };
        const slow = Math.max(HAND_REACT[0], HAND_REACT[1] - HAND_REACT_PER_LEVEL * (h.skill - 1));
        h.react = HAND_REACT[0] + this.rng() * (slow - HAND_REACT[0]);
      } else if (line.type === 'bite' && line.t >= (h.react ?? 0)) {
        if (h.react! > line.window) h.line = { type: 'result', t: 0, outcome: 'escaped', fish: line.fish };
        else if (line.tooStrong) h.line = { type: 'result', t: 0, outcome: 'snapped', fish: line.fish };
        else h.line = { type: 'result', t: 0, outcome: 'caught', fish: line.fish, caught: this.land(line.fish, true, line.bait) };
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
      case 'treeUnlocked': return this.fishTree.length;
      case 'treeTiers': return ([1, 2, 3, 4, 5] as Tier[]).filter((t) => TREE_FISH.filter((f) => f.tier === t).every((f) => this.fishTree.includes(f.id))).length;
      case 'treeRiver': return TREE_FISH.filter((f) => f.side === 'river' && this.journal[f.id]).length;
      case 'treeSea': return TREE_FISH.filter((f) => f.side === 'sea' && this.seaSeen.includes(f.id)).length;
      case 'treeRiverTier': return Math.max(0, ...TREE_FISH.filter((f) => f.side === 'river' && this.journal[f.id]).map((f) => f.tier));
      case 'treeSeaTier': return Math.max(0, ...TREE_FISH.filter((f) => f.side === 'sea' && this.seaSeen.includes(f.id)).map((f) => f.tier));
      case 'retired': return this.retirements;
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
      pierSections: this.pierSections, managerBudget: this.managerBudget,
      pearls: this.pearls, fishTree: this.fishTree, retirements: this.retirements, seaSeen: this.seaSeen,
      exoticHold: this.exoticHold, listings: this.listings, wanted: this.wanted, nextExoticId: this.nextExoticId,
      hands: this.hands.map((h) => ({ ...h, line: { type: 'idle' as const }, react: null })), crate: this.crate,
    };
  }
}
