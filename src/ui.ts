import { rodReach, HEAD_STARTS, type HeadStartId, TRAITS, HARBOR_STAFF,
  ACHIEVEMENTS, AUTO, BAITS, BERTHS, BOATS, BOAT_ORDER, COMPANY_PRICE, COMPANY_UNLOCK_EARNED, DEV_MULTIPLIER, GROUNDS, HARBOR_UPGRADES,
  MANAGER_BUDGETS, PIER_SECTIONS, PIER_SPOTS, PIER_STAFF, HANDS_MAX,
  TRACKS, TRACK_MAX, TRACK_ORDER, WAREHOUSE, type HarborUpgradeId, type TrackId, HAND_NAMES, HAND_SKILL_MAX, LETTERS, RODS, HAND_RODS, FISH, GEAR, PERFECT_PER_LEVEL, SKILLS, STRENGTH_PER_LEVEL, HAGGLE_PER_LEVEL,
  TIERS, VARIANTS, VARIANT_ORDER, type AchStat, type BaitId, type BoatType, type GearKind, type SkillId, type Tier, TREE_FISH, type TreeFish, PUB, CREW_ROLES, CREW_ROLE_ORDER, QUIRKS, DECOR, MATE, MATE_JOB_ORDER, type MateJob, FLAGSHIP_UPS, FLAGSHIP_UP_ORDER, FLAGSHIP_UP_MAX, type FlagshipUpId, LEGENDS, EXOTIC, REGIONS, VOYAGE, GEAR_BAG, GEAR_ITEMS, GEAR_SLOTS, GEAR_TIERS, STATS, STAT_ORDER, SETS, SET_SLOTS, KEEN_EYE, MASTERWORK, FORTUNE_SCALE, LUCK_SCALE, SKILL_TIER_BONUS, NETS, setPieceId, gearById, type SetId, type GearDef, type GearSlot, type GearTier, type StatId,
} from './data';
import { type Boat, type Exotic, type Game, type GearItem, type Sailor, fishById } from './game';
import * as V from './voyage';
import { Notices, lineHtml, timeAgo } from './notify';
import { fisherIcon, gearIcon, pixelFishIcon as fishIcon, pixelIcon, type HatStyle, type IconName } from './pixelart';
import type { Place } from './scene';

/** One panel per job: the market sells fish, the tackle shop sells gear, the school trains skills. */
export type Panel = 'pub' | 'flagship' | 'decor' | 'gearshop' | 'character' | 'gearitem' | 'stats' | 'market' | 'tackle' | 'baitshop' | 'pouch' | 'harbor' | 'ledger' | 'boat' | 'tree' | 'retire' | 'lighthouse' | 'exotic' | 'listing' | 'voyage' | 'shipyard' | 'harborup' | 'pier' | 'pierstaff' | 'hand' | 'training' | 'journal' | 'trophies' | 'inbox' | 'settings';

export type Action =
  | 'cast' | 'reel' | 'close' | 'back' | 'reset' | 'toggleDev' | Panel
  | `gsMode:${'buy' | 'sell'}` | `gpick:${string}` | 'keenEye' | `gbuy:${string}` | `gsel:${'bag' | 'eq'}:${string}`
  | `gequip:${number}` | `gunequip:${GearSlot}` | `gsell:${number}` | 'gsellall' | `charTab:${'gear' | 'bag'}` | `buyN:${'1' | '5' | 'max'}` | 'trainAll' | 'toggleBuzz' | `pubTab:${'board' | 'crew' | 'mate'}` | 'hireMate' | `mate:${MateJob}` | `mateBudget:${number}` | `sign:${number}` | 'pubRefresh' | `crewSail:${string}` | `lhWho:${'you' | 'crew'}` | `fight:${string}` | 'fightDone' | `lhRegion:${'coast' | 'ocean' | 'abyss'}`
  | 'buyFlagship' | 'flagship' | 'decor' | `buyDecor:${string}` | `flagshipUp:${FlagshipUpId}` | `sail:${string}` | `vsail:${number}` | `vchoose:${number}` | 'vlegend' | 'vfight' | 'vhome'
  | `exTab:${'hold' | 'listed' | 'wanted'}` | `exList:${number}` | `exUnlist:${number}` | `exOpen:${number}` | `exSell:${number}:${number}` | `exGive:${number}` | 'exDev' | 'boatPrev' | 'boatNext' | `coTab:${'harbor' | 'ledger' | 'harborup'}`
  | `achTab:${'base' | 'tree'}` | `treeTier:${number}` | `treeSel:${string}` | `unlock:${string}` | `retireTab:${'retire' | 'family'}` | `heir:${number}` | 'heirloom' | `perk:${HeadStartId}` | 'doRetire' | `journalTier:${number}`
  | `reforge:${number}` | `masterwork:${number}` | 'sellAll' | `sellFish:${string}` | `buy:${GearKind}` | `train:${SkillId}` | `skillTip:${SkillId}` | 'claimAll' | `trophy:${string}`
  | `bait:${BaitId}` | `buyBait:${BaitId}:${number}`
  | 'buyCompany' | `buyBoat:${BoatType}` | `boat:${number}` | `send:${number}` | `collect:${number}` | `crew:${number}` | `net:${number}`
  | 'sendAll' | 'collectAll' | `ground:${number}:${string}` | `track:${TrackId}` | `upgrade:${number}:${TrackId}`
  | `sellBoat:${number}` | 'buyBerth' | 'buyWarehouse' | `buyHarbor:${HarborUpgradeId}`
  | 'buyPierSection' | `budget:${number}` | `shipBudget:${number}` | `bestBuy:${number}` | `buyFitted:${BoatType}`
  | 'hire' | 'sellCrate' | `hand:${number}` | `handRod:${number}` | `handTrain:${number}` | `handBait:${number}:${BaitId}`;

/** The Tackle shop: rod holders and the Autofisher (rods and clothes are gear, at the Gear Shop). */
const GEAR_ORDER: GearKind[] = ['holders', 'auto', 'net', 'chum', 'icebox'];
export const GEAR_ICON: Record<GearKind, IconName> = { rod: 'rod', holders: 'holder', auto: 'auto', clothes: 'shirt', boots: 'boot', net: 'net', chum: 'bait', icebox: 'ice' };
const ROMAN: Record<Tier, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };
/** Where each slot of a tree side sits in its half of the sky (percent): root at the bottom, two branches, two tips. */
const POS = [{ x: 50, y: 84 }, { x: 24, y: 52 }, { x: 76, y: 52 }, { x: 24, y: 18 }, { x: 76, y: 18 }];

