import { DELTA, DIRECTIONS, type Direction, type EnemyDef, type EnemyKind, type LevelDef, type Vec2 } from './types';

/**
 * Pure, framework-agnostic Pebble Quest rules - the single source of truth for
 * how a room plays. The game (PuzzleState / PebbleLevelScene), the level
 * editor's "Verify" button and the offline level generator
 * (scripts/generate-pebble-levels.mjs, which bundles this file with esbuild)
 * all call the same `step()`, so a room the solver verified plays out exactly
 * the same way for the player.
 *
 * A turn is one player action - a move/push, a magic shot or a power use -
 * followed by the world reacting to it:
 *  1. egg / raft / respawn timers tick down (eggs hatch, rafts sink, shot-away
 *     enemies come back to where they started)
 *  2. every live enemy moves: Don Medusa paces its axis; Leeper steps one
 *     tile toward the player; Rocky, Alma and an awake Skull charge one tile
 *     toward the player only while lined up with them (same row or column)
 *  3. the player dies if a killer is on their tile or in a live gazer's line
 *     of sight: Medusa looks all four ways, Don Medusa the way it's heading,
 *     an awake Gol the way it faces
 * Turning on the spot (pressing toward something you can't move into) is free.
 */

export const SHOTS_PER_PEBBLE = 2;
/** Turns an egged enemy stays an egg before hatching back where the egg now is. */
export const EGG_TURNS = 12;
/** Turns an enemy shot out of an egg (or sunk on a raft) takes to reappear at its starting tile. */
export const RESPAWN_TURNS = 16;

export type EnemyMode = 'active' | 'asleep' | 'egg' | 'raft' | 'gone' | 'dead';

export interface EnemyState {
  mode: EnemyMode;
  x: number;
  y: number;
  /** Don Medusa's current heading along its axis. */
  dir: 1 | -1;
  /** Egg / raft / respawn countdown. */
  timer: number;
}

export type GameStatus = 'playing' | 'won' | 'dead';

export interface GameState {
  x: number;
  y: number;
  facing: Direction;
  /** Indexed like level.framers (stable, so a renderer can keep one sprite per framer). */
  framers: Vec2[];
  /** Bitmask over LevelCtx.pebbles. */
  collected: number;
  jewel: boolean;
  shots: number;
  powerUsed: boolean;
  /** The one tile a power changed (smashed boulder -> floor, bridged water -> bridge, flipped arrow). */
  mod: { x: number; y: number; ch: string } | null;
  /** Indexed like level.enemies. */
  enemies: EnemyState[];
  moves: number;
  status: GameStatus;
}

export type Action =
  | { type: 'move'; dir: Direction; superPush?: boolean }
  | { type: 'shoot'; dir: Direction }
  | { type: 'power'; dir: Direction };

export interface StepEvents {
  pushed?: boolean;
  collected?: boolean;
  shotsGained?: number;
  chestOpened?: boolean;
  jewel?: boolean;
  shot?: 'egg' | 'away' | 'absorbed' | 'miss';
  /** Board tile where a shot stopped (for the shot animation). */
  shotEnd?: Vec2;
  power?: boolean;
  hatched?: boolean;
  slept?: boolean;
  died?: 'contact' | 'gaze' | 'drown';
  won?: boolean;
}

export interface StepResult {
  state: GameState;
  events: StepEvents;
}

/** Precomputed per-level lookups shared by every `step()`. */
export interface LevelCtx {
  def: LevelDef;
  w: number;
  h: number;
  rows: string[];
  pebbles: Vec2[];
  /** y*w+x -> pebble index. */
  pebbleIndex: Map<number, number>;
  full: number;
  shotBits: number;
  hasChest: boolean;
}

export function compileLevel(def: LevelDef): LevelCtx {
  const pebbles: Vec2[] = [];
  const pebbleIndex = new Map<number, number>();
  let hasChest = false;
  for (let y = 0; y < def.height; y++) {
    for (let x = 0; x < def.width; x++) {
      const ch = def.rows[y][x];
      if (ch === 'H') {
        pebbleIndex.set(y * def.width + x, pebbles.length);
        pebbles.push({ x, y });
      } else if (ch === 'C') hasChest = true;
    }
  }
  if (pebbles.length > 30) throw new Error('A room can have at most 30 pebbles');
  let shotBits = 0;
  for (const p of def.shotPebbles) {
    const i = pebbleIndex.get(p.y * def.width + p.x);
    if (i !== undefined) shotBits |= 1 << i;
  }
  return {
    def,
    w: def.width,
    h: def.height,
    rows: def.rows,
    pebbles,
    pebbleIndex,
    full: pebbles.length === 0 ? 0 : (1 << pebbles.length) - 1,
    shotBits,
    hasChest,
  };
}

