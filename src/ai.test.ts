import { describe, expect, it } from 'vitest';
import { Bots } from './ai';
import { NEUTRAL, PLAYER } from './config';
import { Game } from './game';

const simulate = (g: Game, bots: Bots, seconds: number) => {
  for (let t = 0; t < seconds; t += 0.1) { g.tick(0.1); bots.tick(0.1); }
};

describe('Bots', () => {
  it('expand: grab land and neutral towns', () => {
    const g = new Game(42);
    const bots = new Bots(g);
    const start = g.nations.slice(1).reduce((s, n) => s + n.territory, 0);
    simulate(g, bots, 90);
    const now = g.nations.slice(1).reduce((s, n) => s + n.territory, 0);
    expect(now).toBeGreaterThan(start * 2);
    expect(g.cities.filter((c) => !c.capital && c.owner !== NEUTRAL && c.owner !== PLAYER).length).toBeGreaterThan(2);
  });

  it('fight each other and knock nations out over a long game', () => {
    const g = new Game(42);
    const bots = new Bots(g);
    simulate(g, bots, 12 * 60);
    expect(g.events.some((e) => e.type === 'battle' && e.winner > 0 && e.loser > 0)).toBe(true);
    // The idle player gets eaten or someone else falls; either way the map is in motion.
    expect(g.alive().length).toBeLessThan(g.nations.length);
  });

  it('every bot has a personality', () => {
    const g = new Game(3);
    const bots = new Bots(g);
    expect(bots.personalities.size).toBe(g.nations.length - 1);
  });
});
