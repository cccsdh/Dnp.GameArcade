import { ARMORS, LEVEL_XP, SPELLS, STATS, TORCH_STEPS, WEAPONS, rollStat, type SpellId, type StatId } from './config';
import type { DungeonPack } from './pack';
import type { Dir } from './world';

/** Everything about the adventurer (and their progress through the world) - this is the save game. */
export interface Hero {
  stats: Record<StatId, number>;
  level: number;
  xp: number;
  hp: number;
  mana: number;
  gold: number;
  food: number;
  water: number;
  torches: number;
  /** Steps left on the lit torch (0 = no torch burning). */
  torchLeft: number;
  potions: number;
  keys: number;
  weapon: string;
  armor: string;
  spells: SpellId[];
  poisoned: boolean;
  /** Steps of the temple's blessing remaining (+SKL). */
  blessed: number;
  crystal: boolean;
  bossDead: boolean;
  /** Minutes since the adventure began (day 1, 08:00). */
  minutes: number;
  steps: number;
  hunger: number;
  thirst: number;
  pos: { level: number; x: number; y: number; dir: Dir };
  seed: number;
  /** Per level: explored tile keys ("x,y"). */
  explored: Record<number, string[]>;
  /** Per level: doors opened / chests looted ("x,y"). */
  opened: Record<number, string[]>;
  looted: Record<number, string[]>;
  kills: number;
  /** The adventure (dungeon pack) being explored - '' while in the Hall of Adventurers. */
  packId: string;
  /** Adventures this hero has escaped from (pack ids). */
  completed?: string[];
  /** Per level: hidden exits / secret passages found ("x,y"). */
  revealed?: Record<number, string[]>;
  /** Per level: guardians and bosses defeated ("x,y"). */
  slain?: Record<number, string[]>;
}

export function rollStats(): Record<StatId, number> {
  const out = {} as Record<StatId, number>;
  for (const s of STATS) out[s] = rollStat();
  return out;
}

export function newHero(stats: Record<StatId, number>, pack?: DungeonPack): Hero {
  const kit = pack?.start ?? {};
  const h: Hero = {
    stats,
    level: 1,
    xp: 0,
    hp: 1,
    mana: 0,
    gold: kit.gold ?? 60 + stats.CHR * 3,
    food: kit.food ?? 3,
    water: kit.water ?? 3,
    torches: kit.torches ?? 2,
    torchLeft: TORCH_STEPS,
    potions: kit.potions ?? 1,
    keys: 0,
    weapon: kit.weapon ?? 'dagger',
    armor: kit.armor ?? 'cloth',
    spells: [],
    poisoned: false,
    blessed: 0,
    crystal: false,
    bossDead: false,
    minutes: 8 * 60,
    steps: 0,
    hunger: 0,
    thirst: 0,
    // level 0 = not yet inside an adventure; the game places the hero at its entrance.
    pos: { level: 0, x: 0, y: 0, dir: 2 },
    seed: Math.floor(Math.random() * 1e9),
    explored: {},
    opened: {},
    looted: {},
    kills: 0,
    packId: pack?.id ?? '',
    completed: [],
  };
  h.hp = maxHp(h);
  return h;
}

/**
 * Readies a hero for a new adventure: everything tied to the old dungeon is
 * cleared (position, maps, loot, crystal), while level, stats, gold, gear and
 * spells carry over. A pack's starting kit tops supplies up to at least its
 * values (and fills in gear the hero doesn't already beat).
 */
export function prepareForAdventure(h: Hero, pack: DungeonPack): void {
  const kit = pack.start ?? {};
  h.packId = pack.id;
  h.pos = { level: 0, x: 0, y: 0, dir: 2 };
  h.seed = Math.floor(Math.random() * 1e9);
  h.explored = {};
  h.opened = {};
  h.looted = {};
  h.revealed = {};
  h.slain = {};
  h.crystal = false;
  h.bossDead = false;
  h.keys = 0;
  h.steps = 0;
  h.hunger = 0;
  h.thirst = 0;
  h.poisoned = false;
  h.food = Math.max(h.food, kit.food ?? 3);
  h.water = Math.max(h.water, kit.water ?? 3);
  h.torches = Math.max(h.torches, kit.torches ?? 2);
  h.torchLeft = TORCH_STEPS;
  h.potions = Math.max(h.potions, kit.potions ?? 1);
  if (h.kills === 0 && h.xp === 0) h.gold = Math.max(h.gold, kit.gold ?? h.gold);
  const better = <T extends { id: string; price: number }>(list: T[], cur: string, want?: string) => {
    const a = list.find((x) => x.id === cur);
    const b = want ? list.find((x) => x.id === want) : undefined;
    return b && (!a || b.price > a.price) ? b.id : cur;
  };
  h.weapon = better(WEAPONS, h.weapon, kit.weapon);
  h.armor = better(ARMORS, h.armor, kit.armor);
  h.hp = maxHp(h);
  h.mana = maxMana(h);
}

export function maxHp(h: Hero): number {
  return 6 + h.stats.STA + (h.level - 1) * (3 + Math.floor(h.stats.STA / 4));
}

export function maxMana(h: Hero): number {
  if (h.spells.length === 0) return 0;
  return 2 + Math.floor((h.stats.INT + h.stats.WIS) / 5) + (h.level - 1) * 2;
}

export function weaponOf(h: Hero) {
  return WEAPONS.find((w) => w.id === h.weapon) ?? WEAPONS[0];
}

export function armorOf(h: Hero) {
  return ARMORS.find((a) => a.id === h.armor) ?? ARMORS[0];
}

export function skill(h: Hero): number {
  return h.stats.SKL + (h.blessed > 0 ? 2 : 0);
}

/** XP needed for the next level (Infinity at the cap). */
export function nextLevelXp(h: Hero): number {
  return LEVEL_XP[h.level] ?? Infinity;
}

export function timeString(h: Hero): string {
  const day = Math.floor(h.minutes / 1440) + 1;
  const m = h.minutes % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `Day ${day}, ${hh}:${mm}`;
}

export function spellName(id: SpellId): string {
  return SPELLS[id].name;
}

const SAVE_KEY = 'game-arcade.underrealm.save';

export function saveHero(h: Hero): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(h));
  } catch {
    // Storage unavailable - the game just can't be continued later.
  }
}

export function loadHero(): Hero | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as Hero) : null;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
