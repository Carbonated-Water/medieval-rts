import { RODS, TIERS, type FishDef } from './data';
import { drawFish } from './fishart';
import type { Game } from './game';

export type Place = 'market' | 'dock';

/** Key positions, recomputed from the canvas size every frame (CSS px). */
interface Layout {
  w: number;
  h: number;
  skyBottom: number;
  riverTop: number;
  riverBottom: number;
  path: number; // y the player walks along
  marketX: number;
  dockX: number;
  dockEnd: number; // y of the dock's far end (where you fish)
  bobber: { x: number; y: number };
}

interface Shadow { x: number; y: number; speed: number; size: number; phase: number }
interface Ripple { x: number; y: number; t: number; big: boolean }

const WALK_SPEED = 0.42; // screen widths per second
const SKY = ['#8fd0f0', '#cdeefa'];

/**
 * The riverbank, drawn with Canvas 2D. Owns the player's position and walking;
 * reads the fishing line state from Game to draw the cast, bobber and catches.
 */
export class Scene {
  private ctx: CanvasRenderingContext2D;
  private dpr = Math.min(devicePixelRatio || 1, 2);
  private time = 0;
  private L!: Layout;
  /** Player position as fractions of the layout: x along the path, then up the dock. */
  private px = 0.42;
  private onDock = 0; // 0 = on the path, 1 = at the dock's end
  private route: { x?: number; dock?: number }[] = [];
  private arrival: Place | null = null;
  private facing = 1;
  private walkPhase = 0;
  private stepping = 0; // seconds of keyboard walking left to animate
  private shadows: Shadow[] = [];
  private ripples: Ripple[] = [];
  private flying: { fish: FishDef; t: number } | null = null;
  private lastLine = '';
  private clouds = Array.from({ length: 5 }, (_, i) => ({ x: i * 0.25 + Math.random() * 0.1, y: 0.05 + Math.random() * 0.14, s: 0.6 + Math.random() * 0.6 }));
  onArrive: (p: Place) => void = () => {};

