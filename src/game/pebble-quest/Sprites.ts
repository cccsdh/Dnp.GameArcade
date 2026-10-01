import Phaser from 'phaser';

/**
 * Pebble Quest's art, drawn procedurally at runtime so the game ships with no
 * external art files. The look follows the NES Adventures of Lolo rooms
 * (adventures-of-lolo-rooms-nes-map.webp): brown brick floor, tan brick border,
 * tan boulders, green bushes, blue water, heart pebbles and emerald framers -
 * but every sprite here is original 16x16 pixel art (rendered at 2x), not
 * copied from the game.
 *
 * Creatures and items are ASCII pixel maps (one char per pixel, see PALETTE);
 * repeating terrain (brick, water, grass...) is drawn in code.
 *
 * To swap in hand-drawn art later, load PNGs under the same texture keys in
 * PebblePreloadScene instead - nothing else references these by anything but
 * their key (see TEXTURE_KEYS at the bottom).
 */

const PALETTE: Record<string, string> = {
  k: '#000000',
  w: '#fcfcfc',
  e: '#bcbcbc',
  E: '#7c7c7c',
  t: '#f7d8a5',
  o: '#994e00',
  b: '#561d00',
  g: '#00a800',
  d: '#005800',
  l: '#b8f818',
  u: '#3cbcfc',
  U: '#0058f8',
  n: '#0000bc',
  p: '#f878f8',
  P: '#d800cc',
  r: '#e40058',
  R: '#a80020',
  v: '#6844fc',
  V: '#4428bc',
  L: '#b8b8f8',
  y: '#f8b800',
  Y: '#fce0a8',
  c: '#00e8d8',
  // Heart pebble: rose stone, shade, speckle, and its shadow on the floor.
  q: '#f8a8c8',
  Q: '#d85890',
  z: '#98285a',
  S: '#2a0c00',
};

type Art = string[];

const PLAYER_BODY: Art = [
  '................',
  '.....kkkkkk.....',
  '...kkuuuuuukk...',
  '..kuuuuuuuuuuk..',
  '.kuuwwwuuwwwuuk.',
  '.kuwwwwwwwwwwuk.',
  '.kuwwwwwwwwwwuk.',
  'kuuuwwwuuwwwuuuk',
  'kuuuuuuuuuuuuuuk',
  'kUuuuuuuuuuuuuUk',
  '.kUuuuuuuuuuuUk.',
  '.kUUuuuuuuuuUUk.',
  '..kkUUUUUUUUkk..',
  '..krrrkkkkrrrk..',
  '.krrrrk..krrrrk.',
  '..kkkk....kkkk..',
];

// Pupil offsets inside each eye (eyes span columns 3-6 and 9-12, rows 4-7).
const PUPILS: Record<string, [number, number][]> = {
  down: [[4, 5], [4, 6], [10, 5], [10, 6]],
  up: [[4, 4], [5, 4], [10, 4], [11, 4]],
  left: [[3, 5], [3, 6], [9, 5], [9, 6]],
  right: [[6, 5], [6, 6], [12, 5], [12, 6]],
};

const ROCK: Art = [
  '................',
  '....kkkkkkkk....',
  '..kkttttttttkk..',
  '.kttttottttttok.',
  '.kttottttttotttk',
  'kttttttottttttok',
  'ktottttttttottok',
  'kttttotttttttttk',
  'kttttttttottottk',
  'ktottttottttttok',
  'kttttttttttotttk',
  '.kttottttottttk.',
  '.ktttttttttotok.',
  '..kkttottttttk..',
  '....kkkkkkkkk...',
  '................',
];

const TREE: Art = [
  '................',
  '....kkkkkkkk....',
  '..kkgggllgggkk..',
  '.kggglgggggdggk.',
  '.kglggggdgggggk.',
  'kgggggdggglgggdk',
  'kgglgggggggggddk',
  'kggggglggdgggggk',
  'kgdgggggggggldgk',
  '.kggdggglgggddk.',
  '.kdgggggggddddk.',
  '..kkddgggdddkk..',
  '....kkkoookkk...',
  '......kook......',
  '................',
  '................',
];

