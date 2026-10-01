import { DEFAULT_TILES, type DungeonPack, type LevelDef, type TileDef } from './pack';

/**
 * Turns a dungeon pack's level definitions into playable tile grids.
 *
 * Every tile is one character, interpreted through the tile legend (the
 * defaults in pack.ts plus the pack's own). A level is either a hand-drawn
 * ASCII map or generated: rooms-and-corridors (optionally with the market
 * square on top), or a perfect maze - with doors, locked vaults and their
 * keys, chests, fountains, torches, stairs, a boss throne or a hidden exit
 * placed automatically. Generation is seeded, so a saved game rebuilds the
 * same maps.
 *
 * Walkable "objects" (chests, fountains, the throne) are billboard sprites on
 * floor tiles - stepping onto one triggers it, so they never block a corridor.
 */

export const GEN_W = 32;
export const GEN_H = 32;

export type Dir = 0 | 1 | 2 | 3; // N E S W
export const DIR_DX = [0, 1, 0, -1];
export const DIR_DY = [-1, 0, 1, 0];
export const DIR_NAMES = ['North', 'East', 'South', 'West'];

export interface ChestContents {
  gold: number;
  item?: 'potion' | 'torches' | 'food' | 'key' | 'weapon' | 'armor';
  gear?: string;
}

export interface Level {
  n: number;
  depth: number;
  name: string;
  def: LevelDef;
  w: number;
  h: number;
  grid: string[][];
  legend: Record<string, TileDef>;
  /** Arrival tile + facing when coming down into this level (at its stairs up / start). */
  arriveDown: { x: number; y: number; dir: Dir };
  /** Arrival when coming back up (in front of its stairs down), if it has any. */
  arriveUp: { x: number; y: number; dir: Dir } | null;
  chests: Map<string, ChestContents>;
  boss: { x: number; y: number; monster: string } | null;
  guardians: Map<string, string>;
  messages: Map<string, string>;
}

export const tileKey = (x: number, y: number) => `${x},${y}`;

const SOLID_TYPES = new Set(['wall', 'door', 'locked', 'secret', 'hiddenExit', 'exit', 'stairsUp', 'stairsDown', 'shop']);

export function tileAt(level: Level, x: number, y: number): TileDef {
  const ch = level.grid[y]?.[x];
  if (ch === undefined) return DEFAULT_TILES['#'];
  return level.legend[ch] ?? DEFAULT_TILES['#'];
}

export function isSolidTile(t: TileDef): boolean {
  if (t.type === 'prop') return !t.walkable;
  return SOLID_TYPES.has(t.type);
}

export function isSolidAt(level: Level, x: number, y: number): boolean {
  return isSolidTile(tileAt(level, x, y));
}

/** Lit, monster-free ground (the market, or a level marked lit). */
export function isSafe(level: Level, x: number, y: number): boolean {
  return !!level.def.lit || !!tileAt(level, x, y).safe;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
}

const center = (r: Room) => ({ x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) });
const WALKABLE = '.xDcfK@';

function carve(grid: string[][], x: number, y: number): void {
  if (x <= 0 || y <= 0 || x >= GEN_W - 1 || y >= GEN_H - 1) return;
  if (grid[y][x] === '#' || grid[y][x] === 't') grid[y][x] = '.';
}

function corridor(grid: string[][], a: { x: number; y: number }, b: { x: number; y: number }, rng: () => number): void {
  let { x, y } = a;
  const stepX = () => {
    while (x !== b.x) {
      carve(grid, x, y);
      x += Math.sign(b.x - x);
    }
  };
  const stepY = () => {
    while (y !== b.y) {
      carve(grid, x, y);
      y += Math.sign(b.y - y);
    }
  };
  if (rng() < 0.5) {
    stepX();
    stepY();
  } else {
    stepY();
    stepX();
  }
  carve(grid, x, y);
}

