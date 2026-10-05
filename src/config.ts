// All gameplay tunables live here. Prefer changing a constant over
// hardcoding a number in game.ts or ai.ts.

export const TILE = 32; // world px per tile
export const MAP_W = 64;
export const MAP_H = 64;

/** 0 = the player (blue), 1 = the AI (red). */
export type Owner = 0 | 1;
export const PLAYER: Owner = 0;
export const ENEMY: Owner = 1;

export type ResourceKind = 'wood' | 'gold';
export type BuildingKind = 'hall' | 'house' | 'mill' | 'barracks';
export type UnitKind = 'peasant' | 'swordsman' | 'archer';
export type Cost = Partial<Record<ResourceKind, number>>;

export const CARRY_CAP = 10;
/** Seconds of work to fill one load. */
export const GATHER_SECONDS: Record<ResourceKind, number> = { wood: 5, gold: 4 };
export const TREE_WOOD = 40;
export const MINE_GOLD = 1500;
export const MINE_SIZE = 2;

export const TRAIN_QUEUE_MAX = 5;
export const POP_MAX = 50;

export interface UnitDef {
  name: string;
  hp: number;
  damage: number;
  /** Attack reach in tiles, centre to centre (to the nearest edge for buildings). */
  range: number;
  /** Seconds between attacks. */
  cooldown: number;
  speed: number; // world px / sec
  cost: Cost;
  trainSeconds: number;
  /** Fires arrows instead of hitting in melee. */
  ranged: boolean;
  /** Tiles within which an idle unit picks a fight on its own (0 = never). */
  aggro: number;
  blurb: string;
}

export const UNITS: Record<UnitKind, UnitDef> = {
  peasant: {
    name: 'Peasant', hp: 25, damage: 3, range: 1.5, cooldown: 1.5, speed: 72,
    cost: { gold: 50 }, trainSeconds: 10, ranged: false, aggro: 0,
    blurb: 'Gathers, builds. Only fights back.',
  },
  swordsman: {
    name: 'Swordsman', hp: 80, damage: 10, range: 1.5, cooldown: 1.1, speed: 64,
    cost: { gold: 60, wood: 20 }, trainSeconds: 15, ranged: false, aggro: 6,
    blurb: 'Tough melee fighter.',
  },
  archer: {
    name: 'Archer', hp: 35, damage: 7, range: 5, cooldown: 1.6, speed: 66,
    cost: { gold: 30, wood: 40 }, trainSeconds: 14, ranged: true, aggro: 7,
    blurb: 'Shoots from range. Fragile.',
  },
};

/** Arrow flight speed, tiles / sec. */
export const ARROW_SPEED = 11;

export interface BuildingDef {
  name: string;
  size: number; // square footprint, tiles
  cost: Cost;
  buildSeconds: number; // with one peasant; more peasants stack linearly
  hp: number;
  pop: number; // population cap provided once complete
  dropOff: ResourceKind[];
  trains: UnitKind[];
  blurb: string;
}

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  hall: {
    name: 'Town Hall', size: 3, cost: {}, buildSeconds: 1, hp: 700, pop: 5,
    dropOff: ['wood', 'gold'], trains: ['peasant'], blurb: 'Trains peasants. Drop-off for wood + gold.',
  },
  house: {
    name: 'House', size: 2, cost: { wood: 60 }, buildSeconds: 15, hp: 150, pop: 5,
    dropOff: [], trains: [], blurb: '+5 population.',
  },
  mill: {
    name: 'Lumber Mill', size: 2, cost: { wood: 80 }, buildSeconds: 20, hp: 200, pop: 0,
    dropOff: ['wood'], trains: [], blurb: 'Drop-off for wood. Build near forests.',
  },
  barracks: {
    name: 'Barracks', size: 2, cost: { wood: 120 }, buildSeconds: 25, hp: 350, pop: 0,
    dropOff: [], trains: ['swordsman', 'archer'], blurb: 'Trains swordsmen and archers.',
  },
};

/** Buildings a peasant can place, in HUD order. */
export const BUILDABLE: BuildingKind[] = ['house', 'mill', 'barracks'];

/** A site starts with this share of its hit points and gains the rest as it is built. */
export const SITE_HP_SHARE = 0.1;

export const START_STOCK: Record<ResourceKind, number> = { wood: 100, gold: 150 };
export const START_PEASANTS = 3;