// A smooth heart-shaped stone - the room collectible.
const PEBBLE: Art = [
  '................',
  '...kkkk..kkkk...',
  '..kqqqqkkqqqQk..',
  '.kqwwqqqqqqqQQk.',
  '.kqwqqqqqqzqQQk.',
  '.kqqqqqqqqqqQQk.',
  '.kqqqzqqqqqQQQk.',
  '..kqqqqqqqqQQk..',
  '..kQqqqqqzQQQk..',
  '...kQqqqqQQQk...',
  '....kQQqQQQk....',
  '.....kQQQQk.....',
  '......kQQk......',
  '.......kk.......',
  '.....SSSSSS.....',
  '................',
];

// Glints marking a pebble that also grants magic shots.
const SPARKLE: Art = [
  '.............y..',
  '............yYy.',
  '.............y..',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.y..............',
  'yYy.............',
  '.y..............',
];

const CHEST_CLOSED: Art = [
  '................',
  '................',
  '..kkkkkkkkkkkk..',
  '.kPPPPPPPPPPPPk.',
  '.kPwwwwwwwwwwPk.',
  '.kPwPwPwPwPwwPk.',
  '.kPPPPPPPPPPPPk.',
  '.kkkkkkyykkkkkk.',
  '.kwwwwkyykwwwwk.',
  '.kwPPPkkkkPPPwk.',
  '.kwPwwwwwwwwPwk.',
  '.kwPPPPPPPPPPwk.',
  '.kwwwwwwwwwwwwk.',
  '.kkkkkkkkkkkkkk.',
  '................',
  '................',
];

const CHEST_OPEN: Art = [
  '..kkkkkkkkkkkk..',
  '.kPPPPPPPPPPPPk.',
  '.kPwwwwwwwwwwPk.',
  '.kPPPPPPPPPPPPk.',
  '.kkkkkkkkkkkkkk.',
  '.kkkkkwccwkkkkk.',
  '.kkkkwcuucwkkkk.',
  '.kwwwkcuuckwwwk.',
  '.kwPPPkcckPPPwk.',
  '.kwPwwwkkwwwPwk.',
  '.kwPwwwwwwwwPwk.',
  '.kwPPPPPPPPPPwk.',
  '.kwwwwwwwwwwwwk.',
  '.kkkkkkkkkkkkkk.',
  '................',
  '................',
];

const CHEST_EMPTY: Art = CHEST_OPEN.map((row, y) => (y >= 5 && y <= 9 ? row.replace(/[cu]/g, 'k') : row));

const SNAKEY: Art = [
  '................',
  '......kkkk......',
  '.....kggggk.....',
  '....kgwkgggk....',
  '....kggggggk....',
  '....kkggggrrk...',
  '......kgggk.....',
  '.......kggk.....',
  '....kkkggk......',
  '...kgggggk......',
  '..kggkkkggkk....',
  '..kgk...kgggk...',
  '..kggkkkggllk...',
  '...kggglllgk....',
  '....kkkkkkk.....',
  '................',
];

const ROCKY: Art = [
  '................',
  '..kkkkkkkkkkkk..',
  '.keeeeeeeeeeeek.',
  '.kewwweeeewwwek.',
  '.kewkweeeewkwek.',
  '.kewwweeeewwwek.',
  '.keeeeeeeeeeeek.',
  '.keeeekkkkeeeek.',
  '.keeekEEEEkeeek.',
  '.keeeeeeeeeeeEk.',
  '.kEeeeeeeeeeeEk.',
  '.kEEeeeeeeeeEEk.',
  '..kEEEEEEEEEEk..',
  '..kkkkkkkkkkkk..',
  '...kEk....kEk...',
  '...kkk....kkk...',
];

const LEEPER: Art = [
  '................',
  '...kkk....kkk...',
  '..kwwwk..kwwwk..',
  '..kwkwkkkkwkwk..',
  '..kwwwggggwwwk..',
  '.kgggggggggggggk',
  '.kggggggggggggk.',
  '.kggkggggggkggk.',
  '.kgggkkkkkkgggk.',
  '..kggggggggggk..',
  '..kggllllllggk..',
  '.kgggllllllgggk.',
  'kggk.kkkkkk.kggk',
  'kkk..........kkk',
  '................',
  '................',
];

