// All fish, rods and tuning numbers. Change balance here, not in game.ts.

export type Tier = 1 | 2 | 3 | 4 | 5;

export interface TierDef { name: string; color: string; /** base bite weight per fish */ weight: number }
export const TIERS: Record<Tier, TierDef> = {
  1: { name: 'Common', color: '#9aa5ad', weight: 100 },
  2: { name: 'Uncommon', color: '#4fbf5a', weight: 36 },
  3: { name: 'Rare', color: '#3f8fe0', weight: 12 },
  4: { name: 'Epic', color: '#a352e0', weight: 3.5 },
  5: { name: 'Legendary', color: '#f0a020', weight: 0.9 },
};

export interface FishDef {
  id: string;
  name: string;
  tier: Tier;
  /** Average sale price at average weight. */
  price: number;
  /** Typical weight in kg (actual catches vary ±40%). */
  kg: number;
  /** Relative rarity inside its tier (1 = normal, lower = rarer). */
  rarity: number;
  /** Body, belly and fin colours for the drawing. */
  colors: [string, string, string];
  /** Body shape: length-to-height ratio. */
  shape: number;
}

export const FISH: FishDef[] = [
  { id: 'minnow', name: 'Minnow', tier: 1, price: 2, kg: 0.05, rarity: 1.3, colors: ['#a8b4a0', '#e4e8d8', '#8a9682'], shape: 3.4 },
  { id: 'perch', name: 'Perch', tier: 1, price: 4, kg: 0.4, rarity: 1.1, colors: ['#c0b040', '#f0e6a8', '#e0603a'], shape: 2.6 },
  { id: 'bluegill', name: 'Bluegill', tier: 1, price: 5, kg: 0.3, rarity: 1, colors: ['#4a7aa0', '#f0c060', '#2a4a68'], shape: 1.9 },
  { id: 'carp', name: 'Carp', tier: 1, price: 7, kg: 3, rarity: 0.8, colors: ['#a08040', '#e8d090', '#806030'], shape: 2.4 },

  { id: 'trout', name: 'Brown Trout', tier: 2, price: 14, kg: 1.2, rarity: 1.2, colors: ['#8a7048', '#f0e0b0', '#5a4428'], shape: 3 },
  { id: 'bass', name: 'Largemouth Bass', tier: 2, price: 18, kg: 2, rarity: 1, colors: ['#5a8a40', '#e8eec0', '#3a5a28'], shape: 2.5 },
  { id: 'catfish', name: 'Catfish', tier: 2, price: 22, kg: 4, rarity: 0.9, colors: ['#5a5a50', '#d8d0b8', '#3a3a34'], shape: 3.3 },
  { id: 'pike', name: 'Northern Pike', tier: 2, price: 28, kg: 5, rarity: 0.7, colors: ['#4a7048', '#e8f0c8', '#a0a040'], shape: 4.2 },

  { id: 'salmon', name: 'Salmon', tier: 3, price: 55, kg: 6, rarity: 1.2, colors: ['#c06850', '#f4d0c0', '#804030'], shape: 3.1 },
  { id: 'walleye', name: 'Walleye', tier: 3, price: 65, kg: 3, rarity: 1, colors: ['#b0a050', '#f0f0d0', '#706030'], shape: 3.2 },
  { id: 'zander', name: 'Zander', tier: 3, price: 75, kg: 5, rarity: 0.9, colors: ['#7a8a80', '#e8eee8', '#4a5a50'], shape: 3.5 },
  { id: 'goldcarp', name: 'Golden Carp', tier: 3, price: 90, kg: 4, rarity: 0.7, colors: ['#f0b020', '#ffe890', '#d07010'], shape: 2.4 },

  { id: 'sturgeon', name: 'Sturgeon', tier: 4, price: 200, kg: 30, rarity: 1.2, colors: ['#6a7078', '#c8ccd0', '#40464e'], shape: 4.4 },
  { id: 'arapaima', name: 'Arapaima', tier: 4, price: 260, kg: 60, rarity: 1, colors: ['#5a6a50', '#e0a080', '#c04030'], shape: 4 },
  { id: 'eel', name: 'Electric Eel', tier: 4, price: 320, kg: 12, rarity: 0.9, colors: ['#3a4a30', '#e8e070', '#202a18'], shape: 7 },
  { id: 'koi', name: 'Rainbow Koi', tier: 4, price: 400, kg: 8, rarity: 0.7, colors: ['#f0f0f0', '#ff7040', '#e03040'], shape: 2.7 },

  { id: 'ghostpike', name: 'Ghost Pike', tier: 5, price: 900, kg: 15, rarity: 1.2, colors: ['#d8e8f0', '#ffffff', '#a0c0d8'], shape: 4.3 },
  { id: 'crystaltrout', name: 'Crystal Trout', tier: 5, price: 1200, kg: 5, rarity: 1, colors: ['#80e0f0', '#e0ffff', '#40b0d0'], shape: 3 },
  { id: 'riverdragon', name: 'River Dragon', tier: 5, price: 1500, kg: 40, rarity: 0.8, colors: ['#c03030', '#f0c040', '#601818'], shape: 5.5 },
  { id: 'leviathan', name: 'Ancient Leviathan', tier: 5, price: 3000, kg: 120, rarity: 0.5, colors: ['#203850', '#5a8aa0', '#0a1828'], shape: 4.8 },
];

