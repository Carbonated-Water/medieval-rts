import { FIGHT } from './data';
import type { Fight } from './fight';
import { pixelFishIcon } from './pixelart';

/**
 * The fight screen: a full-screen overlay over the game. The fish swims below
 * the surface and leaps out when it surges; the line runs from the top; the
 * tension bar (slack, low, green, red) and the fish's stamina sit above a big
 * HOLD area. Hold anywhere (or Space) to reel. When it ends, a result card
 * with OK hands back to the game.
 */
export class FightView {
  private el = document.createElement('div');
  private fight: Fight | null = null;
  private holding = false;
  private shownEnd = false;
  /** The fish's swimming clock (it stops while the line is snagged). */
  private roam = 0;
  private parts!: {
    fish: HTMLImageElement; line: SVGLineElement; mark: HTMLElement; stam: HTMLElement; prompt: HTMLElement; result: HTMLElement; water: HTMLElement; hold: HTMLElement;
    low: HTMLElement; green: HTMLElement; red: HTMLElement; snag: HTMLElement; free: HTMLElement; wear: HTMLElement;
  };

  constructor(private onEnd: (f: Fight) => void) {
    this.el.id = 'fight';
    document.body.appendChild(this.el);
    const down = (e: Event) => {
      if (!this.fight || this.fight.end || (e.target as Element).closest('[data-act]')) return;
      e.preventDefault();
      this.holding = true;
    };
    this.el.addEventListener('pointerdown', down);
    for (const ev of ['pointerup', 'pointercancel', 'blur'] as const) addEventListener(ev, () => { this.holding = false; });
    // Space reels too (captured before the game's own Space).
    addEventListener('keydown', (e) => { if (this.active && e.code === 'Space') { e.preventDefault(); e.stopImmediatePropagation(); if (!this.fight?.end) this.holding = true; } }, true);
    addEventListener('keyup', (e) => { if (this.active && e.code === 'Space') { e.stopImmediatePropagation(); this.holding = false; } }, true);
  }

  get active(): boolean {
    return !!this.fight;
  }

  start(fight: Fight): void {
    this.fight = fight;
    this.holding = false;
    this.shownEnd = false;
    const f = fight.fish, [g0, g1] = FIGHT.green;
    this.el.innerHTML = `<div class="water"><div class="surface"></div>
        <svg class="rope" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="50" y1="0" x2="50" y2="60"/></svg>
        <img class="fish" src="${pixelFishIcon(f, false, 192, 112)}" alt="${f.name}"></div>
      <div class="top"><b>${f.name}</b><div class="stam"><i></i></div>
        <div class="snag"><small>FREE</small><div class="bar free"><i></i></div><small>WEAR</small><div class="bar wear"><i></i></div></div></div>
      <div class="prompt"></div>
      <div class="tension"><span class="z slack" style="width:${FIGHT.slack * 100}%"></span><span class="z low" style="width:${(g0 - FIGHT.slack) * 100}%"></span>
        <span class="z green" style="width:${(g1 - g0) * 100}%"></span><span class="z red" style="width:${(1 - g1) * 100}%"></span><i class="mark"></i></div>
      <div class="hold">HOLD TO REEL</div>
      <div class="result"></div>`;
    const q = <T extends Element>(s: string) => this.el.querySelector(s) as unknown as T;
    this.parts = { fish: q('.fish'), line: q('.rope line'), mark: q('.mark'), stam: q('.stam i'), prompt: q('.prompt'), result: q('.result'), water: q('.water'), hold: q('.hold'),
      low: q('.z.low'), green: q('.z.green'), red: q('.z.red'), snag: q('.snag'), free: q('.bar.free i'), wear: q('.bar.wear i') };
    this.el.className = `show region-${fight.fish.region}`; // a fresh screen: no result, surge or reeling state left from the last fight
    document.body.classList.add('fighting'); // the game's pop-ups and banners stay out of the fight (they still reach the inbox)
  }

  close(): void {
    this.fight = null;
    this.el.className = '';
    document.body.classList.remove('fighting');
    this.el.innerHTML = '';
  }