// Eyes shut.
const LEEPER_ASLEEP: Art = LEEPER.map((row, y) => {
  if (y === 1) return '................';
  if (y === 2) return '...kkk....kkk...';
  if (y === 3) return '..kgggkkkkgggk..';
  return row;
});

const GOL: Art = [
  '................',
  '....kkkkkkk.....',
  '...kpppppppk....',
  '..kppwkppwkpk...',
  '..kppwwppwwppk..',
  '..kpppppppppk...',
  '..kprrrrrrrpk...',
  '...kpwpwpwpk....',
  '..kkpppppppkk...',
  '.kppkpppppkppk..',
  '.kppkpwwwpkppk..',
  '..kkkpwwwpkkk...',
  '....kpppppk.....',
  '...kppkkkppk....',
  '...kkk...kkk....',
  '................',
];

const MEDUSA: Art = [
  '.kv.kv.kv.kv.k..',
  'kvVkvVkvVkvVkvk.',
  'kVvvvvvvvvvvvVk.',
  'kvLLLLLLLLLLLvk.',
  'kvLwwkLLLLwwkLvk',
  'kvLwkkLLLLkkwLvk',
  'kvLLLLLvvLLLLLvk',
  'kvLLLLvLLvLLLLvk',
  '.kvLLrrrrrrLLvk.',
  '.kvLLLrLLrLLLvk.',
  '..kvLLLLLLLLvk..',
  '..kVvvLLLLvvVk..',
  '..kvVvvvvvvVvk..',
  '.kvVkvVvvVkvVvk.',
  '.kk..kkkkkk..kk.',
  '................',
];

const DON_MEDUSA: Art = MEDUSA.map((row) => row.replace(/v/g, 'o').replace(/V/g, 'b').replace(/L/g, 'Y'));

const ALMA: Art = [
  '................',
  '..kk........kk..',
  '.kpPk......kPpk.',
  '.kppPkkkkkkPppk.',
  '..kppppppppppk..',
  '.kppwwkppkwwppk.',
  '.kppwkkppkkwppk.',
  'kppppppppppppppk',
  'kppkwkwkwkwkkppk',
  'kppkRRRRRRRRkppk',
  'kpppkwkwkwkwkppk',
  '.kpppkkkkkkpppk.',
  '..kPppppppppPk..',
  '...kPPPPPPPPk...',
  '..kPPk....kPPk..',
  '..kkk......kkk..',
];

const SKULL: Art = [
  '................',
  '....kkkkkkkk....',
  '..kkwwwwwwwwkk..',
  '.kwwwwwwwwwwwwk.',
  '.kwwwwwwwwwwwwk.',
  'kwwvvvwwwwvvvwwk',
  'kwvvkvvwwvvkvvwk',
  'kwvvvvwwwwvvvvwk',
  'kwwvvwwwwwwvvwwk',
  '.kwwwwwvvwwwwwk.',
  '.kwwwwvvvvwwwwk.',
  '..kwwwwwwwwwwk..',
  '..kwkwkwkwkwwk..',
  '..kvwvwvwvwvvk..',
  '...kkkkkkkkkk...',
  '................',
];

const EGG: Art = [
  '................',
  '......kkkk......',
  '....kkwwwwkk....',
  '...kwwwwwwwwk...',
  '..kwwwwwLwwwwk..',
  '..kwwLLwwwwwwk..',
  '.kwwwwwwwwLLwwk.',
  '.kwwwwwwwwwwwwk.',
  '.kwwLLwwwwwwwwk.',
  '.kwwwwwwwLwwwwk.',
  '.kwwwwwwwwwwwLk.',
  '.kLwwwwwwwwwwLk.',
  '..kLLwwwwwwLLk..',
  '...kkLLLLLLkk...',
  '.....kkkkkk.....',
  '................',
];

const SHOT: Art = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '......kkkk......',
  '.....kcwwck.....',
  '....kcwwwwck....',
  '....kcwwwwck....',
  '.....kcwwck.....',
  '......kkkk......',
  '................',
  '................',
  '................',
  '................',
  '................',
];

