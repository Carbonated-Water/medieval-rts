import {
  ACHIEVEMENTS, AUTO, BAITS, DEV_MULTIPLIER, FISH, GEAR, REFLEX_PER_LEVEL, SKILLS, STRENGTH_PER_LEVEL, HAGGLE_PER_LEVEL,
  TIERS, VARIANTS, VARIANT_ORDER, type AchStat, type BaitId, type GearKind, type SkillId, type Tier,
} from './data';
import { type Game } from './game';
import { Notices, lineHtml, timeAgo } from './notify';
import { pixelFishIcon as fishIcon, pixelIcon, type IconName } from './pixelart';
import type { Place } from './scene';

/** One panel per job: the market sells fish, the tackle shop sells gear, the school trains skills. */
export type Panel = 'market' | 'tackle' | 'baitshop' | 'pouch' | 'training' | 'journal' | 'trophies' | 'inbox' | 'settings';

export type Action =
  | 'cast' | 'reel' | 'close' | 'reset' | 'toggleDev' | Panel
  | 'sellAll' | `sellFish:${string}` | `buy:${GearKind}` | `train:${SkillId}` | 'claimAll' | `trophy:${string}`
  | `bait:${BaitId}` | `buyBait:${BaitId}:${number}`;

const GEAR_ORDER: GearKind[] = ['rod', 'holders', 'auto', 'clothes', 'boots'];
export const GEAR_ICON: Record<GearKind, IconName> = { rod: 'rod', holders: 'holder', auto: 'auto', clothes: 'shirt', boots: 'boot' };
export const BAIT_ICON: Record<BaitId, IconName> = { worm: 'bait', cricket: 'cricket', shiner: 'shiner', leech: 'leech', glow: 'glow', gold: 'gold' };
export const SKILL_ICON: Record<SkillId, IconName> = { fishing: 'hook', reflexes: 'bolt', haggling: 'bag', strength: 'fist' };
export const ACH_ICON: Record<AchStat, IconName> = {
  catches: 'fish', species: 'book', tier: 'trophy', giant: 'star', golden: 'star', shiny: 'star', variants: 'star',
  earned: 'coin', lines: 'holder', auto: 'auto', fishing: 'hook',
};

const num = (n: number) => n.toLocaleString('en-US');
const pct = (x: number) => `${Math.round(x * 100)}%`;
const coin = (n: number, scale = 2) => `<span class="cash"><img src="${pixelIcon('coin', scale)}" alt="">${num(n)}</span>`;
const icon = (name: IconName, scale = 3) => `<img src="${pixelIcon(name, scale)}" alt="">`;
/** Level as pips (short tracks) or a bar (long ones). */
const level = (lv: number, max: number) => max <= 10
  ? `<span class="pips">${Array.from({ length: max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</span>`
  : `<span class="bar"><i style="width:${Math.round((lv / max) * 100)}%"></i></span>`;
const short = (s: string) => s.replace(/\.$/, '');

/**
 * The DOM interface in a wood & parchment pixel style: top bar, the big
 * context button, one panel at a time, and the in-world feedback (Notices).
 * Re-renders a section only when its HTML would change.
 */
export class UI {
  private top = document.getElementById('top')!;
  private action = document.getElementById('action')!;
  private sheet = document.getElementById('sheet')!;
  private last = { top: '', action: '', sheet: '' };
  readonly notices = new Notices(document.getElementById('notes')!);
  open: Panel | null = null;
  /** Trophy shown in the detail strip. */
  pick: string | null = null;

