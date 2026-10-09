import {
  BOOTS, CLOTHES, DEV_MULTIPLIER, FISH, GEAR, HAGGLE_PER_LEVEL, REFLEX_PER_LEVEL, RODS, SKILLS, STRENGTH_PER_LEVEL,
  TIERS, type GearKind, type SkillId, type Tier,
} from './data';
import { fishIcon } from './fishart';
import { fishById, type Game } from './game';
import type { Place } from './scene';

export type Action =
  | 'cast' | 'reel' | 'market' | 'journal' | 'close' | 'reset' | 'toggleDev'
  | 'sellAll' | `sell:${number}` | `buy:${GearKind}` | `train:${SkillId}`
  | 'tab:sell' | 'tab:gear' | 'tab:skills';

type Tab = 'sell' | 'gear' | 'skills';
const GEAR_ORDER: GearKind[] = ['rod', 'bait', 'clothes', 'boots'];
const money = (n: number) => `$${n.toLocaleString('en-US')}`;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const tierTag = (t: Tier) => `<span class="tier" style="--c:${TIERS[t].color}">${TIERS[t].name}</span>`;

/** A small picture for a gear level: rod colour bar, bait emoji, clothes/boots swatches. */
function gearIcon(kind: GearKind, level: number): string {
  if (kind === 'rod') return `<i class="rod" style="--c:${RODS[level]!.color}"></i>`;
  if (kind === 'bait') return `<i class="emoji">${['🍞', '🪱', '🦗', '✨', '🌟'][level]}</i>`;
  if (kind === 'clothes') return `<i class="swatch shirt" style="--c:${CLOTHES[level]!.shirt};--d:${CLOTHES[level]!.trousers}"></i>`;
  return `<i class="swatch boot" style="--c:${BOOTS[level]!.color ?? '#f0c8a0'}"></i>`;
}

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
      `<span class="pill">Fishing ${game.skill}</span>` +
      (game.dev ? `<span class="pill dev">DEV ×${DEV_MULTIPLIER}</span>` : '') +
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
    const tabs = (['sell', 'gear', 'skills'] as Tab[]).map((t) =>
      `<button class="tab ${this.tab === t ? 'on' : ''}" data-act="tab:${t}">${{ sell: 'Sell fish', gear: 'Gear', skills: 'Skills' }[t]}</button>`).join('');
    const body = this.tab === 'sell' ? this.sellHtml(game) : this.tab === 'gear' ? this.gearHtml(game) : this.skillsHtml(game);
    return `<div class="card"><div class="head"><h2>Fish Market</h2><button class="x" data-act="close" aria-label="close">✕</button></div>
      <div class="tabs">${tabs}</div><div class="body">${body}</div></div>`;
  }

  private sellHtml(game: Game): string {
    if (game.bag.length === 0) return '<p class="empty">Your bag is empty. Go catch something!</p>';
    const bonus = game.haggling ? ` <small>(haggling +${pct(game.haggling * HAGGLE_PER_LEVEL)})</small>` : '';
    return `<button class="wide go" data-act="sellAll">Sell all ${game.bag.length} for ${money(game.bagValue())}</button>
      ${bonus ? `<p class="note">${bonus}</p>` : ''}
      <div class="list">${[...game.bag].reverse().map((c) => {
        const f = fishById(c.fish);
        return `<div class="item"><img src="${fishIcon(f)}" alt=""><div class="meta"><b>${f.name}</b>${tierTag(f.tier)}<small>${c.kg} kg</small></div>
          <button data-act="sell:${c.id}">${money(game.priceOf(c))}</button></div>`;
      }).join('')}</div>`;
  }

  /** Each gear line shows only what you have and the very next upgrade. */
  private gearHtml(game: Game): string {
    return GEAR_ORDER.map((kind) => {
      const lvl = game.gearLevel(kind);
      const cur = GEAR[kind].levels[lvl]!;
      const next = game.nextGear(kind);
      const tier = (l: number) => (kind === 'rod' ? tierTag(RODS[l]!.tier) : '');
      const nextRow = next
        ? `<div class="item"><span class="next">Next</span>${gearIcon(kind, next.level)}<div class="meta"><b>${next.name}</b>${tier(next.level)}<small>${next.blurb}</small></div>
            <button data-act="buy:${kind}" ${game.money < next.price ? 'disabled' : ''}>${money(next.price)}</button></div>`
        : '<p class="maxed">Fully upgraded!</p>';
      return `<section><h3>${GEAR[kind].title} <small>${lvl + 1}/${GEAR[kind].levels.length}</small></h3>
        <div class="item have">${gearIcon(kind, lvl)}<div class="meta"><b>${cur.name}</b>${tier(lvl)}<small>${cur.blurb}</small></div><span class="owned">Equipped</span></div>
        ${nextRow}</section>`;
    }).join('') + '<p class="note">A fish one tier above your rod can still bite — it snaps the line unless your Strength lands it.</p>';
  }

  private skillsHtml(game: Game): string {
    const ids: SkillId[] = ['fishing', 'reflexes', 'haggling', 'strength'];
    return ids.map((id) => {
      const def = SKILLS[id];
      const lvl = game.level(id);
      const cost = game.nextSkillCost(id);
      const effect = this.skillEffect(game, id, lvl, cost !== null);
      const btn = cost === null ? '<span class="owned">Max</span>'
        : `<button data-act="train:${id}" ${game.money < cost ? 'disabled' : ''}>${money(cost)}</button>`;
      return `<section><div class="item skillrow"><div class="meta"><b>${def.name} <small>Lv ${lvl}/${def.max}</small></b>
        <small>${def.blurb}</small>${effect}</div>${btn}</div></section>`;
    }).join('');
  }

  /** "now → next" line for a skill; Fishing gets the full odds table. */
  private skillEffect(game: Game, id: SkillId, lvl: number, canTrain: boolean): string {
    const arrow = (a: string, b: string) => `<small class="effect">${a}${canTrain ? ` <span class="upc">→ ${b}</span>` : ''}</small>`;
    if (id === 'reflexes') return arrow(`Reel window ${game.reelWindow().toFixed(2)} s`, `${(game.reelWindow() + REFLEX_PER_LEVEL).toFixed(2)} s`);
    if (id === 'haggling') return arrow(`Prices +${pct(lvl * HAGGLE_PER_LEVEL)}`, `+${pct((lvl + 1) * HAGGLE_PER_LEVEL)}`);
    if (id === 'strength') return arrow(`${pct(game.strengthChance())} to land too-strong fish`, pct(game.strengthChance() + STRENGTH_PER_LEVEL));
    const now = game.tierOdds();
    const after = canTrain ? game.tierOdds(lvl + 1) : null;
    const rows = ([1, 2, 3, 4, 5] as Tier[]).filter((t) => t <= game.rodTier).map((t) => {
      const p = now[t] ?? 0, q = after?.[t];
      return `<div class="odds"><span>${tierTag(t)}</span><div class="bar"><i style="width:${(p * 100).toFixed(1)}%;background:${TIERS[t].color}"></i></div>
        <b>${(p * 100).toFixed(1)}%</b>${q !== undefined ? `<small class="${q > p ? 'up' : 'down'}">→ ${(q * 100).toFixed(1)}%</small>` : ''}</div>`;
    }).join('');
    return `<div class="oddslist">${rows}</div>`;
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
      <button class="wide toggle ${game.dev ? 'on' : ''}" data-act="toggleDev">Dev mode: ${game.dev ? 'ON' : 'OFF'} · fish sell for ${DEV_MULTIPLIER}×</button>
      <button class="wide danger" data-act="reset">Start over</button></div></div>`;
  }

  private set(key: keyof UI['last'], el: HTMLElement, html: string): void {
    if (this.last[key] === html) return;
    this.last[key] = html;
    el.innerHTML = html;
  }
}