const HAMMER: Art = [
  '................',
  '...kkkkkkkk.....',
  '..keeeeeeeek....',
  '..kewwwwwwEk....',
  '..keeeeeeeEk....',
  '...kkkkoEEk.....',
  '.......kok......',
  '.......kok......',
  '.......kok......',
  '.......kok......',
  '.......kok......',
  '.......kok......',
  '.......kok......',
  '.......kkk......',
  '................',
  '................',
];

const BRIDGE_ICON: Art = [
  '................',
  '................',
  '..k..........k..',
  '.kok........kok.',
  '.kokkkkkkkkkkok.',
  '.koYYYYYYYYYYok.',
  '.kokkkkkkkkkkok.',
  '.koYYYYYYYYYYok.',
  '.kokkkkkkkkkkok.',
  '.kok........kok.',
  '.kok........kok.',
  '.kkk........kkk.',
  '................',
  '................',
  '................',
  '................',
];

const ARROW_ICON: Art = [
  '................',
  '.......kk.......',
  '......kwwk......',
  '.....kwwwwk.....',
  '....kwwwwwwk....',
  '...kwwwwwwwwk...',
  '..kkkkwwwwkkkk..',
  '.....kwwwwk.....',
  '.....kwwwwk.....',
  '..kkkkwwwwkkkk..',
  '...kwwwwwwwwk...',
  '....kwwwwwwk....',
  '.....kwwwwk.....',
  '......kwwk......',
  '.......kk.......',
  '................',
];

// ---------------------------------------------------------------------------

type Ctx = CanvasRenderingContext2D;
const S = 2; // screen pixels per art pixel

function rect(c: Ctx, color: string, x: number, y: number, w = 1, h = 1): void {
  c.fillStyle = color;
  c.fillRect(x * S, y * S, w * S, h * S);
}

function paint(c: Ctx, art: Art, dx = 0, dy = 0): void {
  for (let y = 0; y < art.length; y++) {
    const row = art[y];
    for (let x = 0; x < row.length; x++) {
      const col = PALETTE[row[x]];
      if (col) rect(c, col, x + dx, y + dy);
    }
  }
}

function floor(c: Ctx): void {
  rect(c, PALETTE.b, 0, 0, 16, 16);
  for (let course = 0; course < 4; course++) {
    const y = course * 4 + 3;
    rect(c, PALETTE.k, 0, y, 16, 1);
    const off = course % 2 === 0 ? 7 : 3;
    for (let x = off; x < 16; x += 8) rect(c, PALETTE.k, x, course * 4, 1, 3);
  }
  rect(c, '#6e2a08', 1, 1, 1, 1);
  rect(c, '#6e2a08', 10, 9, 1, 1);
}

function wallBrick(c: Ctx): void {
  rect(c, PALETTE.o, 0, 0, 16, 16);
  for (let course = 0; course < 2; course++) {
    const y0 = course * 8;
    const off = course === 0 ? 0 : 4;
    for (let bx = -8 + off; bx < 16; bx += 8) {
      const x = Math.max(0, bx + 1);
      const w = Math.min(16, bx + 8) - x;
      if (w > 0) {
        rect(c, PALETTE.t, x, y0 + 1, w, 6);
        rect(c, '#fff4d8', x, y0 + 1, w, 1);
      }
    }
  }
}

function water(c: Ctx, phase: number): void {
  rect(c, PALETTE.U, 0, 0, 16, 16);
  rect(c, PALETTE.u, 0, 0, 16, 16);
  const waves = [
    [1, 2], [2, 1], [3, 1], [4, 2], [9, 5], [10, 4], [11, 4], [12, 5],
    [3, 9], [4, 8], [5, 8], [6, 9], [11, 12], [12, 11], [13, 11], [14, 12],
  ];
  for (const [x, y] of waves) rect(c, PALETTE.w, (x + phase * 2) % 16, y);
  for (const [x, y] of waves) rect(c, PALETTE.U, (x + phase * 2) % 16, y + 1);
}

