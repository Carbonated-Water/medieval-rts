import {
  ACHIEVEMENTS, AUTO, BAITS, BERTHS, BOATS, BOAT_ORDER, COMPANY_PRICE, COMPANY_UNLOCK_EARNED, DEV_MULTIPLIER, GROUNDS, HARBOR_UPGRADES,
  MANAGER_BUDGETS, PIER_SECTIONS, PIER_SPOTS, PIER_STAFF, HANDS_MAX,
  TRACKS, TRACK_MAX, TRACK_ORDER, WAREHOUSE, type HarborUpgradeId, type TrackId, HAND_NAMES, HAND_SKILL_MAX, LETTERS, RODS, FISH, GEAR, REFLEX_PER_LEVEL, SKILLS, STRENGTH_PER_LEVEL, HAGGLE_PER_LEVEL,
  TIERS, VARIANTS, VARIANT_ORDER, type AchStat, type BaitId, type BoatType, type GearKind, type SkillId, type Tier,
} from './data';
import { type Boat, type Game } from './game';
import { Notices, lineHtml, timeAgo } from './notify';
import { pixelFishIcon as fishIcon, pixelIcon, type IconName } from './pixelart';
import type { Place } from './scene';

/** One panel per job: the market sells fish, the tackle shop sells gear, the school trains skills. */
export type Panel = 'market' | 'tackle' | 'baitshop' | 'pouch' | 'harbor' | 'boat' | 'shipyard' | 'harborup' | 'pier' | 'pierstaff' | 'hand' | 'training' | 'journal' | 'trophies' | 'inbox' | 'settings';

