import { describe, expect, it } from 'vitest';
import { FIGHT, LEGENDS } from './data';
import { Fight } from './fight';

function rng(seed = 1) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
/** A strategy: hold or not this frame, given the fight and a scratch state. */
type Player = (f: Fight, st: { on: boolean; k: number }) => boolean;
/** Play a fight with a strategy at 60 fps; returns how it ended and how long it took. */
const play = (legend = LEGENDS[0]!, hold: Player, seed = 1) => {
  const f = new Fight(legend, rng(seed)), st = { on: true, k: 0 };
  while (!f.end && f.time < 300) f.update(1 / 60, hold(f, st));
  return { end: f.end, secs: Math.round(f.time) };
};
/** Reel in stretches inside the green band (as it is now): hold until the tension is high, let go until it eases. */
const stretches = (f: Fight, st: { on: boolean }) => {
  const [g0, g1] = f.band;
  if (st.on && f.tension >= g1 - 0.06) st.on = false;
  else if (!st.on && f.tension <= g0 + 0.1) st.on = true;
  return st.on;
};
/** On a snag, keep reeling and let go only for a breath near the red. */
const unsnag = (f: Fight, st: { on: boolean }) => {
  if (st.on && f.tension >= 0.88) st.on = false;
  else if (!st.on && f.tension <= 0.78) st.on = true;
  return st.on;
};
/** A sensible player: reels in stretches, reels through snags, and lets go when the fish warns or runs. */
const sensible: Player = (f, st) => (f.warn > 0 || f.surging ? (st.on = false) : f.snagged ? unsnag(f, st) : stretches(f, st));
/** A stubborn one: reels in stretches, and keeps reeling when the fish runs. */
const stubborn: Player = (f, st) => f.surging || stretches(f, st);
/** A spammer: taps as fast as they can (on and off every few frames). */
const spammer: Player = (f, st) => ++st.k % 10 < 5;

describe('big-fish fight', () => {
  it('holding the whole time snaps the line', () => {
    expect(play(LEGENDS[0], () => true).end).toBe('snapped');
  });

  it('never reeling lets the fish spit the hook', () => {
    expect(play(LEGENDS[0], () => false).end).toBe('spat');
  });

  it('a sensible player lands every legend, the harder ones taking longer', () => {
    const times = LEGENDS.map((l) => {
      const r = play(l, sensible);
      expect(r.end, l.name).toBe('caught');
      return r.secs;
    });
    expect(times[0]!).toBeGreaterThan(8);
    expect(times[times.length - 1]!).toBeGreaterThan(times[0]!); // The Old One outlasts the Kelp Wyrm
    expect(Math.max(...times)).toBeLessThan(150);
  });

  it('spamming taps loses: the reel never spins up and the line goes slack or snaps', () => {
    for (const l of LEGENDS) expect(play(l, spammer).end, l.name).not.toBe('caught');
  });

  it('holding on through a run snaps the line', () => {
    for (const l of LEGENDS) expect(play(l, stubborn).end, l.name).toBe('snapped');
  });

  it('letting go during a run is safe and pays: tension eases and the fish tires itself', () => {
    const f = new Fight(LEGENDS[2]!, rng(4));
    f.tension = 0.79; f.stamina = 0.5; f.surge = 2;
    for (let k = 0; k < 90; k++) f.update(1 / 60, false);
    expect(f.end).toBeNull();
    expect(f.tension).toBeLessThan(0.79);
    expect(f.stamina).toBeLessThan(0.5);
  });

  it('coast snags: reeling pulls the line free; letting go wears it through', () => {
    const coast = LEGENDS.find((l) => l.region === 'coast')!;
    const a = new Fight(coast, rng(2));
    a.snagged = true;
    for (let k = 0; k < 600 && a.snagged; k++) a.update(1 / 60, a.tension < 0.8);
    expect(a.snagged).toBe(false);
    expect(a.end).toBeNull();
    const b = new Fight(coast, rng(2));
    b.snagged = true;
    for (let k = 0; k < 600 && !b.end; k++) b.update(1 / 60, false);
    expect(b.end).toBe('worn');
  });

  it('ocean waves move and narrow the green band', () => {
    const f = new Fight(LEGENDS.find((l) => l.region === 'ocean')!, rng(3));
    const seen = new Set<string>();
    for (let k = 0; k < 900; k++) { f.update(1 / 60, false); seen.add(f.band[0].toFixed(2)); f.tension = 0.4; f.slack = 0; }
    expect(seen.size).toBeGreaterThan(10);
    expect(new Fight(LEGENDS[0]!, rng(3)).band).toEqual(FIGHT.green);
  });

  it('abyss darkness: the bar is lit only in flashes', () => {
    const f = new Fight(LEGENDS.find((l) => l.region === 'abyss')!, rng(4));
    let lit = 0, dark = 0;
    for (let k = 0; k < 600; k++) { f.update(1 / 60, false); f.tension = 0.4; f.slack = 0; if (f.lit) lit++; else dark++; }
    expect(lit).toBeGreaterThan(0);
    expect(dark).toBeGreaterThan(lit * 2);
    expect(new Fight(LEGENDS[0]!, rng(4)).lit).toBe(true);
  });
});