export interface RodDef { name: string; tier: Tier; price: number; color: string; blurb: string }
/** Index = rod level. A rod lands fish up to its tier. */
export const RODS: RodDef[] = [
  { name: 'Twig Rod', tier: 1, price: 0, color: '#8a6038', blurb: 'A stick and some string.' },
  { name: 'Bamboo Rod', tier: 2, price: 100, color: '#c8b060', blurb: 'Lands Uncommon fish.' },
  { name: 'Fiberglass Rod', tier: 3, price: 900, color: '#e0e0e0', blurb: 'Lands Rare fish.' },
  { name: 'Carbon Rod', tier: 4, price: 5000, color: '#303438', blurb: 'Lands Epic fish.' },
  { name: 'Mythril Rod', tier: 5, price: 25000, color: '#70d8e8', blurb: 'Lands Legendary fish.' },
];

// ---------- gear: each line is bought in order, one level at a time ----------

export interface BaitDef { name: string; price: number; blurb: string; /** multiplies bite wait */ wait: number; /** extra rare-fish weight per tier step */ lure: number }
export const BAIT: BaitDef[] = [
  { name: 'Bread Crumbs', price: 0, blurb: 'Better than nothing.', wait: 1, lure: 0 },
  { name: 'Earthworms', price: 60, blurb: 'Bites come 15% sooner.', wait: 0.85, lure: 0 },
  { name: 'Crickets', price: 450, blurb: 'Bites 30% sooner, rare fish +5%.', wait: 0.7, lure: 0.05 },
  { name: 'Shiny Lure', price: 3000, blurb: 'Bites 45% sooner, rare fish +12%.', wait: 0.55, lure: 0.12 },
  { name: 'Golden Bait', price: 15000, blurb: 'Bites 60% sooner, rare fish +25%.', wait: 0.4, lure: 0.25 },
];

export interface ClothesDef { name: string; price: number; blurb: string; /** catches are this much heavier (and pricier) */ size: number; shirt: string; trousers: string }
export const CLOTHES: ClothesDef[] = [
  { name: 'Old T-Shirt', price: 0, blurb: 'Comfy, at least.', size: 0, shirt: '#e8d8b0', trousers: '#4a6aa0' },
  { name: 'Flannel Shirt', price: 80, blurb: 'Fish are 10% bigger.', size: 0.1, shirt: '#c0402c', trousers: '#3a4a6a' },
  { name: 'Rain Jacket', price: 600, blurb: 'Fish are 22% bigger.', size: 0.22, shirt: '#f0c020', trousers: '#3a4a6a' },
  { name: "Angler's Vest", price: 3500, blurb: 'Fish are 36% bigger.', size: 0.36, shirt: '#6a7a3a', trousers: '#5a4a30' },
  { name: 'Pro Waders Suit', price: 18000, blurb: 'Fish are 55% bigger.', size: 0.55, shirt: '#2a5a4a', trousers: '#2a5a4a' },
];

export interface BootsDef { name: string; price: number; blurb: string; /** extra walking speed */ speed: number; color: string | null }
export const BOOTS: BootsDef[] = [
  { name: 'Bare Feet', price: 0, blurb: 'Ouch, pebbles.', speed: 0, color: null },
  { name: 'Sandals', price: 50, blurb: 'Walk 20% faster.', speed: 0.2, color: '#a8784a' },
  { name: 'Rubber Boots', price: 400, blurb: 'Walk 45% faster.', speed: 0.45, color: '#3f8a3a' },
  { name: 'Hiking Boots', price: 2500, blurb: 'Walk 75% faster.', speed: 0.75, color: '#6b4526' },
  { name: 'Seven-League Boots', price: 12000, blurb: 'Walk 110% faster.', speed: 1.1, color: '#8e44c9' },
];

