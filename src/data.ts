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
  /** Drawn as a crab, a lobster/prawn, a squid/octopus, or a billfish instead of a plain fish. */
  look?: 'crab' | 'lobster' | 'squid' | 'billed';
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
export interface BaitDef { id: BaitId; name: string; price: number; wait: number; lure: number; /** big lures attract big fish: catch weight (and price) x this */ size: number }
export const BAITS: BaitDef[] = [
  { id: 'worm', name: 'Ground Worm', price: 0, wait: 1, lure: 0, size: 1 },
  { id: 'cricket', name: 'Cricket', price: 1, wait: 0.8, lure: 0.3, size: 1 },
  { id: 'shiner', name: 'Shiner', price: 5, wait: 0.7, lure: 0.7, size: 1.05 },
  { id: 'leech', name: 'Leech', price: 25, wait: 0.6, lure: 1.2, size: 1.15 },
  { id: 'glow', name: 'Glow Lure', price: 150, wait: 0.5, lure: 2, size: 1.35 },
  { id: 'gold', name: 'Golden Lure', price: 400, wait: 0.4, lure: 3.2, size: 1.7 },
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

// ---------- gear: what you wear and fish with ----------

export type GearSlot = 'rod' | 'hat' | 'shirt' | 'pants' | 'boots';
export const GEAR_SLOTS: GearSlot[] = ['rod', 'hat', 'shirt', 'pants', 'boots'];
export type GearTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'legendary';
/** Tiers: a rod's tier is the rarest fish tier it lands (Legendary rods land everything too). */
export const GEAR_TIERS: Record<GearTier, { name: string; color: string; rank: number; fishTier: Tier }> = {
  bronze: { name: 'Bronze', color: '#b0703a', rank: 1, fishTier: 1 },
  silver: { name: 'Silver', color: '#c8ccd4', rank: 2, fishTier: 2 },
  gold: { name: 'Gold', color: '#f4b41b', rank: 3, fishTier: 3 },
  platinum: { name: 'Platinum', color: '#9fe0e8', rank: 4, fishTier: 4 },
  diamond: { name: 'Diamond', color: '#7ad8ff', rank: 5, fishTier: 5 },
  legendary: { name: 'Legendary', color: '#ff8a3a', rank: 6, fishTier: 5 },
};
export const GEAR_TIER_ORDER: GearTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'legendary'];
/** Gear stats, all percentages. */
export type StatId = 'size' | 'luck' | 'patience' | 'reflex' | 'strength' | 'fortune' | 'stride';
export const STATS: Record<StatId, { name: string; blurb: string }> = {
  size: { name: 'Size', blurb: 'Bigger fish, worth more' },
  luck: { name: 'Luck', blurb: 'Rarer fish bite more often' },
  patience: { name: 'Patience', blurb: 'Bites come sooner' },
  reflex: { name: 'Reflex', blurb: 'More time to hit REEL' },
  strength: { name: 'Strength', blurb: 'Land fish too strong for your rod' },
  fortune: { name: 'Fortune', blurb: 'Giant, Golden and Shiny more often' },
  stride: { name: 'Stride', blurb: 'Walk faster' },
};
export const STAT_ORDER: StatId[] = ['size', 'luck', 'patience', 'reflex', 'strength', 'fortune', 'stride'];
/** A piece of gear as the shop sells it. Legendary pieces (voyages only) add a unique `effect`. */
export interface GearDef {
  id: string; slot: GearSlot; tier: GearTier; name: string; stats: Partial<Record<StatId, number>>; price: number;
  /** Look: style of its slot and two colours (main, accent). */
  style: string; colors: [string, string];
  effect?: string; blurb?: string;
}
export const GEAR_ITEMS: GearDef[] = [
  // rod
  { id: 'twigrod', slot: 'rod', tier: 'bronze', name: "Twig Rod", stats: { reflex: 5, luck: 5 }, price: 0, style: 'stick', colors: ['#8a6038', '#5a3a20'] },
  { id: 'willowswitch', slot: 'rod', tier: 'bronze', name: "Willow Switch", stats: { strength: 10 }, price: 30, style: 'stick', colors: ['#a08a50', '#6a5a30'] },
  { id: 'canepole', slot: 'rod', tier: 'bronze', name: "Cane Pole", stats: { luck: 10 }, price: 50, style: 'cane', colors: ['#c8b070', '#8a6a38'] },
  { id: 'bamboorod', slot: 'rod', tier: 'silver', name: "Bamboo Rod", stats: { reflex: 10, luck: 10 }, price: 100, style: 'cane', colors: ['#c8b060', '#7a5a30'] },
  { id: 'ashrod', slot: 'rod', tier: 'silver', name: "Ash Rod", stats: { strength: 20 }, price: 150, style: 'split', colors: ['#d8c8a0', '#6b4526'] },
  { id: 'springsteelrod', slot: 'rod', tier: 'silver', name: "Spring Steel Rod", stats: { reflex: 15, strength: 5 }, price: 250, style: 'split', colors: ['#a8b0b8', '#434a5f'] },
  { id: 'fiberglassrod', slot: 'rod', tier: 'gold', name: "Fiberglass Rod", stats: { luck: 20, reflex: 15 }, price: 900, style: 'split', colors: ['#e0e0e0', '#dd442c'] },
  { id: 'heronrod', slot: 'rod', tier: 'gold', name: "Heron Rod", stats: { strength: 25, luck: 10 }, price: 1300, style: 'split', colors: ['#8a9ab0', '#f4ac66'] },
  { id: 'tidewalkerrod', slot: 'rod', tier: 'gold', name: "Tidewalker Rod", stats: { reflex: 35 }, price: 2000, style: 'carbon', colors: ['#2a8a8a', '#a0f0e0'] },
  { id: 'carbonrod', slot: 'rod', tier: 'platinum', name: "Carbon Rod", stats: { luck: 30, strength: 25 }, price: 5000, style: 'carbon', colors: ['#303438', '#2f6fd6'] },
  { id: 'stormcaller', slot: 'rod', tier: 'platinum', name: "Stormcaller", stats: { reflex: 30, luck: 25 }, price: 7000, style: 'carbon', colors: ['#4a5a7a', '#f0e040'] },
  { id: 'ironwoodrod', slot: 'rod', tier: 'platinum', name: "Ironwood Rod", stats: { strength: 55 }, price: 10000, style: 'carbon', colors: ['#5a3a2a', '#959ab1'] },
  { id: 'mythrilrod', slot: 'rod', tier: 'diamond', name: "Mythril Rod", stats: { luck: 40, reflex: 40 }, price: 25000, style: 'ornate', colors: ['#70d8e8', '#f4b41b'] },
  { id: 'starfallrod', slot: 'rod', tier: 'diamond', name: "Starfall Rod", stats: { strength: 50, luck: 30 }, price: 40000, style: 'ornate', colors: ['#2a2a5a', '#fee481'] },
  { id: 'kingfisherrod', slot: 'rod', tier: 'diamond', name: "Kingfisher Rod", stats: { reflex: 30, strength: 25, luck: 25 }, price: 60000, style: 'ornate', colors: ['#2f6fd6', '#fc683b'] },
  // hat
  { id: 'strawhat', slot: 'hat', tier: 'bronze', name: "Straw Hat", stats: { luck: 10 }, price: 50, style: 'straw', colors: ['#fee481', '#dd442c'] },
  { id: 'bandana', slot: 'hat', tier: 'bronze', name: "Bandana", stats: { reflex: 10 }, price: 80, style: 'bandana', colors: ['#dd442c', '#ffffff'] },
  { id: 'woolcap', slot: 'hat', tier: 'bronze', name: "Wool Cap", stats: { fortune: 10 }, price: 120, style: 'beanie', colors: ['#6a8aa0', '#dce1e7'] },
  { id: 'buckethat', slot: 'hat', tier: 'silver', name: "Bucket Hat", stats: { luck: 20 }, price: 400, style: 'bucket', colors: ['#6a8a50', '#3a5a28'] },
  { id: 'gullfeathercap', slot: 'hat', tier: 'silver', name: "Gull Feather Cap", stats: { luck: 12, fortune: 8 }, price: 600, style: 'cap', colors: ['#e8e8f0', '#959ab1'] },
  { id: 'sunvisor', slot: 'hat', tier: 'silver', name: "Sun Visor", stats: { reflex: 20 }, price: 900, style: 'cap', colors: ['#fc683b', '#ffffff'] },
  { id: 'captainscap', slot: 'hat', tier: 'gold', name: "Captain's Cap", stats: { luck: 20, reflex: 15 }, price: 3000, style: 'cap', colors: ['#2f6fd6', '#ffffff'] },
  { id: 'souwester', slot: 'hat', tier: 'gold', name: "Sou'wester", stats: { luck: 35 }, price: 4500, style: 'bucket', colors: ['#f0c020', '#c08010'] },
  { id: 'luckyberet', slot: 'hat', tier: 'gold', name: "Lucky Beret", stats: { fortune: 25, luck: 10 }, price: 6000, style: 'beanie', colors: ['#2eb082', '#f4b41b'] },
  { id: 'explorerhelmet', slot: 'hat', tier: 'platinum', name: "Explorer Helmet", stats: { reflex: 30, luck: 25 }, price: 15000, style: 'helmet', colors: ['#e8e0c8', '#8a6a38'] },
  { id: 'pearlheadband', slot: 'hat', tier: 'platinum', name: "Pearl Headband", stats: { fortune: 35, luck: 20 }, price: 22000, style: 'bandana', colors: ['#f0e8f0', '#9fe0e8'] },
  { id: 'owleyegoggles', slot: 'hat', tier: 'platinum', name: "Owl-Eye Goggles", stats: { reflex: 55 }, price: 30000, style: 'goggles', colors: ['#6b4526', '#434a5f'] },
  { id: 'admiralsbicorne', slot: 'hat', tier: 'diamond', name: "Admiral's Bicorne", stats: { luck: 50, reflex: 30 }, price: 60000, style: 'bicorne', colors: ['#1a2a5a', '#f4b41b'] },
  { id: 'coralcrown', slot: 'hat', tier: 'diamond', name: "Coral Crown", stats: { fortune: 50, luck: 30 }, price: 100000, style: 'crown', colors: ['#f07a90', '#fee481'] },
  { id: 'moonlithood', slot: 'hat', tier: 'diamond', name: "Moonlit Hood", stats: { luck: 30, reflex: 25, fortune: 25 }, price: 150000, style: 'hood', colors: ['#2a2a5a', '#c8d8f0'] },
  // shirt
  { id: 'oldtshirt', slot: 'shirt', tier: 'bronze', name: "Old T-Shirt", stats: { size: 10 }, price: 50, style: 'tee', colors: ['#e8d8b0', '#c0a878'] },
  { id: 'stripedtee', slot: 'shirt', tier: 'bronze', name: "Striped Tee", stats: { size: 5, patience: 5 }, price: 80, style: 'tee', colors: ['#2f6fd6', '#ffffff'] },
  { id: 'linenshirt', slot: 'shirt', tier: 'bronze', name: "Linen Shirt", stats: { strength: 10 }, price: 120, style: 'tee', colors: ['#f0ecd8', '#c8b88a'] },
  { id: 'flannelshirt', slot: 'shirt', tier: 'silver', name: "Flannel Shirt", stats: { size: 20 }, price: 400, style: 'sweater', colors: ['#c0402c', '#3a2a2a'] },
  { id: 'knitsweater', slot: 'shirt', tier: 'silver', name: "Knit Sweater", stats: { size: 12, patience: 8 }, price: 600, style: 'sweater', colors: ['#c0402c', '#fee481'] },
  { id: 'rugbyshirt', slot: 'shirt', tier: 'silver', name: "Rugby Shirt", stats: { size: 10, strength: 10 }, price: 900, style: 'tee', colors: ['#2eb082', '#ffffff'] },
  { id: 'rainjacket', slot: 'shirt', tier: 'gold', name: "Rain Jacket", stats: { size: 35 }, price: 3000, style: 'jacket', colors: ['#f0c020', '#3a4a6a'] },
  { id: 'fisherssmock', slot: 'shirt', tier: 'gold', name: "Fisher's Smock", stats: { size: 20, patience: 15 }, price: 4500, style: 'coat', colors: ['#8aa0b0', '#3a4a5a'] },
  { id: 'oilskincoat', slot: 'shirt', tier: 'gold', name: "Oilskin Coat", stats: { size: 15, strength: 20 }, price: 6000, style: 'coat', colors: ['#c09040', '#5a3a1a'] },
  { id: 'anglersvest', slot: 'shirt', tier: 'platinum', name: "Angler's Vest", stats: { size: 55 }, price: 15000, style: 'vest', colors: ['#6a7a3a', '#cb815e'] },
  { id: 'deckhandjacket', slot: 'shirt', tier: 'platinum', name: "Deckhand Jacket", stats: { size: 30, patience: 25 }, price: 22000, style: 'jacket', colors: ['#2a3a6a', '#dd442c'] },
  { id: 'stormparka', slot: 'shirt', tier: 'platinum', name: "Storm Parka", stats: { size: 30, strength: 25 }, price: 30000, style: 'jacket', colors: ['#dd442c', '#434a5f'] },
  { id: 'prowaderssuit', slot: 'shirt', tier: 'diamond', name: "Pro Waders Suit", stats: { size: 80 }, price: 60000, style: 'suit', colors: ['#2a5a4a', '#dce1e7'] },
  { id: 'silkcaptainscoat', slot: 'shirt', tier: 'diamond', name: "Silk Captain's Coat", stats: { size: 50, patience: 30 }, price: 100000, style: 'coat', colors: ['#ffffff', '#f4b41b'] },
  { id: 'leviathanhide', slot: 'shirt', tier: 'diamond', name: "Leviathan Hide", stats: { size: 40, strength: 40 }, price: 150000, style: 'jacket', colors: ['#203850', '#5a8aa0'] },
  // pants
  { id: 'rolledjeans', slot: 'pants', tier: 'bronze', name: "Rolled Jeans", stats: { patience: 10 }, price: 50, style: 'trousers', colors: ['#4a6aa0', '#2a3a5a'] },
  { id: 'cargoshorts', slot: 'pants', tier: 'bronze', name: "Cargo Shorts", stats: { fortune: 10 }, price: 80, style: 'shorts', colors: ['#c8a060', '#8a6a38'] },
  { id: 'worktrousers', slot: 'pants', tier: 'bronze', name: "Work Trousers", stats: { size: 10 }, price: 120, style: 'trousers', colors: ['#6a5a40', '#3a3020'] },
  { id: 'canvaspants', slot: 'pants', tier: 'silver', name: "Canvas Pants", stats: { patience: 20 }, price: 400, style: 'trousers', colors: ['#a89a70', '#5a4a30'] },
  { id: 'patchedoveralls', slot: 'pants', tier: 'silver', name: "Patched Overalls", stats: { patience: 10, fortune: 10 }, price: 600, style: 'overalls', colors: ['#4a6aa0', '#dd442c'] },
  { id: 'raintrousers', slot: 'pants', tier: 'silver', name: "Rain Trousers", stats: { size: 10, patience: 10 }, price: 900, style: 'trousers', colors: ['#f0c020', '#c08010'] },
  { id: 'waterproofbibs', slot: 'pants', tier: 'gold', name: "Waterproof Bibs", stats: { patience: 35 }, price: 3000, style: 'overalls', colors: ['#3a6a9a', '#f4b41b'] },
  { id: 'luckyslacks', slot: 'pants', tier: 'gold', name: "Lucky Slacks", stats: { fortune: 35 }, price: 4500, style: 'trousers', colors: ['#2eb082', '#f4b41b'] },
  { id: 'fieldpants', slot: 'pants', tier: 'gold', name: "Field Pants", stats: { patience: 20, size: 15 }, price: 6000, style: 'trousers', colors: ['#6a7a3a', '#3a4a1a'] },
  { id: 'hipwaders', slot: 'pants', tier: 'platinum', name: "Hip Waders", stats: { patience: 55 }, price: 15000, style: 'waders', colors: ['#3f6a3a', '#2a2a2a'] },
  { id: 'treasurehunterpants', slot: 'pants', tier: 'platinum', name: "Treasure Hunter Pants", stats: { fortune: 40, patience: 15 }, price: 22000, style: 'trousers', colors: ['#8a5a2a', '#f4b41b'] },
  { id: 'explorercargos', slot: 'pants', tier: 'platinum', name: "Explorer Cargos", stats: { patience: 30, fortune: 25 }, price: 30000, style: 'shorts', colors: ['#c8b080', '#6a5a30'] },
  { id: 'chestwaders', slot: 'pants', tier: 'diamond', name: "Chest Waders", stats: { patience: 80 }, price: 60000, style: 'waders', colors: ['#2a4a3a', '#1a1a1a'] },
  { id: 'gildedbreeches', slot: 'pants', tier: 'diamond', name: "Gilded Breeches", stats: { fortune: 50, size: 30 }, price: 100000, style: 'trousers', colors: ['#f4b41b', '#9f5a52'] },
  { id: 'tideweavetrousers', slot: 'pants', tier: 'diamond', name: "Tideweave Trousers", stats: { patience: 40, fortune: 40 }, price: 150000, style: 'trousers', colors: ['#2a8a9a', '#a0f0e0'] },
  // boots
  { id: 'sandals', slot: 'boots', tier: 'bronze', name: "Sandals", stats: { stride: 20 }, price: 50, style: 'sandals', colors: ['#a8784a', '#6b4526'] },
  { id: 'flipflops', slot: 'boots', tier: 'bronze', name: "Flip-Flops", stats: { stride: 10, fortune: 5 }, price: 80, style: 'sandals', colors: ['#2cc5f6', '#ffffff'] },
  { id: 'canvasshoes', slot: 'boots', tier: 'bronze', name: "Canvas Shoes", stats: { stride: 10, patience: 5 }, price: 120, style: 'shoes', colors: ['#e8e0d0', '#dd442c'] },
  { id: 'rubberboots', slot: 'boots', tier: 'silver', name: "Rubber Boots", stats: { stride: 45 }, price: 400, style: 'boots', colors: ['#3f8a3a', '#2a5a28'] },
  { id: 'deckshoes', slot: 'boots', tier: 'silver', name: "Deck Shoes", stats: { stride: 25, patience: 10 }, price: 600, style: 'shoes', colors: ['#8a5a2a', '#ffffff'] },
  { id: 'clogs', slot: 'boots', tier: 'silver', name: "Clogs", stats: { stride: 20, fortune: 10 }, price: 900, style: 'shoes', colors: ['#f0c020', '#8a6a38'] },
  { id: 'hikingboots', slot: 'boots', tier: 'gold', name: "Hiking Boots", stats: { stride: 75 }, price: 3000, style: 'boots', colors: ['#6b4526', '#dd442c'] },
  { id: 'trailrunners', slot: 'boots', tier: 'gold', name: "Trail Runners", stats: { stride: 50, patience: 10 }, price: 4500, style: 'shoes', colors: ['#fc683b', '#2a2a2a'] },
  { id: 'waderboots', slot: 'boots', tier: 'gold', name: "Wader Boots", stats: { stride: 40, size: 15 }, price: 6000, style: 'tall', colors: ['#3f5a3a', '#2a2a2a'] },
  { id: 'sealskinboots', slot: 'boots', tier: 'platinum', name: "Sealskin Boots", stats: { stride: 90, patience: 10 }, price: 15000, style: 'tall', colors: ['#8a8a9a', '#5a5a6a'] },
  { id: 'gripsoleboots', slot: 'boots', tier: 'platinum', name: "Gripsole Boots", stats: { stride: 60, fortune: 25 }, price: 22000, style: 'boots', colors: ['#5a4a3a', '#f4b41b'] },
  { id: 'riverstriderboots', slot: 'boots', tier: 'platinum', name: "Riverstrider Boots", stats: { stride: 70, patience: 20 }, price: 30000, style: 'tall', colors: ['#2a6a8a', '#a0d0f0'] },
  { id: 'sevenleagueboots', slot: 'boots', tier: 'diamond', name: "Seven-League Boots", stats: { stride: 110 }, price: 60000, style: 'tall', colors: ['#8e44c9', '#f4b41b'] },
  { id: 'windrunners', slot: 'boots', tier: 'diamond', name: "Windrunners", stats: { stride: 80, patience: 25 }, price: 100000, style: 'shoes', colors: ['#e0f0ff', '#7ad8ff'] },
  { id: 'treasuretreads', slot: 'boots', tier: 'diamond', name: "Treasure Treads", stats: { stride: 70, fortune: 40 }, price: 150000, style: 'boots', colors: ['#f4b41b', '#8a5a2a'] },
  // Legendary: voyages only
  { id: 'leviathansspine', slot: 'rod', tier: 'legendary', name: "Leviathan's Spine", stats: { strength: 80, luck: 50 }, price: 2000000, style: 'ornate', colors: ['#2a1a4a', '#ff8a3a'], effect: 'runTire', blurb: "Letting a run go tires fish 50% faster" },
  { id: 'abyssallantern', slot: 'rod', tier: 'legendary', name: "Abyssal Lantern", stats: { reflex: 60, luck: 60 }, price: 2000000, style: 'ornate', colors: ['#1a2a3a', '#f0f080'], effect: 'darkGlow', blurb: "In the Abyss the bar never goes fully dark" },
  { id: 'oldsaltscap', slot: 'hat', tier: 'legendary', name: "Old Salt's Cap", stats: { luck: 70, fortune: 40 }, price: 2000000, style: 'cap', colors: ['#3a4a6a', '#f4b41b'], effect: 'supply', blurb: "+1 supply on every voyage" },
  { id: 'crownofthedeep', slot: 'hat', tier: 'legendary', name: "Crown of the Deep", stats: { fortune: 90, luck: 40 }, price: 2000000, style: 'crown', colors: ['#f4b41b', '#2cc5f6'], effect: 'pearls', blurb: "+50% Pearls from legends" },
  { id: 'krakenhide', slot: 'shirt', tier: 'legendary', name: "Kraken Hide", stats: { size: 120 }, price: 2000000, style: 'jacket', colors: ['#7a2a5a', '#e080b0'], effect: 'hull', blurb: "+1 hull on every voyage" },
  { id: 'stormcaptainscoat', slot: 'shirt', tier: 'legendary', name: "Storm Captain's Coat", stats: { size: 80, patience: 40 }, price: 2000000, style: 'coat', colors: ['#4a2a5a', '#f4b41b'], effect: 'storm', blurb: "Storms never damage the hull" },
  { id: 'tidewalkergreaves', slot: 'pants', tier: 'legendary', name: "Tidewalker Greaves", stats: { patience: 100, fortune: 30 }, price: 2000000, style: 'waders', colors: ['#2a6a7a', '#a0f0e0'], effect: 'snag', blurb: "Snags come free 50% faster" },
  { id: 'mermaidscaletrousers', slot: 'pants', tier: 'legendary', name: "Mermaid Scale Trousers", stats: { fortune: 100 }, price: 2000000, style: 'waders', colors: ['#2cc5f6', '#f4b41b'], effect: 'wreck', blurb: "Wreck dives never damage the hull" },
  { id: 'sealegs', slot: 'boots', tier: 'legendary', name: "Sea Legs", stats: { stride: 150, patience: 30 }, price: 2000000, style: 'tall', colors: ['#1a3a5a', '#fee481'], effect: 'firstMove', blurb: "The first move of each voyage is free" },
  { id: 'ghosttreads', slot: 'boots', tier: 'legendary', name: "Ghost Treads", stats: { stride: 120, fortune: 50 }, price: 2000000, style: 'shoes', colors: ['#e0e8f0', '#7ad8ff'], effect: 'waves', blurb: "The ocean’s green band is wider" },
];
export const gearById = (id: string) => GEAR_ITEMS.find((g) => g.id === id);
/** The gear bag holds this many pieces you aren't wearing. */
export const GEAR_BAG = 24;
/** Selling pays this share of the shop price (more for better-rolled drops). */
export const GEAR_SELL = 0.4;
/** What a new run starts wearing. */
export const STARTER_GEAR: Partial<Record<GearSlot, string>> = { rod: 'twigrod', hat: 'strawhat', shirt: 'oldtshirt', pants: 'rolledjeans' };
/** Old saves: rod, clothes and boots levels become these pieces. */
export const LEGACY_GEAR = {
  rod: ['twigrod', 'bamboorod', 'fiberglassrod', 'carbonrod', 'mythrilrod'],
  clothes: ['oldtshirt', 'flannelshirt', 'rainjacket', 'anglersvest', 'prowaderssuit'],
  boots: [null, 'sandals', 'rubberboots', 'hikingboots', 'sevenleagueboots'],
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

// ---------- the fleet: boats, their upgrade tracks, fishing grounds, the harbor ----------

/** Upgrade tracks every boat has (levels 0..TRACK_MAX). */
export type TrackId = 'hull' | 'engine' | 'gear' | 'sonar' | 'ice' | 'captain';
export const TRACK_ORDER: TrackId[] = ['hull', 'engine', 'gear', 'sonar', 'ice', 'captain'];
export const TRACK_MAX = 5;
/** Level 1 costs `cost` x the boat's upgrade base; each level after costs TRACK_GROWTH times more. */
export const TRACKS: Record<TrackId, { name: string; blurb: string; cost: number }> = {
  hull: { name: 'Hull', blurb: 'Bigger hold, +1 crew, rides out storms', cost: 0.6 },
  engine: { name: 'Engine', blurb: 'Faster trips, farther grounds', cost: 0.5 },
  gear: { name: 'Gear', blurb: 'More catch per trip', cost: 0.5 },
  sonar: { name: 'Sonar', blurb: 'Finds rarer catch', cost: 0.8 },
  ice: { name: 'Ice Hold', blurb: 'Fresher catch sells for more', cost: 0.7 },
  captain: { name: 'Captain', blurb: 'Sails again by himself', cost: 1.2 },
};
export const TRACK_GROWTH = 2.5;
/** Per level: hold size, storm protection, trip speed, rarity step, sale value, captain's extra catch and storm sense. */
export const HULL_HOLD = 0.15;
export const HULL_STORM = 0.18;
export const ENGINE_SPEED = 0.08;
export const SONAR_STEP = 0.2;
export const ICE_VALUE = 0.08;
export const CAPTAIN_CATCH = 0.05;
export const CAPTAIN_STORM = 0.06;
/** A captain takes this share of every haul as wages. */
export const CAPTAIN_WAGE = 0.08;

/** Crew: CREW_BASE slots plus one per hull level. Each hand: more catch, shorter trips. */
export const CREW_BASE = 2;
export const CREW_HAUL = 0.15;
export const CREW_SPEED = 0.04;
/** Hiring the n-th deckhand (0-based) on a boat. */
export const crewCost = (boatPrice: number, n: number) => Math.round((boatPrice * 0.15 * Math.pow(1.6, n)) / 100) * 100;

/** Where a boat can go. Farther: longer, stormier, rarer and bigger catch. Needs engine / hull / sonar levels. */
export type GroundId = 'coast' | 'reef' | 'open' | 'arctic' | 'deep';
export interface GroundDef { id: GroundId; name: string; trip: number; storm: number; step: number; size: number; need: Partial<Record<TrackId, number>> }
export const GROUNDS: GroundDef[] = [
  { id: 'coast', name: 'Coast', trip: 60, storm: 0, step: 0, size: 1, need: {} },
  { id: 'reef', name: 'Reef', trip: 110, storm: 0.06, step: 0.5, size: 1.3, need: { engine: 1 } },
  { id: 'open', name: 'Open Sea', trip: 180, storm: 0.1, step: 1, size: 1.7, need: { engine: 2, hull: 1 } },
  { id: 'arctic', name: 'Arctic', trip: 270, storm: 0.16, step: 1.5, size: 2.1, need: { engine: 3, hull: 2, sonar: 1 } },
  { id: 'deep', name: 'The Deep', trip: 400, storm: 0.22, step: 2, size: 2.5, need: { engine: 4, hull: 3, sonar: 2 } },
];
/** Trip events: a storm loses part of the haul; a lucky school doubles it; a sighting (Open Sea and beyond) adds a trophy catch. */
export const STORM_LOSS = 0.5;
export const SCHOOL_CHANCE = 0.08;
export const SIGHTING_CHANCE = 0.02;

/** The three kinds of boat. Each has its own gear ladder (catches per trip, levels 0..5), trip length and catch. */
export type BoatType = 'net' | 'lobster' | 'sword';
export interface BoatDef { name: string; price: number; /** upgrade tracks are priced from this, not the boat's price */ upgrade: number; tripFactor: number; gear: number[]; gearNames: string[]; catch: FishDef[]; blurb: string }
export const BOATS: Record<BoatType, BoatDef> = {
  net: {
    name: 'Net Boat', price: 20000, upgrade: 20000, tripFactor: 1, catch: SEA_FISH, blurb: 'Herring to Bluefin Tuna',
    gear: [8, 11, 15, 19, 24, 30], gearNames: ['Hand Net', 'Drift Net', 'Trawl Net', 'Purse Seine', 'Factory Net', 'Megatrawl'],
  },
  lobster: {
    name: 'Lobster Boat', price: 60000, upgrade: 30000, tripFactor: 1.25, catch: SHELLFISH, blurb: 'Crabs and lobsters',
    gear: [5, 8, 11, 15, 20, 26], gearNames: ['10 Traps', '20 Traps', '40 Traps', '80 Traps', '160 Traps', 'Trap Fleet'],
  },
  sword: {
    name: 'Longliner', price: 150000, upgrade: 45000, tripFactor: 1.5, catch: BILLFISH, blurb: 'Swordfish and marlin',
    gear: [3, 5, 7, 9, 12, 16], gearNames: ['Short Line', 'Long Line', 'Deep Line', 'Double Line', 'Mile Line', 'Endless Line'],
  },
};
export const BOAT_ORDER: BoatType[] = ['net', 'lobster', 'sword'];
/** Selling a boat refunds this share of what went into it (boat, upgrades, crew). */
export const BOAT_RESALE = 0.5;
/** Every extra boat of the same kind costs this much more (+50%, +100%, ...). */
export const BOAT_REPEAT = 0.5;

// ---------- prestige: retire for Pearls, unlock new fish ----------

/** You can retire once a run has earned enough for one Pearl. Pearls = floor(sqrt(run earnings / PEARL_UNIT)). */
export const PEARL_UNIT = 1_000_000;
export const pearlsFor = (earned: number) => Math.floor(Math.sqrt(Math.max(0, earned) / PEARL_UNIT));

/**
 * The Fish Tree: 50 more fish, bought with Pearls, tier by tier. Each tier
 * has a river side (you and your fishermen catch them) and a sea side (a boat
 * type brings them back from a ground or deeper). Within a side: a root, two
 * branches, two tips (slot 0..4; `parent` must be owned first). A tier opens
 * once you own any fish of the tier below. New fish are worth more than the
 * old ones in their tier, so every unlock raises what that tier pays.
 */
export interface TreeFish extends FishDef {
  side: 'river' | 'sea';
  boat?: BoatType;
  ground?: GroundId;
  slot: number;
  cost: number;
  parent?: string;
}
export const TREE_FISH: TreeFish[] = [
  // Common
  { id: 'sunfish', name: 'Pumpkinseed', tier: 1, price: 20, kg: 0.3, rarity: 1.1, colors: ['#d08a30', '#f8d070', '#3a8ab0'], shape: 1.8, side: 'river', slot: 0, cost: 15 },
  { id: 'roach', name: 'Roach', tier: 1, price: 25, kg: 0.4, rarity: 1, colors: ['#8a9aa8', '#eef0f0', '#d04030'], shape: 2.8, side: 'river', slot: 1, cost: 20, parent: 'sunfish' },
  { id: 'dace', name: 'Dace', tier: 1, price: 25, kg: 0.2, rarity: 1, colors: ['#9ab0b8', '#f0f4f4', '#6a8088'], shape: 3.4, side: 'river', slot: 2, cost: 20, parent: 'sunfish' },
  { id: 'rudd', name: 'Rudd', tier: 1, price: 30, kg: 0.6, rarity: 0.9, colors: ['#b0a050', '#f4e8b0', '#e04020'], shape: 2.6, side: 'river', slot: 3, cost: 20, parent: 'roach' },
  { id: 'goldshiner', name: 'Golden Shiner', tier: 1, price: 35, kg: 0.2, rarity: 0.8, colors: ['#e0b040', '#fff0a0', '#c08020'], shape: 3.2, side: 'river', slot: 4, cost: 20, parent: 'dace' },
  { id: 'sardine', name: 'Sardine', tier: 1, price: 750, kg: 0.1, rarity: 1.2, colors: ['#6a8aa8', '#eef2f6', '#3a5a78'], shape: 3.8, side: 'sea', boat: 'net', ground: 'coast', slot: 0, cost: 15 },
  { id: 'sprat', name: 'Sprat', tier: 1, price: 800, kg: 0.1, rarity: 1.1, colors: ['#90a0a8', '#f4f6f6', '#607078'], shape: 3.6, side: 'sea', boat: 'net', ground: 'coast', slot: 1, cost: 20, parent: 'sardine' },
  { id: 'rockcrab', name: 'Rock Crab', tier: 1, price: 900, kg: 0.6, rarity: 1.1, colors: ['#a04a30', '#f0c8a8', '#702818'], shape: 1.6, look: 'crab', side: 'sea', boat: 'lobster', ground: 'coast', slot: 2, cost: 20, parent: 'sardine' },
  { id: 'prawn', name: 'Tiger Prawn', tier: 1, price: 1050, kg: 0.2, rarity: 1, colors: ['#e08050', '#ffe0c0', '#603020'], shape: 2.6, look: 'lobster', side: 'sea', boat: 'lobster', ground: 'reef', slot: 3, cost: 20, parent: 'sprat' },
  { id: 'bonito', name: 'Bonito', tier: 1, price: 1650, kg: 5, rarity: 1, colors: ['#3a5a8a', '#e8eef4', '#20304a'], shape: 3.4, side: 'sea', boat: 'sword', ground: 'reef', slot: 4, cost: 20, parent: 'rockcrab' },
  // Uncommon
  { id: 'crappie', name: 'Crappie', tier: 2, price: 75, kg: 0.8, rarity: 1.1, colors: ['#7a8a60', '#e8ecd0', '#4a5a38'], shape: 2.2, side: 'river', slot: 0, cost: 25 },
  { id: 'smallmouth', name: 'Smallmouth Bass', tier: 2, price: 85, kg: 1.5, rarity: 1, colors: ['#8a7040', '#f0e0b0', '#5a4420'], shape: 2.6, side: 'river', slot: 1, cost: 30, parent: 'crappie' },
  { id: 'chub', name: 'Chub', tier: 2, price: 95, kg: 2, rarity: 1, colors: ['#7a8890', '#e8ece8', '#c06030'], shape: 3, side: 'river', slot: 2, cost: 30, parent: 'crappie' },
  { id: 'tench', name: 'Tench', tier: 2, price: 110, kg: 2.5, rarity: 0.9, colors: ['#4a6a30', '#c0d080', '#2a4018'], shape: 2.7, side: 'river', slot: 3, cost: 35, parent: 'smallmouth' },
  { id: 'burbot', name: 'Burbot', tier: 2, price: 130, kg: 3, rarity: 0.8, colors: ['#6a6040', '#d8d0a0', '#40381e'], shape: 5, side: 'river', slot: 4, cost: 35, parent: 'chub' },
  { id: 'pollock', name: 'Pollock', tier: 2, price: 2250, kg: 4, rarity: 1.1, colors: ['#5a7068', '#e8eee8', '#384a44'], shape: 3.3, side: 'sea', boat: 'net', ground: 'reef', slot: 0, cost: 25 },
  { id: 'snapper', name: 'Red Snapper', tier: 2, price: 2400, kg: 4, rarity: 1, colors: ['#d04a40', '#ffd8c8', '#a02a20'], shape: 2.6, side: 'sea', boat: 'net', ground: 'reef', slot: 1, cost: 30, parent: 'pollock' },
  { id: 'snowcrab', name: 'Snow Crab', tier: 2, price: 2625, kg: 1, rarity: 1, colors: ['#e08a60', '#fff0e0', '#a05030'], shape: 1.6, look: 'crab', side: 'sea', boat: 'lobster', ground: 'arctic', slot: 2, cost: 30, parent: 'pollock' },
  { id: 'langoustine', name: 'Langoustine', tier: 2, price: 2875, kg: 0.3, rarity: 0.9, colors: ['#f0a090', '#fff0e8', '#c06050'], shape: 2.6, look: 'lobster', side: 'sea', boat: 'lobster', ground: 'open', slot: 3, cost: 35, parent: 'snapper' },
  { id: 'wahoo', name: 'Wahoo', tier: 2, price: 4750, kg: 25, rarity: 0.9, colors: ['#2a5a8a', '#e0eaf4', '#4a8ac0'], shape: 4.4, side: 'sea', boat: 'sword', ground: 'open', slot: 4, cost: 35, parent: 'snowcrab' },
  // Rare
  { id: 'grayling', name: 'Grayling', tier: 3, price: 250, kg: 1.5, rarity: 1.1, colors: ['#7a7a98', '#e0e0f0', '#b04a8a'], shape: 3.2, side: 'river', slot: 0, cost: 40 },
  { id: 'steelhead', name: 'Steelhead', tier: 3, price: 290, kg: 5, rarity: 1, colors: ['#7a90a0', '#f0e8f0', '#d06080'], shape: 3.3, side: 'river', slot: 1, cost: 45, parent: 'grayling' },
  { id: 'barbel', name: 'Barbel', tier: 3, price: 325, kg: 4, rarity: 1, colors: ['#9a7a48', '#f0e0c0', '#c05a30'], shape: 3.4, side: 'river', slot: 2, cost: 45, parent: 'grayling' },
  { id: 'muskie', name: 'Muskellunge', tier: 3, price: 375, kg: 12, rarity: 0.9, colors: ['#7a8a50', '#e8ecc0', '#4a5a28'], shape: 4.4, side: 'river', slot: 3, cost: 55, parent: 'steelhead' },
  { id: 'goldtrout', name: 'Golden Trout', tier: 3, price: 440, kg: 2, rarity: 0.8, colors: ['#e0a030', '#ff8060', '#a06010'], shape: 3, side: 'river', slot: 4, cost: 55, parent: 'barbel' },
  { id: 'monkfish', name: 'Monkfish', tier: 3, price: 6000, kg: 15, rarity: 1.1, colors: ['#7a6048', '#d8c0a0', '#4a3828'], shape: 2, side: 'sea', boat: 'net', ground: 'open', slot: 0, cost: 40 },
  { id: 'arcticchar', name: 'Arctic Char', tier: 3, price: 6500, kg: 6, rarity: 1, colors: ['#4a6a7a', '#f08060', '#2a4a5a'], shape: 3.2, side: 'sea', boat: 'net', ground: 'arctic', slot: 1, cost: 45, parent: 'monkfish' },
  { id: 'slipper', name: 'Slipper Lobster', tier: 3, price: 7000, kg: 1.5, rarity: 1, colors: ['#a07040', '#f0d8a8', '#604020'], shape: 2.6, look: 'lobster', side: 'sea', boat: 'lobster', ground: 'reef', slot: 2, cost: 45, parent: 'monkfish' },
  { id: 'octopus', name: 'Giant Octopus', tier: 3, price: 7750, kg: 15, rarity: 0.9, colors: ['#b04a5a', '#f0b0b8', '#702a38'], shape: 2, look: 'squid', side: 'sea', boat: 'lobster', ground: 'open', slot: 3, cost: 55, parent: 'arcticchar' },
  { id: 'yellowfin', name: 'Yellowfin Tuna', tier: 3, price: 13000, kg: 80, rarity: 0.9, colors: ['#2a3a6a', '#d8e0ea', '#f0d020'], shape: 3.4, side: 'sea', boat: 'sword', ground: 'open', slot: 4, cost: 55, parent: 'slipper' },
  // Epic
  { id: 'gar', name: 'Alligator Gar', tier: 4, price: 1125, kg: 50, rarity: 1.1, colors: ['#6a6a40', '#d8d4a0', '#3a3a1a'], shape: 5.2, side: 'river', slot: 0, cost: 65 },
  { id: 'paddlefish', name: 'Paddlefish', tier: 4, price: 1300, kg: 30, rarity: 1, colors: ['#7a8a98', '#e8eef2', '#4a5a68'], shape: 4.6, side: 'river', slot: 1, cost: 80, parent: 'gar' },
  { id: 'wels', name: 'Wels Catfish', tier: 4, price: 1500, kg: 70, rarity: 1, colors: ['#4a4a40', '#c8c0a8', '#2a2a22'], shape: 4.2, side: 'river', slot: 2, cost: 80, parent: 'gar' },
  { id: 'taimen', name: 'Taimen', tier: 4, price: 1750, kg: 25, rarity: 0.9, colors: ['#8a5040', '#f0c0a0', '#c03020'], shape: 3.8, side: 'river', slot: 3, cost: 90, parent: 'paddlefish' },
  { id: 'peacock', name: 'Peacock Bass', tier: 4, price: 2050, kg: 6, rarity: 0.8, colors: ['#c0b020', '#f0f080', '#2a8a40'], shape: 2.6, side: 'river', slot: 4, cost: 90, parent: 'wels' },
  { id: 'opah', name: 'Opah', tier: 4, price: 17500, kg: 50, rarity: 1, colors: ['#c04a50', '#f0a0a0', '#e0e0f0'], shape: 1.8, side: 'sea', boat: 'net', ground: 'open', slot: 0, cost: 65 },
  { id: 'anglerfish', name: 'Anglerfish', tier: 4, price: 18500, kg: 20, rarity: 0.9, colors: ['#3a3040', '#7a6a80', '#f0e070'], shape: 2.2, side: 'sea', boat: 'net', ground: 'deep', slot: 1, cost: 80, parent: 'opah' },
  { id: 'spidercrab', name: 'Spider Crab', tier: 4, price: 20000, kg: 15, rarity: 0.9, colors: ['#d07040', '#f8d0a8', '#904020'], shape: 1.6, look: 'crab', side: 'sea', boat: 'lobster', ground: 'deep', slot: 2, cost: 80, parent: 'opah' },
  { id: 'greenland', name: 'Greenland Shark', tier: 4, price: 36000, kg: 400, rarity: 0.9, colors: ['#5a6070', '#a8b0b8', '#3a4048'], shape: 4.6, side: 'sea', boat: 'sword', ground: 'arctic', slot: 3, cost: 90, parent: 'anglerfish' },
  { id: 'giantsquid', name: 'Giant Squid', tier: 4, price: 40000, kg: 250, rarity: 0.8, colors: ['#c05a3a', '#f0b090', '#80301a'], shape: 3, look: 'squid', side: 'sea', boat: 'sword', ground: 'deep', slot: 4, cost: 90, parent: 'spidercrab' },
  // Legendary
  { id: 'mahseer', name: 'Golden Mahseer', tier: 5, price: 8000, kg: 40, rarity: 1.2, colors: ['#e0a020', '#fff0a0', '#b06010'], shape: 3.2, side: 'river', slot: 0, cost: 110 },
  { id: 'moonsalmon', name: 'Moon Salmon', tier: 5, price: 9500, kg: 15, rarity: 1, colors: ['#c0c8e0', '#ffffff', '#8090c0'], shape: 3.1, side: 'river', slot: 1, cost: 125, parent: 'mahseer' },
  { id: 'thundersturgeon', name: 'Thunder Sturgeon', tier: 5, price: 11250, kg: 90, rarity: 0.9, colors: ['#3a4a6a', '#a0d0ff', '#f0e040'], shape: 4.6, side: 'river', slot: 2, cost: 125, parent: 'mahseer' },
  { id: 'spiritkoi', name: 'Spirit Koi', tier: 5, price: 13000, kg: 10, rarity: 0.8, colors: ['#f0f0ff', '#a0f0ff', '#60a0ff'], shape: 2.8, side: 'river', slot: 3, cost: 150, parent: 'moonsalmon' },
  { id: 'rivergod', name: 'River God', tier: 5, price: 17500, kg: 200, rarity: 0.5, colors: ['#1a5a4a', '#80e0b0', '#f0c040'], shape: 5, side: 'river', slot: 4, cost: 150, parent: 'thundersturgeon' },
  { id: 'goldbluefin', name: 'Golden Bluefin', tier: 5, price: 22500, kg: 300, rarity: 0.4, colors: ['#e0a020', '#fff0b0', '#b07010'], shape: 3.4, side: 'sea', boat: 'net', ground: 'open', slot: 0, cost: 110 },
  { id: 'crystalcrab', name: 'Crystal King Crab', tier: 5, price: 32500, kg: 8, rarity: 0.36, colors: ['#80e0f0', '#e0ffff', '#40a0c0'], shape: 1.6, look: 'crab', side: 'sea', boat: 'lobster', ground: 'arctic', slot: 1, cost: 125, parent: 'goldbluefin' },
  { id: 'abyssallobster', name: 'Abyssal Lobster', tier: 5, price: 27500, kg: 4, rarity: 0.36, colors: ['#40306a', '#a090d0', '#201848'], shape: 2.6, look: 'lobster', side: 'sea', boat: 'lobster', ground: 'deep', slot: 2, cost: 125, parent: 'goldbluefin' },
  { id: 'megalodon', name: 'Megalodon', tier: 5, price: 62500, kg: 2000, rarity: 0.28, colors: ['#4a5a6a', '#d0d8e0', '#2a3440'], shape: 4, side: 'sea', boat: 'sword', ground: 'deep', slot: 3, cost: 150, parent: 'crystalcrab' },
  { id: 'kraken', name: 'Kraken', tier: 5, price: 80000, kg: 1500, rarity: 0.2, colors: ['#7a2a5a', '#e080b0', '#400a30'], shape: 3, look: 'squid', side: 'sea', boat: 'sword', ground: 'deep', slot: 4, cost: 150, parent: 'abyssallobster' },
];
export const treeFishById = (id: string) => TREE_FISH.find((f) => f.id === id);

// ---------- expeditions (phase 3): the lighthouse on the far bank, big-fish fights ----------

/**
 * Fight tuning (see fight.ts). Tension per second: +reelTension + pull x
 * pullOnReel while holding, pull - ease when not. The reel spins up over
 * spinUp seconds of holding and stops over spinDown; stamina drained per
 * second while reeling in the green: reel x spin / fish.stamina (taps barely
 * tire it). In a surge (a run): holding adds runHold + pull x surgePower
 * (snaps fast, even tapping); letting go eases tension by runEase and the
 * fish tires itself by runTire of its stamina a second.
 */
export const FIGHT = {
  reel: 9,
  reelTension: 0.3,
  pullOnReel: 0.5,
  ease: 0.45,
  spinUp: 0.6,
  spinDown: 0.2,
  runHold: 1.1,
  runEase: 0.15,
  runTire: 0.04,
  /** Snags: one every snagEvery s of calm; reeling frees snagFree a second (x reel spin); letting go wears snagWear a second. */
  snagEvery: [7, 12] as [number, number],
  snagFree: 0.55,
  snagWear: 0.35,
  /** On a snag, tension climbs this much a second while reeling and eases this much when you let go. */
  snagReel: 0.15,
  snagEase: 0.2,
  /** Waves: the green band slides +-waveAmp and narrows by up to waveNarrow. */
  waveSpeed: 0.9,
  waveAmp: 0.12,
  waveNarrow: 0.12,
  waveRough: 0.23,
  /** Darkness: the lure lights the bar for flashLen s every flashEvery s. */
  flashEvery: [2.2, 3.5] as [number, number],
  flashLen: 0.7,
  /** The green band of tension; below `slack` the line is loose; at 1 it snaps. */
  green: [0.35, 0.8] as [number, number],
  slack: 0.08,
  /** Seconds of slack line before the fish spits the hook. */
  spit: 2,
  /** Seconds of warning before a surge, and a surge's length. */
  warning: 0.7,
  surgeLen: 1.5,
};

/** Where a legend lives: its region decides the twist in its fight. */
export type Region = 'coast' | 'ocean' | 'abyss';
export const REGIONS: Record<Region, { name: string; twist: string }> = {
  coast: { name: 'Coast', twist: 'Snags: reel to pull the line free' },
  ocean: { name: 'Open Ocean', twist: 'Waves: the green moves with the swell' },
  abyss: { name: 'The Abyss', twist: 'Darkness: the bar shows only when the lure flashes' },
};

/** A legendary you fight on an expedition: its region and fight twists, how much fight it has, how hard it pulls, how often and how hard it runs. */
export interface LegendDef extends FishDef { spot: string; region: Region; twists: ('snag' | 'waves' | 'dark')[]; stamina: number; pull: number; surgePower: number; surgeEvery: number; blurb: string }
export const LEGENDS: LegendDef[] = [
  { id: 'kelpwyrm', spot: 'Kelp Forest', name: 'Kelp Wyrm', region: 'coast', twists: ['snag'], tier: 5, price: 20000000, kg: 90, rarity: 1, colors: ['#3a7a3a', '#a8e080', '#f0c040'], shape: 6.5, stamina: 50, pull: 0.12, surgePower: 2.6, surgeEvery: 5, blurb: 'Lazy, but it thrashes' },
  { id: 'coralcolossus', spot: 'Reef Wall', name: 'Coral Colossus', region: 'coast', twists: ['snag'], tier: 5, price: 25000000, kg: 400, rarity: 1, colors: ['#c05a40', '#f0c0a0', '#f07a90'], shape: 2.4, stamina: 70, pull: 0.14, surgePower: 2.4, surgeEvery: 6, blurb: 'Heavy, slow runs' },
  { id: 'tideserpent', spot: 'Tidal Caves', name: 'Tide Serpent', region: 'coast', twists: ['snag'], tier: 5, price: 30000000, kg: 250, rarity: 1, colors: ['#2a8a8a', '#a0f0e0', '#1a5a6a'], shape: 7, stamina: 60, pull: 0.16, surgePower: 2.6, surgeEvery: 3.5, blurb: 'Quick, frequent runs' },
  { id: 'sunking', spot: 'Sunbeam Shallows', name: 'Sun King', region: 'coast', twists: ['snag'], tier: 5, price: 35000000, kg: 1200, rarity: 1, colors: ['#e0b020', '#fff0a0', '#e07020'], shape: 1.3, stamina: 80, pull: 0.12, surgePower: 3.2, surgeEvery: 7, blurb: 'Gentle, then one huge run' },
  { id: 'ghostmarlin', spot: 'Blue Expanse', name: 'Ghost Marlin', region: 'ocean', twists: ['waves'], tier: 5, price: 60000000, kg: 500, rarity: 1, colors: ['#c8d8f0', '#ffffff', '#8098c8'], shape: 4.4, look: 'billed', stamina: 80, pull: 0.2, surgePower: 3, surgeEvery: 4, blurb: 'Fast and proud' },
  { id: 'stormshark', spot: 'Storm Belt', name: 'Storm Shark', region: 'ocean', twists: ['waves'], tier: 5, price: 70000000, kg: 800, rarity: 1, colors: ['#5a6a80', '#d0d8e0', '#f0e040'], shape: 4, stamina: 95, pull: 0.24, surgePower: 2.6, surgeEvery: 4, blurb: 'Relentless pull' },
  { id: 'glacierhalibut', spot: 'Iceberg Field', name: 'Glacier Halibut', region: 'ocean', twists: ['waves'], tier: 5, price: 80000000, kg: 600, rarity: 1, colors: ['#a0c0d8', '#f0f8ff', '#6080a0'], shape: 2, stamina: 130, pull: 0.18, surgePower: 2.4, surgeEvery: 5, blurb: 'Huge, very long fight' },
  { id: 'thundertuna', spot: 'Lightning Banks', name: 'Thunder Tuna', region: 'ocean', twists: ['waves'], tier: 5, price: 90000000, kg: 700, rarity: 1, colors: ['#2a3a7a', '#e0e8f0', '#f0d020'], shape: 3.2, stamina: 85, pull: 0.22, surgePower: 3.4, surgeEvery: 3, blurb: 'Short, violent runs' },
  { id: 'abyssking', spot: 'The Trench', name: 'Abyss King', region: 'abyss', twists: ['dark'], tier: 5, price: 150000000, kg: 3000, rarity: 1, colors: ['#2a1a4a', '#8060c0', '#f04080'], shape: 3.6, stamina: 100, pull: 0.28, surgePower: 2.3, surgeEvery: 3, blurb: 'It does not tire' },
  { id: 'lanternqueen', spot: 'Lantern Depths', name: 'Lantern Queen', region: 'abyss', twists: ['dark'], tier: 5, price: 180000000, kg: 900, rarity: 1, colors: ['#2a2a3a', '#5a5a7a', '#f0f080'], shape: 2, stamina: 110, pull: 0.26, surgePower: 2.6, surgeEvery: 3.5, blurb: 'Lures you in, then bolts' },
  { id: 'boneeel', spot: 'Ghost Wreck', name: 'Bone Eel', region: 'abyss', twists: ['dark'], tier: 5, price: 220000000, kg: 350, rarity: 1, colors: ['#d8d0c0', '#ffffff', '#8a8070'], shape: 7.5, stamina: 120, pull: 0.3, surgePower: 2.4, surgeEvery: 2.8, blurb: 'Twisting, unpredictable' },
  { id: 'theoldone', spot: 'The Maw', name: 'The Old One', region: 'abyss', twists: ['snag', 'waves', 'dark'], tier: 5, price: 400000000, kg: 8000, rarity: 1, colors: ['#1a2a2a', '#4a7a6a', '#c0f0a0'], shape: 4.6, stamina: 180, pull: 0.3, surgePower: 2.8, surgeEvery: 3, blurb: 'The deepest legend. Every twist at once' },
];

/**
 * The Exotic Market (the jetty by the lighthouse): expedition fish wait in the
 * hold, go up for offers (a few listing slots; collectors bid every so often,
 * each bid lasts a while, bids creep up the longer a fish is listed) or go to
 * a collector's WANTED notice (pays about double, for a fish of a given size).
 * A fish's value = its legend's price x its weight / the legend's usual weight.
 */
export const EXOTIC = {
  hold: 6,
  slots: 3,
  offerEvery: [15, 40] as [number, number],
  offerLife: [60, 150] as [number, number],
  /** An offer is the fish's value x a random factor in this range, plus offerTrend for every minute it has been listed. */
  offerRange: [0.7, 1.4] as [number, number],
  offerTrend: 0.04,
  maxOffers: 4,
  wanted: 3,
  wantedEvery: 300,
  wantedLife: [600, 1200] as [number, number],
  wantedPay: [1.7, 2.4] as [number, number],
};
export const COLLECTORS = ['Baron Gill', 'Madame Koi', 'Old Moss', 'Captain Reyes', 'The Countess', 'Dr. Finley', 'Lady Marlowe', 'Mr. Tanaka'];

/**
 * Voyages: the Flagship (bought at the lighthouse) sails a small map to a
 * legend. Supplies (one per move) and hull (lose it and the haul is lost);
 * fishing grounds and treasure pay by region; Pearls per legend landed; the
 * Flagship rests between voyages (dev mode skips the rest).
 */
export const VOYAGE = {
  flagship: 10_000_000,
  rest: 1200,
  supplies: 5,
  hull: 3,
  haul: { coast: 1_500_000, ocean: 4_000_000, abyss: 10_000_000 } as Record<Region, number>,
  pearls: { coast: 3, ocean: 6, abyss: 12, old: 40 },
};

/** The harbor: berths (how many boats), automation, and the warehouse (offline earnings cap). */
export const BERTHS: { boats: number; price: number }[] = [
  { boats: 3, price: 0 }, { boats: 4, price: 150000 }, { boats: 5, price: 400000 }, { boats: 6, price: 1000000 }, { boats: 8, price: 2500000 },
];
/** Staff you hire. The Harbor Master works the boats; the rest work the pier. */
export type HarborUpgradeId = 'master' | 'manager' | 'supplier' | 'seller';
export const HARBOR_UPGRADES: Record<HarborUpgradeId, { name: string; price: number; blurb: string; fee: number; feeName: string }> = {
  master: { name: 'Harbor Master', price: 200000, blurb: 'Sells hauls as boats come in', fee: 0.05, feeName: 'fee' },
  manager: { name: 'Manager', price: 150000, blurb: 'Best bait for each, trains them', fee: 0.03, feeName: 'of crate' },
  supplier: { name: 'Bait Supplier', price: 120000, blurb: 'Keeps every fisherman in bait', fee: 0.25, feeName: 'markup' },
  seller: { name: 'Fish Seller', price: 80000, blurb: 'Sells your bag and the crate', fee: 0.05, feeName: 'fee' },
};
export const PIER_STAFF: HarborUpgradeId[] = ['manager', 'supplier', 'seller'];
/** The Fish Seller sells your bag once it holds this many fish. */
export const SELLER_BAG = 20;
/** How much of your money the Manager may spend on one upgrade (choices in the pier staff panel). */
export const MANAGER_BUDGETS = [0, 0.05, 0.1, 0.25];
export const WAREHOUSE: { hours: number; price: number }[] = [
  { hours: 1, price: 0 }, { hours: 2, price: 100000 }, { hours: 4, price: 300000 }, { hours: 8, price: 900000 },
];

// ---------- hired fishermen on the wide pier (open once you own a boat) ----------

/** The pier grows in sections of 4 spots (first section free with your first boat), up to 24 fishermen. */
export const PIER_SPOTS = 4;
export const PIER_SECTIONS: number[] = [0, 60000, 150000, 400000, 1000000, 2500000];
export const HANDS_MAX = PIER_SPOTS * PIER_SECTIONS.length;
/** Hiring the n-th fisherman (0-based). */
export const handCost = (n: number) => Math.round((8000 * Math.pow(1.3, n)) / 1000) * 1000;
export const HAND_NAMES = [
  'Ada', 'Bo', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo', 'Kit', 'Lou',
  'Max', 'Nell', 'Otto', 'Pip', 'Quin', 'Ray', 'Sue', 'Tam', 'Uma', 'Vic', 'Wes', 'Zoe',
];
const SHIRTS = ['#3f8fe0', '#5aa04a', '#c060c0', '#e08a2a', '#d84a4a', '#40b0b0', '#e0c040', '#8a6ad0'];
const TROUSERS = ['#3a4a6a', '#5a4a30', '#2a4a3a'];
const BOOTS_COL = ['#6b4526', '#3a3a3a', '#7a3020'];
export const HAND_OUTFITS: { shirt: string; trousers: string; boots: string }[] = HAND_NAMES.map((_, i) => ({
  shirt: SHIRTS[i % 8]!, trousers: TROUSERS[Math.floor(i / 8) % 3]!, boots: BOOTS_COL[i % 3]!,
}));
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
export type AchStat = 'catches' | 'species' | 'tier' | 'giant' | 'golden' | 'shiny' | 'variants' | 'earned' | 'lines' | 'auto' | 'fishing'
  | 'treeUnlocked' | 'treeTiers' | 'treeRiver' | 'treeSea' | 'treeRiverTier' | 'treeSeaTier' | 'retired';
/** `page`: the trophy tab it sits on (the originals, or the Fish Tree's). */
export interface AchievementDef { id: string; name: string; desc: string; stat: AchStat; goal: number; reward: number; page?: 'tree' }

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
  // The Fish Tree's own page.
  { id: 'tree1', name: 'New Waters', desc: 'Unlock a tree fish', stat: 'treeUnlocked', goal: 1, reward: 5000, page: 'tree' },
  { id: 'tree10', name: 'Pearl Diver', desc: 'Unlock 10 tree fish', stat: 'treeUnlocked', goal: 10, reward: 100000, page: 'tree' },
  { id: 'tree25', name: 'Half the Map', desc: 'Unlock 25 tree fish', stat: 'treeUnlocked', goal: 25, reward: 2000000, page: 'tree' },
  { id: 'tree50', name: 'Every Fish There Is', desc: 'Unlock all 50 tree fish', stat: 'treeUnlocked', goal: 50, reward: 50000000, page: 'tree' },
  { id: 'tiers1', name: 'Tier Complete', desc: 'Unlock a whole tier', stat: 'treeTiers', goal: 1, reward: 50000, page: 'tree' },
  { id: 'tiers3', name: 'Three Tiers Deep', desc: 'Unlock 3 whole tiers', stat: 'treeTiers', goal: 3, reward: 1000000, page: 'tree' },
  { id: 'tiers5', name: 'The Whole Tree', desc: 'Unlock all 5 tiers', stat: 'treeTiers', goal: 5, reward: 25000000, page: 'tree' },
  { id: 'river1', name: 'A New Kind', desc: 'Catch a tree river fish', stat: 'treeRiver', goal: 1, reward: 2000, page: 'tree' },
  { id: 'river10', name: 'River Regular', desc: 'Catch 10 tree river fish', stat: 'treeRiver', goal: 10, reward: 200000, page: 'tree' },
  { id: 'river25', name: 'River Scholar', desc: 'Catch all 25 tree river fish', stat: 'treeRiver', goal: 25, reward: 10000000, page: 'tree' },
  { id: 'riverEpic', name: 'River Monster', desc: 'Catch an Epic tree river fish', stat: 'treeRiverTier', goal: 4, reward: 300000, page: 'tree' },
  { id: 'riverLegend', name: 'River God', desc: 'Catch a Legendary tree river fish', stat: 'treeRiverTier', goal: 5, reward: 5000000, page: 'tree' },
  { id: 'sea1', name: 'Strange Nets', desc: 'Boats land a tree sea fish', stat: 'treeSea', goal: 1, reward: 10000, page: 'tree' },
  { id: 'sea10', name: 'Deep Catalogue', desc: 'Boats land 10 tree sea fish', stat: 'treeSea', goal: 10, reward: 500000, page: 'tree' },
  { id: 'sea25', name: 'Ocean Scholar', desc: 'Boats land all 25 tree sea fish', stat: 'treeSea', goal: 25, reward: 20000000, page: 'tree' },
  { id: 'seaEpic', name: 'Sea Monster', desc: 'Boats land an Epic tree sea fish', stat: 'treeSeaTier', goal: 4, reward: 500000, page: 'tree' },
  { id: 'seaLegend', name: 'Kraken!', desc: 'Boats land a Legendary sea fish', stat: 'treeSeaTier', goal: 5, reward: 8000000, page: 'tree' },
  { id: 'retire1', name: 'Passing the Rod', desc: 'Retire once', stat: 'retired', goal: 1, reward: 25000, page: 'tree' },
  { id: 'retire3', name: 'Family Business', desc: 'Retire 3 times', stat: 'retired', goal: 3, reward: 500000, page: 'tree' },
  { id: 'retire10', name: 'Dynasty', desc: 'Retire 10 times', stat: 'retired', goal: 10, reward: 10000000, page: 'tree' },
];
