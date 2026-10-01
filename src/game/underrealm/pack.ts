import { MONSTERS, type MonsterDef } from './config';
import type { ShopId } from './shops';
import type { ModelId } from './models';
import type { Palette, TextureDef } from './textures';

export type { Palette, TextureDef };

/**
 * Dungeon packs: everything that makes a particular dungeon - its levels
 * (hand-drawn ASCII maps and/or generator settings), tile legend, monsters,
 * custom wall textures and sprites, starting kit and win condition - as plain
 * JSON. The engine (raycaster, combat, shops, survival) just loads a pack and
 * runs it. The built-in Underrealm is itself a pack (BUILTIN_PACK below), and
 * any other pack can be dropped in as a .json file.
 *
 * See docs/underrealm-dungeon-format.md for the full reference and
 * public/dungeons/crypt-of-tharn.json for a hand-made example.
 */

export const PACK_FORMAT = 'underrealm-dungeon';

export type TileType =
  | 'wall'
  | 'floor'
  | 'door'
  | 'locked'
  | 'secret'
  | 'hiddenExit'
  | 'exit'
  | 'stairsUp'
  | 'stairsDown'
  | 'shop'
  | 'chest'
  | 'fountain'
  | 'throne'
  | 'prop'
  | 'start';

export interface TileDef {
  type: TileType;
  /** Wall texture id (solid tiles) - a built-in id or one from pack.textures. */
  texture?: string;
  /** Floor texture id (walkable tiles). */
  floor?: string;
  shop?: ShopId;
  /** Sprite id for chest / fountain / throne / prop tiles (built-in model id or pack.sprites key). */
  sprite?: string;
  /** Props: can you walk through it? (default false for props) */
  walkable?: boolean;
  /** Lit + monster-free (the market). */
  safe?: boolean;
  /** Shown when you step onto (or face) this tile. */
  message?: string;
}


/** A texture is a procedural preset (stone, brick, moss, wood, plain, bone, ice, ember) with colours, or an image. */

/** A built-in voxel model (optionally re-tinted), or an image (bottom-centred on a 128px square). */
export type SpriteDef = { model: ModelId; tint?: string } | { image: string; scale?: number };

/**
 * A piece of music: one of the game's built-in songs, a custom chiptune (the
 * same note-string format the built-in songs use - see Chiptune.ts), or an
 * audio file (MP3/OGG URL or data: URI) that loops.
 */
export type TrackDef =
  | { song: string }
  | {
      chiptune: {
        bpm: number;
        steps?: number;
        lead: string;
        leadWave?: 'pulse12' | 'pulse25' | 'pulse50' | 'triangle' | 'saw';
        harmony?: string;
        bass: string;
        drums?: string;
        volume?: number;
      };
    }
  | { audio: string; volume?: number };

/** Where music plays. Unset slots use the game's own soundtrack. */
export type MusicSlot = 'town' | 'depths' | 'abyss' | 'battle';
export const MUSIC_SLOTS: MusicSlot[] = ['town', 'depths', 'abyss', 'battle'];

export interface ChestDef {
  at: [number, number];
  gold?: number;
  item?: 'potion' | 'torches' | 'food' | 'key' | 'weapon' | 'armor';
  gear?: string;
}

export interface LevelDef {
  name?: string;
  /** Difficulty (monster toughness, loot). Defaults to the level number. */
  depth?: number;
  /** Colour theme for the built-in textures, or explicit colours. */
  style?: { palette?: Palette; wall?: string; floor?: string; ceiling?: string };
  /** Hand-drawn map rows (any size up to 64x64), using the tile legend. */
  map?: string[];
  /** ...or generate the level. (A map takes precedence.) */
  generate?: {
    rooms?: number;
    /** A lit market square with shops across the top rows (level 1 of the Underrealm). */
    market?: boolean;
    /** A perfect maze instead of rooms and corridors. */
    maze?: boolean;
    /** Put a throne with this boss monster in the farthest room. */
    boss?: string;
    /** Hide the dungeon's exit behind a secret wall at the farthest dead end. */
    hiddenExit?: boolean;
    /** Add stairs down (default true unless a boss / hidden exit is placed). */
    stairsDown?: boolean;
  };
  encounters?: { rate?: number; monsters?: string[] };
  /** This level's exploring music: a slot name, or its own track. */
  music?: MusicSlot | TrackDef;
  /** Fully lit and monster-free. */
  lit?: boolean;
  /** Open sky: fully lit and no torch needed, but monsters still roam. */
  daylight?: boolean;
  chests?: ChestDef[];
  /** Monsters standing guard: you fight them when you step next to them. */
  guardians?: { at: [number, number]; monster: string }[];
  /** Text shown when you step onto a tile. */
  messages?: { at: [number, number]; text: string }[];
}

