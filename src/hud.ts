import { BUILDABLE, BUILDINGS, PLAYER, UNITS, type BuildingKind, type Cost, type UnitKind } from './config';
import type { Game } from './game';

/**
 * The single source of "what does my next tap do". Exactly one of these is
 * active; the bottom panel always spells it out.
 */
export type Mode =
  | { type: 'none' }
  | { type: 'units'; ids: Set<number> }
  /** A building is selected (own: train / info; enemy: info only). */
  | { type: 'building'; id: number }
  /** An enemy unit tapped with nothing selected: show what it is. */
  | { type: 'inspect'; id: number }
  | { type: 'place'; kind: BuildingKind; tx: number; ty: number; builders: Set<number> };

export type HudAction =
  | 'idle' | 'all' | 'army' | 'box' | 'clear' | 'confirm' | 'restart'
  | `build:${BuildingKind}` | `train:${UnitKind}`;

/** Small inline icons so the HUD doesn't depend on emoji fonts. */
const ICON: Record<string, string> = {
  wood: '<svg viewBox="0 0 20 20"><rect x="2" y="6" width="16" height="8" rx="4" fill="#8a5a2e"/><ellipse cx="16" cy="10" rx="2.6" ry="4" fill="#d9ad6f"/><ellipse cx="16" cy="10" rx="1.2" ry="2" fill="#a97b45"/></svg>',
  gold: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5" fill="#c79a1e"/><circle cx="10" cy="10" r="5.6" fill="#f4cc4a"/><path d="M7 8.5a3.4 3.4 0 0 1 3-2.4" stroke="#fff3c4" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>',
  pop: '<svg viewBox="0 0 20 20"><circle cx="10" cy="6" r="3.4" fill="#f1c7a0"/><path d="M4 18c0-4 2.6-7 6-7s6 3 6 7z" fill="#5b8fe6"/></svg>',
  house: '<svg viewBox="0 0 24 24"><path d="M3 11 12 4l9 7z" fill="#2f6fd6"/><rect x="5" y="11" width="14" height="9" fill="#eadbc0"/><rect x="10.5" y="14" width="3" height="6" fill="#4a2e18"/></svg>',
  mill: '<svg viewBox="0 0 24 24"><path d="M3 11 12 5l9 6z" fill="#2f6fd6"/><rect x="5" y="11" width="14" height="9" fill="#a77a4c"/><circle cx="8" cy="18" r="2.4" fill="#6b4526"/><circle cx="12.5" cy="18" r="2.4" fill="#6b4526"/></svg>',
  barracks: '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="11" fill="#8a8f99"/><path d="M3 9h3V6h3v3h2V6h2v3h2V6h3v3h3" fill="#8a8f99"/><rect x="10" y="13" width="4" height="7" fill="#4a2e18"/><path d="M12 2v5l4-1.5z" fill="#2f6fd6"/></svg>',
  peasant: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="6" ry="2" fill="#e3c56b"/><circle cx="12" cy="8" r="3.4" fill="#f1c7a0"/><rect x="7.5" y="11.5" width="9" height="9" rx="3" fill="#2f6fd6"/></svg>',
  swordsman: '<svg viewBox="0 0 24 24"><path d="M17 2 9 14l1.5 1.5L18.5 3z" fill="#c9ced6"/><path d="M8 13l3 3-1 1-3-3z" fill="#6b4526"/><circle cx="8" cy="16" r="5" fill="#2f6fd6" stroke="#c9a24a" stroke-width="1.2"/></svg>',
  archer: '<svg viewBox="0 0 24 24"><path d="M6 3c6 4 6 14 0 18" stroke="#8a5a2e" stroke-width="2" fill="none"/><path d="M6 3v18" stroke="#e8dcc0" stroke-width="0.8"/><path d="M4 12h16" stroke="#5b3b1e" stroke-width="1.4"/><path d="M20 12l-3-2v4z" fill="#c9ced6"/></svg>',
  box: '<svg viewBox="0 0 20 20"><rect x="3" y="3" width="14" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-dasharray="3 2"/></svg>',
};
const icon = (k: string) => `<i class="ic">${ICON[k] ?? ''}</i>`;

const costText = (c: Cost) =>
  Object.entries(c).map(([k, v]) => `${icon(k)}${v}`).join(' ') || 'free';

const plural = (n: number, word: string) => {
  const w = word.toLowerCase();
  return `${n} ${n === 1 ? w : w.endsWith('man') ? `${w.slice(0, -3)}men` : `${w}s`}`;
};

export class Hud {
  private top = document.getElementById('top')!;
  private panel = document.getElementById('panel')!;
  private toast = document.getElementById('toast')!;
  private modal = document.getElementById('modal')!;
  private lastTop = '';
  private lastPanel = '';
  private lastNotice = -1;
  private lastModal = '';

  constructor(onAction: (a: HudAction) => void) {
    const click = (e: Event) => {
      const btn = (e.target as HTMLElement).closest('button');
      if (btn && !btn.disabled && btn.dataset.act) onAction(btn.dataset.act as HudAction);
    };
    this.panel.addEventListener('click', click);
    this.modal.addEventListener('click', click);
  }

