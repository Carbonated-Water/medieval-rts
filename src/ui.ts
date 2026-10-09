import { FISH, RODS, SKILL_MAX, TIERS, type Tier } from './data';
import { fishIcon } from './fishart';
import { fishById, type Game } from './game';
import type { Place } from './scene';

export type Action =
  | 'cast' | 'reel' | 'market' | 'journal' | 'close'
  | 'sellAll' | `sell:${number}` | `buyRod:${number}` | 'upgradeSkill'
  | 'tab:sell' | 'tab:rods' | 'tab:skill' | 'reset';

type Tab = 'sell' | 'rods' | 'skill';
const money = (n: number) => `$${n.toLocaleString('en-US')}`;
const tierTag = (t: Tier) => `<span class="tier" style="--c:${TIERS[t].color}">${TIERS[t].name}</span>`;

/**
 * The DOM interface: top bar, the big context button, the market and the
 * journal. Re-renders a section only when its HTML would change.
 */
export class UI {
  private top = document.getElementById('top')!;
  private action = document.getElementById('action')!;
  private sheet = document.getElementById('sheet')!;
  private toast = document.getElementById('toast')!;
  private last = { top: '', action: '', sheet: '' };
  open: 'market' | 'journal' | null = null;
  tab: Tab = 'sell';
  private toastUntil = 0;
  private time = 0;

