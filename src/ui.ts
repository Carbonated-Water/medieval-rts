import {
  ACHIEVEMENTS, AUTO, BOOTS, CLOTHES, DEV_MULTIPLIER, FISH, GEAR, HAGGLE_PER_LEVEL, HOLDERS, REFLEX_PER_LEVEL, RODS, SKILLS, STRENGTH_PER_LEVEL,
  TIERS, VARIANTS, VARIANT_ORDER, type GearKind, type SkillId, type Tier, type Variant,
} from './data';
import { fishIcon } from './fishart';
import { fishById, type Game } from './game';
import type { Place } from './scene';

/** One panel per job: the market sells fish, the tackle shop sells gear, the school trains skills. */
export type Panel = 'market' | 'tackle' | 'training' | 'journal' | 'trophies' | 'settings';

export type Action =
  | 'cast' | 'reel' | 'close' | 'reset' | 'toggleDev' | Panel
  | 'sellAll' | `sellFish:${string}` | `buy:${GearKind}` | `train:${SkillId}` | 'claimAll' | `claim:${string}`;
const GEAR_ORDER: GearKind[] = ['rod', 'holders', 'auto', 'bait', 'clothes', 'boots'];
const money = (n: number) => `$${n.toLocaleString('en-US')}`;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const tierTag = (t: Tier) => `<span class="tier" style="--c:${TIERS[t].color}">${TIERS[t].name}</span>`;
const VARIANT_MARK: Record<Variant, string> = { giant: '⬆', golden: '★', shiny: '✦' };
export const variantTag = (v: Variant) => `<span class="tier variant ${v}" style="--c:${VARIANTS[v].color}">${VARIANT_MARK[v]} ${VARIANTS[v].name}</span>`;

