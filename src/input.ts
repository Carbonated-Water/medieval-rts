/** What input needs from the camera. Screen coordinates are CSS pixels. */
export interface PanZoom {
  panBy(dx: number, dy: number): void;
  zoomAt(factor: number, sx: number, sy: number): void;
}

export interface InputHandlers {
  onTap(sx: number, sy: number): void;
  /** While true, a one-finger drag draws a selection box instead of panning. */
  boxMode(): boolean;
  onBox(x0: number, y0: number, x1: number, y1: number): void;
}

const TAP_SLOP = 10; // px of finger travel before a touch becomes a pan

/**
 * One finger drag = pan (or box-select in box mode), two finger pinch =
 * zoom, wheel = zoom. A touch that never moves past TAP_SLOP is a tap.
 */
export function attachInput(el: HTMLElement, cam: PanZoom, h: InputHandlers): void {
  const pts = new Map<number, { x: number; y: number }>();
  let start: { x: number; y: number } | null = null;
  let panning = false;
  let boxing = false;
  let last = { x: 0, y: 0 };
  let pinchDist = 0;

  const rect = document.createElement('div');
  rect.id = 'selbox';
  document.body.appendChild(rect);
  const drawRect = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    rect.style.display = 'block';
    rect.style.left = `${Math.min(a.x, b.x)}px`;
    rect.style.top = `${Math.min(a.y, b.y)}px`;
    rect.style.width = `${Math.abs(a.x - b.x)}px`;
    rect.style.height = `${Math.abs(a.y - b.y)}px`;
  };

  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) {
      start = { x: e.clientX, y: e.clientY };
      panning = boxing = false;
    } else {
      // A second finger cancels any tap or box and starts a pinch.
      start = null;
      boxing = false;
      rect.style.display = 'none';
      pinchDist = pinchSpan();
    }
  });

  el.addEventListener('pointermove', (e) => {
    const prev = pts.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (pts.size === 1) {
      if (!panning && !boxing && start && Math.hypot(cur.x - start.x, cur.y - start.y) > TAP_SLOP) {
        if (h.boxMode()) boxing = true; else panning = true;
      }
      if (panning) cam.panBy(cur.x - prev.x, cur.y - prev.y);
      if (boxing && start) drawRect(start, cur);
      last = cur;
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
    if (pts.size === 0 && start && e.type === 'pointerup') {
      if (boxing) h.onBox(start.x, start.y, last.x, last.y);
      else if (!panning) h.onTap(e.clientX, e.clientY);
    }
    if (pts.size === 1) pinchDist = 0;
    if (pts.size === 0) {
      start = null;
      boxing = false;
      rect.style.display = 'none';
    }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);

  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    cam.zoomAt(Math.pow(1.0015, -e.deltaY), e.clientX, e.clientY);
  }, { passive: false });

  function midpoint() {
    const [a, b] = [...pts.values()];
    return { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 };
  }
  function pinchSpan() {
    const [a, b] = [...pts.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
}
