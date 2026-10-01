/**
 * Procedural 64x64 wall / floor textures for The Underrealm's raycaster,
 * painted with Canvas 2D at load time and kept as raw 32-bit pixel arrays
 * (ABGR, as ImageData stores them) for fast sampling.
 */

export const TEX = 64;

export type Texture = Uint32Array;

export interface TextureSet {
  walls: Record<string, Texture>;
  floors: Record<string, Texture>;
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paint(draw: (c: CanvasRenderingContext2D, r: () => number) => void, seed: number): Texture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = TEX;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  c.imageSmoothingEnabled = false;
  draw(c, rng(seed));
  return new Uint32Array(c.getImageData(0, 0, TEX, TEX).data.buffer.slice(0));
}

function shade(hex: string, amt: number): string {
  const v = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.max(0, Math.min(255, ((v >> s) & 255) + amt));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function grain(c: CanvasRenderingContext2D, r: () => number, base: string, n: number, spread = 18): void {
  for (let i = 0; i < n; i++) {
    c.fillStyle = shade(base, Math.round((r() - 0.5) * spread * 2));
    c.fillRect(Math.floor(r() * TEX), Math.floor(r() * TEX), 1 + Math.floor(r() * 2), 1);
  }
}

/** Irregular stone blocks. */
function stoneWall(base: string, mortar: string, extra?: (c: CanvasRenderingContext2D, r: () => number) => void) {
  return (c: CanvasRenderingContext2D, r: () => number) => {
    c.fillStyle = mortar;
    c.fillRect(0, 0, TEX, TEX);
    const rows = [0, 14, 30, 46, 64];
    for (let i = 0; i < rows.length - 1; i++) {
      let x = i % 2 ? -10 : 0;
      while (x < TEX) {
        const w = 14 + Math.floor(r() * 12);
        c.fillStyle = shade(base, Math.round((r() - 0.5) * 30));
        c.fillRect(x + 1, rows[i] + 1, w - 2, rows[i + 1] - rows[i] - 2);
        c.fillStyle = shade(base, 22);
        c.fillRect(x + 1, rows[i] + 1, w - 2, 1);
        c.fillStyle = shade(base, -28);
        c.fillRect(x + 1, rows[i + 1] - 2, w - 2, 1);
        x += w;
      }
    }
    grain(c, r, base, 260);
    extra?.(c, r);
  };
}

function brickWall(base: string) {
  return (c: CanvasRenderingContext2D, r: () => number) => {
    c.fillStyle = '#3a2a22';
    c.fillRect(0, 0, TEX, TEX);
    for (let row = 0; row < 8; row++) {
      const off = row % 2 ? 8 : 0;
      for (let x = -off; x < TEX; x += 16) {
        c.fillStyle = shade(base, Math.round((r() - 0.5) * 36));
        c.fillRect(x + 1, row * 8 + 1, 14, 6);
        c.fillStyle = shade(base, 20);
        c.fillRect(x + 1, row * 8 + 1, 14, 1);
      }
    }
    grain(c, r, base, 160, 14);
  };
}

function door(c: CanvasRenderingContext2D, r: () => number, iron: boolean): void {
  stoneWall('#6c6c70', '#2c2c30')(c, r);
  c.fillStyle = '#1a1208';
  c.fillRect(10, 6, 44, 58);
  const wood = iron ? '#5c6068' : '#7c4c24';
  for (let x = 12; x < 52; x += 8) {
    c.fillStyle = shade(wood, Math.round((r() - 0.5) * 24));
    c.fillRect(x, 8, 7, 56);
    c.fillStyle = shade(wood, -30);
    c.fillRect(x + 7, 8, 1, 56);
  }
  c.fillStyle = iron ? '#9ca0a8' : '#3c3c44';
  c.fillRect(12, 16, 40, 4);
  c.fillRect(12, 48, 40, 4);
  if (iron) {
    c.fillStyle = '#101010';
    c.fillRect(42, 32, 5, 8);
    c.fillRect(43, 40, 3, 5);
    c.fillStyle = '#f8d800';
    c.fillRect(40, 30, 9, 2);
  } else {
    c.strokeStyle = '#c8a040';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(44, 36, 4, 0, Math.PI * 2);
    c.stroke();
  }
}

function stairs(c: CanvasRenderingContext2D, r: () => number, down: boolean, base: string): void {
  stoneWall(base, '#26262a')(c, r);
  // Archway.
  c.fillStyle = '#0a0a0c';
  c.beginPath();
  c.moveTo(10, 64);
  c.lineTo(10, 24);
  c.arc(32, 24, 22, Math.PI, 0);
  c.lineTo(54, 64);
  c.fill();
  for (let i = 0; i < 6; i++) {
    const t = i / 6;
    const y = down ? 36 + i * 5 : 60 - i * 6;
    const inset = down ? 8 + (1 - t) * 6 : 10 + t * 10;
    c.fillStyle = shade('#7c7c84', down ? -60 + i * 12 : -i * 12);
    c.fillRect(10 + inset, y, 44 - inset * 2, 4);
  }
  if (!down) {
    // Daylight spilling down from above.
    const g = c.createLinearGradient(0, 4, 0, 40);
    g.addColorStop(0, 'rgba(255,240,180,0.9)');
    g.addColorStop(1, 'rgba(255,240,180,0)');
    c.fillStyle = g;
    c.fillRect(14, 4, 36, 36);
  }
}

type SignIcon = 'mug' | 'sack' | 'anvil' | 'ankh' | 'eye';

function shopFront(c: CanvasRenderingContext2D, r: () => number, icon: SignIcon, doorColor: string): void {
  brickWall('#9c4c34')(c, r);
  // Doorway.
  c.fillStyle = '#1a1208';
  c.fillRect(20, 30, 24, 34);
  c.fillStyle = doorColor;
  c.fillRect(22, 32, 20, 32);
  c.fillStyle = shade(doorColor, 40);
  c.fillRect(22, 32, 20, 2);
  c.fillStyle = '#f8d870';
  c.fillRect(37, 48, 2, 2);
  // Lit windows.
  c.fillStyle = '#f8c858';
  c.fillRect(4, 36, 12, 12);
  c.fillRect(48, 36, 12, 12);
  c.fillStyle = '#3a2a22';
  c.fillRect(9, 36, 2, 12);
  c.fillRect(53, 36, 2, 12);
  // Hanging sign.
  c.fillStyle = '#3c2810';
  c.fillRect(12, 6, 40, 20);
  c.fillStyle = '#c89048';
  c.fillRect(14, 8, 36, 16);
  c.fillStyle = '#301c08';
  const cx = 32;
  const cy = 16;
  switch (icon) {
    case 'mug':
      c.fillRect(cx - 6, cy - 5, 10, 11);
      c.fillRect(cx + 4, cy - 2, 3, 5);
      c.fillStyle = '#fcfcfc';
      c.fillRect(cx - 6, cy - 6, 10, 3);
      break;
    case 'sack':
      c.beginPath();
      c.arc(cx, cy + 2, 6, 0, Math.PI * 2);
      c.fill();
      c.fillRect(cx - 2, cy - 7, 4, 4);
      break;
    case 'anvil':
      c.fillRect(cx - 9, cy - 4, 18, 4);
      c.fillRect(cx - 3, cy, 6, 4);
      c.fillRect(cx - 7, cy + 4, 14, 3);
      break;
    case 'ankh':
      c.lineWidth = 2;
      c.strokeStyle = '#301c08';
      c.beginPath();
      c.arc(cx, cy - 3, 3.5, 0, Math.PI * 2);
      c.stroke();
      c.fillRect(cx - 1, cy, 2, 8);
      c.fillRect(cx - 5, cy + 1, 10, 2);
      break;
    case 'eye':
      c.beginPath();
      c.ellipse(cx, cy, 9, 5, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#58b8ff';
      c.beginPath();
      c.arc(cx, cy, 3, 0, Math.PI * 2);
      c.fill();
      break;
  }
}

function torch(c: CanvasRenderingContext2D, r: () => number, base: string, brick: boolean, frame: number): void {
  if (brick) brickWall('#9c4c34')(c, r);
  else stoneWall(base, '#26262a')(c, r);
  // Warm glow on the wall.
  const g = c.createRadialGradient(32, 22, 2, 32, 22, 26);
  g.addColorStop(0, 'rgba(255,200,90,0.55)');
  g.addColorStop(1, 'rgba(255,160,40,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, TEX, TEX);
  // Sconce.
  c.fillStyle = '#3c3c44';
  c.fillRect(29, 30, 6, 14);
  c.fillRect(25, 42, 14, 3);
  c.fillStyle = '#7c4c24';
  c.fillRect(30, 24, 4, 8);
  // Flame (two frames).
  const flick = frame ? 2 : 0;
  c.fillStyle = '#ff7c10';
  c.beginPath();
  c.moveTo(27 - flick, 25);
  c.quadraticCurveTo(32, 4 + flick * 2, 37 + flick, 25);
  c.fill();
  c.fillStyle = '#ffe070';
  c.beginPath();
  c.moveTo(30, 25);
  c.quadraticCurveTo(32 + flick, 12 + flick * 2, 34, 25);
  c.fill();
}

function flagstones(base: string, mortar: string, seedExtra?: (c: CanvasRenderingContext2D, r: () => number) => void) {
  return (c: CanvasRenderingContext2D, r: () => number) => {
    c.fillStyle = mortar;
    c.fillRect(0, 0, TEX, TEX);
    const cells = [[0, 0, 32, 28], [32, 0, 32, 20], [0, 28, 20, 36], [20, 28, 44, 16], [32, 20, 32, 8], [20, 44, 22, 20], [42, 44, 22, 20]];
    for (const [x, y, w, h] of cells) {
      c.fillStyle = shade(base, Math.round((r() - 0.5) * 26));
      c.fillRect(x + 1, y + 1, w - 2, h - 2);
    }
    grain(c, r, base, 220, 14);
    seedExtra?.(c, r);
  };
}

function gate(c: CanvasRenderingContext2D, r: () => number, base: string): void {
  stoneWall(base, '#26262a')(c, r);
  c.fillStyle = '#d8d0e8';
  c.fillRect(8, 6, 48, 58);
  c.fillStyle = '#0a0a18';
  c.beginPath();
  c.moveTo(14, 64);
  c.lineTo(14, 26);
  c.arc(32, 26, 18, Math.PI, 0);
  c.lineTo(50, 64);
  c.fill();
  const g = c.createRadialGradient(32, 38, 2, 32, 38, 26);
  g.addColorStop(0, 'rgba(220,250,255,0.95)');
  g.addColorStop(0.5, 'rgba(90,200,255,0.8)');
  g.addColorStop(1, 'rgba(40,80,200,0.2)');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(16, 64);
  c.lineTo(16, 27);
  c.arc(32, 27, 16, Math.PI, 0);
  c.lineTo(48, 64);
  c.fill();
  for (let i = 0; i < 30; i++) {
    c.fillStyle = 'rgba(255,255,255,0.8)';
    c.fillRect(18 + Math.floor(r() * 28), 14 + Math.floor(r() * 48), 1, 1);
  }
}

export type Palette = 'stone' | 'moss' | 'basalt' | 'ice' | 'ember' | 'crypt' | 'desert' | 'cavern' | 'forest';

/** Built-in palettes: wall base colour, floor, ceiling. */
export const PALETTES: Record<Palette, { wall: string; floor: string; ceil: string }> = {
  stone: { wall: '#707078', floor: '#5c5448', ceil: '#2c2a2a' },
  moss: { wall: '#5c6c58', floor: '#4c5444', ceil: '#222822' },
  basalt: { wall: '#5c4c6c', floor: '#403848', ceil: '#1c1822' },
  ice: { wall: '#8ca4bc', floor: '#6c7c90', ceil: '#28303c' },
  ember: { wall: '#7c4c3c', floor: '#5c3c30', ceil: '#2c1810' },
  crypt: { wall: '#8c8474', floor: '#48443c', ceil: '#1a1816' },
  desert: { wall: '#c8a46c', floor: '#a8885c', ceil: '#3c3024' },
  cavern: { wall: '#6c6258', floor: '#4c443c', ceil: '#1c1a18' },
  forest: { wall: '#5c7048', floor: '#4c5c34', ceil: '#1c2418' },
};

export interface StyleSpec {
  palette?: Palette;
  wall?: string;
  floor?: string;
  ceiling?: string;
}

/** Palette-specific dressing painted over the plain stone. */
function dressing(palette: Palette | undefined): ((c: CanvasRenderingContext2D, r: () => number) => void) | undefined {
  switch (palette) {
    case 'moss':
      return (c, r) => {
        for (let k = 0; k < 40; k++) {
          c.fillStyle = r() < 0.5 ? '#3c6c30' : '#58843c';
          c.fillRect(Math.floor(r() * TEX), 40 + Math.floor(r() * 24), 3, 2);
        }
      };
    case 'ice':
      return (c, r) => {
        for (let k = 0; k < 30; k++) {
          c.fillStyle = 'rgba(230,248,255,0.8)';
          c.fillRect(Math.floor(r() * TEX), Math.floor(r() * 10), 1, 2 + Math.floor(r() * 6));
        }
      };
    case 'ember':
      return (c, r) => {
        c.strokeStyle = '#f87818';
        c.lineWidth = 1;
        for (let k = 0; k < 3; k++) {
          c.beginPath();
          let x = r() * TEX;
          let y = 20 + r() * 40;
          c.moveTo(x, y);
          for (let s = 0; s < 5; s++) {
            x += (r() - 0.5) * 14;
            y += r() * 6;
            c.lineTo(x, y);
          }
          c.stroke();
        }
      };
    case 'crypt':
      return (c, r) => {
        for (let k = 0; k < 4; k++) {
          const x = 6 + Math.floor(r() * 50);
          const y = 6 + Math.floor(r() * 50);
          c.fillStyle = '#d8d0c0';
          c.beginPath();
          c.arc(x, y, 3, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = '#201c18';
          c.fillRect(x - 2, y - 1, 1, 1);
          c.fillRect(x + 1, y - 1, 1, 1);
        }
      };
    default:
      return undefined;
  }
}

/** Builds the full texture set for one visual style. */
function buildSet(style: StyleSpec, seed: number): TextureSet {
  const pal = PALETTES[style.palette ?? 'stone'];
  const wallC = style.wall ?? pal.wall;
  const floorC = style.floor ?? pal.floor;
  const ceilC = style.ceiling ?? pal.ceil;
  const s = (n: number) => n + seed;
  const wall = stoneWall(wallC, '#26262a', dressing(style.palette));
  return {
    walls: {
      wall: paint(wall, s(1)),
      brick: paint(brickWall('#9c4c34'), s(2)),
      door: paint((c, r) => door(c, r, false), s(3)),
      locked: paint((c, r) => door(c, r, true), s(4)),
      stairsUp: paint((c, r) => stairs(c, r, false, wallC), s(5)),
      stairsDown: paint((c, r) => stairs(c, r, true, wallC), s(6)),
      shopTavern: paint((c, r) => shopFront(c, r, 'mug', '#7c4c24'), s(7)),
      shopProvisioner: paint((c, r) => shopFront(c, r, 'sack', '#4c7c34'), s(8)),
      shopSmithy: paint((c, r) => shopFront(c, r, 'anvil', '#5c5c64'), s(9)),
      shopTemple: paint((c, r) => shopFront(c, r, 'ankh', '#e8e0c8'), s(10)),
      shopGuild: paint((c, r) => shopFront(c, r, 'eye', '#384c9c'), s(11)),
      torch0: paint((c, r) => torch(c, r, wallC, false, 0), s(12)),
      torch1: paint((c, r) => torch(c, r, wallC, false, 1), s(12)),
      torchBrick0: paint((c, r) => torch(c, r, wallC, true, 0), s(13)),
      torchBrick1: paint((c, r) => torch(c, r, wallC, true, 1), s(13)),
      gate: paint((c, r) => gate(c, r, wallC), s(14)),
    },
    floors: {
      floor: paint(flagstones(floorC, '#1c1a18'), s(20)),
      ceil: paint(flagstones(ceilC, '#101010'), s(21)),
      market: paint(flagstones('#8c7c64', '#3c342c'), s(22)),
      marketCeil: paint((c, r) => {
        c.fillStyle = '#2c2018';
        c.fillRect(0, 0, TEX, TEX);
        for (let y = 0; y < TEX; y += 16) {
          c.fillStyle = '#4c3420';
          c.fillRect(0, y, TEX, 6);
        }
        grain(c, r, '#3c2c1c', 120);
      }, s(23)),
    },
  };
}

const SET_CACHE = new Map<string, TextureSet>();

/** The texture set for a level style (cached). */
export function textureSet(style: StyleSpec = {}): TextureSet {
  const key = JSON.stringify(style);
  let set = SET_CACHE.get(key);
  if (!set) {
    set = buildSet(style, SET_CACHE.size * 1000);
    SET_CACHE.set(key, set);
  }
  return set;
}

export type TexturePreset =
  | 'stone' | 'brick' | 'moss' | 'wood' | 'plain' | 'bone' | 'ice' | 'ember'
  | 'sandstone' | 'glyphs' | 'cave' | 'runes' | 'tapestry' | 'trees' | 'tent' | 'flame' | 'storm' | 'water'
  | 'sand' | 'grass' | 'rubble' | 'carpet' | 'sky' | 'gate';

export type TextureDef =
  | { preset: TexturePreset; color?: string; mortar?: string; accent?: string }
  | { image: string };

// --- Extra surfaces for pack textures ----------------------------------------------

type Painter = (c: CanvasRenderingContext2D, r: () => number) => void;

/** Draws a shape three times across the seam so the texture tiles horizontally. */
function wrapX(draw: (ox: number) => void): void {
  for (const ox of [-TEX, 0, TEX]) draw(ox);
}

/** Big, wind-worn ashlar courses (pyramids, desert ruins). */
function sandstone(base: string, mortar: string): Painter {
  return (c, r) => {
    c.fillStyle = mortar;
    c.fillRect(0, 0, TEX, TEX);
    const rows = [0, 21, 42, 64];
    for (let i = 0; i < 3; i++) {
      let x = i % 2 ? -16 : 0;
      while (x < TEX) {
        const w = 28 + Math.floor(r() * 10);
        c.fillStyle = shade(base, Math.round((r() - 0.5) * 22));
        c.fillRect(x + 1, rows[i] + 1, w - 1, rows[i + 1] - rows[i] - 1);
        c.fillStyle = shade(base, 16);
        c.fillRect(x + 1, rows[i] + 1, w - 1, 1);
        // Weathered lower edge.
        c.fillStyle = shade(base, -22);
        c.fillRect(x + 2, rows[i + 1] - 2, w - 3, 1);
        x += w;
      }
    }
    grain(c, r, base, 420, 14);
    for (let k = 0; k < 18; k++) {
      c.fillStyle = shade(base, -34);
      c.fillRect(Math.floor(r() * TEX), Math.floor(r() * TEX), 1, 1);
    }
  };
}

/** Sandstone carved with two bands of painted glyphs and a cartouche. */
function glyphWall(base: string, mortar: string, paintC: string): Painter {
  return (c, r) => {
    sandstone(base, mortar)(c, r);
    const cut = shade(base, -46);
    const band = (y: number) => {
      c.fillStyle = shade(base, -18);
      c.fillRect(0, y - 1, TEX, 1);
      c.fillRect(0, y + 15, TEX, 1);
      for (let x = 3; x < TEX - 8; x += 12) {
        const cx = x + 4;
        const cy = y + 7;
        c.fillStyle = cut;
        switch (Math.floor(r() * 6)) {
          case 0: // Eye.
            c.fillRect(cx - 4, cy, 9, 1);
            c.fillRect(cx - 3, cy - 2, 7, 1);
            c.fillRect(cx - 3, cy + 2, 7, 1);
            c.fillRect(cx - 1, cy + 3, 1, 3);
            c.fillStyle = paintC;
            c.fillRect(cx - 1, cy - 1, 3, 3);
            break;
          case 1: // Ankh.
            c.fillRect(cx - 1, cy - 5, 3, 1);
            c.fillRect(cx - 2, cy - 4, 1, 3);
            c.fillRect(cx + 2, cy - 4, 1, 3);
            c.fillRect(cx - 1, cy - 1, 3, 1);
            c.fillRect(cx - 3, cy, 7, 1);
            c.fillStyle = paintC;
            c.fillRect(cx, cy + 1, 1, 6);
            break;
          case 2: // Water.
            for (let k = 0; k < 3; k++) for (let dx = -4; dx <= 4; dx++) c.fillRect(cx + dx, cy - 3 + k * 3 + ((dx + 8) % 2), 1, 1);
            break;
          case 3: // Bird.
            c.fillRect(cx - 3, cy - 1, 6, 3);
            c.fillRect(cx + 2, cy - 4, 2, 3);
            c.fillRect(cx - 4, cy + 2, 2, 3);
            c.fillStyle = paintC;
            c.fillRect(cx + 4, cy - 3, 1, 1);
            c.fillRect(cx - 2, cy, 4, 1);
            break;
          case 4: // Sun disc.
            c.beginPath();
            c.arc(cx, cy, 3.5, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = paintC;
            c.beginPath();
            c.arc(cx, cy, 2, 0, Math.PI * 2);
            c.fill();
            break;
          default: // Standing figure.
            c.fillRect(cx - 1, cy - 6, 3, 3);
            c.fillRect(cx - 2, cy - 3, 5, 5);
            c.fillRect(cx - 2, cy + 2, 1, 5);
            c.fillRect(cx + 2, cy + 2, 1, 5);
            c.fillStyle = paintC;
            c.fillRect(cx - 2, cy - 1, 5, 1);
        }
      }
    };
    band(5);
    band(42);
    c.strokeStyle = cut;
    c.lineWidth = 1;
    c.strokeRect(20.5, 24.5, 23, 13);
    c.fillStyle = paintC;
    c.fillRect(24, 29, 4, 4);
    c.fillRect(31, 28, 2, 6);
    c.fillRect(36, 30, 4, 2);
  };
}

/** Rough natural rock: lumpy and cracked, no courses. */
function caveRock(base: string, dark: string): Painter {
  return (c, r) => {
    c.fillStyle = dark;
    c.fillRect(0, 0, TEX, TEX);
    for (let k = 0; k < 46; k++) {
      const x = r() * TEX;
      const y = r() * TEX;
      const rad = 5 + r() * 9;
      const squash = 0.6 + r() * 0.4;
      const rot = r() * Math.PI;
      const g = c.createRadialGradient(x - rad * 0.3, y - rad * 0.4, 1, x, y, rad);
      g.addColorStop(0, shade(base, 26 + Math.round(r() * 10)));
      g.addColorStop(0.7, shade(base, Math.round((r() - 0.5) * 20)));
      g.addColorStop(1, shade(base, -40));
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(x, y, rad, rad * squash, rot, 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = shade(dark, -10);
    c.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      c.beginPath();
      let x = r() * TEX;
      let y = r() * 20;
      c.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        x += (r() - 0.5) * 12;
        y += 4 + r() * 6;
        c.lineTo(x, y);
      }
      c.stroke();
    }
    grain(c, r, base, 300, 22);
  };
}

/** Black stone with a glowing sigil cut into it (summoning halls, demon temples). */
function runeWall(base: string, mortar: string, glow: string): Painter {
  return (c, r) => {
    stoneWall(base, mortar)(c, r);
    const halo = c.createRadialGradient(32, 32, 4, 32, 32, 34);
    halo.addColorStop(0, `${glow}55`);
    halo.addColorStop(1, `${glow}00`);
    c.fillStyle = halo;
    c.fillRect(0, 0, TEX, TEX);
    c.strokeStyle = glow;
    c.lineWidth = 1;
    c.beginPath();
    c.arc(32, 32, 12, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
      const x = 32 + Math.cos(a) * 11;
      const y = 32 + Math.sin(a) * 11;
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    c.closePath();
    c.stroke();
    c.fillStyle = glow;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const x = Math.round(32 + Math.cos(a) * 19);
      const y = Math.round(32 + Math.sin(a) * 19);
      c.fillRect(x, y - 2, 1, 5);
      const kind = Math.floor(r() * 3);
      if (kind === 0) c.fillRect(x - 1, y - 2, 3, 1);
      else if (kind === 1) c.fillRect(x + 1, y, 2, 1);
      else c.fillRect(x - 2, y + 1, 2, 1);
    }
    c.fillStyle = '#ffffff';
    c.fillRect(31, 31, 2, 2);
  };
}

/** A faded heraldic tapestry hung on stone. */
function tapestry(base: string, mortar: string, cloth: string): Painter {
  return (c, r) => {
    stoneWall(base, mortar)(c, r);
    c.fillStyle = '#3c2c14';
    c.fillRect(8, 3, 48, 3);
    c.fillStyle = cloth;
    c.fillRect(11, 6, 42, 50);
    c.fillStyle = '#c8a040';
    c.fillRect(11, 6, 42, 2);
    c.fillRect(11, 54, 42, 2);
    c.fillRect(11, 6, 2, 50);
    c.fillRect(51, 6, 2, 50);
    c.fillStyle = shade(cloth, 50);
    c.beginPath();
    c.moveTo(32, 14);
    c.lineTo(44, 20);
    c.lineTo(42, 36);
    c.lineTo(32, 46);
    c.lineTo(22, 36);
    c.lineTo(20, 20);
    c.closePath();
    c.fill();
    c.fillStyle = '#c8a040';
    c.fillRect(31, 18, 2, 22);
    c.fillRect(25, 25, 14, 2);
    for (let x = 12; x < 52; x += 2) {
      c.fillStyle = '#a88838';
      c.fillRect(x, 56, 1, 2 + Math.floor(r() * 4));
    }
    // Moth holes and tears.
    for (let k = 0; k < 7; k++) {
      c.fillStyle = mortar;
      c.fillRect(13 + Math.floor(r() * 36), 10 + Math.floor(r() * 42), 2 + Math.floor(r() * 3), 1 + Math.floor(r() * 2));
    }
    grain(c, r, cloth, 220, 16);
  };
}

/** A wall of dense forest: dark trunks under a canopy of leaves. */
function trees(leaf: string, bark: string): Painter {
  return (c, r) => {
    c.fillStyle = shade(leaf, -60);
    c.fillRect(0, 0, TEX, TEX);
    // Far trunks, then near ones.
    for (const [n, dark] of [[6, -50], [4, -10]] as [number, number][]) {
      for (let k = 0; k < n; k++) {
        const x = Math.floor(r() * TEX);
        const w = dark < -20 ? 3 + Math.floor(r() * 3) : 6 + Math.floor(r() * 5);
        wrapX((ox) => {
          c.fillStyle = shade(bark, dark);
          c.fillRect(x + ox, 16, w, 48);
          c.fillStyle = shade(bark, dark + 18);
          c.fillRect(x + ox, 16, 1, 48);
        });
        c.fillStyle = shade(bark, dark - 25);
        for (let y = 20; y < 64; y += 5 + Math.floor(r() * 4)) c.fillRect((x + 1 + Math.floor(r() * (w - 1))) % TEX, y, 1, 2);
      }
    }
    for (let k = 0; k < 70; k++) {
      const x = r() * TEX;
      const y = r() * 30;
      const rad = 3 + r() * 5;
      c.fillStyle = shade(leaf, Math.round((r() - 0.6) * 50));
      wrapX((ox) => {
        c.beginPath();
        c.arc(x + ox, y, rad, 0, Math.PI * 2);
        c.fill();
      });
    }
    for (let k = 0; k < 90; k++) {
      c.fillStyle = shade(leaf, Math.round((r() - 0.5) * 40));
      c.fillRect(Math.floor(r() * TEX), 52 + Math.floor(r() * 12), 1, 2 + Math.floor(r() * 4));
    }
  };
}

/** Striped tent cloth hanging in folds. */
function tent(base: string, stripe: string): Painter {
  return (c, r) => {
    const fold = (x: number) => Math.round(Math.sin((x / TEX) * Math.PI * 6) * 18);
    for (let x = 0; x < TEX; x++) {
      c.fillStyle = shade(base, fold(x));
      c.fillRect(x, 0, 1, TEX);
      c.fillStyle = shade(stripe, fold(x));
      for (const y of [8, 12, 50, 54]) c.fillRect(x, y, 1, 3);
    }
    c.fillStyle = stripe;
    for (let x = 4; x < TEX; x += 10) {
      c.beginPath();
      c.moveTo(x, 31);
      c.lineTo(x + 4, 27);
      c.lineTo(x + 8, 31);
      c.lineTo(x + 4, 35);
      c.fill();
    }
    grain(c, r, base, 260, 10);
  };
}

/** A roaring wall of flame. */
const flameWall: Painter = (c, r) => {
  const g = c.createLinearGradient(0, 0, 0, TEX);
  g.addColorStop(0, '#5c0c00');
  g.addColorStop(0.4, '#d83808');
  g.addColorStop(0.8, '#f8a018');
  g.addColorStop(1, '#fff0a0');
  c.fillStyle = g;
  c.fillRect(0, 0, TEX, TEX);
  for (let k = 0; k < 16; k++) {
    const x = r() * TEX;
    const h = 20 + r() * 36;
    const bend = (r() - 0.5) * 10;
    const tip = (r() - 0.5) * 6;
    c.fillStyle = r() < 0.5 ? '#f87818' : '#ffd040';
    wrapX((ox) => {
      c.beginPath();
      c.moveTo(x + ox - 5, TEX);
      c.quadraticCurveTo(x + ox + bend, TEX - h * 0.6, x + ox + tip, TEX - h);
      c.quadraticCurveTo(x + ox + 2, TEX - h * 0.4, x + ox + 5, TEX);
      c.fill();
    });
  }
  for (let k = 0; k < 40; k++) {
    c.fillStyle = 'rgba(255,248,200,0.9)';
    c.fillRect(Math.floor(r() * TEX), Math.floor(r() * 40), 1, 1);
  }
};

/** A roiling black cloud shot through with lightning. */
function storm(base: string, bolt: string): Painter {
  return (c, r) => {
    c.fillStyle = shade(base, -20);
    c.fillRect(0, 0, TEX, TEX);
    for (let k = 0; k < 40; k++) {
      const x = r() * TEX;
      const y = r() * TEX;
      const rad = 6 + r() * 10;
      c.fillStyle = shade(base, Math.round((r() - 0.3) * 40));
      wrapX((ox) => {
        c.beginPath();
        c.arc(x + ox, y, rad, 0, Math.PI * 2);
        c.fill();
      });
    }
    c.strokeStyle = bolt;
    c.lineWidth = 1;
    for (let k = 0; k < 3; k++) {
      let x = 8 + r() * 48;
      let y = r() * 10;
      c.beginPath();
      c.moveTo(x, y);
      while (y < TEX) {
        x += (r() - 0.5) * 14;
        y += 4 + r() * 8;
        c.lineTo(x, y);
      }
      c.stroke();
    }
  };
}

/** Still liquid: a moat or a pool, catching the light in ripples. */
function water(base: string, shine: string): Painter {
  return (c, r) => {
    c.fillStyle = base;
    c.fillRect(0, 0, TEX, TEX);
    c.fillStyle = shine;
    for (let y = 0; y < TEX; y += 4)
      for (let x = 0; x < TEX; x++) if (Math.sin(x * 0.35 + y * 1.7 + r() * 0.6) > 0.82) c.fillRect(x, y, 1, 1);
    grain(c, r, base, 200, 12);
  };
}

/** Wind-rippled sand. */
function sand(base: string): Painter {
  return (c, r) => {
    c.fillStyle = base;
    c.fillRect(0, 0, TEX, TEX);
    for (let y = 0; y < TEX; y += 8)
      for (let x = 0; x < TEX; x++) {
        const yy = y + Math.round(Math.sin((x / TEX) * Math.PI * 4) * 1.5);
        c.fillStyle = shade(base, 18);
        c.fillRect(x, (yy + TEX) % TEX, 1, 1);
        c.fillStyle = shade(base, -16);
        c.fillRect(x, (yy + 1 + TEX) % TEX, 1, 1);
      }
    grain(c, r, base, 500, 12);
  };
}

/** Grass over patches of bare earth. */
function grass(base: string): Painter {
  return (c, r) => {
    c.fillStyle = shade(base, -12);
    c.fillRect(0, 0, TEX, TEX);
    for (let k = 0; k < 6; k++) {
      c.fillStyle = shade('#6c5438', Math.round((r() - 0.5) * 20));
      c.fillRect(Math.floor(r() * TEX), Math.floor(r() * TEX), 3 + Math.floor(r() * 4), 2 + Math.floor(r() * 2));
    }
    for (let k = 0; k < 900; k++) {
      c.fillStyle = shade(base, Math.round((r() - 0.4) * 44));
      c.fillRect(Math.floor(r() * TEX), Math.floor(r() * TEX), 1, 1 + Math.floor(r() * 2));
    }
  };
}

/** Packed earth strewn with pebbles and broken rock. */
function rubble(base: string): Painter {
  return (c, r) => {
    c.fillStyle = base;
    c.fillRect(0, 0, TEX, TEX);
    grain(c, r, base, 700, 16);
    for (let k = 0; k < 26; k++) {
      const x = Math.floor(r() * TEX);
      const y = Math.floor(r() * TEX);
      const w = 2 + Math.floor(r() * 4);
      const h = 1 + Math.floor(r() * 3);
      c.fillStyle = shade(base, 30 + Math.round(r() * 20));
      c.fillRect(x, y, w, h);
      c.fillStyle = shade(base, -30);
      c.fillRect(x, y + h, w, 1);
    }
  };
}

/** A woven rug: a patterned border round a central medallion. */
function carpet(base: string, trim: string): Painter {
  return (c, r) => {
    c.fillStyle = base;
    c.fillRect(0, 0, TEX, TEX);
    c.fillStyle = trim;
    c.fillRect(0, 0, TEX, 3);
    c.fillRect(0, 0, 3, TEX);
    for (let i = 6; i < TEX; i += 8) {
      c.fillRect(i, 6, 3, 3);
      c.fillRect(6, i, 3, 3);
    }
    c.beginPath();
    c.moveTo(36, 18);
    c.lineTo(54, 36);
    c.lineTo(36, 54);
    c.lineTo(18, 36);
    c.closePath();
    c.fill();
    c.fillStyle = base;
    c.fillRect(33, 33, 6, 6);
    grain(c, r, base, 420, 14);
  };
}

/** Open sky with drifting cloud - give a floor texture "<id>Ceil" this to put sky over it. */
function sky(base: string): Painter {
  return (c, r) => {
    c.fillStyle = base;
    c.fillRect(0, 0, TEX, TEX);
    for (let k = 0; k < 7; k++) {
      const x = r() * TEX;
      const y = r() * TEX;
      for (let p = 0; p < 5; p++) {
        const px = x + p * 4 - 8;
        const py = y + (r() - 0.5) * 3;
        const rx = 5 + r() * 4;
        const ry = 2 + r() * 2;
        c.fillStyle = `rgba(255,255,255,${0.16 + r() * 0.2})`;
        for (const oy of [-TEX, 0, TEX])
          wrapX((ox) => {
            c.beginPath();
            c.ellipse(px + ox, py + oy, rx, ry, 0, 0, Math.PI * 2);
            c.fill();
          });
      }
    }
  };
}

function presetTexture(def: Extract<TextureDef, { preset: string }>, seed: number): Texture {
  const color = def.color ?? '#707078';
  const mortar = def.mortar ?? '#26262a';
  switch (def.preset) {
    case 'sandstone':
      return paint(sandstone(def.color ?? '#c8a46c', def.mortar ?? '#7c6440'), seed);
    case 'glyphs':
      return paint(glyphWall(def.color ?? '#c8a46c', def.mortar ?? '#7c6440', def.accent ?? '#2c6ca8'), seed);
    case 'cave':
      return paint(caveRock(def.color ?? '#6c6258', def.mortar ?? '#1c1814'), seed);
    case 'runes':
      return paint(runeWall(def.color ?? '#2c2830', def.mortar ?? '#0c0a0e', def.accent ?? '#f83c28'), seed);
    case 'tapestry':
      return paint(tapestry(color, mortar, def.accent ?? '#7c1c24'), seed);
    case 'trees':
      return paint(trees(def.color ?? '#3c6c30', def.accent ?? '#4c3824'), seed);
    case 'tent':
      return paint(tent(def.color ?? '#2c2424', def.accent ?? '#a82c20'), seed);
    case 'flame':
      return paint(flameWall, seed);
    case 'storm':
      return paint(storm(def.color ?? '#2c2838', def.accent ?? '#c8e0ff'), seed);
    case 'water':
      return paint(water(def.color ?? '#3c6c8c', def.accent ?? '#c8e8f8'), seed);
    case 'sand':
      return paint(sand(def.color ?? '#d8b87c'), seed);
    case 'grass':
      return paint(grass(def.color ?? '#4c7c34'), seed);
    case 'rubble':
      return paint(rubble(def.color ?? '#5c5044'), seed);
    case 'carpet':
      return paint(carpet(def.color ?? '#7c1c24', def.accent ?? '#c8a040'), seed);
    case 'sky':
      return paint(sky(def.color ?? '#5890d8'), seed);
    case 'gate':
      return paint((c, r) => gate(c, r, color), seed);
    case 'brick':
      return paint(brickWall(color), seed);
    case 'wood':
      return paint((c, r) => {
        c.fillStyle = shade(color, -40);
        c.fillRect(0, 0, TEX, TEX);
        for (let x = 0; x < TEX; x += 8) {
          c.fillStyle = shade(color, Math.round((r() - 0.5) * 30));
          c.fillRect(x, 0, 7, TEX);
        }
        grain(c, r, color, 200);
      }, seed);
    case 'plain':
      return paint((c, r) => {
        c.fillStyle = color;
        c.fillRect(0, 0, TEX, TEX);
        grain(c, r, color, 300, 10);
      }, seed);
    case 'moss':
      return paint(stoneWall(color, mortar, dressing('moss')), seed);
    case 'bone':
      return paint(stoneWall(color, mortar, dressing('crypt')), seed);
    case 'ice':
      return paint(stoneWall(color, mortar, dressing('ice')), seed);
    case 'ember':
      return paint(stoneWall(color, mortar, dressing('ember')), seed);
    default:
      return paint(stoneWall(color, mortar), seed);
  }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Couldn't load image ${src.slice(0, 60)}`));
    img.src = src;
  });
}

/** A pack's custom wall/floor textures, keyed by id (images are resampled to 64x64). */
export async function loadPackTextures(defs: Record<string, TextureDef> | undefined): Promise<Record<string, Texture>> {
  const out: Record<string, Texture> = {};
  let seed = 5000;
  for (const [id, def] of Object.entries(defs ?? {})) {
    if ('preset' in def) {
      out[id] = presetTexture(def, seed++);
      continue;
    }
    const img = await loadImage(def.image);
    const cv = document.createElement('canvas');
    cv.width = cv.height = TEX;
    const c = cv.getContext('2d', { willReadFrequently: true })!;
    c.imageSmoothingEnabled = false;
    c.drawImage(img, 0, 0, TEX, TEX);
    out[id] = new Uint32Array(c.getImageData(0, 0, TEX, TEX).data.buffer.slice(0));
  }
  return out;
}
