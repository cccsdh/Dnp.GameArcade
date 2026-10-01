import { SaveData } from '../shared/SaveData';
import { PQ_ROOM_SIZE } from './config';
import { LEVELS } from './levels.generated';
import { ENEMY_KINDS, TILE_CHARS, type Direction, type EnemyDef, type LevelDef, type Vec2 } from './types';

/**
 * Player-made rooms from the level editor, stored in localStorage:
 *  - `custom`: the player's own rooms ("My Rooms")
 *  - `overrides`: edited versions of campaign rooms, keyed by level id; the
 *    campaign plays these in place of the generated room until reverted
 */
interface LibraryData {
  custom: LevelDef[];
  overrides: Record<string, LevelDef>;
}

const store = new SaveData<LibraryData>('pebble-quest.levels', { custom: [], overrides: {} });

export function loadLibrary(): LibraryData {
  return store.load();
}

function saveLibrary(data: LibraryData): void {
  store.save(data);
}

/** The room the campaign plays for `id`: an editor override if there is one, else the generated room. */
export function campaignLevel(id: number): LevelDef {
  return loadLibrary().overrides[id] ?? LEVELS[id - 1];
}

export function hasOverride(id: number): boolean {
  return !!loadLibrary().overrides[id];
}

export function saveOverride(level: LevelDef): void {
  const data = loadLibrary();
  data.overrides[level.id] = cloneLevel(level);
  saveLibrary(data);
}

export function clearOverride(id: number): void {
  const data = loadLibrary();
  delete data.overrides[id];
  saveLibrary(data);
}

/** Saves a custom room into `slot` (or appends it when slot is -1); returns the slot used. */
export function saveCustom(level: LevelDef, slot: number): number {
  const data = loadLibrary();
  const copy = cloneLevel(level);
  if (slot < 0 || slot >= data.custom.length) {
    data.custom.push(copy);
    slot = data.custom.length - 1;
  } else {
    data.custom[slot] = copy;
  }
  saveLibrary(data);
  return slot;
}

export function deleteCustom(slot: number): void {
  const data = loadLibrary();
  data.custom.splice(slot, 1);
  saveLibrary(data);
}

export function cloneLevel(level: LevelDef): LevelDef {
  return JSON.parse(JSON.stringify(level)) as LevelDef;
}

/** An empty 13x13 room: walled border, door top-centre, player bottom-centre. */
export function blankLevel(id = 0, name = 'My room'): LevelDef {
  const n = PQ_ROOM_SIZE;
  const rows: string[] = [];
  for (let y = 0; y < n; y++) {
    let row = '';
    for (let x = 0; x < n; x++) row += y === 0 || x === 0 || y === n - 1 || x === n - 1 ? '#' : '.';
    rows.push(row);
  }
  rows[0] = rows[0].slice(0, 6) + 'D' + rows[0].slice(7);
  return { id, name, width: n, height: n, rows, player: { x: 6, y: n - 2 }, framers: [], enemies: [], shotPebbles: [] };
}

/** Problems that would stop a room from being playable at all (not whether it's solvable). */
export function validateLevel(level: LevelDef): string[] {
  const problems: string[] = [];
  const flat = level.rows.join('');
  const count = (ch: string) => flat.split(ch).length - 1;
  if (count('D') === 0) problems.push('needs a door');
  if (count('C') > 1) problems.push('only one chest allowed');
  if (count('H') > 30) problems.push('at most 30 pebbles');
  const p = level.player;
  const under = level.rows[p.y]?.[p.x];
  if (under === undefined || under === '#' || under === 'R' || under === 'T' || under === 'W' || under === 'D' || under === 'C') {
    problems.push('player must start on open floor');
  }
  return problems;
}

const DIRS: Direction[] = ['up', 'down', 'left', 'right'];

function isVec(v: unknown): v is Vec2 {
  return !!v && typeof (v as Vec2).x === 'number' && typeof (v as Vec2).y === 'number';
}

/** Parses and sanity-checks a room pasted/imported as JSON. Throws with a readable message. */
export function parseLevelJson(text: string): LevelDef {
  const raw = JSON.parse(text) as Partial<LevelDef>;
  if (!Array.isArray(raw.rows) || raw.rows.length < 3) throw new Error('"rows" must be an array of strings');
  const width = raw.rows[0].length;
  for (const r of raw.rows) {
    if (typeof r !== 'string' || r.length !== width) throw new Error('every row must be a string of the same length');
    for (const ch of r) if (!TILE_CHARS.includes(ch as never)) throw new Error(`unknown tile "${ch}"`);
  }
  if (!isVec(raw.player)) throw new Error('"player" must be {x, y}');
  const enemies: EnemyDef[] = (raw.enemies ?? []).map((e) => {
    if (!ENEMY_KINDS.includes(e.kind) || !isVec(e.pos)) throw new Error('bad enemy entry');
    const out: EnemyDef = { kind: e.kind, pos: { x: e.pos.x, y: e.pos.y } };
    if (e.kind === 'gol') out.facing = DIRS.includes(e.facing as Direction) ? e.facing : 'down';
    if (e.kind === 'donMedusa') {
      out.axis = e.axis === 'v' ? 'v' : 'h';
      out.dir = e.dir === -1 ? -1 : 1;
    }
    return out;
  });
  const level: LevelDef = {
    id: typeof raw.id === 'number' ? raw.id : 0,
    name: typeof raw.name === 'string' ? raw.name : 'Imported room',
    width,
    height: raw.rows.length,
    rows: raw.rows.slice(),
    player: { x: raw.player.x, y: raw.player.y },
    framers: (raw.framers ?? []).filter(isVec).map((f) => ({ x: f.x, y: f.y })),
    enemies,
    shotPebbles: (raw.shotPebbles ?? []).filter(isVec).map((f) => ({ x: f.x, y: f.y })),
  };
  if (raw.power && ['hammer', 'bridge', 'arrow'].includes(raw.power.kind)) {
    level.power = { kind: raw.power.kind, pebbles: Math.max(0, Number(raw.power.pebbles) || 0) };
  }
  return level;
}