export function initialState(ctx: LevelCtx): GameState {
  const s: GameState = {
    x: ctx.def.player.x,
    y: ctx.def.player.y,
    facing: 'up',
    framers: ctx.def.framers.map((f) => ({ ...f })),
    collected: 0,
    jewel: false,
    shots: 0,
    powerUsed: false,
    mod: null,
    enemies: ctx.def.enemies.map((e) => ({ mode: 'active', x: e.pos.x, y: e.pos.y, dir: e.dir ?? 1, timer: 0 })),
    moves: 0,
    status: 'playing',
  };
  if (lethalCause(ctx, s)) s.status = 'dead';
  return s;
}

// --- Queries (also used by the renderer) -------------------------------------

export function isEggable(kind: EnemyKind): boolean {
  return kind !== 'medusa' && kind !== 'donMedusa';
}

export function popcount(n: number): number {
  let c = 0;
  while (n) {
    n &= n - 1;
    c++;
  }
  return c;
}

export function allCollected(ctx: LevelCtx, s: GameState): boolean {
  return s.collected === ctx.full;
}

export function chestOpen(ctx: LevelCtx, s: GameState): boolean {
  return ctx.hasChest && allCollected(ctx, s);
}

export function doorOpen(ctx: LevelCtx, s: GameState): boolean {
  return s.jewel || (!ctx.hasChest && allCollected(ctx, s));
}

export function powerReady(ctx: LevelCtx, s: GameState): boolean {
  const p = ctx.def.power;
  return !!p && !s.powerUsed && popcount(s.collected) >= p.pebbles;
}

/** Effective tile at (x, y): power changes applied, collected pebbles read as floor. '#' out of bounds. */
export function tileAt(ctx: LevelCtx, s: GameState, x: number, y: number): string {
  if (x < 0 || y < 0 || x >= ctx.w || y >= ctx.h) return '#';
  if (s.mod && s.mod.x === x && s.mod.y === y) return s.mod.ch;
  const ch = ctx.rows[y][x];
  if (ch === 'H') {
    const i = ctx.pebbleIndex.get(y * ctx.w + x)!;
    return s.collected & (1 << i) ? '.' : 'H';
  }
  return ch;
}

export function framerAt(s: GameState, x: number, y: number): number {
  for (let i = 0; i < s.framers.length; i++) if (s.framers[i].x === x && s.framers[i].y === y) return i;
  return -1;
}

/** Index of an enemy physically occupying (x, y) - anything but gone/dead - or -1. */
export function enemyAt(s: GameState, x: number, y: number, except = -1): number {
  for (let i = 0; i < s.enemies.length; i++) {
    if (i === except) continue;
    const e = s.enemies[i];
    if (e.mode !== 'gone' && e.mode !== 'dead' && e.x === x && e.y === y) return i;
  }
  return -1;
}

const OPPOSITE_ARROW: Record<Direction, string> = { up: 'v', down: '^', left: '>', right: '<' };

const FLIPPED_ARROW: Record<string, string> = { '^': 'v', v: '^', '<': '>', '>': '<' };

function againstArrow(ch: string, dir: Direction): boolean {
  return OPPOSITE_ARROW[dir] === ch;
}

/** Tiles that stop a gaze or a magic shot outright. */
function blocksSight(ch: string): boolean {
  return ch === '#' || ch === 'R' || ch === 'D' || ch === 'C';
}

function isGazer(ctx: LevelCtx, s: GameState, i: number): Direction[] {
  const def = ctx.def.enemies[i];
  const e = s.enemies[i];
  if (e.mode !== 'active' || s.jewel) return [];
  if (def.kind === 'medusa') return DIRECTIONS as Direction[];
  if (def.kind === 'donMedusa') return [axisDir(e.dir, def.axis ?? 'h')];
  if (def.kind === 'gol' && allCollected(ctx, s)) return [def.facing ?? 'down'];
  return [];
}

/**
 * Tiles each live gazer currently watches (for drawing its line of sight).
 * The ray passes over trees, water, grass and rafts; boulders, walls, the chest,
 * framers and any solid enemy/egg block it.
 */