/** Wall cells in a room's ring that face into it and have solid rock behind (good for stairs / torches). */
function ringWalls(grid: string[][], r: Room): { x: number; y: number; dir: Dir }[] {
  const out: { x: number; y: number; dir: Dir }[] = [];
  for (let x = r.x; x < r.x + r.w; x++) out.push({ x, y: r.y - 1, dir: 2 }, { x, y: r.y + r.h, dir: 0 });
  for (let y = r.y; y < r.y + r.h; y++) out.push({ x: r.x - 1, y, dir: 1 }, { x: r.x + r.w, y, dir: 3 });
  return out.filter((c) => {
    if (c.x < 0 || c.y < 0 || c.x >= GEN_W || c.y >= GEN_H) return false;
    if (grid[c.y][c.x] !== '#') return false;
    const bx = c.x - DIR_DX[c.dir];
    const by = c.y - DIR_DY[c.dir];
    return (grid[by]?.[bx] ?? '#') === '#';
  });
}

function bfs(grid: string[][], sx: number, sy: number, lockedBlocks = false): number[][] {
  const h = grid.length;
  const w = grid[0].length;
  const dist = Array.from({ length: h }, () => new Array(w).fill(Infinity));
  const q: [number, number][] = [[sx, sy]];
  dist[sy][sx] = 0;
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (let d = 0; d < 4; d++) {
      const nx = x + DIR_DX[d];
      const ny = y + DIR_DY[d];
      const ch = grid[ny]?.[nx];
      if (ch === undefined || dist[ny][nx] !== Infinity) continue;
      if (!WALKABLE.includes(ch) && (ch !== 'L' || lockedBlocks)) continue;
      dist[ny][nx] = dist[y][x] + 1;
      q.push([nx, ny]);
    }
  }
  return dist;
}

function generateRooms(grid: string[][], y0: number, y1: number, rng: () => number, entrance: { x: number; y: number }, count: number): Room[] {
  const rooms: Room[] = [];
  for (let tries = 0; tries < 500 && rooms.length < count; tries++) {
    const w = 3 + Math.floor(rng() * 5);
    const h = 3 + Math.floor(rng() * 4);
    const x = 2 + Math.floor(rng() * (GEN_W - w - 4));
    const y = y0 + 1 + Math.floor(rng() * (y1 - y0 - h - 2));
    if (rooms.some((o) => x < o.x + o.w + 2 && x + w + 2 > o.x && y < o.y + o.h + 2 && y + h + 2 > o.y)) continue;
    rooms.push({ x, y, w, h });
  }
  const dist = (r: Room) => Math.hypot(center(r).x - entrance.x, center(r).y - entrance.y);
  rooms.sort((a, b) => dist(a) - dist(b));
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) grid[y][x] = '.';
  for (let i = 1; i < rooms.length; i++) {
    let best = 0;
    let bestD = Infinity;
    for (let j = 0; j < i; j++) {
      const d = Math.hypot(center(rooms[i]).x - center(rooms[j]).x, center(rooms[i]).y - center(rooms[j]).y);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    corridor(grid, center(rooms[i]), center(rooms[best]), rng);
  }
  for (let k = 0; k < 2; k++) {
    const a = rooms[Math.floor(rng() * rooms.length)];
    const b = rooms[Math.floor(rng() * rooms.length)];
    if (a !== b) corridor(grid, center(a), center(b), rng);
  }
  corridor(grid, entrance, center(rooms[0]), rng);
  return rooms;
}

function addDoors(grid: string[][], rooms: Room[], rng: () => number, locked?: Room): void {
  for (const r of rooms) {
    const ring: [number, number][] = [];
    for (let x = r.x; x < r.x + r.w; x++) ring.push([x, r.y - 1], [x, r.y + r.h]);
    for (let y = r.y; y < r.y + r.h; y++) ring.push([r.x - 1, y], [r.x + r.w, y]);
    for (const [x, y] of ring) {
      if (grid[y]?.[x] !== '.') continue;
      const horiz = grid[y][x - 1] === '#' && grid[y][x + 1] === '#';
      const vert = grid[y - 1]?.[x] === '#' && grid[y + 1]?.[x] === '#';
      if (!horiz && !vert) continue;
      if (r === locked) grid[y][x] = 'L';
      else if (rng() < 0.45) grid[y][x] = 'D';
    }
  }
}

