import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS, AUTO, BAITS, BERTHS, BOATS, BOAT_REPEAT, BOOTS, CAPTAIN_WAGE, COMPANY_PRICE, CREW_BASE, GROUNDS, HANDS_MAX, handCost, PIER_SPOTS, PIER_SECTIONS, SELLER_BAG, SHELLFISH,
  COMPANY_UNLOCK_EARNED, LETTERS, TRACK_GROWTH, TRACK_MAX, TRACK_ORDER, CLOTHES, DEV_MULTIPLIER, FISH, HAGGLE_PER_LEVEL, HOLDERS, REFLEX_PER_LEVEL, RODS, SKILLS, SKILL_MAX, VARIANTS,
  MAX_GROUND_WORMS, START_WORMS, STRENGTH_PER_LEVEL, WORM_SPAWN_SECONDS, skillCost, TREE_FISH, pearlsFor, gearById,
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
  it('rod holders and the Autofisher (the Tackle shop) are bought in order, one level at a time', () => {
    const rich = new Game({ money: 1e9 });
    for (const kind of ['holders', 'auto', 'net', 'chum', 'icebox'] as const) {
      while (rich.buyGear(kind));
      expect(rich.nextGear(kind)).toBeNull();
    }
  });

  it('Landing Net: a catch sometimes brings in a second fish', () => {
    const count = (net: number) => {
      const g = new Game({ net, skill: 5 }, rng(3));
      for (let k = 0; k < 200; k++) { waitForBite(g); g.reel(); tick(g, 0.1); }
      return g.bag.length;
    };
    expect(count(5)).toBeGreaterThan(count(0) + 20);
  });

  it('Ice Box: fish sold at the Market are worth more; the pier crate is not iced', () => {
    const c = { value: 100 } as never;
    expect(new Game({ icebox: 5 }).priceOf(c)).toBe(125);
    expect(new Game({ icebox: 5 }).priceOf(c, false)).toBe(100);
    expect(new Game({}).priceOf(c)).toBe(100);
  });

  it('Chum Bucket: a frenzy comes on its clock and speeds up bites while it lasts', () => {
    const g = new Game({ chum: 5 }, rng(2));
    tick(g, 119);
    expect(g.frenzyLeft).toBe(0);
    tick(g, 2);
    expect(g.frenzyLeft).toBeGreaterThan(0);
    expect(g.frenzyNews).toBe(true);
    const fast = g.biteWait('worm'), slow = new Game({}, rng(2)).biteWait('worm');
    expect(fast).toBeLessThan(slow);
    tick(g, 31);
    expect(g.frenzyLeft).toBe(0);
  });

  it('Autofisher VII casts your best bait by itself; VIII never misses a bite', () => {
    const g = new Game({ auto: 7, baits: { worm: 100, cricket: 5 } }, rng(5));
    g.autoFish();
    expect(g.baitSel).toBe('cricket');
    const sure = new Game({ auto: 8, baits: { worm: 1e6 } }, rng(9));
    const ends = (g: Game) => { const seen = new WeakSet<object>(), out = { escaped: 0, caught: 0 };
      for (let k = 0; k < 6000; k++) { g.tick(0.05); g.autoFish(); for (const l of g.lines) if (l.type === 'result' && !seen.has(l)) { seen.add(l); if (l.outcome === 'escaped') out.escaped++; if (l.outcome === 'caught') out.caught++; } }
      return out; };
    expect(ends(new Game({ auto: 1, baits: { worm: 1e6 } }, rng(9))).escaped).toBeGreaterThan(0);
    const top = ends(sure);
    expect(top.escaped).toBe(0);
    expect(top.caught).toBeGreaterThan(20);
  });

  it('a new run starts in the starter set; buying a piece puts it on and the old one goes to the bag', () => {
    const g = new Game({ money: 1000 });
    expect(g.gearOf('rod')!.id).toBe('twigrod');
    expect(g.gearOf('hat')!.id).toBe('strawhat');
    expect(g.rodTier).toBe(1);
    expect(g.buyGearPiece('bamboorod')).toBeTruthy();
    expect(g.money).toBe(1000 - gearById('bamboorod')!.price);
    expect(g.rodTier).toBe(2);
    expect(g.gearBag.map((x) => x.def)).toEqual(['twigrod']);
    expect(g.buyGearPiece('mythrilrod')).toBeNull(); // can't afford
  });

  it('old saves: rod, clothes and boots levels become the matching pieces', () => {
    const g = new Game({ rod: 4, clothes: 2, boots: 3 });
    expect([g.gearOf('rod')!.id, g.gearOf('shirt')!.id, g.gearOf('boots')!.id]).toEqual(['mythrilrod', 'rainjacket', 'hikingboots']);
    expect(g.rodTier).toBe(5);
    expect(new Game({}).gearOf('boots')).toBeNull(); // barefoot
  });

  it('gear stats work: Size, Stride, Reflex, Strength, Patience add up over what you wear', () => {
    const g = new Game({}, rng(3));
    const base = { window: g.reelWindow(), walk: g.walkSpeed(), strong: g.strengthChance() };
    g.equipped.boots = { id: 99, def: 'sevenleagueboots', stats: { stride: 110 } };
    g.equipped.hat = { id: 98, def: 'owleyegoggles', stats: { reflex: 55 } };
    g.equipped.shirt = { id: 97, def: 'leviathanhide', stats: { size: 40, strength: 40 } };
    expect(g.walkSpeed()).toBeCloseTo(2.1);
    expect(g.reelWindow()).toBeGreaterThan(base.window * 1.5);
    expect(g.strengthChance()).toBeCloseTo(base.strong + 0.2);
    expect(g.gearStat('size')).toBe(40);
  });

  it('equip, unequip, sell; SELL ALL keeps Legendaries; the rod cannot be taken off', () => {
    const g = new Game({ money: 1e6 });
    g.buyGearPiece('bucketHat'.toLowerCase());
    expect(g.gearOf('hat')!.id).toBe('buckethat');
    const straw = g.gearBag.find((x) => x.def === 'strawhat')!;
    expect(g.equipGear(straw.id)).toBe(true);
    expect(g.gearOf('hat')!.id).toBe('strawhat');
    expect(g.unequipGear('rod')).toBe(false);
    expect(g.unequipGear('hat')).toBe(true);
    expect(g.gearOf('hat')).toBeNull();
    g.gearBag.push({ id: 500, def: 'searlegs'.replace('r', ''), stats: { stride: 150 } });
    const money = g.money;
    const sold = g.sellAllGear();
    expect(sold).toBeGreaterThan(0);
    expect(g.money).toBe(money + sold);
    expect(g.gearBag.map((x) => x.def)).toEqual(['sealegs']);
    expect(g.sellGear(500)).toBeGreaterThan(0);
    expect(g.gearBag).toHaveLength(0);
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
    const g = new Game(), k = 1 + g.gearStat('reflex') / 100; // the starter rod adds a little Reflex
    expect(new Game({ reflexes: 10 }).reelWindow()).toBeCloseTo(g.reelWindow() + 10 * REFLEX_PER_LEVEL * k);
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
    g.equipped.rod!.stats = {}; // bait alone, without the rod's Luck
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

describe('prestige: Pearls and the Fish Tree', () => {
  const ev = (g: Game) => g.odds(25, 'gold').filter((o) => !o.tooStrong).reduce((s, o) => s + o.p * o.fish.price, 0);

  it('retiring gives sqrt(earned / 1M) Pearls and keeps only Pearls, the tree, the journal and achievements', () => {
    const g = new Game({ money: 5e6, earned: 4e8, company: true, rod: 4, skill: 20, pearls: 3, fishTree: ['sunfish'], journal: { minnow: { count: 9, bestKg: 0.1 } }, claimed: ['catch1'] }, rng(3));
    expect(pearlsFor(4e8)).toBe(20);
    const next = new Game(g.retire()!, rng(4));
    expect(next.pearls).toBe(23);
    expect(next.fishTree).toEqual(['sunfish']);
    expect(next.retirements).toBe(1);
    expect(next.journal.minnow!.count).toBe(9);
    expect(next.claimed).toEqual(['catch1']);
    expect(next.money).toBeLessThan(1000);
    expect(next.company).toBe(false);
    expect(next.rod).toBe(0);
    expect(new Game({ earned: 5e5 }).retire()).toBeNull();
  });

  it('the tree opens tier by tier: any one fish of a tier opens the next; branches need their parent', () => {
    const g = new Game({ pearls: 100 }, rng(5));
    const t2root = TREE_FISH.find((f) => f.tier === 2 && f.slot === 0)!;
    expect(g.canUnlock(t2root.id)).toBe(false);
    const branch = TREE_FISH.find((f) => f.tier === 1 && f.side === 'sea' && f.slot === 1)!;
    expect(g.canUnlock(branch.id)).toBe(false); // its root first
    expect(g.unlockFish('sardine')).toBe(true); // sea root, tier 1
    expect(g.canUnlock(branch.id)).toBe(true);
    expect(g.canUnlock(t2root.id)).toBe(true); // any tier-1 fish opens tier 2
    expect(g.pearls).toBe(100 - TREE_FISH.find((f) => f.id === 'sardine')!.cost);
    expect(new Game({ pearls: 0 }).canUnlock('sunfish')).toBe(false); // can't afford
  });

  it('river fish join your bites and your fishermen, and raise what a bite is worth', () => {
    const base = new Game({ rod: 4, skill: 25 }, rng(6));
    const all = new Game({ rod: 4, skill: 25, fishTree: TREE_FISH.filter((f) => f.side === 'river').map((f) => f.id) }, rng(6));
    expect(all.riverFish().length).toBe(45);
    expect(ev(all)).toBeGreaterThan(ev(base) * 1.5);
  });

  it('sea fish join their boat at their ground and deeper, and raise its rate', () => {
    const tree = TREE_FISH.filter((f) => f.side === 'sea').map((f) => f.id);
    const g = new Game({ fishTree: tree }, rng(7));
    expect(g.seaPool('net', 'coast').map((f) => f.id)).toContain('sardine');
    expect(g.seaPool('net', 'coast').map((f) => f.id)).not.toContain('anglerfish');
    expect(g.seaPool('net', 'deep').map((f) => f.id)).toContain('anglerfish');
    expect(g.seaPool('lobster', 'deep').map((f) => f.id)).not.toContain('sardine');
    const boat = { type: 'sword' as const, tracks: { hull: 5, engine: 5, gear: 5, sonar: 5, ice: 5, captain: 1 }, crew: 6, ground: 'deep' as const, trip: null, haul: null, event: null, invested: 0, earned: 0, trips: 0 };
    const plain = new Game({ company: true, boats: [boat] }, rng(8)), rich = new Game({ company: true, boats: [boat], fishTree: tree }, rng(8));
    expect(rich.boatRate(rich.boats[0]!)).toBeGreaterThan(plain.boatRate(plain.boats[0]!) * 1.5);
  });

  it('Pearls do not change prices (they only unlock fish)', () => {
    const a = new Game({}, rng(9)), b = new Game({ pearls: 50 }, rng(9));
    const c = { id: 1, fish: 'carp', kg: 3, value: 100 };
    expect(b.priceOf(c)).toBe(a.priceOf(c));
  });

  it('every tree fish is worth more than every original fish of its tier on its side (river, or any boat)', () => {
    const baseSea = [...BOATS.net.catch, ...BOATS.lobster.catch, ...BOATS.sword.catch];
    for (const f of TREE_FISH) {
      const rivals = (f.side === 'river' ? FISH : baseSea).filter((b) => b.tier === f.tier);
      for (const b of rivals) expect(f.price, `${f.name} vs ${b.name}`).toBeGreaterThan(b.price);
    }
  });

  it('Fish Tree achievements track unlocks, full tiers, new catches, boat landings and retirements', () => {
    const tier1 = TREE_FISH.filter((x) => x.tier === 1).map((x) => x.id);
    const g = new Game({ fishTree: tier1, journal: { sunfish: { count: 1, bestKg: 0.3 }, mahseer: { count: 1, bestKg: 40 } }, retirements: 3 }, rng(10));
    expect(g.stat('treeUnlocked')).toBe(10);
    expect(g.stat('treeTiers')).toBe(1);
    expect(g.stat('treeRiver')).toBe(2);
    expect(g.stat('treeRiverTier')).toBe(5);
    expect(g.stat('retired')).toBe(3);
    expect(g.achieved(ACHIEVEMENTS.find((a) => a.id === 'riverLegend')!)).toBe(true);
    expect(g.achieved(ACHIEVEMENTS.find((a) => a.id === 'retire10')!)).toBe(false);
    // Boats landing tree sea fish fill the sea's journal.
    const b = new Game({ money: 1e9, earned: 1e7, fishTree: ['sardine', 'sprat'] }, rng(11));
    b.buyCompany(); b.buyBoat('net');
    for (let k = 0; k < 20 && b.stat('treeSea') < 1; k++) { b.sendBoat(0); tick(b, b.boats[0]!.trip!.dur + 0.1); b.collectHaul(0); }
    expect(b.stat('treeSea')).toBeGreaterThan(0);
    expect(new Game(b.retire()!).seaSeen).toEqual(b.seaSeen);
  });

  it('round-trips prestige through save data', () => {
    const g = new Game({ pearls: 7, fishTree: ['sunfish', 'sardine'], retirements: 2 });
    const again = new Game(JSON.parse(JSON.stringify(g.save())));
    expect([again.pearls, again.fishTree, again.retirements]).toEqual([7, ['sunfish', 'sardine'], 2]);
  });
});


describe('the Exotic Market', () => {
  const market = () => new Game({ money: 0, earned: 1e7, company: true }, rng(21));

  it('landed legends go into a hold of 6, worth more when heavier', () => {
    const g = market();
    const small = g.addExotic('ghostmarlin', 300)!, big = g.addExotic('ghostmarlin', 600)!;
    expect(big.value).toBe(small.value * 2);
    for (let k = 0; k < 4; k++) g.addExotic('kelpwyrm');
    expect(g.exoticHold.length).toBe(6);
    expect(g.addExotic('kelpwyrm')).toBeNull();
  });

  it('a listed fish gets offers that come and go; selling pays the offer', () => {
    const g = market();
    const e = g.addExotic('abyssking')!;
    expect(g.listExotic(e.id)).toBe(true);
    expect(g.exoticHold.length).toBe(0);
    tick(g, 120);
    const l = g.listings[0]!;
    expect(l.offers.length).toBeGreaterThan(0);
    expect(l.offers.length).toBeLessThanOrEqual(4);
    expect(l.offers[0]!.amount).toBeGreaterThan(e.value * 0.5);
    const best = l.offers[0]!.amount;
    expect(g.sellToOffer(e.id, 0)).toBe(best);
    expect(g.money).toBe(best);
    expect(g.listings.length).toBe(0);
  });

  it('only 3 fish can be listed; unlisting puts a fish back in the hold', () => {
    const g = market();
    const ids = [1, 2, 3, 4].map(() => g.addExotic('kelpwyrm')!.id);
    expect(ids.slice(0, 3).every((id) => g.listExotic(id))).toBe(true);
    expect(g.listExotic(ids[3]!)).toBe(false);
    expect(g.unlistExotic(ids[0]!)).toBe(true);
    expect(g.exoticHold.map((e) => e.id).sort()).toEqual([ids[0], ids[3]].sort());
  });

  it('WANTED notices appear, pay about double for a big enough fish, and refuse a small one', () => {
    const g = market();
    tick(g, 301);
    const w = g.wanted[0]!;
    expect(w).toBeTruthy();
    const small = g.addExotic(w.fish, w.minKg - 10)!, ok = g.addExotic(w.fish, w.minKg + 10)!;
    expect(g.fulfillWanted(w.id, small.id)).toBe(0);
    expect(w.reward).toBeGreaterThan(g.exoticValue(w.fish, w.minKg) * 1.6);
    expect(g.fulfillWanted(w.id, ok.id)).toBe(w.reward);
    expect(g.wanted.includes(w)).toBe(false);
  });

  it('round-trips through save data', () => {
    const g = market();
    g.listExotic(g.addExotic('ghostmarlin')!.id);
    g.addExotic('kelpwyrm');
    tick(g, 310);
    const again = new Game(JSON.parse(JSON.stringify(g.save())));
    expect([again.exoticHold, again.listings, again.wanted, again.nextExoticId]).toEqual([g.exoticHold, g.listings, g.wanted, g.nextExoticId]);
  });
});