export interface DungeonPack {
  format: typeof PACK_FORMAT;
  version: 1;
  id: string;
  name: string;
  author?: string;
  description?: string;
  intro?: string[];
  victory?: string[];
  /** Starting kit. */
  start?: { gold?: number; food?: number; water?: number; torches?: number; potions?: number; weapon?: string; armor?: string };
  /**
   * What winning takes: reaching an exit tile, optionally carrying the relic a
   * boss leaves on its throne ("crystal"). `item` names the relic (default "the
   * Crystal of Echoes"), `sprite` is what sits on the throne once the boss falls
   * (default "crystal"), `taken` is the line shown when you pick it up and
   * `barred` the one shown at the exit without it. `hum: false` stops the relic
   * hinting how near the way out is.
   */
  goal?: { requires?: 'crystal' | null; item?: string; sprite?: string; taken?: string; barred?: string; hum?: boolean };
  tiles?: Record<string, TileDef>;
  textures?: Record<string, TextureDef>;
  sprites?: Record<string, SpriteDef>;
  /** The adventure's own soundtrack, by slot (town, depths, abyss, battle). */
  music?: Partial<Record<MusicSlot, TrackDef>>;
  /** Extra monsters (or overrides of built-in ones by id). */
  monsters?: (Partial<MonsterDef> & { id: string; sprite?: string })[];
  levels: LevelDef[];
}

/** The default tile legend; packs can add or override characters. */
export const DEFAULT_TILES: Record<string, TileDef> = {
  '#': { type: 'wall', texture: 'wall' },
  B: { type: 'wall', texture: 'brick' },
  t: { type: 'wall', texture: 'torch' },
  '.': { type: 'floor' },
  x: { type: 'floor', floor: 'market', safe: true },
  '@': { type: 'start' },
  D: { type: 'door', texture: 'door' },
  L: { type: 'locked', texture: 'locked' },
  Z: { type: 'secret', texture: 'wall' },
  X: { type: 'hiddenExit', texture: 'wall' },
  E: { type: 'exit', texture: 'gate' },
  '<': { type: 'stairsUp', texture: 'stairsUp' },
  '>': { type: 'stairsDown', texture: 'stairsDown' },
  T: { type: 'shop', shop: 'tavern', texture: 'shopTavern' },
  P: { type: 'shop', shop: 'provisioner', texture: 'shopProvisioner' },
  S: { type: 'shop', shop: 'smithy', texture: 'shopSmithy' },
  H: { type: 'shop', shop: 'temple', texture: 'shopTemple' },
  G: { type: 'shop', shop: 'guild', texture: 'shopGuild' },
  c: { type: 'chest', sprite: 'chest' },
  f: { type: 'fountain', sprite: 'fountain' },
  K: { type: 'throne', sprite: 'throne' },
};

const PALETTES: Palette[] = ['stone', 'stone', 'moss', 'moss', 'ice', 'ice', 'ember', 'ember', 'basalt', 'basalt', 'crypt'];

/** The Underrealm: ten generated levels (market on top, the Lich King on 10) and a final labyrinth with a hidden way out. */
export const BUILTIN_PACK: DungeonPack = {
  format: PACK_FORMAT,
  version: 1,
  id: 'underrealm',
  name: 'The Underrealm',
  author: 'Doug Hunt',
  description: 'Ten levels down to the Lich King, then find the hidden way out of the Labyrinth of Echoes.',
  intro: [
    'The stair behind you has collapsed. The only way out of the Underrealm is down:',
    'take the Crystal of Echoes from the Lich King on the tenth level, then find the',
    'hidden gate in the Labyrinth of Echoes below it.',
  ],
  victory: ['The gate opens to daylight, the Crystal of Echoes singing in your hands.'],
  goal: { requires: 'crystal' },
  levels: [
    ...Array.from({ length: 10 }, (_, i): LevelDef => ({
      name: i === 0 ? 'The Undercroft' : i === 9 ? 'The Lich King\'s Hall' : `Level ${i + 1}`,
      style: { palette: PALETTES[i] },
      generate: i === 0 ? { market: true, rooms: 9 } : i === 9 ? { rooms: 10, boss: 'lich', stairsDown: true } : { rooms: 9 + (i % 3) },
    })),
    { name: 'The Labyrinth of Echoes', style: { palette: 'crypt' }, generate: { maze: true, hiddenExit: true } },
  ],
};

