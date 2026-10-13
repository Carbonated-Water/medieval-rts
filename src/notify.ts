/**
 * In-game feedback, the way pixel games do it instead of notification cards:
 * - float: short text that rises from a point in the world ("+$132") and fades;
 * - log: a small pickup log bottom-left, at most LOG_LINES, where repeats
 *   merge ("Perch x3") and lines fade on their own;
 * - banner: one plaque at a time under the top bar for the special moments
 *   (new fish, rare variant, achievement, purchase).
 * Log lines and banners are kept in a short history for the bell panel.
 */
export type Tone = 'plain' | 'good' | 'rare' | 'bad';

export interface Entry { icon: string; html: string; tone: Tone; at: number; count: number }

const LOG_LINES = 3;
const LOG_SECONDS = 4;
const BANNER_SECONDS = 2.6;
/** History length: as many rows as the bell panel fits without scrolling. */
export const HISTORY = 8;

export class Notices {
  history: Entry[] = [];
  unread = 0;
  private logEl: HTMLElement;
  private bannerEl: HTMLElement;
  private lines: { key: string; el: HTMLElement; entry: Entry; until: number }[] = [];
  private banners: { icon: string; label: string; title: string; tone: Tone; inPanel: boolean }[] = [];
  /** Is a panel open (set each frame)? Banners from a panel (BOUGHT, TRAINED...) only show while it's open. */
  panelOpen = false;
  private showingInPanel = false;
  private bannerUntil = 0;

  constructor(private root: HTMLElement) {
    this.logEl = document.createElement('div');
    this.logEl.className = 'log';
    this.bannerEl = document.createElement('div');
    this.bannerEl.className = 'banner';
    root.append(this.logEl);
    document.body.appendChild(this.bannerEl);
  }

  /** Text rising from a screen point (CSS px). */
  float(text: string, x: number, y: number, tone: Tone = 'good'): void {
    const el = document.createElement('div');
    el.className = `float ${tone}`;
    el.textContent = text;
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    this.root.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }

  /** A pickup-log line. Lines with the same key merge into one with a count. */
  log(key: string, icon: string, html: string, tone: Tone = 'plain'): void {
    const now = performance.now();
    const same = this.lines.find((l) => l.key === key && now < l.until);
    if (same) {
      same.entry.count++;
      same.entry.at = now;
      same.until = now + LOG_SECONDS * 1000;
      same.el.innerHTML = lineHtml(same.entry);
      same.el.classList.remove('bump');
      void same.el.offsetWidth; // restart the bump animation
      same.el.classList.add('bump');
      return;
    }
    const entry: Entry = { icon, html, tone, at: now, count: 1 };
    this.remember(entry);
    const el = document.createElement('div');
    el.className = `line ${tone}`;
    el.innerHTML = lineHtml(entry);
    this.logEl.appendChild(el);
    this.lines.push({ key, el, entry, until: now + LOG_SECONDS * 1000 });
    // Too many: the oldest leave now.
    for (const l of this.lines.slice(0, -LOG_LINES)) l.until = Math.min(l.until, now);
  }

  /** Into the Log only: nothing shows on screen. */
  quiet(icon: string, html: string, tone: Tone = 'plain'): void {
    this.remember({ icon, html, tone, at: performance.now(), count: 1 }, tone === 'rare');
  }

  /** A plaque under the top bar for special moments; queued one at a time. */
  banner(icon: string, label: string, title: string, tone: Tone = 'good'): void {
    this.remember({ icon, html: `<b>${label}</b> ${title}`, tone, at: performance.now(), count: 1 });
    this.banners.push({ icon, label, title, tone, inPanel: this.panelOpen });
    if (this.banners.length > 3) this.banners.splice(0, this.banners.length - 3);
  }

  /** Drop banners still waiting (e.g. a "for sale" teaser once it's been bought). */
  clearBanners(): void {
    this.banners = [];
  }

  /** Expire lines and advance the banner queue; call once per frame. */
  update(): void {
    const now = performance.now();
    for (const l of this.lines) {
      if (now < l.until || l.el.classList.contains('out')) continue;
      l.el.classList.add('out');
      setTimeout(() => l.el.remove(), 300);
    }
    this.lines = this.lines.filter((l) => now < l.until + 300);
    // Closing a panel drops its banners: they were about what you did in it.
    if (!this.panelOpen) {
      this.banners = this.banners.filter((b) => !b.inPanel);
      if (this.showingInPanel) { this.showingInPanel = false; this.bannerUntil = 0; }
    }
    if (now >= this.bannerUntil) {
      const next = this.banners.shift();
      this.showingInPanel = !!next?.inPanel;
      if (next) {
        this.bannerEl.className = `banner show ${next.tone}`;
        this.bannerEl.innerHTML = `<img src="${next.icon}" alt=""><div><small>${next.label}</small><b>${next.title}</b></div>`;
        this.bannerUntil = now + BANNER_SECONDS * 1000;
      } else if (this.bannerEl.classList.contains('show')) {
        this.bannerEl.classList.remove('show');
      }
    }
  }

  markRead(): void {
    this.unread = 0;
  }

  /** Into the Log; the bell's count only goes up for rare finds that never showed on screen. */
  private remember(e: Entry, missed = false): void {
    this.history.unshift(e);
    this.history.length = Math.min(this.history.length, HISTORY);
    if (missed) this.unread++;
  }
}

export function lineHtml(e: Entry): string {
  return `<img src="${e.icon}" alt=""><span>${e.html}</span>${e.count > 1 ? `<i class="n">x${e.count}</i>` : ''}`;
}

export function timeAgo(at: number): string {
  const s = Math.round((performance.now() - at) / 1000);
  return s < 5 ? 'now' : s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`;
}
