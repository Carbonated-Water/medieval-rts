import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS, AUTO, BAITS, BERTHS, BOATS, BOAT_REPEAT, BOOTS, CAPTAIN_WAGE, COMPANY_PRICE, CREW_BASE, GROUNDS, HANDS_MAX, handCost, PIER_SPOTS, PIER_SECTIONS, SELLER_BAG, SHELLFISH,
  COMPANY_UNLOCK_EARNED, LETTERS, TRACK_GROWTH, TRACK_MAX, TRACK_ORDER, CLOTHES, DEV_MULTIPLIER, FISH, HAGGLE_PER_LEVEL, HOLDERS, REFLEX_PER_LEVEL, RODS, SKILLS, SKILL_MAX, VARIANTS,
  MAX_GROUND_WORMS, START_WORMS, STRENGTH_PER_LEVEL, WORM_SPAWN_SECONDS, skillCost,
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
/** Cast and wait until the bobber dips (topping up worms so long tests never run dry). */
const waitForBite = (g: Game) => {
  if (g.baitCount('worm') < 10) g.baits.worm = 1e6;
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
  it('fish up to one tier above the rod can bite; the ones above it are too strong', () => {
    const g = new Game({ rod: 1 }, rng());
    const odds = g.odds();
    expect(odds.every((o) => o.fish.tier <= 3)).toBe(true);
    expect(odds.reduce((s, o) => s + o.p, 0)).toBeCloseTo(1);
    expect(odds.filter((o) => o.tooStrong).every((o) => o.fish.tier === 3)).toBe(true);
    const snap = odds.filter((o) => o.tooStrong).reduce((s, o) => s + o.p, 0);
    expect(snap).toBeGreaterThan(0.01);
    expect(snap).toBeLessThan(0.15);
    expect(new Game({ rod: 4 }, rng()).odds().some((o) => o.tooStrong)).toBe(false);
  });

  it('fishing level does not make snaps more common', () => {
    const snap = (skill: number) => new Game({ rod: 0, skill }).odds().filter((o) => o.tooStrong).reduce((s, o) => s + o.p, 0);
    expect(snap(SKILL_MAX)).toBeCloseTo(snap(1), 5);
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
    expect(tooStrong / n).toBeCloseTo(g.odds().filter((o) => o.tooStrong).reduce((s, o) => s + o.p, 0), 1);
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
    for (const kind of ['rod', 'holders', 'auto', 'clothes', 'boots'] as const) {
      while (rich.buyGear(kind));
      expect(rich.nextGear(kind)).toBeNull();
    }
    expect(rich.gearLevel('boots')).toBe(BOOTS.length - 1);
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
    expect(g.baitCount('worm')).toBe(START_WORMS);
    expect(g.baitSel).toBe('worm');
    expect(g.clothes).toBe(0);
    expect(g.boots).toBe(0);
    expect(g.reflexes).toBe(0);
    expect(g.dev).toBe(false);
    expect(g.rodTier).toBe(2);
  });

  it('round-trips through save data', () => {
    const g = new Game({ money: 5000 }, rng());
    g.buyGear('rod');
    g.buyBait('cricket', 5);
    g.selectBait('cricket');
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

describe('autofisher', () => {
  /** Run the autofisher as if standing on the dock for `s` seconds. */
  const autoRun = (g: Game, s: number) => { g.baits.worm = 1e6; for (let t = 0; t < s; t += 0.02) { g.tick(0.02); g.autoFish(); } };

  it('does nothing until bought', () => {
    const g = new Game({}, rng(3));
    autoRun(g, 30);
    expect(g.lines[0]!.type).toBe('idle');
    expect(g.bag).toHaveLength(0);
  });

  it('casts and reels on its own, every line', () => {
    const g = new Game({ auto: 1, holders: 3 }, rng(5));
    autoRun(g, 300);
    expect(g.bag.length).toBeGreaterThan(40);
  });

  it('higher levels catch more', () => {
    const catches = (auto: number) => { const g = new Game({ auto }, rng(7)); autoRun(g, 1200); return g.bag.length; };
    expect(catches(4)).toBeGreaterThan(catches(1) * 1.3);
  });

  it('is bought in order like other gear', () => {
    const g = new Game({ money: AUTO[1]!.price + AUTO[2]!.price - 1 });
    expect(g.buyGear('auto')).toBe(true);
    expect(g.buyGear('auto')).toBe(false);
    expect(g.save().auto).toBe(1);
  });
});

describe('achievements', () => {
  it('unlock from progress and pay out once', () => {
    const g = new Game({ money: 0 }, rng(11));
    expect(g.claimable()).toHaveLength(0);
    waitForBite(g); g.reel();
    const first = ACHIEVEMENTS.find((a) => a.id === 'catch1')!;
    expect(g.claimable().map((a) => a.id)).toContain('catch1');
    expect(g.claim('catch1')).toBe(first.reward);
    expect(g.money).toBe(first.reward);
    expect(g.claim('catch1')).toBe(0);
    expect(new Game(g.save()).claimed).toContain('catch1');
  });

  it('claim all collects every ready reward', () => {
    const g = new Game({ money: 0, holders: 3, auto: 1, skill: 10 });
    const ready = g.claimable();
    expect(ready.map((a) => a.id).sort()).toEqual(['auto', 'fishing10', 'lines4']);
    expect(g.claim()).toBe(ready.reduce((s, a) => s + a.reward, 0));
    expect(g.claimable()).toHaveLength(0);
  });

  it('track the highest tier and variants from the journal', () => {
    const g = new Game({ journal: { salmon: { count: 1, bestKg: 3, variants: { golden: 2 } } } });
    expect(g.stat('tier')).toBe(fishById('salmon').tier);
    expect(g.stat('golden')).toBe(2);
    expect(g.stat('catches')).toBe(1);
  });
});

describe('bait', () => {
  it('every cast uses one bait per line', () => {
    const g = new Game({ holders: 2 }, rng(3));
    expect(g.baitCount('worm')).toBe(START_WORMS);
    g.cast();
    expect(g.baitCount('worm')).toBe(START_WORMS - 3);
    expect(g.lines.every((l) => l.type === 'casting' && l.bait === 'worm')).toBe(true);
  });

  it("you can't cast without bait; lines only go out while it lasts", () => {
    const g = new Game({ holders: 3, baits: { worm: 2 } }, rng(4));
    expect(g.cast()).toBe(true);
    expect(g.lines.filter((l) => l.type === 'casting')).toHaveLength(2);
    expect(g.activeBait).toBeNull();
    g.stopFishing();
    expect(g.cast()).toBe(false);
  });

  it('runs down to the next cheaper bait when the chosen one is gone', () => {
    const g = new Game({ baits: { worm: 5, shiner: 1 }, baitSel: 'leech' }, rng(5));
    expect(g.activeBait).toBe('shiner');
    g.cast();
    expect(g.lines[0]).toMatchObject({ bait: 'shiner' });
    g.stopFishing();
    expect(g.activeBait).toBe('worm');
  });

  it('is bought at the shop (worms are not for sale)', () => {
    const g = new Game({ money: 100 });
    const leech = BAITS.find((b) => b.id === 'leech')!;
    expect(g.buyBait('leech', 3)).toBe(true);
    expect(g.money).toBe(100 - 3 * leech.price);
    expect(g.baitCount('leech')).toBe(3);
    expect(g.buyBait('worm', 1)).toBe(false);
    expect(g.buyBait('gold', 10)).toBe(false);
  });

  it('pricier bait brings rarer fish and quicker bites', () => {
    const g = new Game({ rod: 4, skill: 5 }, rng(6));
    expect(g.tierOdds(5, 'gold')[5]!).toBeGreaterThan(g.tierOdds(5, 'worm')[5]! * 10);
    const avgWait = (bait: 'worm' | 'gold') => { let s = 0; for (let i = 0; i < 500; i++) s += g.biteWait(bait); return s / 500; };
    expect(avgWait('gold')).toBeLessThan(avgWait('worm') * 0.5);
  });

  it('worms turn up on the bank over time and can be dug up', () => {
    const g = new Game({ baits: {} }, rng(8));
    tick(g, WORM_SPAWN_SECONDS * (MAX_GROUND_WORMS + 3));
    expect(g.groundWorms).toHaveLength(MAX_GROUND_WORMS);
    expect(new Set(g.groundWorms.map((w) => w.spot)).size).toBe(MAX_GROUND_WORMS);
    const n = g.pickWorm(g.groundWorms[0]!.id);
    expect(n).toBeGreaterThanOrEqual(2);
    expect(g.baitCount('worm')).toBe(n);
    expect(g.groundWorms).toHaveLength(MAX_GROUND_WORMS - 1);
  });

  it('the autofisher stops when the bait runs out', () => {
    const g = new Game({ auto: 4, baits: { worm: 3 } }, rng(9));
    for (let t = 0; t < 120; t += 0.02) { g.tick(0.02); g.autoFish(); }
    expect(g.baitCount('worm')).toBe(0);
    expect(g.lines[0]!.type).toBe('idle');
  });

  it('old saves: bait upgrades become a stock of bait; fishing goes to 25', () => {
    const g = new Game({ bait: 3 } as never);
    expect(g.baitCount(BAITS[3]!.id)).toBe(25);
    expect(SKILLS.fishing.max).toBe(25);
  });
});

describe('fishing company', () => {
  it('letters arrive once each as earnings grow; the last one reveals the harbor', () => {
    const g = new Game({ earned: 0 });
    expect(g.takeLetters()).toEqual([]);
    g.earned = 12000;
    expect(g.takeLetters()).toEqual([LETTERS[0]!.text, LETTERS[1]!.text]);
    expect(g.takeLetters()).toEqual([]);
    expect(g.companyRevealed).toBe(false);
    g.earned = COMPANY_UNLOCK_EARNED;
    expect(g.companyRevealed).toBe(true);
    expect(g.takeLetters()).toEqual([LETTERS[2]!.text, LETTERS[3]!.text]);
  });

  it('saves already past the reveal only get the last letter', () => {
    const g = new Game({ earned: 400000 });
    expect(g.takeLetters()).toEqual([LETTERS[LETTERS.length - 1]!.text]);
  });

  it("can't be bought before the reveal or without the money", () => {
    expect(new Game({ money: 1e9, earned: 1000 }).buyCompany()).toBe(false);
    expect(new Game({ money: COMPANY_PRICE - 1, earned: 30000 }).buyCompany()).toBe(false);
    const g = new Game({ money: COMPANY_PRICE, earned: 30000 });
    expect(g.buyCompany()).toBe(true);
    expect(g.money).toBe(0);
    expect(g.company).toBe(true);
  });

  it('round-trips through save data, and old saves have no company', () => {
    const g = new Game({ money: 1e6, earned: 30000 }, rng(14));
    g.buyCompany(); g.buyBoat(); g.hireCrew(0); g.upgradeTrack(0, 'engine'); g.sendBoat(0); tick(g, 5);
    const { savedAt: _a, ...saved } = g.save();
    const { savedAt: _b, ...again } = new Game(JSON.parse(JSON.stringify(g.save()))).save();
    expect(again).toEqual(saved);
    const old = new Game({ money: 5 });
    expect(old.company).toBe(false);
    expect(old.boats).toEqual([]);
  });

  it('boats from before upgrade tracks keep their gear and crew', () => {
    const g = new Game({ company: true, boats: [{ type: 'net', net: 2, crew: 3, trip: null, haul: null }] } as never);
    expect(g.boats[0]).toMatchObject({ crew: 3, ground: 'coast', tracks: { gear: 2, hull: 0 } });
  });
});

describe('the fleet', () => {
  const owner = (money = 1e9) => { const g = new Game({ money, earned: 30000 }, rng(41)); g.buyCompany(); return g; };

  it('berths limit the fleet; each extra boat of a kind costs more', () => {
    const g = owner();
    expect(g.berthCount).toBe(BERTHS[0]!.boats);
    expect(g.boatPrice('net')).toBe(BOATS.net.price);
    expect(g.buyBoat('net')).toBe(true);
    expect(g.boatPrice('net')).toBe(BOATS.net.price * (1 + BOAT_REPEAT));
    expect(g.buyBoat('net')).toBe(true);
    expect(g.boatName(1)).toBe('Net Boat 2');
    expect(g.buyBoat('lobster')).toBe(true);
    expect(g.buyBoat('sword')).toBe(false); // berths full
    expect(g.buyBerth()).toBe(true);
    expect(g.buyBoat('sword')).toBe(true);
  });

  it('upgrade tracks: rising costs, five levels, each doing its job', () => {
    const g = owner();
    g.buyBoat('net');
    const b = g.boats[0]!;
    const c0 = g.nextTrackCost(0, 'hull')!, haul0 = g.haulSize(b), trip0 = g.tripSeconds(b);
    expect(g.upgradeTrack(0, 'hull')).toBe(true);
    expect(g.nextTrackCost(0, 'hull')!).toBeCloseTo(c0 * TRACK_GROWTH, -2);
    expect(g.crewMax(b)).toBe(CREW_BASE + 1);
    expect(g.haulSize(b)).toBeGreaterThan(haul0);
    g.upgradeTrack(0, 'engine');
    expect(g.tripSeconds(b)).toBeLessThan(trip0);
    for (const id of TRACK_ORDER) while (g.upgradeTrack(0, id));
    expect(Object.values(b.tracks).every((l) => l === TRACK_MAX)).toBe(true);
    expect(g.nextTrackCost(0, 'gear')).toBeNull();
  });

  it('farther grounds need engine, hull and sonar', () => {
    const g = owner();
    g.buyBoat('net');
    expect(g.setGround(0, 'reef')).toBe(false);
    g.upgradeTrack(0, 'engine');
    expect(g.setGround(0, 'reef')).toBe(true);
    expect(g.setGround(0, 'deep')).toBe(false);
    const deep = GROUNDS.find((x) => x.id === 'deep')!;
    for (const [id, lvl] of Object.entries(deep.need)) while (g.boats[0]!.tracks[id as never] < lvl!) g.upgradeTrack(0, id as never);
    expect(g.setGround(0, 'deep')).toBe(true);
  });

  it('trips bring back the right catch; farther grounds are worth far more', () => {
    const value = (ground: 'coast' | 'deep') => {
      const g = owner();
      g.buyBoat('lobster');
      for (const id of TRACK_ORDER) for (let k = 0; k < 4; k++) g.upgradeTrack(0, id);
      g.boats[0]!.tracks.captain = 0; // no wages, hand-sent
      g.setGround(0, ground);
      let total = 0;
      for (let k = 0; k < 30; k++) {
        g.sendBoat(0);
        tick(g, g.boats[0]!.trip!.dur + 0.1);
        expect(g.boats[0]!.haul!.every((h) => SHELLFISH.some((x) => x.id === h.fish))).toBe(true);
        total += g.collectHaul(0);
      }
      return total;
    };
    expect(value('deep')).toBeGreaterThan(value('coast') * 5);
  });

  it('storms hit far grounds; a strong hull rides them out', () => {
    const storms = (hull: number) => {
      const g = owner();
      g.buyBoat('net');
      for (const id of ['engine', 'hull', 'sonar'] as const) for (let k = 0; k < 5; k++) g.upgradeTrack(0, id);
      g.boats[0]!.tracks.hull = hull;
      g.setGround(0, 'deep');
      let n = 0;
      for (let k = 0; k < 400; k++) { g.sendBoat(0); tick(g, g.boats[0]!.trip!.dur + 0.1); if (g.boats[0]!.event === 'storm') n++; g.collectHaul(0); }
      return n;
    };
    expect(storms(3)).toBeGreaterThan(storms(5) * 1.5);
  });

  it('a captain sails again by himself and takes wages; the harbor master sells for a fee', () => {
    const g = owner();
    g.buyBoat('net');
    g.upgradeTrack(0, 'captain');
    tick(g, 1);
    expect(g.boats[0]!.trip).not.toBeNull(); // sent without being asked
    tick(g, g.boats[0]!.trip!.dur);
    const haul = g.boats[0]!.haul!;
    const raw = haul.reduce((s, h) => s + h.value, 0);
    expect(g.haulValue(g.boats[0]!)).toBe(Math.round(raw * (1 - CAPTAIN_WAGE)));
    expect(g.buyHarbor('master')).toBe(true);
    const money = g.money;
    tick(g, 0.5);
    expect(g.money).toBeGreaterThan(money);
    expect(g.boats[0]!.haul).toBeNull();
  });

  it('the fish buyer empties the crate; the supplier keeps fishermen in bait', () => {
    const g = owner();
    g.buyBoat('net');
    g.hireHand();
    g.setHandBait(0, 'shiner');
    g.buyHarbor('seller');
    g.buyHarbor('supplier');
    tick(g, 130);
    expect(g.baitCount('shiner')).toBeGreaterThan(0);
    expect(g.crate.length).toBeLessThan(25);
    expect(g.earned).toBeGreaterThan(30000);
  });

  it('a boat can be sold for half of what went into it, freeing its berth', () => {
    const g = owner();
    for (const type of ['net', 'lobster', 'sword'] as const) g.buyBoat(type);
    expect(g.canBuyBoat('net')).toBe(false); // berths full
    const net = g.boats[0]!;
    g.upgradeTrack(0, 'hull'); g.hireCrew(0);
    expect(g.boatResale(0)).toBeGreaterThan(BOATS.net.price / 2);
    tick(g, 0); // (at the pier)
    g.sendBoat(0);
    tick(g, net.trip!.dur + 0.1);
    const money = g.money, refund = g.boatResale(0), haul = g.haulValue(g.boats[0]!);
    expect(g.sellBoat(0)).toBe(refund + haul);
    expect(g.money).toBe(money + refund + haul);
    expect(g.boats.map((b) => b.type)).toEqual(['lobster', 'sword']);
    expect(g.canBuyBoat('sword')).toBe(true);
  });

  it('a boat can be sold even while at sea (that trip is lost), e.g. one with a captain', () => {
    const g = owner();
    g.buyBoat('net'); g.buyBoat('lobster');
    g.upgradeTrack(0, 'captain');
    tick(g, 1);
    expect(g.boats[0]!.trip).not.toBeNull();
    const money = g.money, refund = g.boatResale(0);
    expect(g.sellBoat(0)).toBe(refund);
    expect(g.money).toBe(money + refund);
    expect(g.boats.map((b) => b.type)).toEqual(['lobster']);
  });

  it('the ledger: each boat tracks what went in and what came out', () => {
    const g = owner();
    g.buyBoat('net');
    const b = g.boats[0]!;
    expect(b.invested).toBe(BOATS.net.price);
    const cost = g.nextTrackCost(0, 'gear')!;
    g.upgradeTrack(0, 'gear');
    g.hireCrew(0);
    expect(b.invested).toBeGreaterThan(BOATS.net.price + cost);
    g.sendBoat(0);
    tick(g, b.trip!.dur + 0.1);
    const paid = g.collectHaul(0);
    expect(b.earned).toBe(paid);
    expect(b.trips).toBe(1);
  });

  it('the projected rate rises with upgrades and farther grounds', () => {
    const g = owner();
    g.buyBoat('net');
    const b = g.boats[0]!;
    const now = g.boatRate(b);
    expect(now).toBeGreaterThan(0);
    for (const id of ['hull', 'gear', 'sonar', 'ice'] as const) expect(g.boatRate(b, { track: id })).toBeGreaterThan(now);
    expect(g.boatRate(b, { crew: true })).toBeGreaterThan(now);
    g.upgradeTrack(0, 'engine');
    expect(g.boatRate(b, { ground: 'reef' })).toBeGreaterThan(g.boatRate(b));
  });

  it('old boats get an estimated cost for the ledger', () => {
    const g = new Game({ company: true, boats: [{ type: 'net', net: 2, crew: 3, trip: null, haul: null }] } as never);
    expect(g.boats[0]!.invested).toBeGreaterThan(BOATS.net.price);
    expect(g.boats[0]!.earned).toBe(0);
  });

  it('the company keeps earning while the game is closed, up to the warehouse limit', () => {
    const g = owner(1e7);
    g.buyBoat('net');
    g.upgradeTrack(0, 'captain');
    g.buyHarbor('master');
    const hour = g.catchUp(3600);
    expect(hour).toBeGreaterThan(0);
    const g2 = owner(1e7);
    g2.buyBoat('net'); g2.upgradeTrack(0, 'captain'); g2.buyHarbor('master');
    expect(g2.catchUp(10 * 3600)).toBeLessThan(hour * 1.5); // capped at the warehouse's 1 hour
    expect(new Game({}).catchUp(3600)).toBe(0); // no company, nothing happens
  });
});

describe('hired fishermen', () => {
  const owner = (extra = {}) => {
    const g = new Game({ money: 1e7, earned: 30000, ...extra }, rng(31));
    g.buyCompany();
    return g;
  };

  it('can only be hired once you own a boat; up to 24, a pier section at a time', () => {
    const g = owner();
    expect(g.pierOpen).toBe(false);
    expect(g.hireHand()).toBe(false);
    g.buyBoat();
    expect(g.pierOpen).toBe(true);
    const money = g.money;
    expect(g.hireHand()).toBe(true);
    expect(g.money).toBe(money - handCost(0));
    while (g.hireHand());
    expect(g.hands).toHaveLength(PIER_SPOTS); // one pier section to start
    g.money = 1e9;
    while (g.buyPierSection());
    while (g.hireHand());
    expect(g.hands).toHaveLength(HANDS_MAX);
    expect(HANDS_MAX).toBe(24);
  });

  it('fish on their own with bait from your pouch, into the crate', () => {
    const g = owner({ baits: { worm: 50 } });
    g.buyBoat();
    g.hireHand();
    tick(g, 120);
    expect(g.baitCount('worm')).toBeLessThan(50);
    expect(g.crate.length).toBeGreaterThan(3);
    expect(g.bag).toHaveLength(0);
    const value = g.crateValue();
    expect(g.sellCrate()).toBe(value);
    expect(g.crate).toHaveLength(0);
  });

  it('stop when their bait runs out', () => {
    const g = owner({ baits: { worm: 2, gold: 0 } });
    g.buyBoat();
    g.hireHand();
    g.setHandBait(0, 'gold');
    tick(g, 30);
    expect(g.handStarved(g.hands[0]!)).toBe(true);
    expect(g.baitCount('worm')).toBe(2); // they don't touch other bait
  });

  it('upgrades: their own rod and level, like yours', () => {
    const g = owner();
    g.buyBoat();
    g.hireHand();
    expect(g.handNextRod(0)!.name).toBe('Bamboo Rod');
    while (g.upgradeHandRod(0));
    while (g.trainHand(0));
    expect(g.hands[0]!.rod).toBe(4);
    expect(g.hands[0]!.skill).toBe(25);
    const legend = g.handOdds(g.hands[0]!).filter((o) => o.fish.tier === 5).reduce((s, o) => s + o.p, 0);
    expect(legend).toBeGreaterThan(0.2);
  });

  it('trained hands miss fewer bites', () => {
    const misses = (skill: number) => {
      const g = owner({ baits: { worm: 1e6 } });
      g.buyBoat(); g.hireHand();
      g.hands[0]!.skill = skill;
      let escaped = 0, prev = '';
      for (let t = 0; t < 900; t += 0.05) {
        g.tick(0.05);
        const l = g.hands[0]!.line;
        const key = l.type === 'result' ? `${l.outcome}${l.t > 0.06 ? '' : '!'}` : l.type;
        if (key === 'escaped!' && prev !== key) escaped++;
        prev = key;
      }
      return escaped;
    };
    expect(misses(25)).toBe(0);
    expect(misses(1)).toBeGreaterThan(5);
  });

  it('save and reload keeps hands (lines reset) and the crate', () => {
    const g = owner({ baits: { worm: 30 } });
    g.buyBoat(); g.hireHand(); g.upgradeHandRod(0); g.setHandBait(0, 'worm');
    tick(g, 30);
    const copy = new Game(JSON.parse(JSON.stringify(g.save())));
    expect(copy.hands[0]).toMatchObject({ rod: 1, bait: 'worm', line: { type: 'idle' } });
    expect(copy.crate.length).toBe(g.crate.length);
  });
});

describe('pier staff', () => {
  const pier = (extra = {}) => {
    const g = new Game({ money: 1e9, earned: 30000, ...extra }, rng(51));
    g.buyCompany(); g.buyBoat();
    return g;
  };

  it('pier staff need the pier; the Fish Seller sells your bag when it fills', () => {
    const g = new Game({ money: 1e9, earned: 30000 }, rng(52));
    g.buyCompany();
    expect(g.buyHarbor('seller')).toBe(false); // no pier yet
    g.buyBoat();
    expect(g.buyHarbor('seller')).toBe(true);
    g.bag = Array.from({ length: SELLER_BAG }, (_, i) => ({ id: 9000 + i, fish: 'perch', kg: 0.4, value: 10 }));
    const money = g.money;
    tick(g, 0.1);
    expect(g.bag).toHaveLength(0);
    expect(g.money).toBeGreaterThan(money);
    expect(g.sellerNews).toBeGreaterThan(0);
  });

  it('the Manager gives each fisherman the best bait they can use and spends within budget', () => {
    const g = pier({ baits: { worm: 1e6, shiner: 1e6, glow: 1e6 } });
    g.hireHand(); g.hireHand();
    g.hands[0]!.rod = 4; g.hands[0]!.skill = 20; // Mythril, trained: a big bait pays
    g.buyHarbor('manager');
    g.setManagerBudget(3);
    tick(g, 31);
    expect(g.hands[0]!.bait).toBe('glow');
    expect(g.hands[1]!.bait).toBe('worm'); // a rookie only profits on worms
    expect(g.hands[1]!.skill + g.hands[1]!.rod).toBeGreaterThan(1); // spent on the crew
    g.setManagerBudget(0);
    const before = JSON.stringify(g.hands.map((h) => [h.rod, h.skill]));
    tick(g, 30);
    expect(JSON.stringify(g.hands.map((h) => [h.rod, h.skill]))).toBe(before); // budget Off: no spending
  });

  it('with the Supplier, the Manager puts trained Mythril fishermen on Golden Lures (big lures, big fish)', () => {
    const g = pier();
    g.buyHarbor('supplier');
    g.hireHand(); g.hireHand();
    Object.assign(g.hands[0]!, { rod: 4, skill: 18 });
    Object.assign(g.hands[1]!, { rod: 1, skill: 5 });
    expect(g.bestBait(g.hands[0]!)).toBe('gold');
    expect(['worm', 'cricket']).toContain(g.bestBait(g.hands[1]!));
  });

  it('pier sections cost money and add four spots each', () => {
    const g = pier();
    expect(g.pierSpots).toBe(PIER_SPOTS);
    expect(g.nextPierSection()).toBe(PIER_SECTIONS[1]);
    expect(g.buyPierSection()).toBe(true);
    expect(g.pierSpots).toBe(PIER_SPOTS * 2);
  });

  it('old saves: the Fish Buyer becomes the Fish Seller', () => {
    const g = new Game({ company: true, harbor: { buyer: true } } as never);
    expect(g.harbor.seller).toBe(true);
  });
});