function marketSquare(grid: string[][]): void {
  for (let y = 1; y <= 9; y++) for (let x = 1; x <= 30; x++) grid[y][x] = y === 1 || y === 9 || x === 1 || x === 30 ? 'B' : 'x';
  grid[1][6] = 'T';
  grid[1][15] = '<';
  grid[1][23] = 'P';
  grid[9][6] = 'S';
  grid[9][23] = 'H';
  grid[9][27] = 'G';
  grid[9][15] = 'x';
  grid[5][15] = 'f';
  for (const [x, y] of [[8, 4], [22, 4], [8, 6], [22, 6]]) grid[y][x] = 't';
}

const GEAR_BY_DEPTH = [
  ['shortsword', 'leather', 'mace'],
  ['shortsword', 'leather', 'mace'],
  ['mace', 'broadsword', 'chain'],
  ['broadsword', 'chain'],
  ['broadsword', 'axe', 'chain'],
  ['axe', 'plate'],
  ['axe', 'plate'],
  ['plate', 'runeblade'],
  ['runeblade', 'mithril'],
  ['runeblade', 'mithril'],
  ['runeblade', 'mithril'],
];
const ARMOR_IDS = new Set(['leather', 'chain', 'plate', 'mithril']);

function randomChest(depth: number, rng: () => number): ChestContents {
  const r = rng();
  const gold = Math.floor((8 + rng() * 25) * depth);
  if (r < 0.35) return { gold };
  if (r < 0.6) return { gold: Math.floor(gold / 3), item: 'potion' };
  if (r < 0.75) return { gold: Math.floor(gold / 3), item: 'torches' };
  if (r < 0.88) return { gold: Math.floor(gold / 3), item: 'food' };
  return { gold, item: 'potion' };
}

function gearChest(depth: number, rng: () => number): ChestContents {
  const pool = GEAR_BY_DEPTH[Math.min(GEAR_BY_DEPTH.length - 1, depth - 1)];
  const gear = pool[Math.floor(rng() * pool.length)];
  return { gold: 30 * depth, item: ARMOR_IDS.has(gear) ? 'armor' : 'weapon', gear };
}

interface Built {
  grid: string[][];
  chests: Map<string, ChestContents>;
  arriveDown: Level['arriveDown'];
  arriveUp: Level['arriveUp'];
  boss: Level['boss'];
  start?: Level['arriveDown'];
}

