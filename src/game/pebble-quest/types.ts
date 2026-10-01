export type Vec2 = { x: number; y: number };

export type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * One character per tile in `LevelDef.rows`. Everything that never moves lives
 * here; things that move or change state (the player, emerald framers, enemies)
 * are listed separately on the level.
 *
 *   #  wall (room border)          .  floor
 *   R  boulder - blocks movement, sight and shots (a Hammer can smash it)
 *   T  tree    - blocks movement only; sight and shots pass over it
 *   W  water   - impassable until bridged (Bridge power, or an egg floated on it)
 *   =  bridge  - walkable water
 *   g  grass   - the player can walk on it, enemies can't
 *   s  sand    - plain floor (cosmetic)
 *   ^ v < >    one-way arrow - can't be crossed against the arrow
 *   H  pebble  - collect them all to open the chest
 *   C  chest   - opens once every pebble is collected; take the jewel to clear the room
 *   D  door    - the exit; opens once the jewel is taken
 */
export type TileChar = '#' | '.' | 'R' | 'T' | 'W' | '=' | 'g' | 's' | '^' | 'v' | '<' | '>' | 'H' | 'C' | 'D';

export const TILE_CHARS: readonly TileChar[] = ['#', '.', 'R', 'T', 'W', '=', 'g', 's', '^', 'v', '<', '>', 'H', 'C', 'D'];

/**
 * The Adventures of Lolo cast (see src/Adventure-of-lolo-powers-and-enemies.txt):
 *  - snakey     harmless, never moves - just an obstacle (and a handy gaze shield)
 *  - rocky      harmless, but charges at you when lined up, to box you in
 *  - leeper     harmless; chases you and falls asleep for good the moment it touches you
 *  - gol        stationary; once every pebble is collected it wakes and fires down its `facing` line
 *  - medusa     stationary; kills you on sight in all four directions; can't be egged
 *  - donMedusa  paces back and forth along `axis`; kills on contact, or on sight in the direction it's heading; can't be egged
 *  - alma       charges at you whenever you share its row or column; kills on contact
 *  - skull      dormant until the last pebble is collected, then charges at you when lined up; kills on contact
 */
export type EnemyKind = 'snakey' | 'rocky' | 'leeper' | 'gol' | 'medusa' | 'donMedusa' | 'alma' | 'skull';

export const ENEMY_KINDS: readonly EnemyKind[] = ['snakey', 'rocky', 'leeper', 'gol', 'medusa', 'donMedusa', 'alma', 'skull'];

export interface EnemyDef {
  kind: EnemyKind;
  pos: Vec2;
  /** Gol only: the direction it fires in once awake. */
  facing?: Direction;
  /** Don Medusa only: the axis it paces along, and which way it sets off. */
  axis?: 'h' | 'v';
  dir?: 1 | -1;
}

/** Lolo's PW box: Hammer smashes a boulder, Bridge spans a water tile, Arrow flips a one-way arrow. */
export type PowerKind = 'hammer' | 'bridge' | 'arrow';

export interface PowerDef {
  kind: PowerKind;
  /** The power becomes usable (once) after this many pebbles are collected. */
  pebbles: number;
}

export interface LevelDef {
  id: number;
  name?: string;
  width: number;
  height: number;
  /** Row-major terrain, one TileChar per tile: rows[y][x]. */
  rows: string[];
  player: Vec2;
  /** Emerald framers - pushable green blocks. */
  framers: Vec2[];
  enemies: EnemyDef[];
  /** Pebble tiles that also grant magic shots (SHOTS_PER_PEBBLE each) when collected. */
  shotPebbles: Vec2[];
  power?: PowerDef;
}

export const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

export const DELTA: Record<Direction, Vec2> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
