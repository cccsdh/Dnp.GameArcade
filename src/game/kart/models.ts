import type { DriverId, VehicleDef } from './config';
import type { DecorKind } from './tracks';
import { VoxelModel } from '../shared/voxel';

/**
 * Voxel models for Turbo Kart: the four vehicles (each with its animal
 * driver), the items, and the trackside scenery. All original designs.
 */

const TYRE = '#1c1c1c';
const HUB = '#a8a8a8';
const METAL = '#686870';
const DARK = '#303036';

interface DriverStyle {
  fur: string;
  face: string;
  shirt: string;
}

const DRIVERS: Record<DriverId, DriverStyle> = {
  fox: { fur: '#f07820', face: '#fcfcfc', shirt: '#2858d8' },
  frog: { fur: '#48c030', face: '#c8f080', shirt: '#e83838' },
  bunny: { fur: '#f4ecfc', face: '#fcfcfc', shirt: '#9848e0' },
  bear: { fur: '#8c5028', face: '#d8a868', shirt: '#f8b800' },
};

/** A seated animal driver; (y, z) is the seat position. */
function driver(m: VoxelModel, id: DriverId, y: number, z: number): void {
  const s = DRIVERS[id];
  // Torso and arms reaching for the wheel.
  m.box(-2, y, z, 2, y + 3, z + 2, s.shirt);
  m.pair(-3, y + 2, z + 1, -3, y + 2, z + 4, s.shirt);
  m.pair(-2, y + 2, z + 5, -2, y + 2, z + 5, s.fur);
  // Head.
  const hy = y + 4;
  m.box(-2, hy, z - 1, 2, hy + 3, z + 3, s.fur);
  m.pair(-1, hy + 2, z + 3, -1, hy + 2, z + 3, '#101010');
  switch (id) {
    case 'fox':
      m.box(-1, hy, z + 4, 1, hy + 1, z + 5, s.face);
      m.dot(0, hy + 1, z + 6, '#101010');
      m.pair(-2, hy + 4, z, -1, hy + 5, z + 1, s.fur);
      m.pair(-2, hy + 6, z, -2, hy + 6, z, '#101010');
      m.box(-1, hy, z - 2, 1, hy + 1, z - 2, s.face);
      break;
    case 'frog':
      m.box(-3, hy, z - 1, 3, hy + 2, z + 3, s.fur);
      m.pair(-2, hy + 3, z + 1, -1, hy + 4, z + 2, '#fcfcfc');
      m.pair(-2, hy + 4, z + 3, -2, hy + 4, z + 3, '#101010');
      m.box(-2, hy, z + 4, 2, hy, z + 4, '#e83838');
      break;
    case 'bunny':
      m.box(-1, hy, z + 4, 1, hy + 1, z + 4, s.face);
      m.dot(0, hy + 1, z + 5, '#f878b8');
      m.pair(-2, hy + 4, z, -1, hy + 9, z + 1, s.fur);
      m.pair(-1, hy + 5, z + 1, -1, hy + 8, z + 1, '#f8a8c8');
      break;
    case 'bear':
      m.box(-1, hy, z + 4, 1, hy + 1, z + 5, s.face);
      m.dot(0, hy + 1, z + 6, '#101010');
      m.pair(-3, hy + 3, z, -2, hy + 4, z, s.fur);
      m.pair(-2, hy + 4, z + 1, -2, hy + 4, z + 1, s.face);
      break;
  }
}

function wheel(m: VoxelModel, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): void {
  m.pair(x0, y0, z0, x1, y1, z1, TYRE);
  const outer = Math.abs(x0) > Math.abs(x1) ? x0 : x1;
  const midY = Math.round((y0 + y1) / 2);
  const midZ = Math.round((z0 + z1) / 2);
  m.pair(outer, midY, midZ, outer, midY, midZ, HUB);
}

