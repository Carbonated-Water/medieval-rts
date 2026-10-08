import { PLAYER } from './config';
import type { Game } from './game';

export type HudAction = 'all' | 'half' | 'clear' | 'capital' | 'restart';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const BOARD_ROWS = 6;

export class Hud {
  private top = document.getElementById('top')!;
  private board = document.getElementById('board')!;
  private panel = document.getElementById('panel')!;
  private toast = document.getElementById('toast')!;
  private modal = document.getElementById('modal')!;
  private last = { top: '', board: '', panel: '', modal: '' };
  private eventSeq = 0;
  private toastUntil = 0;

  constructor(onAction: (a: HudAction) => void) {
    const click = (e: Event) => {
      const btn = (e.target as HTMLElement).closest('button');
      if (btn && !btn.disabled && btn.dataset.act) onAction(btn.dataset.act as HudAction);
    };
    this.panel.addEventListener('click', click);
    this.modal.addEventListener('click', click);
  }

  update(game: Game, selected: number | null, half: boolean): void {
    const me = game.player;
    const troops = game.armies.filter((a) => a.owner === PLAYER).reduce((s, a) => s + a.count, 0);
    const alive = game.alive().length;
    this.set('top', this.top,
      `<span class="res" title="troops">⚔ ${troops}</span>` +
      `<span class="res" title="land">⬢ ${Math.round(game.share(PLAYER) * 100)}%</span>` +
      `<span class="res" title="nations left">♛ ${alive}/${game.nations.length}</span>`);

    // Leaderboard: top nations by land, plus you if you're not among them.
    const ranked = game.alive().sort((a, b) => b.territory - a.territory);
    let rows = ranked.slice(0, BOARD_ROWS);
    if (me.alive && !rows.includes(me)) rows = [...rows.slice(0, BOARD_ROWS - 1), me];
    this.set('board', this.board, rows.map((n) =>
      `<div class="row ${n.id === PLAYER ? 'me' : ''}"><i style="background:${hex(n.color)}"></i>` +
      `<span>${ranked.indexOf(n) + 1}. ${n.name}</span><b>${Math.round(game.share(n.id) * 100)}%</b></div>`).join(''));

    const army = selected !== null ? game.army(selected) : undefined;
    const panel = army
      ? `<div class="head"><span>Army · ${army.count} troops</span><button class="x" data-act="clear" aria-label="deselect">✕</button></div>
         <div class="hint">Tap a hex to march · enemy armies and cities to attack</div>
         <div class="row">
           <button class="seg ${half ? '' : 'on'}" data-act="all">Send all</button>
           <button class="seg ${half ? 'on' : ''}" data-act="half" ${army.count < 2 ? 'disabled' : ''}>Send half</button>
         </div>`
      : `<div class="hint">Tap one of your armies to command it. Cities spawn new troops every few seconds.</div>
         <div class="row"><button data-act="capital">⌂ My capital</button></div>`;
    this.set('panel', this.panel, panel);

    // Toasts for the big moments.
    for (const e of game.events) {
      if (e.seq <= this.eventSeq) continue;
      this.eventSeq = e.seq;
      if (e.type === 'eliminated') {
        const by = game.nations[e.by]!.name;
        this.showToast(e.nation === PLAYER ? 'Your capital has fallen!' : `${game.nations[e.nation]!.name} was conquered by ${e.by === PLAYER ? 'you' : by}!`, game.time);
      } else if (e.type === 'capture' && (e.to === PLAYER || e.from === PLAYER)) {
        this.showToast(e.to === PLAYER ? 'City captured!' : 'You lost a city!', game.time);
      }
    }
    if (this.toastUntil && game.time > this.toastUntil) { this.toast.classList.remove('show'); this.toastUntil = 0; }

    const over = !me.alive || game.winner !== null;
    const won = game.winner === PLAYER;
    this.set('modal', this.modal, !over ? '' :
      `<div class="card"><h1 class="${won ? 'win' : 'lose'}">${won ? 'Victory' : 'Defeat'}</h1>` +
      `<p>${won ? 'Every rival has fallen. The land is yours.' : `Your capital fell. ${ranked[0] ? `${ranked[0].name} leads with ${Math.round(game.share(ranked[0].id) * 100)}% of the map.` : ''}`}</p>` +
      `<button data-act="restart">Play again</button></div>`);
    this.modal.classList.toggle('show', over);
  }

  private showToast(text: string, now: number): void {
    this.toast.textContent = text;
    this.toast.classList.add('show');
    this.toastUntil = now + 2.5;
  }

  private set(key: keyof Hud['last'], el: HTMLElement, html: string): void {
    if (this.last[key] === html) return;
    this.last[key] = html;
    el.innerHTML = html;
  }
}
