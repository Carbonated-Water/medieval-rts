import { describe, expect, it } from 'vitest';
import { LEGENDS, VOYAGE } from './data';
import { Game } from './game';
import { EVENTS, canReach, choices, choose, newVoyage, sail, sailToLegend, type VoyageState } from './voyage';

function rng(seed = 1) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** A sensible captain: always the first reachable spot; nets once at fishing grounds; takes the safer choice in events; dives wrecks only with hull to spare. */
function playVoyage(v: VoyageState, r: () => number): VoyageState {
  for (let guard = 0; guard < 50 && v.stage !== 'fight' && v.stage !== 'over'; guard++) {
    if (v.stage === 'map') {
      if (v.row === v.rows.length - 1) { sailToLegend(v); continue; }
      const i = v.rows[v.row + 1]!.findIndex((_, k) => canReach(v, k));
      sail(v, i);
      continue;
    }
    const list = choices(v), spot = v.rows[v.row]![v.at]!;
    const k = spot.kind === 'fish' ? (v.used ? list.length - 1 : 0)
      : spot.kind === 'wreck' ? (v.used || v.hull < 2 ? list.length - 1 : 0)
      : spot.kind === 'event' ? (v.used ? 0 : list.findIndex((c) => !c.cost) >= 0 ? list.findIndex((c) => !c.cost) : list.length - 1)
      : list.length - 1;
    choose(v, k, r);
  }
  return v;
}

describe('voyages', () => {
  it('a map is three rows of 2-3 spots, no trader in the first row; every spot can be reached from the row before', () => {
    for (let seed = 1; seed < 30; seed++) {
      const v = newVoyage('kelpwyrm', rng(seed));
      expect(v.rows.length).toBe(3);
      for (const row of v.rows) expect(row.length === 2 || row.length === 3).toBe(true);
      expect(v.rows[0]!.some((s) => s.kind === 'trader')).toBe(false);
      for (const s of v.rows.flat()) if (s.kind === 'event') expect(EVENTS[s.event!]).toBeTruthy();
      // From each spot of a row, at least one spot of the next row is reachable.
      for (let r = 0; r < 2; r++) for (let i = 0; i < v.rows[r]!.length; i++) {
        const probe: VoyageState = { ...v, row: r, at: i, stage: 'map' };
        expect(v.rows[r + 1]!.some((_, k) => canReach(probe, k)), `seed ${seed} row ${r} spot ${i}`).toBe(true);
      }
    }
  });

  it('each move costs a supply; the card offers choices; then back to the map', () => {
    const v = newVoyage('kelpwyrm', rng(3));
    expect(sail(v, 0)).toBe(true);
    expect(v.supplies).toBe(VOYAGE.supplies - 1);
    expect(v.stage).toBe('spot');
    expect(choices(v).length).toBeGreaterThan(0);
    for (let g = 0; g < 5 && v.stage === 'spot'; g++) choose(v, choices(v).length - 1, rng(4));
    expect(['map', 'over']).toContain(v.stage);
  });

  it('losing the hull ends the voyage and loses the haul', () => {
    const v = newVoyage('kelpwyrm', rng(5));
    sail(v, 0);
    v.haul = 5_000_000;
    v.hull = 1;
    v.rows[0]![0] = { kind: 'wreck' };
    v.used = false;
    // Dive until debris strikes.
    const r = () => 0.1; // < 0.4: debris
    choose(v, 0, r);
    expect(v.stage).toBe('over');
    expect(v.result).toBe('failed');
    expect(v.haul).toBe(0);
  });

  it('running short of supplies to reach the legend ends it', () => {
    const v = newVoyage('kelpwyrm', rng(6));
    sail(v, 0);
    v.supplies = 1; // two rows and the legend still ahead
    for (let g = 0; g < 5 && v.stage === 'spot'; g++) choose(v, choices(v).length - 1, rng(7));
    expect(v.result).toBe('failed');
  });

  it('a sensible captain usually reaches the legend', () => {
    let reached = 0;
    for (let seed = 1; seed <= 40; seed++) if (playVoyage(newVoyage('ghostmarlin', rng(seed)), rng(seed + 100)).stage === 'fight') reached++;
    expect(reached).toBeGreaterThanOrEqual(30);
  });
});

describe('voyages in the game', () => {
  const owner = (extra = {}) => new Game({ money: 50e6, earned: 1e8, company: true, ...extra }, rng(9));

  it('needs the Flagship; the Flagship needs money', () => {
    const g = owner();
    expect(g.startVoyage('kelpwyrm')).toBe(false);
    expect(g.buyFlagship()).toBe(true);
    expect(g.money).toBe(50e6 - VOYAGE.flagship);
    expect(g.startVoyage('kelpwyrm')).toBe(true);
    expect(g.canSail()).toBe(false); // already out
  });

  it('regions open one after another; The Old One waits for the rest of the Abyss', () => {
    const g = owner({ flagship: true });
    const old = LEGENDS.find((l) => l.id === 'theoldone')!;
    expect(g.regionOpen('ocean')).toBe(false);
    expect(g.startVoyage('ghostmarlin')).toBe(false);
    g.landed.kelpwyrm = 1;
    expect(g.regionOpen('ocean')).toBe(true);
    expect(g.regionOpen('abyss')).toBe(false);
    g.landed.stormshark = 1;
    expect(g.regionOpen('abyss')).toBe(true);
    expect(g.legendOpen(old)).toBe(false);
    g.landed.abyssking = 1; g.landed.lanternqueen = 1; g.landed.boneeel = 1;
    expect(g.legendOpen(old)).toBe(true);
  });

  it('landing the legend banks the haul, puts the fish in the hold, pays Pearls, and rests the Flagship', () => {
    const g = owner({ flagship: true });
    g.startVoyage('kelpwyrm');
    const v = playVoyage(g.voyage!, rng(11));
    expect(v.stage).toBe('fight');
    const haul = v.haul, money = g.money, pearls = g.pearls;
    g.voyageFought(true);
    const out = g.endVoyage()!;
    expect(out.result).toBe('caught');
    expect(g.money).toBe(money + haul);
    expect(g.exoticHold.length).toBe(1);
    expect(g.exoticHold[0]!.fish).toBe('kelpwyrm');
    expect(g.pearls).toBe(pearls + VOYAGE.pearls.coast);
    expect(g.landed.kelpwyrm).toBe(1);
    expect(g.voyage).toBeNull();
    expect(g.canSail()).toBe(false);
    for (let t = 0; t < VOYAGE.rest + 1; t += 1) g.tick(1);
    expect(g.canSail()).toBe(true);
  });

  it('losing the fight still banks the haul, but no fish or Pearls', () => {
    const g = owner({ flagship: true });
    g.startVoyage('kelpwyrm');
    playVoyage(g.voyage!, rng(12));
    const haul = g.voyage!.haul, money = g.money;
    g.voyageFought(false);
    const out = g.endVoyage()!;
    expect(out.result).toBe('lost');
    expect(g.money).toBe(money + haul);
    expect(g.exoticHold.length).toBe(0);
    expect(g.landed.kelpwyrm).toBeUndefined();
  });

  it('a voyage under way and legends landed survive a save; landed survives retiring', () => {
    const g = owner({ flagship: true, landed: { kelpwyrm: 2 } });
    g.startVoyage('coralcolossus');
    g.voyageSail(0);
    const again = new Game(JSON.parse(JSON.stringify(g.save())));
    expect(again.voyage).toEqual(g.voyage);
    expect(new Game(g.retire()!).landed).toEqual({ kelpwyrm: 2 });
  });
});