export function vehicleModel(v: VehicleDef): VoxelModel {
  const m = new VoxelModel();
  const body = v.body;
  const trim = v.trim;
  switch (v.id) {
    case 'kart':
      wheel(m, -6, -4, 0, 2, -8, -5);
      wheel(m, -6, -4, 0, 2, 4, 6);
      m.box(-3, 1, -8, 3, 1, 8, body);
      m.pair(-4, 2, -5, -4, 2, 4, body);
      m.box(-3, 2, 6, 3, 2, 9, body);
      m.box(-4, 1, 9, 4, 1, 10, trim);
      m.box(-3, 2, -8, 3, 4, -7, METAL);
      m.pair(-2, 4, -8, -2, 5, -8, DARK);
      m.box(-2, 2, -6, 2, 5, -6, trim);
      m.box(0, 3, 5, 0, 4, 5, DARK);
      m.box(-1, 5, 5, 1, 5, 5, DARK);
      m.box(-4, 3, -10, 4, 3, -9, trim);
      driver(m, v.driver, 2, -5);
      break;
    case 'buggy':
      wheel(m, -7, -5, 0, 4, -8, -4);
      wheel(m, -7, -5, 0, 4, 4, 8);
      m.box(-4, 3, -7, 4, 4, 8, body);
      m.box(-3, 5, 5, 3, 5, 9, body);
      m.box(-4, 3, 9, 4, 4, 10, DARK);
      m.pair(-4, 5, -6, -4, 12, -6, trim);
      m.box(-4, 12, -6, 4, 12, -6, trim);
      m.pair(-4, 5, 3, -4, 9, 3, trim);
      m.pair(-4, 9, -5, -4, 11, 2, trim);
      m.box(-3, 5, -8, 3, 6, -7, METAL);
      m.box(0, 6, 5, 0, 7, 5, DARK);
      m.box(-1, 7, 5, 1, 7, 5, DARK);
      driver(m, v.driver, 5, -5);
      break;
    case 'rocket':
      wheel(m, -5, -4, 0, 1, -7, -5);
      wheel(m, -5, -4, 0, 1, 5, 7);
      m.box(-3, 1, -8, 3, 3, 10, body);
      m.box(-2, 1, 11, 2, 2, 13, body);
      m.box(-1, 1, 14, 1, 1, 15, trim);
      m.box(0, 4, 0, 0, 4, 11, trim);
      m.pair(-5, 2, -9, -4, 7, -7, trim);
      m.box(-2, 1, -10, 2, 3, -9, DARK);
      m.box(-1, 2, -11, 1, 2, -11, '#fc8800');
      m.box(0, 5, 3, 0, 5, 3, DARK);
      m.box(-1, 6, 3, 1, 6, 3, DARK);
      m.box(-2, 3, -6, 2, 6, -6, trim);
      driver(m, v.driver, 3, -4);
      break;
    case 'truck':
      wheel(m, -8, -5, 0, 5, -9, -4);
      wheel(m, -8, -5, 0, 5, 4, 9);
      m.box(-4, 4, -9, 4, 6, 9, body);
      m.box(-4, 7, 3, 4, 7, 9, body);
      m.box(-4, 4, 10, 4, 6, 10, '#c8c8c8');
      m.pair(-3, 6, 11, -3, 6, 11, trim);
      m.pair(-4, 7, -9, -4, 8, -3, body);
      m.box(-4, 8, -9, 4, 8, -9, body);
      m.pair(-4, 8, -1, -4, 13, -1, DARK);
      m.box(-4, 13, -1, 4, 13, -1, DARK);
      m.box(-3, 7, -8, 3, 7, -4, METAL);
      m.box(0, 8, 2, 0, 9, 2, DARK);
      m.box(-1, 9, 2, 1, 9, 2, DARK);
      driver(m, v.driver, 7, -3);
      break;
  }
  return m;
}

// --- Items ---------------------------------------------------------------

export function itemBoxModel(): VoxelModel {
  const m = new VoxelModel();
  const cols = ['#f84848', '#f8b800', '#48d848', '#48a8f8', '#c858f8'];
  for (let x = -4; x <= 4; x++)
    for (let y = 0; y <= 8; y++)
      for (let z = -4; z <= 4; z++) {
        const edge = [Math.abs(x) === 4, y === 0 || y === 8, Math.abs(z) === 4].filter(Boolean).length;
        if (edge >= 2) m.dot(x, y, z, '#fcfcfc');
        else if (edge === 1) m.dot(x, y, z, cols[(x + y + z + 20) % cols.length]);
      }
  // "?" on the front and back.
  const q = [[-1, 6], [0, 7], [1, 6], [1, 5], [0, 4], [0, 2]];
  for (const [qx, qy] of q) {
    m.dot(qx, qy, 4, '#fcfcfc').dot(qx, qy, -4, '#fcfcfc');
    m.dot(4, qy, qx, '#fcfcfc').dot(-4, qy, qx, '#fcfcfc');
  }
  return m;
}

export function bananaModel(): VoxelModel {
  const m = new VoxelModel();
  const pts = [[-4, 1], [-3, 2], [-2, 2], [-1, 3], [0, 3], [1, 3], [2, 2], [3, 2], [4, 1]];
  for (const [x, y] of pts) m.box(x, y, -1, x, y + 1, 1, '#f8d800');
  m.box(-5, 0, 0, -5, 1, 0, '#8c6010');
  m.box(5, 2, 0, 5, 2, 0, '#8c6010');
  return m;
}

export function orbModel(color: string, shine: string): VoxelModel {
  const m = new VoxelModel();
  m.blob(0, 4, 0, 4, 4, 4, color);
  m.blob(0, 4, 0, 4.4, 1.2, 4.4, shine);
  m.dot(-2, 6, -3, '#fcfcfc');
  return m;
}