  constructor(private canvas: HTMLCanvasElement, private game: Game) {
    this.ctx = canvas.getContext('2d')!;
    for (let i = 0; i < 9; i++) this.shadows.push(this.newShadow(Math.random()));
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  /** Where the player is standing, if at a named place. */
  get place(): Place | null {
    if (this.route.length) return null;
    if (this.onDock >= 1) return 'dock';
    if (Math.abs(this.px - 0.2) < 0.04 && this.onDock === 0) return 'market';
    return null;
  }

  get walking(): boolean {
    return this.route.length > 0;
  }

  // ---------- input ----------

  /** What's at a screen point. */
  hit(x: number, y: number): Place | 'ground' {
    const L = this.L;
    if (Math.abs(x - L.marketX) < L.w * 0.14 && y > L.path - L.h * 0.22 && y < L.path + 30) return 'market';
    if (y < L.riverBottom + 10 && y > L.skyBottom) return 'dock';
    return 'ground';
  }

  walkTo(place: Place | 'ground', groundX?: number): void {
    const target = place === 'market' ? 0.2 : place === 'dock' ? 0.62 : Math.max(0.06, Math.min(0.94, (groundX ?? 0) / this.L.w));
    this.route = [];
    if (this.onDock > 0) this.route.push({ dock: 0 });
    this.route.push({ x: target });
    if (place === 'dock') this.route.push({ dock: 1 });
    this.arrival = place === 'ground' ? null : place;
    if (this.route.length && this.game.line.type !== 'idle') this.game.stopFishing();
  }

  /** Keyboard walking: -1 / +1 along the path (steps off the dock first). */
  nudge(dir: number, dt: number): void {
    if (dir === 0) return;
    this.route = [];
    this.arrival = null;
    if (this.game.line.type !== 'idle') this.game.stopFishing();
    if (this.onDock > 0) { this.onDock = Math.max(0, this.onDock - dt * 2.5); this.walkPhase += dt * 10; return; }
    this.px = Math.max(0.06, Math.min(0.94, this.px + dir * WALK_SPEED * dt));
    this.facing = dir;
    this.stepping = 0.1;
    this.walkPhase += dt * 10;
  }

  // ---------- frame ----------

  update(dt: number): void {
    this.time += dt;
    this.stepping = Math.max(0, this.stepping - dt);
    this.walk(dt);
    this.trackLine();
    for (const s of this.shadows) {
      s.x += s.speed * dt;
      if (s.x < -0.1 || s.x > 1.1) Object.assign(s, this.newShadow(s.speed > 0 ? -0.05 : 1.05));
    }
    this.ripples = this.ripples.filter((r) => (r.t += dt) < (r.big ? 1.2 : 0.9));
    if (this.flying) {
      this.flying.t += dt;
      if (this.flying.t > 1.6) this.flying = null;
    }
    for (const c of this.clouds) {
      c.x += dt * 0.006 * c.s;
      if (c.x > 1.2) c.x = -0.2;
    }
    this.draw();
  }

  private walk(dt: number): void {
    const step = this.route[0];
    if (!step) return;
    this.walkPhase += dt * 10;
    if (step.x !== undefined) {
      const d = step.x - this.px;
      const move = WALK_SPEED * dt;
      if (Math.abs(d) <= move) { this.px = step.x; this.route.shift(); } else { this.px += Math.sign(d) * move; this.facing = Math.sign(d); }
    } else if (step.dock !== undefined) {
      const d = step.dock - this.onDock;
      const move = dt * 2.2;
      if (Math.abs(d) <= move) { this.onDock = step.dock; this.route.shift(); } else this.onDock += Math.sign(d) * move;
    }
    if (!this.route.length && this.arrival) {
      const p = this.arrival;
      this.arrival = null;
      if (p === 'dock') this.facing = 1;
      this.onArrive(p);
    }
  }

  /** React to fishing state changes: splashes, the caught fish leaping out. */
  private trackLine(): void {
    const line = this.game.line;
    const key = line.type + (line.type === 'result' ? line.outcome : '');
    if (key === this.lastLine) return;
    this.lastLine = key;
    const b = this.L.bobber;
    if (line.type === 'waiting') this.ripples.push({ x: b.x, y: b.y, t: 0, big: false });
    if (line.type === 'bite') this.ripples.push({ x: b.x, y: b.y, t: 0, big: true });
    if (line.type === 'result' && line.outcome === 'caught' && line.fish) {
      this.flying = { fish: line.fish, t: 0 };
      this.ripples.push({ x: b.x, y: b.y, t: 0, big: true });
    }
    if (line.type === 'result' && line.outcome === 'snapped') this.ripples.push({ x: b.x, y: b.y, t: 0, big: true });
  }

  private newShadow(x: number): Shadow {
    return {
      x,
      y: 0.12 + Math.random() * 0.76, // fraction down the river band
      speed: (Math.random() < 0.5 ? -1 : 1) * (0.02 + Math.random() * 0.05),
      size: 0.6 + Math.random() * 0.9,
      phase: Math.random() * 10,
    };
  }

  private resize(): void {
    const w = innerWidth, h = innerHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    const riverTop = h * 0.36, riverBottom = h * 0.66;
    const dockX = w * 0.62;
    this.L = {
      w, h,
      skyBottom: h * 0.24,
      riverTop,
      riverBottom,
      path: h * 0.76,
      marketX: w * 0.2,
      dockX,
      dockEnd: riverTop + (riverBottom - riverTop) * 0.42,
      bobber: { x: Math.min(w * 0.86, dockX + Math.max(90, w * 0.2)), y: riverTop + (riverBottom - riverTop) * 0.3 },
    };
  }

  // ---------- drawing ----------

  private draw(): void {
    const { ctx, L } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, L.w, L.h);
    this.drawSky();
    this.drawFarBank();
    this.drawRiver();
    this.drawNearBank();
    this.drawDock();
    this.drawMarket();
    this.drawLine();
    this.drawPlayer();
    this.drawFlyingFish();
  }

