import { describe, expect, it } from 'vitest';
import { EnemyAI } from './ai';
import { ENEMY, PLAYER } from './config';
import { Game } from './game';

function simulate(game: Game, ai: EnemyAI, seconds: number) {
  for (let t = 0; t < seconds; t += 0.1) {
    game.tick(0.1);
    ai.tick(0.1);
  }
}

const enemyUnits = (g: Game) => g.units.filter((u) => u.owner === ENEMY);
const enemyBuildings = (g: Game) => [...g.buildings.values()].filter((b) => b.owner === ENEMY);

describe('EnemyAI', () => {
  it('grows an economy and an army under the normal rules', () => {
    const game = new Game(42);
    const ai = new EnemyAI(game);
    simulate(game, ai, 8 * 60);
    const peasants = enemyUnits(game).filter((u) => u.kind === 'peasant');
    const soldiers = enemyUnits(game).filter((u) => u.kind !== 'peasant');
    expect(peasants.length).toBeGreaterThanOrEqual(8);
    const kinds = new Set(enemyBuildings(game).filter((b) => b.progress >= 1).map((b) => b.kind));
    expect(kinds.has('house')).toBe(true);
    expect(kinds.has('barracks')).toBe(true);
    expect(soldiers.length).toBeGreaterThan(0);
    expect(game.popUsedOf(ENEMY)).toBeLessThanOrEqual(game.popCapOf(ENEMY));
  });

  it('stays peaceful when left alone', () => {
    const game = new Game(42);
    const ai = new EnemyAI(game);
    simulate(game, ai, 10 * 60);
    expect(game.provoked).toBe(false);
    const hall = game.buildings.get(game.hallIds[PLAYER])!;
    expect(hall.hp).toBe(hall.maxHp);
    expect(game.units.filter((u) => u.owner === PLAYER).every((u) => u.hp === u.maxHp)).toBe(true);
  });

  it('goes to war once provoked and attacks the player', () => {
    const game = new Game(42);
    const ai = new EnemyAI(game);
    simulate(game, ai, 8 * 60);
    // The player pokes an enemy peasant.
    const poker = game.spawnUnitNear(game.buildings.get(game.hallIds[ENEMY])!, 'swordsman')!;
    poker.owner = PLAYER;
    const victim = enemyUnits(game).find((u) => u.kind === 'peasant')!;
    game.orderAttack([poker], victim.id);
    simulate(game, ai, 4 * 60);
    expect(game.provoked).toBe(true);
    const hall = game.buildings.get(game.hallIds[PLAYER]);
    const hurt = !hall || hall.hp < hall.maxHp || game.units.some((u) => u.owner === PLAYER && u.hp < u.maxHp)
      || game.events.some((e) => e.type === 'death' && e.unit.owner === PLAYER);
    expect(hurt).toBe(true);
  });
});
