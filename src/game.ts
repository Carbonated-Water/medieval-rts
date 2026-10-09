import {
  BITE_WAIT, FISH, REEL_WINDOW, REEL_WINDOW_PER_SKILL, RODS, SKILL_MAX, SKILL_TIER_BONUS, START_MONEY,
  TIERS, TOO_STRONG_SHARE, skillCost, type FishDef, type Tier,
} from './data';

export interface Catch {
  id: number;
  fish: string; // FishDef id
  kg: number;
  value: number;
}

export interface JournalEntry { count: number; bestKg: number }

/** Everything that gets saved. */
export interface SaveData {
  money: number;
  rod: number; // index into RODS
  skill: number;
  bag: Catch[];
  journal: Record<string, JournalEntry>;
  nextId: number;
  earned: number;
}

const CAST_SECONDS = 0.6;
const RESULT_SECONDS = 2.2;

/**
 * The fishing line's state. Cast → wait for a bite → the bobber dips and
 * you have a short window to reel. Reeling early scares the fish, late lets
 * it go; a fish too strong for your rod snaps the line.
 */
export type Line =
  | { type: 'idle' }
  | { type: 'casting'; t: number }
  | { type: 'waiting'; t: number; biteAt: number }
  | { type: 'bite'; t: number; window: number; fish: FishDef; tooStrong: boolean }
  | { type: 'result'; t: number; outcome: 'caught' | 'escaped' | 'snapped' | 'scared'; fish?: FishDef; caught?: Catch };

export const fishById = (id: string): FishDef => FISH.find((f) => f.id === id)!;

export class Game {
  money = START_MONEY;
  rod = 0;
  skill = 1;
  bag: Catch[] = [];
  journal: Record<string, JournalEntry> = {};
  /** Lifetime earnings. */
  earned = 0;
  line: Line = { type: 'idle' };
  private nextId = 1;

  constructor(save?: Partial<SaveData>, private rng: () => number = Math.random) {
    if (save) Object.assign(this, { ...save, nextId: save.nextId ?? 1 });
    this.rod = Math.max(0, Math.min(RODS.length - 1, this.rod));
    this.skill = Math.max(1, Math.min(SKILL_MAX, this.skill));
  }

  get rodTier(): Tier {
    return RODS[this.rod]!.tier;
  }

  // ---------- odds ----------

  /** How likely each landable fish is per bite (at a given skill level, default yours). */
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

  private weight(f: FishDef, skill = this.skill): number {
    return TIERS[f.tier].weight * f.rarity * Math.pow(1 + SKILL_TIER_BONUS * (skill - 1), f.tier - 1);
  }

  /** Which fish bites. Sometimes one a tier above the rod, which will snap the line. */
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

  /** Bites come sooner with skill and better rods. */
  biteWait(): number {
    const [lo, hi] = BITE_WAIT;
    const speed = (1 - 0.022 * (this.skill - 1)) * (1 - 0.06 * this.rod);
    return (lo + this.rng() * (hi - lo)) * speed;
  }

  reelWindow(): number {
    return REEL_WINDOW + REEL_WINDOW_PER_SKILL * (this.skill - 1);
  }

  // ---------- fishing ----------

  /** Throw the line. Only when it's idle or showing a result. */
  cast(): boolean {
    if (this.line.type !== 'idle' && this.line.type !== 'result') return false;
    this.line = { type: 'casting', t: 0 };
    return true;
  }

  /** Pull in. What happens depends on when. */
  reel(): Line['type'] {
    const line = this.line;
    if (line.type === 'waiting' || line.type === 'casting') {
      this.line = { type: 'result', t: 0, outcome: 'scared' };
    } else if (line.type === 'bite') {
      if (line.tooStrong) this.line = { type: 'result', t: 0, outcome: 'snapped', fish: line.fish };
      else this.line = { type: 'result', t: 0, outcome: 'caught', fish: line.fish, caught: this.land(line.fish) };
    }
    return this.line.type;
  }

  /** Put the line away (walking off, opening the market). */
  stopFishing(): void {
    this.line = { type: 'idle' };
  }

  tick(dt: number): void {
    const line = this.line;
    if (line.type === 'idle') return;
    line.t += dt;
    if (line.type === 'casting' && line.t >= CAST_SECONDS) {
      this.line = { type: 'waiting', t: 0, biteAt: this.biteWait() };
    } else if (line.type === 'waiting' && line.t >= line.biteAt) {
      const { fish, tooStrong } = this.rollFish();
      this.line = { type: 'bite', t: 0, window: this.reelWindow(), fish, tooStrong };
    } else if (line.type === 'bite' && line.t >= line.window) {
      this.line = { type: 'result', t: 0, outcome: 'escaped', fish: line.fish };
    } else if (line.type === 'result' && line.t >= RESULT_SECONDS) {
      this.line = { type: 'idle' };
    }
  }

  /** A fish is landed: weigh it, price it, bag it, log it. */
  private land(fish: FishDef): Catch {
    // Weight varies ±40% around the species' typical size; price follows weight.
    const ratio = 0.6 + this.rng() * 0.8;
    const kg = Math.round(fish.kg * ratio * 100) / 100;
    const value = Math.max(1, Math.round(fish.price * ratio));
    const c: Catch = { id: this.nextId++, fish: fish.id, kg, value };
    this.bag.push(c);
    const j = this.journal[fish.id] ?? { count: 0, bestKg: 0 };
    this.journal[fish.id] = { count: j.count + 1, bestKg: Math.max(j.bestKg, kg) };
    return c;
  }

  // ---------- market ----------

  sell(catchId: number): number {
    const i = this.bag.findIndex((c) => c.id === catchId);
    if (i < 0) return 0;
    const [c] = this.bag.splice(i, 1);
    this.money += c!.value;
    this.earned += c!.value;
    return c!.value;
  }

  sellAll(): number {
    const total = this.bag.reduce((s, c) => s + c.value, 0);
    this.money += total;
    this.earned += total;
    this.bag = [];
    return total;
  }

  bagValue(): number {
    return this.bag.reduce((s, c) => s + c.value, 0);
  }

  /** Buy the next rod up (rods must be bought in order). */
  buyRod(level: number): boolean {
    const rod = RODS[level];
    if (!rod || level !== this.rod + 1 || this.money < rod.price) return false;
    this.money -= rod.price;
    this.rod = level;
    return true;
  }

  nextSkillCost(): number | null {
    return this.skill >= SKILL_MAX ? null : skillCost(this.skill);
  }

  upgradeSkill(): boolean {
    const cost = this.nextSkillCost();
    if (cost === null || this.money < cost) return false;
    this.money -= cost;
    this.skill++;
    return true;
  }

  save(): SaveData {
    return { money: this.money, rod: this.rod, skill: this.skill, bag: this.bag, journal: this.journal, nextId: this.nextId, earned: this.earned };
  }
}
