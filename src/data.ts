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
  { name: 'Twig Rod', tier: 1, price: 0, color: '#8a6038', blurb: 'A stick and string' },
  { name: 'Bamboo Rod', tier: 2, price: 100, color: '#c8b060', blurb: 'Lands Uncommon' },
  { name: 'Fiberglass Rod', tier: 3, price: 900, color: '#e0e0e0', blurb: 'Lands Rare' },
  { name: 'Carbon Rod', tier: 4, price: 5000, color: '#303438', blurb: 'Lands Epic' },
  { name: 'Mythril Rod', tier: 5, price: 25000, color: '#70d8e8', blurb: 'Lands Legendary' },
];

// ---------- gear: each line is bought in order, one level at a time ----------

// ---------- bait: used up, one per line per cast ----------

export type BaitId = 'worm' | 'cricket' | 'shiner' | 'leech' | 'glow' | 'gold';
/**
 * Pricier bait pulls rarer fish (`lure` is added to every tier step, like
 * Fishing levels) and bites sooner (`wait` multiplies the wait). Still a
 * roll: a Glow Lure can bring up a Minnow. Worms are free but must be found.
 */
export interface BaitDef { id: BaitId; name: string; price: number; wait: number; lure: number }
export const BAITS: BaitDef[] = [
  { id: 'worm', name: 'Ground Worm', price: 0, wait: 1, lure: 0 },
  { id: 'cricket', name: 'Cricket', price: 1, wait: 0.8, lure: 0.3 },
  { id: 'shiner', name: 'Shiner', price: 5, wait: 0.7, lure: 0.7 },
  { id: 'leech', name: 'Leech', price: 25, wait: 0.6, lure: 1.2 },
  { id: 'glow', name: 'Glow Lure', price: 150, wait: 0.5, lure: 2 },
  { id: 'gold', name: 'Golden Lure', price: 400, wait: 0.4, lure: 3.2 },
];
export const baitById = (id: BaitId): BaitDef => BAITS.find((b) => b.id === id)!;
/** Worms you start with. */
export const START_WORMS = 10;
/** Worm holes along the bank; at most MAX_GROUND_WORMS show at once, one more every WORM_SPAWN_SECONDS. */
export const WORM_SPOTS = 6;
export const MAX_GROUND_WORMS = 3;
export const WORM_SPAWN_SECONDS = 9;
/** Worms you get from one hole: random in [min, max]. */
export const WORMS_PER_PICK: [number, number] = [2, 4];

export interface ClothesDef { name: string; price: number; blurb: string; /** catches are this much heavier (and pricier) */ size: number; shirt: string; trousers: string }
export const CLOTHES: ClothesDef[] = [
  { name: 'Old T-Shirt', price: 0, blurb: 'Comfy', size: 0, shirt: '#e8d8b0', trousers: '#4a6aa0' },
  { name: 'Flannel Shirt', price: 80, blurb: 'Size +10%', size: 0.1, shirt: '#c0402c', trousers: '#3a4a6a' },
  { name: 'Rain Jacket', price: 600, blurb: 'Size +22%', size: 0.22, shirt: '#f0c020', trousers: '#3a4a6a' },
  { name: "Angler's Vest", price: 3500, blurb: 'Size +36%', size: 0.36, shirt: '#6a7a3a', trousers: '#5a4a30' },
  { name: 'Pro Waders Suit', price: 18000, blurb: 'Size +55%', size: 0.55, shirt: '#2a5a4a', trousers: '#2a5a4a' },
];

export interface BootsDef { name: string; price: number; blurb: string; /** extra walking speed */ speed: number; color: string | null }
export const BOOTS: BootsDef[] = [
  { name: 'Bare Feet', price: 0, blurb: 'Barefoot', speed: 0, color: null },
  { name: 'Sandals', price: 50, blurb: 'Speed +20%', speed: 0.2, color: '#a8784a' },
  { name: 'Rubber Boots', price: 400, blurb: 'Speed +45%', speed: 0.45, color: '#3f8a3a' },
  { name: 'Hiking Boots', price: 2500, blurb: 'Speed +75%', speed: 0.75, color: '#6b4526' },
  { name: 'Seven-League Boots', price: 12000, blurb: 'Speed +110%', speed: 1.1, color: '#8e44c9' },
];

export interface HolderDef { name: string; price: number; blurb: string; /** lines you fish at once */ lines: number }
/** Rod holders on the dock: each adds a line in the water. */
export const HOLDERS: HolderDef[] = [
  { name: 'One Line', price: 0, blurb: '1 line', lines: 1 },
  { name: 'Rod Holder', price: 500, blurb: '2 lines', lines: 2 },
  { name: 'Double Holder', price: 6000, blurb: '3 lines', lines: 3 },
  { name: 'Triple Holder', price: 35000, blurb: '4 lines', lines: 4 },
];