export interface HolderDef { name: string; price: number; blurb: string; /** lines you fish at once */ lines: number }
/** Rod holders on the dock: each adds a line in the water. */
export const HOLDERS: HolderDef[] = [
  { name: 'One Line', price: 0, blurb: 'Just the rod in your hands.', lines: 1 },
  { name: 'Rod Holder', price: 500, blurb: 'Fish with 2 lines at once.', lines: 2 },
  { name: 'Double Holder', price: 6000, blurb: 'Fish with 3 lines at once.', lines: 3 },
  { name: 'Triple Holder', price: 35000, blurb: 'Fish with 4 lines at once.', lines: 4 },
];

export type GearKind = 'rod' | 'holders' | 'bait' | 'clothes' | 'boots';
export const GEAR: Record<GearKind, { title: string; levels: { name: string; price: number; blurb: string }[] }> = {
  rod: { title: 'Rod', levels: RODS },
  holders: { title: 'Rod Holders', levels: HOLDERS },
  bait: { title: 'Bait', levels: BAIT },
  clothes: { title: 'Clothes', levels: CLOTHES },
  boots: { title: 'Boots', levels: BOOTS },
};

// ---------- rare variants, rolled on every catch ----------

export type Variant = 'giant' | 'golden' | 'shiny';
export interface VariantDef { name: string; chance: number; /** weight multiplier (price follows weight) */ size: number; /** extra price multiplier */ value: number; color: string }
/** Checked rarest first; at most one variant per fish. */
export const VARIANTS: Record<Variant, VariantDef> = {
  shiny: { name: 'Shiny', chance: 0.003, size: 1, value: 12, color: '#e05ad0' },
  golden: { name: 'Golden', chance: 0.015, size: 1, value: 5, color: '#e0a820' },
  giant: { name: 'Giant', chance: 0.05, size: 2.5, value: 1, color: '#3f8fe0' },
};
export const VARIANT_ORDER: Variant[] = ['shiny', 'golden', 'giant'];

// ---------- skills: trained with money, level by level ----------

export type SkillId = 'fishing' | 'reflexes' | 'haggling' | 'strength';
export interface SkillDef { name: string; max: number; start: number; blurb: string; cost: (level: number) => number }
const curve = (base: number, growth: number) => (level: number) => Math.round((base * Math.pow(growth, level)) / 5) * 5;
export const SKILLS: Record<SkillId, SkillDef> = {
  fishing: { name: 'Fishing', max: 20, start: 1, blurb: 'Rarer fish bite more often.', cost: (l) => Math.round((30 * Math.pow(1.4, l - 1)) / 5) * 5 },
  reflexes: { name: 'Reflexes', max: 10, start: 0, blurb: 'More time to hit REEL!', cost: curve(40, 1.55) },
  haggling: { name: 'Haggling', max: 10, start: 0, blurb: 'Sell fish for 5% more per level.', cost: curve(60, 1.6) },
  strength: { name: 'Strength', max: 10, start: 0, blurb: 'Chance to land a fish too strong for your rod.', cost: curve(120, 1.6) },
};

export const SKILL_MAX = SKILLS.fishing.max;
/** Cost to go from fishing level `level` to `level + 1`. */
export const skillCost = SKILLS.fishing.cost;
/** Per fishing level above 1, each tier above Common gets this much more likely (multiplicative per tier step). */
export const SKILL_TIER_BONUS = 0.14;
/** Seconds of extra reel window per Reflexes level. */
export const REFLEX_PER_LEVEL = 0.06;
/** Sale price bonus per Haggling level. */
export const HAGGLE_PER_LEVEL = 0.05;
/** Chance per Strength level to land a too-strong fish instead of snapping. */
export const STRENGTH_PER_LEVEL = 0.04;

/** Chance a fish one tier above your rod bites (and snaps the line unless Strength lands it). */
export const TOO_STRONG_SHARE = 0.12;

/** Seconds to wait for a bite: random in [min, max], shortened by bait and rod. */
export const BITE_WAIT: [number, number] = [2.2, 6.5];
export const MIN_BITE_WAIT = 0.6;
/** Seconds you have to hit Reel once the bobber dips (before Reflexes). */
export const REEL_WINDOW = 0.9;

/** Dev mode: fish sell for this many times their price. */
export const DEV_MULTIPLIER = 20;

export const START_MONEY = 0;
