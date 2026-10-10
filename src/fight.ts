import { FIGHT, type LegendDef } from './data';

/** How a fight ended ('worn': the line wore through on a snag). */
export type FightEnd = 'caught' | 'snapped' | 'spat' | 'worn';

/**
 * A big-fish fight (pure logic, no DOM). Hold to reel: line tension rises and
 * the fish tires while tension sits in the green band. Release and the fish
 * pulls the tension back down. Every few seconds it warns, then runs: reeling
 * against a run snaps the line, letting go is safe and tires the fish. The
 * reel spins up while held, so steady reeling beats tapping. Tension at the
 * top snaps the line; slack too long and it spits the hook.
 *
 * Region twists (a legend's \`twists\`):
 * - snag (coast): the line catches; reel to pull it free (the fish doesn't
 *   tire meanwhile); letting go wears the line, and worn through it breaks.
 * - waves (open ocean): the green band slides with the swell and narrows in
 *   rough water.
 * - dark (abyss): the bar is only lit when the lure flashes (\`lit\`).
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
  /** Snag: caught on something; how far it's pulled free, how worn the line is (each 0..1). */
  snagged = false;
  free = 0;
  wear = 0;
  time = 0;
  end: FightEnd | null = null;
  private next: number;
  private snagNext: number;
  private flash = 0;
  private flashNext: number;

  constructor(readonly fish: LegendDef, private rng: () => number = Math.random, private reel = FIGHT.reel) {
    this.next = this.gap();
    this.snagNext = this.span(FIGHT.snagEvery);
    this.flashNext = this.span(FIGHT.flashEvery);
  }

  private span([lo, hi]: [number, number]): number {
    return lo + this.rng() * (hi - lo);
  }

  private gap(): number {
    return this.fish.surgeEvery * (0.6 + this.rng() * 0.8);
  }

  private has(t: 'snag' | 'waves' | 'dark'): boolean {
    return this.fish.twists.includes(t);
  }

  get surging(): boolean {
    return this.surge > 0;
  }

  /** The green band right now: fixed, or riding the swell (waves). */
  get band(): [number, number] {
    const [g0, g1] = FIGHT.green;
    if (!this.has('waves')) return [g0, g1];
    const shift = Math.sin(this.time * FIGHT.waveSpeed) * FIGHT.waveAmp;
    const narrow = FIGHT.waveNarrow * (0.5 + 0.5 * Math.sin(this.time * FIGHT.waveRough));
    return [g0 + shift + narrow / 2, g1 + shift - narrow / 2];
  }

  /** Can you see the bar? Always, except in the dark between the lure's flashes. */
  get lit(): boolean {
    return !this.has('dark') || this.flash > 0;
  }

  /** Where the tension sits: slack (about to lose the hook), low, green (reeling well), high (about to snap). */
  get zone(): 'slack' | 'low' | 'green' | 'high' {
    const t = this.tension, [g0, g1] = this.band;
    return t < FIGHT.slack ? 'slack' : t < g0 ? 'low' : t <= g1 ? 'green' : 'high';
  }

  update(dt: number, holding: boolean): void {
    if (this.end) return;
    this.time += dt;
    const pull = this.fish.pull;
    // The reel spins up while held and stops quickly when let go: taps never get it going.
    this.spin = Math.max(0, Math.min(1, this.spin + (holding ? dt / FIGHT.spinUp : -dt / FIGHT.spinDown)));
    // Darkness: the lure flashes now and then and lights the bar.
    if (this.has('dark')) {
      if (this.flash > 0) this.flash -= dt;
      else if ((this.flashNext -= dt) <= 0) { this.flash = FIGHT.flashLen; this.flashNext = this.span(FIGHT.flashEvery); }
    }
    // Snags start only in calm water (never during a warning or a run).
    if (this.has('snag') && !this.snagged && this.warn <= 0 && !this.surging && (this.snagNext -= dt) <= 0) {
      this.snagged = true; this.free = 0; this.wear = 0;
      this.snagNext = this.span(FIGHT.snagEvery);
    }
    if (this.snagged) {
      // Caught on kelp or coral: reeling pulls against the snag (tension climbs slowly) and frees it; let go and the line wears.
      this.tension = Math.max(0, this.tension + (holding ? FIGHT.snagReel : -FIGHT.snagEase) * dt);
      if (holding) this.free += this.spin * FIGHT.snagFree * dt;
      else this.wear += FIGHT.snagWear * dt;
      if (this.free >= 1) { this.snagged = false; this.wear = 0; }
    } else {
      // Runs: a warning first, then a hard pull, then a calm spell.
      if (this.surge > 0) this.surge -= dt;
      else if (this.warn > 0) { this.warn -= dt; if (this.warn <= 0) this.surge = FIGHT.surgeLen * (0.7 + this.rng() * 0.6); }
      else if ((this.next -= dt) <= 0) { this.warn = FIGHT.warning; this.next = this.gap(); }
      if (this.surging) {
        // Reeling against a run (even a tap) sends the tension shooting up; letting go
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
    }
    this.slack = this.zone === 'slack' ? this.slack + dt : 0;
    if (this.tension >= 1) this.end = 'snapped';
    else if (this.wear >= 1) this.end = 'worn';
    else if (this.slack >= FIGHT.spit) this.end = 'spat';
    else if (this.stamina <= 0) { this.stamina = 0; this.end = 'caught'; }
  }
}
