import { Cell, type Dungeon, type Room, roomCenter } from './types';

function rectsOverlap(a: Room, b: Room, padding: number): boolean {
  return (
    a.x - padding < b.x + b.w &&
    a.x + a.w + padding > b.x &&
    a.y - padding < b.y + b.h &&
    a.y + a.h + padding > b.y
  );
}

function carveRoom(grid: Cell[][], room: Room): void {
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      grid[y][x] = Cell.Floor;
    }
  }
}

function carveH(grid: Cell[][], x1: number, x2: number, y: number, width: number, height: number): void {
  const [from, to] = x1 <= x2 ? [x1, x2] : [x2, x1];
  for (let x = from; x <= to; x++) {
    for (let dy = 0; dy < 2; dy++) {
      const yy = y + dy;
      if (yy > 0 && yy < height - 1 && x > 0 && x < width - 1) grid[yy][x] = Cell.Floor;
    }
  }
}

function carveV(grid: Cell[][], y1: number, y2: number, x: number, width: number, height: number): void {
  const [from, to] = y1 <= y2 ? [y1, y2] : [y2, y1];
  for (let y = from; y <= to; y++) {
    for (let dx = 0; dx < 2; dx++) {
      const xx = x + dx;
      if (xx > 0 && xx < width - 1 && y > 0 && y < height - 1) grid[y][xx] = Cell.Floor;
    }
  }
}

export interface GenerateOptions {
  width: number;
  height: number;
  maxRooms?: number;
  minRoomSize?: number;
  maxRoomSize?: number;
  rng?: () => number;
}

export function generateDungeon(opts: GenerateOptions): Dungeon {
  const { width, height, maxRooms = 12, minRoomSize = 5, maxRoomSize = 9 } = opts;
  const rng = opts.rng ?? Math.random;

  const grid: Cell[][] = Array.from({ length: height }, () => new Array(width).fill(Cell.Wall));
  const rooms: Room[] = [];

  const attempts = maxRooms * 12;
  for (let i = 0; i < attempts && rooms.length < maxRooms; i++) {
    const w = minRoomSize + Math.floor(rng() * (maxRoomSize - minRoomSize + 1));
    const h = minRoomSize + Math.floor(rng() * (maxRoomSize - minRoomSize + 1));
    const x = 1 + Math.floor(rng() * (width - w - 2));
    const y = 1 + Math.floor(rng() * (height - h - 2));
    const room: Room = { x, y, w, h };
    if (rooms.some((r) => rectsOverlap(r, room, 2))) continue;
    rooms.push(room);
  }

  // Connect rooms in placement order (simple, guarantees full connectivity)
  // then add a few extra random connections for loop-y, less corridor-y layouts.
  for (let i = 1; i < rooms.length; i++) {
    const a = roomCenter(rooms[i - 1]);
    const b = roomCenter(rooms[i]);
    if (rng() < 0.5) {
      carveH(grid, a.x, b.x, a.y, width, height);
      carveV(grid, a.y, b.y, b.x, width, height);
    } else {
      carveV(grid, a.y, b.y, a.x, width, height);
      carveH(grid, a.x, b.x, b.y, width, height);
    }
  }
  const extraLinks = Math.floor(rooms.length / 3);
  for (let i = 0; i < extraLinks; i++) {
    const ra = rooms[Math.floor(rng() * rooms.length)];
    const rb = rooms[Math.floor(rng() * rooms.length)];
    if (ra === rb) continue;
    const a = roomCenter(ra);
    const b = roomCenter(rb);
    carveH(grid, a.x, b.x, a.y, width, height);
    carveV(grid, a.y, b.y, b.x, width, height);
  }

  for (const room of rooms) carveRoom(grid, room);

  return { width, height, grid, rooms };
}

export function randomFloorTileInRoom(room: Room, rng: () => number = Math.random): { x: number; y: number } {
  const x = room.x + 1 + Math.floor(rng() * Math.max(1, room.w - 2));
  const y = room.y + 1 + Math.floor(rng() * Math.max(1, room.h - 2));
  return { x, y };
}