/** Rooms-and-corridors (the classic Underrealm level). */
function generateRoomsLevel(def: LevelDef, depth: number, rng: () => number): Built {
  const gen = def.generate ?? {};
  const grid = Array.from({ length: GEN_H }, () => new Array(GEN_W).fill('#'));
  const chests = new Map<string, ChestContents>();
  let arriveDown: Level['arriveDown'];
  let arriveUp: Level['arriveUp'] = null;
  let boss: Level['boss'] = null;
  let rooms: Room[];
  if (gen.market) {
    marketSquare(grid);
    arriveDown = { x: 15, y: 2, dir: 2 };
    rooms = generateRooms(grid, 10, GEN_H - 1, rng, { x: 15, y: 10 }, gen.rooms ?? 9);
    carve(grid, 15, 10);
  } else {
    rooms = generateRooms(grid, 0, GEN_H - 1, rng, { x: 2 + Math.floor(rng() * 28), y: 2 + Math.floor(rng() * 28) }, gen.rooms ?? 10);
    const spots = ringWalls(grid, rooms[0]);
    const s = spots[Math.floor(rng() * spots.length)];
    grid[s.y][s.x] = '<';
    arriveDown = { x: s.x + DIR_DX[s.dir], y: s.y + DIR_DY[s.dir], dir: s.dir };
  }

  const dm = bfs(grid, arriveDown.x, arriveDown.y);
  const roomDist = (r: Room) => dm[center(r).y][center(r).x];
  const byDist = [...rooms].filter((r) => roomDist(r) < Infinity).sort((a, b) => roomDist(b) - roomDist(a));
  const farthest = byDist[0];
  const secondFarthest = byDist[1] ?? farthest;

  if (gen.boss) {
    const c = center(farthest);
    grid[farthest.y][c.x] = 'K';
    boss = { x: c.x, y: farthest.y, monster: gen.boss };
  }
  if (gen.hiddenExit) {
    const spots = ringWalls(grid, gen.boss ? secondFarthest : farthest);
    const s = spots[Math.floor(rng() * spots.length)];
    if (s) grid[s.y][s.x] = 'X';
  }
  const wantStairs = gen.stairsDown ?? !(gen.boss || gen.hiddenExit);
  if (wantStairs) {
    const stairRoom = gen.boss ? secondFarthest : farthest;
    const spots = ringWalls(grid, stairRoom);
    const s = spots[Math.floor(rng() * spots.length)];
    grid[s.y][s.x] = '>';
    arriveUp = { x: s.x + DIR_DX[s.dir], y: s.y + DIR_DY[s.dir], dir: s.dir };
  }

  // A locked vault holding better gear, its key in another chest.
  const candidates = rooms.filter((r) => r !== rooms[0] && r !== farthest && r !== secondFarthest);
  const vault = candidates[Math.floor(rng() * candidates.length)];
  addDoors(grid, rooms, rng, vault);
  const placeChest = (r: Room, contents: ChestContents): boolean => {
    for (let tries = 0; tries < 20; tries++) {
      const x = r.x + 1 + Math.floor(rng() * Math.max(1, r.w - 2));
      const y = r.y + 1 + Math.floor(rng() * Math.max(1, r.h - 2));
      if (grid[y][x] !== '.') continue;
      grid[y][x] = 'c';
      chests.set(tileKey(x, y), contents);
      return true;
    }
    return false;
  };
  if (vault) {
    placeChest(vault, gearChest(depth, rng));
    const keyRooms = candidates.filter((r) => r !== vault);
    placeChest(keyRooms[Math.floor(rng() * keyRooms.length)] ?? rooms[0], { gold: 5, item: 'key' });
    // The vault must stay optional: nothing important can be behind it.
    const reach = bfs(grid, arriveDown.x, arriveDown.y, true);
    const goals: { x: number; y: number }[] = [];
    if (arriveUp) goals.push(arriveUp);
    if (boss) goals.push(boss);
    for (let y = 0; y < GEN_H; y++) for (let x = 0; x < GEN_W; x++) if (grid[y][x] === 'X') goals.push({ x, y });
    const keyChest = [...chests.entries()].find(([, c]) => c.item === 'key');
    if (keyChest) {
      const [kx, ky] = keyChest[0].split(',').map(Number);
      goals.push({ x: kx, y: ky });
    }
    const reachable = (g: { x: number; y: number }) => [[0, 0], [0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => reach[g.y + dy]?.[g.x + dx] < Infinity);
    if (!goals.every(reachable)) {
      for (const row of grid) for (let x = 0; x < row.length; x++) if (row[x] === 'L') row[x] = 'D';
      if (keyChest) chests.set(keyChest[0], { gold: 25 * depth, item: 'potion' });
    }
  }
  for (const r of rooms) {
    if (r === vault || r === farthest) continue;
    if (rng() < 0.45) placeChest(r, randomChest(depth, rng));
    if (rng() < 0.15 && r.w >= 4 && r.h >= 4) {
      const c = center(r);
      if (grid[c.y][c.x] === '.') grid[c.y][c.x] = 'f';
    }
    const ws = ringWalls(grid, r);
    for (let i = 0; i < 2 && ws.length; i++) {
      const w = ws.splice(Math.floor(rng() * ws.length), 1)[0];
      if (rng() < 0.6) grid[w.y][w.x] = 't';
    }
  }
  return { grid, chests, arriveDown, arriveUp, boss };
}

/** A perfect maze (with a few extra loops), for labyrinth levels. */
function generateMazeLevel(def: LevelDef, depth: number, rng: () => number): Built {
  const gen = def.generate ?? {};
  const grid = Array.from({ length: GEN_H }, () => new Array(GEN_W).fill('#'));
  const chests = new Map<string, ChestContents>();
  const cells = 15; // maze cells sit on odd coordinates 1..29
  const seen = new Set<string>(['0,0']);
  const stack: [number, number][] = [[0, 0]];
  grid[1][1] = '.';
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const options = [0, 1, 2, 3].filter((d) => {
      const nx = cx + DIR_DX[d];
      const ny = cy + DIR_DY[d];
      return nx >= 0 && ny >= 0 && nx < cells && ny < cells && !seen.has(`${nx},${ny}`);
    });
    if (!options.length) {
      stack.pop();
      continue;
    }
    const d = options[Math.floor(rng() * options.length)];
    const nx = cx + DIR_DX[d];
    const ny = cy + DIR_DY[d];
    grid[1 + cy * 2 + DIR_DY[d]][1 + cx * 2 + DIR_DX[d]] = '.';
    grid[1 + ny * 2][1 + nx * 2] = '.';
    seen.add(`${nx},${ny}`);
    stack.push([nx, ny]);
  }
  // Knock through some walls so it isn't one long single path.
  for (let i = 0; i < 26; i++) {
    const x = 2 + Math.floor(rng() * 27);
    const y = 2 + Math.floor(rng() * 27);
    if (grid[y][x] !== '#') continue;
    const h = grid[y][x - 1] === '.' && grid[y][x + 1] === '.' && grid[y - 1][x] === '#' && grid[y + 1][x] === '#';
    const v = grid[y - 1][x] === '.' && grid[y + 1][x] === '.' && grid[y][x - 1] === '#' && grid[y][x + 1] === '#';
    if (h || v) grid[y][x] = '.';
  }
  grid[0][1] = '<';
  const arriveDown = { x: 1, y: 1, dir: 2 as Dir };
  const dm = bfs(grid, 1, 1);
  // Dead ends, farthest first; each remembers the wall at its closed end.
  const deadEnds: { x: number; y: number; d: number; wall: { x: number; y: number } }[] = [];
  for (let y = 1; y < GEN_H - 1; y++)
    for (let x = 1; x < GEN_W - 1; x++) {
      if (grid[y][x] !== '.' || !(dm[y][x] < Infinity) || (x === 1 && y === 1)) continue;
      const open = [0, 1, 2, 3].filter((d) => grid[y + DIR_DY[d]][x + DIR_DX[d]] === '.');
      if (open.length !== 1) continue;
      const back = (open[0] + 2) % 4;
      deadEnds.push({ x, y, d: dm[y][x], wall: { x: x + DIR_DX[back], y: y + DIR_DY[back] } });
    }
  deadEnds.sort((a, b) => b.d - a.d);
  let arriveUp: Level['arriveUp'] = null;
  if (gen.hiddenExit && deadEnds[0]) {
    const e = deadEnds.shift()!;
    grid[e.wall.y][e.wall.x] = 'X';
  }
  if (gen.stairsDown && deadEnds[0]) {
    const e = deadEnds.shift()!;
    grid[e.wall.y][e.wall.x] = '>';
    arriveUp = { x: e.x, y: e.y, dir: 0 as Dir };
  }
  for (const e of deadEnds.slice(0, 8)) {
    if (rng() < 0.7) {
      grid[e.y][e.x] = 'c';
      chests.set(tileKey(e.x, e.y), rng() < 0.2 ? gearChest(depth, rng) : randomChest(depth, rng));
    }
  }
  for (let i = 0; i < 40; i++) {
    const x = 1 + Math.floor(rng() * 30);
    const y = 1 + Math.floor(rng() * 30);
    if (grid[y][x] === '#' && [0, 1, 2, 3].some((d) => grid[y + DIR_DY[d]]?.[x + DIR_DX[d]] === '.')) grid[y][x] = 't';
  }
  return { grid, chests, arriveDown, arriveUp, boss: null };
}

