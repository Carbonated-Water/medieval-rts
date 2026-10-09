import { describe, expect, it } from 'vitest';
import { FISH, RODS, SKILL_MAX, TOO_STRONG_SHARE, skillCost } from './data';
import { Game, fishById } from './game';

/** Deterministic RNG for tests. */
function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const tick = (g: Game, s: number) => { for (let t = 0; t < s; t += 0.02) g.tick(0.02); };
/** Cast and wait until the bobber dips. */
const waitForBite = (g: Game) => {
  g.cast();
  for (let i = 0; i < 2000 && g.line.type !== 'bite'; i++) g.tick(0.02);
};

describe('data', () => {
  it('has 20 fish, four per tier, and five rods in tier order', () => {
    expect(FISH).toHaveLength(20);
    for (const t of [1, 2, 3, 4, 5]) expect(FISH.filter((f) => f.tier === t)).toHaveLength(4);
    expect(RODS.map((r) => r.tier)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(FISH.map((f) => f.id)).size).toBe(20);
  });

  it('higher tiers are worth more and skill gets pricier', () => {
    const best = (t: number) => Math.max(...FISH.filter((f) => f.tier === t).map((f) => f.price));
    const worst = (t: number) => Math.min(...FISH.filter((f) => f.tier === t).map((f) => f.price));
    for (const t of [1, 2, 3, 4]) expect(worst(t + 1)).toBeGreaterThan(best(t));
    for (let l = 1; l < SKILL_MAX; l++) expect(skillCost(l + 1)).toBeGreaterThan(skillCost(l));
  });
});

describe('odds', () => {
  it('a rod only lands fish up to its tier, and odds sum to the landable share', () => {
    const g = new Game({ rod: 1 }, rng());
    const odds = g.odds();
    expect(odds.every((o) => o.fish.tier <= 2)).toBe(true);
    expect(odds.reduce((s, o) => s + o.p, 0)).toBeCloseTo(1 - TOO_STRONG_SHARE);
    const legend = new Game({ rod: 4 }, rng());
    expect(legend.odds().reduce((s, o) => s + o.p, 0)).toBeCloseTo(1);
  });

  it('skill shifts the odds toward rarer tiers', () => {
    const low = new Game({ rod: 4, skill: 1 }).tierOdds();
    const high = new Game({ rod: 4, skill: SKILL_MAX }).tierOdds();
    expect(high[5]!).toBeGreaterThan(low[5]! * 5);
    expect(high[1]!).toBeLessThan(low[1]!);
  });

  it('rolls match the odds over many casts', () => {
    const g = new Game({ rod: 2, skill: 5 }, rng(7));
    const n = 20000;
    let tooStrong = 0;
    const tiers: Record<number, number> = {};
    for (let i = 0; i < n; i++) {
      const r = g.rollFish();
      if (r.tooStrong) { tooStrong++; expect(r.fish.tier).toBe(4); continue; }
      tiers[r.fish.tier] = (tiers[r.fish.tier] ?? 0) + 1;
    }
    expect(tooStrong / n).toBeCloseTo(TOO_STRONG_SHARE, 1);
    const expected = g.tierOdds();
    for (const t of [1, 2, 3]) expect(tiers[t]! / n).toBeCloseTo(expected[t]!, 1);
  });
});

describe('fishing', () => {
  it('cast → wait → bite → reel catches the fish and bags it', () => {
    const g = new Game({ rod: 4 }, rng(3)); // top rod: nothing snaps
    waitForBite(g);
    expect(g.line.type).toBe('bite');
    const fish = (g.line as { fish: { id: string } }).fish;
    expect(g.reel()).toBe('result');
    expect(g.line).toMatchObject({ outcome: 'caught' });
    expect(g.bag).toHaveLength(1);
    expect(g.bag[0]!.fish).toBe(fish.id);
    expect(g.journal[fish.id]!.count).toBe(1);
  });

  it('reeling before the bite scares the fish', () => {
    const g = new Game({}, rng());
    g.cast();
    tick(g, 0.8);
    g.reel();
    expect(g.line).toMatchObject({ type: 'result', outcome: 'scared' });
    expect(g.bag).toHaveLength(0);
  });

  it('waiting too long after the bite lets it escape', () => {
    const g = new Game({}, rng());
    waitForBite(g);
    tick(g, g.reelWindow() + 0.1);
    expect(g.line).toMatchObject({ type: 'result', outcome: 'escaped' });
  });

  it('a fish too strong for the rod snaps the line', () => {
    const g = new Game({ rod: 0 }, rng());
    g.cast();
    tick(g, 1);
    g.line = { type: 'bite', t: 0, window: 1, fish: fishById('trout'), tooStrong: true };
    g.reel();
    expect(g.line).toMatchObject({ outcome: 'snapped' });
    expect(g.bag).toHaveLength(0);
  });

  it('skill makes bites faster and the reel window wider', () => {
    const avgWait = (skill: number) => {
      const g = new Game({ skill }, rng(11));
      let s = 0;
      for (let i = 0; i < 500; i++) s += g.biteWait();
      return s / 500;
    };
    expect(avgWait(SKILL_MAX)).toBeLessThan(avgWait(1) * 0.75);
    expect(new Game({ skill: SKILL_MAX }).reelWindow()).toBeGreaterThan(new Game({ skill: 1 }).reelWindow());
  });
});

describe('market', () => {
  it('sells one fish or the whole bag', () => {
    const g = new Game({ bag: [{ id: 1, fish: 'carp', kg: 3, value: 7 }, { id: 2, fish: 'perch', kg: 0.4, value: 4 }] });
    expect(g.sell(1)).toBe(7);
    expect(g.money).toBe(7);
    expect(g.sellAll()).toBe(4);
    expect(g.money).toBe(11);
    expect(g.bag).toHaveLength(0);
    expect(g.earned).toBe(11);
  });

  it('rods are bought in order and cost money', () => {
    const start = RODS[1]!.price + RODS[2]!.price - 1; // enough for Bamboo, then $1 short of Fiberglass
    const g = new Game({ money: start });
    expect(g.buyRod(2)).toBe(false); // must buy Bamboo first
    expect(g.buyRod(1)).toBe(true);
    expect(g.money).toBe(start - RODS[1]!.price);
    expect(g.rodTier).toBe(2);
    expect(g.buyRod(2)).toBe(false);
  });

  it('skill upgrades cost money and stop at the max', () => {
    const g = new Game({ money: 1e9 });
    const first = g.nextSkillCost()!;
    expect(g.upgradeSkill()).toBe(true);
    expect(g.money).toBe(1e9 - first);
    while (g.upgradeSkill());
    expect(g.skill).toBe(SKILL_MAX);
    expect(g.nextSkillCost()).toBeNull();
  });

  it('round-trips through save data', () => {
    const g = new Game({ money: 500 }, rng());
    g.buyRod(1);
    waitForBite(g);
    g.reel();
    const copy = new Game(JSON.parse(JSON.stringify(g.save())));
    expect(copy.save()).toEqual(g.save());
  });
});
