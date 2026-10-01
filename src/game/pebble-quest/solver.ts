import {
  chestOpen,
  compileLevel,
  enemyAt,
  framerAt,
  initialState,
  popcount,
  powerReady,
  stateKey,
  step,
  tileAt,
  type Action,
  type GameState,
  type LevelCtx,
} from './rules';
import { DELTA, DIRECTIONS, type Direction } from './types';
import type { LevelDef } from './types';

export interface SolveOptions {
  /** Give up (unsolved, `aborted: true`) after exploring this many distinct states. */
  maxStates?: number;
  /**
   * Heuristic weight. 0 = plain uniform-cost search (shortest solution, but
   * explores far more); higher = greedier and much faster on big rooms.
   */
  greed?: number;
}

export interface SolveResult {
  solved: boolean;
  /** A winning action sequence, when solved (shortest only when greed = 0). */
  path?: Action[];
  explored: number;
  /** True if the search hit its budget before proving anything either way. */
  aborted: boolean;
}

export interface SolveProgress {
  done: false;
  explored: number;
}

interface Node {
  s: GameState;
  g: number;
  f: number;
  parent: Node | null;
  action: Action | null;
}

/** A shot is only worth considering if it would actually hit an enemy or egg. */
function shotHits(ctx: LevelCtx, s: GameState, dir: Direction): boolean {
  const d = DELTA[dir];
  let cx = s.x;
  let cy = s.y;
  for (;;) {
    cx += d.x;
    cy += d.y;
    const t = tileAt(ctx, s, cx, cy);
    if (t === '#' || t === 'R' || t === 'D' || t === 'C' || framerAt(s, cx, cy) >= 0) return false;
    if (enemyAt(s, cx, cy) >= 0) return true;
  }
}

function actionsFor(ctx: LevelCtx, s: GameState): Action[] {
  const out: Action[] = DIRECTIONS.map((dir) => ({ type: 'move', dir }));
  if (s.shots > 0) for (const dir of DIRECTIONS) if (shotHits(ctx, s, dir)) out.push({ type: 'shoot', dir });
  if (powerReady(ctx, s)) for (const dir of DIRECTIONS) out.push({ type: 'power', dir });
  return out;
}

/** Rough distance-to-go: remaining pebbles, then the chest, then the door. */
function heuristic(ctx: LevelCtx, s: GameState, door: { x: number; y: number } | null): number {
  const remaining = ctx.pebbles.length - popcount(s.collected);
  let target: { x: number; y: number } | null = null;
  let best = Infinity;
  if (remaining > 0) {
    for (let i = 0; i < ctx.pebbles.length; i++) {
      if (s.collected & (1 << i)) continue;
      const p = ctx.pebbles[i];
      const d = Math.abs(p.x - s.x) + Math.abs(p.y - s.y);
      if (d < best) best = d;
    }
    return best + remaining * 4 + (ctx.hasChest ? 8 : 0);
  }
  if (ctx.hasChest && !s.jewel && chestOpen(ctx, s)) {
    for (let y = 0; y < ctx.h && !target; y++) for (let x = 0; x < ctx.w; x++) if (ctx.rows[y][x] === 'C') target = { x, y };
    if (target) return Math.abs(target.x - s.x) + Math.abs(target.y - s.y) + 8;
  }
  if (door) return Math.abs(door.x - s.x) + Math.abs(door.y - s.y);
  return 0;
}

class MinHeap {
  private a: Node[] = [];
  get size(): number {
    return this.a.length;
  }
  push(n: Node): void {
    const a = this.a;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= n.f) break;
      a[i] = a[p];
      i = p;
    }
    a[i] = n;
  }
  pop(): Node {
    const a = this.a;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        let mf = last.f;
        if (l < a.length && a[l].f < mf) {
          m = l;
          mf = a[l].f;
        }
        if (r < a.length && a[r].f < mf) m = r;
        if (m === i) break;
        a[i] = a[m];
        i = m;
      }
      a[i] = last;
    }
    return top;
  }
}

/**
 * Best-first search over whole-room states (see rules.ts `stateKey`) for a
 * winning sequence of moves, magic shots and power uses. Super push is never
 * needed: it only reaches states that repeated single pushes can too.
 *
 * A generator so the editor can run it a slice at a time without freezing the
 * page; `solve()` below just drains it.
 */
export function* solveIter(def: LevelDef, opts: SolveOptions = {}): Generator<SolveProgress, SolveResult> {
  const maxStates = opts.maxStates ?? 300_000;
  const greed = opts.greed ?? 2;
  const ctx = compileLevel(def);
  const start = initialState(ctx);
  if (start.status !== 'playing') return { solved: false, explored: 0, aborted: false };
  let door: { x: number; y: number } | null = null;
  for (let y = 0; y < ctx.h; y++) for (let x = 0; x < ctx.w; x++) if (ctx.rows[y][x] === 'D') door = { x, y };

  const visited = new Set<string>([stateKey(start)]);
  const open = new MinHeap();
  open.push({ s: start, g: 0, f: 0, parent: null, action: null });
  let sinceYield = 0;

  while (open.size > 0) {
    const node = open.pop();
    for (const action of actionsFor(ctx, node.s)) {
      const r = step(ctx, node.s, action);
      if (!r || r.state.status === 'dead') continue;
      if (r.state.status === 'won') {
        const path: Action[] = [action];
        for (let n: Node | null = node; n && n.action; n = n.parent) path.push(n.action);
        path.reverse();
        return { solved: true, path, explored: visited.size, aborted: false };
      }
      const k = stateKey(r.state);
      if (visited.has(k)) continue;
      visited.add(k);
      const g = node.g + 1;
      open.push({ s: r.state, g, f: g + greed * heuristic(ctx, r.state, door), parent: node, action });
    }
    if (visited.size > maxStates) return { solved: false, explored: visited.size, aborted: true };
    if (++sinceYield >= 1500) {
      sinceYield = 0;
      yield { done: false, explored: visited.size };
    }
  }
  return { solved: false, explored: visited.size, aborted: false };
}

export function solve(def: LevelDef, opts: SolveOptions = {}): SolveResult {
  const it = solveIter(def, opts);
  for (;;) {
    const r = it.next();
    if (r.done) return r.value;
  }
}