/** A hand-drawn map. Stairs, the start marker and exits are found by scanning it. */
function parseMap(def: LevelDef, legend: Record<string, TileDef>): Built {
  const rows = def.map!;
  const w = Math.max(...rows.map((r) => r.length));
  const grid = rows.map((r) => r.padEnd(w, '#').split(''));
  const chests = new Map<string, ChestContents>();
  let arriveDown: Level['arriveDown'] | null = null;
  let arriveUp: Level['arriveUp'] = null;
  let start: Level['arriveDown'] | null = null;
  const open = (x: number, y: number) => {
    const t = legend[grid[y]?.[x]];
    return !!t && !isSolidTile(t);
  };
  const floorNeighbour = (x: number, y: number): { x: number; y: number; dir: Dir } | null => {
    for (let d = 0; d < 4; d++) if (open(x + DIR_DX[d], y + DIR_DY[d])) return { x: x + DIR_DX[d], y: y + DIR_DY[d], dir: d as Dir };
    return null;
  };
  for (let y = 0; y < grid.length; y++)
    for (let x = 0; x < w; x++) {
      const t = legend[grid[y][x]];
      if (!t) continue;
      if (t.type === 'start') {
        let dir: Dir = 0;
        for (let d = 0; d < 4; d++) if (open(x + DIR_DX[d], y + DIR_DY[d])) {
          dir = d as Dir;
          break;
        }
        start = { x, y, dir };
      }
      if (t.type === 'stairsUp' && !arriveDown) arriveDown = floorNeighbour(x, y);
      if (t.type === 'stairsDown' && !arriveUp) arriveUp = floorNeighbour(x, y);
      if (t.type === 'chest') chests.set(tileKey(x, y), { gold: 10 });
    }
  for (const c of def.chests ?? []) chests.set(tileKey(c.at[0], c.at[1]), { gold: c.gold ?? 0, item: c.item, gear: c.gear });
  const arrival = start ?? arriveDown ?? { x: 1, y: 1, dir: 2 as Dir };
  let boss: Level['boss'] = null;
  const throne = def.guardians?.find((g) => legend[grid[g.at[1]]?.[g.at[0]]]?.type === 'throne');
  if (throne) boss = { x: throne.at[0], y: throne.at[1], monster: throne.monster };
  return { grid, chests, arriveDown: arriveDown ?? arrival, arriveUp, boss, start: arrival };
}

