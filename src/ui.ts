import {
  ACHIEVEMENTS, AUTO, BAITS, BERTHS, BOATS, BOAT_ORDER, COMPANY_PRICE, COMPANY_UNLOCK_EARNED, DEV_MULTIPLIER, GROUNDS, HARBOR_UPGRADES,
  MANAGER_BUDGETS, PIER_SECTIONS, PIER_SPOTS, PIER_STAFF, HANDS_MAX,
  TRACKS, TRACK_MAX, TRACK_ORDER, WAREHOUSE, type HarborUpgradeId, type TrackId, HAND_NAMES, HAND_SKILL_MAX, LETTERS, RODS, FISH, GEAR, REFLEX_PER_LEVEL, SKILLS, STRENGTH_PER_LEVEL, HAGGLE_PER_LEVEL,
  TIERS, VARIANTS, VARIANT_ORDER, type AchStat, type BaitId, type BoatType, type GearKind, type SkillId, type Tier, TREE_FISH, type TreeFish, LEGENDS, EXOTIC, REGIONS, VOYAGE,
} from './data';
import { type Boat, type Exotic, type Game, fishById } from './game';
import * as V from './voyage';
import { Notices, lineHtml, timeAgo } from './notify';
import { pixelFishIcon as fishIcon, pixelIcon, type IconName } from './pixelart';
import type { Place } from './scene';

/** One panel per job: the market sells fish, the tackle shop sells gear, the school trains skills. */
export type Panel = 'market' | 'tackle' | 'baitshop' | 'pouch' | 'harbor' | 'ledger' | 'boat' | 'tree' | 'retire' | 'lighthouse' | 'exotic' | 'listing' | 'voyage' | 'shipyard' | 'harborup' | 'pier' | 'pierstaff' | 'hand' | 'training' | 'journal' | 'trophies' | 'inbox' | 'settings';

export type Action =
  | 'cast' | 'reel' | 'close' | 'back' | 'reset' | 'toggleDev' | Panel | `fight:${string}` | 'fightDone' | `lhRegion:${'coast' | 'ocean' | 'abyss'}`
  | 'buyFlagship' | `sail:${string}` | `vsail:${number}` | `vchoose:${number}` | 'vlegend' | 'vfight' | 'vhome'
  | `exTab:${'hold' | 'listed' | 'wanted'}` | `exList:${number}` | `exUnlist:${number}` | `exOpen:${number}` | `exSell:${number}:${number}` | `exGive:${number}` | 'exDev' | 'boatPrev' | 'boatNext' | `coTab:${'harbor' | 'ledger' | 'harborup'}`
  | `achTab:${'base' | 'tree'}` | `treeTier:${number}` | `treeSel:${string}` | `unlock:${string}` | 'doRetire' | `journalTier:${number}`
  | 'sellAll' | `sellFish:${string}` | `buy:${GearKind}` | `train:${SkillId}` | 'claimAll' | `trophy:${string}`
  | `bait:${BaitId}` | `buyBait:${BaitId}:${number}`
  | 'buyCompany' | `buyBoat:${BoatType}` | `boat:${number}` | `send:${number}` | `collect:${number}` | `crew:${number}` | `net:${number}`
  | 'sendAll' | 'collectAll' | `ground:${number}:${string}` | `track:${TrackId}` | `upgrade:${number}:${TrackId}`
  | `sellBoat:${number}` | 'buyBerth' | 'buyWarehouse' | `buyHarbor:${HarborUpgradeId}`
  | 'buyPierSection' | `budget:${number}`
  | 'hire' | 'sellCrate' | `hand:${number}` | `handRod:${number}` | `handTrain:${number}` | `handBait:${number}:${BaitId}`;

const GEAR_ORDER: GearKind[] = ['rod', 'holders', 'auto', 'clothes', 'boots'];
export const GEAR_ICON: Record<GearKind, IconName> = { rod: 'rod', holders: 'holder', auto: 'auto', clothes: 'shirt', boots: 'boot' };
const ROMAN: Record<Tier, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };
/** Where each slot of a tree side sits in its half of the sky (percent): root at the bottom, two branches, two tips. */
const POS = [{ x: 50, y: 84 }, { x: 24, y: 52 }, { x: 76, y: 52 }, { x: 24, y: 18 }, { x: 76, y: 18 }];

export const BAIT_ICON: Record<BaitId, IconName> = { worm: 'bait', cricket: 'cricket', shiner: 'shiner', leech: 'leech', glow: 'glow', gold: 'gold' };
export const SKILL_ICON: Record<SkillId, IconName> = { fishing: 'hook', reflexes: 'bolt', haggling: 'bag', strength: 'fist' };
export const ACH_ICON: Record<AchStat, IconName> = {
  catches: 'fish', species: 'book', tier: 'trophy', giant: 'star', golden: 'star', shiny: 'star', variants: 'star',
  earned: 'coin', lines: 'holder', auto: 'auto', fishing: 'hook',
  treeUnlocked: 'pearl', treeTiers: 'star', treeRiver: 'rod', treeSea: 'boat', treeRiverTier: 'trophy', treeSeaTier: 'anchor', retired: 'letter',
};

const num = (n: number) => n.toLocaleString('en-US');
const pct = (x: number) => `${Math.round(x * 100)}%`;
const coin = (n: number, scale = 2) => `<span class="cash"><img src="${pixelIcon('coin', scale)}" alt="">${num(n)}</span>`;
/** Short money for tight buttons: $8.8M. */
const cash = (n: number) => `<span class="cash"><img src="${pixelIcon('coin', 2)}" alt="">${kmb(n)}</span>`;
const icon = (name: IconName, scale = 3) => `<img src="${pixelIcon(name, scale)}" alt="">`;
/** Level as pips (short tracks) or a bar (long ones). */
const level = (lv: number, max: number) => max <= 10
  ? `<span class="pips">${Array.from({ length: max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</span>`
  : `<span class="bar"><i style="width:${Math.round((lv / max) * 100)}%"></i></span>`;