  constructor(onAction: (a: Action) => void) {
    document.body.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
      if (btn && !(btn as HTMLButtonElement).disabled) onAction(btn.dataset.act as Action);
    });
  }

  say(text: string, seconds = 2.4, kind: 'info' | 'good' | 'bad' = 'info'): void {
    this.toast.innerHTML = text;
    this.toast.className = `show ${kind}`;
    this.toastUntil = this.time + seconds;
  }

  update(dt: number, game: Game, place: Place | null, walking: boolean): void {
    this.time += dt;
    if (this.toastUntil && this.time > this.toastUntil) { this.toast.className = ''; this.toastUntil = 0; }

    const rod = RODS[game.rod]!;
    this.set('top', this.top,
      `<span class="pill money">${money(game.money)}</span>` +
      `<span class="pill" style="--c:${TIERS[rod.tier].color}"><i class="dot"></i>${rod.name}</span>` +
      `<span class="pill">Skill ${game.skill}</span>` +
      `<button class="pill btn" data-act="journal" aria-label="journal">📖 ${Object.keys(game.journal).length}/${FISH.length}</button>`);

    this.set('action', this.action, this.actionHtml(game, place, walking));
    this.set('sheet', this.sheet, this.open === 'market' ? this.marketHtml(game) : this.open === 'journal' ? this.journalHtml(game) : '');
    this.sheet.classList.toggle('show', this.open !== null);
  }

  private actionHtml(game: Game, place: Place | null, walking: boolean): string {
    const bag = game.bag.length;
    const bagLine = bag ? `<div class="bagline">🐟 ${bag} fish · worth ${money(game.bagValue())}</div>` : '';
    if (walking) return `${bagLine}<div class="hint">Walking…</div>`;
    if (place === 'market') return `${bagLine}<button class="big" data-act="market">Open market</button>`;
    if (place !== 'dock') return `${bagLine}<div class="hint">Tap the <b>river</b> to fish · tap the <b>market</b> to sell</div>`;
    const line = game.line;
    switch (line.type) {
      case 'idle': return `${bagLine}<button class="big" data-act="cast">🎣 Cast</button>`;
      case 'casting':
      case 'waiting': return `${bagLine}<button class="big wait" data-act="reel">Wait for a bite…</button>`;
      case 'bite': return `${bagLine}<button class="big bite" data-act="reel">REEL!</button>`;
      case 'result': return `${bagLine}<button class="big" data-act="cast">🎣 Cast again</button>`;
    }
  }

  private marketHtml(game: Game): string {
    const tabs = (['sell', 'rods', 'skill'] as Tab[]).map((t) =>
      `<button class="tab ${this.tab === t ? 'on' : ''}" data-act="tab:${t}">${{ sell: 'Sell fish', rods: 'Rods', skill: 'Skill' }[t]}</button>`).join('');
    let body = '';
    if (this.tab === 'sell') {
      body = game.bag.length === 0
        ? '<p class="empty">Your bag is empty. Go catch something!</p>'
        : `<button class="wide go" data-act="sellAll">Sell all ${game.bag.length} for ${money(game.bagValue())}</button>
           <div class="list">${[...game.bag].reverse().map((c) => {
             const f = fishById(c.fish);
             return `<div class="item"><img src="${fishIcon(f)}" alt=""><div class="meta"><b>${f.name}</b>${tierTag(f.tier)}<small>${c.kg} kg</small></div>
               <button data-act="sell:${c.id}">${money(c.value)}</button></div>`;
           }).join('')}</div>`;
    } else if (this.tab === 'rods') {
      body = `<div class="list">${RODS.map((r, i) => {
        const owned = i <= game.rod, next = i === game.rod + 1;
        const btn = owned ? `<span class="owned">${i === game.rod ? 'Equipped' : 'Owned'}</span>`
          : next ? `<button data-act="buyRod:${i}" ${game.money < r.price ? 'disabled' : ''}>${money(r.price)}</button>`
          : `<span class="locked">${money(r.price)}</span>`;
        return `<div class="item ${owned ? 'have' : ''}"><i class="rod" style="--c:${r.color}"></i><div class="meta"><b>${r.name}</b>${tierTag(r.tier)}<small>${r.blurb}</small></div>${btn}</div>`;
      }).join('')}</div><p class="note">A fish one tier above your rod can still bite — but it will snap the line.</p>`;
    } else {
      const cost = game.nextSkillCost();
      const now = game.tierOdds();
      const after = cost === null ? null : game.tierOdds(game.skill + 1);
      const rows = ([1, 2, 3, 4, 5] as Tier[]).filter((t) => t <= game.rodTier).map((t) => {
        const p = now[t] ?? 0, q = after?.[t];
        return `<div class="odds"><span>${tierTag(t)}</span><div class="bar"><i style="width:${(p * 100).toFixed(1)}%;background:${TIERS[t].color}"></i></div>
          <b>${(p * 100).toFixed(1)}%</b>${q !== undefined ? `<small class="${q > p ? 'up' : 'down'}">→ ${(q * 100).toFixed(1)}%</small>` : ''}</div>`;
      }).join('');
      body = `<div class="skill"><div class="lvl">Fishing skill <b>${game.skill}</b> / ${SKILL_MAX}</div>
        <p class="note">Each level makes rarer fish bite more often, bites come sooner, and you get longer to reel.</p>
        <div class="oddslist">${rows}</div>
        ${game.rodTier < 5 ? `<p class="note">Odds shown for your ${RODS[game.rod]!.name}. Better rods unlock more tiers.</p>` : ''}
        ${cost === null ? '<p class="maxed">Max level!</p>'
          : `<button class="wide go" data-act="upgradeSkill" ${game.money < cost ? 'disabled' : ''}>Train to level ${game.skill + 1} · ${money(cost)}</button>`}</div>`;
    }
    return `<div class="card"><div class="head"><h2>Fish Market</h2><button class="x" data-act="close" aria-label="close">✕</button></div>
      <div class="tabs">${tabs}</div><div class="body">${body}</div></div>`;
  }

  private journalHtml(game: Game): string {
    const cells = FISH.map((f) => {
      const j = game.journal[f.id];
      return j
        ? `<div class="fish seen" style="--c:${TIERS[f.tier].color}"><img src="${fishIcon(f)}" alt=""><b>${f.name}</b><small>×${j.count} · best ${j.bestKg} kg</small></div>`
        : `<div class="fish" style="--c:${TIERS[f.tier].color}"><img src="${fishIcon(f, true)}" alt=""><b>???</b><small>${TIERS[f.tier].name}</small></div>`;
    }).join('');
    return `<div class="card"><div class="head"><h2>Fish Journal · ${Object.keys(game.journal).length}/${FISH.length}</h2><button class="x" data-act="close" aria-label="close">✕</button></div>
      <div class="body"><div class="grid">${cells}</div>
      <p class="note">Lifetime earnings: ${money(game.earned)}</p>
      <button class="wide danger" data-act="reset">Start over</button></div></div>`;
  }

  private set(key: keyof UI['last'], el: HTMLElement, html: string): void {
    if (this.last[key] === html) return;
    this.last[key] = html;
    el.innerHTML = html;
  }
}