/**
 * Autofisher: while you stand on the dock it casts every empty line (after
 * `recast` seconds) and reels each bite after a random reaction time in
 * `react` — slower than a sharp human at first, so playing yourself pays.
 */
export interface AutoDef { name: string; price: number; blurb: string; recast: number; react: [number, number] }

export const AUTO: AutoDef[] = [
  { name: 'Manual', price: 0, blurb: 'Fish by hand', recast: Infinity, react: [0, 0] },
  { name: 'Autofisher I', price: 750, blurb: 'Fishes for you', recast: 2.5, react: [0.45, 1.2] },
  { name: 'Autofisher II', price: 5000, blurb: 'Quicker hands', recast: 1.4, react: [0.35, 0.95] },
  { name: 'Autofisher III', price: 22000, blurb: 'Rarely misses', recast: 0.7, react: [0.3, 0.75] },
  { name: 'Autofisher IV', price: 60000, blurb: 'Never sleeps', recast: 0.25, react: [0.25, 0.55] },
];

export type GearKind = 'rod' | 'holders' | 'auto' | 'clothes' | 'boots';
export const GEAR: Record<GearKind, { title: string; levels: { name: string; price: number; blurb: string }[] }> = {
  rod: { title: 'Rod', levels: RODS },
  holders: { title: 'Rod Holders', levels: HOLDERS },
  auto: { title: 'Autofisher', levels: AUTO },
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
  fishing: { name: 'Fishing', max: 25, start: 1, blurb: 'Rarer fish bite more often.', cost: (l) => Math.round((30 * Math.pow(1.4, l - 1)) / 5) * 5 },
  reflexes: { name: 'Reflexes', max: 10, start: 0, blurb: 'More time to hit REEL!', cost: curve(40, 1.55) },
  haggling: { name: 'Haggling', max: 10, start: 0, blurb: 'Sell fish for 5% more per level.', cost: curve(60, 1.6) },
  strength: { name: 'Strength', max: 10, start: 0, blurb: 'Chance to land a fish too strong for your rod.', cost: curve(120, 1.6) },
};

export const SKILL_MAX = SKILLS.fishing.max;
/** Cost to go from fishing level `level` to `level + 1`. */
export const skillCost = SKILLS.fishing.cost;
/** Per fishing level above 1, added to every tier step (with bait's lure): step^(tier-1) scales each tier's bite weight. */
export const SKILL_TIER_BONUS = 0.14;
/** Seconds of extra reel window per Reflexes level. */
export const REFLEX_PER_LEVEL = 0.06;
/** Sale price bonus per Haggling level. */
export const HAGGLE_PER_LEVEL = 0.05;
/** Chance per Strength level to land a too-strong fish instead of snapping. */
export const STRENGTH_PER_LEVEL = 0.04;

/** Fish can bite up to one tier above your rod; those bite at this fraction of their normal weight (and snap the line unless Strength lands them). */
export const TOO_STRONG_WEIGHT = 0.4;

/** Seconds to wait for a bite: random in [min, max], shortened by bait and rod. */
export const BITE_WAIT: [number, number] = [2.2, 6.5];
export const MIN_BITE_WAIT = 0.6;
/** Seconds you have to hit Reel once the bobber dips (before Reflexes). */
export const REEL_WINDOW = 0.9;

/** Dev mode: fish sell for this many times their price. */
export const DEV_MULTIPLIER = 20;

export const START_MONEY = 0;

// ---------- the Fishing Company (late game) ----------

/** Lifetime earnings that reveal the old harbor is for sale, and what it costs. */
export const COMPANY_UNLOCK_EARNED = 25000;
export const COMPANY_PRICE = 100000;
/** Cryptic letters from the harbor's owner (shown once each). The last one is the reveal. */
export const LETTERS: { at: number; text: string }[] = [
  { at: 5000, text: 'Fine catches lately. The old harbor has been quiet for years. - H.' },
  { at: 10000, text: 'I have seen you on that dock. You fish like my father did. - H.' },
  { at: 20000, text: 'I am getting too old for boats. Keep earning. We will talk. - H.' },
  { at: COMPANY_UNLOCK_EARNED, text: 'The old harbor and its boats are yours for 100,000. - H.' },
];

