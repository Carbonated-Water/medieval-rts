import { TIERS, type FishDef } from './data';

/**
 * Draws a fish centred at (cx, cy), `len` pixels long, facing right (or
 * left with facing = -1). Shapes come from each species' colours and body
 * ratio, with a few per-species touches.
 */
export function drawFish(ctx: CanvasRenderingContext2D, f: FishDef, cx: number, cy: number, len: number, facing = 1, silhouette = false): void {
  const h = len / f.shape;
  const [body, belly, fin] = silhouette ? ['#2a3a48', '#2a3a48', '#2a3a48'] : f.colors;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(facing, 1);

  if (!silhouette && f.tier === 5) {
    // Legendary glow.
    const glow = ctx.createRadialGradient(0, 0, h * 0.2, 0, 0, len * 0.65);
    glow.addColorStop(0, `${TIERS[5].color}66`);
    glow.addColorStop(1, `${TIERS[5].color}00`);
    ctx.fillStyle = glow;
    ctx.fillRect(-len, -len, len * 2, len * 2);
  }

  const bodyLen = len * 0.78;
  const tailX = -bodyLen / 2;

  // Tail.
  ctx.fillStyle = fin;
  ctx.beginPath();
  ctx.moveTo(tailX + h * 0.15, 0);
  ctx.lineTo(tailX - len * 0.2, -h * 0.55);
  ctx.quadraticCurveTo(tailX - len * 0.12, 0, tailX - len * 0.2, h * 0.55);
  ctx.closePath();
  ctx.fill();

  // Dorsal and belly fins.
  ctx.beginPath();
  ctx.moveTo(-bodyLen * 0.15, -h * 0.42);
  ctx.quadraticCurveTo(bodyLen * 0.02, -h * (f.id === 'riverdragon' ? 1.05 : 0.85), bodyLen * 0.18, -h * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-bodyLen * 0.05, h * 0.42);
  ctx.quadraticCurveTo(bodyLen * 0.05, h * 0.72, bodyLen * 0.14, h * 0.4);
  ctx.closePath();
  ctx.fill();

  // Body with a belly gradient.
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, body);
  g.addColorStop(0.55, body);
  g.addColorStop(1, belly);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, bodyLen / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!silhouette) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyLen / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.clip();
    if (f.id === 'perch' || f.id === 'walleye' || f.id === 'zander') {
      ctx.fillStyle = 'rgba(30,40,20,0.35)';
      for (let i = -2; i <= 2; i++) ctx.fillRect(i * bodyLen * 0.14 - h * 0.06, -h / 2, h * 0.12, h * 0.6);
    }
    if (f.id === 'koi') {
      ctx.fillStyle = fin;
      ctx.beginPath(); ctx.ellipse(-bodyLen * 0.12, -h * 0.15, bodyLen * 0.14, h * 0.22, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = belly;
      ctx.beginPath(); ctx.ellipse(bodyLen * 0.15, h * 0.05, bodyLen * 0.1, h * 0.18, -0.2, 0, Math.PI * 2); ctx.fill();
    }
    if (f.id === 'eel') {
      ctx.fillStyle = belly;
      for (let i = -3; i <= 3; i++) ctx.fillRect(i * bodyLen * 0.12, -h / 2, bodyLen * 0.03, h);
    }
    if (f.id === 'pike' || f.id === 'ghostpike') {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 9; i++) ctx.beginPath(), ctx.ellipse(-bodyLen * 0.35 + i * bodyLen * 0.08, (i % 2 ? -1 : 1) * h * 0.1, h * 0.06, h * 0.04, 0, 0, Math.PI * 2), ctx.fill();
    }
    if (f.id === 'crystaltrout' || f.id === 'goldcarp' || f.tier >= 4) {
      // Sheen.
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath(); ctx.ellipse(bodyLen * 0.05, -h * 0.22, bodyLen * 0.32, h * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // Gill line and eye.
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = Math.max(1, h * 0.04);
    ctx.beginPath();
    ctx.arc(bodyLen * 0.22, 0, h * 0.32, -1, 1);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(bodyLen * 0.34, -h * 0.08, Math.max(1.5, h * 0.12), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(bodyLen * 0.355, -h * 0.08, Math.max(1, h * 0.07), 0, Math.PI * 2); ctx.fill();
    if (f.id === 'catfish') {
      ctx.strokeStyle = fin;
      ctx.lineWidth = Math.max(1, h * 0.05);
      ctx.beginPath(); ctx.moveTo(bodyLen * 0.45, h * 0.05); ctx.quadraticCurveTo(bodyLen * 0.6, h * 0.3, bodyLen * 0.55, h * 0.55); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bodyLen * 0.45, h * 0.0); ctx.quadraticCurveTo(bodyLen * 0.62, -h * 0.05, bodyLen * 0.62, h * 0.3); ctx.stroke();
    }
  }
  ctx.restore();
}

const iconCache = new Map<string, string>();

/** A fish picture as a data URL, for the HUD (cached). */
export function fishIcon(f: FishDef, silhouette = false, w = 96, h = 56): string {
  const key = `${f.id}:${silhouette}:${w}x${h}`;
  let url = iconCache.get(key);
  if (!url) {
    const c = document.createElement('canvas');
    const dpr = 2;
    c.width = w * dpr;
    c.height = h * dpr;
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    drawFish(ctx, f, w * 0.56, h / 2, w * 0.82, 1, silhouette);
    url = c.toDataURL();
    iconCache.set(key, url);
  }
  return url;
}
