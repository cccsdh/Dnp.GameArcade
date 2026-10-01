export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const enum Cell {
  Wall = 1,
  Floor = 0,
}

export interface Dungeon {
  width: number;
  height: number;
  grid: Cell[][]; // grid[y][x]
  rooms: Room[];
}

export function roomCenter(room: Room): { x: number; y: number } {
  return { x: Math.floor(room.x + room.w / 2), y: Math.floor(room.y + room.h / 2) };
}