// --- Monsters -----------------------------------------------------------------

export interface PackMonster extends MonsterDef {
  sprite: string;
}

/** Built-in monsters merged with (and overridden by) the pack's own. */
export function packMonsters(pack: DungeonPack): PackMonster[] {
  const out = new Map<string, PackMonster>(MONSTERS.map((m) => [m.id, { ...m, sprite: m.id }]));
  for (const m of pack.monsters ?? []) {
    const base = out.get(m.id);
    const merged = {
      name: m.id,
      levels: [],
      hp: [8, 12],
      dmg: [2, 5],
      hit: 5,
      def: 1,
      xp: 15,
      gold: [0, 10],
      gullible: 0.3,
      bribe: 0,
      intro: `A ${m.name ?? m.id} appears!`,
      sprite: 'skeleton',
      ...base,
      ...m,
    } as PackMonster;
    out.set(m.id, merged);
  }
  return [...out.values()];
}

// --- Loading + validation -------------------------------------------------------

export function validatePack(raw: unknown): DungeonPack {
  const p = raw as Partial<DungeonPack>;
  if (!p || typeof p !== 'object') throw new Error('Not a JSON object');
  if (p.format !== PACK_FORMAT) throw new Error(`"format" must be "${PACK_FORMAT}"`);
  if (!p.id || !p.name) throw new Error('A pack needs an "id" and a "name"');
  if (!Array.isArray(p.levels) || p.levels.length === 0) throw new Error('"levels" must be a non-empty array');
  p.levels.forEach((l, i) => {
    if (!l.map && !l.generate) throw new Error(`Level ${i + 1} needs a "map" or "generate"`);
    if (l.map) {
      if (!Array.isArray(l.map) || l.map.some((r) => typeof r !== 'string')) throw new Error(`Level ${i + 1}: "map" must be an array of strings`);
      if (l.map.length > 64 || l.map.some((r) => r.length > 64)) throw new Error(`Level ${i + 1}: maps can be at most 64x64`);
    }
  });
  const checkTrack = (t: unknown, where: string) => {
    if (!t || typeof t !== 'object') throw new Error(`${where}: a track needs "song", "chiptune" or "audio"`);
    const tr = t as Record<string, unknown>;
    if ('song' in tr) return;
    if ('audio' in tr) {
      if (typeof tr.audio !== 'string') throw new Error(`${where}: "audio" must be a URL or data: URI`);
      return;
    }
    if ('chiptune' in tr) {
      const c = tr.chiptune as Record<string, unknown>;
      if (typeof c?.bpm !== 'number' || typeof c.lead !== 'string' || typeof c.bass !== 'string') {
        throw new Error(`${where}: a chiptune needs "bpm", "lead" and "bass"`);
      }
      for (const part of ['lead', 'harmony', 'bass'] as const) {
        const notes = c[part];
        if (typeof notes !== 'string') continue;
        for (const tok of notes.trim().split(/\s+/)) {
          if (tok === '-' || tok === '.') continue;
          if (!/^[A-G]#?-?\d$/.test(tok)) throw new Error(`${where}: "${tok}" in ${part} isn't a note (use e.g. C4, F#5, - to hold, . for rest)`);
        }
      }
      return;
    }
    throw new Error(`${where}: a track needs "song", "chiptune" or "audio"`);
  };
  for (const [slot, t] of Object.entries(p.music ?? {})) checkTrack(t, `music.${slot}`);
  p.levels.forEach((l, i) => {
    if (l.music && typeof l.music === 'object') checkTrack(l.music, `level ${i + 1} music`);
  });
  return { version: 1, ...p } as DungeonPack;
}