export function gazeTiles(ctx: LevelCtx, s: GameState, i: number): Vec2[] {
  const out: Vec2[] = [];
  const e = s.enemies[i];
  for (const dir of isGazer(ctx, s, i)) {
    const d = DELTA[dir];
    let cx = e.x;
    let cy = e.y;
    for (;;) {
      cx += d.x;
      cy += d.y;
      if (blocksSight(tileAt(ctx, s, cx, cy))) break;
      if (framerAt(s, cx, cy) >= 0) break;
      const o = enemyAt(s, cx, cy, i);
      if (o >= 0 && s.enemies[o].mode !== 'raft') break;
      out.push({ x: cx, y: cy });
    }
  }
  return out;
}

function lethalCause(ctx: LevelCtx, s: GameState): 'contact' | 'gaze' | null {
  if (s.jewel) return null;
  const awake = allCollected(ctx, s);
  for (let i = 0; i < s.enemies.length; i++) {
    const e = s.enemies[i];
    if (e.mode !== 'active' || e.x !== s.x || e.y !== s.y) continue;
    const k = ctx.def.enemies[i].kind;
    if (k === 'alma' || k === 'donMedusa' || (k === 'skull' && awake)) return 'contact';
  }
  for (let i = 0; i < s.enemies.length; i++) {
    for (const t of gazeTiles(ctx, s, i)) if (t.x === s.x && t.y === s.y) return 'gaze';
  }
  return null;
}

// --- Turn resolution ------------------------------------------------------------

function cloneState(s: GameState): GameState {
  return {
    ...s,
    framers: s.framers.slice(),
    enemies: s.enemies.map((e) => ({ ...e })),
  };
}

type PushOutcome = 'no' | 'ok' | 'float';

function pushDest(ctx: LevelCtx, s: GameState, x: number, y: number, dir: Direction, isEgg: boolean): PushOutcome {
  const t = tileAt(ctx, s, x, y);
  if (t === '#' || t === 'R' || t === 'T' || t === 'D' || t === 'C' || t === 'H') return 'no';
  if (againstArrow(t, dir)) return 'no';
  if (framerAt(s, x, y) >= 0 || enemyAt(s, x, y) >= 0) return 'no';
  if (t === 'W') return isEgg ? 'float' : 'no';
  return 'ok';
}

function enemyCanEnter(ctx: LevelCtx, s: GameState, self: number, x: number, y: number, dir: Direction, allowPlayer: boolean): boolean {
  const t = tileAt(ctx, s, x, y);
  if (t !== '.' && t !== 's' && t !== '=' && t !== '^' && t !== 'v' && t !== '<' && t !== '>') return false;
  if (againstArrow(t, dir)) return false;
  if (framerAt(s, x, y) >= 0 || enemyAt(s, x, y, self) >= 0) return false;
  if (x === s.x && y === s.y) return allowPlayer;
  return true;
}

function axisDir(delta: number, axis: 'h' | 'v'): Direction {
  if (axis === 'h') return delta > 0 ? 'right' : 'left';
  return delta > 0 ? 'down' : 'up';
}

/**
 * Greedy chase: step along the axis with the bigger gap first, else the other
 * one, else stay. With `alignedOnly` it only charges while the player shares
 * its row or column (Rocky, Alma, Skull), otherwise it waits.
 */
function chase(ctx: LevelCtx, s: GameState, i: number, allowPlayer: boolean, alignedOnly = false): void {
  const e = s.enemies[i];
  const dx = s.x - e.x;
  const dy = s.y - e.y;
  if (alignedOnly && dx !== 0 && dy !== 0) return;
  const order: ('h' | 'v')[] = Math.abs(dx) >= Math.abs(dy) ? ['h', 'v'] : ['v', 'h'];
  for (const axis of order) {
    const delta = axis === 'h' ? dx : dy;
    if (delta === 0) continue;
    const step = Math.sign(delta);
    const nx = axis === 'h' ? e.x + step : e.x;
    const ny = axis === 'v' ? e.y + step : e.y;
    if (enemyCanEnter(ctx, s, i, nx, ny, axisDir(step, axis), allowPlayer)) {
      e.x = nx;
      e.y = ny;
      return;
    }
  }
}

function adjacentToPlayer(s: GameState, e: EnemyState): boolean {
  return Math.abs(e.x - s.x) + Math.abs(e.y - s.y) === 1;
}

