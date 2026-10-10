import { LEGENDS, VOYAGE, type LegendDef, type Region } from './data';

/**
 * A voyage (pure logic and plain data, so it saves as is): from the
 * lighthouse up a small map of three rows of spots to a legend's spot. Each
 * move costs a supply; spots are fishing grounds (net a haul), events (a
 * choice with odds), wrecks (dive for treasure or hit debris) and traders
 * (spend haul on supplies or repairs). Hull or supplies running out ends it
 * early and loses the haul; reaching the legend starts the fight.
 */

export type SpotKind = 'fish' | 'event' | 'wreck' | 'trader';
export interface Spot { kind: SpotKind; event?: string }
export interface VoyageState {
  legend: string;
  rows: Spot[][];
  /** Row and spot you're at; row -1 = just left the lighthouse. */
  row: number;
  at: number;
  supplies: number;
  hull: number;
  haul: number;
  /** map: choose where to sail; spot: deal with the spot you reached; fight: at the legend; over: done. */
  stage: 'map' | 'spot' | 'fight' | 'over';
  /** What happened last (shown on the card). */
  note: string;
  /** At a fishing ground: netted once already (the next cast costs a supply). At a trader: bought already. */
  used?: boolean;
  /** How it ended: landed the legend, lost the fight, or never got there (haul lost). */
  result?: 'caught' | 'lost' | 'failed';
  kg?: number;
}

/** A choice on a spot's card. */
export interface Choice { label: string; cost?: string }

type Roll = () => number;
const pick = <T>(list: T[], rng: Roll): T => list[Math.floor(rng() * list.length)]!;

