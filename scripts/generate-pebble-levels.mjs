// Generates the 50 Pebble Quest rooms into src/game/pebble-quest/levels.generated.ts.
//
// Each room is modelled on one of the 50 rooms of the NES Adventures of Lolo
// (10 floors x 5 rooms), transcribed tile by tile from
// adventures-of-lolo-rooms-nes-map.webp into scripts/pebble-templates.json:
// the boulder/tree/water/grass/arrow layout, the enemy line-up and where the
// hearts sit (our pebbles). Every generated room is a *variant* of its
// template, not a copy - randomly mirrored, pebbles nudged, shot-granting
// pebbles and power-ups assigned - and is then VERIFIED solvable by the BFS
// solver in src/game/pebble-quest/solver.ts before it's shipped.
//
// The solver runs the exact same rules code the game does (rules.ts is bundled
// here with esbuild), so a verified room always plays out the way the solver
// saw it. If a variant can't be solved within the search budget - the original
// rooms were designed around real-time NES movement, so some aren't solvable
// under turn-based rules as transcribed - it's re-rolled, and eventually
// relaxed one step at a time (more magic shots, then turning the most
// dangerous enemies into tamer ones, then thinning enemies, then dropping
// framers) until it is.
//
// Hand-made rooms: put LevelDefs exported from the in-game editor into
// scripts/pebble-overrides.json as { "<level id>": { ...level } } and they're
// used verbatim (still verified) instead of a generated room.
//
// Re-run any time the templates or rules change:
//   npm run pebble:levels            (PQ_START / PQ_END env vars: regenerate just a sub-range)
import { build } from 'esbuild';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, 'src', 'game', 'pebble-quest', 'levels.generated.ts');
const TEMPLATES = JSON.parse(readFileSync(join(ROOT, 'scripts', 'pebble-templates.json'), 'utf8'));
const OVERRIDES_PATH = join(ROOT, 'scripts', 'pebble-overrides.json');
const OVERRIDES = existsSync(OVERRIDES_PATH) ? JSON.parse(readFileSync(OVERRIDES_PATH, 'utf8')) : {};