function tick(ctx: LevelCtx, s: GameState, ev: StepEvents): void {
  // 1. Timers.
  for (let i = 0; i < s.enemies.length; i++) {
    const e = s.enemies[i];
    const def = ctx.def.enemies[i];
    if (e.mode === 'egg') {
      if (--e.timer <= 0) {
        e.mode = 'active';
        ev.hatched = true;
      }
    } else if (e.mode === 'raft') {
      if (--e.timer <= 0) {
        if (e.x === s.x && e.y === s.y) {
          s.status = 'dead';
          ev.died = 'drown';
        }
        e.mode = 'gone';
        e.timer = RESPAWN_TURNS;
      }
    } else if (e.mode === 'gone') {
      e.timer = Math.max(0, e.timer - 1);
      if (e.timer === 0) {
        const { x, y } = def.pos;
        const free = !(x === s.x && y === s.y) && framerAt(s, x, y) < 0 && enemyAt(s, x, y) < 0;
        if (free) {
          e.mode = 'active';
          e.x = x;
          e.y = y;
          e.dir = def.dir ?? 1;
        }
      }
    }
  }
  if (s.status === 'dead') return;

  // 2. Enemy movement.
  const awake = allCollected(ctx, s);
  for (let i = 0; i < s.enemies.length; i++) {
    const e = s.enemies[i];
    if (e.mode !== 'active') continue;
    const def: EnemyDef = ctx.def.enemies[i];
    switch (def.kind) {
      case 'donMedusa': {
        const axis = def.axis ?? 'h';
        for (let tries = 0; tries < 2; tries++) {
          const nx = axis === 'h' ? e.x + e.dir : e.x;
          const ny = axis === 'v' ? e.y + e.dir : e.y;
          if (enemyCanEnter(ctx, s, i, nx, ny, axisDir(e.dir, axis), true)) {
            e.x = nx;
            e.y = ny;
            break;
          }
          e.dir = e.dir === 1 ? -1 : 1;
        }
        break;
      }
      case 'rocky':
        chase(ctx, s, i, false, true);
        break;
      case 'leeper':
        if (!adjacentToPlayer(s, e)) chase(ctx, s, i, false);
        if (adjacentToPlayer(s, e)) {
          e.mode = 'asleep';
          ev.slept = true;
        }
        break;
      case 'alma':
        chase(ctx, s, i, true, true);
        break;
      case 'skull':
        if (awake) chase(ctx, s, i, true, true);
        break;
      default:
        break;
    }
  }

  // 3. Lethality.
  const cause = lethalCause(ctx, s);
  if (cause) {
    s.status = 'dead';
    ev.died = cause;
  }
}

function collectAt(ctx: LevelCtx, s: GameState, ev: StepEvents): void {
  if (ctx.rows[s.y][s.x] !== 'H') return;
  const i = ctx.pebbleIndex.get(s.y * ctx.w + s.x)!;
  const bit = 1 << i;
  if (s.collected & bit) return;
  const wasOpen = chestOpen(ctx, s);
  s.collected |= bit;
  ev.collected = true;
  if (ctx.shotBits & bit) {
    s.shots += SHOTS_PER_PEBBLE;
    ev.shotsGained = SHOTS_PER_PEBBLE;
  }
  if (!wasOpen && chestOpen(ctx, s)) ev.chestOpened = true;
}

function doMove(ctx: LevelCtx, s0: GameState, dir: Direction, superPush: boolean): StepResult | null {
  const d = DELTA[dir];
  const here = tileAt(ctx, s0, s0.x, s0.y);
  if (againstArrow(here, dir)) return null;
  const nx = s0.x + d.x;
  const ny = s0.y + d.y;
  const t = tileAt(ctx, s0, nx, ny);
  if (t === '#' || t === 'R' || t === 'T' || againstArrow(t, dir)) return null;

  const ev: StepEvents = {};
  let s: GameState | null = null;

  const fi = framerAt(s0, nx, ny);
  const ei = enemyAt(s0, nx, ny);
  if (fi >= 0 || (ei >= 0 && s0.enemies[ei].mode === 'egg')) {
    const isEgg = fi < 0;
    let cx = nx;
    let cy = ny;
    let outcome: PushOutcome = 'no';
    for (;;) {
      const o = pushDest(ctx, s ?? s0, cx + d.x, cy + d.y, dir, isEgg);
      if (o === 'no') break;
      outcome = o;
      cx += d.x;
      cy += d.y;
      if (o === 'float' || !superPush) break;
    }
    if (outcome === 'no') return null;
    s = cloneState(s0);
    if (isEgg) {
      const e = s.enemies[ei];
      e.x = cx;
      e.y = cy;
      if (tileAt(ctx, s, cx, cy) === 'W') e.mode = 'raft';
    } else {
      s.framers[fi] = { x: cx, y: cy };
    }
    ev.pushed = true;
  } else if (ei >= 0 && s0.enemies[ei].mode !== 'raft') {
    return null; // solid enemy
  } else if (t === 'W' && ei < 0) {
    return null;
  } else if (t === 'C') {
    if (!chestOpen(ctx, s0)) return null;
    s = cloneState(s0);
    if (!s.jewel) {
      s.jewel = true;
      ev.jewel = true;
      for (const e of s.enemies) e.mode = 'dead';
    }
  } else if (t === 'D') {
    if (!doorOpen(ctx, s0)) return null;
    s = cloneState(s0);
    s.x = nx;
    s.y = ny;
    s.facing = dir;
    s.moves++;
    s.status = 'won';
    return { state: s, events: { won: true } };
  } else {
    s = cloneState(s0);
  }

  s.x = nx;
  s.y = ny;
  s.facing = dir;
  s.moves++;
  collectAt(ctx, s, ev);
  tick(ctx, s, ev);
  return { state: s, events: ev };
}

