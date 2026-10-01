import { TRACK_SIZE } from './config';

/**
 * The three Turbo Kart tracks. Each is a closed Catmull-Rom loop of control
 * points; `buildTrack` turns that into everything a race needs:
 *  - a TRACK_SIZE^2 canvas painted with the track (the Mode-7 floor texture)
 *  - a low-res surface map for physics (out of bounds / offroad / road / boost / ice)
 *  - the centreline (evenly spaced samples) plus a racing line for the AI
 *  - roadside decorations, item-box rows, boost pads and the starting grid
 *  - a panoramic sky strip for the horizon
 */

export type ThemeId = 'meadow' | 'canyon' | 'frost';

export const SURFACE = { OUT: 0, OFFROAD: 1, ROAD: 2, BOOST: 3, ICE: 4 } as const;
export type Surface = (typeof SURFACE)[keyof typeof SURFACE];

export type DecorKind = 'tree' | 'bush' | 'flowers' | 'tires' | 'cactus' | 'rock' | 'barrel' | 'pine' | 'snowman' | 'crystal';

interface Theme {
  ground: [string, string];
  out: [string, string];
  rim: string;
  road: string;
  curb: [string, string];
  fog: string;
  skyTop: string;
  skyHorizon: string;
  far: string;
  near: string;
  decor: DecorKind[];
  /** Solid decorations karts bounce off (others are drive-through). */
  solid: DecorKind[];
}

const THEMES: Record<ThemeId, Theme> = {
  meadow: {
    ground: ['#58b038', '#4ca030'],
    out: ['#2c6cd8', '#3c7ce8'],
    rim: '#f0e8c8',
    road: '#70707a',
    curb: ['#fcfcfc', '#e83030'],
    fog: '#c8ecff',
    skyTop: '#3080f8',
    skyHorizon: '#c8ecff',
    far: '#8cc8a0',
    near: '#3c9840',
    decor: ['tree', 'tree', 'bush', 'flowers', 'tires'],
    solid: ['tree', 'tires'],
  },
  canyon: {
    ground: ['#e0b068', '#d4a45c'],
    out: ['#8c4c2c', '#7c4024'],
    rim: '#5c2c18',
    road: '#6c5c54',
    curb: ['#fcfcfc', '#f07818'],
    fog: '#f8d0a0',
    skyTop: '#f06830',
    skyHorizon: '#f8d8a0',
    far: '#c87048',
    near: '#a04c2c',
    decor: ['cactus', 'cactus', 'rock', 'barrel'],
    solid: ['cactus', 'rock', 'barrel'],
  },
  frost: {
    ground: ['#f4faff', '#e4eefa'],
    out: ['#284c80', '#305890'],
    rim: '#c8d8f0',
    road: '#5c6480',
    curb: ['#fcfcfc', '#3878f0'],
    fog: '#dce8f8',
    skyTop: '#5868c0',
    skyHorizon: '#e0ecfc',
    far: '#b8c8e8',
    near: '#f8fcff',
    decor: ['pine', 'pine', 'snowman', 'crystal'],
    solid: ['pine', 'snowman'],
  },
};

export interface TrackDef {
  id: string;
  name: string;
  theme: ThemeId;
  music: 'kartMeadow' | 'kartCanyon' | 'kartFrost';
  points: [number, number][];
  roadWidth: number;
  /** Width of the offroad band either side of the road before the barrier. */
  offroad: number;
  /** Fractions of a lap where rows of item boxes sit. */
  itemRows: number[];
  /** Boost pads: [lap fraction, lateral offset -1..1]. */
  boosts: [number, number][];
  /** Ice patches (frost only): [lap fraction, lateral offset]. */
  ice?: [number, number][];
  blurb: string;
}