/** Seconds as m:ss. */
const clock = (s: number) => { const n = Math.max(0, Math.ceil(s)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };
/** What each School skill does (the "?" on its row). */
const SKILL_TIP: Record<SkillId, string> = {
  fishing: "Rarer fish bite more often. The number is how often your rod's best tier bites now and after the next level. On a rod that lands only Common fish, levels do nothing yet: get a better rod first.",
  reflexes: "When a fish bites, a gold ring shrinks on the bobber. Reel before it's gone for a PERFECT catch: double value. Each level makes the ring last longer, and your Autofisher hits PERFECT more often.",
  haggling: `Everything you sell pays ${Math.round(HAGGLE_PER_LEVEL * 100)}% more per level: your fish, the crate and boat hauls.`,
  strength: `A fish one tier too strong for your rod snaps the line. Each level holds ${Math.round(STRENGTH_PER_LEVEL * 100)}% more of them, and you pull harder in legend fights.`,
};
const SLOT_NAME: Record<GearSlot, string> = { rod: 'rod', hat: 'hat', shirt: 'shirt', pants: 'pants', boots: 'boots', charm: 'charm' };
/** An empty slot's outline: the slot's plain shape in grey. */
const SLOT_GHOST: Record<GearSlot, string> = { rod: 'stick', hat: 'straw', shirt: 'tee', pants: 'trousers', boots: 'boots', charm: 'coin' };
const ghostIcon = (slot: GearSlot) => gearIcon({ id: `ghost-${slot}`, slot, style: SLOT_GHOST[slot], colors: ['#9a8a6a', '#7a6a4a'] }, 2);
/** Where a set piece comes from, as cards say it. */
const SOURCE_NAME = { shop: 'Gear Shop', drop: 'Found fishing', voyage: 'Voyages only' } as const;
/** What the shopkeeper says about the piece you picked. */
const KEEPER_LINE: Record<SetId | 'rod', string> = {
  rod: 'Lands rarer fish!', fishmonger: 'Smells like profit.', jester: 'Feeling lucky?', monk: 'Calm hands, full nets.', pirate: 'Good for voyages, arr.', abyss: 'For the deep ones.',
};

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
/** In a panel header: exact up to a million, then short (the exact sum is in the corner). */
const headCash = (n: number) => (n < 1e6 ? coin(n, 3) : `<span class="cash"><img src="${pixelIcon('coin', 3)}" alt="">${kmb(n)}</span>`);
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
  return sign + (a >= 1e9 ? `${(a / 1e9).toFixed(a >= 1e10 ? 0 : 1)}B` : a >= 1e6 ? `${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M` : a >= 1e3 ? `${(a / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k` : String(Math.round(a)));
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
  /** Gear Shop: buying or selling, which slot and tier. Selected piece (in the bag, or worn in a slot) and the panel it was opened from. */
  gsMode: 'buy' | 'sell' = 'buy';
  /** The ware picked in the Gear Shop (a piece id). */
  gsPick = '';
  gsel: { where: 'bag' | 'eq'; key: string } = { where: 'eq', key: 'rod' };
  gearFrom: 'character' | 'gearshop' = 'character';
  /** Character screen: what you wear, or the bag. */
  charTab: 'gear' | 'bag' = 'gear';
  /** Lighthouse: which region's legends are shown. */
  lhRegion: 'coast' | 'ocean' | 'abyss' = 'coast';
  /** Lighthouse: who sails, you or your crew. Pub: the board or your crew. */
  lhWho: 'you' | 'crew' = 'you';
  pubTab: 'board' | 'crew' | 'mate' = 'board';
  /** Buy this many levels at once (0 = as many as you can afford). */
  buyN: 0 | 1 | 5 = 1;
  /** Buzz the phone when a fish bites your line (a setting kept on this device). */
  buzz = false;
  readonly canBuzz = typeof navigator !== 'undefined' && 'vibrate' in navigator;
  /** Exotic Market: which tab, and which listing is open. */
  exTab: 'hold' | 'listed' | 'wanted' = 'hold';
  exSel = 0;
  /** The Fishing Co. tab last shown (a boat or the shipyard goes back to it). */
  coTab: 'harbor' | 'ledger' | 'harborup' = 'harbor';

  /** Where ◄ goes from a panel (null: it has no parent, only X). */
  parentOf(panel: Panel | null): Panel | null {
    if (panel === 'boat' || panel === 'shipyard') return this.coTab;
    if (panel === 'gearitem') return this.gearFrom;
    if (panel === 'stats') return 'character';
    return ({ hand: 'pier', pierstaff: 'pier', tree: 'settings', retire: 'settings', listing: 'exotic', voyage: 'lighthouse', flagship: 'lighthouse', decor: 'settings' } as Partial<Record<Panel, Panel>>)[panel ?? 'market'] ?? null;
  }
  /** Trophy page: the originals, or the Fish Tree's. */
  achTab: 'base' | 'tree' = 'base';
  /** Boat / fisherman shown in their detail panels. */
  boatSel = 0;
  handSel = 0;
  /** Upgrade track shown in the boat panel's detail strip. */
  trackSel: TrackId = 'hull';
  /** Fish Tree page: which tier is showing, which fish is selected. Journal: which tier. */
  /** The Fish Tree tab: a tier of fish, or 0 for the head starts. */
  treeTier: Tier | 0 = 1;
  /** The Retire screen: its tab, the heir picked, the heirloom picked (a gear item id; null = your rod). */
  retireTab: 'retire' | 'family' = 'retire';
  heirSel = 0;
  heirloom: number | null = null;
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
    // Nothing to show on a brand-new game.
    if (!r || (!game.earned && !r.you)) return '';
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
      `<button class="slot" data-act="character" aria-label="character">${icon('shirt')}</button>` +
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
    // Still on the starter rod with enough for the next one: point the way (sell first, then the Gear Shop).
    const next = game.gearOf('rod')!.id === 'twigrod' ? gearById('willowswitch')! : null;
    const nudge = !next ? '' : game.money >= next.price ? `<div class="plaque hint nudge">New rod at the Gear Shop: ${next.name}</div>`
      : game.money + game.bagValue() >= next.price ? '<div class="plaque hint nudge">Sell your fish at the Market for a new rod</div>' : '';
    const row = (btn: string) => `${nudge}${bag}<div class="dockrow">${pouch}${btn}</div>`;
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
            : panel === 'flagship' ? ['Flagship', this.flagshipHtml(game)]
            : panel === 'decor' ? ['Town Decor', this.decorHtml(game)]
            : panel === 'voyage' ? [game.voyage ? V.legendOf(game.voyage).spot : 'Voyage', this.voyageHtml(game)]
            : panel === 'exotic' ? ['Exotic Market', this.exoticHtml(game)]
            : panel === 'listing' ? [this.listingTitle(game), this.listingHtml(game)]
            : panel === 'retire' ? [this.retireTab === 'family' ? 'Family' : 'Retire', this.retireHtml(game)]
              : panel === 'trophies' ? [`Trophies ${game.claimed.length}/${ACHIEVEMENTS.length}`, this.trophiesHtml(game)]
                : panel === 'inbox' ? ['Log', this.inboxHtml()]
                : panel === 'pub' ? ['The Pub', this.pubHtml(game)]
                : panel === 'gearshop' ? ['Gear Shop', this.gearShopHtml(game)]
                : panel === 'character' ? [game.generation > 1 ? `${game.heir.name} · Gen ${game.generation}` : 'Character', this.characterHtml(game)]
                : panel === 'gearitem' ? [this.gearItemTitle(game), this.gearItemHtml(game)]
                : panel === 'stats' ? ['Your Stats', this.statsHtml(game)]
                  : ['Settings', this.settingsHtml(game)];
    // ◄ back to the parent (if any), X always closes. A boat flips to the previous/next boat instead of showing the money (it's in the corner anyway).
    const tabbed = game.company && (panel === 'harbor' || panel === 'ledger' || panel === 'harborup');
    if (tabbed) this.coTab = panel;
    const back = this.parentOf(panel) ? `<button class="bbtn" data-act="back" aria-label="back">${icon('back', 2)}</button>` : '';
    const n = game.boats.length;
    const right = panel === 'boat' && n > 1
      ? `<span class="flip"><button class="bbtn" data-act="boatPrev" aria-label="previous boat">${icon('prev', 2)}</button><small>${this.boatSel + 1}/${n}</small><button class="bbtn" data-act="boatNext" aria-label="next boat">${icon('next', 2)}</button></span>`
      : panel === 'boat' || panel === 'voyage' ? '' : panel === 'tree' ? `<span class="cash">${icon('pearl', 3)}${game.pearls}</span>` : headCash(game.money);
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
      ${cost === null ? '<span class="maxed">MAX</span>' : this.trainBtn(`upgrade:${i}:${id}`, game.trackCostN(i, id, this.buyN || Infinity), game.money, cost)}</div>`;
    const crewCost = game.nextCrewCost(i);
    const crewGain = crewCost === null ? 0 : game.boatRate(b, { crew: true }) - rate;
    const crew = `<div class="row"><div class="slot">${icon('crew')}</div><div class="meta"><b>Crew ${b.crew}/${game.crewMax(b)}</b><div class="sub"><small>${crewCost === null ? `${game.haulSize(b)} a trip · Hull adds slots` : `<span class="up">+$${kmb(crewGain)}/min</span> · back in ${mins(crewCost / crewGain)}`}</small></div></div>
      ${crewCost === null ? '<span class="maxed">FULL</span>' : `<button class="btn" data-act="crew:${i}" ${game.money < crewCost ? 'disabled' : ''}>${coin(crewCost)}</button>`}</div>`;
    const sell = `<div class="row"><div class="meta"><b>Sell boat</b><div class="sub"><small>${b.trip ? 'At sea: this trip is lost' : 'Frees the berth'}</small></div></div>
      <button class="btn red" data-act="sellBoat:${i}">${coin(game.boatResale(i))}</button></div>`;
    // The best buy: whatever pays for itself fastest (moving to a better ground if it opens one).
    const best = game.bestBuy(i);
    const bestRow = best ? `<div class="row"><div class="slot">${icon('anchor')}</div><div class="meta"><b>${best.name}</b><div class="sub"><small>Best buy · ${best.captain ? 'sails by itself' : best.gain > 1 ? `<span class="up">+$${kmb(best.gain)}/min</span>` : 'last levels'}</small></div></div>
      <button class="btn" data-act="bestBuy:${i}" ${game.money < best.cost ? 'disabled' : ''}>${coin(best.cost)}</button></div>` : '';
    return status + haul + `<div class="grounds">${grounds}</div><div class="grid tracks">${tiles}</div>` + detail + (cost === null ? '' : this.buyNTabs()) + bestRow + crew + sell;
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
      const def = BOATS[type], price = game.boatPrice(type), ic = icon(type === 'lobster' ? 'trap' : type === 'sword' ? 'hook' : 'boat');
      // Fitted out like your best boat of this kind, in one go.
      const model = game.fittedModel(type), fitted = game.fittedPrice(type);
      const like = model ? `<div class="row"><div class="slot">${ic}</div><div class="meta"><b>Fitted copy</b>
        <div class="sub"><small>Of ${game.boatName(game.boats.indexOf(model))}, sails now</small></div></div>
        <button class="btn" data-act="buyFitted:${type}" ${full || game.money < fitted! ? 'disabled' : ''}>${cash(fitted!)}</button></div>` : '';
      return `<div class="row"><div class="slot">${ic}</div><div class="meta"><b>${def.name}</b>
        <div class="sub"><small>${def.blurb}</small></div></div><button class="btn" data-act="buyBoat:${type}" ${full || game.money < price ? 'disabled' : ''}>${coin(price)}</button></div>` + like;
    }).join('') + `<p class="note">${full ? 'All berths are taken: build more at the Harbor.' : 'Each extra boat of a kind costs 50% more.'}</p>`;
  }

  /** The harbor itself: berths, staff who automate the work, the warehouse. */
  private harborUpHtml(game: Game): string {
    const row = (ic: IconName, name: string, sub: string, right: string) =>
      `<div class="row"><div class="slot">${icon(ic)}</div><div class="meta"><b>${name}</b><div class="sub"><small>${sub}</small></div></div>${right}</div>`;
    const buy = (act: string, price: number) => `<button class="btn" data-act="${act}" ${game.money < price ? 'disabled' : ''}>${coin(price)}</button>`;
    const berth = game.nextBerth(), wh = game.nextWarehouse();
    const staff = HARBOR_STAFF.map((k) => {
      const u = HARBOR_UPGRADES[k];
      return row(k === 'shipwright' ? 'anchor' : 'captain', u.name, u.fee ? `${u.blurb} · ${pct(u.fee)} ${u.feeName}` : u.blurb, game.harbor[k] ? '<span class="maxed">HIRED</span>' : buy(`buyHarbor:${k}`, u.price));
    }).join('') + (game.harbor.shipwright
      ? `<div class="row"><div class="meta"><b>Shipwright budget</b><div class="sub"><small>Spends up to this share of your money per upgrade</small></div></div></div>
        <div class="budgets">${MANAGER_BUDGETS.map((v, i) => `<button class="ground ${game.shipBudget === i ? 'sel' : ''}" data-act="shipBudget:${i}">${v ? pct(v) : 'Off'}</button>`).join('')}</div>`
      : '');
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
    // Train everyone at once.
    const n = this.buyN || Infinity, all = game.hands.reduce((s, _, i) => { const c = game.trainCostN(i, n); return { levels: s.levels + c.levels, cost: s.cost + c.cost }; }, { levels: 0, cost: 0 });
    const cheapest = Math.min(...game.hands.map((_, i) => game.handTrainCost(i) ?? Infinity));
    const trainAll = game.hands.length ? `<div class="row"><div class="slot">${icon('hook')}</div><div class="meta"><b>Train all</b><div class="sub"><small>${all.levels ? `${all.levels} level${all.levels === 1 ? '' : 's'}, lowest first` : cheapest === Infinity ? 'Everyone is maxed' : 'Not enough money'}</small></div></div>
      ${cheapest === Infinity ? '<span class="maxed">MAX</span>' : this.trainBtn('trainAll', all, game.money, cheapest)}</div>` + (cheapest === Infinity ? '' : this.buyNTabs()) : '';
    return crate + `<div class="grid hands">${tiles}</div>` + trainAll
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
    const tier = HAND_RODS[h.rod]!.tier as Tier;
    const top = odds.filter((o) => !o.tooStrong && o.fish.tier === tier).reduce((s, o) => s + o.p, 0);
    const row = (ic: IconName, name: string, sub: string, right: string) =>
      `<div class="row"><div class="slot">${icon(ic)}</div><div class="meta"><b>${name}</b><div class="sub">${sub}</div></div>${right}</div>`;
    const baits = BAITS.map((b) => `<div class="cell"><button class="slot ${game.baitCount(b.id) ? '' : 'dim'} ${b.id === h.bait ? 'sel' : ''}" data-act="handBait:${i}:${b.id}" title="${b.name}">
      ${icon(BAIT_ICON[b.id])}<i class="n">x${game.baitCount(b.id)}</i></button></div>`).join('');
    return row('rod', HAND_RODS[h.rod]!.name, `${level(h.rod + 1, HAND_RODS.length)}<small>${TIERS[tier].name} ${pct(top)}</small>`,
        rod ? `<button class="btn" data-act="handRod:${i}" ${game.money < rod.price ? 'disabled' : ''}>${coin(rod.price)}</button>` : '<span class="maxed">MAX</span>')
      + row('hook', `Fishing LV ${h.skill}`, `${level(h.skill, HAND_SKILL_MAX)}<small>Quicker hands</small>`,
        train === null ? '<span class="maxed">MAX</span>' : this.trainBtn(`handTrain:${i}`, game.trainCostN(i, this.buyN || Infinity), game.money, train))
      + (train === null ? '' : this.buyNTabs())
      + `<div class="grid three">${baits}</div><p class="note">${game.harbor.manager ? 'Your manager picks the best bait for them.' : 'Tap a bait: they take it from your pouch, one per cast.'}</p>`;
  }

  /** x1 / x5 / MAX: how many levels a train button buys. */
  private buyNTabs(): string {
    return `<div class="tiers three buyn">${([[1, 'x1'], [5, 'x5'], [0, 'MAX']] as const).map(([k, label]) => `<button class="tab${this.buyN === k ? ' on' : ''}" style="--c:#2a7a3a" data-act="buyN:${k || 'max'}">${label}</button>`).join('')}</div>`;
  }

  /** A train button for `levels` at `cost` (MAX shows what you can afford now, or the next level's price greyed out). */
  private trainBtn(act: string, c: { levels: number; cost: number }, money: number, next: number): string {
    if (!c.levels) return `<button class="btn" data-act="${act}" disabled>${coin(next)}</button>`;
    return `<button class="btn" data-act="${act}" ${money < c.cost ? 'disabled' : ''}>${c.levels > 1 ? `<small>x${c.levels}</small> ` : ''}${coin(c.cost)}</button>`;
  }

  /** The School skill whose "?" is open (what it does, under its row). */
  skillTip: SkillId | null = null;

  /** Raises the fisher's skills, nothing else. Tap a row (not its button) for what the skill does. */
  private schoolHtml(game: Game): string {
    return (['fishing', 'reflexes', 'haggling', 'strength'] as SkillId[]).map((id) => {
      const def = SKILLS[id], lvl = game.level(id), cost = game.nextSkillCost(id), open = this.skillTip === id;
      const btn = cost === null ? '<span class="maxed">MAX</span>'
        : `<button class="btn" data-act="train:${id}" ${game.money < cost ? 'disabled' : ''}>${coin(cost)}</button>`;
      return `<div class="row tappable${open ? ' open' : ''}" data-act="skillTip:${id}"><div class="slot">${icon(SKILL_ICON[id])}<i class="q">?</i></div><div class="meta">
        <b>${def.name} <span class="small">LV ${lvl}</span></b>
        <div class="sub"><small>${this.skillEffect(game, id, lvl, cost !== null)}</small></div></div>${btn}</div>`
        + (open ? `<div class="tip">${SKILL_TIP[id]}</div>` : '');
    }).join('');
  }

  /** "now > next" for a skill, in a few words. */
  private skillEffect(game: Game, id: SkillId, lvl: number, canTrain: boolean): string {
    const step = (a: string, b: string) => `${a}${canTrain ? ` <span class="up">&gt; ${b}</span>` : ''}`;
    if (id === 'reflexes') return step(`PERFECT ${game.perfectZone().toFixed(2)}s`, `${(game.perfectZone() + PERFECT_PER_LEVEL * (1 + game.gearStat('reflex') / 100)).toFixed(2)}s`);
    if (id === 'haggling') return step(`Prices +${pct(lvl * HAGGLE_PER_LEVEL)}`, `+${pct((lvl + 1) * HAGGLE_PER_LEVEL)}`);
    if (id === 'strength') return step(`Hold ${pct(game.strengthChance())}`, pct(game.strengthChance() + STRENGTH_PER_LEVEL));
    const best = game.rodTier as Tier;
    const odds = (o: Record<number, number>) => pct(o[best] ?? 0);
    // A level that changes nothing on this rod (a starter rod lands only Common): say what would help instead.
    if (canTrain && odds(game.tierOdds()) === odds(game.tierOdds(lvl + 1))) return `${TIERS[best].name} ${odds(game.tierOdds())} <span class="up">needs a better rod</span>`;
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
    const pearls = `<div class="row tight"><div class="slot">${icon('pearl')}</div><div class="meta"><b>${game.pearls} Pearls</b><div class="sub"><small>${t === 0 ? 'Head starts for every new run' : 'Spend them on new fish'}</small></div></div></div>`;
    const tabs = `<div class="tiers six"><button class="tab${t === 0 ? ' on' : ''}" style="--c:#7a5a3a" data-act="treeTier:0" aria-label="head starts">${icon('star', 2)}</button>${([1, 2, 3, 4, 5] as Tier[]).map((k) => `<button class="tab${k === t ? ' on' : ''}${game.treeTierOpen(k) ? '' : ' shut'}" style="--c:${TIERS[k].color}" data-act="treeTier:${k}">${game.treeTierOpen(k) ? ROMAN[k] : icon('lock', 2)}</button>`).join('')}</div>`;
    if (t === 0) {
      // Head starts: bought once, then every run begins with them.
      const ic: Record<HeadStartId, IconName> = { lines: 'holder', auto: 'auto', rod: 'rod', cash: 'coin' };
      return pearls + tabs + HEAD_STARTS.map((p) => `<div class="row"><div class="slot">${icon(ic[p.id])}</div><div class="meta"><b>${p.name}</b><div class="sub"><small>${game.perks.includes(p.id) ? 'Every run' : 'Every new run'}</small></div></div>
        ${game.perks.includes(p.id) ? '<span class="maxed">OWNED</span>' : `<button class="btn" data-act="perk:${p.id}" ${game.pearls < p.cost ? 'disabled' : ''}>${icon('pearl', 2)} ${p.cost}</button>`}</div>`).join('')
        + (() => { const c = game.keenEyeCost(), x = (k: number) => `x${1 + KEEN_EYE.per * k}`; return `<div class="row"><div class="slot">${icon('star')}</div><div class="meta"><b>Keen Eye ${game.keenEye}/${KEEN_EYE.cost.length}</b><div class="sub"><small>Gear drops ${x(game.keenEye)}${c === null ? '' : `, next ${x(game.keenEye + 1)}`}</small></div></div>
        ${c === null ? '<span class="maxed">MAX</span>' : `<button class="btn" data-act="keenEye" ${game.pearls < c ? 'disabled' : ''}>${icon('pearl', 2)} ${c}</button>`}</div>`; })();
    }
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
        <img src="${fishIcon(f, !own, 64, 38)}" alt=""><i>${own ? '' : f.cost}</i></button>`;
    }).join('');
    const sky = `<div class="sky"><span class="side l">RIVER</span><span class="side r">SEA</span><svg viewBox="0 0 100 100" preserveAspectRatio="none">${lines}<line x1="50" y1="4" x2="50" y2="96" class="split"/></svg>${nodes}</div>`;
    const sel = fish.find((f) => f.id === this.treeSel);
    const detail = !game.treeTierOpen(t)
      ? `<p class="note">Unlock any ${TIERS[(t - 1) as Tier].name} fish to open this tier.</p>`
      : !sel ? '<p class="note">Tap a fish. River fish bite for you and your fishermen; sea fish come back on boats.</p>'
      : `<div class="row"><div class="meta"><b>${sel.name} <span class="small">$${kmb(sel.price)} each</span></b><div class="sub"><small class="wrap">${
          sel.side === 'river' ? 'River: you and your fishermen' : `${BOATS[sel.boat!].name}: ${GROUNDS.find((g) => g.id === sel.ground)!.name} and deeper`}</small></div></div>
        ${game.fishTree.includes(sel.id) ? '<span class="maxed">OWNED</span>' : `<button class="btn" data-act="unlock:${sel.id}" ${game.canUnlock(sel.id) ? '' : 'disabled'}>${icon('pearl', 2)} ${sel.cost}</button>`}</div>`;
    return tabs + sky + detail;
  }

  /** The Lighthouse: where expeditions will sail from. For now, practice fights against the legends. */
  private lighthouseHtml(game: Game): string {
    if (!game.company) return `<div class="row"><div class="slot">${icon('lock')}</div><div class="meta"><b>Boarded up</b><div class="sub"><small>Own the Fishing Co. first</small></div></div></div>`;
    const r = this.lhRegion, rest = Math.ceil(game.flagshipRest);
    const upgrade = `<button class="btn plain" data-act="flagship">UPGRADE</button>`;
    // The Flagship: buy it, at sea (resume), resting, or ready.
    const ship = !game.flagship
      ? `<div class="row"><div class="slot">${icon('boat')}</div><div class="meta"><b>The Flagship</b><div class="sub"><small>Sail to the legends</small></div></div>
        <button class="btn" data-act="buyFlagship" ${game.money < VOYAGE.flagship ? 'disabled' : ''}>${cash(VOYAGE.flagship)}</button></div>`
      : game.crewTrip ? `<div class="row tight"><div class="slot">${icon('crew')}</div><div class="meta"><b>Crew at sea</b><div class="sub"><small>${LEGENDS.find((l) => l.id === game.crewTrip!.legend)!.spot} · ${clock(game.crewTrip.dur - game.crewTrip.t)} left</small></div></div>${upgrade}</div>`
      : game.voyage ? `<div class="row"><div class="slot">${icon('boat')}</div><div class="meta"><b>At sea</b><div class="sub"><small>${V.legendOf(game.voyage).spot}</small></div></div><button class="btn" data-act="voyage">RESUME</button></div>`
      : `<div class="row tight"><div class="slot">${icon('boat')}</div><div class="meta"><b>The Flagship</b><div class="sub"><small>${game.canSail() ? 'Ready to sail' : `Resting ${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, '0')}`}</small></div></div>${upgrade}</div>`;
    const tabs = `<div class="tiers three">${(['coast', 'ocean', 'abyss'] as const).map((k) => `<button class="tab${r === k ? ' on' : ''}" style="--c:${k === 'coast' ? '#2eb082' : k === 'ocean' ? '#2f6fd6' : '#4a3a7a'}" data-act="lhRegion:${k}">${game.regionOpen(k) ? '' : icon('lock', 2)}${REGIONS[k].name.toUpperCase()}</button>`).join('')}</div>`;
    // With a Captain signed at the Pub, choose who sails.
    const crewing = game.canSendCrew(), who = crewing ? this.lhWho : 'you';
    const whoTabs = crewing ? `<div class="tiers two">${(['you', 'crew'] as const).map((k) => `<button class="tab${who === k ? ' on' : ''}" style="--c:#7a5a3a" data-act="lhWho:${k}">${k === 'you' ? 'YOU SAIL' : 'SEND CREW'}</button>`).join('')}</div>` : '';
    const odds = game.crewOdds();
    const note = who === 'crew' ? `${clock(game.crewTripTime(LEGENDS.find((l) => l.region === r)!))} trip · ${Math.round(odds.legend * 100)}% legend · crew cut ${Math.round(odds.cut * 100)}%` : `${REGIONS[r].twist}.`;
    const rows = LEGENDS.filter((l) => l.region === r).map((l) => {
      const open = game.legendOpen(l), n = game.landed[l.id] ?? 0;
      const btn = !open ? `<span class="maxed">${icon('lock', 2)}</span>`
        : who === 'crew' ? `<button class="btn" data-act="crewSail:${l.id}">SEND</button>`
        : game.canSail() ? `<button class="btn" data-act="sail:${l.id}">SAIL</button>` : `<button class="btn plain" data-act="fight:${l.id}">TRY</button>`;
      return `<div class="row"><div class="slot"><img class="fit" src="${fishIcon(l, !open, 48, 28)}" alt=""></div><div class="meta"><b>${open ? l.name : '???'} <span class="small">$${kmb(l.price)}${n ? ` · x${n}` : ''}</span></b>
        <div class="sub"><small>${open ? `${l.spot} · ${l.blurb}` : l.id === 'theoldone' ? 'Land the rest of the Abyss' : 'Land a legend of the region before'}</small></div></div>${btn}</div>`;
    }).join('');
    return ship + whoTabs + tabs + `<p class="note">${note}</p>` + rows;
  }

  // ---------- the Pub ----------

  /** Sailors for hire (RECRUITS) and your eight seats (CREW). */
  private pubHtml(game: Game): string {
    if (!game.flagship) return `<div class="row"><div class="slot">${icon('lock')}</div><div class="meta"><b>Closed</b><div class="sub"><small>Buy the Flagship at the lighthouse</small></div></div></div>`;
    const seated = CREW_ROLE_ORDER.filter((r) => game.crew[r]).length;
    const tab = (k: 'board' | 'crew' | 'mate', label: string) => `<button class="tab${this.pubTab === k ? ' on' : ''}" style="--c:#7a3a2a" data-act="pubTab:${k}">${label}</button>`;
    const tabs = `<div class="tiers three">${tab('board', 'RECRUITS')}${tab('crew', `CREW ${seated}/${CREW_ROLE_ORDER.length}`)}${tab('mate', 'FIRST MATE')}</div>`;
    if (this.pubTab === 'mate') return tabs + this.mateHtml(game);
    const stars = (n: number) => `<span class="stars">${Array.from({ length: 5 }, (_, k) => `<img src="${pixelIcon('star', 2)}" class="${k < n ? '' : 'off'}" alt="">`).join('')}</span>`;
    const quirk = (s: Sailor) => (s.quirk ? `<span class="quirk${QUIRKS[s.quirk].fee < 1 ? ' bad' : ''}">${QUIRKS[s.quirk].name.toUpperCase()}</span>` : '');
    if (this.pubTab === 'crew') {
      const seats = CREW_ROLE_ORDER.map((r) => {
        const s = game.crew[r];
        return s ? `<div class="seat"><b>${CREW_ROLES[r].name.toUpperCase()}</b><span>${s.name}</span><div class="sl">${stars(s.stars)}${quirk(s)}</div><small>${CREW_ROLES[r].does(game.sailorStars(s))}${s.quirk ? `<br>${QUIRKS[s.quirk].does}` : ''}</small></div>`
          : `<div class="seat open"><b>${CREW_ROLES[r].name.toUpperCase()}</b><span>Empty seat</span><small>Per star: ${CREW_ROLES[r].does(1)}</small></div>`;
      }).join('');
      const o = game.crewOdds();
      const sum = game.crew.captain ? `Haul ${Math.round(o.haul * 100)}% of yours · cut ${Math.round(o.cut * 100)}% · legend ${Math.round(o.legend * 100)}% · rough ${Math.round(o.rough * 100)}%` : 'Sign a Captain to send the crew out.';
      return tabs + `<div class="seats">${seats}</div><p class="note">${sum}</p>`;
    }
    const rows = game.pubBoard.map((s) => {
      const mine = game.crew[s.role];
      return `<div class="row"><div class="meta"><b>${s.name} <span class="small">${CREW_ROLES[s.role].name.toUpperCase()}</span></b><div class="sub">${stars(s.stars)}${quirk(s)}${mine ? `<small class="fx">yours: ${mine.stars}</small>` : ''}</div><small class="fx">${CREW_ROLES[s.role].does(game.sailorStars(s))}${s.quirk ? ` · ${QUIRKS[s.quirk].does}` : ''}</small></div>
        <button class="btn" data-act="sign:${s.id}" ${game.money < game.signFee(s) ? 'disabled' : ''}>${cash(game.signFee(s))}</button></div>`;
    }).join('') || '<p class="empty">Everyone here signed on. New faces soon.</p>';
    const left = Math.max(0, Math.ceil(PUB.refresh - game.pubClock));
    return tabs + rows + `<div class="row tight"><div class="meta"><div class="sub"><small>New faces ${clock(left)}</small></div></div>
      <button class="btn plain" data-act="pubRefresh" ${game.money < PUB.refreshPrice ? 'disabled' : ''}>${cash(PUB.refreshPrice)}</button></div>`;
  }

  /** Town decor: looks only, bought once each. */
  private decorHtml(game: Game): string {
    const ic: Record<string, IconName> = { flowers: 'bait', lanterns: 'bell', bunting: 'star', golddock: 'anchor', goldlight: 'coin', goldship: 'boat' };
    return DECOR.map((d) => `<div class="row"><div class="slot">${icon(ic[d.id] ?? 'star')}</div><div class="meta"><b>${d.name}</b><div class="sub"><small>${d.blurb}</small></div></div>
      ${game.decor.includes(d.id) ? '<span class="maxed">OWNED</span>' : `<button class="btn" data-act="buyDecor:${d.id}" ${game.money < d.price ? 'disabled' : ''}>${cash(d.price)}</button>`}</div>`).join('')
      + '<p class="note">Looks only. Kept when you retire.</p>';
  }

  /** The First Mate: hire, then a switch per job and how much they may spend. */
  private mateHtml(game: Game): string {
    const jobIcon: Record<MateJob, IconName> = { sail: 'boat', sell: 'coin', sign: 'crew', upgrade: 'anchor' };
    if (!game.mate) {
      return `<div class="row"><div class="slot">${icon('captain')}</div><div class="meta"><b>First Mate</b><div class="sub"><small>Runs voyages</small></div></div>
        <button class="btn" data-act="hireMate" ${game.money < MATE.price ? 'disabled' : ''}>${cash(MATE.price)}</button></div>`
        + MATE_JOB_ORDER.map((j) => `<div class="row tight"><div class="slot">${icon(jobIcon[j])}</div><div class="meta"><b>${MATE.jobs[j].name}</b><div class="sub"><small>${MATE.jobs[j].blurb}</small></div></div></div>`).join('');
    }
    const jobs = MATE_JOB_ORDER.map((j) => {
      const on = !!game.mateOn[j];
      return `<div class="row tight"><div class="slot">${icon(jobIcon[j])}</div><div class="meta"><b>${MATE.jobs[j].name}</b><div class="sub"><small>${MATE.jobs[j].blurb}</small></div></div>
        <button class="btn ${on ? '' : 'plain'}" data-act="mate:${j}">${on ? 'ON' : 'OFF'}</button></div>`;
    }).join('');
    const legend = game.crewLegend ? LEGENDS.find((l) => l.id === game.crewLegend) : null;
    const status = !game.mateOn.sail ? 'Re-sail is off: the Flagship is yours.'
      : legend ? `Re-sailing for ${legend.spot}. Turn it off to sail yourself.` : 'Send the crew once; the mate keeps them going.';
    return jobs + `<div class="row tight"><div class="meta"><b>Budget</b><div class="sub"><small>Max share of money per buy</small></div></div></div>
      <div class="budgets">${MATE.budgets.map((v, i) => `<button class="ground ${game.mateBudget === i ? 'sel' : ''}" data-act="mateBudget:${i}">${pct(v)}</button>`).join('')}</div>
      <p class="note">${status}</p>`;
  }

  /** The Flagship's upgrades: one row each, what the next level does, its price. */
  private flagshipHtml(game: Game): string {
    const ic: Record<FlagshipUpId, IconName> = { hold: 'trap', hull: 'anchor', stores: 'bag', sails: 'boat', harpoon: 'hook' };
    const rows = FLAGSHIP_UP_ORDER.map((id) => {
      const u = FLAGSHIP_UPS[id], n = game.flagshipUp(id), cost = game.flagshipUpCost(id);
      const pips = `<span class="pips">${Array.from({ length: FLAGSHIP_UP_MAX }, (_, k) => `<i class="${k < n ? 'on' : ''}"></i>`).join('')}</span>`;
      const btn = cost === null ? '<span class="maxed">MAX</span>' : `<button class="btn" data-act="flagshipUp:${id}" ${game.money < cost ? 'disabled' : ''}>${cash(cost)}</button>`;
      return `<div class="row"><div class="slot">${icon(ic[id])}</div><div class="meta"><b>${u.name}</b><div class="sub">${pips}</div><small class="fx wrap">${cost === null ? u.does(n) : `Next: ${u.does(n + 1)}`}</small></div>${btn}</div>`;
    }).join('');
    return rows;
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
    const stat = `<div class="vstat"><span>${icon('bag', 2)}${v.supplies} ${v.supplies === 1 ? 'supply' : 'supplies'}</span><span>${icon('anchor', 2)}${'#'.repeat(v.hull).replace(/#/g, '<i class="hp"></i>')}${'<i class="hp lost"></i>'.repeat(Math.max(0, V.maxHull(v) - v.hull))}</span><span>${icon('coin', 2)}$${kmb(v.haul)}</span></div>`;
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
      return `<button class="vspot${here ? ' here' : ''}${past ? ' past' : ''}${reach ? ' reach' : ''}" style="left:${xOf(r, i)}%;top:${yOf(r)}%" ${reach ? `data-act="vsail:${i}"` : 'disabled'}>${icon(here ? 'boat' : KIND[s.kind], 3)}</button>`;
    }).join('')).join('');
    const toLegend = v.stage === 'map' && v.row === v.rows.length - 1;
    const legend = `<button class="vspot legend${toLegend ? ' reach' : ''}${v.stage === 'fight' || v.stage === 'over' ? ' here' : ''}" style="left:50%;top:${yOf(v.rows.length)}%" ${toLegend ? 'data-act="vlegend"' : 'disabled'}><img class="fit" src="${fishIcon(l, false, 80, 46)}" alt=""></button>`;
    const home = `<span class="vspot home${v.row < 0 ? ' here' : ''}" style="left:50%;top:${yOf(-1)}%">${icon(v.row < 0 ? 'boat' : 'anchor', 3)}</span>`;
    const map = `<div class="vmap"><svg viewBox="0 0 100 100" preserveAspectRatio="none">${lines.join('')}</svg>${home}${spots}${legend}</div>`;
    let card = `<p class="vnote">${v.note}</p>`;
    if (v.stage === 'map') card += `<p class="note">${toLegend ? `Sail on to ${l.spot} to fight the ${l.name}.` : 'Choose where to sail next. Each move costs a supply.'}</p>`;
    else if (v.stage === 'spot') card += `<div class="vchoices">${V.choices(v).map((c, k) => `<button class="btn${c.label.startsWith('SAIL') ? ' plain' : ''}" data-act="vchoose:${k}">${c.label}${c.cost ? `<small>${c.cost}</small>` : ''}</button>`).join('')}</div>`;
    else if (v.stage === 'fight') card += `<button class="btn wide" data-act="vfight">FIGHT THE ${l.name.toUpperCase()}</button>`;
    else card += `<p class="note">${v.result === 'failed' ? 'The haul is lost.' : `Haul: $${kmb(v.haul)}${v.result === 'caught' ? ` · ${l.name} ${(v.kg ?? 0).toLocaleString()} kg · +${V.pearlsFor(l)} Pearls` : ''}`}</p><button class="btn wide" data-act="vhome">HOME</button>`;
    return stat + map + card;
  }

  // ---------- gear ----------

  /** A piece's tile: its icon in its tier's frame (a "+" for a piece found fishing). */
  private gearTile(def: GearDef, item: GearItem | null, act: string, sel = false): string {
    return `<button class="gtile t-${def.tier}${sel ? ' sel' : ''}" style="--t:${GEAR_TIERS[def.tier].color}" data-act="${act}" title="${def.name}">
      <img src="${gearIcon(def)}" alt="${def.name}">${def.set ? `<span class="pip" style="--sc:${SETS[def.set].color}"></span>` : ''}${item?.drop ? `<i class="plus${item.fine ? ' fine' : ''}">+</i>` : ''}</button>`;
  }

  /** Stats as short chips; with `vs`, each is green or red against those numbers (what you wear in that slot). */
  /** A rod's reach into the next tier, as "1 in 3 Epic" (empty when none). */
  private reachLabel(def: GearDef): string {
    const r = rodReach(def);
    return r ? `${Math.round(r * 3)} in 3 ${TIERS[(GEAR_TIERS[def.tier].fishTier + 1) as Tier].name}` : '';
  }

  private statChips(stats: Partial<Record<StatId, number>>, vs?: Partial<Record<StatId, number>>): string {
    return STAT_ORDER.filter((s) => stats[s]).map((s) => {
      const v = stats[s]!, o = vs?.[s] ?? 0, cls = !vs ? '' : v > o ? ' up' : v < o ? ' down' : '';
      return `<span class="chip${cls}">${STATS[s].name} +${v}%</span>`;
    }).join('');
  }

  /**
   * The Gear Shop as a trade window: the shopkeeper behind the counter, a grid
   * of wares (your rod and the next two up, then the set pieces sold at your
   * rod's tier), and the picked one against what you wear, with BUY. SELL shows
   * your bag.
   */
  private gearShopHtml(game: Game): string {
    const stock = game.shopStock();
    const worn = (d: GearDef) => game.equipped[d.slot]?.def === d.id && !game.equipped[d.slot]!.drop;
    if (!stock.some((d) => d.id === this.gsPick)) this.gsPick = (stock.find((d) => !worn(d)) ?? stock[0]!).id;
    const pick = stock.find((d) => d.id === this.gsPick)!;
    const keeper = (line: string) => `<div class="keeper"><img src="${fisherIcon({ shirt: '#e8e0c8', trousers: '#6b4526', boots: '#3a2a1a', hat: { style: 'bucket', color: '#6a8a50', trim: '#3a5a28' } }, 4)}" alt=""><span class="bubble">${line}</span>
      ${this.gsMode === 'sell' ? '<button class="btn plain" data-act="gsMode:buy">BUY</button>' : `<button class="btn plain" data-act="gsMode:sell">SELL ${game.gearBag.length}/${GEAR_BAG}</button>`}</div>`;
    if (this.gsMode === 'sell') return keeper('What have you got?') + this.bagHtml(game, 'gearshop');
    const wares = stock.map((d) => `<div class="ware">${this.gearTile(d, null, `gpick:${d.id}`, d.id === this.gsPick)}<span>${worn(d) ? 'WORN' : kmb(d.price)}</span></div>`).join('');
    return keeper(KEEPER_LINE[pick.set ?? 'rod']) + `<div class="wares">${wares}</div>` + this.wareCard(game, pick, worn(pick));
  }

  /** The picked ware: its set, its stats against the piece you wear there, the set bonus it gets you to, BUY. */
  private wareCard(game: Game, d: GearDef, worn: boolean): string {
    const mine = game.equipped[d.slot], theirs = mine?.stats ?? {};
    const after = { ...game.equipped, [d.slot]: { id: -1, def: d.id, stats: d.stats } };
    const n = d.set ? game.setsWorn(after)[d.set]!.n : 0;
    const chip = d.set ? `<span class="setchip" style="--sc:${SETS[d.set].color}">${SETS[d.set].name.toUpperCase()} ${n}/5</span>` : this.reachLabel(d) ? `<span class="setchip" style="--sc:#7a5a3a">${this.reachLabel(d).toUpperCase()}</span>` : '';
    const rows = STAT_ORDER.filter((s) => d.stats[s] || theirs[s]).map((s) => {
      const v = d.stats[s] ?? 0, o = theirs[s] ?? 0;
      return `<tr><td>${STATS[s].name}</td><td>${o ? `${o}%` : '-'}</td><td class="${v > o ? 'up' : v < o ? 'dn' : ''}">${v ? `${v}%` : '-'}</td></tr>`;
    }).join('');
    const tier = d.set ? (game.setsWorn(after)[d.set]!.tier) : d.tier;
    const bonus = !d.set ? '' : n >= 5 ? `5 pieces: ${SETS[d.set].effectText}` : n >= 2 ? `${n} pieces: ${this.statLine(game.setBonus(d.set, tier)[n - 2]!, '+')}` : `2 pieces: ${this.statLine(game.setBonus(d.set, tier)[0]!, '+')}`;
    return `<div class="ware-card"><div class="wt"><b>${d.name}</b>${chip}</div>
      <table><tr><th></th><th>WEARING</th><th>THIS</th></tr>${rows}</table>
      ${bonus ? `<small class="wbonus">${bonus}</small>` : ''}
      ${worn ? '<button class="btn wide" disabled>WORN</button>' : `<button class="btn wide" data-act="gbuy:${d.id}" ${game.money < d.price ? 'disabled' : ''}>BUY ${cash(d.price)}</button>`}</div>`;
  }

  /** The bag: a grid of everything you aren't wearing; tap one to see it; SELL ALL (keeps Legendaries and voyage finds). */
  private bagHtml(game: Game, from: 'character' | 'gearshop'): string {
    const cells = Array.from({ length: GEAR_BAG }, (_, i) => {
      const it = game.gearBag[i];
      return it ? this.gearTile(game.gearDef(it), it, `gsel:bag:${it.id}`) : '<span class="gtile empty"></span>';
    }).join('');
    const total = game.gearBag.filter((g) => !game.keepOnSellAll(g)).reduce((s, g) => s + game.gearValue(g), 0);
    this.gearFrom = from;
    return `<div class="gbag">${cells}</div><button class="btn wide red" data-act="gsellall" ${total ? '' : 'disabled'}>SELL ALL ${cash(total)}</button>`;
  }

  /**
   * The paper doll: you in the middle, head, torso and legs down the left,
   * feet, charm and rod down the right; under it the set you wear most of
   * (its pieces, its 2/3/4/5 bonuses lit as you reach them, where to find the
   * rest) and your total stats.
   */
  private characterHtml(game: Game): string {
    const tabs = `<div class="tiers two"><button class="tab${this.charTab === 'gear' ? ' on' : ''}" style="--c:#7a5a3a" data-act="charTab:gear">EQUIPPED</button><button class="tab${this.charTab === 'bag' ? ' on' : ''}" style="--c:#7a5a3a" data-act="charTab:bag">BAG ${game.gearBag.length}/${GEAR_BAG}</button></div>`;
    if (this.charTab === 'bag') return tabs + this.bagHtml(game, 'character');
    const o = game.look();
    const fisher = fisherIcon({ shirt: o.shirt, trousers: o.trousers, boots: o.boots, hat: o.hat ? { ...o.hat, style: o.hat.style as HatStyle } : { style: 'straw', color: '#f4cca1', trim: '#f4cca1' } }, 6);
    this.gearFrom = 'character';
    const slot = ([s, label]: [GearSlot, string]) => {
      const it = game.equipped[s], def = it ? game.gearDef(it) : null;
      const tile = def ? this.gearTile(def, it, `gsel:eq:${s}`) : `<button class="gtile empty" data-act="gsel:eq:${s}"><img src="${ghostIcon(s)}" alt="${s}" class="ghost"></button>`;
      return `<div class="dslot">${tile}<small>${label}</small></div>`;
    };
    const left = ([['hat', 'HEAD'], ['shirt', 'TORSO'], ['pants', 'LEGS']] as [GearSlot, string][]).map(slot).join('');
    const right = ([['boots', 'FEET'], ['charm', 'CHARM'], ['rod', 'ROD']] as [GearSlot, string][]).map(slot).join('');
    const totals = game.statsFor();
    const shown = Object.fromEntries(STAT_ORDER.filter((s) => totals[s]).map((s) => [s, totals[s]]));
    return tabs + `<div class="doll2"><div class="dcol">${left}</div><div class="stage"><img src="${fisher}" alt="you"></div><div class="dcol">${right}</div></div>`
      + this.setBox(game)
      + `<button class="totals" data-act="stats"><span>TOTAL</span><em>${this.statLine(shown) || 'No bonuses yet'}</em>${game.heir.trait ? ` <small>(${TRAITS[game.heir.trait].name})</small>` : ''}<b class="more">STATS &gt;</b></button>`;
  }

  /**
   * Every stat with what it does for you right now, in game terms (seconds,
   * "1 in N", how many Fishing levels it's worth), counting your skills,
   * tackle and Keen Eye where they add to the same thing.
   */
  private statsHtml(game: Game): string {
    const s = game.statsFor(), one = (p: number) => (p > 0 ? `1 in ${Math.max(1, Math.round(1 / p))}` : 'never');
    const boost = 1 + (FORTUNE_SCALE * s.fortune) / 100;
    const twin = Math.min(0.9, NETS[game.net]!.chance + s.twin / 100);
    const says: Record<StatId, string> = {
      size: `Fish weigh and sell ${s.size}% more`,
      luck: `Rare fish bite as if +${((s.luck / 100) * LUCK_SCALE / SKILL_TIER_BONUS).toFixed(1)} Fishing levels`,
      patience: `Bites come ${(1 + s.patience / 100).toFixed(2)}x as fast`,
      reflex: `PERFECT zone ${game.perfectZone().toFixed(2)}s · Autofisher ${pct(game.autoPerfectChance())}`,
      strength: `Hold ${pct(game.strengthChance())} too-strong · Fights +${Math.round((game.fightPower() - 1) * 100)}%`,
      fortune: `Shiny ${one(VARIANTS.shiny.chance * boost)} · Golden ${one(VARIANTS.golden.chance * boost)}`,
      twin: `${one(twin)} catches come in twos`,
      crew: `Your fishermen bite ${(1 + s.crew / 100).toFixed(2)}x as fast`,
      scavenge: `Gear drops ${one(game.dropChance())} catches`,
      thrift: `${s.thrift}% of casts use no bait`,
      stride: `Walk ${s.stride}% faster`,
    };
    return `<div class="statlist">${STAT_ORDER.map((k) => `<div class="srow${s[k] ? '' : ' zero'}"><b>${STATS[k].name}</b><span>${s[k]}%</span><small>${says[k]}</small></div>`).join('')}</div>
      <p class="note">PERFECT: reel while the gold ring shrinks for double value.</p>`;
  }

  /** The set you wear most of: its five pieces (missing ones dark), its bonuses, where to find what's missing. */
  private setBox(game: Game): string {
    const worn = game.setsWorn();
    const best = (Object.entries(worn) as [SetId, { n: number; tier: GearTier }][]).sort((a, b) => b[1].n - a[1].n)[0];
    if (!best) return '<p class="note">Wear 2 pieces of a set for a bonus. Look for the coloured corner.</p>';
    const [set, w] = best, def = SETS[set];
    const have = (s: (typeof SET_SLOTS)[number]) => game.gearOf(s)?.set === set;
    const minis = SET_SLOTS.map((s) => { const g = game.gearOf(s), shown = have(s) ? g! : gearById(setPieceId(set, s, 'gold'))!; return `<img src="${gearIcon(shown, 2)}" class="${have(s) ? '' : 'miss'}" alt="">`; }).join('');
    const bon = game.setBonus(set, w.tier);
    const lines = [0, 1, 2].map((k) => `<div class="bon${w.n >= k + 2 ? ' on' : ''}"><i>${k + 2}</i>${this.statLine(bon[k]!, '+')}</div>`).join('')
      + `<div class="bon${w.n >= 5 ? ' on' : ''}"><i>5</i>${def.effectText}</div>`;
    const missing = SET_SLOTS.filter((s) => !have(s)).map((s) => `${def.pieces[s].name} (${SOURCE_NAME[def.pieces[s].source].toLowerCase()})`);
    return `<div class="setbox" style="--sc:${def.color}"><div class="st"><b>${def.name}</b><span class="setchip">${w.n}/5</span><span class="minis">${minis}</span></div>${lines}
      ${missing.length ? `<small class="src">Missing: ${missing.slice(0, 2).join(', ')}${missing.length > 2 ? '...' : ''}</small>` : ''}</div>`;
  }

  /** Stats as one short line: "Luck 20% · Reflex 15%" (or "Luck +20%"). */
  private statLine(stats: Partial<Record<StatId, number>>, plus = ''): string {
    return STAT_ORDER.filter((s) => stats[s]).map((s) => `${STATS[s].name} ${plus}${stats[s]}%`).join(' · ');
  }

  /** The piece you tapped (in the bag, or worn in a slot). */
  private gearSelected(game: Game): { item: GearItem | null; def: GearDef | null; worn: boolean } {
    if (this.gsel.where === 'eq') { const it = game.equipped[this.gsel.key as GearSlot]; return { item: it, def: it ? game.gearDef(it) : null, worn: true }; }
    const it = game.gearBag.find((g) => g.id === Number(this.gsel.key)) ?? null;
    return { item: it, def: it ? game.gearDef(it) : null, worn: false };
  }

  private gearItemTitle(game: Game): string {
    return this.gearSelected(game).def?.name ?? 'Empty';
  }

  /** A piece close up: tier, stats against what you wear in that slot, a Legendary's effect; EQUIP / TAKE OFF / SELL. */
  /**
   * A piece as a card (mobile RPG style): big icon, name, tier; each of its
   * stats with a green up or red down arrow for how it compares with the piece
   * you wear in that slot; then how your totals would change; EQUIP / SELL.
   * A piece you're wearing shows just its stats and TAKE OFF.
   */
  private gearItemHtml(game: Game): string {
    const { item, def, worn } = this.gearSelected(game);
    if (!item || !def) {
      // An empty slot: what in your bag fits it.
      const slot = this.gsel.key as GearSlot, fits = game.gearBag.filter((g) => game.gearDef(g).slot === slot);
      return fits.length ? `<p class="note">Pieces in your bag that fit:</p><div class="gbag">${fits.map((g) => this.gearTile(game.gearDef(g), g, `gsel:bag:${g.id}`)).join('')}</div>`
        : '<p class="empty">Nothing here. Buy one at the Gear Shop, or find one fishing.</p>';
    }
    const tier = GEAR_TIERS[def.tier];
    const kind = def.tier === 'legendary' ? 'Abyss voyage find' : def.source === 'voyage' ? 'Voyage find' : item.drop ? (item.fine ? 'Fine find' : 'Found fishing') : 'Shop piece';
    const head = `<div class="rpghead">${this.gearTile(def, item, 'none')}<div><b class="rpgname">${def.name}</b>
      <small style="color:${tier.color}">${tier.name} ${SLOT_NAME[def.slot]}</small>${def.set ? `<small><span class="setchip" style="--sc:${SETS[def.set].color}">${SETS[def.set].name.toUpperCase()} SET</span></small>` : ''}<small>${worn ? 'You are wearing this' : kind}</small></div></div>`;
    const other = worn ? null : game.equipped[def.slot];
    const mine = other?.stats ?? {};
    const lines = STAT_ORDER.filter((st) => item.stats[st]).map((st) => {
      const v = item.stats[st]!, d = v - (mine[st] ?? 0);
      const arrow = worn ? '' : d > 0 ? `<i class="up">\u25b2 ${d}</i>` : d < 0 ? `<i class="down">\u25bc ${-d}</i>` : '<i>=</i>';
      return `<div class="rpgstat"><span>${STATS[st].name}</span><b>${v}%</b>${arrow}</div>`;
    }).join('') + (this.reachLabel(def) ? `<div class="rpgstat"><span>Lands</span><b>${this.reachLabel(def)}</b><i></i></div>` : '') || '<p class="note">No stats.</p>';
    let changes = '';
    if (!worn) {
      // Totals over everything you wear, before and after swapping this in.
      // Set bonuses count: swapping a piece can make or break one.
      const nowAll = game.statsFor(), afterAll = game.statsFor({ ...game.equipped, [def.slot]: item });
      const rows = STAT_ORDER.map((st) => {
        const now = nowAll[st], after = afterAll[st];
        return now === after ? '' : `<div class="rpgstat small"><span>${STATS[st].name}</span><b>${now}% \u2192 ${after}%</b><i class="${after > now ? 'up' : 'down'}">${after > now ? '\u25b2' : '\u25bc'}</i></div>`;
      }).join('');
      changes = `<div class="rpgtotal"><small>${other ? `Instead of your ${game.gearDef(other).name}, your totals change:` : 'Nothing worn there now. Your totals change:'}</small>${rows || '<small>No change.</small>'}</div>`;
    }
    const effect = def.effect ? `<p class="note legend">${def.blurb}</p>` : '';
    // Money sinks: reforge a found piece, masterwork a Legendary.
    const rf = game.reforgeCost(item), mwc = game.masterworkCost(item);
    const sink = rf !== null
      ? `<div class="row tight sink"><div class="meta"><b>Reforge <span class="small">${Math.round(game.gearQuality(item) * 100)}%</span></b><div class="sub"><small class="fx wrap">Rolls 80-125%, keeps the better</small></div></div><button class="btn plain" data-act="reforge:${item.id}" ${game.money < rf ? 'disabled' : ''}>${cash(rf)}</button></div>`
      : def.tier === 'legendary'
        ? `<div class="row tight sink"><div class="meta"><b>Masterwork <span class="small">${item.mw ?? 0}/${MASTERWORK.max}</span></b><div class="sub"><small class="fx wrap">${mwc === null ? `Stats +${(item.mw ?? 0) * 10}%. Complete.` : `Stats +${(item.mw ?? 0) * 10}%, next +${((item.mw ?? 0) + 1) * 10}%`}</small></div></div>${mwc === null ? '<span class="maxed">MAX</span>' : `<button class="btn plain" data-act="masterwork:${item.id}" ${game.money < mwc ? 'disabled' : ''}>${cash(mwc)}</button>`}</div>`
        : '';
    const buttons = worn
      ? (def.slot === 'rod' ? '<p class="note">You always fish with a rod: equip another to swap.</p>' : `<button class="btn wide plain" data-act="gunequip:${def.slot}" ${game.gearBag.length >= GEAR_BAG ? 'disabled' : ''}>TAKE OFF</button>`)
      : `<div class="vchoices"><button class="btn" data-act="gequip:${item.id}">EQUIP</button><button class="btn red" data-act="gsell:${item.id}">SELL ${cash(game.gearValue(item))}</button></div>`;
    return `<div class="rpgcard">${head}<div class="rpgstats">${lines}</div>${changes}</div>` + effect + sink + buttons;
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
  /**
   * Retire: hand the rod to an heir. RETIRE: the Pearls this run pays, three
   * heirs to pick from (one trait each), one piece of gear to hand down.
   * FAMILY: the generations so far.
   */
  private retireHtml(game: Game): string {
    const gain = game.pearlsOnRetire();
    const tabs = `<div class="tiers two">${(['retire', 'family'] as const).map((k) => `<button class="tab${this.retireTab === k ? ' on' : ''}" style="--c:#7a5a3a" data-act="retireTab:${k}">${k === 'retire' ? 'RETIRE' : `FAMILY ${game.generation}`}</button>`).join('')}</div>`;
    if (this.retireTab === 'family') {
      // Newest first; the last six fit.
      const gens = [...game.family.map((f, i) => ({ ...f, gen: i + 1 })), { name: game.heir.name, trait: game.heir.trait, pearls: gain, best: game.runBest?.fish, bestKg: game.runBest?.kg, gen: game.generation, now: true }].reverse();
      const rows = gens.slice(0, 6).map((f) => `<div class="row"><div class="slot">${f.best ? `<img class="fit" src="${fishIcon(fishById(f.best), false, 48, 28)}" alt="">` : icon('rod')}</div>
        <div class="meta"><b>${f.name} <span class="small">Gen ${f.gen}${f.trait ? ` · ${TRAITS[f.trait].name}` : ''}</span></b><div class="sub"><small>${f.best ? `${fishById(f.best).name} ${f.bestKg} kg` : 'No catch yet'} · ${'now' in f ? 'fishing now' : `${f.pearls} Pearls`}</small></div></div></div>`).join('');
      return tabs + rows + (gens.length > 6 ? `<p class="note">And ${gens.length - 6} before them.</p>` : '');
    }
    if (gain < 1) return tabs + `<div class="row"><div class="slot">${icon('pearl')}</div><div class="meta"><b>Not yet</b><div class="sub"><small>Earn $250k in a run for a Pearl</small></div></div></div><button class="btn wide plain" data-act="tree">FISH TREE</button>`;
    const heirs = game.offerHeirs().map((h, i) => `<button class="heir${this.heirSel === i ? ' sel' : ''}" data-act="heir:${i}"><b>${h.name}</b><i>${TRAITS[h.trait!].name}</i><small>${TRAITS[h.trait!].blurb}</small></button>`).join('');
    const items = this.heirloomItems(game), item = items.find((g) => g.id === this.heirloom) ?? items[0];
    const def = item ? game.gearDef(item) : null;
    return tabs + `<div class="row tight"><div class="slot">${icon('pearl')}</div><div class="meta"><b>+${gain} Pearls</b><div class="sub"><small>Earned ${kmb(game.earned)} this run</small></div></div></div>
      <p class="note">Pick your heir:</p><div class="heirs">${heirs}</div>
      ${item && def ? `<div class="row gearrow">${this.gearTile(def, item, 'heirloom')}<div class="meta"><b>${def.name}</b><div class="sub"><small>Heirloom</small></div></div>${items.length > 1 ? '<button class="btn plain" data-act="heirloom">CHANGE</button>' : ''}</div>`
        : `<div class="row"><div class="slot">${icon('shirt')}</div><div class="meta"><b>No heirloom</b><div class="sub"><small>Hand down a hat, shirt, pants or boots</small></div></div></div>`}
      <button class="btn wide" data-act="doRetire">RETIRE ${icon('pearl', 2)} +${gain}</button>`;
  }

  /** Gear you could hand down: what you wear, then your bag; not rods. */
  heirloomItems(game: Game): GearItem[] {
    return [...GEAR_SLOTS.map((s) => game.equipped[s]), ...game.gearBag].filter((g): g is GearItem => !!g && game.gearDef(g).slot !== 'rod');
  }

  private settingsHtml(game: Game): string {
    return `<div class="row"><div class="slot">${icon('coin')}</div><div class="meta"><b>This run</b></div>${coin(game.earned, 3)}</div>
      <div class="row"><div class="slot">${icon('pearl')}</div><div class="meta"><b>${game.pearls} Pearls</b><div class="sub"><small>${game.fishTree.length}/${TREE_FISH.length} tree fish · retired ${game.retirements}x</small></div></div>
        <button class="btn plain" data-act="tree">TREE</button><button class="btn" data-act="retire">RETIRE</button></div>
      ${game.flagship ? `<div class="row"><div class="slot">${icon('star')}</div><div class="meta"><b>Town Decor</b><div class="sub"><small>${game.decor.length}/${DECOR.length} bought</small></div></div><button class="btn plain" data-act="decor">DECORATE</button></div>` : ''}
      ${this.canBuzz ? `<button class="btn wide plain" data-act="toggleBuzz">BUZZ ON BITE: ${this.buzz ? 'ON' : 'OFF'}</button>` : '<p class="note">Buzz on bite: not available on this phone.</p>'}
      <button class="btn wide ${game.dev ? 'red' : 'plain'}" data-act="toggleDev">DEV MODE ${game.dev ? 'ON' : 'OFF'} (x${DEV_MULTIPLIER} PRICES)</button>
      <button class="btn wide red" data-act="reset">START OVER</button>`;
  }

  private set(key: keyof UI['last'], el: HTMLElement, html: string): void {
    if (this.pressing || this.last[key] === html) return;
    this.last[key] = html;
    el.innerHTML = html;
  }
}