export type Action =
  | 'cast' | 'reel' | 'close' | 'reset' | 'toggleDev' | Panel
  | 'sellAll' | `sellFish:${string}` | `buy:${GearKind}` | `train:${SkillId}` | 'claimAll' | `trophy:${string}`
  | `bait:${BaitId}` | `buyBait:${BaitId}:${number}`
  | 'buyCompany' | `buyBoat:${BoatType}` | `boat:${number}` | `send:${number}` | `collect:${number}` | `crew:${number}` | `net:${number}`
  | 'sendAll' | 'collectAll' | `ground:${number}:${string}` | `track:${TrackId}` | `upgrade:${number}:${TrackId}`
  | `sellBoat:${number}` | 'buyBerth' | 'buyWarehouse' | `buyHarbor:${HarborUpgradeId}`
  | 'buyPierSection' | `budget:${number}`
  | 'hire' | 'sellCrate' | `hand:${number}` | `handRod:${number}` | `handTrain:${number}` | `handBait:${number}:${BaitId}`;

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
  /** Boat / fisherman shown in their detail panels. */
  boatSel = 0;
  handSel = 0;
  /** Upgrade track shown in the boat panel's detail strip. */
  trackSel: TrackId = 'hull';

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
          : panel === 'harbor' ? [game.company ? 'Fishing Co.' : 'Old Harbor', this.harborHtml(game)]
          : panel === 'boat' ? [game.boats[this.boatSel] ? game.boatName(this.boatSel) : 'Boat', this.boatHtml(game)]
          : panel === 'shipyard' ? [`Shipyard ${game.boats.length}/${game.berthCount}`, this.shipyardHtml(game)]
          : panel === 'harborup' ? ['Harbor', this.harborUpHtml(game)]
          : panel === 'pier' ? [`The Pier ${game.hands.length}/${game.pierSpots}`, this.pierHtml(game)]
          : panel === 'pierstaff' ? ['Pier Staff', this.pierStaffHtml(game)]
          : panel === 'hand' ? [HAND_NAMES[this.handSel] ?? 'Fisherman', this.handHtml(game)]
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
    // The company: a tile per berth (boat or empty), quick send / collect, then the harbor and the pier.
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
    const harbor = `<div class="row"><button class="slot" data-act="harborup" aria-label="harbor">${icon('anchor')}</button><div class="meta"><b>Harbor</b>
      <div class="sub"><small>${game.berthCount} berths · ${game.harbor.master ? 'Harbor Master' : 'no staff'} · ${game.offlineHours}h away</small></div></div><button class="btn plain" data-act="harborup">OPEN</button></div>`;
    return `${quick}<div class="grid fleet">${tiles}</div>${harbor}<p class="note">Tap a boat for its upgrades and fishing grounds.</p>`;
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
    const status = `<div class="row"><div class="slot">${icon(this.trackIcon(b, 'gear'))}</div><div class="meta"><b>${def.gearNames[b.tracks.gear]}</b>
      <div class="sub"><small>${this.boatStatus(game, b)}</small></div></div>${this.boatAction(game, b, i)}</div>`;
    const haul = b.haul ? `<div class="haul">${b.haul.map((h) => {
      const f = def.catch.find((x) => x.id === h.fish)!;
      return `<span><img src="${fishIcon(f, false, 48, 28)}" alt="${f.name}">x${h.n}</span>`;
    }).join('')}</div>` : '';
    // Fishing grounds: tap to choose; locked ones show what they need.
    const grounds = GROUNDS.map((g) => {
      const open = game.groundOpen(b, g);
      const need = (Object.entries(g.need) as [TrackId, number][]).filter(([id, l]) => b.tracks[id] < l).map(([id, l]) => `${TRACKS[id].name} ${l}`).join(', ');
      return `<button class="ground ${b.ground === g.id ? 'sel' : ''} ${open ? '' : 'locked'}" data-act="ground:${i}:${g.id}" ${open ? '' : 'disabled'} title="${open ? `${Math.round(game.tripSeconds(b, g.id))}s, storms ${pct(game.stormChance(b, g.id))}` : `Needs ${need}`}">
        ${open ? '' : icon('lock', 1)}${g.name.replace('Open Sea', 'Sea').replace('The Deep', 'Deep')}</button>`;
    }).join('');
    // Six upgrade tracks; the selected one gets the detail strip.
    const tiles = TRACK_ORDER.map((id) => `<div class="cell"><button class="slot ${this.trackSel === id ? 'sel' : ''}" data-act="track:${id}" title="${TRACKS[id].name}">
      ${icon(this.trackIcon(b, id))}</button>${level(b.tracks[id], TRACK_MAX)}</div>`).join('');
    const id = this.trackSel, cost = game.nextTrackCost(i, id);
    const name = id === 'gear' ? def.gearNames[Math.min(b.tracks.gear + 1, TRACK_MAX)]! : TRACKS[id].name;
    const detail = `<div class="row detail"><div class="meta"><b>${name} <span class="small">LV ${b.tracks[id]}</span></b><div class="sub"><small>${TRACKS[id].blurb}</small></div></div>
      ${cost === null ? '<span class="maxed">MAX</span>' : `<button class="btn" data-act="upgrade:${i}:${id}" ${game.money < cost ? 'disabled' : ''}>${coin(cost)}</button>`}</div>`;
    const crewCost = game.nextCrewCost(i);
    const crew = `<div class="row"><div class="slot">${icon('crew')}</div><div class="meta"><b>Crew ${b.crew}/${game.crewMax(b)}</b><div class="sub"><small>${game.haulSize(b)} a trip · Hull adds slots</small></div></div>
      ${crewCost === null ? '<span class="maxed">FULL</span>' : `<button class="btn" data-act="crew:${i}" ${game.money < crewCost ? 'disabled' : ''}>${coin(crewCost)}</button>`}</div>`;
    const sell = `<div class="row"><div class="meta"><b>Sell boat</b><div class="sub"><small>${b.trip ? 'Wait for it to come back' : 'Frees the berth'}</small></div></div>
      <button class="btn red" data-act="sellBoat:${i}" ${b.trip ? 'disabled' : ''}>${coin(game.boatResale(i))}</button></div>`;
    return status + haul + `<div class="grounds">${grounds}</div><div class="grid tracks">${tiles}</div>` + detail + crew + sell;
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