/** Sea fish brought in by the company's boats (sold straight from the harbor). */
export const SEA_FISH: FishDef[] = [
  { id: 'herring', name: 'Herring', tier: 1, price: 18, kg: 0.3, rarity: 1.3, colors: ['#8aa0b0', '#e8eef2', '#5a7080'], shape: 3.6 },
  { id: 'mackerel', name: 'Mackerel', tier: 1, price: 27, kg: 0.6, rarity: 1, colors: ['#3a7a8a', '#e8f0e8', '#20404a'], shape: 3.8 },
  { id: 'cod', name: 'Cod', tier: 2, price: 70, kg: 5, rarity: 1.1, colors: ['#9a8a60', '#efe6c8', '#6a5a38'], shape: 3.2 },
  { id: 'seabass', name: 'Sea Bass', tier: 2, price: 110, kg: 3, rarity: 0.8, colors: ['#7a8a94', '#e4ecf0', '#4a5a64'], shape: 2.8 },
  { id: 'halibut', name: 'Halibut', tier: 3, price: 360, kg: 20, rarity: 0.9, colors: ['#6a5a48', '#f0ece0', '#4a3a28'], shape: 2.2 },
  { id: 'tuna', name: 'Bluefin Tuna', tier: 4, price: 1500, kg: 200, rarity: 0.7, colors: ['#2a3a6a', '#d8e0ea', '#f0c030'], shape: 3.4 },
];

/** Lobster boats bring up shellfish from their traps. */
export const SHELLFISH: FishDef[] = [
  { id: 'crab', name: 'Blue Crab', tier: 1, price: 90, kg: 0.5, rarity: 1.3, colors: ['#3a6ab0', '#e8eef8', '#2a4a80'], shape: 1.6 },
  { id: 'lobster', name: 'Lobster', tier: 2, price: 300, kg: 1, rarity: 1, colors: ['#b03a2a', '#f0c0a0', '#701a10'], shape: 2.6 },
  { id: 'spiny', name: 'Spiny Lobster', tier: 3, price: 650, kg: 2, rarity: 0.9, colors: ['#c07030', '#f0d090', '#803010'], shape: 2.6 },
  { id: 'kingcrab', name: 'King Crab', tier: 4, price: 1800, kg: 5, rarity: 0.8, colors: ['#c03030', '#f0e0d0', '#801818'], shape: 1.6 },
];
/** Longliners hook the big ocean fish. */
export const BILLFISH: FishDef[] = [
  { id: 'mahi', name: 'Mahi-Mahi', tier: 1, price: 280, kg: 12, rarity: 1.2, colors: ['#40a050', '#f0e040', '#2a70c0'], shape: 3.2 },
  { id: 'sailfish', name: 'Sailfish', tier: 2, price: 840, kg: 40, rarity: 1, colors: ['#2a4a8a', '#d8e0f0', '#3a6ad0'], shape: 4.6 },
  { id: 'swordfish', name: 'Swordfish', tier: 3, price: 2200, kg: 150, rarity: 0.9, colors: ['#4a5a6a', '#d0d8e0', '#2a3a4a'], shape: 4.2 },
  { id: 'marlin', name: 'Blue Marlin', tier: 4, price: 6400, kg: 400, rarity: 0.7, colors: ['#1a3a7a', '#e0e8f0', '#2a5ab0'], shape: 4.4 },
];

/** Boat trips: base length (net boat), and what each crew member adds. */
export const TRIP_SECONDS = 90;
export const CREW_MAX = 4;
/** Each crew member: this many more fish per haul, and trips this much shorter. */
export const CREW_HAUL = 0.25;
export const CREW_SPEED = 0.1;
export const CREW_COST = [4000, 8000, 14000, 22000];
export const BOAT_PRICE = 20000;
/** Nets: fish per haul before crew. Bought in order. */
export interface GearLevel { name: string; price: number; /** catches per trip before crew */ fish: number }
export const NETS: GearLevel[] = [
  { name: 'Hand Net', price: 0, fish: 8 },
  { name: 'Drift Net', price: 15000, fish: 14 },
  { name: 'Trawl Net', price: 40000, fish: 22 },
];

/** The three kinds of boat: one of each. Each has its own gear line, trip length and catch. */
export type BoatType = 'net' | 'lobster' | 'sword';
export interface BoatDef { name: string; price: number; trip: number; gear: GearLevel[]; catch: FishDef[]; blurb: string }
export const BOATS: Record<BoatType, BoatDef> = {
  net: { name: 'Net Boat', price: 20000, trip: TRIP_SECONDS, gear: NETS, catch: SEA_FISH, blurb: 'Herring to Bluefin Tuna' },
  lobster: {
    name: 'Lobster Boat', price: 60000, trip: 150, catch: SHELLFISH, blurb: 'Crabs and lobsters',
    gear: [{ name: '10 Traps', price: 0, fish: 5 }, { name: '20 Traps', price: 35000, fish: 9 }, { name: '40 Traps', price: 90000, fish: 15 }],
  },
  sword: {
    name: 'Longliner', price: 150000, trip: 210, catch: BILLFISH, blurb: 'Swordfish and marlin',
    gear: [{ name: 'Short Line', price: 0, fish: 3 }, { name: 'Long Line', price: 70000, fish: 5 }, { name: 'Deep Line', price: 180000, fish: 8 }],
  },
};
export const BOAT_ORDER: BoatType[] = ['net', 'lobster', 'sword'];