function bridge(c: Ctx, horizontal: boolean): void {
  water(c, 0);
  for (let i = 0; i < 16; i += 4) {
    if (horizontal) {
      rect(c, PALETTE.Y, i, 2, 3, 12);
      rect(c, PALETTE.o, i + 3, 2, 1, 12);
    } else {
      rect(c, PALETTE.Y, 2, i, 12, 3);
      rect(c, PALETTE.o, 2, i + 3, 12, 1);
    }
  }
  if (horizontal) {
    rect(c, PALETTE.b, 0, 1, 16, 1);
    rect(c, PALETTE.b, 0, 14, 16, 1);
  } else {
    rect(c, PALETTE.b, 1, 0, 1, 16);
    rect(c, PALETTE.b, 14, 0, 1, 16);
  }
}

function speckle(c: Ctx, base: string, dots: string[], seed: number): void {
  rect(c, base, 0, 0, 16, 16);
  let a = seed;
  for (let i = 0; i < 40; i++) {
    a = (a * 1103515245 + 12345) & 0x7fffffff;
    const x = a % 16;
    const y = (a >> 8) % 16;
    rect(c, dots[i % dots.length], x, y);
  }
}

function framer(c: Ctx): void {
  rect(c, PALETTE.k, 0, 0, 16, 16);
  rect(c, PALETTE.l, 1, 1, 14, 14);
  rect(c, PALETTE.d, 2, 2, 13, 13);
  rect(c, PALETTE.g, 2, 2, 12, 12);
  rect(c, PALETTE.k, 4, 4, 8, 8);
  rect(c, PALETTE.l, 5, 5, 6, 6);
  rect(c, PALETTE.g, 6, 6, 4, 4);
  rect(c, PALETTE.w, 3, 3, 1, 1);
}

function arrowTile(c: Ctx, dir: 'up' | 'down' | 'left' | 'right'): void {
  floor(c);
  rect(c, PALETTE.k, 1, 1, 14, 14);
  rect(c, PALETTE.w, 2, 2, 12, 12);
  rect(c, PALETTE.Y, 3, 3, 10, 10);
  // Arrow drawn pointing up, then mapped for other directions.
  const pts: [number, number][] = [];
  for (let y = 0; y < 4; y++) for (let x = -y; x <= y; x++) pts.push([x, y - 4]);
  for (let y = 0; y < 4; y++) for (let x = -1; x <= 0; x++) pts.push([x, y]);
  for (const [px, py] of pts) {
    let x = px;
    let y = py;
    if (dir === 'down') y = -py - 1;
    else if (dir === 'left') [x, y] = [py, px];
    else if (dir === 'right') [x, y] = [-py - 1, px];
    rect(c, PALETTE.r, 8 + x, 8 + y);
  }
}

function door(c: Ctx, open: boolean): void {
  wallBrick(c);
  rect(c, PALETTE.k, 2, 3, 12, 13);
  if (open) {
    rect(c, '#1a0a00', 3, 4, 10, 12);
  } else {
    rect(c, PALETTE.o, 3, 4, 10, 12);
    rect(c, PALETTE.b, 3, 4, 1, 12);
    rect(c, PALETTE.k, 8, 4, 1, 12);
    rect(c, PALETTE.y, 6, 10, 1, 1);
    rect(c, PALETTE.y, 10, 10, 1, 1);
  }
}

function withPupils(dir: string): Art {
  const art = PLAYER_BODY.map((r) => r.split(''));
  for (const [x, y] of PUPILS[dir]) art[y][x] = 'k';
  return art.map((r) => r.join(''));
}

function overlay(base: Art, top: Art): Art {
  return base.map((row, y) =>
    row
      .split('')
      .map((ch, x) => (top[y]?.[x] && top[y][x] !== '.' ? top[y][x] : ch))
      .join(''),
  );
}