  update(game: Game, mode: Mode, boxOn: boolean): void {
    const war = game.provoked
      ? '<span class="res war">⚔ War</span>'
      : '<span class="res peace">Peace</span>';
    const top =
      `<span class="res">${icon('wood')}${Math.floor(game.stock.wood)}</span>` +
      `<span class="res">${icon('gold')}${Math.floor(game.stock.gold)}</span>` +
      `<span class="res ${game.popUsed >= game.popCap ? 'full' : ''}">${icon('pop')}${game.popUsed}/${game.popCap}</span>` + war;
    if (top !== this.lastTop) { this.top.innerHTML = top; this.lastTop = top; }

    const panel = this.panelHtml(game, mode, boxOn);
    if (panel !== this.lastPanel) { this.panel.innerHTML = panel; this.lastPanel = panel; }

    const modal = game.winner === null ? '' : game.winner === PLAYER
      ? `<div class="card"><h1 class="win">Victory</h1><p>The enemy town hall has fallen.</p><button class="go" data-act="restart">Play again</button></div>`
      : `<div class="card"><h1 class="lose">Defeat</h1><p>Your town hall has fallen.</p><button class="go" data-act="restart">Play again</button></div>`;
    if (modal !== this.lastModal) {
      this.modal.innerHTML = modal;
      this.modal.classList.toggle('show', modal !== '');
      this.lastModal = modal;
    }

    if (game.notice && game.notice.at !== this.lastNotice) {
      this.lastNotice = game.notice.at;
      this.toast.textContent = game.notice.text;
      this.toast.classList.remove('show');
      void this.toast.offsetWidth; // restart the fade animation
      this.toast.classList.add('show');
    }
  }

  private panelHtml(game: Game, mode: Mode, boxOn: boolean): string {
    const close = `<button class="x" data-act="clear" aria-label="deselect">✕</button>`;
    const box = `<button class="toggle ${boxOn ? 'on' : ''}" data-act="box" aria-pressed="${boxOn}">${icon('box')}Box</button>`;
    const hp = (cur: number, max: number) => `<small class="hp">♥ ${Math.ceil(cur)}/${max}</small>`;
    switch (mode.type) {
      case 'none': {
        const idle = game.idleUnits(PLAYER, 'peasant').length;
        const army = game.units.filter((u) => u.owner === PLAYER && u.kind !== 'peasant').length;
        return `<div class="hint">${boxOn ? 'Drag on the map to select a group' : 'Tap a unit or building to select it'}</div>
          <div class="row">
            <button data-act="idle" ${idle ? '' : 'disabled'}>Idle: ${idle}</button>
            <button data-act="all">Peasants</button>
            <button data-act="army" ${army ? '' : 'disabled'}>Army: ${army}</button>
            ${box}
          </div>`;
      }
      case 'units': {
        const units = game.units.filter((u) => mode.ids.has(u.id));
        const counts = (['peasant', 'swordsman', 'archer'] as UnitKind[])
          .map((k) => [k, units.filter((u) => u.kind === k).length] as const)
          .filter(([, n]) => n > 0)
          .map(([k, n]) => plural(n, UNITS[k].name));
        const peasants = units.some((u) => u.kind === 'peasant');
        const single = units.length === 1 ? hp(units[0]!.hp, units[0]!.maxHp) : '';
        const hint = peasants
          ? 'Tap tree / mine = gather · site = build · enemy = attack · ground = move'
          : 'Tap an enemy = attack · ground = move';
        const builds = peasants ? `<div class="row">${BUILDABLE.map((k) => {
          const d = BUILDINGS[k];
          return `<button class="card ${game.canAfford(d.cost) ? '' : 'poor'}" data-act="build:${k}">
            ${icon(k)}<span><b>${d.name}</b><small>${costText(d.cost)}</small></span></button>`;
        }).join('')}</div>` : '';
        return `<div class="head"><span>${counts.join(' · ') || 'nobody'} ${single}</span><span class="tools">${box}${close}</span></div>
          <div class="hint">${hint}</div>${builds}`;
      }
      case 'building': {
        const b = game.buildings.get(mode.id);
        if (!b) return '';
        const d = BUILDINGS[b.kind];
        const enemy = b.owner !== PLAYER;
        const name = `${enemy ? 'Enemy ' : ''}${d.name}`;
        if (b.progress < 1) {
          return `<div class="head"><span>${name} — building ${Math.floor(b.progress * 100)}%</span>${close}</div>
            <div class="hint">${enemy ? 'Under construction.' : 'Select peasants, then tap the site to help build'}</div>`;
        }
        let body = `<div class="hint">${enemy ? 'Select soldiers, then tap it to attack.' : d.blurb}</div>`;
        if (!enemy && d.trains.length) {
          const next = b.queue[0];
          const left = next ? ` · next in ${Math.ceil(UNITS[next].trainSeconds - b.trainTimer)}s` : '';
          const cards = d.trains.map((k) => {
            const u = UNITS[k];
            return `<button class="card ${game.canAfford(u.cost) ? '' : 'poor'}" data-act="train:${k}">
              ${icon(k)}<span><b>${u.name}</b><small>${costText(u.cost)}</small></span></button>`;
          }).join('');
          body += `<div class="row">${cards}</div><div class="queue">queue ${b.queue.length}${left}</div>`;
        }
        return `<div class="head"><span>${name} ${hp(b.hp, b.maxHp)}</span>${close}</div>${body}`;
      }
      case 'inspect': {
        const u = game.unit(mode.id);
        if (!u) return '';
        return `<div class="head"><span>Enemy ${UNITS[u.kind].name} ${hp(u.hp, u.maxHp)}</span>${close}</div>
          <div class="hint">${UNITS[u.kind].blurb} Select soldiers, then tap it to attack.</div>`;
      }
      case 'place': {
        const d = BUILDINGS[mode.kind];
        const ok = game.canPlace(mode.kind, mode.tx, mode.ty);
        return `<div class="head"><span>Place ${d.name} <small>${costText(d.cost)}</small></span>${close}</div>
          <div class="hint">${ok ? 'Tap the map to move it · drag to pan' : 'Blocked — tap open grass'}</div>
          <div class="row"><button class="go" data-act="confirm" ${ok ? '' : 'disabled'}>✓ Build here</button></div>`;
      }
    }
  }
}