export const legendOf = (v: VoyageState): LegendDef => LEGENDS.find((l) => l.id === v.legend)!;
const base = (v: VoyageState, rng: Roll) => Math.round((VOYAGE.haul[legendOf(v).region] * (0.8 + rng() * 0.4)) / 1000) * 1000;
const money = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1000)}k`);

/**
 * Events: a line of text and choices; each choice's outcome changes the
 * voyage and returns what happened. Odds are in the outcomes.
 */
interface EventDef { text: string; choices: Choice[]; act: (k: number, v: VoyageState, rng: Roll) => string }
const hurt = (v: VoyageState, n = 1) => { v.hull = Math.max(0, v.hull - n); };
export const EVENTS: Record<string, EventDef> = {
  storm: {
    text: 'A storm rolls in fast.',
    choices: [{ label: 'PUSH THROUGH', cost: '40%: -1 hull' }, { label: 'WAIT IT OUT', cost: '-1 supply' }],
    act: (k, v, rng) => (k === 0 ? (rng() < 0.4 ? (hurt(v), 'The waves hammer the hull.') : 'You ride it out.') : (v.supplies--, 'You wait. It passes.')),
  },
  rival: {
    text: 'A rival boat races you to a school of fish.',
    choices: [{ label: 'RACE THEM', cost: '50/50' }, { label: 'LET THEM GO' }],
    act: (k, v, rng) => {
      if (k === 1) return 'They take the school.';
      if (rng() < 0.5) { const n = base(v, rng); v.haul += n; return `You win the school: +${money(n)}.`; }
      hurt(v); return 'You scrape their hull. -1 hull.';
    },
  },
  bottle: {
    text: 'A message in a bottle bobs past.',
    choices: [{ label: 'OPEN IT' }, { label: 'LEAVE IT' }],
    act: (k, v, rng) => {
      if (k === 1) return 'It drifts away.';
      if (rng() < 0.5) { v.supplies++; return 'A map to a supply cache: +1 supply.'; }
      const n = Math.round(base(v, rng) / 2); v.haul += n; return `An old gold coin: +${money(n)}.`;
    },
  },
  fog: {
    text: 'Thick fog swallows the boat.',
    choices: [{ label: 'SLOW DOWN', cost: '-1 supply' }, { label: 'SAIL BLIND', cost: '50%: -1 hull' }],
    act: (k, v, rng) => (k === 0 ? (v.supplies--, 'You creep through it.') : rng() < 0.5 ? (hurt(v), 'Rocks! -1 hull.') : 'You slip through unharmed.'),
  },
  whales: {
    text: 'A pod of whales is driving fish ahead of it.',
    choices: [{ label: 'FOLLOW THEM', cost: '-1 supply' }, { label: 'KEEP COURSE' }],
    act: (k, v, rng) => { if (k === 1) return 'You hold your course.'; v.supplies--; const n = Math.round(base(v, rng) * 1.5); v.haul += n; return `Nets full: +${money(n)}.`; },
  },
  song: {
    text: 'A strange song drifts across the water.',
    choices: [{ label: 'FOLLOW IT', cost: '50/50' }, { label: 'COVER YOUR EARS' }],
    act: (k, v, rng) => {
      if (k === 1) return 'The song fades.';
      if (rng() < 0.5) { const n = base(v, rng) * 2; v.haul += n; return `A sunken chest: +${money(n)}.`; }
      hurt(v); return 'It leads you onto rocks. -1 hull.';
    },
  },
  castaway: {
    text: 'A castaway waves from a raft.',
    choices: [{ label: 'TAKE THEM ABOARD', cost: '-1 supply' }, { label: 'SAIL ON' }],
    act: (k, v) => { if (k === 1) return 'You sail on.'; v.supplies--; v.hull = Math.min(VOYAGE.hull, v.hull + 1); return 'A shipwright! They patch the hull: +1 hull.'; },
  },
  birds: {
    text: 'Seabirds dive over a boiling school.',
    choices: [{ label: 'CAST THE NETS' }],
    act: (_k, v, rng) => { const n = base(v, rng); v.haul += n; return `+${money(n)}.`; },
  },
};

/** Start a voyage to a legend: three rows of 2-3 spots (no trader in the first). */
export function newVoyage(legend: string, rng: Roll): VoyageState {
  const rows: Spot[][] = [0, 1, 2].map((r) => Array.from({ length: 2 + Math.floor(rng() * 2) }, () => {
    const x = rng();
    const kind: SpotKind = x < 0.38 ? 'fish' : x < 0.7 ? 'event' : x < 0.85 || r === 0 ? 'wreck' : 'trader';
    return kind === 'event' ? { kind, event: pick(Object.keys(EVENTS), rng) } : { kind };
  }));
  return { legend, rows, row: -1, at: 0, supplies: VOYAGE.supplies, hull: VOYAGE.hull, haul: 0, stage: 'map', note: 'The Flagship leaves the lighthouse.' };
}

/** Can you sail from where you are to spot i of the next row? (From the lighthouse: any; then the spots beside you.) */
export function canReach(v: VoyageState, i: number): boolean {
  if (v.stage !== 'map' || v.row >= v.rows.length - 1) return false;
  const next = v.rows[v.row + 1]!;
  if (i < 0 || i >= next.length) return false;
  if (v.row < 0) return true;
  // Map positions spread across the width; neighbours are the ones within half a step.
  const here = (v.at + 0.5) / v.rows[v.row]!.length, there = (i + 0.5) / next.length;
  return Math.abs(here - there) <= 0.5;
}

/** Sail to a spot of the next row (one supply). */
export function sail(v: VoyageState, i: number): boolean {
  if (!canReach(v, i) || v.supplies < 1) return false;
  v.supplies--;
  v.row++;
  v.at = i;
  v.used = false;
  v.stage = 'spot';
  const s = v.rows[v.row]![i]!;
  v.note = s.kind === 'event' ? EVENTS[s.event!]!.text : s.kind === 'fish' ? 'Fishing grounds. The water is thick with fish.'
    : s.kind === 'wreck' ? 'An old wreck lies just under the surface.' : 'A trader\'s boat, lanterns lit.';
  return true;
}

/** The choices on the card of the spot you're at. */
export function choices(v: VoyageState): Choice[] {
  if (v.stage !== 'spot') return [];
  const s = v.rows[v.row]![v.at]!;
  if (s.kind === 'event') return v.used ? [{ label: 'SAIL ON' }] : EVENTS[s.event!]!.choices;
  if (s.kind === 'fish') return v.used ? [{ label: 'FISH AGAIN', cost: '-1 supply' }, { label: 'SAIL ON' }] : [{ label: 'CAST THE NETS' }];
  if (s.kind === 'wreck') return v.used ? [{ label: 'SAIL ON' }] : [{ label: 'DIVE', cost: '40%: -1 hull' }, { label: 'SAIL PAST' }];
  const p = traderPrices(v);
  return v.used ? [{ label: 'SAIL ON' }] : [{ label: '+2 SUPPLIES', cost: money(p.supplies) }, { label: 'REPAIR +1', cost: money(p.repair) }, { label: 'SAIL ON' }];
}

/** A trader's prices: a share of the haul, with a floor. */
export function traderPrices(v: VoyageState): { supplies: number; repair: number } {
  const b = VOYAGE.haul[legendOf(v).region];
  return { supplies: Math.max(Math.round(b * 0.4), Math.round(v.haul * 0.2)), repair: Math.max(Math.round(b * 0.5), Math.round(v.haul * 0.25)) };
}

/** Take a choice on the card. Afterwards: back to the map, on to the legend, or over (out of hull or supplies). */
export function choose(v: VoyageState, k: number, rng: Roll): void {
  const list = choices(v);
  if (!list[k]) return;
  const s = v.rows[v.row]![v.at]!, label = list[k]!.label;
  if (label === 'SAIL ON' || label === 'SAIL PAST') v.stage = 'map';
  else if (s.kind === 'event') { v.note = EVENTS[s.event!]!.act(k, v, rng); v.used = true; }
  else if (s.kind === 'fish') {
    const again = v.used;
    if (again) v.supplies--;
    const n = Math.round(base(v, rng) * (again ? 0.8 : 1));
    v.haul += n;
    v.note = `${again ? 'Another haul' : 'The nets come up full'}: +${money(n)}.`;
    v.used = true;
  } else if (s.kind === 'wreck') {
    v.used = true;
    if (rng() < 0.4) { hurt(v); v.note = 'Debris tears the hull. -1 hull.'; }
    else { const n = base(v, rng) * 2; v.haul += n; v.note = `Treasure in the hold: +${money(n)}.`; }
  } else {
    const p = traderPrices(v);
    if (k === 0 && v.haul >= p.supplies) { v.haul -= p.supplies; v.supplies += 2; v.used = true; v.note = 'Fresh supplies loaded: +2.'; }
    else if (k === 1 && v.haul >= p.repair && v.hull < VOYAGE.hull) { v.haul -= p.repair; v.hull++; v.used = true; v.note = 'The hull is patched: +1.'; }
    else v.note = v.haul < Math.min(p.supplies, p.repair) ? 'Not enough in the hold to pay.' : 'The hull needs no repair.';
  }
  check(v);
}

/** Out of hull, or not enough supplies left to reach the legend: the voyage fails and the haul is lost. */
function check(v: VoyageState): void {
  const movesLeft = v.rows.length - 1 - v.row + 1; // remaining rows, then the legend
  if (v.hull <= 0) end(v, 'failed', 'The hull gives out. You limp home, the hold lost.');
  else if (v.stage === 'map' && v.supplies < movesLeft) end(v, 'failed', 'Out of supplies. You turn for home, the hold lost.');
}

function end(v: VoyageState, result: 'caught' | 'lost' | 'failed', note: string): void {
  v.stage = 'over';
  v.result = result;
  v.note = note;
  if (result === 'failed') v.haul = 0;
}

/** From the last row, sail on to the legend's spot (one supply): the fight. */
export function sailToLegend(v: VoyageState): boolean {
  if (v.stage !== 'map' || v.row !== v.rows.length - 1 || v.supplies < 1) return false;
  v.supplies--;
  v.stage = 'fight';
  v.note = `${legendOf(v).spot}. Something huge takes the bait...`;
  return true;
}

/** How the fight went. */
export function fightOver(v: VoyageState, caught: boolean, kg: number): void {
  if (v.stage !== 'fight') return;
  v.kg = kg;
  end(v, caught ? 'caught' : 'lost', caught ? `You land the ${legendOf(v).name}!` : `The ${legendOf(v).name} got away. You head home with the haul.`);
}

/** Pearls for landing this legend. */
export function pearlsFor(l: LegendDef): number {
  return l.id === 'theoldone' ? VOYAGE.pearls.old : VOYAGE.pearls[l.region as Region];
}