/** Every texture this module creates. */
export const TEXTURE_KEYS = [
  'pq_floor', 'pq_wall', 'pq_rock', 'pq_tree', 'pq_water', 'pq_water2', 'pq_bridge_h', 'pq_bridge_v',
  'pq_grass', 'pq_sand', 'pq_arrow_up', 'pq_arrow_down', 'pq_arrow_left', 'pq_arrow_right',
  'pq_pebble', 'pq_pebble_shot', 'pq_chest_closed', 'pq_chest_open', 'pq_chest_empty',
  'pq_door_locked', 'pq_door_open', 'pq_framer',
  'pq_player_up', 'pq_player_down', 'pq_player_left', 'pq_player_right',
  'pq_snakey', 'pq_rocky', 'pq_leeper', 'pq_leeper_asleep', 'pq_gol', 'pq_medusa', 'pq_donMedusa',
  'pq_alma', 'pq_skull', 'pq_egg', 'pq_raft', 'pq_shot', 'pq_icon_hammer', 'pq_icon_bridge', 'pq_icon_arrow',
] as const;

export function generatePebbleTextures(scene: Phaser.Scene, tile: number): void {
  if (scene.textures.exists('pq_floor')) return;
  const make = (key: string, draw: (c: Ctx) => void) => {
    const tex = scene.textures.createCanvas(key, tile, tile)!;
    const c = tex.getContext();
    c.imageSmoothingEnabled = false;
    c.save();
    c.scale(tile / 32, tile / 32);
    draw(c);
    c.restore();
    tex.refresh();
  };
  const onFloor = (art: Art) => (c: Ctx) => {
    floor(c);
    paint(c, art);
  };

  make('pq_floor', floor);
  make('pq_wall', wallBrick);
  make('pq_rock', onFloor(ROCK));
  make('pq_tree', onFloor(TREE));
  make('pq_water', (c) => water(c, 0));
  make('pq_water2', (c) => water(c, 1));
  make('pq_bridge_h', (c) => bridge(c, true));
  make('pq_bridge_v', (c) => bridge(c, false));
  make('pq_grass', (c) => speckle(c, PALETTE.g, [PALETTE.d, PALETTE.l, PALETTE.d, '#e8a0a0'], 7));
  make('pq_sand', (c) => speckle(c, '#fcc4b0', ['#e89078', PALETTE.w, '#d86848'], 3));
  make('pq_arrow_up', (c) => arrowTile(c, 'up'));
  make('pq_arrow_down', (c) => arrowTile(c, 'down'));
  make('pq_arrow_left', (c) => arrowTile(c, 'left'));
  make('pq_arrow_right', (c) => arrowTile(c, 'right'));
  make('pq_pebble', onFloor(PEBBLE));
  make('pq_pebble_shot', onFloor(overlay(PEBBLE, SPARKLE)));
  make('pq_chest_closed', onFloor(CHEST_CLOSED));
  make('pq_chest_open', onFloor(CHEST_OPEN));
  make('pq_chest_empty', onFloor(CHEST_EMPTY));
  make('pq_door_locked', (c) => door(c, false));
  make('pq_door_open', (c) => door(c, true));
  make('pq_framer', framer);
  for (const d of ['up', 'down', 'left', 'right']) make(`pq_player_${d}`, (c) => paint(c, withPupils(d)));
  make('pq_snakey', (c) => paint(c, SNAKEY));
  make('pq_rocky', (c) => paint(c, ROCKY));
  make('pq_leeper', (c) => paint(c, LEEPER));
  make('pq_leeper_asleep', (c) => paint(c, LEEPER_ASLEEP));
  make('pq_gol', (c) => paint(c, GOL));
  make('pq_medusa', (c) => paint(c, MEDUSA));
  make('pq_donMedusa', (c) => paint(c, DON_MEDUSA));
  make('pq_alma', (c) => paint(c, ALMA));
  make('pq_skull', (c) => paint(c, SKULL));
  make('pq_egg', (c) => paint(c, EGG));
  make('pq_raft', (c) => {
    water(c, 0);
    paint(c, EGG.slice(0, 11), 0, 3);
  });
  make('pq_shot', (c) => paint(c, SHOT));
  make('pq_icon_hammer', (c) => paint(c, HAMMER));
  make('pq_icon_bridge', (c) => paint(c, BRIDGE_ICON));
  make('pq_icon_arrow', (c) => paint(c, ARROW_ICON));
}