  private drawSky(): void {
    const { ctx, L } = this;
    const g = ctx.createLinearGradient(0, 0, 0, L.riverTop);
    g.addColorStop(0, SKY[0]!);
    g.addColorStop(1, SKY[1]!);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, L.w, L.riverTop);
    ctx.fillStyle = '#fff6c8';
    ctx.beginPath();
    ctx.arc(L.w * 0.84, L.h * 0.08, Math.min(L.w, L.h) * 0.055, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    for (const c of this.clouds) {
      const x = c.x * L.w, y = c.y * L.h, s = c.s * Math.min(L.w, L.h) * 0.05;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.arc(x + s * 1.1, y + s * 0.2, s * 0.8, 0, Math.PI * 2);
      ctx.arc(x - s * 1.0, y + s * 0.25, s * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawFarBank(): void {
    const { ctx, L } = this;
    // Hills.
    ctx.fillStyle = '#9cc98a';
    ctx.beginPath();
    ctx.moveTo(0, L.skyBottom + 10);
    for (let x = 0; x <= L.w; x += L.w / 6) ctx.quadraticCurveTo(x + L.w / 12, L.skyBottom - L.h * 0.06, x + L.w / 6, L.skyBottom + 6);
    ctx.lineTo(L.w, L.riverTop);
    ctx.lineTo(0, L.riverTop);
    ctx.fill();
    // Far grass strip.
    ctx.fillStyle = '#6fb34f';
    ctx.fillRect(0, L.riverTop - L.h * 0.035, L.w, L.h * 0.035);
    // Trees along the far bank.
    for (let i = 0; i < 14; i++) {
      const x = ((i * 0.083 + 0.02) % 1) * L.w;
      const s = L.h * (0.028 + ((i * 37) % 10) / 400);
      const y = L.riverTop - L.h * 0.03;
      ctx.fillStyle = '#6b4a2c';
      ctx.fillRect(x - s * 0.12, y - s * 0.6, s * 0.24, s * 0.7);
      ctx.fillStyle = i % 3 ? '#3f8a3a' : '#4f9e44';
      ctx.beginPath();
      ctx.arc(x, y - s * 1.1, s * 0.75, 0, Math.PI * 2);
      ctx.arc(x - s * 0.45, y - s * 0.75, s * 0.5, 0, Math.PI * 2);
      ctx.arc(x + s * 0.45, y - s * 0.75, s * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawRiver(): void {
    const { ctx, L } = this;
    const g = ctx.createLinearGradient(0, L.riverTop, 0, L.riverBottom);
    g.addColorStop(0, '#5fb3e0');
    g.addColorStop(1, '#2f7fbf');
    ctx.fillStyle = g;
    ctx.fillRect(0, L.riverTop, L.w, L.riverBottom - L.riverTop);
    const band = L.riverBottom - L.riverTop;

    // Fish shadows under the surface.
    for (const s of this.shadows) {
      const x = s.x * L.w, y = L.riverTop + s.y * band + Math.sin(this.time * 1.5 + s.phase) * 3;
      const len = L.w * 0.045 * s.size + 14;
      ctx.fillStyle = 'rgba(15,45,80,0.28)';
      ctx.beginPath();
      ctx.ellipse(x, y, len / 2, len / 6, 0, 0, Math.PI * 2);
      ctx.fill();
      const tail = s.speed > 0 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(x + (tail * len) / 2, y);
      ctx.lineTo(x + tail * len * 0.75, y - len / 6);
      ctx.lineTo(x + tail * len * 0.75, y + len / 6);
      ctx.fill();
    }

    // Flowing current lines.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 16; i++) {
      const y = L.riverTop + ((i * 0.37) % 1) * band;
      const x = ((i * 0.61 + this.time * (0.03 + (i % 3) * 0.012)) % 1.2 - 0.1) * L.w;
      const len = L.w * (0.04 + (i % 4) * 0.015);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + len / 2, y - 3, x + len, y);
      ctx.stroke();
    }

    // Ripples (casts, bites, catches).
    for (const r of this.ripples) {
      const k = r.t / (r.big ? 1.2 : 0.9);
      ctx.strokeStyle = `rgba(255,255,255,${0.85 * (1 - k)})`;
      ctx.lineWidth = 2;
      for (const m of r.big ? [1, 0.6] : [1]) {
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, (8 + k * 34) * m, (3 + k * 12) * m, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  private drawNearBank(): void {
    const { ctx, L } = this;
    ctx.fillStyle = '#c9b07a'; // muddy edge
    ctx.fillRect(0, L.riverBottom, L.w, L.h * 0.025);
    const g = ctx.createLinearGradient(0, L.riverBottom, 0, L.h);
    g.addColorStop(0, '#7cc25a');
    g.addColorStop(1, '#5aa043');
    ctx.fillStyle = g;
    ctx.fillRect(0, L.riverBottom + L.h * 0.02, L.w, L.h);
    // Dirt path.
    ctx.fillStyle = '#d8c08a';
    ctx.beginPath();
    ctx.ellipse(L.w / 2, L.path + 8, L.w * 0.62, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    // Grass tufts and flowers.
    for (let i = 0; i < 40; i++) {
      const x = ((i * 0.137) % 1) * L.w;
      const y = L.riverBottom + L.h * 0.04 + ((i * 0.293) % 1) * (L.h - L.riverBottom - L.h * 0.06);
      if (Math.abs(y - L.path - 8) < 20) continue;
      ctx.strokeStyle = '#4a8a36';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 4, y); ctx.lineTo(x - 6, y - 7);
      ctx.moveTo(x, y); ctx.lineTo(x, y - 9);
      ctx.moveTo(x + 4, y); ctx.lineTo(x + 6, y - 7);
      ctx.stroke();
      if (i % 5 === 0) {
        ctx.fillStyle = i % 2 ? '#fff' : '#ffd84a';
        ctx.beginPath(); ctx.arc(x + 8, y - 4, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  private drawDock(): void {
    const { ctx, L } = this;
    const w = Math.max(46, L.w * 0.07);
    const x = L.dockX - w / 2;
    const top = L.dockEnd - 14;
    // Posts.
    ctx.fillStyle = '#5a3e24';
    for (const px of [x + 3, x + w - 9]) ctx.fillRect(px, top + 10, 6, L.riverBottom - top + 4);
    // Planks.
    for (let y = top; y < L.riverBottom + L.h * 0.03; y += 9) {
      ctx.fillStyle = (Math.round((y - top) / 9) % 2) ? '#a8784a' : '#b98a58';
      ctx.fillRect(x, y, w, 8);
    }
    ctx.strokeStyle = 'rgba(60,40,20,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, top, w, L.riverBottom + L.h * 0.03 - top);
  }

  private drawMarket(): void {
    const { ctx, L } = this;
    const w = Math.max(120, L.w * 0.2), h = Math.max(110, L.h * 0.16);
    const x = L.marketX - w / 2, base = L.path - 6;
    // Counter with fish crates.
    ctx.fillStyle = '#8a5a32';
    ctx.fillRect(x, base - h * 0.42, w, h * 0.42);
    ctx.fillStyle = '#a8703e';
    ctx.fillRect(x - 4, base - h * 0.46, w + 8, h * 0.07);
    for (let i = 0; i < 3; i++) {
      const cx = x + w * (0.2 + i * 0.3);
      ctx.fillStyle = '#c89a62';
      ctx.fillRect(cx - w * 0.11, base - h * 0.56, w * 0.22, h * 0.12);
      ctx.fillStyle = ['#9fc3d8', '#f0a868', '#c8d0a0'][i]!;
      ctx.beginPath(); ctx.ellipse(cx, base - h * 0.57, w * 0.08, h * 0.03, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Posts.
    ctx.fillStyle = '#5a3e24';
    ctx.fillRect(x + 2, base - h, 7, h);
    ctx.fillRect(x + w - 9, base - h, 7, h);
    // Striped awning.
    const stripes = 6;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 ? '#fff4e0' : '#e0503a';
      ctx.beginPath();
      ctx.moveTo(x - 10 + (i * (w + 20)) / stripes, base - h);
      ctx.lineTo(x - 10 + ((i + 1) * (w + 20)) / stripes, base - h);
      ctx.lineTo(x - 10 + ((i + 1) * (w + 20)) / stripes, base - h + 14);
      ctx.quadraticCurveTo(x - 10 + ((i + 0.5) * (w + 20)) / stripes, base - h + 22, x - 10 + (i * (w + 20)) / stripes, base - h + 14);
      ctx.fill();
    }
    ctx.fillStyle = '#c0402c';
    ctx.fillRect(x - 10, base - h - 8, w + 20, 9);
    // Sign, sized to its text.
    ctx.font = '700 13px Georgia, serif';
    const sw = ctx.measureText('FISH MARKET').width + 18, sh = 20;
    ctx.fillStyle = '#f7e7c2';
    ctx.strokeStyle = '#5a3e24';
    ctx.lineWidth = 2;
    ctx.fillRect(L.marketX - sw / 2, base - h - 32, sw, sh);
    ctx.strokeRect(L.marketX - sw / 2, base - h - 32, sw, sh);
    ctx.fillStyle = '#5a3e24';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FISH MARKET', L.marketX, base - h - 22);
  }

  /** Player's feet position. */
  private feet(): { x: number; y: number } {
    const L = this.L;
    const x = this.px * L.w;
    const pathX = x, dockX = L.dockX;
    // Walking onto the dock: slide over to its centre line, then up it.
    const fx = this.onDock > 0 ? dockX : pathX;
    return { x: fx, y: L.path - (L.path - L.dockEnd) * this.onDock };
  }

  private rodTip(): { x: number; y: number } {
    const f = this.feet();
    const s = this.scale();
    const line = this.game.line;
    const pull = line.type === 'bite' ? Math.sin(this.time * 30) * 4 : 0;
    return { x: f.x + this.facing * 44 * s, y: f.y - 64 * s + pull };
  }

  private scale(): number {
    return Math.max(0.8, Math.min(1.3, this.L.h / 760)) * (1 - this.onDock * 0.12);
  }

  private drawPlayer(): void {
    const { ctx } = this;
    const f = this.feet();
    const s = this.scale();
    const walking = this.route.length > 0 || this.stepping > 0;
    const swing = walking ? Math.sin(this.walkPhase) * 5 : 0;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(s, s);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(0, 2, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
    // Legs.
    ctx.strokeStyle = '#3a4a6a';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-4, -22); ctx.lineTo(-4 + swing, 0); ctx.moveTo(4, -22); ctx.lineTo(4 - swing, 0); ctx.stroke();
    // Body (overalls).
    ctx.fillStyle = '#4a6aa0';
    ctx.beginPath(); ctx.roundRect(-11, -46, 22, 28, 6); ctx.fill();
    ctx.fillStyle = '#e8d8b0';
    ctx.fillRect(-11, -46, 22, 8);
    // Arm holding the rod.
    ctx.strokeStyle = '#f0c8a0';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(this.facing * 6, -40); ctx.lineTo(this.facing * 16, -34); ctx.stroke();
    // Head and straw hat.
    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath(); ctx.arc(0, -55, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(this.facing * 4, -56, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8c860';
    ctx.beginPath(); ctx.ellipse(0, -61, 15, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -65, 8, 6, 0, Math.PI, 0); ctx.fill();
    ctx.restore();

    // The rod.
    const tip = this.rodTip();
    ctx.strokeStyle = RODS[this.game.rod]!.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(f.x + this.facing * 15 * s, f.y - 34 * s);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    // "!" when something bites.
    if (this.game.line.type === 'bite') {
      ctx.fillStyle = '#ffdf3a';
      ctx.strokeStyle = '#7a4a00';
      ctx.lineWidth = 3;
      ctx.font = `900 ${Math.round(34 * s)}px Georgia, serif`;
      ctx.textAlign = 'center';
      const y = f.y - 90 * s + Math.sin(this.time * 18) * 3;
      ctx.strokeText('!', f.x, y);
      ctx.fillText('!', f.x, y);
    }
  }

  private drawLine(): void {
    const { ctx, L } = this;
    const line = this.game.line;
    if (line.type === 'idle' || (line.type === 'result' && line.outcome !== 'caught' && line.t > 0.4)) return;
    const tip = this.rodTip();
    let bx = L.bobber.x, by = L.bobber.y;
    if (line.type === 'casting') {
      // Arc from the rod tip out to the water.
      const k = Math.min(1, line.t / 0.6);
      bx = tip.x + (L.bobber.x - tip.x) * k;
      by = tip.y + (L.bobber.y - tip.y) * k - Math.sin(k * Math.PI) * L.h * 0.12;
    } else if (line.type === 'waiting') {
      by += Math.sin(this.time * 3) * 2;
    } else if (line.type === 'bite') {
      by += 6 + Math.sin(this.time * 25) * 4; // dipping hard
    } else if (line.type === 'result') {
      const k = Math.min(1, line.t / 0.5);
      bx = L.bobber.x + (tip.x - L.bobber.x) * k;
      by = L.bobber.y + (tip.y - L.bobber.y) * k;
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.quadraticCurveTo((tip.x + bx) / 2, Math.max(tip.y, by) + 18, bx, by);
    ctx.stroke();
    if (line.type !== 'result') {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8402a';
      ctx.beginPath(); ctx.arc(bx, by, 5, Math.PI, 0); ctx.fill();
    }
  }

  private drawFlyingFish(): void {
    if (!this.flying) return;
    const { ctx, L } = this;
    const { fish, t } = this.flying;
    const tip = this.rodTip();
    const k = Math.min(1, t / 0.7);
    const x = L.bobber.x + (tip.x - L.bobber.x) * k;
    const y = L.bobber.y + (tip.y + 30 - L.bobber.y) * k - Math.sin(k * Math.PI) * L.h * 0.12;
    const len = Math.min(L.w, L.h) * 0.12 + fish.tier * 6;
    ctx.save();
    ctx.globalAlpha = t > 1.3 ? Math.max(0, 1 - (t - 1.3) / 0.3) : 1;
    // Tier-coloured sparkle ring.
    ctx.strokeStyle = TIERS[fish.tier].color;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, len * 0.6 + Math.sin(t * 12) * 3, 0, Math.PI * 2); ctx.stroke();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 14) * 0.3);
    drawFish(ctx, fish, 0, 0, len, -1);
    ctx.restore();
  }
}
