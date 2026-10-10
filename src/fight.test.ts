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
/** A stubborn one: reels in the comfortable range, and keeps reeling when the fish runs. */
const stubborn = (f: Fight) => f.surging || f.tension < FIGHT.green[1] - 0.12;

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

  it('holding on through a run snaps the line', () => {
    for (const l of LEGENDS) expect(play(l, stubborn).end, l.name).toBe('snapped');
  });

  it('letting go during a run is always safe: tension eases and the fish only recovers a little', () => {
    const f = new Fight(LEGENDS[2]!, rng(4));
    f.tension = 0.79; f.stamina = 0.5; f.surge = 2;
    for (let k = 0; k < 120; k++) f.update(1 / 60, false);
    expect(f.end).toBeNull();
    expect(f.tension).toBeLessThan(0.79);
    expect(f.stamina).toBeLessThan(0.6);
  });
});