// Bundle the TypeScript solver + rules so this script uses the game's real rules.
const bundleDir = mkdtempSync(join(tmpdir(), 'pq-solver-'));
const bundlePath = join(bundleDir, 'solver.mjs');
await build({
  entryPoints: [join(ROOT, 'src', 'game', 'pebble-quest', 'solver.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundlePath,
  logLevel: 'error',
});
const { solve } = await import(pathToFileURL(bundlePath).href);

const MAX_STATES = process.env.PQ_MAX_STATES ? Number(process.env.PQ_MAX_STATES) : 250_000;
const ATTEMPTS_PER_RUNG = process.env.PQ_ATTEMPTS ? Number(process.env.PQ_ATTEMPTS) : 3;
const MIN_SOLUTION = 8;
const ARROW_STRIP_RUNG = 10;
/** The final relaxation rung: no enemies, no framers, no arrows - always solvable once unsealed. */
const BARE = 40;

const ENEMY_LETTERS = { S: 'snakey', K: 'rocky', L: 'leeper', G: 'gol', M: 'medusa', D: 'donMedusa', A: 'alma', X: 'skull' };
const EGGABLE = new Set(['snakey', 'rocky', 'leeper', 'gol', 'alma', 'skull']);
// When a room won't solve, the most dangerous enemies are tamed first.
const TAME = { alma: 'rocky', skull: 'snakey', donMedusa: 'snakey', medusa: 'snakey', gol: 'snakey', rocky: 'snakey', leeper: 'snakey' };
const DANGER = { alma: 6, skull: 5, donMedusa: 4, medusa: 3, gol: 2, rocky: 1, leeper: 1, snakey: 0 };
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// --- Template -> room ---------------------------------------------------------

/** Parses an 11x11 template into a 13x13 room (walls + door added) plus its entities. */
function parseTemplate(t, mirror) {
  const grid = t.grid.map((row) => {
    let r = mirror ? [...row].reverse().join('') : row;
    if (mirror) r = r.replace(/[<>]/g, (c) => (c === '<' ? '>' : '<'));
    return r;
  });
  const door = mirror ? 10 - t.door : t.door;
  const size = grid.length + 2;
  const cells = Array.from({ length: size }, () => new Array(size).fill('#'));
  cells[0][door + 1] = 'D';
  let player = null;
  const framers = [];
  const enemies = [];
  grid.forEach((row, gy) => {
    [...row].forEach((ch, gx) => {
      const x = gx + 1;
      const y = gy + 1;
      let tile = ch;
      if (ch === 'P') {
        player = { x, y };
        tile = '.';
      } else if (ch === 'F') {
        framers.push({ x, y });
        tile = '.';
      } else if (ENEMY_LETTERS[ch]) {
        enemies.push({ kind: ENEMY_LETTERS[ch], pos: { x, y } });
        tile = '.';
      }
      cells[y][x] = tile;
    });
  });
  return { size, cells, player, framers, enemies };
}

const SIGHT_PASSES = new Set(['.', 'T', 'W', '=', 'g', 's', '^', 'v', '<', '>', 'H']);
const WALKABLE = new Set(['.', '=', 's', '^', 'v', '<', '>']);

function rayLength(cells, x, y, [dx, dy], pass) {
  let n = 0;
  for (let cx = x + dx, cy = y + dy; cells[cy]?.[cx] !== undefined && pass.has(cells[cy][cx]); cx += dx, cy += dy) n++;
  return n;
}

/** Gol faces a random open line; Don Medusa paces along its longer open axis. */
function orientEnemies(room, rng) {
  for (const e of room.enemies) {
    const { x, y } = e.pos;
    if (e.kind === 'gol') {
      const open = Object.entries(DIRS).filter(([, d]) => rayLength(room.cells, x, y, d, SIGHT_PASSES) >= 2);
      const pool = open.length ? open : Object.entries(DIRS);
      e.facing = pool[Math.floor(rng() * pool.length)][0];
    } else if (e.kind === 'donMedusa') {
      const h = rayLength(room.cells, x, y, DIRS.left, WALKABLE) + rayLength(room.cells, x, y, DIRS.right, WALKABLE);
      const v = rayLength(room.cells, x, y, DIRS.up, WALKABLE) + rayLength(room.cells, x, y, DIRS.down, WALKABLE);
      e.axis = h >= v ? 'h' : 'v';
      e.dir = rng() < 0.5 ? 1 : -1;
    }
  }
}

function occupied(room, x, y) {
  return (
    (room.player.x === x && room.player.y === y) ||
    room.framers.some((f) => f.x === x && f.y === y) ||
    room.enemies.some((e) => e.pos.x === x && e.pos.y === y)
  );
}

/** Nudges some pebbles one tile onto neighbouring open floor, so rooms aren't straight copies. */
function jitterPebbles(room, rng, chance) {
  for (let y = 1; y < room.size - 1; y++) {
    for (let x = 1; x < room.size - 1; x++) {
      if (room.cells[y][x] !== 'H' || rng() >= chance) continue;
      const opts = shuffle(Object.values(DIRS).map(([dx, dy]) => [x + dx, y + dy]), rng);
      for (const [nx, ny] of opts) {
        if (room.cells[ny][nx] === '.' && !occupied(room, nx, ny)) {
          room.cells[y][x] = '.';
          room.cells[ny][nx] = 'H';
          break;
        }
      }
    }
  }
}

const OPENABLE = { R: 'hammer', W: 'bridge', T: null };
// Arrow tile -> the step (dx,dy) that runs against it.
const ARROW_AGAINST = { '^': '0,1', v: '0,-1', '<': '1,0', '>': '-1,0' };

/**
 * Some Lolo rooms seal a heart behind boulders, water or a one-way arrow and
 * hand you a Hammer / Bridge / Arrow power to get at it. Finds, with a small
 * Dijkstra from the player, the fewest boulder/tree/water/arrow tiles that have to be
 * opened for every pebble, the chest and the door to be reachable. The first
 * such tile becomes the room's power (Hammer for a boulder, Bridge for water,
 * Arrow for an arrow crossed the wrong way); any others are simply opened up.
 * Returns the power, or null if nothing was sealed off.
 */
function unsealTargets(room) {
  const n = room.size;
  const passable = (c) => c !== '#' && !(c in OPENABLE);
  // Weights: opening a tile costs 3. Things in the way cost 1 when they can
  // be moved - an enemy can be egged and pushed aside (as Lolo intends, so it
  // never earns a power), a framer if it's free to slide along some axis -
  // but a framer jammed on both axes is as good as a wall.
  const blocksFramer = (c) => c === undefined || c === '#' || c === 'R' || c === 'T' || c === 'W' || c === 'D' || c === 'C';
  const framerMovable = (f) => {
    const at = (dx, dy) => room.cells[f.y + dy]?.[f.x + dx];
    return (!blocksFramer(at(-1, 0)) && !blocksFramer(at(1, 0))) || (!blocksFramer(at(0, -1)) && !blocksFramer(at(0, 1)));
  };
  const obstacleCost = new Map();
  for (const e of room.enemies) obstacleCost.set(e.pos.y * n + e.pos.x, 1);
  for (const f of room.framers) obstacleCost.set(f.y * n + f.x, framerMovable(f) ? 1 : 12);
  // Legs to guarantee: start -> every pebble and the chest, then chest -> door
  // (one-way arrows can let you in without letting you back out).
  const find = (ch) => {
    const out = [];
    room.cells.forEach((row, y) => row.forEach((c, x) => c === ch && out.push({ x, y })));
    return out;
  };
  const chest = find('C')[0];
  const legs = [...find('H'), ...find('C'), ...find('D')].map((t) => ({ from: room.player, t }));
  if (chest) for (const d of find('D')) legs.push({ from: chest, t: d });
  let power = null;
  for (const { from, t } of legs) {
    const dist = new Array(n * n).fill(Infinity);
    const prev = new Map();
    const start = from.y * n + from.x;
    dist[start] = 0;
    const queue = [start];
    while (queue.length) {
      queue.sort((a, b) => dist[a] - dist[b]);
      const k = queue.shift();
      const x = k % n;
      const y = Math.floor(k / n);
      if (x === t.x && y === t.y) break;
      for (const [dx, dy] of Object.values(DIRS)) {
        const nx = x + dx;
        const ny = y + dy;
        const c = room.cells[ny]?.[nx];
        const isTarget = nx === t.x && ny === t.y;
        // The chest is solid until it opens, so only the chest -> door leg may cross it.
        const solidChest = c === 'C' && from !== chest;
        if (c === undefined || ((c === '#' || c === 'D' || solidChest) && !isTarget)) continue;
        const nk = ny * n + nx;
        const against = ARROW_AGAINST[c] === `${dx},${dy}`;
        const w = (passable(c) && !against ? 0 : 3) + (obstacleCost.get(nk) ?? 0);
        if (dist[k] + w < dist[nk]) {
          if (!Number.isFinite(dist[nk])) queue.push(nk);
          dist[nk] = dist[k] + w;
          prev.set(nk, k);
        }
      }
    }
    const tk = t.y * n + t.x;
    if (!Number.isFinite(dist[tk]) || dist[tk] === 0) continue;
    const opened = [];
    for (let k = tk; prev.has(k); k = prev.get(k)) {
      const x = k % n;
      const y = Math.floor(k / n);
      const p = prev.get(k);
      const c = room.cells[y][x];
      if (c in OPENABLE || ARROW_AGAINST[c] === `${x - (p % n)},${y - Math.floor(p / n)}`) opened.push({ x, y });
    }
    opened.reverse();
    for (const o of opened) {
      const c = room.cells[o.y][o.x];
      const kind = c in ARROW_AGAINST ? 'arrow' : OPENABLE[c];
      if (!power && kind) {
        power = { kind, at: o };
        continue;
      }
      if (power && power.at.x === o.x && power.at.y === o.y) continue;
      room.cells[o.y][o.x] = c === 'W' ? '=' : '.';
    }
  }
  return power;
}

function pebbleList(room) {
  const out = [];
  room.cells.forEach((row, y) => row.forEach((c, x) => c === 'H' && out.push({ x, y })));
  return out;
}

function toLevel(id, name, room, shotPebbles, power) {
  const level = {
    id,
    name,
    width: room.size,
    height: room.size,
    rows: room.cells.map((r) => r.join('')),
    player: room.player,
    framers: room.framers,
    enemies: room.enemies,
    shotPebbles,
  };
  if (power) level.power = power;
  return level;
}

/**
 * Builds one variant of template `index`. `relax` counts how many relaxation
 * steps to apply: step 1 = one extra shot-granting pebble, then each further step tames
 * the most dangerous remaining enemy; once all are harmless it removes one,
 * and with none left it drops a framer. From ARROW_STRIP_RUNG on, one-way
 * arrows are replaced by floor too.
 */
function buildVariant(index, rng, relax) {
  const t = TEMPLATES[index];
  const floor = Math.floor(index / 5) + 1;
  const room = parseTemplate(t, rng() < 0.5);
  // Late relaxation: one-way arrow mazes can box the turn-based player in where
  // the real-time original didn't, so straighten them into plain floor.
  if (relax >= ARROW_STRIP_RUNG) {
    for (const row of room.cells) for (let x = 0; x < row.length; x++) if ('^v<>'.includes(row[x])) row[x] = '.';
  }
  orientEnemies(room, rng);
  jitterPebbles(room, rng, 0.25);
  const neededPower = unsealTargets(room);

  if (relax === BARE) {
    // Last resort: just the template's terrain, pebbles, chest and door.
    room.enemies = [];
    room.framers = [];
  }
  for (let r = 2; r <= Math.min(relax, BARE - 1); r++) {
    const worst = room.enemies
      .map((e, i) => [i, DANGER[e.kind]])
      .filter(([, d]) => d > 0)
      .sort((a, b) => b[1] - a[1] || rng() - 0.5)[0];
    if (worst) {
      const e = room.enemies[worst[0]];
      e.kind = TAME[e.kind];
      delete e.facing;
      delete e.axis;
      delete e.dir;
    } else if (room.enemies.length > 0) {
      // Everything's already harmless; a Snakey wall can still need more
      // egging than the search budget allows, so thin them out.
      room.enemies.splice(Math.floor(rng() * room.enemies.length), 1);
    } else if (room.framers.length > 0) {
      room.framers.splice(Math.floor(rng() * room.framers.length), 1);
    }
  }

  const pebbles = pebbleList(room);
  const eggable = room.enemies.filter((e) => EGGABLE.has(e.kind)).length;
  let shotPebbles = [];
  if (eggable > 0 && pebbles.length > 0) {
    const n = Math.min(pebbles.length, (floor <= 2 ? 1 : rng() < 0.5 ? 1 : 2) + (relax === 1 ? 1 : 0));
    shotPebbles = shuffle(pebbles.slice(), rng).slice(0, n);
  }

  let power;
  if (neededPower) {
    // Unlocked partway through, like the flashing hearts that grant Lolo's powers.
    power = { kind: neededPower.kind, pebbles: Math.floor(rng() * Math.ceil(pebbles.length / 2)) };
  } else if (floor >= 3 && pebbles.length >= 2 && rng() < 0.4) {
    const flat = room.cells.flat();
    const kinds = [];
    if (flat.includes('R')) kinds.push('hammer');
    if (flat.includes('W')) kinds.push('bridge');
    if (kinds.length) power = { kind: kinds[Math.floor(rng() * kinds.length)], pebbles: Math.ceil(pebbles.length / 2) };
  }
  return toLevel(index + 1, t.name.replace('Floor', 'Room'), room, shotPebbles, power);
}

/**
 * Magic shots and eggs multiply the search space enormously, but they're
 * always optional - collecting a shot pebble never forces you to fire - so a
 * room that's solvable with no ammo at all is solvable as shipped. Try that
 * cheap proof first, then the real room greedily, then a broader search.
 */
function quickSolve(level) {
  if (level.shotPebbles.length > 0) {
    const noShots = solve({ ...level, shotPebbles: [] }, { maxStates: MAX_STATES / 3, greed: 5 });
    if (noShots.solved) return noShots;
  }
  const fast = solve(level, { maxStates: MAX_STATES / 3, greed: 5 });
  if (fast.solved || !fast.aborted) return fast;
  return solve(level, { maxStates: MAX_STATES, greed: 1.5 });
}

function generateLevel(id) {
  if (OVERRIDES[id]) {
    const level = { ...OVERRIDES[id], id };
    const r = solve(level, { maxStates: MAX_STATES * 4 });
    if (!r.solved) console.warn(`  ! override for level ${id} is ${r.aborted ? 'too big to verify' : 'NOT solvable'} - shipping it anyway`);
    return { level, solution: r.path?.length ?? 0, relax: 0, attempts: 1, override: true };
  }
  let attempts = 0;
  let fallback = null;
  for (let relax = 0; relax <= BARE; relax++) {
    for (let a = 0; a < ATTEMPTS_PER_RUNG; a++) {
      attempts++;
      const rng = mulberry32(id * 7919 + relax * 131 + a * 17 + 4242);
      const level = buildVariant(id - 1, rng, relax);
      const r = quickSolve(level);
      if (process.env.PQ_DUMP) console.log(JSON.stringify(level));
      if (process.env.PQ_DEBUG) console.log(`  relax=${relax} a=${a} solved=${r.solved} aborted=${r.aborted} explored=${r.explored} enemies=${level.enemies.map((e) => e.kind)}`);
      if (!r.solved) continue;
      if (r.path.length >= MIN_SOLUTION) return { level, solution: r.path.length, relax, attempts };
      if (!fallback) fallback = { level, solution: r.path.length, relax, attempts };
    }
    if (fallback) return fallback;
  }
  throw new Error(`Could not produce a solvable variant of template ${id}`);
}

const START = process.env.PQ_START ? Number(process.env.PQ_START) : 1;
const END = process.env.PQ_END ? Number(process.env.PQ_END) : TEMPLATES.length;

// Parallel generation: PQ_JSON_OUT=<file> writes just this range's rooms as
// JSON; PQ_FROM_JSON=<a.json,b.json,...> skips generation and assembles the
// levels file from such chunks.
const levels = process.env.PQ_FROM_JSON
  ? process.env.PQ_FROM_JSON.split(',').flatMap((f) => JSON.parse(readFileSync(f, 'utf8')))
  : [];
if (process.env.PQ_FROM_JSON) levels.sort((a, b) => a.id - b.id);
const genStart = process.env.PQ_FROM_JSON ? END + 1 : START;
if (!process.env.PQ_FROM_JSON) console.log(`Generating Pebble Quest rooms ${START}-${END}...`);
const failed = [];
for (let id = genStart; id <= END; id++) {
  const t0 = Date.now();
  let r;
  try {
    r = generateLevel(id);
  } catch (err) {
    // Keep going so one stubborn room doesn't throw away the rest of the run.
    console.log(`[FAIL] ${String(id).padStart(2, '0')} ${err.message}`);
    failed.push(id);
    continue;
  }
  levels.push(r.level);
  const l = r.level;
  const kinds = l.enemies.map((e) => e.kind).join(',') || '-';
  console.log(
    `[ok] ${String(id).padStart(2, '0')} ${(l.name ?? '').padEnd(9)} pebbles=${l.rows.join('').split('H').length - 1}` +
      ` framers=${l.framers.length} shots=${l.shotPebbles.length} power=${l.power?.kind ?? '-'}` +
      `  enemies=[${kinds}]  solution=${r.solution}${r.override ? ' (override)' : ''}` +
      `  relax=${r.relax} attempts=${r.attempts} ${Date.now() - t0}ms`,
  );
}
if (failed.length > 0 && !process.env.PQ_JSON_OUT) {
  console.log(`Rooms ${failed.join(', ')} failed - not writing the levels file.`);
  process.exit(1);
}
if (process.env.PQ_JSON_OUT) {
  writeFileSync(process.env.PQ_JSON_OUT, JSON.stringify(levels));
  console.log(`Wrote rooms ${START}-${END} -> ${process.env.PQ_JSON_OUT}`);
  process.exit(0);
}

if (process.env.PQ_FROM_JSON && levels.length !== TEMPLATES.length) {
  const have = new Set(levels.map((l) => l.id));
  const missing = TEMPLATES.map((_, i) => i + 1).filter((id) => !have.has(id));
  console.log(`Chunks are missing rooms ${missing.join(', ')} - not writing.`);
  process.exit(1);
}

let all = levels;
if (!process.env.PQ_FROM_JSON && (START !== 1 || END !== TEMPLATES.length)) {
  // Partial run: splice the fresh rooms into the existing file (when it's in
  // the current format), so one stubborn room can be regenerated on its own.
  let existing = null;
  try {
    const src = readFileSync(OUT, 'utf8');
    existing = JSON.parse(src.slice(src.indexOf('= [') + 2).trim().replace(/;$/, ''));
  } catch {
    existing = null;
  }
  if (!existing || existing.length !== TEMPLATES.length || !existing.every((l) => Array.isArray(l.rows))) {
    console.log('Partial range (PQ_START/PQ_END) and no current-format levels file to merge into - not writing.');
    process.exit(0);
  }
  all = existing.map((l) => levels.find((n) => n.id === l.id) ?? l);
  console.log(`Merging rooms ${START}-${END} into the existing file.`);
}

// Valid JSON (so partial runs can merge back into it), with one line per row
// and per entity list so it stays diffable and readable.
const body = all
  .map((l) => {
    const fields = [
      `    "id": ${l.id}, "name": ${JSON.stringify(l.name)}, "width": ${l.width}, "height": ${l.height}`,
      `    "rows": [\n${l.rows.map((r) => `      ${JSON.stringify(r)}`).join(',\n')}\n    ]`,
      `    "player": ${JSON.stringify(l.player)}`,
      `    "framers": ${JSON.stringify(l.framers)}`,
      `    "enemies": ${JSON.stringify(l.enemies)}`,
      `    "shotPebbles": ${JSON.stringify(l.shotPebbles)}`,
    ];
    if (l.power) fields.push(`    "power": ${JSON.stringify(l.power)}`);
    return `  {\n${fields.join(',\n')}\n  }`;
  })
  .join(',\n');
writeFileSync(
  OUT,
  `// AUTO-GENERATED by scripts/generate-pebble-levels.mjs - do not hand-edit.\n` +
    `// Regenerate with: npm run pebble:levels\n` +
    `import type { LevelDef } from './types';\n\n` +
    `export const LEVELS: LevelDef[] = [\n${body}\n];\n`,
);
console.log(`\nWrote ${all.length} rooms -> ${OUT}`);