/** A small picture for a gear level: rod colour bar, bait emoji, clothes/boots swatches. */
function gearIcon(kind: GearKind, level: number): string {
  if (kind === 'rod') return `<i class="rod" style="--c:${RODS[level]!.color}"></i>`;
  if (kind === 'bait') return `<i class="emoji">${['🍞', '🪱', '🦗', '✨', '🌟'][level]}</i>`;
  if (kind === 'holders') return `<i class="emoji">🎣<sub>×${HOLDERS[level]!.lines}</sub></i>`;
  if (kind === 'auto') return `<i class="emoji">🤖<sub>${level ? ['', 'I', 'II', 'III', 'IV'][level] : ''}</sub></i>`;
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
  open: Panel | null = null;
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
    const ready = game.claimable().length;
    this.set('top', this.top,
      `<span class="pill money">${money(game.money)}</span>` +
      `<span class="pill" style="--c:${TIERS[rod.tier].color}"><i class="dot"></i>${rod.name}</span>` +
      `<button class="pill btn" data-act="trophies" aria-label="achievements">🏆 ${game.claimed.length}/${ACHIEVEMENTS.length}${ready ? `<i class="badge">${ready}</i>` : ''}</button>` +
      (game.dev ? `<span class="pill dev">DEV ×${DEV_MULTIPLIER}</span>` : '') +
      `<button class="pill btn" data-act="journal" aria-label="journal">📖 ${Object.keys(game.journal).length}/${FISH.length}</button>` +
      '<button class="pill btn" data-act="settings" aria-label="settings">⚙</button>');

    this.set('action', this.action, this.actionHtml(game, place, walking));
    this.set('sheet', this.sheet, this.open ? this.panelHtml(this.open, game) : '');
    this.sheet.classList.toggle('show', this.open !== null);
  }

  private actionHtml(game: Game, place: Place | null, walking: boolean): string {
    const bag = game.bag.length;
    const bagLine = bag ? `<div class="bagline">🐟 ${bag} fish · worth ${money(game.bagValue())}</div>` : '';
    if (walking) return `${bagLine}<div class="hint">Walking…</div>`;
    if (place === 'market') return `${bagLine}<button class="big" data-act="market">🐟 Sell fish</button>`;
    if (place === 'tackle') return `${bagLine}<button class="big" data-act="tackle">🎣 Browse gear</button>`;
    if (place === 'school') return `${bagLine}<button class="big" data-act="training">🎓 Train skills</button>`;
    if (place !== 'dock') return `${bagLine}<div class="hint">Tap the <b>river</b> to fish · <b>market</b> to sell · <b>tackle shop</b> for gear · <b>school</b> to train</div>`;
    if (game.auto) {
      // The autofisher works the lines; the player can still reel by hand.
      const biting = game.lines.some((l) => l.type === 'bite');
      return `${bagLine}<button class="big ${biting ? 'bite' : 'auto'}" data-act="${biting ? 'reel' : 'cast'}">${biting ? 'REEL!' : `🤖 ${AUTO[game.auto]!.name} is fishing…`}</button>`;
    }
    // Priority: a bite beats everything; then lines to throw; otherwise wait.
    const biting = game.lines.filter((l) => l.type === 'bite').length;
    const out = game.lines.filter((l) => l.type === 'idle' || l.type === 'result').length;
    const many = game.lineCount > 1;
    if (biting) return `${bagLine}<button class="big bite" data-act="reel">REEL!${biting > 1 ? ` ×${biting}` : ''}</button>`;
    if (out) {
      const label = !many ? (game.fishing ? 'Cast again' : 'Cast') : out === game.lineCount ? `Cast ${out} lines` : `Cast ${out} more`;
      return `${bagLine}<button class="big" data-act="cast">🎣 ${label}</button>`;
    }
    return `${bagLine}<button class="big wait" data-act="reel">Wait for a bite…</button>${many ? '<div class="hint small">Tap a bobber with a <b>!</b> to reel that line</div>' : ''}`;
  }

  private panelHtml(panel: Panel, game: Game): string {
    const [title, body] =
      panel === 'market' ? ['Fish Market', this.marketHtml(game)]
        : panel === 'tackle' ? ['Tackle Shop', this.tackleHtml(game)]
          : panel === 'training' ? ['Fishing School', this.trainingHtml(game)]
            : panel === 'trophies' ? [`Achievements · ${game.claimed.length}/${ACHIEVEMENTS.length}`, this.trophiesHtml(game)]
            : panel === 'journal' ? [`Fish Journal · ${Object.keys(game.journal).length}/${FISH.length}`, this.journalHtml(game)]
              : ['Settings', this.settingsHtml(game)];
    return `<div class="card ${panel}"><div class="head"><h2>${title}</h2><span class="purse">${money(game.money)}</span>
      <button class="x" data-act="close" aria-label="close">✕</button></div><div class="body">${body}</div></div>`;
  }

  /** Sells fish, nothing else. One chip per species so it never needs scrolling. */
  private marketHtml(game: Game): string {
    if (game.bag.length === 0) return '<p class="empty">Your bag is empty. Go catch something!</p>';
    const groups = new Map<string, { n: number; value: number; rare: number }>();
    for (const c of game.bag) {
      const g = groups.get(c.fish) ?? { n: 0, value: 0, rare: 0 };
      g.n++; g.value += game.priceOf(c); if (c.variant) g.rare++;
      groups.set(c.fish, g);
    }
    const chips = FISH.filter((f) => groups.has(f.id)).map((f) => {
      const g = groups.get(f.id)!;
      return `<button class="chip" data-act="sellFish:${f.id}" style="--c:${TIERS[f.tier].color}">${g.rare ? `<i class="rare">✦${g.rare}</i>` : ''}
        <img src="${fishIcon(f)}" alt=""><b>${f.name}</b><span><small>×${g.n} ·</small> ${money(g.value)}</span></button>`;
    }).join('');
    const bonus = game.haggling ? ` · haggling +${pct(game.haggling * HAGGLE_PER_LEVEL)}` : '';
    return `<button class="wide go" data-act="sellAll">Sell all ${game.bag.length} for ${money(game.bagValue())}</button>
      <div class="chips">${chips}</div><p class="note">Tap a fish to sell just that kind${bonus}.</p>`;
  }

  /** Sells gear, nothing else. One row per gear line, showing only the next upgrade. */
  private tackleHtml(game: Game): string {
    return `<div class="list">${GEAR_ORDER.map((kind) => {
      const lvl = game.gearLevel(kind);
      const next = game.nextGear(kind);
      const shown = next ? next.level : lvl;
      const have = GEAR[kind].levels[lvl]!.name;
      const btn = next
        ? `<button data-act="buy:${kind}" ${game.money < next.price ? 'disabled' : ''}>${money(next.price)}</button>`
        : '<span class="owned">Max</span>';
      return `<div class="item gear">${gearIcon(kind, shown)}<div class="meta">
        <b>${next ? next.name : have} <small class="was">${shown + 1}/${GEAR[kind].levels.length}</small> ${kind === 'rod' ? tierTag(RODS[shown]!.tier) : ''}</b>
        <small>${next ? next.blurb : 'Fully upgraded'}</small></div>${btn}</div>`;
    }).join('')}</div>`;
  }

  /** Achievements, nothing else: a 4×5 grid of trophies; tap a glowing one to collect its reward. */
  private trophiesHtml(game: Game): string {
    const ready = game.claimable();
    const total = ready.reduce((s, a) => s + a.reward, 0);
    const tiles = ACHIEVEMENTS.map((a) => {
      const claimed = game.claimed.includes(a.id);
      const done = claimed || game.achieved(a);
      const progress = Math.min(game.stat(a.stat), a.goal);
      const foot = claimed ? '✓' : done ? money(a.reward) : a.goal > 1 && a.stat !== 'tier' ? `${progress.toLocaleString('en-US')}/${a.goal.toLocaleString('en-US')}` : money(a.reward);
      const state = claimed ? 'claimed' : done ? 'ready' : 'locked';
      return `<button class="trophy ${state}" ${state === 'ready' ? `data-act="claim:${a.id}"` : 'disabled'} title="${a.desc} · ${money(a.reward)}">
        <i>${a.icon}</i><b>${a.name}</b><small>${foot}</small></button>`;
    }).join('');
    const claimAll = ready.length
      ? `<button class="wide go" data-act="claimAll">Collect ${ready.length} reward${ready.length > 1 ? 's' : ''} · ${money(total)}</button>`
      : '<p class="note">Glowing trophies are ready to collect. Hold or hover one to see its goal.</p>';
    return `${claimAll}<div class="trophy-grid">${tiles}</div>`;
  }

  /** Raises the fisher's skills, nothing else. */
  private trainingHtml(game: Game): string {
    const ids: SkillId[] = ['fishing', 'reflexes', 'haggling', 'strength'];
    return `<div class="list">${ids.map((id) => {
      const def = SKILLS[id];
      const lvl = game.level(id);
      const cost = game.nextSkillCost(id);
      const btn = cost === null ? '<span class="owned">Max</span>'
        : `<button data-act="train:${id}" ${game.money < cost ? 'disabled' : ''}>${money(cost)}</button>`;
      return `<div class="item skillrow"><div class="meta"><b>${def.name} <small>Lv ${lvl}/${def.max}</small></b>
        ${this.skillEffect(game, id, lvl, cost !== null)}</div>${btn}</div>`;
    }).join('')}</div>`;
  }

  /** "now → next" line for a skill; Fishing gets the full odds table. */
  private skillEffect(game: Game, id: SkillId, lvl: number, canTrain: boolean): string {
    const arrow = (a: string, b: string) => `<small class="effect">${a}${canTrain ? ` <span class="upc">→ ${b}</span>` : ''}</small>`;
    if (id === 'reflexes') return arrow(`Reel window ${game.reelWindow().toFixed(2)} s`, `${(game.reelWindow() + REFLEX_PER_LEVEL).toFixed(2)} s`);
    if (id === 'haggling') return arrow(`Prices +${pct(lvl * HAGGLE_PER_LEVEL)}`, `+${pct((lvl + 1) * HAGGLE_PER_LEVEL)}`);
    if (id === 'strength') return arrow(`${pct(game.strengthChance())} to land too-strong fish`, pct(game.strengthChance() + STRENGTH_PER_LEVEL));
    const now = game.tierOdds();
    const best = game.rodTier as Tier;
    const stack = ([1, 2, 3, 4, 5] as Tier[]).filter((tier) => (now[tier] ?? 0) > 0)
      .map((tier) => `<i style="flex:${now[tier]};background:${TIERS[tier].color}" title="${TIERS[tier].name} ${pct(now[tier]!)}"></i>`).join('');
    const after = canTrain ? ` <span class="upc">→ ${((game.tierOdds(lvl + 1)[best] ?? 0) * 100).toFixed(1)}%</span>` : '';
    return `<small class="effect">${TIERS[best].name} fish ${((now[best] ?? 0) * 100).toFixed(1)}%${after}</small><div class="stack">${stack}</div>`;
  }

  /** The collection, nothing else: one row per tier, four species each. */
  private journalHtml(game: Game): string {
    const cells = FISH.map((f) => {
      const j = game.journal[f.id];
      const marks = VARIANT_ORDER.map((v) =>
        `<i class="vmark ${j?.variants?.[v] ? 'got' : ''}" style="--c:${VARIANTS[v].color}" title="${VARIANTS[v].name}">${VARIANT_MARK[v]}</i>`).join('');
      return j
        ? `<div class="fish seen" style="--c:${TIERS[f.tier].color}" title="best ${j.bestKg} kg"><img src="${fishIcon(f)}" alt=""><b>${f.name}</b><small>×${j.count}</small><span class="vmarks">${marks}</span></div>`
        : `<div class="fish" style="--c:${TIERS[f.tier].color}"><img src="${fishIcon(f, true)}" alt=""><b>???</b><small>${TIERS[f.tier].name}</small></div>`;
    }).join('');
    return `<p class="note">Rare variants found <b>${game.variantsFound()}/${FISH.length * VARIANT_ORDER.length}</b> · ${VARIANT_ORDER.map(variantTag).join(' ')}</p>
      <div class="grid">${cells}</div>`;
  }

  /** Game settings, nothing else. */
  private settingsHtml(game: Game): string {
    return `<p class="note">Lifetime earnings: ${money(game.earned)}</p>
      <button class="wide toggle ${game.dev ? 'on' : ''}" data-act="toggleDev">Dev mode: ${game.dev ? 'ON' : 'OFF'} · fish sell for ${DEV_MULTIPLIER}×</button>
      <button class="wide danger" data-act="reset">Start over</button>`;
  }

  private set(key: keyof UI['last'], el: HTMLElement, html: string): void {
    if (this.last[key] === html) return;
    this.last[key] = html;
    el.innerHTML = html;
  }
}