export function starModel(): VoxelModel {
  const m = new VoxelModel();
  const rows = ['....y....', '...yyy...', 'yyyyyyyyy', '.yyyyyyy.', '..yyyyy..', '.yyy.yyy.', 'yy.....yy'];
  rows.forEach((r, i) => [...r].forEach((ch, x) => ch === 'y' && m.box(x - 4, 8 - i, -1, x - 4, 8 - i, 1, '#f8d800')));
  m.dot(-1, 5, 2, '#101010').dot(1, 5, 2, '#101010');
  return m;
}

export function turboModel(): VoxelModel {
  const m = new VoxelModel();
  m.box(-2, 0, -2, 2, 7, 2, '#e83838');
  m.box(-1, 8, -1, 1, 9, 1, '#fcfcfc');
  m.box(-2, 3, -2, 2, 3, 2, '#fcfcfc');
  m.pair(-3, 0, 0, -3, 2, 0, '#f8b800');
  m.box(0, 0, -3, 0, 2, -3, '#f8b800');
  return m;
}

// --- Scenery -------------------------------------------------------------

export function decorModel(kind: DecorKind): VoxelModel {
  const m = new VoxelModel();
  switch (kind) {
    case 'tree':
      m.box(-1, 0, -1, 1, 6, 1, '#7c4c24');
      m.blob(0, 12, 0, 6, 6, 6, '#38a030');
      m.blob(-2, 14, -2, 3, 3, 3, '#58c040');
      break;
    case 'bush':
      m.blob(0, 2, 0, 4, 3, 4, '#309028');
      m.dot(-2, 4, -3, '#e84848').dot(2, 3, -3, '#e84848');
      break;
    case 'flowers':
      for (const [x, z, c] of [[-3, 0, '#f8e048'], [0, -2, '#f878b8'], [2, 1, '#fcfcfc'], [-1, 3, '#f84848']] as const) {
        m.box(x, 0, z, x, 1, z, '#309028');
        m.dot(x, 2, z, c);
      }
      break;
    case 'tires':
      for (const [x, z] of [[-3, 0], [3, 0], [0, 0]])
        for (let y = 0; y < 6; y += 2) {
          m.box(x - 2, y, z - 2, x + 2, y + 1, z + 2, y === 2 ? '#e83030' : '#202020');
          m.remove(x, y, z).remove(x, y + 1, z);
        }
      break;
    case 'cactus':
      m.box(-1, 0, -1, 1, 13, 1, '#389830');
      m.box(-4, 5, 0, -2, 5, 0, '#389830');
      m.box(-4, 5, 0, -4, 9, 0, '#389830');
      m.box(2, 7, 0, 4, 7, 0, '#389830');
      m.box(4, 7, 0, 4, 11, 0, '#389830');
      m.dot(0, 14, 0, '#f878b8');
      break;
    case 'rock':
      m.blob(0, 3, 0, 6, 4, 5, '#a86c48');
      m.blob(-2, 5, -1, 3, 2, 3, '#c88c60');
      break;
    case 'barrel':
      m.box(-3, 0, -3, 3, 8, 3, '#c85020');
      m.box(-3, 2, -3, 3, 2, 3, '#303030');
      m.box(-3, 6, -3, 3, 6, 3, '#303030');
      break;
    case 'pine':
      m.box(-1, 0, -1, 1, 3, 1, '#6c4020');
      for (let layer = 0; layer < 4; layer++) {
        const r = 6 - layer * 1.4;
        m.blob(0, 5 + layer * 4, 0, r, 2, r, layer % 2 ? '#1c6838' : '#288048');
        m.blob(0, 6 + layer * 4, 0, r * 0.7, 1, r * 0.7, '#f4faff');
      }
      break;
    case 'snowman':
      m.blob(0, 3, 0, 4, 3, 4, '#fcfcfc');
      m.blob(0, 8, 0, 3, 2.5, 3, '#fcfcfc');
      m.blob(0, 12, 0, 2, 2, 2, '#fcfcfc');
      m.dot(0, 12, 2, '#f87818').dot(0, 12, 3, '#f87818');
      m.pair(-1, 13, 2, -1, 13, 2, '#101010');
      m.box(-2, 14, -2, 2, 14, 2, '#303030');
      m.box(-1, 15, -1, 1, 16, 1, '#303030');
      break;
    case 'crystal':
      m.box(-1, 0, -1, 1, 9, 1, '#a8e8ff');
      m.box(-3, 0, 0, -2, 5, 0, '#c8f0ff');
      m.box(2, 0, 0, 3, 6, 0, '#88d8ff');
      m.dot(0, 10, 0, '#fcfcfc');
      break;
  }
  return m;
}