export const TRACKS: TrackDef[] = [
  {
    id: 'meadow',
    name: 'Meadow Circuit',
    theme: 'meadow',
    music: 'kartMeadow',
    blurb: 'Sweeping bends through the hills. A gentle start.',
    points: [[420, 1620], [380, 900], [470, 520], [800, 380], [1250, 420], [1620, 620], [1680, 980], [1380, 1140], [1180, 1300], [1330, 1480], [1680, 1560], [1700, 1800], [1300, 1880], [800, 1860]],
    roadWidth: 140,
    offroad: 90,
    itemRows: [0.16, 0.47, 0.76],
    boosts: [[0.33, -0.3], [0.9, 0.3]],
  },
  {
    id: 'canyon',
    name: 'Canyon Run',
    theme: 'canyon',
    music: 'kartCanyon',
    blurb: 'Tight hairpins between the mesas. Drift or crash.',
    points: [[320, 1720], [300, 760], [420, 380], [760, 330], [900, 620], [880, 1040], [1100, 1180], [1320, 980], [1300, 560], [1480, 300], [1800, 420], [1820, 900], [1640, 1300], [1760, 1640], [1480, 1840], [900, 1760], [620, 1880]],
    roadWidth: 130,
    offroad: 80,
    itemRows: [0.12, 0.42, 0.7],
    boosts: [[0.07, 0], [0.56, -0.3], [0.86, 0.3]],
  },
  {
    id: 'frost',
    name: 'Frost Pass',
    theme: 'frost',
    music: 'kartFrost',
    blurb: 'A winding mountain road with slippery ice.',
    points: [[300, 1000], [360, 480], [760, 300], [1080, 520], [960, 860], [700, 980], [760, 1260], [1100, 1360], [1360, 1100], [1300, 700], [1520, 420], [1820, 560], [1800, 1100], [1700, 1560], [1300, 1800], [800, 1760], [420, 1560]],
    roadWidth: 130,
    offroad: 70,
    itemRows: [0.14, 0.45, 0.73],
    boosts: [[0.3, 0.25], [0.62, -0.25], [0.95, 0]],
    ice: [[0.22, -0.2], [0.38, 0.3], [0.52, 0], [0.68, -0.35], [0.83, 0.25]],
  },
];

export interface TrackPoint {
  x: number;
  y: number;
  /** Heading of the track here (radians, y-down world). */
  a: number;
  /** Signed curvature (radians per unit, + = turning right). */
  k: number;
}

export interface Decor {
  kind: DecorKind;
  x: number;
  y: number;
  solid: boolean;
}

export interface GridSlot {
  x: number;
  y: number;
  a: number;
}

export interface TrackData {
  def: TrackDef;
  theme: Theme;
  texture: HTMLCanvasElement;
  sky: HTMLCanvasElement;
  mask: Uint8Array;
  pts: TrackPoint[];
  /** AI racing line, one point per centreline sample. */
  line: { x: number; y: number }[];
  /** Spacing between centreline samples. */
  step: number;
  length: number;
  decor: Decor[];
  boxes: { x: number; y: number }[];
  grid: GridSlot[];
  surfaceAt(x: number, y: number): Surface;
  /** Nearest centreline index to (x, y), searching around `hint` (or everywhere when hint < 0). */
  nearest(x: number, y: number, hint?: number, window?: number): number;
}

const MASK_SCALE = 4;
const MASK_SIZE = TRACK_SIZE / MASK_SCALE;
const STEP = 8;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function catmullRom(points: [number, number][], perSeg = 24): [number, number][] {
  const out: [number, number][] = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    for (let s = 0; s < perSeg; s++) {
      const t = s / perSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (j: 0 | 1) =>
        0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3);
      out.push([f(0), f(1)]);
    }
  }
  return out;
}

/** Resamples a closed polyline to points exactly `step` apart. */
function resample(poly: [number, number][], step: number): [number, number][] {
  const out: [number, number][] = [];
  let carry = 0;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    const seg = Math.hypot(bx - ax, by - ay);
    let d = carry;
    while (d < seg) {
      const t = d / seg;
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
      d += step;
    }
    carry = d - seg;
  }
  return out;
}

