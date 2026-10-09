import { describe, expect, it } from 'vitest';
import {
  BAIT, BOOTS, CLOTHES, DEV_MULTIPLIER, FISH, HAGGLE_PER_LEVEL, HOLDERS, REFLEX_PER_LEVEL, RODS, SKILLS, SKILL_MAX, VARIANTS,
  STRENGTH_PER_LEVEL, TOO_STRONG_SHARE, skillCost,
} from './data';
import { Game, fishById, type Line } from './game';

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
  for (let i = 0; i < 2000 && g.lines[0]!.type !== 'bite'; i++) g.tick(0.02);
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
    expect(g.lines[0]!.type).toBe('bite');
    const fish = (g.lines[0] as { fish: { id: string } }).fish;
    g.reel();
    expect(g.lines[0]!.type).toBe('result');
    expect(g.lines[0]).toMatchObject({ outcome: 'caught' });
    expect(g.bag).toHaveLength(1);
    expect(g.bag[0]!.fish).toBe(fish.id);
    expect(g.journal[fish.id]!.count).toBe(1);
  });

  it('reeling before the bite scares the fish', () => {
    const g = new Game({}, rng());
    g.cast();
    tick(g, 0.8);
    g.reel();
    expect(g.lines[0]).toMatchObject({ type: 'result', outcome: 'scared' });
    expect(g.bag).toHaveLength(0);
  });

  it('waiting too long after the bite lets it escape', () => {
    const g = new Game({}, rng());
    waitForBite(g);
    tick(g, g.reelWindow() + 0.1);
    expect(g.lines[0]).toMatchObject({ type: 'result', outcome: 'escaped' });
  });

  it('a fish too strong for the rod snaps the line', () => {
    const g = new Game({ rod: 0 }, rng());
    g.cast();
    tick(g, 1);
    g.lines[0] = { type: 'bite', t: 0, window: 1, fish: fishById('trout'), tooStrong: true };
    g.reel();
    expect(g.lines[0]).toMatchObject({ outcome: 'snapped' });
    expect(g.bag).toHaveLength(0);
  });
});

describe('gear', () => {
  it('each line is bought in order, one level at a time, and costs money', () => {
    const start = RODS[1]!.price + RODS[2]!.price - 1; // enough for Bamboo, then $1 short of Fiberglass
    const g = new Game({ money: start });
    expect(g.nextGear('rod')!.name).toBe('Bamboo Rod');
    expect(g.buyGear('rod')).toBe(true);
    expect(g.money).toBe(start - RODS[1]!.price);
    expect(g.rodTier).toBe(2);
    expect(g.nextGear('rod')!.name).toBe('Fiberglass Rod');
    expect(g.buyGear('rod')).toBe(false); // can't afford
    const rich = new Game({ money: 1e9 });
    for (const kind of ['rod', 'bait', 'clothes', 'boots'] as const) {
      while (rich.buyGear(kind));
      expect(rich.nextGear(kind)).toBeNull();
    }
    expect(rich.gearLevel('boots')).toBe(BOOTS.length - 1);
  });

  it('better bait makes bites come sooner', () => {
    const avgWait = (bait: number) => {
      const g = new Game({ bait }, rng(11));
      let s = 0;
      for (let i = 0; i < 500; i++) s += g.biteWait();
      return s / 500;
    };
    expect(avgWait(BAIT.length - 1)).toBeLessThan(avgWait(0) * 0.5);
  });

  it('better bait also nudges the odds toward rare fish', () => {
    const plain = new Game({ rod: 4, bait: 0 }).tierOdds();
    const golden = new Game({ rod: 4, bait: BAIT.length - 1 }).tierOdds();
    expect(golden[5]!).toBeGreaterThan(plain[5]!);
  });

  it('clothes make catches bigger and pricier', () => {
    const avg = (clothes: number) => {
      const g = new Game({ rod: 4, clothes }, rng(5));
      for (let i = 0; i < 300; i++) { waitForBite(g); g.reel(); }
      return g.bag.reduce((s, c) => s + c.value / fishById(c.fish).price, 0) / g.bag.length;
    };
    expect(avg(CLOTHES.length - 1)).toBeGreaterThan(avg(0) * (1 + CLOTHES[CLOTHES.length - 1]!.size) * 0.9);
  });

  it('boots make you walk faster', () => {
    expect(new Game({ boots: BOOTS.length - 1 }).walkSpeed()).toBeCloseTo(1 + BOOTS[BOOTS.length - 1]!.speed);
    expect(new Game().walkSpeed()).toBe(1);
  });
});

