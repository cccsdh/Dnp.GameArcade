import { compileLevel, initialState, step, type Action, type GameState, type LevelCtx, type StepEvents } from './rules';
import type { Direction, LevelDef } from './types';

export type { Direction };

/**
 * The live, mutable play session for one room: wraps the pure rules in
 * rules.ts with a current state and an undo history. All game logic lives in
 * rules.ts so the solver (and so the level generator/editor) sees exactly
 * what the player does.
 */
export class PuzzleState {
  readonly level: LevelDef;
  readonly ctx: LevelCtx;
  state!: GameState;
  private history: GameState[] = [];

  constructor(level: LevelDef) {
    this.level = level;
    this.ctx = compileLevel(level);
    this.reset();
  }

  reset(): void {
    this.state = initialState(this.ctx);
    this.history = [];
  }

  /** Performs an action; returns its events, or null if nothing happened. */
  act(action: Action): StepEvents | null {
    const r = step(this.ctx, this.state, action);
    if (!r) return null;
    this.history.push(this.state);
    this.state = r.state;
    return r.events;
  }

  /** Faces a direction without spending a turn (pressing toward something you can't move into). */
  turn(dir: Direction): void {
    this.state = { ...this.state, facing: dir };
  }

  undo(): boolean {
    const prev = this.history.pop();
    if (!prev) return false;
    this.state = prev;
    return true;
  }

  canUndo(): boolean {
    return this.history.length > 0;
  }
}