function doShoot(ctx: LevelCtx, s0: GameState, dir: Direction): StepResult | null {
  if (s0.shots <= 0) return null;
  const s = cloneState(s0);
  const ev: StepEvents = { shot: 'miss' };
  const d = DELTA[dir];
  let cx = s.x;
  let cy = s.y;
  for (;;) {
    cx += d.x;
    cy += d.y;
    if (blocksSight(tileAt(ctx, s, cx, cy)) || framerAt(s, cx, cy) >= 0) break;
    const i = enemyAt(s, cx, cy);
    if (i >= 0) {
      const e = s.enemies[i];
      if (e.mode === 'egg' || e.mode === 'raft') {
        e.mode = 'gone';
        e.timer = RESPAWN_TURNS;
        ev.shot = 'away';
      } else if (isEggable(ctx.def.enemies[i].kind)) {
        e.mode = 'egg';
        e.timer = EGG_TURNS;
        ev.shot = 'egg';
      } else {
        ev.shot = 'absorbed';
      }
      break;
    }
  }
  ev.shotEnd = { x: cx, y: cy };
  s.shots--;
  s.facing = dir;
  s.moves++;
  tick(ctx, s, ev);
  return { state: s, events: ev };
}

function doPower(ctx: LevelCtx, s0: GameState, dir: Direction): StepResult | null {
  if (!powerReady(ctx, s0)) return null;
  const d = DELTA[dir];
  const tx = s0.x + d.x;
  const ty = s0.y + d.y;
  const t = tileAt(ctx, s0, tx, ty);
  const kind = ctx.def.power!.kind;
  let ch: string;
  if (kind === 'hammer' && t === 'R') ch = '.';
  else if (kind === 'bridge' && t === 'W' && enemyAt(s0, tx, ty) < 0) ch = '=';
  else if (kind === 'arrow' && t in FLIPPED_ARROW) ch = FLIPPED_ARROW[t];
  else return null;
  const s = cloneState(s0);
  s.mod = { x: tx, y: ty, ch };
  s.powerUsed = true;
  s.facing = dir;
  s.moves++;
  const ev: StepEvents = { power: true };
  tick(ctx, s, ev);
  return { state: s, events: ev };
}

/** Resolves one player action. Returns null if the action isn't possible (nothing happens). */
export function step(ctx: LevelCtx, s: GameState, action: Action): StepResult | null {
  if (s.status !== 'playing') return null;
  if (action.type === 'move') return doMove(ctx, s, action.dir, !!action.superPush);
  if (action.type === 'shoot') return doShoot(ctx, s, action.dir);
  return doPower(ctx, s, action.dir);
}

const MODE_CH: Record<EnemyMode, string> = { active: 'a', asleep: 's', egg: 'e', raft: 'r', gone: 'g', dead: 'd' };

/** Canonical key for search: everything that affects the future (facing and move count don't). */
export function stateKey(s: GameState): string {
  const fr = s.framers.map((f) => f.y * 64 + f.x).sort((a, b) => a - b).join(',');
  let en = '';
  for (const e of s.enemies) en += MODE_CH[e.mode] + e.x + '.' + e.y + '.' + e.dir + '.' + e.timer + ';';
  const mod = s.mod ? `${s.mod.x}.${s.mod.y}` : '';
  return `${s.x},${s.y}|${fr}|${s.collected}|${s.jewel ? 1 : 0}${s.powerUsed ? 1 : 0}${s.shots}|${mod}|${en}`;
}
