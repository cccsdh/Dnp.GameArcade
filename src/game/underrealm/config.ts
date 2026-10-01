/**
 * The Underrealm: a first-person dungeon adventure in the spirit of the 1980s
 * Alternate Reality games - six rolled stats, a haggling marketplace, food,
 * water and torches to manage, turn-based encounters and a crystal to bring
 * back from the deepest level.
 */

export type StatId = 'STA' | 'CHR' | 'STR' | 'INT' | 'WIS' | 'SKL';
export const STATS: StatId[] = ['STA', 'CHR', 'STR', 'INT', 'WIS', 'SKL'];

export const STAT_HELP: Record<StatId, string> = {
  STA: 'Stamina - hit points',
  CHR: 'Charisma - prices and bribes',
  STR: 'Strength - damage',
  INT: 'Intelligence - tricks and spell power',
  WIS: 'Wisdom - mana and healing',
  SKL: 'Skill - hitting and dodging',
};

export interface WeaponDef {
  id: string;
  name: string;
  min: number;
  max: number;
  price: number;
  /** Strength needed to wield it well (below this, -2 damage). */
  str: number;
}

export interface ArmorDef {
  id: string;
  name: string;
  ac: number;
  price: number;
}

export const WEAPONS: WeaponDef[] = [
  { id: 'fists', name: 'Bare Fists', min: 1, max: 3, price: 0, str: 0 },
  { id: 'dagger', name: 'Dagger', min: 2, max: 5, price: 25, str: 0 },
  { id: 'shortsword', name: 'Short Sword', min: 3, max: 8, price: 80, str: 8 },
  { id: 'mace', name: 'Iron Mace', min: 4, max: 9, price: 140, str: 10 },
  { id: 'broadsword', name: 'Broadsword', min: 5, max: 12, price: 260, str: 12 },
  { id: 'axe', name: 'Battle Axe', min: 6, max: 15, price: 420, str: 14 },
  { id: 'runeblade', name: 'Rune Blade', min: 9, max: 18, price: 1200, str: 10 },
];

export const ARMORS: ArmorDef[] = [
  { id: 'cloth', name: 'Cloth Tunic', ac: 0, price: 0 },
  { id: 'leather', name: 'Leather Armor', ac: 2, price: 60 },
  { id: 'chain', name: 'Chain Mail', ac: 4, price: 220 },
  { id: 'plate', name: 'Plate Armor', ac: 6, price: 520 },
  { id: 'mithril', name: 'Mithril Coat', ac: 8, price: 1500 },
];

export type SpellId = 'firebolt' | 'mend' | 'blink';

export const SPELLS: Record<SpellId, { name: string; cost: number; price: number; blurb: string }> = {
  firebolt: { name: 'Firebolt', cost: 3, price: 150, blurb: 'hurls fire (INT adds damage)' },
  mend: { name: 'Mend', cost: 3, price: 120, blurb: 'heals wounds (WIS adds healing)' },
  blink: { name: 'Blink', cost: 2, price: 90, blurb: 'vanish from a fight' },
};

export interface MonsterDef {
  id: string;
  name: string;
  /** Dungeon depths it wanders (it gets tougher below its shallowest one). */
  levels: number[];
  hp: [number, number];
  dmg: [number, number];
  /** Added to its chance to hit you. */
  hit: number;
  /** Armor: subtracted from your chance to hit it. */
  def: number;
  xp: number;
  gold: [number, number];
  /** How easily it falls for a trick (0-1). */
  gullible: number;
  /** Will it take a bribe? Base gold it wants (0 = never). */
  bribe: number;
  special?: 'poison' | 'steal' | 'regen' | 'drain' | 'boss' | 'friendly';
  intro: string;
  /** Bosses: damage of the bolt hurled every third round (default 8-16; [0, 0] = none) and how it's described. */
  bolt?: [number, number];
  boltText?: string;
}

