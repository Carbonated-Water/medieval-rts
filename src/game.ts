import {
  BAIT, BITE_WAIT, BOOTS, CLOTHES, DEV_MULTIPLIER, FISH, GEAR, HAGGLE_PER_LEVEL, HOLDERS, MIN_BITE_WAIT, REEL_WINDOW,
  REFLEX_PER_LEVEL, RODS, SKILLS, SKILL_TIER_BONUS, START_MONEY, STRENGTH_PER_LEVEL, TIERS, TOO_STRONG_SHARE,
  VARIANTS, VARIANT_ORDER, type FishDef, type GearKind, type SkillId, type Tier, type Variant,
} from './data';

export interface Catch {
  id: number;
  fish: string; // FishDef id
  kg: number;
  /** Base price (weight, clothes and variant included); Haggling and dev mode apply at sale. */
  value: number;
  variant?: Variant;
}

export interface JournalEntry { count: number; bestKg: number; variants?: Partial<Record<Variant, number>> }

/** Everything that gets saved. Fields added later default sensibly for old saves. */
export interface SaveData {
  money: number;
  rod: number;
  holders: number;
  bait: number;
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
  | { type: 'casting'; t: number }
  | { type: 'waiting'; t: number; biteAt: number }
  | { type: 'bite'; t: number; window: number; fish: FishDef; tooStrong: boolean }
  | { type: 'result'; t: number; outcome: 'caught' | 'escaped' | 'snapped' | 'scared'; fish?: FishDef; caught?: Catch; strong?: boolean };

export const fishById = (id: string): FishDef => FISH.find((f) => f.id === id)!;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

export class Game {
  money = START_MONEY;
  rod = 0;
  holders = 0;
  bait = 0;
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
  private nextId = 1;

  constructor(save?: Partial<SaveData>, private rng: () => number = Math.random) {
    if (save) Object.assign(this, { ...save, nextId: save.nextId ?? 1 });
    this.rod = clamp(this.rod, 0, RODS.length - 1);
    this.holders = clamp(this.holders, 0, HOLDERS.length - 1);
    this.syncLines();
    this.bait = clamp(this.bait, 0, BAIT.length - 1);
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

  /** How likely each landable fish is per bite (at a given fishing level, default yours). */
  odds(skill = this.skill): { fish: FishDef; p: number }[] {
    const weights = FISH.filter((f) => f.tier <= this.rodTier).map((f) => ({ fish: f, w: this.weight(f, skill) }));
    const total = weights.reduce((s, x) => s + x.w, 0);
    const landable = this.rodTier < 5 ? 1 - TOO_STRONG_SHARE : 1;
    return weights.map(({ fish, w }) => ({ fish, p: (w / total) * landable }));
  }

  /** Share of bites per tier (landable tiers only), for the UI. */
  tierOdds(skill = this.skill): Record<number, number> {
    const out: Record<number, number> = {};
    for (const { fish, p } of this.odds(skill)) out[fish.tier] = (out[fish.tier] ?? 0) + p;
    return out;
  }

  /** Bite weight: tier base × rarity, boosted per tier step by fishing skill and bait. */
  private weight(f: FishDef, skill = this.skill): number {
    const perStep = (1 + SKILL_TIER_BONUS * (skill - 1)) * (1 + BAIT[this.bait]!.lure);
    return TIERS[f.tier].weight * f.rarity * Math.pow(perStep, f.tier - 1);
  }

  /** Which fish bites. Sometimes one a tier above the rod. */
  rollFish(): { fish: FishDef; tooStrong: boolean } {
    if (this.rodTier < 5 && this.rng() < TOO_STRONG_SHARE) {
      const strong = FISH.filter((f) => f.tier === this.rodTier + 1);
      return { fish: this.pick(strong, (f) => f.rarity), tooStrong: true };
    }
    return { fish: this.pick(FISH.filter((f) => f.tier <= this.rodTier), (f) => this.weight(f)), tooStrong: false };
  }

  private pick(list: FishDef[], w: (f: FishDef) => number): FishDef {
    const total = list.reduce((s, f) => s + w(f), 0);
    let r = this.rng() * total;
    for (const f of list) { r -= w(f); if (r <= 0) return f; }
    return list[list.length - 1]!;
  }

  /** Bites come sooner with better bait and rods. */
  biteWait(): number {
    const [lo, hi] = BITE_WAIT;
    const wait = (lo + this.rng() * (hi - lo)) * BAIT[this.bait]!.wait * (1 - 0.06 * this.rod);
    return Math.max(MIN_BITE_WAIT, wait);
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

  /** Throw every line that's out of the water (idle or showing a result). Staggered a little. */
  cast(): boolean {
    let n = 0;
    this.lines.forEach((line, i) => {
      if (line.type !== 'idle' && line.type !== 'result') return;
      this.lines[i] = { type: 'casting', t: -0.18 * n++ };
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
    this.lines.forEach((line, i) => {
      if (line.type === 'idle') return;
      line.t += dt;
      if (line.type === 'casting' && line.t >= CAST_SECONDS) {
        this.lines[i] = { type: 'waiting', t: 0, biteAt: this.biteWait() };
      } else if (line.type === 'waiting' && line.t >= line.biteAt) {
        const { fish, tooStrong } = this.rollFish();
        this.lines[i] = { type: 'bite', t: 0, window: this.reelWindow(), fish, tooStrong };
      } else if (line.type === 'bite' && line.t >= line.window) {
        this.lines[i] = { type: 'result', t: 0, outcome: 'escaped', fish: line.fish };
      } else if (line.type === 'result' && line.t >= RESULT_SECONDS) {
        this.lines[i] = { type: 'idle' };
      }
    });
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

  save(): SaveData {
    return {
      money: this.money, rod: this.rod, holders: this.holders, bait: this.bait, clothes: this.clothes, boots: this.boots,
      skill: this.skill, reflexes: this.reflexes, haggling: this.haggling, strength: this.strength, dev: this.dev,
      bag: this.bag, journal: this.journal, nextId: this.nextId, earned: this.earned,
    };
  }
}