function angleDiff(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function pattern(ctx: CanvasRenderingContext2D, size: number, draw: (c: CanvasRenderingContext2D) => void): CanvasPattern {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d')!;
  draw(c);
  return ctx.createPattern(cv, 'repeat')!;
}

function speckle(c: CanvasRenderingContext2D, size: number, colors: string[], count: number, rng: () => number, dot = 2): void {
  for (let i = 0; i < count; i++) {
    c.fillStyle = colors[i % colors.length];
    c.fillRect(Math.floor(rng() * size), Math.floor(rng() * size), dot, dot);
  }
}

function shade(hex: string, amt: number): string {
  const v = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.max(0, Math.min(255, ((v >> s) & 255) + amt));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

export function buildTrack(def: TrackDef): TrackData {
  const theme = THEMES[def.theme];
  const rng = mulberry32(def.id.length * 977 + def.points.length * 31);

  // --- Centreline -------------------------------------------------------------
  const raw = resample(catmullRom(def.points), STEP);
  const pts: TrackPoint[] = raw.map(([x, y], i) => {
    const [nx, ny] = raw[(i + 1) % raw.length];
    return { x, y, a: Math.atan2(ny - y, nx - x), k: 0 };
  });
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[(i - 3 + pts.length) % pts.length];
    const next = pts[(i + 3) % pts.length];
    pts[i].k = angleDiff(prev.a, next.a) / (6 * STEP);
  }
  const length = pts.length * STEP;

  // Racing line: cut to the inside of bends (smoothed curvature, clamped).
  const smoothK = pts.map((_, i) => {
    let s = 0;
    for (let j = -12; j <= 12; j++) s += pts[(i + j + pts.length) % pts.length].k;
    return s / 25;
  });
  const line = pts.map((p, i) => {
    const off = Math.max(-1, Math.min(1, smoothK[i] * 90)) * def.roadWidth * 0.32;
    return { x: p.x - Math.sin(p.a) * off, y: p.y + Math.cos(p.a) * off };
  });

  const at = (frac: number, lateral: number) => {
    const p = pts[Math.floor(((frac % 1) + 1) % 1 * pts.length) % pts.length];
    const off = lateral * def.roadWidth * 0.5;
    return { x: p.x - Math.sin(p.a) * off, y: p.y + Math.cos(p.a) * off, a: p.a };
  };

  // --- Texture ----------------------------------------------------------------
  const texture = document.createElement('canvas');
  texture.width = texture.height = TRACK_SIZE;
  const ctx = texture.getContext('2d')!;
  const loop = (c: CanvasRenderingContext2D, scale = 1) => {
    c.beginPath();
    pts.forEach((p, i) => (i === 0 ? c.moveTo(p.x * scale, p.y * scale) : c.lineTo(p.x * scale, p.y * scale)));
    c.closePath();
  };
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const outPat = pattern(ctx, 64, (c) => {
    c.fillStyle = theme.out[0];
    c.fillRect(0, 0, 64, 64);
    c.fillStyle = theme.out[1];
    c.fillRect(0, 0, 32, 32);
    c.fillRect(32, 32, 32, 32);
    if (def.theme !== 'canyon') {
      c.fillStyle = 'rgba(255,255,255,0.35)';
      for (const [x, y] of [[6, 12], [38, 44], [22, 54], [50, 20]]) c.fillRect(x, y, 8, 2);
    } else {
      speckle(c, 64, ['#6c3018', '#a05c38'], 40, rng, 3);
    }
  });
  ctx.fillStyle = outPat;
  ctx.fillRect(0, 0, TRACK_SIZE, TRACK_SIZE);

  const groundW = def.roadWidth + def.offroad * 2;
  loop(ctx);
  ctx.strokeStyle = theme.rim;
  ctx.lineWidth = groundW + 22;
  ctx.stroke();

  const groundPat = pattern(ctx, 64, (c) => {
    c.fillStyle = theme.ground[0];
    c.fillRect(0, 0, 64, 64);
    c.fillStyle = theme.ground[1];
    c.fillRect(0, 0, 32, 32);
    c.fillRect(32, 32, 32, 32);
    speckle(c, 64, [shade(theme.ground[0], -24), shade(theme.ground[0], 20)], 30, rng);
  });
  loop(ctx);
  ctx.strokeStyle = groundPat;
  ctx.lineWidth = groundW;
  ctx.stroke();

  loop(ctx);
  ctx.strokeStyle = theme.curb[0];
  ctx.lineWidth = def.roadWidth + 20;
  ctx.stroke();
  // Butt caps, or each dash's round cap would fill the gaps between them.
  ctx.lineCap = 'butt';
  ctx.setLineDash([26, 26]);
  loop(ctx);
  ctx.strokeStyle = theme.curb[1];
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineCap = 'round';

  const roadPat = pattern(ctx, 64, (c) => {
    c.fillStyle = theme.road;
    c.fillRect(0, 0, 64, 64);
    speckle(c, 64, [shade(theme.road, -14), shade(theme.road, 12), shade(theme.road, 6)], 90, rng);
  });
  loop(ctx);
  ctx.strokeStyle = roadPat;
  ctx.lineWidth = def.roadWidth;
  ctx.stroke();

  // Faint dashed centre line.
  ctx.setLineDash([30, 50]);
  loop(ctx);
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.setLineDash([]);

  const stamp = (x: number, y: number, a: number, draw: (c: CanvasRenderingContext2D) => void, c = ctx) => {
    c.save();
    c.translate(x, y);
    c.rotate(a);
    draw(c);
    c.restore();
  };

  // Start / finish line: a checkered strip across the road.
  const start = pts[0];
  stamp(start.x, start.y, start.a, (c) => {
    const cell = 12;
    const half = def.roadWidth / 2;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col * cell < def.roadWidth; col++) {
        c.fillStyle = (row + col) % 2 ? '#101010' : '#fcfcfc';
        c.fillRect(-cell * 1.5 + row * cell, -half + col * cell, cell, cell);
      }
    }
  });
  // Grid boxes behind the line.
  const grid: GridSlot[] = [];
  const gridSlots: [number, number][] = [[4, -0.35], [9, 0.35], [14, -0.1]];
  for (const [back, lat] of gridSlots) {
    const p = pts[(pts.length - back) % pts.length];
    const off = lat * def.roadWidth * 0.5;
    const g = { x: p.x - Math.sin(p.a) * off, y: p.y + Math.cos(p.a) * off, a: p.a };
    grid.push(g);
    stamp(g.x, g.y, g.a, (c) => {
      c.strokeStyle = 'rgba(255,255,255,0.7)';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(14, -14);
      c.lineTo(-14, -14);
      c.moveTo(14, 14);
      c.lineTo(-14, 14);
      c.moveTo(14, -14);
      c.lineTo(14, 14);
      c.stroke();
    });
  }

  // Boost pads: yellow panels with chevrons pointing along the track.
  const boostSpots = def.boosts.map(([f, lat]) => at(f, lat));
  for (const b of boostSpots) {
    stamp(b.x, b.y, b.a, (c) => {
      c.fillStyle = '#f8b800';
      c.fillRect(-26, -18, 52, 36);
      c.fillStyle = '#fc5800';
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.moveTo(-20 + i * 15, -13);
        c.lineTo(-8 + i * 15, 0);
        c.lineTo(-20 + i * 15, 13);
        c.lineTo(-14 + i * 15, 13);
        c.lineTo(-2 + i * 15, 0);
        c.lineTo(-14 + i * 15, -13);
        c.fill();
      }
    });
  }

  const iceSpots = (def.ice ?? []).map(([f, lat]) => at(f, lat));
  for (const s of iceSpots) {
    stamp(s.x, s.y, s.a, (c) => {
      c.fillStyle = 'rgba(190,236,255,0.9)';
      c.beginPath();
      c.ellipse(0, 0, 70, 34, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.8)';
      c.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.moveTo(-40 + i * 22, -10 + (i % 2) * 14);
        c.lineTo(-24 + i * 22, -2 + (i % 2) * 6);
        c.stroke();
      }
    });
  }

  // Subtle per-pixel grain so large flat areas don't band in the distance.
  const img = ctx.getImageData(0, 0, TRACK_SIZE, TRACK_SIZE);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.imul(i, 2654435761) >>> 28) - 8;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  // --- Surface mask -----------------------------------------------------------
  const maskCv = document.createElement('canvas');
  maskCv.width = maskCv.height = MASK_SIZE;
  const m = maskCv.getContext('2d')!;
  m.imageSmoothingEnabled = false;
  m.lineJoin = 'round';
  m.lineCap = 'round';
  const s = 1 / MASK_SCALE;
  const level = (v: number) => `rgb(${v * 60},0,0)`;
  m.fillStyle = level(SURFACE.OUT);
  m.fillRect(0, 0, MASK_SIZE, MASK_SIZE);
  loop(m, s);
  m.strokeStyle = level(SURFACE.OFFROAD);
  m.lineWidth = groundW * s;
  m.stroke();
  loop(m, s);
  m.strokeStyle = level(SURFACE.ROAD);
  m.lineWidth = (def.roadWidth + 20) * s;
  m.stroke();
  for (const b of boostSpots) {
    stamp(b.x * s, b.y * s, b.a, (c) => {
      c.fillStyle = level(SURFACE.BOOST);
      c.fillRect(-26 * s, -18 * s, 52 * s, 36 * s);
    }, m);
  }
  for (const p of iceSpots) {
    stamp(p.x * s, p.y * s, p.a, (c) => {
      c.fillStyle = level(SURFACE.ICE);
      c.beginPath();
      c.ellipse(0, 0, 70 * s, 34 * s, 0, 0, Math.PI * 2);
      c.fill();
    }, m);
  }
  const mdata = m.getImageData(0, 0, MASK_SIZE, MASK_SIZE).data;
  const mask = new Uint8Array(MASK_SIZE * MASK_SIZE);
  for (let i = 0; i < mask.length; i++) mask[i] = Math.round(mdata[i * 4] / 60);

  const surfaceAt = (x: number, y: number): Surface => {
    const mx = Math.floor(x / MASK_SCALE);
    const my = Math.floor(y / MASK_SCALE);
    if (mx < 0 || my < 0 || mx >= MASK_SIZE || my >= MASK_SIZE) return SURFACE.OUT;
    return mask[my * MASK_SIZE + mx] as Surface;
  };

  // --- Decorations --------------------------------------------------------------
  const decor: Decor[] = [];
  for (let i = 0; i < pts.length; i += 11) {
    for (const side of [-1, 1]) {
      if (rng() < 0.3) continue;
      const p = pts[i];
      const off = side * (def.roadWidth / 2 + 26 + rng() * (def.offroad - 30));
      const x = p.x - Math.sin(p.a) * off;
      const y = p.y + Math.cos(p.a) * off;
      if (surfaceAt(x, y) !== SURFACE.OFFROAD) continue;
      // Keep clear of any other stretch of road that runs close by.
      if (surfaceAt(x + 20, y) === SURFACE.ROAD || surfaceAt(x - 20, y) === SURFACE.ROAD || surfaceAt(x, y + 20) === SURFACE.ROAD || surfaceAt(x, y - 20) === SURFACE.ROAD) continue;
      const kind = theme.decor[Math.floor(rng() * theme.decor.length)];
      if (decor.some((o) => Math.hypot(o.x - x, o.y - y) < 40)) continue;
      decor.push({ kind, x, y, solid: theme.solid.includes(kind) });
    }
  }
  // Scenery out in the no-go zone, so the horizon isn't empty.
  for (let i = 0; i < 90; i++) {
    const x = rng() * TRACK_SIZE;
    const y = rng() * TRACK_SIZE;
    if (surfaceAt(x, y) !== SURFACE.OUT || def.theme === 'meadow') continue;
    decor.push({ kind: def.theme === 'canyon' ? 'rock' : 'pine', x, y, solid: false });
  }

  const boxes: { x: number; y: number }[] = [];
  for (const f of def.itemRows) for (const lat of [-0.6, -0.2, 0.2, 0.6]) boxes.push(at(f, lat));

  // --- Sky ------------------------------------------------------------------
  // One full 360-degree panorama.
  const SKY_W = 4096;
  const sky = document.createElement('canvas');
  sky.width = SKY_W;
  sky.height = 256;
  const sc = sky.getContext('2d')!;
  const grad = sc.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, theme.skyTop);
  grad.addColorStop(1, theme.skyHorizon);
  sc.fillStyle = grad;
  sc.fillRect(0, 0, SKY_W, 256);
  if (def.theme === 'canyon') {
    sc.fillStyle = '#fce070';
    sc.beginPath();
    sc.arc(2800, 150, 46, 0, Math.PI * 2);
    sc.fill();
  }
  // Clouds.
  sc.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 22; i++) {
    const cx = (i * 587 + 40) % SKY_W;
    const cy = 40 + ((i * 53) % 60);
    for (let j = 0; j < 4; j++) {
      sc.beginPath();
      sc.ellipse(cx + j * 18, cy - (j % 2) * 8, 22, 12, 0, 0, Math.PI * 2);
      sc.fill();
    }
  }
  const ridge = (color: string, base: number, amp: number, freqs: number[], blocky: boolean) => {
    sc.fillStyle = color;
    sc.beginPath();
    sc.moveTo(0, 256);
    for (let x = 0; x <= SKY_W; x += 4) {
      let h = 0;
      freqs.forEach((f, i) => (h += Math.sin((x / SKY_W) * Math.PI * 2 * f + i * 1.7) / (i + 1)));
      let y = base - h * amp;
      if (blocky) y = Math.round(y / 18) * 18;
      sc.lineTo(x, y);
    }
    sc.lineTo(SKY_W, 256);
    sc.fill();
  };
  ridge(theme.far, 190, 40, [5, 11, 23], def.theme === 'canyon');
  ridge(theme.near, 230, 22, [7, 17, 31], def.theme === 'canyon');
  if (def.theme === 'frost') {
    // Snowy peaks on the far ridge.
    sc.fillStyle = '#ffffff';
    for (let i = 0; i < 18; i++) {
      const x = 80 + i * 228;
      sc.beginPath();
      sc.moveTo(x - 60, 200);
      sc.lineTo(x, 110 + (i % 3) * 14);
      sc.lineTo(x + 60, 200);
      sc.fill();
    }
  }

  const nearest = (x: number, y: number, hint = -1, window = 40): number => {
    let best = 0;
    let bestD = Infinity;
    const n = pts.length;
    const from = hint < 0 ? 0 : hint - window;
    const to = hint < 0 ? n : hint + window;
    for (let j = from; j < to; j++) {
      const i = ((j % n) + n) % n;
      const dd = (pts[i].x - x) ** 2 + (pts[i].y - y) ** 2;
      if (dd < bestD) {
        bestD = dd;
        best = i;
      }
    }
    return best;
  };

  return { def, theme, texture, sky, mask, pts, line, step: STEP, length, decor, boxes, grid, surfaceAt, nearest };
}

export function themeFog(t: TrackData): number {
  return parseInt(t.theme.fog.slice(1), 16);
}

export function themeOut(t: TrackData): number {
  return parseInt(t.theme.out[0].slice(1), 16);
}

const cache = new Map<string, TrackData>();

/** Builds a track once and reuses it for later races. */
export function getTrack(def: TrackDef): TrackData {
  let t = cache.get(def.id);
  if (!t) {
    t = buildTrack(def);
    cache.set(def.id, t);
  }
  return t;
}