export const MONSTERS: MonsterDef[] = [
  { id: 'rat', name: 'Giant Rat', levels: [1, 2], hp: [4, 7], dmg: [1, 3], hit: 0, def: 0, xp: 6, gold: [0, 2], gullible: 0.6, bribe: 0, intro: 'A giant rat scurries out of the dark!' },
  { id: 'bat', name: 'Cave Bat', levels: [1, 2, 3], hp: [3, 6], dmg: [1, 2], hit: 5, def: 3, xp: 6, gold: [0, 0], gullible: 0.5, bribe: 0, intro: 'A cave bat swoops at your torch!' },
  { id: 'slime', name: 'Green Slime', levels: [1, 2, 3], hp: [8, 12], dmg: [1, 4], hit: -5, def: 0, xp: 10, gold: [0, 6], gullible: 0.2, bribe: 0, intro: 'A green slime oozes across the floor.' },
  { id: 'goblin', name: 'Goblin Thief', levels: [2, 3, 4], hp: [7, 11], dmg: [2, 5], hit: 5, def: 1, xp: 14, gold: [4, 18], gullible: 0.4, bribe: 15, special: 'steal', intro: 'A goblin thief eyes your purse.' },
  { id: 'skeleton', name: 'Skeleton', levels: [2, 3, 4, 5], hp: [10, 14], dmg: [2, 6], hit: 5, def: 2, xp: 18, gold: [2, 10], gullible: 0.3, bribe: 0, intro: 'A skeleton clatters toward you!' },
  { id: 'peddler', name: 'Wandering Peddler', levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], hp: [12, 12], dmg: [1, 2], hit: 0, def: 1, xp: 0, gold: [0, 0], gullible: 0, bribe: 0, special: 'friendly', intro: 'A hooded peddler waves from the gloom.' },
  { id: 'orc', name: 'Orc Brute', levels: [3, 4, 5, 6], hp: [16, 22], dmg: [3, 8], hit: 8, def: 3, xp: 32, gold: [8, 30], gullible: 0.35, bribe: 40, intro: 'An orc brute bellows a challenge!' },
  { id: 'spider', name: 'Giant Spider', levels: [4, 5, 6, 7], hp: [14, 18], dmg: [2, 6], hit: 10, def: 2, xp: 30, gold: [0, 12], gullible: 0.3, bribe: 0, special: 'poison', intro: 'A giant spider drops from the ceiling!' },
  { id: 'zombie', name: 'Zombie', levels: [4, 5, 6], hp: [20, 26], dmg: [3, 7], hit: 0, def: 1, xp: 30, gold: [2, 16], gullible: 0.7, bribe: 0, intro: 'A zombie shambles out of a side passage.' },
  { id: 'ghost', name: 'Ghost', levels: [5, 6, 7, 8], hp: [12, 16], dmg: [2, 6], hit: 8, def: 6, xp: 38, gold: [0, 0], gullible: 0.4, bribe: 0, special: 'drain', intro: 'A cold ghost drifts through the wall...' },
  { id: 'knight', name: 'Dark Knight', levels: [6, 7, 8, 9], hp: [22, 30], dmg: [4, 10], hit: 12, def: 5, xp: 55, gold: [20, 60], gullible: 0.2, bribe: 90, intro: 'A dark knight lowers its visor.' },
  { id: 'troll', name: 'Cave Troll', levels: [7, 8, 9, 10], hp: [30, 40], dmg: [5, 12], hit: 10, def: 4, xp: 80, gold: [10, 50], gullible: 0.5, bribe: 70, special: 'regen', intro: 'A cave troll blocks the passage!' },
  { id: 'imp', name: 'Fire Imp', levels: [7, 8, 9, 10], hp: [14, 20], dmg: [4, 9], hit: 14, def: 5, xp: 60, gold: [5, 40], gullible: 0.45, bribe: 50, intro: 'A fire imp cackles and sparks fly!' },
  { id: 'wraith', name: 'Wraith', levels: [8, 9, 10, 11], hp: [24, 30], dmg: [4, 10], hit: 12, def: 6, xp: 75, gold: [0, 20], gullible: 0.3, bribe: 0, special: 'drain', intro: 'A wraith rises, eyes burning.' },
  { id: 'minotaur', name: 'Minotaur', levels: [8, 9, 10, 11], hp: [36, 46], dmg: [6, 14], hit: 12, def: 4, xp: 100, gold: [20, 70], gullible: 0.25, bribe: 120, intro: 'A minotaur paws the ground and charges!' },
  { id: 'lich', name: 'The Lich King', levels: [], hp: [120, 120], dmg: [8, 18], hit: 20, def: 7, xp: 900, gold: [500, 500], gullible: 0.05, bribe: 0, special: 'boss', intro: 'The Lich King rises from his throne!' },
];

export function monsterDef(id: string): MonsterDef {
  return MONSTERS.find((m) => m.id === id)!;
}

/** XP needed to train for each level (index = level to reach - 1). */
export const LEVEL_XP = [0, 60, 150, 300, 520, 820, 1200, 1700, 2300, 3000, 3900, 5000, 6300, 7800, 9500];
export const MAX_LEVEL = LEVEL_XP.length;

export const PRICES = {
  food: 3,
  water: 2,
  torch: 6,
  potion: 30,
  ale: 2,
  room: 10,
  heal: 2, // per hit point
  cure: 25,
  blessing: 60,
  train: 50, // x level
};

/** Steps between eating / drinking, and how long a torch burns (in steps). */
export const HUNGER_STEPS = 45;
export const THIRST_STEPS = 35;
export const TORCH_STEPS = 260;

export function rollStat(rng = Math.random): number {
  let s = 2;
  for (let i = 0; i < 4; i++) s += 1 + Math.floor(rng() * 4);
  return s; // 6..18
}