describe('skills', () => {
  it('training costs money, rises in price and stops at the max', () => {
    for (const id of Object.keys(SKILLS) as (keyof typeof SKILLS)[]) {
      const g = new Game({ money: 1e9 });
      const first = g.nextSkillCost(id)!;
      expect(g.train(id)).toBe(true);
      expect(g.money).toBe(1e9 - first);
      expect(g.nextSkillCost(id)!).toBeGreaterThan(first);
      while (g.train(id));
      expect(g.level(id)).toBe(SKILLS[id].max);
      expect(g.nextSkillCost(id)).toBeNull();
    }
    expect(SKILL_MAX).toBe(SKILLS.fishing.max);
  });

  it('reflexes widen the reel window', () => {
    expect(new Game({ reflexes: 10 }).reelWindow()).toBeCloseTo(new Game().reelWindow() + 10 * REFLEX_PER_LEVEL);
  });

  it('haggling raises sale prices', () => {
    const bag = [{ id: 1, fish: 'carp', kg: 3, value: 100 }];
    expect(new Game({ bag: [...bag], haggling: 10 }).sellAll()).toBe(Math.round(100 * (1 + 10 * HAGGLE_PER_LEVEL)));
  });

  it('strength can land a fish too strong for the rod', () => {
    let landed = 0;
    for (let s = 0; s < 400; s++) {
      const g = new Game({ rod: 0, strength: 10 }, rng(s + 1));
      g.cast();
      tick(g, 1);
      g.lines[0] = { type: 'bite', t: 0, window: 1, fish: fishById('trout'), tooStrong: true };
      g.reel();
      const res = g.lines[0] as Line; // reel() changed it; TS still thinks it's the bite we set
      if (res.type === 'result' && res.outcome === 'caught') { landed++; expect(res.strong).toBe(true); }
    }
    expect(landed / 400).toBeCloseTo(10 * STRENGTH_PER_LEVEL, 1);
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

  it('dev mode pays 20× per fish', () => {
    const g = new Game({ dev: true, bag: [{ id: 1, fish: 'carp', kg: 3, value: 7 }] });
    expect(g.bagValue()).toBe(7 * DEV_MULTIPLIER);
    expect(g.sellAll()).toBe(7 * DEV_MULTIPLIER);
  });

  it('old saves without the new fields still load', () => {
    const g = new Game({ money: 50, rod: 1, skill: 3, bag: [], journal: {}, nextId: 4, earned: 50 });
    expect(g.bait).toBe(0);
    expect(g.clothes).toBe(0);
    expect(g.boots).toBe(0);
    expect(g.reflexes).toBe(0);
    expect(g.dev).toBe(false);
    expect(g.rodTier).toBe(2);
  });

  it('round-trips through save data', () => {
    const g = new Game({ money: 5000 }, rng());
    g.buyGear('rod');
    g.buyGear('bait');
    g.train('haggling');
    waitForBite(g);
    g.reel();
    const copy = new Game(JSON.parse(JSON.stringify(g.save())));
    expect(copy.save()).toEqual(g.save());
  });
});

describe('multiple lines', () => {
  it('holders add lines; cast throws every idle line', () => {
    const g = new Game({ money: 1e9 });
    expect(g.lines).toHaveLength(1);
    while (g.buyGear('holders'));
    expect(g.lines).toHaveLength(HOLDERS[HOLDERS.length - 1]!.lines);
    expect(g.cast()).toBe(true);
    expect(g.lines.every((l) => l.type === 'casting')).toBe(true);
    expect(g.cast()).toBe(false); // all already out
  });

  it('each line bites on its own; the big button reels every biting line', () => {
    const g = new Game({ holders: 2, rod: 4 }, rng(9));
    g.cast();
    for (let i = 0; i < 2000 && !g.lines.some((l) => l.type === 'bite'); i++) g.tick(0.02);
    const biting = g.lines.filter((l) => l.type === 'bite').length;
    expect(biting).toBeGreaterThan(0);
    const waiting = g.lines.filter((l) => l.type === 'waiting' || l.type === 'casting').length;
    g.reel();
    expect(g.bag).toHaveLength(biting);
    // Lines that weren't biting are untouched.
    expect(g.lines.filter((l) => l.type === 'waiting' || l.type === 'casting')).toHaveLength(waiting);
  });

  it('reeling with nothing biting scares only one line', () => {
    const g = new Game({ holders: 3 }, rng(4));
    g.cast();
    tick(g, 0.9);
    g.reel();
    expect(g.lines.filter((l) => l.type === 'result' && l.outcome === 'scared')).toHaveLength(1);
    // The other three are still out (waiting, or mid-cast thanks to the stagger).
    expect(g.lines.filter((l) => l.type === 'waiting' || l.type === 'casting')).toHaveLength(3);
  });

  it('tapping one bobber reels just that line', () => {
    const g = new Game({ holders: 1, rod: 4 }, rng(2));
    g.cast();
    tick(g, 1);
    g.lines[1] = { type: 'bite', t: 0, window: 1, fish: fishById('carp'), tooStrong: false };
    g.reel(1);
    expect(g.lines[1]).toMatchObject({ type: 'result', outcome: 'caught' });
    expect(g.lines[0]!.type).toBe('waiting');
  });

  it('old saves without holders still get one line', () => {
    expect(new Game({ money: 5 }).lines).toHaveLength(1);
  });
});

describe('market', () => {
  it('sells one species at a time', () => {
    const g = new Game({ money: 0 });
    g.bag.push({ id: 1, fish: 'carp', kg: 2, value: 7 }, { id: 2, fish: 'perch', kg: 1, value: 3 }, { id: 3, fish: 'carp', kg: 3, value: 9, variant: 'golden' });
    const got = g.sellSpecies('carp');
    expect(got).toBe(g.money);
    expect(got).toBeGreaterThan(0);
    expect(g.bag.map((c) => c.fish)).toEqual(['perch']);
  });
});

describe('rare variants', () => {
  it('roll at roughly their chances', () => {
    const g = new Game({}, rng(17));
    const n = 200000;
    const seen: Record<string, number> = {};
    for (let i = 0; i < n; i++) { const v = g.rollVariant(); if (v) seen[v] = (seen[v] ?? 0) + 1; }
    expect(seen.giant! / n).toBeCloseTo(VARIANTS.giant.chance, 2);
    expect(seen.golden! / n).toBeCloseTo(VARIANTS.golden.chance, 2);
    expect(seen.shiny! / n).toBeCloseTo(VARIANTS.shiny.chance, 2);
  });

  it('are worth more and are logged in the journal', () => {
    const g = new Game({ rod: 4 }, rng(23));
    for (let i = 0; i < 3000; i++) { waitForBite(g); g.reel(); g.stopFishing(); }
    const ratio = (v?: string) => {
      const list = g.bag.filter((c) => c.variant === v);
      return list.reduce((s, c) => s + c.value / fishById(c.fish).price, 0) / list.length;
    };
    expect(ratio('golden')).toBeGreaterThan(ratio(undefined) * 4);
    expect(ratio('giant')).toBeGreaterThan(ratio(undefined) * 2);
    const goldens = g.bag.filter((c) => c.variant === 'golden').length;
    const logged = Object.values(g.journal).reduce((s, j) => s + (j.variants?.golden ?? 0), 0);
    expect(logged).toBe(goldens);
    expect(g.variantsFound()).toBeGreaterThan(0);
  });
});
