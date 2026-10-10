import { FIGHT, type LegendDef } from './data';

/** How a fight ended. */
export type FightEnd = 'caught' | 'snapped' | 'spat';

/**
 * A big-fish fight (pure logic, no DOM). Hold to reel: line tension rises and
 * the fish tires while tension sits in the green band. Release and the fish
 * pulls the tension back down. Every few seconds it warns, then surges: pulls
 * hard enough that holding through it snaps the line. Tension at the top
 * snaps the line; slack too long and it spits the hook.
 */
export class Fight {
  /** 1 = fresh, 0 = landed. */
  stamina = 1;
  /** 0 = slack, 1 = snaps. */
  tension = 0.45;
  /** Seconds the line has been slack in a row. */
  slack = 0;
  /** How fast the reel is turning, 0..1 (spins up while held). */
  spin = 0;
  /** Seconds of surge left; seconds of warning before the next one. */
  surge = 0;
  warn = 0;
  time = 0;
  end: FightEnd | null = null;
  private next: number;

  constructor(readonly fish: LegendDef, private rng: () => number = Math.random, private reel = FIGHT.reel) {
    this.next = this.gap();
  }

  private gap(): number {
    return this.fish.surgeEvery * (0.6 + this.rng() * 0.8);
  }

  get surging(): boolean {
    return this.surge > 0;
  }

  /** Where the tension sits: slack (about to lose the hook), low, green (reeling well), high (about to snap). */
  get zone(): 'slack' | 'low' | 'green' | 'high' {
    const t = this.tension;
    return t < FIGHT.slack ? 'slack' : t < FIGHT.green[0] ? 'low' : t <= FIGHT.green[1] ? 'green' : 'high';
  }

  update(dt: number, holding: boolean): void {
    if (this.end) return;
    this.time += dt;
    // Surges: a warning first, then a hard pull, then a calm spell.
    if (this.surge > 0) this.surge -= dt;
    else if (this.warn > 0) { this.warn -= dt; if (this.warn <= 0) this.surge = FIGHT.surgeLen * (0.7 + this.rng() * 0.6); }
    else if ((this.next -= dt) <= 0) { this.warn = FIGHT.warning; this.next = this.gap(); }
    const pull = this.fish.pull;
    // The reel spins up while held and stops quickly when let go: taps never get it going.
    this.spin = Math.max(0, Math.min(1, this.spin + (holding ? dt / FIGHT.spinUp : -dt / FIGHT.spinDown)));
    if (this.surging) {
      // A run: reeling against it (even a tap) sends the tension shooting up; letting go
      // is safe and pays: the tension eases and the fish wears itself out on the line.
      if (holding) this.tension += (FIGHT.runHold + pull * this.fish.surgePower) * dt;
      else {
        this.tension = Math.max(0, this.tension - FIGHT.runEase * dt);
        this.stamina -= FIGHT.runTire * dt;
      }
    } else this.tension = Math.max(0, this.tension + (holding ? FIGHT.reelTension + pull * FIGHT.pullOnReel : pull - FIGHT.ease) * dt);
    // Reeling tires the fish, by how fast the reel spins: best in the green, a little with a loose line, a bit more (but risky) up high.
    if (holding) {
      const z = this.zone, k = z === 'green' ? 1 : z === 'high' ? 1.3 : 0.4;
      this.stamina -= (this.reel * this.spin * k * dt) / this.fish.stamina;
    }
    this.slack = this.zone === 'slack' ? this.slack + dt : 0;
    if (this.tension >= 1) this.end = 'snapped';
    else if (this.slack >= FIGHT.spit) this.end = 'spat';
    else if (this.stamina <= 0) { this.stamina = 0; this.end = 'caught'; }
  }
}
