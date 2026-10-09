/**
 * Facebook-style notifications: every event pops in as its own card, cards
 * stack (newest on top, at most MAX_SHOWN) and fade after a few seconds, and
 * the kept ones go to a short history the 🔔 panel shows.
 */
export type NoticeKind = 'info' | 'good' | 'bad' | 'rare';

export interface Notice {
  id: number;
  html: string;
  /** Picture on the left: an image URL, or an emoji. */
  icon?: string;
  kind: NoticeKind;
  at: number; // performance.now() when it arrived
}

const MAX_SHOWN = 4;
/** History length: as many rows as the 🔔 panel fits without scrolling. */
export const HISTORY = 8;

export class Notices {
  history: Notice[] = [];
  unread = 0;
  private nextId = 1;
  private shown: { n: Notice; el: HTMLElement; until: number }[] = [];

  constructor(private stack: HTMLElement) {
    // Tap a card to dismiss it early.
    stack.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest('.note-card') as HTMLElement | null;
      const s = this.shown.find((x) => x.el === el);
      if (s) s.until = 0;
    });
  }

  /** Show a card. `keep` = also log it in the 🔔 history. */
  push(html: string, opts: { icon?: string; kind?: NoticeKind; seconds?: number; keep?: boolean } = {}): void {
    const n: Notice = { id: this.nextId++, html, icon: opts.icon, kind: opts.kind ?? 'info', at: performance.now() };
    if (opts.keep !== false) {
      this.history.unshift(n);
      this.history.length = Math.min(this.history.length, HISTORY);
      this.unread++;
    }
    const el = document.createElement('div');
    el.className = `note-card ${n.kind}`;
    el.innerHTML = cardHtml(n);
    this.stack.prepend(el);
    this.shown.unshift({ n, el, until: n.at + (opts.seconds ?? 5) * 1000 });
    // Too many: the oldest leave early.
    for (const s of this.shown.slice(MAX_SHOWN)) s.until = Math.min(s.until, n.at);
  }

  /** Expire cards; call once per frame. `top` = y just below the top bar. */
  update(top: number): void {
    this.stack.style.top = `${top}px`;
    const now = performance.now();
    for (const s of this.shown) {
      if (now < s.until || s.el.classList.contains('out')) continue;
      s.el.classList.add('out');
      setTimeout(() => s.el.remove(), 300);
    }
    this.shown = this.shown.filter((s) => now < s.until + 300);
  }

  markRead(): void {
    this.unread = 0;
  }
}

export function cardHtml(n: Notice, ago?: string): string {
  const icon = !n.icon ? '' : n.icon.startsWith('data:') || n.icon.includes('/')
    ? `<img class="ic" src="${n.icon}" alt="">` : `<span class="ic emoji">${n.icon}</span>`;
  return `${icon}<div class="txt">${n.html}</div>${ago ? `<small class="ago">${ago}</small>` : ''}`;
}

export function timeAgo(at: number): string {
  const s = Math.round((performance.now() - at) / 1000);
  return s < 5 ? 'now' : s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`;
}