// ---------- hired fishermen on the wide pier (open once you own a boat) ----------

export const HANDS_MAX = 4;
export const HAND_COST = [8000, 16000, 28000, 45000];
export const HAND_NAMES = ['Ada', 'Bo', 'Cy', 'Dee'];
export const HAND_OUTFITS: { shirt: string; trousers: string; boots: string }[] = [
  { shirt: '#3f8fe0', trousers: '#3a4a6a', boots: '#6b4526' },
  { shirt: '#5aa04a', trousers: '#5a4a30', boots: '#3a3a3a' },
  { shirt: '#c060c0', trousers: '#3a3a5a', boots: '#7a3020' },
  { shirt: '#e08a2a', trousers: '#2a4a3a', boots: '#4a2a1a' },
];
/** How fast hired fishermen react to a bite: random in [min, max], the max dropping per Fishing level (slow hands miss bites). */
export const HAND_REACT: [number, number] = [0.5, 1.2];
export const HAND_REACT_PER_LEVEL = 0.02;
/** Seconds a fisherman rests after each catch before casting again. */
export const HAND_REST = 2.5;
export const HAND_SKILL_MAX = 25;
/** Training a fisherman from level `l` to `l + 1`. */
export const handSkillCost = (l: number) => Math.round((60 * Math.pow(1.35, l - 1)) / 5) * 5;

// ---------- achievements (one-time cash reward, claimed in the trophy panel) ----------

/** What an achievement measures; Game.stat() computes each from saved data. */
export type AchStat = 'catches' | 'species' | 'tier' | 'giant' | 'golden' | 'shiny' | 'variants' | 'earned' | 'lines' | 'auto' | 'fishing';
export interface AchievementDef { id: string; name: string; desc: string; stat: AchStat; goal: number; reward: number }

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'catch1', name: 'First Catch', desc: 'Catch a fish', stat: 'catches', goal: 1, reward: 10 },
  { id: 'catch50', name: 'Bucket Full', desc: 'Catch 50 fish', stat: 'catches', goal: 50, reward: 150 },
  { id: 'catch250', name: 'Regular', desc: 'Catch 250 fish', stat: 'catches', goal: 250, reward: 1000 },
  { id: 'catch1000', name: 'Old Salt', desc: 'Catch 1,000 fish', stat: 'catches', goal: 1000, reward: 5000 },
  { id: 'species5', name: 'Curious', desc: 'Find 5 species', stat: 'species', goal: 5, reward: 50 },
  { id: 'species10', name: 'Naturalist', desc: 'Find 10 species', stat: 'species', goal: 10, reward: 400 },
  { id: 'species15', name: 'Collector', desc: 'Find 15 species', stat: 'species', goal: 15, reward: 2500 },
  { id: 'species20', name: 'Master Angler', desc: 'Find all 20 species', stat: 'species', goal: 20, reward: 15000 },
  { id: 'rare', name: 'Something Rare', desc: 'Catch a Rare fish', stat: 'tier', goal: 3, reward: 200 },
  { id: 'epic', name: 'Epic Pull', desc: 'Catch an Epic fish', stat: 'tier', goal: 4, reward: 1500 },
  { id: 'legend', name: 'Legend', desc: 'Catch a Legendary fish', stat: 'tier', goal: 5, reward: 8000 },
  { id: 'giant', name: 'Big One', desc: 'Catch a Giant fish', stat: 'giant', goal: 1, reward: 100 },
  { id: 'golden', name: 'Struck Gold', desc: 'Catch a Golden fish', stat: 'golden', goal: 1, reward: 500 },
  { id: 'shiny', name: 'Shiny!', desc: 'Catch a Shiny fish', stat: 'shiny', goal: 1, reward: 2500 },
  { id: 'variants15', name: 'Oddity Hunter', desc: 'Find 15 rare variants', stat: 'variants', goal: 15, reward: 4000 },
  { id: 'earn10k', name: 'Making a Living', desc: 'Earn $10,000', stat: 'earned', goal: 10000, reward: 500 },
  { id: 'earn100k', name: 'Fish Tycoon', desc: 'Earn $100,000', stat: 'earned', goal: 100000, reward: 5000 },
  { id: 'lines4', name: 'Four Lines Out', desc: 'Fish with 4 lines', stat: 'lines', goal: 4, reward: 2000 },
  { id: 'auto', name: 'Hands Free', desc: 'Buy an Autofisher', stat: 'auto', goal: 1, reward: 150 },
  { id: 'fishing10', name: 'Graduate', desc: 'Reach Fishing 10', stat: 'fishing', goal: 10, reward: 1000 },
];
