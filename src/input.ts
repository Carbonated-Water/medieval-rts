/** What input needs from the camera. Screen coordinates are CSS pixels. */
export interface PanZoom {
  panBy(dx: number, dy: number): void;
  zoomAt(factor: number, sx: number, sy: number): void;
}

const TAP_SLOP = 10; // px of finger travel before a touch becomes a pan
const KEY_PAN_SPEED = 900; // screen px / sec for WASD / arrow keys

/** Keyboard pan directions (screen space: +x right, +y down). */
const KEYS: Record<string, [number, number]> = {
  KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};

/**
 * Drag = pan, two finger pinch = zoom, wheel = zoom, WASD / arrows = pan.
 * A touch that never moves past TAP_SLOP is a tap. Returns a per-frame
 * update for the keyboard pan.
 */
export function attachInput(el: HTMLElement, cam: PanZoom, onTap: (sx: number, sy: number) => void): (dt: number) => void {
  const pts = new Map<number, { x: number; y: number }>();
  let start: { x: number; y: number } | null = null;
  let panning = false;
  let pinchDist = 0;
  const held = new Set<string>();

  addEventListener('keydown', (e) => {
    if (KEYS[e.code]) { held.add(e.code); e.preventDefault(); }
  });
  addEventListener('keyup', (e) => held.delete(e.code));
  addEventListener('blur', () => held.clear());
  el.addEventListener('contextmenu', (e) => e.preventDefault());

  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) {
      start = { x: e.clientX, y: e.clientY };
      panning = false;
    } else {
      start = null; // a second finger cancels any tap and starts a pinch
      pinchDist = pinchSpan();
    }
  });

  el.addEventListener('pointermove', (e) => {
    const prev = pts.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (pts.size === 1) {
      if (!panning && start && Math.hypot(cur.x - start.x, cur.y - start.y) > TAP_SLOP) panning = true;
      if (panning) cam.panBy(cur.x - prev.x, cur.y - prev.y);
      pts.set(e.pointerId, cur);
    } else if (pts.size === 2) {
      const before = midpoint();
      pts.set(e.pointerId, cur);
      const after = midpoint();
      const d = pinchSpan();
      if (pinchDist > 0) cam.zoomAt(d / pinchDist, after.x, after.y);
      cam.panBy(after.x - before.x, after.y - before.y);
      pinchDist = d;
    }
  });

  const end = (e: PointerEvent) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size === 0 && start && !panning && e.type === 'pointerup' && e.button === 0) onTap(e.clientX, e.clientY);
    if (pts.size === 1) pinchDist = 0;
    if (pts.size === 0) start = null;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);

  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    cam.zoomAt(Math.pow(1.0015, -e.deltaY), e.clientX, e.clientY);
  }, { passive: false });

  return (dt: number) => {
    let dx = 0, dy = 0;
    for (const code of held) { dx += KEYS[code]![0]; dy += KEYS[code]![1]; }
    // Moving the view right means dragging the map left.
    if (dx || dy) cam.panBy(-dx * KEY_PAN_SPEED * dt, -dy * KEY_PAN_SPEED * dt);
  };

  function midpoint() {
    const [a, b] = [...pts.values()];
    return { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 };
  }
  function pinchSpan() {
    const [a, b] = [...pts.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
}