const short = (s: string) => s.replace(/\.$/, '');
/** Compact money for tight rows: 950, 12.4k, 3.1M. */
const kmb = (n: number) => {
  const a = Math.abs(n), sign = n < 0 ? '-' : '';
  return sign + (a >= 1e6 ? `${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M` : a >= 1e3 ? `${(a / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k` : String(Math.round(a)));
};
/** Minutes as "45m" or "3.2h". */
const mins = (m: number) => (!isFinite(m) || m <= 0 ? 'never' : m < 90 ? `${Math.ceil(m)}m` : `${(m / 60).toFixed(1)}h`);

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
  /** Lighthouse: which region's legends are shown. */
  lhRegion: 'coast' | 'ocean' | 'abyss' = 'coast';
  /** Exotic Market: which tab, and which listing is open. */
  exTab: 'hold' | 'listed' | 'wanted' = 'hold';
  exSel = 0;
  /** The Fishing Co. tab last shown (a boat or the shipyard goes back to it). */
  coTab: 'harbor' | 'ledger' | 'harborup' = 'harbor';

  /** Where ◄ goes from a panel (null: it has no parent, only X). */
  parentOf(panel: Panel | null): Panel | null {
    if (panel === 'boat' || panel === 'shipyard') return this.coTab;
    return ({ hand: 'pier', pierstaff: 'pier', tree: 'settings', retire: 'settings', listing: 'exotic', voyage: 'lighthouse' } as Partial<Record<Panel, Panel>>)[panel ?? 'market'] ?? null;
  }
  /** Trophy page: the originals, or the Fish Tree's. */
  achTab: 'base' | 'tree' = 'base';
  /** Boat / fisherman shown in their detail panels. */
  boatSel = 0;
  handSel = 0;
  /** Upgrade track shown in the boat panel's detail strip. */
  trackSel: TrackId = 'hull';
  /** Fish Tree page: which tier is showing, which fish is selected. Journal: which tier. */
  treeTier: Tier = 1;
  treeSel = '';
  journalTier: Tier = 1;
  /** Money made per second by source, averaged over the last minute (set by main). */
  rates: { you: number; hands: number; boats: number } | null = null;

  /** A finger / mouse button is down on the interface: hold redraws so buttons don't change under it. */
  private pressing = false;

  /**
   * Taps act on release, matched by the button's action rather than the
   * element: the panels redraw as money and timers tick, and a plain click
   * is lost if its button was replaced between press and release. Sliding
   * off the button still cancels. Keyboard activation keeps using click.
   */
  constructor(onAction: (a: Action) => void) {
    const actOf = (el: Element | null) => {
      const btn = el?.closest('[data-act]') as HTMLButtonElement | null;
      return btn && !btn.disabled ? (btn.dataset.act as Action) : null;
    };
    let downAct: Action | null = null;
    document.body.addEventListener('pointerdown', (e) => {
      downAct = actOf(e.target as Element);
      this.pressing = !!downAct;
    });
    // Listen on the window so a release anywhere (even off the page) ends the press.
    addEventListener('pointerup', (e) => {
      const act = actOf(document.elementFromPoint(e.clientX, e.clientY));
      if (downAct && act === downAct) onAction(act);
      downAct = null;
      this.pressing = false;
    });
    const reset = () => { downAct = null; this.pressing = false; };
    addEventListener('pointercancel', reset);
    addEventListener('blur', reset);
    document.body.addEventListener('click', (e) => {
      if (e.detail !== 0) return; // pointer taps were handled on release
      const act = actOf(e.target as Element);
      if (act) onAction(act);
    });
  }

  /** The $/sec readout under the purse: one line per source you have. */
  private ratesHtml(game: Game): string {
    const r = this.rates;
    if (!r) return '';
    const rows: [string, number][] = [['You', r.you]];
    if (game.hands.length) rows.push(['Fishermen', r.hands]);
    if (game.boats.length) rows.push(['Boats', r.boats]);
    const fmt = (n: number) => (n < 10 ? n.toFixed(1) : kmb(Math.round(n)));
    return `<div class="plaque rates">${rows.map(([k, v]) => `<span>${k}</span><b>$${fmt(v)}/s</b>`).join('')}</div>`;
  }

  update(_dt: number, game: Game, place: Place | null, walking: boolean): void {
    if (this.open === 'inbox') this.notices.markRead();
    this.notices.update();
    const ready = game.claimable().length, unread = this.notices.unread;
    const badge = (n: number) => (n ? `<i class="badge">${n}</i>` : '');
    this.top.classList.toggle('panel-open', !!this.open);
    this.set('top', this.top,
      `<div class="wallet"><div class="plaque purse">${icon('coin')}${num(game.money)}</div>${this.ratesHtml(game)}</div>` +
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
          : panel === 'harbor' ? [game.company ? 'Fishing Co.' : 'Old Harbor', this.harborHtml(game)]
          : panel === 'boat' ? [game.boats[this.boatSel] ? game.boatName(this.boatSel) : 'Boat', this.boatHtml(game)]
          : panel === 'ledger' ? ['Ledger', this.ledgerHtml(game)]
          : panel === 'shipyard' ? [`Shipyard ${game.boats.length}/${game.berthCount}`, this.shipyardHtml(game)]
          : panel === 'harborup' ? ['Harbor', this.harborUpHtml(game)]
          : panel === 'pier' ? [`The Pier ${game.hands.length}/${game.pierSpots}`, this.pierHtml(game)]
          : panel === 'pierstaff' ? ['Pier Staff', this.pierStaffHtml(game)]
          : panel === 'hand' ? [HAND_NAMES[this.handSel] ?? 'Fisherman', this.handHtml(game)]
          : panel === 'training' ? ['Fishing School', this.schoolHtml(game)]
            : panel === 'journal' ? [`Journal ${Object.keys(game.journal).length}/${FISH.length + TREE_FISH.filter((f) => f.side === 'river').length}`, this.journalHtml(game)]
            : panel === 'tree' ? ['Fish Tree', this.treeHtml(game)]
            : panel === 'lighthouse' ? ['Lighthouse', this.lighthouseHtml(game)]
            : panel === 'voyage' ? [game.voyage ? V.legendOf(game.voyage).spot : 'Voyage', this.voyageHtml(game)]
            : panel === 'exotic' ? ['Exotic Market', this.exoticHtml(game)]
            : panel === 'listing' ? [this.listingTitle(game), this.listingHtml(game)]
            : panel === 'retire' ? ['Retire', this.retireHtml(game)]
              : panel === 'trophies' ? [`Trophies ${game.claimed.length}/${ACHIEVEMENTS.length}`, this.trophiesHtml(game)]
                : panel === 'inbox' ? ['Log', this.inboxHtml()]
                  : ['Settings', this.settingsHtml(game)];
    // ◄ back to the parent (if any), X always closes. A boat flips to the previous/next boat instead of showing the money (it's in the corner anyway).
    const tabbed = game.company && (panel === 'harbor' || panel === 'ledger' || panel === 'harborup');
    if (tabbed) this.coTab = panel;
    const back = this.parentOf(panel) ? `<button class="bbtn" data-act="back" aria-label="back">${icon('back', 2)}</button>` : '';
    const n = game.boats.length;
    const right = panel === 'boat' && n > 1
      ? `<span class="flip"><button class="bbtn" data-act="boatPrev" aria-label="previous boat">${icon('prev', 2)}</button><small>${this.boatSel + 1}/${n}</small><button class="bbtn" data-act="boatNext" aria-label="next boat">${icon('next', 2)}</button></span>`
      : panel === 'boat' ? '' : coin(game.money, 3);
    const tabs = tabbed ? `<div class="tiers three">${([['harbor', 'FLEET'], ['ledger', 'LEDGER'], ['harborup', 'HARBOR']] as const)
      .map(([p, label]) => `<button class="tab${panel === p ? ' on' : ''}" style="--c:#2f6fd6" data-act="coTab:${p}">${label}</button>`).join('')}</div>` : '';
    const co = tabbed || panel === 'boat' || panel === 'shipyard' ? ' co' : '';
    return `<div class="panel ${panel}${co}"><div class="head">${back}<h2>${title}</h2>${right}
      <button class="xbtn" data-act="close" aria-label="close">${icon('close', 2)}</button></div><div class="body">${tabs}${body}</div></div>`;
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
    const cells = game.riverFish().filter((f) => groups.has(f.id)).map((f) => {
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
        <b>${b.name}</b><div class="sub">${coin(b.price, 1)}<small>${best} ${pct(top)}</small></div></div>${buy(1)}${buy(10)}${buy(100)}</div>`;
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

  /**
   * The harbor across the river, nothing else. Before the reveal it gives
   * nothing away; then it's for sale; once bought it runs the boats.
   */
  private harborHtml(game: Game): string {
    const row = (ic: IconName, name: string, sub: string, right = '') =>
      `<div class="row"><div class="slot">${icon(ic)}</div><div class="meta"><b>${name}</b><div class="sub"><small>${sub}</small></div></div>${right}</div>`;
    if (!game.companyRevealed) {
      const p = Math.min(1, game.earned / COMPANY_UNLOCK_EARNED);
      const letters = LETTERS.slice(0, Math.min(game.letters, LETTERS.length - 1))
        .map((l) => `<div class="row letter"><div class="slot">${icon('letter')}</div><p>${l.text}</p></div>`).join('');
      return row('lock', 'Boarded up', 'Someone is watching you...')
        + `<div class="row"><div class="meta"><div class="sub"><span class="bar wide"><i style="width:${Math.round(p * 100)}%"></i></span><small>${pct(p)}</small></div></div></div>`
        + letters;
    }
    if (!game.company) {
      return row('boat', 'Fishing boats', 'Send them out to sea')
        + row('crew', 'Hire a crew', 'Bigger hauls, faster trips')
        + row('net', 'Nets', 'Herring to Bluefin Tuna')
        + row('lock', '???', 'Something with claws')
        + row('lock', '???', 'Something with a sword')
        + `<button class="btn wide" data-act="buyCompany" ${game.money < COMPANY_PRICE ? 'disabled' : ''}>BUY THE COMPANY ${coin(COMPANY_PRICE, 3)}</button>`;
    }
    // The company: quick send / sell, a tile per berth (boat or empty), a summary line.
    const tiles = Array.from({ length: game.berthCount }, (_, i) => {
      const b = game.boats[i];
      if (!b) return `<div class="cell"><button class="slot berth" data-act="shipyard" aria-label="buy a boat">${icon('plus', 2)}</button><span class="small">Empty</span></div>`;
      const left = b.trip ? Math.ceil(b.trip.dur - b.trip.t) : 0;
      const state = b.haul ? '<b class="ready">SELL</b>' : b.trip ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'Idle';
      return `<div class="cell"><button class="slot ${b.haul ? 'sel' : ''}" data-act="boat:${i}" aria-label="${game.boatName(i)}">${icon(b.type === 'lobster' ? 'trap' : b.type === 'sword' ? 'hook' : 'boat')}
        ${b.tracks.captain ? `<img class="tick" src="${pixelIcon('captain', 1)}" alt="">` : ''}</button><span class="small">${state}</span></div>`;
    }).join('');
    const ready = game.boats.filter((b) => b.haul).length, idle = game.boats.filter((b) => !b.trip && !b.haul).length;
    const quick = ready ? `<button class="btn wide" data-act="collectAll">SELL ${ready} HAUL${ready > 1 ? 'S' : ''} ${coin(game.boats.reduce((s2, b) => s2 + (b.haul ? game.haulValue(b) : 0), 0), 3)}</button>`
      : idle ? `<button class="btn wide" data-act="sendAll">SEND ${idle} BOAT${idle > 1 ? 'S' : ''}</button>` : '';
    // The Ledger and Harbor are tabs now; a one-line summary keeps their headline numbers here.
    const fleetRate = game.boats.reduce((s2, b) => s2 + game.boatRate(b), 0);
    const summary = `<p class="note">Fleet $${kmb(fleetRate)}/min · ${game.boats.length}/${game.berthCount} berths · ${game.harbor.master ? 'Harbor Master' : 'no staff'} · ${game.offlineHours}h away</p>`;
    return `${quick}<div class="grid fleet">${tiles}</div>${summary}`;
  }

  private boatStatus(game: Game, b: Boat): string {
    const left = b.trip ? Math.ceil(b.trip.dur - b.trip.t) : 0;
    const ev = b.event === 'storm' ? 'Storm! Lost half' : b.event === 'school' ? 'Lucky school! x2' : b.event === 'sighting' ? 'Trophy catch!' : '';
    const ground = GROUNDS.find((g) => g.id === b.ground)!.name;
    return b.haul ? (ev || `Back with ${b.haul.reduce((s, h) => s + h.n, 0)} catches`)
      : b.trip ? `At sea: ${GROUNDS.find((g) => g.id === b.trip!.ground)!.name}` : `Ready for the ${ground}`;
  }

  private boatAction(game: Game, b: Boat, i: number): string {
    return b.haul ? `<button class="btn" data-act="collect:${i}">${coin(game.haulValue(b))}</button>`
      : b.trip ? `<span class="maxed">${Math.floor(Math.ceil(b.trip.dur - b.trip.t) / 60)}:${String(Math.ceil(b.trip.dur - b.trip.t) % 60).padStart(2, '0')}</span>` : `<button class="btn" data-act="send:${i}">SEND</button>`;
  }

  /** Icon for an upgrade track (gear depends on the kind of boat). */
  private trackIcon(b: Boat, id: TrackId): IconName {
    if (id === 'gear') return b.type === 'lobster' ? 'trap' : b.type === 'sword' ? 'hook' : 'net';
    return ({ hull: 'boat', engine: 'engine', sonar: 'sonar', ice: 'ice', captain: 'captain' } as const)[id];
  }

  /** One boat: status, where it fishes, its six upgrade tracks, its crew. */
  private boatHtml(game: Game): string {
    const i = this.boatSel, b = game.boats[i];
    if (!b) return '<p class="empty">No boat.</p>';
    const def = BOATS[b.type];
    const rate = game.boatRate(b);
    const status = `<div class="row"><div class="slot">${icon(this.trackIcon(b, 'gear'))}</div><div class="meta"><b>${def.gearNames[b.tracks.gear]} <span class="small">$${kmb(rate)}/min</span></b>
      <div class="sub"><small>${this.boatStatus(game, b)}</small></div></div>${this.boatAction(game, b, i)}</div>`;
    const haul = b.haul ? `<div class="haul">${b.haul.map((h) => {
      const f = fishById(h.fish);
      return `<span><img src="${fishIcon(f, false, 48, 28)}" alt="${f.name}">x${h.n}</span>`;
    }).join('')}</div>` : '';
    // Fishing grounds: tap to choose; locked ones show what they need.
    const grounds = GROUNDS.map((g) => {
      const open = game.groundOpen(b, g);
      const need = (Object.entries(g.need) as [TrackId, number][]).filter(([id, l]) => b.tracks[id] < l).map(([id, l]) => `${TRACKS[id].name} ${l}`).join(', ');
      return `<button class="ground ${b.ground === g.id ? 'sel' : ''} ${open ? '' : 'locked'}" data-act="ground:${i}:${g.id}" ${open ? '' : 'disabled'} title="${open ? `$${kmb(game.boatRate(b, { ground: g.id }))}/min, ${Math.round(game.tripSeconds(b, g.id))}s trips, storms ${pct(game.stormChance(b, g.id))}` : `Needs ${need}`}">
        ${open ? '' : icon('lock', 1)}${g.name.replace('Open Sea', 'Sea').replace('The Deep', 'Deep')}</button>`;
    }).join('');
    // Six upgrade tracks; the selected one gets the detail strip.
    const tiles = TRACK_ORDER.map((id) => `<div class="cell"><button class="slot ${this.trackSel === id ? 'sel' : ''}" data-act="track:${id}" title="${TRACKS[id].name}">
      ${icon(this.trackIcon(b, id))}</button>${level(b.tracks[id], TRACK_MAX)}</div>`).join('');
    const id = this.trackSel, cost = game.nextTrackCost(i, id);
    const name = id === 'gear' ? def.gearNames[Math.min(b.tracks.gear + 1, TRACK_MAX)]! : TRACKS[id].name;
    // Upgrade preview: what this level adds per minute and how fast it pays for itself.
    const gain = cost === null ? 0 : game.boatRate(b, { track: id }) - rate;
    const preview = cost === null ? TRACKS[id].blurb
      : id === 'captain' && b.tracks.captain === 0 ? 'Sails by itself · 8% wages'
      : gain > 1 ? `<span class="up">+$${kmb(gain)}/min</span> · back in ${mins(cost / gain)}`
      : id === 'engine' || id === 'hull' || id === 'sonar' ? `${TRACKS[id].blurb}` : 'No gain here';
    const detail = `<div class="row detail"><div class="meta"><b>${name} <span class="small">LV ${b.tracks[id]}</span></b><div class="sub"><small>${preview}</small></div></div>
      ${cost === null ? '<span class="maxed">MAX</span>' : `<button class="btn" data-act="upgrade:${i}:${id}" ${game.money < cost ? 'disabled' : ''}>${coin(cost)}</button>`}</div>`;
    const crewCost = game.nextCrewCost(i);
    const crewGain = crewCost === null ? 0 : game.boatRate(b, { crew: true }) - rate;
    const crew = `<div class="row"><div class="slot">${icon('crew')}</div><div class="meta"><b>Crew ${b.crew}/${game.crewMax(b)}</b><div class="sub"><small>${crewCost === null ? `${game.haulSize(b)} a trip · Hull adds slots` : `<span class="up">+$${kmb(crewGain)}/min</span> · back in ${mins(crewCost / crewGain)}`}</small></div></div>
      ${crewCost === null ? '<span class="maxed">FULL</span>' : `<button class="btn" data-act="crew:${i}" ${game.money < crewCost ? 'disabled' : ''}>${coin(crewCost)}</button>`}</div>`;
    const sell = `<div class="row"><div class="meta"><b>Sell boat</b><div class="sub"><small>${b.trip ? 'At sea: this trip is lost' : 'Frees the berth'}</small></div></div>
      <button class="btn red" data-act="sellBoat:${i}">${coin(game.boatResale(i))}</button></div>`;
    return status + haul + `<div class="grounds">${grounds}</div><div class="grid tracks">${tiles}</div>` + detail + crew + sell;
  }

  /**
   * The ledger, nothing else: the fleet's totals, then per boat what it makes
   * per minute now, what it has earned against what went into it, and its
   * profit so far. Tap a boat to open it.
   */
  private ledgerHtml(game: Game): string {
    const sum = (f: (b: Boat) => number) => game.boats.reduce((s, b) => s + f(b), 0);
    const profit = (n: number) => `<span class="cash ${n >= 0 ? 'gain' : 'loss'}">${n >= 0 ? '+' : '-'}$${kmb(Math.abs(n))}</span>`;
    // The fleet total as one line, so eight boats fit under the tabs on a small phone.
    const total = `<div class="ledger-total"><b>Fleet $${kmb(sum((b) => game.boatRate(b)))}/min</b><small>earned $${kmb(sum((b) => b.earned))} · cost $${kmb(sum((b) => b.invested))}</small>${profit(sum((b) => b.earned - b.invested))}</div>`;
    const rows = game.boats.map((b, i) => {
      const rate = game.boatRate(b), left = b.invested - b.earned;
      const payback = left <= 0 ? 'paid off' : `pays off in ${mins(left / Math.max(1, rate))}`;
      return `<button class="row tight" data-act="boat:${i}"><div class="slot">${icon(b.type === 'lobster' ? 'trap' : b.type === 'sword' ? 'hook' : 'boat', 2)}</div>
        <div class="meta"><b>${game.boatName(i)} <span class="small">$${kmb(rate)}/min</span></b><div class="sub"><small>$${kmb(b.earned)} of $${kmb(b.invested)} · ${payback}</small></div></div>${profit(b.earned - b.invested)}</button>`;
    }).join('');
    return total + rows;
  }

  /** Buy boats, nothing else. */
  private shipyardHtml(game: Game): string {
    const full = game.boats.length >= game.berthCount;
    return BOAT_ORDER.map((type) => {
      const def = BOATS[type], price = game.boatPrice(type);
      return `<div class="row"><div class="slot">${icon(type === 'lobster' ? 'trap' : type === 'sword' ? 'hook' : 'boat')}</div><div class="meta"><b>${def.name}</b>
        <div class="sub"><small>${def.blurb}</small></div></div><button class="btn" data-act="buyBoat:${type}" ${full || game.money < price ? 'disabled' : ''}>${coin(price)}</button></div>`;
    }).join('') + `<p class="note">${full ? 'All berths are taken: build more at the Harbor.' : 'Each extra boat of a kind costs 50% more.'}</p>`;
  }

  /** The harbor itself: berths, staff who automate the work, the warehouse. */
  private harborUpHtml(game: Game): string {
    const row = (ic: IconName, name: string, sub: string, right: string) =>
      `<div class="row"><div class="slot">${icon(ic)}</div><div class="meta"><b>${name}</b><div class="sub"><small>${sub}</small></div></div>${right}</div>`;
    const buy = (act: string, price: number) => `<button class="btn" data-act="${act}" ${game.money < price ? 'disabled' : ''}>${coin(price)}</button>`;
    const berth = game.nextBerth(), wh = game.nextWarehouse();
    const staff = (['master'] as HarborUpgradeId[]).map((k) => {
      const u = HARBOR_UPGRADES[k];
      return row('captain', u.name, `${u.blurb} · ${pct(u.fee)} ${u.feeName}`, game.harbor[k] ? '<span class="maxed">HIRED</span>' : buy(`buyHarbor:${k}`, u.price));
    }).join('');
    return row('anchor', `Berths ${game.berthCount}/${BERTHS[BERTHS.length - 1]!.boats}`, 'Room for more boats', berth ? buy('buyBerth', berth.price) : '<span class="maxed">MAX</span>')
      + staff
      + row('trap', `Warehouse ${game.offlineHours}h`, 'Keeps earning while you are away', wh ? buy('buyWarehouse', wh.price) : '<span class="maxed">MAX</span>');
  }

  /** The pier, nothing else: the catch crate, a tile per fishing spot (tap to manage or hire), and the staff. */
  private pierHtml(game: Game): string {
    const crate = `<div class="row"><div class="slot">${icon('fish')}</div><div class="meta"><b>Catch crate</b><div class="sub"><small>${game.crate.length} fish${game.harbor.seller ? ' · seller collects' : ''}</small></div></div>
      <button class="btn" data-act="sellCrate" ${game.crate.length ? '' : 'disabled'}>${coin(game.crateValue())}</button></div>`;
    const cost = game.nextHandCost();
    const tiles = Array.from({ length: game.pierSpots }, (_, i) => {
      const h = game.hands[i];
      if (!h) {
        const next = i === game.hands.length && cost !== null;
        return `<div class="cell"><button class="slot berth" ${next ? 'data-act="hire"' : 'disabled'} aria-label="hire">${icon('plus', 2)}</button>
          <span class="small">${next ? coin(cost!, 1) : ''}</span></div>`;
      }
      return `<div class="cell"><button class="slot ${game.handStarved(h) ? 'starved' : ''}" data-act="hand:${i}" title="${HAND_NAMES[i]}">${icon(BAIT_ICON[h.bait], 2)}
        <i class="n">${h.skill}</i></button><span class="small">${HAND_NAMES[i]}</span></div>`;
    }).join('');
    const staff = PIER_STAFF.filter((k) => game.harbor[k]).length;
    return crate + `<div class="grid hands">${tiles}</div>`
      + `<div class="row"><button class="slot" data-act="pierstaff" aria-label="staff">${icon('captain')}</button><div class="meta"><b>Staff</b>
        <div class="sub"><small>${staff}/${PIER_STAFF.length} hired · ${game.pierSpots}/${HANDS_MAX} spots</small></div></div><button class="btn plain" data-act="pierstaff">OPEN</button></div>`;
  }

  /** Pier staff and expansion: sections, the Manager (and their budget), the Bait Supplier, the Fish Seller. */
  private pierStaffHtml(game: Game): string {
    const row = (ic: IconName, name: string, sub: string, right: string) =>
      `<div class="row"><div class="slot">${icon(ic)}</div><div class="meta"><b>${name}</b><div class="sub"><small>${sub}</small></div></div>${right}</div>`;
    const buy = (act: string, price: number) => `<button class="btn" data-act="${act}" ${game.money < price ? 'disabled' : ''}>${coin(price)}</button>`;
    const section = game.nextPierSection();
    const ic: Record<string, IconName> = { manager: 'captain', supplier: 'bait', seller: 'coin' };
    const staff = PIER_STAFF.map((k) => {
      const u = HARBOR_UPGRADES[k];
      return row(ic[k]!, u.name, `${u.blurb} · ${pct(u.fee)} ${u.feeName}`, game.harbor[k] ? '<span class="maxed">HIRED</span>' : buy(`buyHarbor:${k}`, u.price));
    }).join('');
    const budget = game.harbor.manager
      ? `<div class="row"><div class="meta"><b>Manager budget</b><div class="sub"><small>Spends up to this share of your money per upgrade</small></div></div></div>
        <div class="budgets">${MANAGER_BUDGETS.map((v, i) => `<button class="ground ${game.managerBudget === i ? 'sel' : ''}" data-act="budget:${i}">${v ? pct(v) : 'Off'}</button>`).join('')}</div>`
      : '';
    return row('anchor', `Pier ${game.pierSpots}/${HANDS_MAX} spots`, `A new section adds ${PIER_SPOTS}`, section === null ? '<span class="maxed">MAX</span>' : buy('buyPierSection', section))
      + staff + budget;
  }

  /** One fisherman: rod, training, and which bait they use from your pouch. */
  private handHtml(game: Game): string {
    const i = this.handSel, h = game.hands[i];
    if (!h) return '<p class="empty">No one here.</p>';
    const rod = game.handNextRod(i), train = game.handTrainCost(i);
    const odds = game.handOdds(h);
    const tier = RODS[h.rod]!.tier as Tier;
    const top = odds.filter((o) => !o.tooStrong && o.fish.tier === tier).reduce((s, o) => s + o.p, 0);
    const row = (ic: IconName, name: string, sub: string, right: string) =>
      `<div class="row"><div class="slot">${icon(ic)}</div><div class="meta"><b>${name}</b><div class="sub">${sub}</div></div>${right}</div>`;
    const baits = BAITS.map((b) => `<div class="cell"><button class="slot ${game.baitCount(b.id) ? '' : 'dim'} ${b.id === h.bait ? 'sel' : ''}" data-act="handBait:${i}:${b.id}" title="${b.name}">
      ${icon(BAIT_ICON[b.id])}<i class="n">x${game.baitCount(b.id)}</i></button></div>`).join('');
    return row('rod', RODS[h.rod]!.name, `${level(h.rod + 1, RODS.length)}<small>${TIERS[tier].name} ${pct(top)}</small>`,
        rod ? `<button class="btn" data-act="handRod:${i}" ${game.money < rod.price ? 'disabled' : ''}>${coin(rod.price)}</button>` : '<span class="maxed">MAX</span>')
      + row('hook', `Fishing LV ${h.skill}`, `${level(h.skill, HAND_SKILL_MAX)}<small>Quicker hands</small>`,
        train === null ? '<span class="maxed">MAX</span>' : `<button class="btn" data-act="handTrain:${i}" ${game.money < train ? 'disabled' : ''}>${coin(train)}</button>`)
      + `<div class="grid three">${baits}</div><p class="note">${game.harbor.manager ? 'Your manager picks the best bait for them.' : 'Tap a bait: they take it from your pouch, one per cast.'}</p>`;
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

  /** The collection, nothing else: one tier per tab, the four originals then the five from the Fish Tree (locked until unlocked there). */
  private journalHtml(game: Game): string {
    const t = this.journalTier;
    const tabs = `<div class="tiers">${([1, 2, 3, 4, 5] as Tier[]).map((k) => `<button class="tab${k === t ? ' on' : ''}" style="--c:${TIERS[k].color}" data-act="journalTier:${k}">${ROMAN[k]}</button>`).join('')}</div>`;
    const tree = TREE_FISH.filter((f) => f.side === 'river' && f.tier === t);
    const locked = tree.filter((f) => !game.fishTree.includes(f.id)).map(() => `<div class="cell"><div class="slot dim">${icon('lock')}</div><span class="small">Tree</span><span class="vm"></span></div>`).join('');
    const cells = [...FISH.filter((f) => f.tier === t), ...tree.filter((f) => game.fishTree.includes(f.id))].map((f) => {
      const j = game.journal[f.id];
      const marks = VARIANT_ORDER.map((v) => `<i class="${j?.variants?.[v] ? 'got' : ''}" style="--c:${VARIANTS[v].color}"></i>`).join('');
      return `<div class="cell"><div class="slot ${j ? '' : 'dim'}" title="${j ? `${f.name} · best ${j.bestKg} kg` : TIERS[f.tier].name}">
        <img src="${fishIcon(f, !j, 48, 28)}" alt=""></div><span class="small">${j ? `x${num(j.count)}` : '?'}</span><span class="vm">${marks}</span></div>`;
    }).join('');
    return `${tabs}<div class="grid">${cells}${locked}</div><p class="note">Rare finds ${game.variantsFound()}/${game.riverFish().length * VARIANT_ORDER.length} · Giant, Golden, Shiny</p>`;
  }

  /** Achievements, nothing else: a 4x5 trophy grid and a detail strip for the selected one. */
  private trophiesHtml(game: Game): string {
    const ready = game.claimable();
    const page = ACHIEVEMENTS.filter((a) => (a.page === 'tree') === (this.achTab === 'tree'));
    const pick = page.find((a) => a.id === this.pick) ?? page.find((a) => ready.includes(a)) ?? page.find((a) => !game.claimed.includes(a.id)) ?? page[0]!;
    const count = (tree: boolean) => ready.filter((a) => (a.page === 'tree') === tree).length;
    const tabs = `<div class="tiers two"><button class="tab${this.achTab === 'base' ? ' on' : ''}" style="--c:#4fbf5a" data-act="achTab:base">RIVER LIFE${count(false) ? ` (${count(false)})` : ''}</button>`
      + `<button class="tab${this.achTab === 'tree' ? ' on' : ''}" style="--c:#3f8fe0" data-act="achTab:tree">FISH TREE${count(true) ? ` (${count(true)})` : ''}</button></div>`;
    const tiles = page.map((a) => {
      const claimed = game.claimed.includes(a.id);
      const state = claimed ? 'claimed' : game.achieved(a) ? 'ready' : 'locked';
      return `<div class="cell"><button class="slot trophy ${state} ${a === pick ? 'sel' : ''}" data-act="trophy:${a.id}" title="${a.name}">
        ${icon(ACH_ICON[a.stat])}${claimed ? `<img class="tick" src="${pixelIcon('check', 2)}" alt="">` : ''}</button></div>`;
    }).join('');
    const progress = `${num(Math.min(game.stat(pick.stat), pick.goal))}/${num(pick.goal)}`;
    const state = game.claimed.includes(pick.id) ? 'Collected' : game.achieved(pick) ? 'Ready' : progress;
    const collect = ready.length
      ? `<button class="btn wide" data-act="claimAll">COLLECT ${coin(ready.reduce((s, a) => s + a.reward, 0), 3)}</button>` : '';
    return `${collect}${tabs}<div class="grid">${tiles}</div>
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
  // ---------- prestige ----------

  /**
   * The Fish Tree: one tier per tab, drawn as a night-sky constellation, the
   * river fish (you and your fishermen) on the left, the sea fish (boats) on
   * the right, lines from each fish to the one it needs. Tap a fish for its
   * details and UNLOCK.
   */
  private treeHtml(game: Game): string {
    const t = this.treeTier;
    const pearls = `<div class="row tight"><div class="slot">${icon('pearl')}</div><div class="meta"><b>${game.pearls} Pearls</b><div class="sub"><small>Spend them on new fish</small></div></div></div>`;
    const tabs = `<div class="tiers">${([1, 2, 3, 4, 5] as Tier[]).map((k) => `<button class="tab${k === t ? ' on' : ''}${game.treeTierOpen(k) ? '' : ' shut'}" style="--c:${TIERS[k].color}" data-act="treeTier:${k}">${game.treeTierOpen(k) ? ROMAN[k] : icon('lock', 2)}</button>`).join('')}</div>`;
    const fish = TREE_FISH.filter((f) => f.tier === t);
    const at = (f: TreeFish) => ({ x: (f.side === 'river' ? 0 : 50) + POS[f.slot]!.x / 2, y: POS[f.slot]!.y });
    const lines = fish.filter((f) => f.parent).map((f) => {
      const a = at(f), b = at(fish.find((p) => p.id === f.parent)!), lit = game.fishTree.includes(f.id);
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${lit ? 'lit' : ''}"/>`;
    }).join('');
    const nodes = fish.map((f) => {
      const p = at(f), own = game.fishTree.includes(f.id);
      const state = own ? 'own' : game.canUnlock(f.id) ? 'buy' : game.treeReachable(f) ? 'next' : 'far';
      return `<button class="star ${state}${this.treeSel === f.id ? ' sel' : ''}" style="left:${p.x}%;top:${p.y}%" data-act="treeSel:${f.id}">
        <img src="${fishIcon(f, !own, 40, 24)}" alt=""><i>${own ? '' : f.cost}</i></button>`;
    }).join('');
    const sky = `<div class="sky"><span class="side l">RIVER</span><span class="side r">SEA</span><svg viewBox="0 0 100 100" preserveAspectRatio="none">${lines}<line x1="50" y1="4" x2="50" y2="96" class="split"/></svg>${nodes}</div>`;
    const sel = fish.find((f) => f.id === this.treeSel);
    const detail = !game.treeTierOpen(t)
      ? `<p class="note">Unlock any ${TIERS[(t - 1) as Tier].name} fish to open this tier.</p>`
      : !sel ? '<p class="note">Tap a fish. River fish bite for you and your fishermen; sea fish come back on boats.</p>'
      : `<div class="row"><div class="meta"><b>${sel.name} <span class="small">$${kmb(sel.price)} each</span></b><div class="sub"><small class="wrap">${
          sel.side === 'river' ? 'River: you and your fishermen' : `${BOATS[sel.boat!].name}: ${GROUNDS.find((g) => g.id === sel.ground)!.name} and deeper`}</small></div></div>
        ${game.fishTree.includes(sel.id) ? '<span class="maxed">OWNED</span>' : `<button class="btn" data-act="unlock:${sel.id}" ${game.canUnlock(sel.id) ? '' : 'disabled'}>${icon('pearl', 2)} ${sel.cost}</button>`}</div>`;
    return pearls + tabs + sky + detail;
  }

  /** The Lighthouse: where expeditions will sail from. For now, practice fights against the legends. */
  private lighthouseHtml(game: Game): string {
    if (!game.company) return `<div class="row"><div class="slot">${icon('lock')}</div><div class="meta"><b>Boarded up</b><div class="sub"><small>Own the Fishing Co. first</small></div></div></div>`;
    const r = this.lhRegion, rest = Math.ceil(game.flagshipRest);
    // The Flagship: buy it, at sea (resume), resting, or ready.
    const ship = !game.flagship
      ? `<div class="row"><div class="slot">${icon('boat')}</div><div class="meta"><b>The Flagship</b><div class="sub"><small>Sail to the legends</small></div></div>
        <button class="btn" data-act="buyFlagship" ${game.money < VOYAGE.flagship ? 'disabled' : ''}>${cash(VOYAGE.flagship)}</button></div>`
      : game.voyage ? `<div class="row"><div class="slot">${icon('boat')}</div><div class="meta"><b>At sea</b><div class="sub"><small>${V.legendOf(game.voyage).spot}</small></div></div><button class="btn" data-act="voyage">RESUME</button></div>`
      : `<div class="row tight"><div class="slot">${icon('boat')}</div><div class="meta"><b>The Flagship</b><div class="sub"><small>${game.canSail() ? 'Ready to sail' : `Resting ${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, '0')}`}</small></div></div></div>`;
    const tabs = `<div class="tiers three">${(['coast', 'ocean', 'abyss'] as const).map((k) => `<button class="tab${r === k ? ' on' : ''}" style="--c:${k === 'coast' ? '#2eb082' : k === 'ocean' ? '#2f6fd6' : '#4a3a7a'}" data-act="lhRegion:${k}">${game.regionOpen(k) ? '' : icon('lock', 2)}${REGIONS[k].name.toUpperCase()}</button>`).join('')}</div>`;
    const rows = LEGENDS.filter((l) => l.region === r).map((l) => {
      const open = game.legendOpen(l), n = game.landed[l.id] ?? 0;
      const btn = !open ? `<span class="maxed">${icon('lock', 2)}</span>`
        : game.canSail() ? `<button class="btn" data-act="sail:${l.id}">SAIL</button>` : `<button class="btn plain" data-act="fight:${l.id}">TRY</button>`;
      return `<div class="row"><div class="slot"><img class="fit" src="${fishIcon(l, !open, 48, 28)}" alt=""></div><div class="meta"><b>${open ? l.name : '???'} <span class="small">$${kmb(l.price)}${n ? ` · x${n}` : ''}</span></b>
        <div class="sub"><small>${open ? `${l.spot} · ${l.blurb}` : l.id === 'theoldone' ? 'Land the rest of the Abyss' : 'Land a legend of the region before'}</small></div></div>${btn}</div>`;
    }).join('');
    return ship + tabs + `<p class="note">${REGIONS[r].twist}.</p>` + rows;
  }

  // ---------- voyages ----------

  /**
   * The voyage: supplies, hull and haul; the map (lighthouse at the bottom,
   * the legend's spot at the top, paths between spots, the ones you can
   * reach glowing); then the card for where you are: a spot's choices, the
   * fight, or the summary and HOME.
   */
  private voyageHtml(game: Game): string {
    const v = game.voyage;
    if (!v) return '<p class="empty">No voyage under way.</p>';
    const l = V.legendOf(v);
    const stat = `<div class="vstat"><span>${icon('bag', 2)}${v.supplies} ${v.supplies === 1 ? 'supply' : 'supplies'}</span><span>${icon('anchor', 2)}${'#'.repeat(v.hull).replace(/#/g, '<i class="hp"></i>')}${'<i class="hp lost"></i>'.repeat(Math.max(0, VOYAGE.hull - v.hull))}</span><span>${icon('coin', 2)}$${kmb(v.haul)}</span></div>`;
    // Positions in the map box (percent): rows from the bottom up, spots spread across.
    const yOf = (row: number) => (row < 0 ? 90 : row >= v.rows.length ? 9 : 70 - row * 21);
    const xOf = (row: number, i: number) => (row < 0 || row >= v.rows.length ? 50 : ((i + 0.5) / v.rows[row]!.length) * 100);
    const lines: string[] = [];
    const link = (r1: number, i1: number, r2: number, i2: number) => {
      const on = (r1 === v.row && i1 === (r1 < 0 ? 0 : v.at)) && (r2 === v.rows.length ? v.stage === 'map' && v.row === v.rows.length - 1 : V.canReach(v, i2));
      lines.push(`<line x1="${xOf(r1, i1)}" y1="${yOf(r1)}" x2="${xOf(r2, i2)}" y2="${yOf(r2)}" class="${on ? 'on' : ''}"/>`);
    };
    v.rows[0]!.forEach((_, i) => link(-1, 0, 0, i));
    for (let r = 0; r < v.rows.length - 1; r++) v.rows[r]!.forEach((_, i) => v.rows[r + 1]!.forEach((_, k) => {
      const here = (i + 0.5) / v.rows[r]!.length, there = (k + 0.5) / v.rows[r + 1]!.length;
      if (Math.abs(here - there) <= 0.5) link(r, i, r + 1, k);
    }));
    v.rows[v.rows.length - 1]!.forEach((_, i) => link(v.rows.length - 1, i, v.rows.length, 0));
    const KIND: Record<V.SpotKind, IconName> = { fish: 'net', event: 'quest', wreck: 'wreck', trader: 'coin' };
    const spots = v.rows.map((row, r) => row.map((s, i) => {
      const here = r === v.row && i === v.at, past = r < v.row, reach = V.canReach(v, i) && r === v.row + 1;
      return `<button class="vspot${here ? ' here' : ''}${past ? ' past' : ''}${reach ? ' reach' : ''}" style="left:${xOf(r, i)}%;top:${yOf(r)}%" ${reach ? `data-act="vsail:${i}"` : 'disabled'}>${icon(here ? 'boat' : KIND[s.kind], 2)}</button>`;
    }).join('')).join('');
    const toLegend = v.stage === 'map' && v.row === v.rows.length - 1;
    const legend = `<button class="vspot legend${toLegend ? ' reach' : ''}${v.stage === 'fight' || v.stage === 'over' ? ' here' : ''}" style="left:50%;top:${yOf(v.rows.length)}%" ${toLegend ? 'data-act="vlegend"' : 'disabled'}><img class="fit" src="${fishIcon(l, false, 48, 28)}" alt=""></button>`;
    const home = `<span class="vspot home${v.row < 0 ? ' here' : ''}" style="left:50%;top:${yOf(-1)}%">${icon(v.row < 0 ? 'boat' : 'anchor', 2)}</span>`;
    const map = `<div class="vmap"><svg viewBox="0 0 100 100" preserveAspectRatio="none">${lines.join('')}</svg>${home}${spots}${legend}</div>`;
    let card = `<p class="vnote">${v.note}</p>`;
    if (v.stage === 'map') card += `<p class="note">${toLegend ? `Sail on to ${l.spot} to fight the ${l.name}.` : 'Choose where to sail next. Each move costs a supply.'}</p>`;
    else if (v.stage === 'spot') card += `<div class="vchoices">${V.choices(v).map((c, k) => `<button class="btn${c.label.startsWith('SAIL') ? ' plain' : ''}" data-act="vchoose:${k}">${c.label}${c.cost ? `<small>${c.cost}</small>` : ''}</button>`).join('')}</div>`;
    else if (v.stage === 'fight') card += `<button class="btn wide" data-act="vfight">FIGHT THE ${l.name.toUpperCase()}</button>`;
    else card += `<p class="note">${v.result === 'failed' ? 'The haul is lost.' : `Haul: $${kmb(v.haul)}${v.result === 'caught' ? ` · ${l.name} ${(v.kg ?? 0).toLocaleString()} kg · +${V.pearlsFor(l)} Pearls` : ''}`}</p><button class="btn wide" data-act="vhome">HOME</button>`;
    return stat + map + card;
  }

  // ---------- the Exotic Market ----------

  /** Hold (list a fish), Listed (best offers; tap for all), Wanted (collectors' notices). */
  private exoticHtml(game: Game): string {
    const tab = this.exTab;
    const tabs = `<div class="tiers three">${([['hold', `HOLD ${game.exoticHold.length}/${EXOTIC.hold}`], ['listed', `LISTED ${game.listings.length}/${EXOTIC.slots}`], ['wanted', `WANTED ${game.wanted.length}`]] as const)
      .map(([k, label]) => `<button class="tab${tab === k ? ' on' : ''}" style="--c:#7a4a8a" data-act="exTab:${k}">${label}</button>`).join('')}</div>`;
    const fishRow = (e: Exotic, right: string, sub = `worth about $${kmb(e.value)}`) => {
      const f = LEGENDS.find((l) => l.id === e.fish)!;
      return `<div class="row"><div class="slot"><img class="fit" src="${fishIcon(f, false, 48, 28)}" alt=""></div><div class="meta"><b>${f.name} <span class="small">${e.kg.toLocaleString()} kg</span></b>
        <div class="sub"><small>${sub}</small></div></div>${right}</div>`;
    };
    const t = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    let body = '';
    if (tab === 'hold') {
      const full = game.listings.length >= EXOTIC.slots;
      body = game.exoticHold.map((e) => fishRow(e, `<button class="btn" data-act="exList:${e.id}" ${full ? 'disabled' : ''}>LIST</button>`)).join('')
        || '<p class="empty">No exotic fish yet. Voyages bring them back.</p>';
      // Dev mode only: a test fish, to try the market before voyages exist.
      if (game.dev) body += `<button class="btn wide red" data-act="exDev" ${game.exoticHold.length >= EXOTIC.hold ? 'disabled' : ''}>DEV: ADD TEST FISH</button>`;
    } else if (tab === 'listed') {
      body = game.listings.map((l) => {
        const best = l.offers[0];
        const right = best ? `<button class="btn" data-act="exOpen:${l.exotic.id}">${cash(best.amount)}</button>` : `<button class="btn plain" data-act="exOpen:${l.exotic.id}">WAITING</button>`;
        return fishRow(l.exotic, right, best ? `best: ${best.buyer} · ${t(best.left)} · ${l.offers.length} offer${l.offers.length > 1 ? 's' : ''}` : 'no offers yet');
      }).join('') || '<p class="empty">Nothing listed. List fish from the hold.</p>';
    } else {
      body = game.wanted.map((w) => {
        const f = LEGENDS.find((l) => l.id === w.fish)!;
        const match = [...game.exoticHold, ...game.listings.map((l) => l.exotic)].filter((e) => game.meetsWanted(w, e)).sort((a, b) => a.kg - b.kg)[0];
        return `<div class="row"><div class="slot"><img class="fit" src="${fishIcon(f, !match, 48, 28)}" alt=""></div><div class="meta"><b>${f.name} <span class="small">${w.minKg.toLocaleString()}+ kg</span></b>
          <div class="sub"><small>${w.buyer} · ${t(w.left)} left</small></div></div>
          <button class="btn" data-act="exGive:${w.id}" ${match ? '' : 'disabled'}>${cash(w.reward)}</button></div>`;
      }).join('') || '<p class="empty">No notices right now. Collectors post one every few minutes.</p>';
    }
    return tabs + body;
  }

  private listingTitle(game: Game): string {
    const l = game.listings.find((x) => x.exotic.id === this.exSel);
    return l ? LEGENDS.find((f) => f.id === l.exotic.fish)!.name : 'Listing';
  }

  /** One listed fish: every offer (sell to any), or take it off the market. */
  private listingHtml(game: Game): string {
    const l = game.listings.find((x) => x.exotic.id === this.exSel);
    if (!l) return '<p class="empty">Sold or taken off the market.</p>';
    const t = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const offers = l.offers.map((o, i) => `<div class="row"><div class="slot">${icon('crew')}</div><div class="meta"><b>${o.buyer}</b><div class="sub"><small>offer ends in ${t(o.left)}</small></div></div>
      <button class="btn" data-act="exSell:${l.exotic.id}:${i}">${cash(o.amount)}</button></div>`).join('') || '<p class="empty">Waiting for the first offer...</p>';
    return `<p class="note">${l.exotic.kg.toLocaleString()} kg · worth about $${kmb(l.exotic.value)} · next offer in ~${Math.ceil(l.next)} s. Offers creep up the longer it's listed.</p>${offers}
      <button class="btn wide plain" data-act="exUnlist:${l.exotic.id}" ${game.exoticHold.length >= EXOTIC.hold ? 'disabled' : ''}>TAKE IT OFF THE MARKET</button>`;
  }

  /** Retire: what this run turns into, what stays, what goes. */
  private retireHtml(game: Game): string {
    const gain = game.pearlsOnRetire();
    return `<div class="row"><div class="slot">${icon('coin')}</div><div class="meta"><b>This run</b><div class="sub"><small>Earned so far</small></div></div>${coin(game.earned, 3)}</div>
      <div class="row"><div class="slot">${icon('pearl')}</div><div class="meta"><b>+${gain} Pearls</b><div class="sub"><small>You have ${game.pearls}. Spend them in the Fish Tree</small></div></div></div>
      <p class="note">Keep: Pearls, Fish Tree, journal, achievements. Reset: money, gear, skills, bait, boats, pier, staff.</p>
      ${gain >= 1 ? `<button class="btn wide" data-act="doRetire">RETIRE ${icon('pearl', 2)} +${gain}</button>` : '<p class="note">Earn $1M in a run to retire.</p>'}
      <button class="btn wide plain" data-act="tree">FISH TREE</button>`;
  }

  private settingsHtml(game: Game): string {
    return `<div class="row"><div class="slot">${icon('coin')}</div><div class="meta"><b>This run</b></div>${coin(game.earned, 3)}</div>
      <div class="row"><div class="slot">${icon('pearl')}</div><div class="meta"><b>${game.pearls} Pearls</b><div class="sub"><small>${game.fishTree.length}/${TREE_FISH.length} tree fish · retired ${game.retirements}x</small></div></div>
        <button class="btn plain" data-act="tree">TREE</button><button class="btn" data-act="retire">RETIRE</button></div>
      <button class="btn wide ${game.dev ? 'red' : 'plain'}" data-act="toggleDev">DEV MODE ${game.dev ? 'ON' : 'OFF'} (x${DEV_MULTIPLIER} PRICES)</button>
      <button class="btn wide red" data-act="reset">START OVER</button>`;
  }

  private set(key: keyof UI['last'], el: HTMLElement, html: string): void {
    if (this.pressing || this.last[key] === html) return;
    this.last[key] = html;
    el.innerHTML = html;
  }
}
