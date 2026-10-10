import { describe, expect, it } from 'vitest';
import { FIGHT, LEGENDS } from './data';
import { Fight } from './fight';

function rng(seed = 1) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
/** Play a fight with a strategy (hold or not, given the fight) at 60 fps; returns how it ended and how long it took. */
const play = (legend = LEGENDS[0]!, hold: (f: Fight) => boolean, seed = 1) => {
  const f = new Fight(legend, rng(seed));
  while (!f.end && f.time < 300) f.update(1 / 60, hold(f));
  return { end: f.end, secs: Math.round(f.time) };
};
/** A sensible player: reel while the tension is comfortable, let go on a warning or a surge. */
const sensible = (f: Fight) => f.warn <= 0 && !f.surging && f.tension < FIGHT.green[1] - 0.12;
/** A reckless one: reels in the comfortable range but ignores surges. */
const reckless = (f: Fight) => f.tension < FIGHT.green[1] - 0.05;

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
    expect(times[2]!).toBeGreaterThan(times[0]!);
    expect(times[2]!).toBeLessThan(120);
  });

  it('ignoring the surge warnings loses to the hardest fish', () => {
    const losses = [1, 2, 3, 4, 5].filter((seed) => play(LEGENDS[2], reckless, seed).end !== 'caught').length;
    expect(losses).toBeGreaterThanOrEqual(4);
  });
});