  constructor(onAction: (a: Action) => void) {
    document.body.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
      if (btn && !(btn as HTMLButtonElement).disabled) onAction(btn.dataset.act as Action);
    });
  }

  update(_dt: number, game: Game, place: Place | null, walking: boolean): void {
    if (this.open === 'inbox') this.notices.markRead();
    this.notices.update();
    const ready = game.claimable().length, unread = this.notices.unread;
    const badge = (n: number) => (n ? `<i class="badge">${n}</i>` : '');
    this.set('top', this.top,
      `<div class="plaque purse">${icon('coin')}${num(game.money)}</div>` +
      (game.dev ? `<span class="dev">DEV x${DEV_MULTIPLIER}</span>` : '') + '<span class="grow"></span>' +
      `<button class="slot" data-act="journal" aria-label="journal">${icon('book')}</button>` +
      `<button class="slot" data-act="trophies" aria-label="achievements">${icon('trophy')}${badge(ready)}</button>` +
      `<button class="slot" data-act="inbox" aria-label="log">${icon('bell')}${badge(unread)}</button>` +
      `<button class="slot" data-act="settings" aria-label="settings">${icon('menu')}</button>`);
    this.set('action', this.action, this.actionHtml(game, place, walking));
    this.set('sheet', this.sheet, this.open ? this.panelHtml(this.open, game) : '');
    this.sheet.classList.toggle('show', this.open !== null);
  }

  private actionHtml(game: Game, place: Place | null, walking: boolean): string {
    const bag = game.bag.length
      ? `<div class="plaque bag"><span>${icon('fish', 3)}${game.bag.length}</span>${coin(game.bagValue(), 3)}</div>` : '';
    if (walking) return bag;
    if (place === 'market') return `${bag}<button class="btn big" data-act="market">SELL FISH</button>`;
    if (place === 'tackle') return `${bag}<button class="btn big" data-act="tackle">BUY GEAR</button>`;
    if (place === 'school') return `${bag}<button class="btn big" data-act="training">TRAIN</button>`;
    if (place === 'bait') return `${bag}<button class="btn big" data-act="baitshop">BUY BAIT</button>`;
    if (place !== 'dock') return `${bag}<div class="plaque hint">Tap the river to fish</div>`;
    const active = game.activeBait;
    const pouch = `<button class="slot pouch" data-act="pouch" aria-label="bait">${icon(BAIT_ICON[active ?? game.baitSel])}<i class="badge count">${active ? game.baitCount(active) : 0}</i></button>`;
    const row = (btn: string) => `${bag}<div class="dockrow">${pouch}${btn}</div>`;
    const biting = game.lines.filter((l) => l.type === 'bite').length;
    const out = game.lines.filter((l) => l.type === 'idle' || l.type === 'result').length;
    if (biting) return row(`<button class="btn big red bite" data-act="reel">REEL!${biting > 1 ? ` x${biting}` : ''}</button>`);
    if (!active && out === game.lineCount) return `${bag}<div class="plaque hint">Out of bait: dig worms on the bank</div>${pouch}`;
    if (game.auto) return row(`<button class="btn big plain" data-act="cast">${icon('auto')}${AUTO[game.auto]!.name.toUpperCase()}</button>`);
    if (out && active) return row(`<button class="btn big" data-act="cast">CAST${out > 1 ? ` ${out}` : ''}</button>`);
    return row(`<button class="btn big plain" data-act="reel">WAIT...</button>`);
  }

  private panelHtml(panel: Panel, game: Game): string {
    const [title, body] =
      panel === 'market' ? ['Fish Market', this.marketHtml(game)]
        : panel === 'tackle' ? ['Tackle Shop', this.tackleHtml(game)]
          : panel === 'baitshop' ? ['Bait Shop', this.baitShopHtml(game)]
          : panel === 'pouch' ? ['Bait Pouch', this.pouchHtml(game)]
          : panel === 'training' ? ['Fishing School', this.schoolHtml(game)]
            : panel === 'journal' ? [`Journal ${Object.keys(game.journal).length}/${FISH.length}`, this.journalHtml(game)]
              : panel === 'trophies' ? [`Trophies ${game.claimed.length}/${ACHIEVEMENTS.length}`, this.trophiesHtml(game)]
                : panel === 'inbox' ? ['Log', this.inboxHtml()]
                  : ['Settings', this.settingsHtml(game)];
    return `<div class="panel ${panel}"><div class="head"><h2>${title}</h2>${coin(game.money, 3)}
      <button class="xbtn" data-act="close" aria-label="close">${icon('close', 2)}</button></div><div class="body">${body}</div></div>`;
  }

  /** Sells fish, nothing else: one slot per species in the bag; tap to sell that kind. */
  private marketHtml(game: Game): string {
    if (game.bag.length === 0) return '<p class="empty">Your bag is empty.</p>';
    const groups = new Map<string, { n: number; value: number; rare: number }>();
    for (const c of game.bag) {
      const g = groups.get(c.fish) ?? { n: 0, value: 0, rare: 0 };
      g.n++; g.value += game.priceOf(c); if (c.variant) g.rare++;
      groups.set(c.fish, g);
    }
    const cells = FISH.filter((f) => groups.has(f.id)).map((f) => {
      const g = groups.get(f.id)!;
      return `<div class="cell"><button class="slot" data-act="sellFish:${f.id}" title="${f.name}">${g.rare ? '<i class="rare"></i>' : ''}
        <img src="${fishIcon(f, false, 48, 28)}" alt="${f.name}">${g.n > 1 ? `<i class="n">x${g.n}</i>` : ''}</button><span class="price">${coin(g.value, 1)}</span></div>`;
    }).join('');
    return `<button class="btn wide" data-act="sellAll">SELL ALL ${coin(game.bagValue(), 3)}</button>
      <div class="grid">${cells}</div><p class="note">Tap a fish to sell that kind.</p>`;
  }

  /** Sells gear, nothing else. One row per gear line, showing only the next upgrade. */
  private tackleHtml(game: Game): string {
    return GEAR_ORDER.map((kind) => {
      const lvl = game.gearLevel(kind), max = GEAR[kind].levels.length;
      const next = game.nextGear(kind);
      const btn = next
        ? `<button class="btn" data-act="buy:${kind}" ${game.money < next.price ? 'disabled' : ''}>${coin(next.price)}</button>`
        : '<span class="maxed">MAX</span>';
      return `<div class="row"><div class="slot">${icon(GEAR_ICON[kind])}</div><div class="meta">
        <b>${next ? next.name : GEAR[kind].levels[lvl]!.name}</b>
        <div class="sub">${level(lvl + 1, max)}<small>${next ? short(next.blurb) : 'Fully upgraded'}</small></div></div>${btn}</div>`;
    }).join('');
  }

  /** For a bait: chance the bite is your rod's best tier, and chance it's too strong (snaps). */
  private baitOdds(game: Game, bait: BaitId): { top: number; snap: number } {
    let top = 0, snap = 0;
    for (const o of game.odds(game.skill, bait)) {
      if (o.tooStrong) snap += o.p;
      else if (o.fish.tier === game.rodTier) top += o.p;
    }
    return { top, snap };
  }

  /** Sells bait, nothing else. Each row: what you carry, the odds it gives with your rod and level, buy 1 or 10. */
  private baitShopHtml(game: Game): string {
    const best = TIERS[game.rodTier as Tier].name;
    return BAITS.filter((b) => b.price > 0).map((b) => {
      const { top } = this.baitOdds(game, b.id);
      const buy = (n: number) => `<button class="btn" data-act="buyBait:${b.id}:${n}" ${game.money < b.price * n ? 'disabled' : ''}>+${n}</button>`;
      return `<div class="row"><div class="slot">${icon(BAIT_ICON[b.id])}<i class="badge count">${game.baitCount(b.id)}</i></div><div class="meta">
        <b>${b.name}</b><div class="sub">${coin(b.price, 1)}<small>${best} ${pct(top)}</small></div></div>${buy(1)}${buy(10)}</div>`;
    }).join('') + '<p class="note">Bait is used up: one per line, every cast. Worms are free on the bank.</p>';
  }

  /** Choose the bait for the next casts, nothing else. */
  private pouchHtml(game: Game): string {
    const active = game.activeBait;
    const cells = BAITS.map((b) => {
      const n = game.baitCount(b.id);
      return `<div class="cell"><button class="slot ${n ? '' : 'dim'} ${b.id === game.baitSel ? 'sel' : ''}" data-act="bait:${b.id}" title="${b.name}">
        ${icon(BAIT_ICON[b.id])}<i class="n">x${n}</i></button><span class="small">${b.name}</span></div>`;
    }).join('');
    const use = active ?? game.baitSel;
    const { top, snap } = this.baitOdds(game, use);
    const name = BAITS.find((b) => b.id === use)!.name;
    const status = active ? `${TIERS[game.rodTier as Tier].name} ${pct(top)} · snap ${pct(snap)}` : 'Out of bait';
    return `<div class="grid three">${cells}</div>
      <div class="row detail"><div class="slot">${icon(BAIT_ICON[use])}</div><div class="meta"><b>Next: ${name}</b><div class="sub"><small>${status}</small></div></div></div>`;
  }

  /** Raises the fisher's skills, nothing else. */
  private schoolHtml(game: Game): string {
    return (['fishing', 'reflexes', 'haggling', 'strength'] as SkillId[]).map((id) => {
      const def = SKILLS[id], lvl = game.level(id), cost = game.nextSkillCost(id);
      const btn = cost === null ? '<span class="maxed">MAX</span>'
        : `<button class="btn" data-act="train:${id}" ${game.money < cost ? 'disabled' : ''}>${coin(cost)}</button>`;
      return `<div class="row"><div class="slot">${icon(SKILL_ICON[id])}</div><div class="meta">
        <b>${def.name} <span class="small">LV ${lvl}</span></b>
        <div class="sub"><small>${this.skillEffect(game, id, lvl, cost !== null)}</small></div></div>${btn}</div>`;
    }).join('');
  }

  /** "now > next" for a skill, in a few words. */
  private skillEffect(game: Game, id: SkillId, lvl: number, canTrain: boolean): string {
    const step = (a: string, b: string) => `${a}${canTrain ? ` <span class="up">&gt; ${b}</span>` : ''}`;
    if (id === 'reflexes') return step(`${game.reelWindow().toFixed(2)}s`, `${(game.reelWindow() + REFLEX_PER_LEVEL).toFixed(2)}s`);
    if (id === 'haggling') return step(`Prices +${pct(lvl * HAGGLE_PER_LEVEL)}`, `+${pct((lvl + 1) * HAGGLE_PER_LEVEL)}`);
    if (id === 'strength') return step(`Hold ${pct(game.strengthChance())}`, pct(game.strengthChance() + STRENGTH_PER_LEVEL));
    const best = game.rodTier as Tier;
    const odds = (o: Record<number, number>) => pct(o[best] ?? 0);
    return step(`${TIERS[best].name} ${odds(game.tierOdds())}`, odds(game.tierOdds(lvl + 1)));
  }

  /** The collection, nothing else: four species per row, one row per tier. */
  private journalHtml(game: Game): string {
    const cells = FISH.map((f) => {
      const j = game.journal[f.id];
      const marks = VARIANT_ORDER.map((v) => `<i class="${j?.variants?.[v] ? 'got' : ''}" style="--c:${VARIANTS[v].color}"></i>`).join('');
      return `<div class="cell"><div class="slot ${j ? '' : 'dim'}" title="${j ? `${f.name} · best ${j.bestKg} kg` : TIERS[f.tier].name}">
        <img src="${fishIcon(f, !j, 48, 28)}" alt=""></div><span class="small">${j ? `x${num(j.count)}` : '?'}</span><span class="vm">${marks}</span></div>`;
    }).join('');
    return `<div class="grid">${cells}</div><p class="note">Rare finds ${game.variantsFound()}/${FISH.length * VARIANT_ORDER.length} · Giant, Golden, Shiny</p>`;
  }

  /** Achievements, nothing else: a 4x5 trophy grid and a detail strip for the selected one. */
  private trophiesHtml(game: Game): string {
    const ready = game.claimable();
    const pick = ACHIEVEMENTS.find((a) => a.id === this.pick) ?? ready[0] ?? ACHIEVEMENTS.find((a) => !game.claimed.includes(a.id)) ?? ACHIEVEMENTS[0]!;
    const tiles = ACHIEVEMENTS.map((a) => {
      const claimed = game.claimed.includes(a.id);
      const state = claimed ? 'claimed' : game.achieved(a) ? 'ready' : 'locked';
      return `<div class="cell"><button class="slot trophy ${state} ${a === pick ? 'sel' : ''}" data-act="trophy:${a.id}" title="${a.name}">
        ${icon(ACH_ICON[a.stat])}${claimed ? `<img class="tick" src="${pixelIcon('check', 2)}" alt="">` : ''}</button></div>`;
    }).join('');
    const progress = `${num(Math.min(game.stat(pick.stat), pick.goal))}/${num(pick.goal)}`;
    const state = game.claimed.includes(pick.id) ? 'Collected' : game.achieved(pick) ? 'Ready' : progress;
    const collect = ready.length
      ? `<button class="btn wide" data-act="claimAll">COLLECT ${coin(ready.reduce((s, a) => s + a.reward, 0), 3)}</button>` : '';
    return `${collect}<div class="grid">${tiles}</div>
      <div class="row detail"><div class="slot">${icon(ACH_ICON[pick.stat])}</div><div class="meta"><b>${pick.name}</b>
        <div class="sub"><small>${pick.desc} · ${state}</small></div></div>${coin(pick.reward)}</div>`;
  }

  /** The last few log lines and banners, newest first. */
  private inboxHtml(): string {
    const list = this.notices.history;
    if (!list.length) return '<p class="empty">Nothing yet.</p>';
    return list.map((e) => `<div class="row log-row ${e.tone}">${lineHtml(e)}<small>${timeAgo(e.at)}</small></div>`).join('');
  }

  /** Game settings, nothing else. */
  private settingsHtml(game: Game): string {
    return `<div class="row"><div class="slot">${icon('coin')}</div><div class="meta"><b>Lifetime earnings</b></div>${coin(game.earned, 3)}</div>
      <button class="btn wide ${game.dev ? 'red' : 'plain'}" data-act="toggleDev">DEV MODE ${game.dev ? 'ON' : 'OFF'} (x${DEV_MULTIPLIER} PRICES)</button>
      <button class="btn wide red" data-act="reset">START OVER</button>`;
  }

  private set(key: keyof UI['last'], el: HTMLElement, html: string): void {
    if (this.last[key] === html) return;
    this.last[key] = html;
    el.innerHTML = html;
  }
}
