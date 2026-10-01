// Source tile atlas is a 19x11 grid of 16px tiles (Rogue_Art/2 Dungeon Tileset/1 Tiles/Tileset.png)
export const TILE = 16;
export const TILESET_COLUMNS = 19;

// Character/enemy sprite sheets are 32x32 frames, 3 directions (Down/Side/Up),
// Side is mirrored horizontally in code to cover Left as well as Right.
export const FRAME = 32;

export const TILE_INDEX = (col: number, row: number): number => row * TILESET_COLUMNS + col;

// Hand-picked from the tileset: light stone floor variants (bottom edge of the
// floor/pit block) and dark brick wall-cap variants (top row of the wall block).
export const FLOOR_TILES = [
  TILE_INDEX(1, 5),
  TILE_INDEX(2, 5),
  TILE_INDEX(3, 5),
  TILE_INDEX(4, 5),
  TILE_INDEX(5, 5),
];
export const WALL_TILES = [TILE_INDEX(15, 1), TILE_INDEX(16, 1)];

export const DUNGEON_WIDTH = 56;
export const DUNGEON_HEIGHT = 40;

export const HERO_IDS = ['1', '2', '3'] as const;
export type HeroId = (typeof HERO_IDS)[number];

export const ENEMY_IDS = ['1', '2', '3', '4'] as const;
export type EnemyId = (typeof ENEMY_IDS)[number];

export const MAX_FLOOR = 5;

export const DEPTH = {
  floor: 0,
  decor: 5,
  shadow: 8,
  entity: 10,
  entityFx: 15,
  wallTop: 20,
  fog: 50,
};