export function buildLevel(pack: DungeonPack, n: number, seed: number): Level {
  const def = pack.levels[n - 1];
  const depth = def.depth ?? n;
  const legend = { ...DEFAULT_TILES, ...(pack.tiles ?? {}) };
  const rng = mulberry32(seed * 131 + n * 7919);
  let built: Built;
  if (def.map) built = parseMap(def, legend);
  else if (def.generate?.maze) built = generateMazeLevel(def, depth, rng);
  else built = generateRoomsLevel(def, depth, rng);
  const guardians = new Map<string, string>();
  for (const g of def.guardians ?? []) {
    if (built.boss && built.boss.x === g.at[0] && built.boss.y === g.at[1]) continue;
    guardians.set(tileKey(g.at[0], g.at[1]), g.monster);
  }
  const messages = new Map<string, string>();
  for (const m of def.messages ?? []) messages.set(tileKey(m.at[0], m.at[1]), m.text);
  return {
    n,
    depth,
    name: def.name ?? `Level ${n}`,
    def,
    w: built.grid[0].length,
    h: built.grid.length,
    grid: built.grid,
    legend,
    arriveDown: n === 1 && built.start ? built.start : built.arriveDown,
    arriveUp: built.arriveUp,
    chests: built.chests,
    boss: built.boss,
    guardians,
    messages,
  };
}
