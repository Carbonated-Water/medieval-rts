// All gameplay tunables live here. Prefer changing a constant over
// hardcoding a number in game.ts or ai.ts.

export const MAP_COLS = 40;
export const MAP_ROWS = 30;

export type Terrain = 'grass' | 'forest' | 'mountain' | 'water';

/** Nation index: 0 = the player, 1.. = bots. Neutral towns use NEUTRAL. */
export const PLAYER = 0;
export const NEUTRAL = -1;

export interface NationDef { name: string; color: number }

/** First entry is the player. Colours chosen to stay distinct on green and blue. */
export const NATIONS: NationDef[] = [
  { name: 'You', color: 0x2f6fd6 },
  { name: 'Ravenmoor', color: 0xd63b2f },
  { name: 'Goldhaven', color: 0xf0c23a },
  { name: 'Thornwick', color: 0xf4f1e8 }, // white: green would vanish on the grass
  { name: 'Duskvale', color: 0x8e44c9 },
  { name: 'Ashford', color: 0xef7d2a },
  { name: 'Frostmere', color: 0x3ec6d6 },
  { name: 'Rosecliff', color: 0xe85aa0 },
  { name: 'Ironhold', color: 0x5a6273 },
];
export const NEUTRAL_COLOR = 0xb9b1a0;

export const NEUTRAL_TOWNS = 18;
/** Neutral town garrison range (inclusive). */
export const NEUTRAL_GARRISON: [number, number] = [6, 14];
/** Troops each nation starts with, standing on its capital. */
export const START_ARMY = 10;
/** Starting land: hexes within this distance of the capital. */
export const START_RADIUS = 1;
/** Minimum hex distance between capitals. */
export const CAPITAL_SPACING = 8;

/** Seconds between spawns at every owned city. */
export const SPAWN_EVERY = 6;
export const CAPITAL_SPAWN = 5;
export const TOWN_SPAWN = 2;
/** Capitals spawn +1 troop for every this many hexes the nation owns. */
export const TERRITORY_PER_BONUS = 40;
/** ...but never more than this bonus (big empires snowballed otherwise). */
export const TERRITORY_BONUS_MAX = 6;
export const ARMY_MAX = 99;

/** Seconds to step into a hex, by terrain (Infinity = impassable). */
export const STEP_SECONDS: Record<Terrain, number> = { grass: 0.7, forest: 1.2, mountain: Infinity, water: Infinity };

/** An army defending a city hex fights as if it were this much bigger. */
export const CITY_DEFENSE = 1.5;