  update(dt: number): void {
    const f = this.fight;
    if (!f || (f.end && this.shownEnd)) return; // finished: the result card stays as it is
    f.update(dt, this.holding);
    const p = this.parts, t = f.time;
    // The fish roams side to side; on a surge it leaps out of the water in an arc.
    if (!f.snagged) this.roam += dt;
    const x = 50 + Math.sin(this.roam * 0.8) * 28 + Math.sin(this.roam * 2.3) * 6;
    const dir = Math.cos(this.roam * 0.8) >= 0 ? 1 : -1;
    const leap = f.surging ? Math.sin(Math.min(1, (FIGHT.surgeLen - f.surge) / FIGHT.surgeLen) * Math.PI) : 0;
    const shake = f.warn > 0 ? Math.sin(t * 60) * 1.5 : 0;
    const y = 66 - leap * 62 + Math.sin(t * 3) * 2;
    p.fish.style.left = `${x + shake}%`;
    p.fish.style.top = `${y}%`;
    p.fish.style.transform = `translate(-50%, -50%) scaleX(${dir}) rotate(${-leap * 25 * dir}deg)`;
    p.line.setAttribute('x2', String(x));
    p.line.setAttribute('y2', String(y));
    p.line.setAttribute('class', f.zone);
    p.mark.style.left = `${Math.min(1, f.tension) * 100}%`;
    // The green band as it is now (it rides the swell in open water); the bar goes dark in the abyss between flashes.
    const [g0, g1] = f.band;
    p.low.style.width = `${(g0 - FIGHT.slack) * 100}%`;
    p.green.style.width = `${(g1 - g0) * 100}%`;
    p.red.style.width = `${(1 - g1) * 100}%`;
    this.el.classList.toggle('dark', !f.lit);
    // A snag: how far it's pulled free, how worn the line is.
    this.el.classList.toggle('snagged', f.snagged);
    p.free.style.width = `${Math.min(1, f.free) * 100}%`;
    p.wear.style.width = `${Math.min(1, f.wear) * 100}%`;
    p.stam.style.width = `${f.stamina * 100}%`;
    this.el.classList.toggle('surge', f.surging);
    this.el.classList.toggle('warn', f.warn > 0);
    this.el.classList.toggle('reeling', this.holding && !f.end);
    // In the dark the tension prompts go quiet too (the fish's warnings and runs still show; the line still reddens when tight).
    const prompt = f.end ? '' : f.snagged ? 'SNAGGED! REEL!' : f.warn > 0 ? 'IT WANTS TO RUN!' : f.surging ? 'LET GO!' : !f.lit ? '' : f.zone === 'slack' ? 'REEL!' : f.zone === 'high' ? 'EASY...' : f.zone === 'green' && this.holding ? 'GOOD!' : 'REEL';
    if (p.prompt.textContent !== prompt) p.prompt.textContent = prompt;
    // The big button says what to do: in a warning or a run, let go.
    const cue = f.warn > 0 || f.surging ? 'LET GO!' : f.snagged ? 'REEL TO PULL FREE' : 'HOLD TO REEL';
    if (p.hold.textContent !== cue) p.hold.textContent = cue;
    // The button fills as the reel spins up: a steady hold fills it, taps barely move it.
    p.hold.style.setProperty('--spin', f.spin.toFixed(2));
    p.prompt.className = `prompt ${f.warn > 0 || f.surging || f.snagged ? 'bad' : f.zone === 'green' ? 'good' : ''}`;
    if (f.end && !this.shownEnd) {
      this.shownEnd = true;
      this.holding = false;
      const [title, sub] = f.end === 'caught' ? ['LANDED!', `${f.fish.name} · ${f.fish.kg.toLocaleString()} kg`]
        : f.end === 'snapped' ? ['SNAP!', 'The line broke. Let go when it runs.'] : f.end === 'worn' ? ['LINE WORE THROUGH', 'Reel through snags, do not let go.'] : ['IT GOT AWAY', 'Keep the line tight.'];
      p.result.innerHTML = `<div class="card ${f.end}"><b>${title}</b><small>${sub}</small><button class="btn" data-act="fightDone">OK</button></div>`;
      this.el.classList.add('over');
      if (f.end === 'caught') { p.fish.style.top = '30%'; p.fish.style.transform = 'translate(-50%, -50%)'; }
      this.onEnd(f);
    }
  }
}
