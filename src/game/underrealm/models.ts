import { VoxelModel, pixelate, renderVoxels } from '../shared/voxel';
import type { SpriteTex } from './raycaster';

/**
 * Voxel models for The Underrealm's monsters, shopkeepers and props - all
 * original designs, built at ~2 voxels per "pixel" of detail from rounded
 * primitives (capsule limbs, ellipsoid bodies, flat membranes) and rendered
 * face-on with a slight three-quarter turn, ambient occlusion and grain.
 *
 * Model space: y up from the floor (0), +z toward the viewer, ~48 voxels per
 * wall height (a person is ~40 voxels tall).
 */

type P = [number, number, number];

export type ModelId =
  | 'rat' | 'bat' | 'slime' | 'goblin' | 'skeleton' | 'peddler' | 'orc' | 'spider' | 'zombie' | 'ghost'
  | 'knight' | 'troll' | 'imp' | 'wraith' | 'minotaur' | 'lich'
  | 'darkGuard' | 'golem' | 'hydra' | 'ent' | 'ghoul' | 'necromancer' | 'hellhound' | 'demon' | 'serpent'
  | 'scorpion' | 'dustDevil' | 'mummy' | 'hawkman' | 'riff' | 'sheik'
  | 'captive' | 'altar' | 'gargoyle' | 'tree' | 'obelisk' | 'palm' | 'diamond' | 'sarcophagus'
  | 'barkeep' | 'provisioner' | 'smith' | 'priest' | 'guildmaster'
  | 'chest' | 'chestOpen' | 'fountain' | 'crystal' | 'throne' | 'gate';

/** Eyes on a face at height y, depth z: whites, a coloured iris, and a glint. */
function eyes(m: VoxelModel, y: number, z: number, spread: number, iris: string, white = '#f8f8f0', size = 2): void {
  for (const sx of [-1, 1]) {
    const x = sx * spread;
    m.box(x - (size - 1) * (sx < 0 ? 1 : 0), y, z, x + (size - 1) * (sx > 0 ? 1 : 0), y + size - 1, z, white);
    m.dot(x, y, z + 1, iris);
    if (size > 1) m.dot(x + (sx > 0 ? 1 : -1) * 0, y + size - 1, z + 1, '#ffffff');
  }
}

/** Glowing eyes (no whites) - undead, spirits. */
function glowEyes(m: VoxelModel, y: number, z: number, spread: number, c: string): void {
  m.box(-spread - 1, y, z, -spread, y + 1, z, c).box(spread, y, z, spread + 1, y + 1, z, c);
}

interface Body {
  legLen: number;
  torso: number;
  hipW: number;
  shoulderW: number;
  legR: number;
  armR: number;
  chest: number;
  headR: number;
  skin: string;
  top: string;
  bottom: string;
  boots?: string;
  hands?: string;
  /** Where each hand ends up (default: hanging at the sides). */
  lHand?: P;
  rHand?: P;
  /** Draw the head (default true). */
  head?: boolean;
  /** Forward hunch of the upper body, in voxels. */
  hunch?: number;
}

interface Joints {
  hip: number;
  shoulderY: number;
  neck: number;
  headC: P;
  lHand: P;
  rHand: P;
}

/** A rounded humanoid figure facing +z. Returns joint positions for dressing it up. */
function figure(m: VoxelModel, b: Body): Joints {
  const hip = b.legLen;
  const hunch = b.hunch ?? 0;
  const shoulderY = hip + b.torso;
  // Legs and feet.
  for (const sx of [-1, 1]) {
    const x = sx * b.hipW;
    m.capsule([x, hip, 0], [x * 1.05, 3, 0.5], b.legR, b.bottom, b.legR * 0.85);
    m.blob(x * 1.05, 1.5, 1.8, b.legR + 0.6, 1.8, b.legR + 1.8, b.boots ?? '#3c2c1c');
  }
  // Pelvis, torso (slightly tapered), shoulders.
  m.blob(0, hip + 1, 0, b.hipW + b.legR, 2.8, b.chest * 0.8, b.bottom);
  m.capsule([0, hip + 2, 0], [0, shoulderY - 2, hunch], b.shoulderW * 0.72, b.top, b.shoulderW * 0.9);
  m.blob(0, shoulderY - 2, hunch, b.shoulderW + 1, 3.2, b.chest, b.top);
  // Arms: shoulder -> elbow -> hand.
  const lHand = b.lHand ?? [-(b.shoulderW + 2), hip - 1, 1.5];
  const rHand = b.rHand ?? [b.shoulderW + 2, hip - 1, 1.5];
  for (const [sx, hand] of [[-1, lHand], [1, rHand]] as [number, P][]) {
    const sh: P = [sx * (b.shoulderW + 1), shoulderY - 2, hunch];
    const elbow: P = [(sh[0] + hand[0]) / 2 + sx * 1.5, (sh[1] + hand[1]) / 2, (sh[2] + hand[2]) / 2 - 1];
    m.capsule(sh, elbow, b.armR + 0.4, b.top, b.armR);
    m.capsule(elbow, hand, b.armR, b.skin, b.armR * 0.9);
    m.blob(hand[0], hand[1], hand[2], b.armR + 0.7, b.armR + 0.7, b.armR + 0.7, b.hands ?? b.skin);
  }
  const neck = shoulderY + 1;
  const headC: P = [0, neck + b.headR, hunch + 0.5];
  if (b.head !== false) {
    m.capsule([0, shoulderY - 1, hunch], [0, neck + 1, hunch + 0.5], b.armR, b.skin);
    m.blob(headC[0], headC[1], headC[2], b.headR, b.headR * 1.08, b.headR * 0.95, b.skin);
  }
  return { hip, shoulderY, neck, headC, lHand, rHand };
}

function sword(m: VoxelModel, hand: P, len: number, blade = '#d8dce8', hilt = '#8c6c2c'): void {
  const [x, y, z] = hand;
  m.box(x - 2, y + 1, z, x + 2, y + 1, z, hilt);
  m.box(x, y - 2, z, x, y, z, '#4c3420');
  m.box(x, y + 2, z, x, y + len, z, blade);
  m.box(x - 1, y + 2, z, x - 1, y + len - 2, z, '#a8acb8');
}

/** A curved blade (scimitar) held upright in a hand. */
function scimitar(m: VoxelModel, hand: P, blade: string): void {
  const [x, y, z] = hand;
  m.box(x - 2, y + 1, z, x + 2, y + 1, z, '#c8a040');
  m.box(x, y - 2, z, x, y, z, '#3c2c1c');
  m.chain([[x, y + 2, z], [x + 1, y + 8, z], [x + 3, y + 13, z], [x + 6, y + 16, z]], 1.1, blade, 0.5);
}

/** A desert rider in a burnoose - the Riff raiders, and their sheik. */
function robed(m: VoxelModel, robe: string, wrap: string, sheik: boolean): void {
  const skin = '#b07c50';
  const j = figure(m, {
    legLen: 15, torso: 14, hipW: 3.2, shoulderW: 5.8, legR: 2.3, armR: 1.9, chest: 4.5, headR: 4.8,
    skin, top: robe, bottom: robe, boots: '#4c3420', rHand: [8, 22, 6], lHand: [-7, 14, 3], hunch: sheik ? 2.5 : 0,
  });
  const [, hy, hz] = j.headC;
  // Flowing robe to the ankles.
  m.capsule([0, 16, 0], [0, 2, 0], 5.5, robe, 8.5);
  m.box(-1, 3, 7, 1, j.shoulderY - 1, 7, sheik ? '#f8d800' : '#8c2c20');
  m.box(-6, j.hip + 1, 5, 6, j.hip + 2, 5, sheik ? '#f8c800' : '#a83c28');
  // Head wrap (turban for the sheik), face veil for raiders.
  if (sheik) {
    m.blob(0, hy + 3, hz - 0.5, 6, 3.5, 6, wrap);
    m.paint((v) => v.c === wrap && (v.x + v.y) % 3 === 0, '#e8e0c8');
    m.blob(0, hy + 4, hz + 5, 1.2, 1.2, 0.8, '#e82020');
    m.blob(0, hy - 4, hz + 3, 3.5, 3, 2, '#e8e8e0');
  } else {
    m.blob(0, hy + 1.5, hz - 1, 5.8, 6, 5.8, wrap);
    m.carve((v) => v.c === wrap && v.z > hz + 2 && v.y > hy - 1 && v.y < hy + 3 && Math.abs(v.x) < 4);
    m.blob(0, hy - 2.5, hz + 3.5, 4, 2.5, 2, wrap);
    m.capsule([0, hy + 2, hz - 5], [1, j.shoulderY - 6, -6], 2.2, wrap, 1.2);
  }
  eyes(m, hy + 1, hz + 4, 2, '#2c1c10', '#f0e8d8', 1);
  scimitar(m, j.rHand, sheik ? '#e8e8f0' : '#b8bcc8');
}

/** An octahedral gem, point down on a small stand. */
function gem(m: VoxelModel, cy: number, r: number, c: string, glint: string): void {
  for (let x = -r; x <= r; x++)
    for (let y = -r; y <= r; y++)
      for (let z = -r; z <= r; z++) {
        const d = Math.abs(x) + Math.abs(y) * (y > 0 ? 1.4 : 0.8) + Math.abs(z);
        if (d <= r) m.dot(x, Math.round(cy + y), z, (x + y + z) % 3 === 0 ? glint : c);
      }
}

function build(id: ModelId): VoxelModel {
  const m = new VoxelModel();
  switch (id) {
    case 'rat': {
      const fur = '#8c7660';
      m.blob(0, 7, -2, 7, 6, 11, fur);
      m.blob(0, 5, -1, 5.5, 3.5, 9, '#a89078');
      m.blob(0, 9, 10, 5, 5, 6, fur);
      m.blob(0, 7, 15, 3, 3, 3.5, '#9c846c');
      m.blob(0, 7.5, 18.5, 1.3, 1.2, 1, '#f898a8');
      m.box(-1, 5, 17, 1, 5, 17, '#fcfcfc');
      for (const sx of [-1, 1]) {
        m.blob(sx * 4, 15, 8, 2.5, 3, 1, fur);
        m.blob(sx * 4, 15, 8.8, 1.6, 2, 0.6, '#e8a8b0');
        m.box(sx * 2, 11, 14, sx * 2, 12, 14, '#e81818');
        m.dot(sx * 2, 12, 15, '#ffc0c0');
        m.capsule([sx * 5, 3, 7], [sx * 5.5, 0.5, 9], 1.4, '#6c5c4c');
        m.capsule([sx * 5, 4, -8], [sx * 6, 0.5, -7], 1.6, '#6c5c4c');
        for (const wy of [6, 8]) m.box(sx * 3, wy, 17, sx * 7, wy + (wy === 6 ? -1 : 1), 17, '#d8d0c0');
      }
      m.chain([[0, 5, -12], [3, 3, -18], [7, 3, -22], [10, 5, -24]], 1.2, '#d8a0a0', 0.6);
      break;
    }
    case 'bat': {
      const skin = '#4c3c4c';
      m.blob(0, 34, 0, 4, 5, 3.5, skin);
      m.blob(0, 40, 1, 4, 3.5, 3.5, '#5c4858');
      for (const sx of [-1, 1]) {
        m.tri([sx * 2, 42], [sx * 4, 49], [sx * 5, 41], 0, skin, 2);
        m.box(sx * 2, 41, 4, sx * 2, 42, 4, '#f82828');
        m.box(sx * 1, 37, 4, sx * 1, 38, 4, '#fcfcfc');
        // Wing: finger bones with membrane between.
        const tips: [number, number][] = [[sx * 26, 46], [sx * 30, 36], [sx * 24, 26], [sx * 14, 24]];
        let prev: [number, number] = [sx * 4, 38];
        for (const tip of tips) {
          m.tri([sx * 4, 38], prev, tip, -1, '#3c2c3c', 1);
          m.capsule([sx * 4, 38, 0], [tip[0], tip[1], 0], 0.7, '#2c2028');
          prev = tip;
        }
        m.capsule([sx * 2, 30, 0], [sx * 3, 27, 1], 0.8, skin);
      }
      break;
    }
    case 'slime': {
      m.blob(0, 11, 0, 15, 11, 13, '#40b848');
      m.blob(0, 6, 0, 16, 5, 14, '#38a040');
      m.blob(-4, 17, 4, 6, 4, 5, '#78e070');
      m.blob(-6, 19, 6, 2, 1.5, 1.5, '#d8ffd0');
      m.blob(3, 9, -2, 5, 4, 4, '#288030');
      for (const [bx, by, bz] of [[7, 14, 9], [-9, 8, 9], [10, 6, 5]] as P[]) m.blob(bx, by, bz, 1.6, 1.6, 1.6, '#a8f0a0');
      eyes(m, 13, 13, 4, '#101010', '#f8fff0', 3);
      m.box(-3, 8, 13, 3, 8, 13, '#1c5020');
      m.box(-2, 7, 13, 2, 7, 13, '#1c5020');
      break;
    }
    case 'goblin': {
      const skin = '#6cb048';
      const j = figure(m, {
        legLen: 10, torso: 9, hipW: 2.5, shoulderW: 4, legR: 1.8, armR: 1.4, chest: 3.5, headR: 5.5,
        skin, top: '#6c4c2c', bottom: '#4c3c24', boots: '#3c2c1c', hunch: 1,
        rHand: [7, 20, 5],
      });
      const [, hy, hz] = j.headC;
      // Hood and cloak.
      m.blob(0, hy + 1.5, hz - 1.5, 6, 5.5, 5.5, '#5c4430');
      m.carve((v) => v.z > hz + 1 && v.y < hy + 4 && v.y > hy - 6 && Math.abs(v.x) < 5 && v.c === '#5c4430');
      m.blob(0, hy, hz, 5, 5.5, 5, skin);
      for (const sx of [-1, 1]) m.chain([[sx * 5, hy + 1, hz], [sx * 9, hy + 3, hz - 1], [sx * 12, hy + 5, hz - 2]], 1.4, skin, 0.5);
      m.blob(0, hy - 1, hz + 5, 1.5, 2, 2, '#58a038');
      eyes(m, hy + 1, hz + 4, 2, '#f8d800', '#f8f8a0', 2);
      m.box(-3, hy - 3, hz + 4, 3, hy - 3, hz + 4, '#3c1c10');
      m.dot(-2, hy - 2, hz + 4, '#fcfcfc').dot(2, hy - 2, hz + 4, '#fcfcfc');
      m.box(-4, j.hip + 1, 3, 4, j.hip + 1, 3, '#2c1c10');
      m.blob(-3, j.hip, 4, 1.5, 1.5, 1, '#8c6c3c');
      sword(m, j.rHand, 7, '#c8ccd8');
      break;
    }
    case 'skeleton': {
      const bone = '#ece8dc';
      const dark = '#2c2824';
      for (const sx of [-1, 1]) {
        m.capsule([sx * 3, 20, 0], [sx * 3, 11, 0.5], 1.2, bone).capsule([sx * 3, 11, 0.5], [sx * 3.2, 3, 0], 1.1, bone);
        m.blob(sx * 3, 11, 0.8, 1.6, 1.6, 1.6, bone);
        m.blob(sx * 3.2, 1.5, 1.5, 1.8, 1.4, 2.8, bone);
      }
      m.blob(0, 21, 0, 5, 2.5, 3, bone);
      m.capsule([0, 22, -1], [0, 34, -1], 1.2, bone);
      for (let y = 25; y <= 33; y += 2) {
        const w = 5 - Math.abs(y - 29) * 0.35;
        m.capsule([-w, y, 0], [w, y, 0], 0.8, bone);
        m.capsule([-w, y, 0], [-w + 1, y, 3], 0.7, bone).capsule([w, y, 0], [w - 1, y, 3], 0.7, bone);
      }
      m.box(-1, 25, 3, 1, 33, 3, bone);
      m.blob(0, 34.5, 0, 6, 1.6, 2.5, bone);
      for (const sx of [-1, 1]) {
        m.blob(sx * 6, 34, 0, 1.8, 1.8, 1.8, bone);
        m.capsule([sx * 6.5, 33, 0], [sx * 7.5, 26, 2], 1, bone).capsule([sx * 7.5, 26, 2], [sx * 7, 19, 5], 0.9, bone);
      }
      m.capsule([0, 35, 0], [0, 38, 0], 1, bone);
      m.blob(0, 42, 0.5, 5, 5, 4.8, bone);
      m.blob(0, 38.5, 2.5, 3.2, 1.6, 2.5, bone);
      m.carve((v) => v.z >= 3 && v.y >= 41 && v.y <= 43 && Math.abs(Math.abs(v.x) - 2) <= 1);
      m.box(-3, 41, 2, -1, 43, 2, dark).box(1, 41, 2, 3, 43, 2, dark);
      m.dot(-2, 42, 3, '#f83030').dot(2, 42, 3, '#f83030');
      m.box(0, 39, 5, 0, 40, 5, dark);
      for (let x = -2; x <= 2; x++) m.dot(x, 37, 4, x % 2 ? dark : '#fcfcf0');
      sword(m, [7, 19, 5], 12, '#a8a090', '#6c5c3c');
      m.blob(-9, 25, 3, 1.5, 6, 5, '#7c5c34');
      m.blob(-10, 25, 3, 0.8, 4, 3, '#a8a8b0');
      break;
    }
    case 'peddler': {
      const j = figure(m, {
        legLen: 14, torso: 12, hipW: 3, shoulderW: 5, legR: 2, armR: 1.6, chest: 4, headR: 4.5,
        skin: '#e0b088', top: '#7c5c3c', bottom: '#5c4430', hunch: 2, rHand: [8, 22, 5], lHand: [-7, 14, 3],
      });
      const [, hy, hz] = j.headC;
      m.blob(0, 10, 0, 6, 10, 5, '#6c5034');
      m.blob(0, hy + 4, hz, 10, 1.2, 10, '#5c4024');
      m.blob(0, hy + 5.5, hz, 5, 3, 5, '#5c4024');
      m.blob(0, hy - 3, hz + 3.5, 3.5, 3.5, 1.5, '#c8c8c8');
      eyes(m, hy, hz + 4, 2, '#3c2c1c', '#f0e8e0', 1);
      m.blob(0, hy - 0.5, hz + 4.5, 1, 1, 1, '#d89878');
      // Pack on the back.
      m.blob(0, 26, -7, 7, 9, 5, '#8c6c3c');
      m.blob(0, 36, -7, 6, 2, 3, '#a83c3c');
      m.capsule([-5, 18, -9], [-5, 34, -9], 1.2, '#b8b8c0');
      m.blob(5, 22, -10, 2.5, 2.5, 2.5, '#7c7c84');
      // Lantern.
      const [lx, ly, lz] = j.rHand;
      m.box(lx - 2, ly - 6, lz - 1, lx + 2, ly - 2, lz + 2, '#f8d060');
      m.box(lx - 2, ly - 1, lz - 1, lx + 2, ly - 1, lz + 2, '#3c3c44');
      m.box(lx, ly, lz, lx, ly, lz, '#3c3c44');
      m.box(lx - 1, ly - 5, lz + 2, lx + 1, ly - 3, lz + 2, '#fff0a0');
      break;
    }
    case 'orc': {
      const skin = '#6c9048';
      const j = figure(m, {
        legLen: 15, torso: 14, hipW: 4, shoulderW: 7.5, legR: 3, armR: 2.6, chest: 5, headR: 5,
        skin, top: '#5c4430', bottom: '#3c3024', boots: '#2c2018', rHand: [11, 22, 5], lHand: [-10, 13, 3], hunch: 1.5,
      });
      const [, hy, hz] = j.headC;
      m.blob(0, hy - 2, hz + 3, 4.5, 3, 3, skin);
      eyes(m, hy + 1, hz + 4, 2, '#f8d000', '#f8f0a0', 2);
      m.box(-3, hy + 3, hz + 4, -1, hy + 3, hz + 4, '#2c3c1c').box(1, hy + 3, hz + 4, 3, hy + 3, hz + 4, '#2c3c1c');
      m.box(-2, hy - 1, hz + 5, 2, hy - 1, hz + 5, '#303020');
      m.box(-3, hy - 3, hz + 5, -3, hy - 1, hz + 5, '#f8f4e0').box(3, hy - 3, hz + 5, 3, hy - 1, hz + 5, '#f8f4e0');
      m.box(-1, hy + 6, hz - 2, 1, hy + 7, hz + 2, '#2c2020');
      // Studded leather + belt.
      m.paint((v) => v.c === '#5c4430' && (v.x + v.y) % 4 === 0 && v.z > 3, '#b8b8c0');
      m.box(-7, j.hip + 1, 4, 7, j.hip + 2, 4, '#2c1c10');
      m.box(-1, j.hip + 1, 5, 1, j.hip + 2, 5, '#c8a040');
      m.blob(-8, j.shoulderY - 1, 0, 3.5, 2.5, 3.5, '#7c7c84');
      // Spiked club.
      const [cx, cy, cz] = j.rHand;
      m.capsule([cx, cy - 3, cz], [cx + 1, cy + 14, cz - 1], 1.4, '#7c5430', 2.8);
      for (const [sx, sy, sz] of [[3, 12, 0], [-2, 14, 0], [1, 10, 3], [1, 15, -2]] as P[]) m.box(cx + sx, cy + sy, cz + sz, cx + sx, cy + sy, cz + sz, '#d8d8e0');
      break;
    }
    case 'spider': {
      const body = '#2c2434';
      m.blob(0, 14, -9, 11, 9, 12, body);
      m.blob(0, 16, -8, 8, 6, 9, '#3c3048');
      m.paint((v) => v.z > 1 && v.z < 4 && Math.abs(v.x) < 3 - Math.abs(v.y - 14) * 0.6 && v.y > 10 && v.y < 18, '#e82020');
      m.blob(0, 12, 6, 6, 5, 6, '#3c3444');
      m.box(-3, 13, 11, 3, 15, 11, '#1c1820');
      for (const [ex, ey] of [[-2, 15], [2, 15], [-3, 13], [3, 13], [-1, 16], [1, 16]]) m.dot(ex, ey, 12, '#f82828');
      for (const sx of [-1, 1]) {
        m.capsule([sx * 2, 9, 11], [sx * 1.5, 5, 13], 1, '#1c1820');
        [-2, 2, 6, 10].forEach((z, i) => {
          const knee: P = [sx * (13 + i), 22 - i, z + 3];
          m.capsule([sx * 4, 12, z + 2], knee, 1.4, body, 1.1);
          m.capsule(knee, [sx * (19 + i * 1.5), 0.5, z + 6 - i * 2], 1.1, body, 0.6);
        });
      }
      break;
    }
    case 'zombie': {
      const skin = '#8cac78';
      const j = figure(m, {
        legLen: 15, torso: 13, hipW: 3, shoulderW: 5.5, legR: 2.2, armR: 1.8, chest: 4, headR: 4.8,
        skin, top: '#4c5c84', bottom: '#3c3c48', boots: '#2c2c30', hunch: 3,
        lHand: [-5, 27, 14], rHand: [5, 25, 15],
      });
      const [, hy, hz] = j.headC;
      // Rags and rot.
      m.carve((v) => (v.c === '#4c5c84' || v.c === '#3c3c48') && ((v.x * 7 + v.y * 13 + v.z * 3) % 11 === 0));
      m.paint((v) => v.c === skin && (v.x * 5 + v.y * 3 + v.z) % 9 === 0, '#5c7c4c');
      m.box(-4, j.hip - 3, 3, 4, j.hip - 1, 3, '#3c3c48');
      glowEyes(m, hy + 1, hz + 4, 2, '#f8f8a0');
      m.dot(-2, hy + 1, hz + 5, '#101010');
      m.box(-2, hy - 3, hz + 4, 2, hy - 2, hz + 4, '#3c2020');
      m.dot(-1, hy - 3, hz + 5, '#e8e0c8').dot(1, hy - 2, hz + 5, '#e8e0c8');
      m.blob(2, hy + 3, hz + 1, 2, 1.5, 2, '#6c8c5c');
      break;
    }
    case 'ghost': {
      const sheet = '#e8f0ff';
      m.blob(0, 34, 0, 9, 11, 7, sheet);
      m.capsule([0, 30, 0], [0, 10, -1], 9, sheet, 11);
      for (let x = -10; x <= 10; x += 4) m.capsule([x, 10, 0], [x + 1, 3 + ((x / 4) % 2 ? 2 : 0), -1], 2.4, sheet, 1.2);
      m.blob(0, 36, 3, 7, 7, 5, '#f8fcff');
      m.box(-4, 36, 7, -2, 39, 7, '#101838').box(2, 36, 7, 4, 39, 7, '#101838');
      m.dot(-3, 38, 8, '#58c8ff').dot(3, 38, 8, '#58c8ff');
      m.blob(0, 31, 6.5, 2, 3, 1, '#101838');
      for (const sx of [-1, 1]) m.chain([[sx * 8, 30, 0], [sx * 13, 25, 4], [sx * 15, 20, 7]], 2.2, sheet, 1.2);
      break;
    }
    case 'knight': {
      const steel = '#48485c';
      const j = figure(m, {
        legLen: 17, torso: 15, hipW: 3.5, shoulderW: 7, legR: 2.8, armR: 2.4, chest: 5, headR: 5,
        skin: steel, top: '#3c3c4c', bottom: steel, boots: '#2c2c38', hands: '#2c2c38',
        rHand: [10, 22, 6], lHand: [-9, 20, 6],
      });
      const [, hy, hz] = j.headC;
      m.blob(0, hy, hz, 5.5, 6, 5.5, '#585870');
      m.box(-4, hy, hz + 5, 4, hy, hz + 5, '#101018');
      m.box(-3, hy, hz + 6, -1, hy, hz + 6, '#f82828').box(1, hy, hz + 6, 3, hy, hz + 6, '#f82828');
      m.box(0, hy - 4, hz + 5, 0, hy + 4, hz + 5, '#6c6c84');
      m.chain([[0, hy + 5, hz], [0, hy + 9, hz - 3], [0, hy + 7, hz - 8]], 1.6, '#a82020', 0.8);
      for (const sx of [-1, 1]) m.blob(sx * 8, j.shoulderY - 1, 0, 3.8, 3, 4, '#5c5c74');
      m.paint((v) => v.c === '#3c3c4c' && v.z >= 4 && v.y % 3 === 0, '#5c5c74');
      m.box(-6, j.hip + 1, 4, 6, j.hip + 2, 4, '#1c1c24');
      // Cape.
      m.tri([-7, j.shoulderY], [7, j.shoulderY], [-9, 3], -5, '#6c1818', 1);
      m.tri([7, j.shoulderY], [9, 3], [-9, 3], -5, '#6c1818', 1);
      // Longsword + kite shield.
      sword(m, j.rHand, 18, '#d8dce8', '#c8a040');
      const [sx0, sy0, sz0] = j.lHand;
      m.blob(sx0 - 1, sy0 + 3, sz0 + 1, 2, 8, 5.5, '#3c2c5c');
      m.blob(sx0 - 2, sy0 + 3, sz0 + 1, 1, 6, 4, '#a8a8c0');
      m.box(sx0 - 3, sy0 + 3, sz0 - 1, sx0 - 3, sy0 + 5, sz0 + 3, '#f8d800');
      break;
    }
    case 'troll': {
      const skin = '#7c907c';
      const j = figure(m, {
        legLen: 16, torso: 18, hipW: 5, shoulderW: 10, legR: 4, armR: 3.4, chest: 7, headR: 6,
        skin, top: skin, bottom: '#5c4834', boots: skin, hunch: 5,
        lHand: [-14, 5, 8], rHand: [14, 14, 9],
      });
      const [, hy, hz] = j.headC;
      m.blob(0, j.hip + 1, 2, 7, 4, 6, '#6c5438');
      m.paint((v) => v.c === skin && v.y > j.shoulderY - 3 && (v.x * 3 + v.z) % 5 === 0, '#5c7c4c');
      m.blob(0, hy - 1, hz + 5, 2.5, 3.5, 3, '#8ca08c');
      eyes(m, hy + 2, hz + 5, 3, '#f8a800', '#f8f0c0', 1);
      m.box(-4, hy + 3, hz + 5, -2, hy + 3, hz + 5, '#3c4c3c').box(2, hy + 3, hz + 5, 4, hy + 3, hz + 5, '#3c4c3c');
      m.box(-3, hy - 4, hz + 5, 3, hy - 4, hz + 5, '#2c2c24');
      m.dot(-2, hy - 3, hz + 6, '#f0e8d0').dot(2, hy - 3, hz + 6, '#f0e8d0');
      for (const sx of [-1, 1]) m.blob(sx * 6, hy + 1, hz - 1, 1.5, 2.5, 1.5, skin);
      const [cx, cy, cz] = j.rHand;
      m.capsule([cx, cy - 2, cz], [cx + 2, cy + 20, cz - 2], 2, '#7c5430', 4.2);
      m.paint((v) => v.c === '#7c5430' && v.y > cy + 14 && (v.x + v.z) % 3 === 0, '#5c3c20');
      break;
    }
    case 'imp': {
      const skin = '#e84828';
      const j = figure(m, {
        legLen: 8, torso: 8, hipW: 2.5, shoulderW: 3.8, legR: 1.6, armR: 1.3, chest: 3, headR: 4.5,
        skin, top: skin, bottom: '#b83018', boots: '#3c1c10', rHand: [7, 18, 6], lHand: [-6, 10, 3],
      });
      const [, hy, hz] = j.headC;
      for (const sx of [-1, 1]) m.chain([[sx * 3, hy + 3, hz], [sx * 5, hy + 7, hz - 1], [sx * 5, hy + 10, hz - 3]], 1.2, '#3c1c10', 0.4);
      eyes(m, hy + 1, hz + 4, 2, '#f8f800', '#fff8c0', 2);
      m.box(-2, hy - 2, hz + 4, 2, hy - 2, hz + 4, '#3c0808');
      m.dot(-2, hy - 1, hz + 4, '#fcfcfc').dot(2, hy - 1, hz + 4, '#fcfcfc');
      for (const sx of [-1, 1]) {
        m.tri([sx * 3, 20], [sx * 16, 30], [sx * 13, 12], -3, '#a82010', 1);
        m.capsule([sx * 3, 20, -3], [sx * 16, 30, -3], 0.6, '#6c1008');
      }
      m.chain([[0, 9, -2], [2, 5, -6], [5, 4, -8], [7, 6, -9]], 0.9, skin, 0.6);
      m.tri([6, 6], [9, 9], [9, 4], -9, '#6c1008', 1);
      const [fx, fy, fz] = j.rHand;
      m.blob(fx, fy + 4, fz, 3, 3, 3, '#f89820');
      m.blob(fx, fy + 4.5, fz + 1, 1.8, 1.8, 1.8, '#fff080');
      break;
    }
    case 'wraith': {
      const robe = '#241c34';
      m.capsule([0, 44, 0], [0, 10, 0], 6, robe, 11);
      m.blob(0, 44, 0, 7, 7, 6.5, '#1c1628');
      m.blob(0, 43, 3, 5, 5, 4, '#08060c');
      glowEyes(m, 44, 7, 2, '#58f0ff');
      m.carve((v) => v.y < 14 && (v.x * 5 + v.z * 3) % 7 === 0);
      for (let x = -10; x <= 10; x += 4) m.capsule([x, 10, 0], [x * 1.1, 2, 0], 1.8, robe, 0.6);
      for (const sx of [-1, 1]) {
        m.capsule([sx * 7, 38, 0], [sx * 11, 30, 7], 2.4, robe, 1.8);
        for (let f = -1; f <= 1; f++) m.capsule([sx * 11, 30, 7], [sx * (12 + f), 26, 10 + f], 0.6, '#c8c0b0');
      }
      m.paint((v) => v.c === robe && (v.x * 3 + v.y * 7 + v.z) % 13 === 0, '#3c2c50');
      break;
    }
    case 'minotaur': {
      const fur = '#8c5c34';
      const j = figure(m, {
        legLen: 17, torso: 17, hipW: 4.5, shoulderW: 9, legR: 3.4, armR: 3, chest: 6, headR: 5.5,
        skin: fur, top: fur, bottom: '#4c3424', boots: '#2c2018', rHand: [12, 26, 6], lHand: [-11, 16, 4],
      });
      const [, hy, hz] = j.headC;
      m.paint((v) => v.c === fur && v.z > 3 && Math.abs(v.x) < 5 && v.y > j.hip + 4 && v.y < j.shoulderY, '#a8784c');
      m.blob(0, hy - 1, hz + 5, 4, 3.5, 4, '#a8784c');
      m.dot(-2, hy - 1, hz + 9, '#2c1c10').dot(2, hy - 1, hz + 9, '#2c1c10');
      m.capsule([-3, hy - 3, hz + 8], [3, hy - 3, hz + 8], 0.6, '#f8d800');
      glowEyes(m, hy + 2, hz + 5, 3, '#f81818');
      for (const sx of [-1, 1]) {
        m.chain([[sx * 5, hy + 3, hz], [sx * 10, hy + 4, hz + 1], [sx * 12, hy + 8, hz + 3]], 1.6, '#f0e8d0', 0.6);
        m.blob(sx * 6, hy + 1, hz - 1, 1.5, 2.5, 1, fur);
      }
      m.box(-5, j.hip + 1, 5, 5, j.hip + 2, 5, '#3c2418');
      // Double axe.
      const [ax, ay, az] = j.rHand;
      m.capsule([ax, ay - 12, az], [ax, ay + 12, az], 1, '#6c4c2c');
      for (const side of [-1, 1]) m.blob(ax + side * 4, ay + 9, az, 4, 5, 1, '#c8ccd8');
      m.blob(ax, ay + 9, az, 1.5, 1.5, 1.5, '#8c8c9c');
      break;
    }
    case 'lich': {
      const bone = '#e4dcc4';
      const robe = '#4c2078';
      const j = figure(m, {
        legLen: 18, torso: 16, hipW: 4, shoulderW: 7, legR: 3, armR: 1.4, chest: 5, headR: 5,
        skin: bone, top: robe, bottom: robe, boots: robe, hands: bone, lHand: [-11, 24, 4], rHand: [9, 32, 8],
      });
      const [, hy, hz] = j.headC;
      m.capsule([0, 16, 0], [0, 2, 0], 7, robe, 11);
      m.paint((v) => v.c === robe && (Math.abs(v.x) <= 1 || v.y <= 3) && v.z > 2, '#f8c800');
      m.paint((v) => v.c === robe && (v.x * 3 + v.y * 5) % 11 === 0, '#5c2c90');
      m.blob(0, hy, hz, 5, 5.5, 4.8, bone);
      m.box(-3, hy, hz + 4, -1, hy + 2, hz + 4, '#101010').box(1, hy, hz + 4, 3, hy + 2, hz + 4, '#101010');
      glowEyes(m, hy + 1, hz + 5, 1, '#58f858');
      m.box(0, hy - 2, hz + 5, 0, hy - 1, hz + 5, '#303030');
      for (let x = -2; x <= 2; x++) m.dot(x, hy - 4, hz + 4, x % 2 ? '#303030' : '#fcfcf0');
      // Crown.
      m.capsule([-5, hy + 5, hz], [5, hy + 5, hz], 1, '#f8c800');
      for (let x = -4; x <= 4; x += 2) m.box(x, hy + 6, hz + 1, x, hy + 8 + (x === 0 ? 2 : 0), hz + 1, '#f8d800');
      m.dot(0, hy + 7, hz + 2, '#e82020');
      // Collar + cape.
      m.blob(0, j.shoulderY + 1, -1, 8, 3, 4, '#2c1048');
      m.tri([-8, j.shoulderY + 2], [8, j.shoulderY + 2], [-12, 1], -6, '#2c1048', 1);
      m.tri([8, j.shoulderY + 2], [12, 1], [-12, 1], -6, '#2c1048', 1);
      // Staff with a glowing orb.
      const [sx0, sy0, sz0] = j.lHand;
      m.capsule([sx0, 1, sz0], [sx0, sy0 + 20, sz0], 0.9, '#5c4428');
      m.blob(sx0, sy0 + 23, sz0, 3, 3, 3, '#48e848');
      m.blob(sx0 - 0.5, sy0 + 24, sz0 + 1, 1.4, 1.4, 1.4, '#c8ffc8');
      const [hx, hy2, hz2] = j.rHand;
      m.blob(hx, hy2 + 3, hz2, 2, 2, 2, '#88ff88');
      break;
    }
    case 'darkGuard': {
      const plate = '#24242c';
      const j = figure(m, {
        legLen: 18, torso: 16, hipW: 4, shoulderW: 8, legR: 3.2, armR: 2.8, chest: 6, headR: 5.5,
        skin: plate, top: '#1c1c24', bottom: plate, boots: '#141418', hands: '#141418',
        rHand: [11, 20, 6], lHand: [-11, 17, 4],
      });
      const [, hy, hz] = j.headC;
      // Great spiked helm with a slit visor and burning eyes.
      m.blob(0, hy, hz, 6, 6.5, 6, '#2c2c36');
      m.box(-4, hy, hz + 5, 4, hy + 1, hz + 6, '#060608');
      m.box(-3, hy, hz + 7, -2, hy + 1, hz + 7, '#f82020').box(2, hy, hz + 7, 3, hy + 1, hz + 7, '#f82020');
      for (const [sx, sy] of [[0, 1], [-0.8, 0.6], [0.8, 0.6]] as [number, number][]) {
        m.capsule([sx * 4, hy + sy * 5, hz], [sx * 9, hy + 5 + sy * 8, hz - 1], 1.4, '#3c3c48', 0.3);
      }
      for (const sx of [-1, 1]) {
        m.blob(sx * 9, j.shoulderY, 0, 4.5, 3.5, 4.5, '#2c2c38');
        m.capsule([sx * 10, j.shoulderY + 2, 0], [sx * 13, j.shoulderY + 7, 0], 1.1, '#4c4c58', 0.3);
      }
      m.paint((v) => v.c === '#1c1c24' && v.z >= 4 && v.y % 4 === 0, '#34343f');
      m.box(-7, j.hip + 1, 5, 7, j.hip + 2, 5, '#5c1818');
      // Battle axe: long haft, a great crescent blade.
      const [ax, ay, az] = j.rHand;
      m.capsule([ax, ay - 14, az], [ax, ay + 16, az], 1, '#3c2c1c');
      m.blob(ax + 5, ay + 11, az, 5.5, 8, 1, '#8c909c');
      m.carve((v) => v.c === '#8c909c' && v.x < ax + 1);
      m.paint((v) => v.c === '#8c909c' && v.x >= ax + 8, '#d8dce8');
      break;
    }
    case 'golem': {
      const rock = '#8c8478';
      for (const sx of [-1, 1]) {
        m.capsule([sx * 6, 19, 0], [sx * 6.5, 4, 1], 4.4, rock, 4.8);
        m.blob(sx * 6.5, 2, 2, 5.5, 2.5, 6.5, '#7c7468');
      }
      m.blob(0, 22, 0, 10, 4, 7, '#7c7468');
      m.blob(0, 31, 0, 13, 10, 8, rock);
      m.blob(0, 33, 4, 9, 5, 5, '#9c948a');
      m.blob(0, 42, 3, 4.5, 4, 4.5, '#7c7468');
      m.box(-3, 42, 7, -2, 43, 8, '#f8d800').box(2, 42, 7, 3, 43, 8, '#f8d800');
      m.box(-2, 39, 7, 2, 39, 8, '#3c3830');
      for (const sx of [-1, 1]) {
        m.blob(sx * 13, 36, 0, 5.5, 5, 5.5, '#9c948a');
        m.capsule([sx * 14, 34, 0], [sx * 16, 22, 4], 3.8, rock);
        m.capsule([sx * 16, 22, 4], [sx * 16, 12, 6], 4, rock, 4.6);
        m.blob(sx * 16, 9, 6, 5.5, 5, 5.5, '#7c7468');
      }
      // Cracks and seams.
      m.paint((v) => (v.c === rock || v.c === '#9c948a') && (v.x * 7 + v.y * 3 + v.z * 5) % 13 === 0, '#5c5448');
      m.paint((v) => v.c === rock && v.y === 27 && v.z > 4, '#4c463c');
      break;
    }
    case 'hydra': {
      const flesh = '#6c7458';
      const bone = '#2c2824';
      m.blob(0, 13, -6, 14, 10, 12, flesh);
      m.blob(0, 9, -1, 11, 6, 10, '#7c8468');
      for (const [sx, sz] of [[-1, 4], [1, 4], [-1, -13], [1, -13]] as [number, number][]) {
        m.capsule([sx * 9, 10, sz], [sx * 11, 1, sz + 2], 3.2, flesh, 2.5);
        m.blob(sx * 11, 1, sz + 3, 3.4, 1.5, 4, bone);
      }
      m.chain([[0, 10, -17], [5, 6, -24], [11, 4, -28]], 2.8, flesh, 1);
      // Five heads fanned out on long necks.
      const heads: [number, number][] = [[-21, 32], [-11, 43], [0, 49], [11, 43], [21, 32]];
      for (const [hx, hy] of heads) {
        m.chain([[hx * 0.25, 20, 2], [hx * 0.6, (20 + hy) / 2 + 3, 5], [hx, hy, 8]], 2.7, flesh, 2.1);
        m.blob(hx, hy + 1, 10, 3.6, 3, 4.6, flesh);
        m.blob(hx, hy - 1.8, 11, 3, 1.3, 4, '#4c5438');
        m.box(hx - 2, hy - 0.5, 14, hx + 2, hy - 0.5, 14, '#f0e8d0');
        m.dot(hx - 2, hy + 3, 13, '#f8e030').dot(hx + 2, hy + 3, 13, '#f8e030');
      }
      // Rotting: black bone and raw organs showing through.
      m.paint((v) => v.c === flesh && (v.x * 5 + v.y * 7 + v.z * 3) % 11 === 0, bone);
      m.paint((v) => v.c === '#7c8468' && v.z > 7 && (v.x + v.y) % 5 === 0, '#7c2830');
      break;
    }
    case 'ent': {
      const bark = '#5c4430';
      const dark = '#3c2c1c';
      const leaf = '#3c5c28';
      m.capsule([0, 2, 0], [0, 40, 0], 8, bark, 6);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        m.capsule([Math.cos(a) * 5, 5, Math.sin(a) * 5], [Math.cos(a) * 14, 0.5, Math.sin(a) * 14], 2.6, bark, 1.2);
      }
      m.paint((v) => v.c === bark && (v.x + 64) % 3 === 0, dark);
      // A terrible face in the trunk.
      m.paint((v) => v.z >= 5 && Math.abs(v.x) <= 4 && v.y >= 17 && v.y <= 23, '#140a04');
      m.paint((v) => v.z >= 5 && v.y >= 29 && v.y <= 31 && Math.abs(Math.abs(v.x) - 3) <= 1, '#140a04');
      for (const sx of [-1, 1]) m.box(sx * 3, 30, 8, sx * 3, 30, 8, '#f82818');
      for (let x = -3; x <= 3; x += 2) m.dot(x, 23, 8, '#d8c8a0').dot(x + 1, 17, 8, '#d8c8a0');
      m.box(-4, 32, 7, -1, 32, 8, dark).box(1, 32, 7, 4, 32, 8, dark);
      // Branch arms reaching out, and a ragged crown.
      for (const sx of [-1, 1]) {
        m.chain([[sx * 6, 34, 0], [sx * 14, 40, 3], [sx * 20, 35, 7], [sx * 22, 27, 9]], 2.3, bark, 0.8);
        m.chain([[sx * 14, 40, 3], [sx * 17, 48, 2]], 1.2, bark, 0.5);
        m.chain([[sx * 22, 27, 9], [sx * 24, 24, 11]], 0.8, dark, 0.4);
      }
      m.blob(0, 49, -3, 14, 7, 10, leaf);
      for (const [lx, ly] of [[-12, 44], [12, 44], [-6, 54], [7, 53]] as [number, number][]) m.blob(lx, ly, -2, 6, 4, 6, '#2c4c20');
      m.paint((v) => (v.c === leaf || v.c === '#2c4c20') && (v.x * 3 + v.y * 5 + v.z) % 7 === 0, '#5c7c34');
      break;
    }
    case 'ghoul': {
      const skin = '#8c9c84';
      const j = figure(m, {
        legLen: 14, torso: 12, hipW: 2.8, shoulderW: 5, legR: 1.8, armR: 1.5, chest: 3.5, headR: 4.4,
        skin, top: skin, bottom: '#3c342c', boots: skin, hunch: 5,
        lHand: [-9, 10, 10], rHand: [9, 12, 11],
      });
      const [, hy, hz] = j.headC;
      // Ribs showing through grey skin, a rag round the hips.
      for (let y = j.hip + 4; y < j.shoulderY - 2; y += 2) m.paint((v) => v.c === skin && v.y === y && v.z > 2 && Math.abs(v.x) < 4, '#6c7c64');
      m.blob(0, j.hip, 1, 4.5, 3, 4, '#3c342c');
      m.carve((v) => v.c === '#3c342c' && v.y < j.hip - 1 && (v.x + v.z) % 2 === 0);
      for (const sx of [-1, 1]) m.chain([[sx * 4, hy + 1, hz], [sx * 7, hy + 4, hz - 2]], 1, skin, 0.4);
      m.box(-3, hy + 1, hz + 4, -2, hy + 1, hz + 4, '#f8f8a0').box(2, hy + 1, hz + 4, 3, hy + 1, hz + 4, '#f8f8a0');
      m.box(-3, hy - 3, hz + 3, 3, hy - 2, hz + 4, '#2c1010');
      for (let x = -3; x <= 3; x++) m.dot(x, x % 2 ? hy - 2 : hy - 3, hz + 5, '#f0e8d0');
      // Long black claws.
      for (const [hx, hyy, hzz] of [j.lHand, j.rHand]) {
        for (let f = -1; f <= 1; f++) m.capsule([hx + f, hyy, hzz], [hx + f * 1.5, hyy - 4, hzz + 3], 0.6, '#1c1818');
      }
      break;
    }
    case 'necromancer': {
      const robe = '#141418';
      const j = figure(m, {
        legLen: 18, torso: 15, hipW: 3.5, shoulderW: 6, legR: 2.6, armR: 1.8, chest: 4.5, headR: 4.6,
        skin: '#d8d0c8', top: robe, bottom: robe, boots: robe, hands: '#d8d0c8', lHand: [-9, 22, 5], rHand: [8, 34, 7],
      });
      const [, hy, hz] = j.headC;
      m.capsule([0, 17, 0], [0, 2, 0], 6.5, robe, 10);
      m.paint((v) => v.c === robe && (Math.abs(v.x) <= 1 || v.y <= 3) && v.z > 2, '#8c1414');
      m.paint((v) => v.c === robe && (v.x * 5 + v.y * 3 + v.z * 7) % 17 === 0, '#2c2030');
      // Hood, milky pupil-less eyes, needle teeth.
      m.blob(0, hy + 1, hz - 1.5, 6, 6.5, 6, '#1c1c24');
      m.carve((v) => v.c === '#1c1c24' && v.z > hz + 1 && v.y < hy + 4 && Math.abs(v.x) < 4.5);
      m.box(-3, hy + 1, hz + 4, -2, hy + 1, hz + 4, '#f0f0f8').box(2, hy + 1, hz + 4, 3, hy + 1, hz + 4, '#f0f0f8');
      m.box(-2, hy - 3, hz + 4, 2, hy - 3, hz + 4, '#3c0c0c');
      for (let x = -2; x <= 2; x += 2) m.dot(x, hy - 2, hz + 4, '#fcfcfc');
      m.tri([-7, j.shoulderY + 1], [7, j.shoulderY + 1], [-11, 1], -6, '#0c0c10', 1);
      m.tri([7, j.shoulderY + 1], [11, 1], [-11, 1], -6, '#0c0c10', 1);
      // Bone staff with a skull, and a raised hand crackling with red power.
      const [sx0, sy0, sz0] = j.lHand;
      m.capsule([sx0, 1, sz0], [sx0, sy0 + 18, sz0], 0.9, '#d8d0c0');
      m.blob(sx0, sy0 + 21, sz0, 2.6, 2.6, 2.4, '#e8e0d0');
      m.dot(sx0 - 1, sy0 + 21, sz0 + 2, '#f82020').dot(sx0 + 1, sy0 + 21, sz0 + 2, '#f82020');
      const [hx, hy2, hz2] = j.rHand;
      m.blob(hx, hy2 + 4, hz2, 3, 3, 3, '#e82020');
      m.blob(hx, hy2 + 4.5, hz2 + 1, 1.6, 1.6, 1.6, '#ffc0a0');
      break;
    }
    case 'hellhound': {
      const fur = '#241c1c';
      m.blob(0, 15, -3, 6.5, 6.5, 12, fur);
      m.blob(0, 18, 7, 6, 6.5, 6, '#2c2020');
      m.blob(0, 20, 13, 4.5, 4.5, 5, fur);
      m.blob(0, 18, 18, 2.6, 2.4, 3.2, '#1c1414');
      m.box(-2, 16, 20, 2, 16, 21, '#f0e8d0');
      m.dot(0, 19, 21, '#080808');
      m.box(-3, 22, 17, -2, 22, 17, '#f82818').box(2, 22, 17, 3, 22, 17, '#f82818');
      for (const sx of [-1, 1]) m.chain([[sx * 3, 24, 12], [sx * 4, 28, 10]], 1.4, fur, 0.4);
      for (const [sx, z] of [[-1, 7], [1, 7], [-1, -11], [1, -11]] as [number, number][]) {
        m.capsule([sx * 4, 12, z], [sx * 4.5, 1, z + 1], 1.9, fur, 1.5);
        m.blob(sx * 4.5, 1, z + 2, 2, 1, 2.5, '#141010');
      }
      m.chain([[0, 17, -14], [0, 21, -19], [1, 24, -21]], 1.3, fur, 0.6);
      // A burning mane down the spine.
      m.paint((v) => v.c === fur && v.y >= 19 && (v.x + v.z) % 2 === 0, '#f86818');
      m.paint((v) => v.c === '#f86818' && v.y >= 21 && v.z % 3 === 0, '#ffd040');
      break;
    }
    case 'demon': {
      const skin = '#c83818';
      const j = figure(m, {
        legLen: 17, torso: 16, hipW: 4.5, shoulderW: 8.5, legR: 3.2, armR: 2.8, chest: 6, headR: 5,
        skin, top: skin, bottom: '#6c1408', boots: '#2c0c04', hands: '#2c0c04', rHand: [12, 26, 7], lHand: [-12, 26, 7],
      });
      const [, hy, hz] = j.headC;
      m.paint((v) => v.c === skin && v.z > 3 && Math.abs(v.x) < 6 && v.y > j.hip + 4 && v.y < j.shoulderY, '#e85020');
      for (const sx of [-1, 1]) m.chain([[sx * 3, hy + 3, hz], [sx * 7, hy + 6, hz], [sx * 8, hy + 11, hz + 2]], 1.6, '#2c1c14', 0.4);
      m.box(-3, hy + 1, hz + 4, -1, hy + 1, hz + 4, '#fff060').box(1, hy + 1, hz + 4, 3, hy + 1, hz + 4, '#fff060');
      m.box(-3, hy - 3, hz + 4, 3, hy - 2, hz + 4, '#2c0404');
      m.dot(-2, hy - 2, hz + 5, '#fcfcfc').dot(2, hy - 2, hz + 5, '#fcfcfc');
      for (const sx of [-1, 1]) {
        m.tri([sx * 5, j.shoulderY], [sx * 26, j.shoulderY + 14], [sx * 20, j.hip - 4], -5, '#7c1008', 1);
        m.capsule([sx * 5, j.shoulderY, -5], [sx * 26, j.shoulderY + 14, -5], 0.8, '#3c0804');
      }
      // Fire licking from both hands and crowning the head.
      for (const [fx, fy, fz] of [j.lHand, j.rHand]) {
        m.blob(fx, fy + 4, fz, 3, 4, 3, '#f89820');
        m.blob(fx, fy + 5, fz + 1, 1.6, 2.2, 1.6, '#fff080');
      }
      m.blob(0, hy + 7, hz - 1, 4, 3, 3, '#f87818');
      break;
    }
    case 'serpent': {
      const scale = '#3c5c2c';
      const coils: P[] = [];
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * Math.PI * 3.2;
        const rad = 12 - i * 0.45;
        coils.push([Math.cos(a) * rad, 3 + i * 0.35, Math.sin(a) * rad - 2]);
      }
      m.chain(coils, 3.4, scale, 2.6);
      m.chain([coils[coils.length - 1], [0, 16, 3], [0, 26, 6], [0, 32, 9]], 2.6, scale, 2.2);
      // Flared hood and a fanged head.
      m.blob(0, 30, 7, 6.5, 6, 1.5, '#4c6c34');
      m.paint((v) => v.c === '#4c6c34' && v.z >= 8 && Math.abs(v.x) < 3, '#d8c060');
      m.blob(0, 34, 11, 3.2, 2.4, 4, scale);
      m.dot(-2, 35, 14, '#f8e018').dot(2, 35, 14, '#f8e018');
      m.box(-1, 32, 14, -1, 31, 14, '#fcfcfc').box(1, 32, 14, 1, 31, 14, '#fcfcfc');
      m.box(0, 33, 15, 0, 33, 17, '#e82020');
      m.paint((v) => v.c === scale && (v.x * 3 + v.y * 5 + v.z) % 6 === 0, '#5c7c3c');
      break;
    }
    case 'scorpion': {
      const shell = '#9c6428';
      const dark = '#5c3814';
      for (let s = 0; s < 3; s++) m.blob(0, 8, -2 - s * 7, 7 - s, 5, 4.5, s % 2 ? dark : shell);
      m.blob(0, 8, 7, 6, 4.5, 5, shell);
      m.box(-2, 11, 11, -2, 11, 11, '#101010').box(2, 11, 11, 2, 11, 11, '#101010');
      for (const sx of [-1, 1]) {
        // Pincers.
        m.chain([[sx * 5, 8, 9], [sx * 11, 9, 13], [sx * 11, 10, 18]], 1.8, shell, 1.4);
        m.blob(sx * 11, 10, 21, 3, 2.2, 3.5, dark);
        m.box(sx * 10, 10, 24, sx * 10, 10, 26, dark).box(sx * 13, 10, 24, sx * 13, 10, 25, dark);
        // Legs.
        for (let k = 0; k < 4; k++) {
          const z = 5 - k * 5;
          m.chain([[sx * 5, 8, z], [sx * 11, 11, z - 1], [sx * 14, 0.5, z - 2]], 1, dark, 0.7);
        }
      }
      // Tail arched over the back.
      const tail: P[] = [[0, 9, -16], [0, 15, -20], [0, 23, -18], [0, 29, -12], [0, 30, -5], [0, 27, 0]];
      m.chain(tail, 2.6, shell, 1.6);
      m.paint((v) => v.c === shell && v.y > 12 && v.y % 3 === 0, dark);
      m.blob(0, 26, 2, 2.2, 2.2, 2.2, '#c8a028');
      m.capsule([0, 25, 3], [0, 21, 5], 0.7, '#101010');
      break;
    }
    case 'dustDevil': {
      // A spinning funnel of sand, widening upward.
      for (let y = 1; y <= 44; y += 2) {
        const rad = 2 + (y / 44) * 12 + Math.sin(y * 0.5) * 1.2;
        const off = Math.sin(y * 0.18) * 3;
        m.blob(off, y, 0, rad, 1.4, rad * 0.8, y % 4 ? '#c8a878' : '#a88858');
      }
      m.carve((v) => Math.hypot(v.x - Math.sin(v.y * 0.18) * 3, v.z) < 1 + (v.y / 44) * 8 && v.z < 3);
      m.paint((v) => (v.x * 2 + v.y + v.z * 3) % 7 === 0, '#e8d0a0');
      m.paint((v) => (v.x + v.y * 3) % 11 === 0, '#7c6440');
      break;
    }
    case 'mummy': {
      const wrap = '#d8ccaa';
      const j = figure(m, {
        legLen: 16, torso: 14, hipW: 3.2, shoulderW: 6, legR: 2.6, armR: 2.2, chest: 4.5, headR: 5,
        skin: wrap, top: wrap, bottom: wrap, boots: wrap, hunch: 2,
        lHand: [-5, 28, 14], rHand: [5, 27, 15],
      });
      const [, hy, hz] = j.headC;
      // Bandage bands, loose ends, and dark gaps.
      m.paint((v) => v.c === wrap && (v.y + Math.round(v.x * 0.5)) % 3 === 0, '#b8a884');
      m.paint((v) => v.c === wrap && (v.x * 7 + v.y * 13 + v.z * 5) % 23 === 0, '#4c4030');
      m.chain([[-3, j.hip, 3], [-5, j.hip - 6, 5], [-4, j.hip - 11, 6]], 0.7, wrap, 0.5);
      m.chain([[4, j.shoulderY - 2, 3], [7, j.shoulderY - 8, 4]], 0.7, wrap, 0.5);
      m.box(-4, hy + 1, hz + 4, 4, hy + 1, hz + 4, '#1c1408');
      m.dot(-2, hy + 1, hz + 5, '#58f0ff').dot(2, hy + 1, hz + 5, '#58f0ff');
      // A gold pectoral collar.
      m.blob(0, j.shoulderY, 2, 6, 2, 4, '#e8b828');
      m.paint((v) => v.c === '#e8b828' && v.x % 2 === 0, '#2c6ca8');
      break;
    }
    case 'hawkman': {
      const skin = '#b8864c';
      const j = figure(m, {
        legLen: 17, torso: 15, hipW: 3.8, shoulderW: 7, legR: 2.7, armR: 2.3, chest: 5, headR: 5,
        skin, top: skin, bottom: '#f0ece0', boots: skin, lHand: [-11, 26, 8], rHand: [11, 26, 8],
      });
      const [, hy, hz] = j.headC;
      // Kilt, belt and a broad collar.
      m.blob(0, j.hip - 2, 1, 5, 4, 4, '#f0ece0');
      m.box(-5, j.hip + 1, 4, 5, j.hip + 2, 4, '#e8b828');
      m.blob(0, j.shoulderY, 1, 7.5, 2, 5, '#e8b828');
      m.paint((v) => v.c === '#e8b828' && v.y === j.shoulderY && v.x % 2 === 0, '#2c6ca8');
      // Hawk head with a hooked beak.
      m.blob(0, hy, hz, 5, 5.5, 5, '#5c4024');
      m.paint((v) => v.c === '#5c4024' && v.y < hy - 1, '#f0e8d8');
      m.capsule([0, hy + 0.5, hz + 4], [0, hy - 2.5, hz + 8], 1.6, '#f8c800', 0.6);
      m.box(-3, hy + 2, hz + 4, -2, hy + 2, hz + 4, '#101010').box(2, hy + 2, hz + 4, 3, hy + 2, hz + 4, '#101010');
      m.dot(-3, hy + 2, hz + 5, '#f8a800').dot(3, hy + 2, hz + 5, '#f8a800');
      m.blob(0, hy + 6, hz - 1, 3, 2, 3, '#e82020');
      // Cruel talons.
      for (const [tx, ty, tz] of [j.lHand, j.rHand]) {
        for (let f = -1; f <= 1; f++) m.capsule([tx + f, ty + 1, tz], [tx + f * 1.6, ty + 5, tz + 2], 0.6, '#1c1810');
      }
      break;
    }
    case 'riff':
      robed(m, '#1c1c20', '#241c1c', false);
      break;
    case 'sheik':
      robed(m, '#f0ece0', '#c8a040', true);
      break;
    case 'captive': {
      // Lady Mirabelle, in a torn gown, chained by the wrists.
      const skin = '#f0c8a8';
      const gown = '#3c5cb8';
      const j = figure(m, {
        legLen: 15, torso: 13, hipW: 2.8, shoulderW: 4.6, legR: 2, armR: 1.4, chest: 3.8, headR: 4.4,
        skin, top: gown, bottom: gown, boots: gown, lHand: [-4, 16, 5], rHand: [4, 16, 5],
      });
      const [, hy, hz] = j.headC;
      m.capsule([0, 16, 0], [0, 1, 0], 5, gown, 8.5);
      m.paint((v) => v.c === gown && v.y <= 2, '#c8a040');
      m.carve((v) => v.c === gown && v.y < 5 && (v.x * 3 + v.z) % 5 === 0);
      // Long golden hair.
      m.blob(0, hy + 1.5, hz - 1.5, 5, 5.5, 4.5, '#e8c048');
      m.capsule([0, hy, hz - 3], [0, j.shoulderY - 8, -4], 4, '#e8c048', 2.5);
      m.carve((v) => v.c === '#e8c048' && v.z > hz + 1 && v.y < hy + 3 && Math.abs(v.x) < 4);
      m.blob(0, hy, hz, 4.2, 4.6, 4, skin);
      eyes(m, hy + 1, hz + 4, 2, '#3c7cc8', '#fcfcf8', 1);
      m.box(-1, hy - 2, hz + 4, 1, hy - 2, hz + 4, '#c85c6c');
      m.box(-3, hy + 5, hz, 3, hy + 5, hz, '#e8e8f0');
      // Manacles and chain.
      m.box(-5, 15, 5, -3, 17, 6, '#6c6c74').box(3, 15, 5, 5, 17, 6, '#6c6c74');
      for (let k = 0; k < 7; k++) m.dot(-4 + Math.round(k * 1.3), 14 - Math.round(Math.sin((k / 6) * Math.PI) * 4), 6, k % 2 ? '#8c8c94' : '#5c5c64');
      break;
    }
    case 'altar': {
      // A blood-stained altar under two black candelabras.
      m.box(-12, 0, -5, 12, 11, 4, '#3c3440');
      m.box(-13, 11, -6, 13, 12, 5, '#4c4450');
      m.paint((v) => (v.x + v.y) % 5 === 0 && v.z >= 4, '#2c2430');
      m.paint((v) => v.z === 4 && Math.abs(v.x) < 3 && v.y > 3 && v.y < 10, '#8c1818');
      for (const bx of [-6, 6]) {
        m.blob(bx, 13, 0, 2.5, 1.2, 2.5, '#8c8c94');
        m.blob(bx, 13.5, 0, 1.8, 0.6, 1.8, '#a01010');
      }
      for (const sx of [-1, 1]) {
        m.capsule([sx * 11, 12, -3], [sx * 11, 30, -3], 0.8, '#1c1c20');
        m.capsule([sx * 8, 28, -3], [sx * 14, 28, -3], 0.7, '#1c1c20');
        for (const cx of [8, 11, 14]) {
          m.box(sx * cx, 29, -3, sx * cx, 31, -3, '#e8e0c8');
          m.dot(sx * cx, 32, -3, '#f8a020').dot(sx * cx, 33, -3, '#fff080');
        }
      }
      break;
    }
    case 'gargoyle': {
      const stone = '#7c7c80';
      m.box(-8, 0, -6, 8, 5, 6, '#5c5c60');
      for (const sx of [-1, 1]) {
        m.capsule([sx * 4, 7, 2], [sx * 5, 5, 6], 2.4, stone);
        m.capsule([sx * 5, 12, 1], [sx * 4, 6, 5], 2.2, stone);
        m.tri([sx * 4, 22], [sx * 16, 32], [sx * 10, 10], -4, '#6c6c70', 1);
        m.capsule([sx * 4, 22, -4], [sx * 16, 32, -4], 0.7, '#5c5c60');
      }
      m.blob(0, 14, 0, 6, 8, 5, stone);
      m.blob(0, 25, 3, 5, 4.5, 4.5, stone);
      m.box(-4, 23, 7, 4, 23, 7, '#3c3c40');
      for (let x = -3; x <= 3; x += 2) m.dot(x, 22, 7, '#a8a8ac');
      m.box(-3, 26, 7, -2, 26, 7, '#1c1c20').box(2, 26, 7, 3, 26, 7, '#1c1c20');
      for (const sx of [-1, 1]) m.chain([[sx * 3, 28, 2], [sx * 6, 32, 0], [sx * 6, 36, -2]], 1.2, stone, 0.4);
      m.paint((v) => v.c === stone && (v.x * 3 + v.y * 5 + v.z * 7) % 11 === 0, '#6c6c70');
      break;
    }
    case 'tree': {
      const bark = '#4c3824';
      m.capsule([0, 0, 0], [1, 30, 0], 3.6, bark, 2.4);
      for (const [dx, dy, dz] of [[-12, 36, 2], [11, 38, -1], [-4, 44, -3], [6, 46, 3]] as P[]) {
        m.chain([[0.8, 24, 0], [dx * 0.6, dy - 4, dz * 0.6], [dx, dy, dz]], 1.4, bark, 0.6);
        m.blob(dx, dy + 2, dz, 7, 5, 6, '#2c4c20');
      }
      m.blob(0, 44, 0, 10, 7, 9, '#345828');
      m.paint((v) => (v.c === '#2c4c20' || v.c === '#345828') && (v.x * 3 + v.y * 5 + v.z) % 6 === 0, '#4c6c30');
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        m.capsule([Math.cos(a) * 2, 3, Math.sin(a) * 2], [Math.cos(a) * 7, 0.5, Math.sin(a) * 7], 1.4, bark, 0.8);
      }
      break;
    }
    case 'obelisk': {
      const stone = '#c8a46c';
      for (let y = 0; y < 50; y++) {
        const hw = Math.round(5 - y * 0.05);
        m.box(-hw, y, -hw, hw, y, hw, stone);
      }
      for (let k = 0; k < 4; k++) m.box(-2 + Math.round(k * 0.3), 50 + k, -2 + Math.round(k * 0.3), 2 - Math.round(k * 0.3), 50 + k, 2 - Math.round(k * 0.3), '#e8c048');
      m.paint((v) => v.c === stone && v.z >= 3 && Math.abs(v.x) <= 2 && v.y % 5 < 2 && v.y > 6, '#7c6440');
      m.paint((v) => v.c === stone && v.y < 3, '#a8885c');
      m.paint((v) => v.c === '#a8885c' && v.z >= 4 && (v.x + v.y) % 2 === 0, '#6c1c14');
      break;
    }
    case 'palm': {
      const trunk: P[] = [];
      for (let i = 0; i <= 8; i++) trunk.push([Math.sin(i * 0.3) * 4, i * 5.5, 0]);
      m.chain(trunk, 2.6, '#8c6c44', 1.8);
      m.paint((v) => v.c === '#8c6c44' && v.y % 3 === 0, '#6c5030');
      const [tx, ty] = trunk[trunk.length - 1];
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const ex = Math.cos(a) * 18;
        const ez = Math.sin(a) * 12;
        m.chain([[tx, ty, 0], [tx + ex * 0.5, ty + 5, ez * 0.5], [tx + ex, ty - 4, ez]], 1.6, '#3c7c30', 0.5);
      }
      m.blob(tx, ty - 1, 1, 2.4, 2, 2.4, '#5c3c1c');
      m.blob(tx + 2, ty - 2, 2, 1.6, 1.6, 1.6, '#5c3c1c');
      break;
    }
    case 'diamond': {
      m.capsule([0, 0, 0], [0, 6, 0], 4, '#e8e4dc', 3);
      m.blob(0, 7, 0, 4.5, 1, 4.5, '#f0ece4');
      gem(m, 15, 6, '#c8f0ff', '#ffffff');
      m.paint((v) => v.c === '#c8f0ff' && v.x < 0, '#88c8f0');
      break;
    }
    case 'sarcophagus': {
      // A painted coffin stood upright.
      m.blob(0, 22, 0, 8, 21, 5, '#e8b828');
      m.paint((v) => v.c === '#e8b828' && v.y < 38 && v.y % 4 === 0, '#2c6ca8');
      m.blob(0, 38, 4, 4.5, 5, 2.5, '#d8a060');
      m.blob(0, 40, 2, 6.5, 6.5, 3, '#2c6ca8');
      m.paint((v) => v.c === '#2c6ca8' && v.y > 34 && v.x % 2 === 0, '#e8b828');
      m.blob(0, 38.5, 6, 3.8, 4.3, 1.2, '#d8a060');
      m.box(-2, 39, 7, -1, 39, 7, '#101010').box(1, 39, 7, 2, 39, 7, '#101010');
      m.box(0, 32, 6, 0, 34, 7, '#3c2c10');
      for (const sx of [-1, 1]) m.capsule([sx * 5, 28, 5], [-sx * 3, 23, 6], 1.3, '#d8a060');
      m.capsule([-3, 25, 7], [3, 25, 7], 0.6, '#e82020');
      break;
    }
    case 'barkeep': {
      const skin = '#ecbc94';
      const j = figure(m, {
        legLen: 15, torso: 15, hipW: 4, shoulderW: 7, legR: 2.8, armR: 2.3, chest: 7, headR: 5.5,
        skin, top: '#fcfcf4', bottom: '#4c3420', rHand: [8, 26, 7],
      });
      const [, hy, hz] = j.headC;
      m.blob(0, j.hip + 6, 4, 7, 7, 5, '#fcfcf4');
      m.blob(0, j.hip + 3, 7, 6, 8, 2, '#c8a878');
      m.box(-6, j.hip + 10, 6, 6, j.hip + 10, 7, '#8c6c44');
      eyes(m, hy + 1, hz + 4, 2, '#3c7cc8', '#fcfcf8', 1);
      m.blob(0, hy - 1, hz + 5, 1.5, 1.4, 1.2, '#e8988c');
      m.capsule([-4, hy - 2.5, hz + 4.5], [4, hy - 2.5, hz + 4.5], 1.2, '#7c4c24');
      m.blob(0, hy + 4, hz - 1, 5, 2, 4.5, '#7c4c24');
      m.box(-4, hy + 3, hz + 4, -1, hy + 3, hz + 4, '#7c4c24').box(1, hy + 3, hz + 4, 4, hy + 3, hz + 4, '#7c4c24');
      const [mx, my, mz] = j.rHand;
      m.box(mx - 1, my + 1, mz - 2, mx + 3, my + 6, mz + 2, '#c8903c');
      m.box(mx - 1, my + 6, mz - 2, mx + 3, my + 7, mz + 2, '#fcfcf0');
      m.box(mx + 4, my + 2, mz, mx + 5, my + 5, mz, '#c8903c');
      break;
    }
    case 'provisioner': {
      const skin = '#dcac80';
      const j = figure(m, {
        legLen: 15, torso: 14, hipW: 3.2, shoulderW: 5.8, legR: 2.2, armR: 1.9, chest: 4.5, headR: 5,
        skin, top: '#58843c', bottom: '#5c4c34', rHand: [7, 24, 7], lHand: [-7, 15, 3],
      });
      const [, hy, hz] = j.headC;
      m.blob(0, j.shoulderY - 5, 3.5, 5, 6, 2, '#8c6c3c');
      m.capsule([-5, j.shoulderY, 3], [4, j.hip, 4], 0.8, '#5c3c20');
      m.blob(5, j.hip - 1, 3, 2.5, 3, 2, '#8c6c3c');
      m.blob(0, hy + 4, hz, 5.5, 2.5, 5.5, '#386028');
      m.blob(0, hy + 3, hz + 4, 5, 0.8, 3, '#386028');
      m.dot(0, hy + 6, hz, '#f8d800');
      eyes(m, hy + 1, hz + 4, 2, '#4c3420', '#fcfcf4', 1);
      m.box(-1, hy - 1, hz + 5, 1, hy - 1, hz + 5, '#c88c6c');
      m.box(-2, hy - 3, hz + 4, 2, hy - 3, hz + 4, '#8c4c3c');
      const [tx, ty, tz] = j.rHand;
      m.capsule([tx, ty - 3, tz], [tx, ty + 6, tz], 0.9, '#7c4c24');
      m.blob(tx, ty + 8, tz, 1.8, 2.5, 1.8, '#ff9020');
      m.blob(tx, ty + 8.5, tz + 0.5, 1, 1.4, 1, '#fff080');
      break;
    }
    case 'smith': {
      const skin = '#c89070';
      const j = figure(m, {
        legLen: 15, torso: 16, hipW: 4, shoulderW: 8, legR: 3, armR: 2.8, chest: 6, headR: 5,
        skin, top: skin, bottom: '#3c3428', rHand: [10, 28, 5], lHand: [-9, 15, 5],
      });
      const [, hy, hz] = j.headC;
      m.blob(0, j.hip + 8, 5, 7, 10, 2, '#5c3c24');
      m.capsule([-6, j.shoulderY, 5], [-3, j.shoulderY - 5, 6], 0.7, '#3c2414').capsule([6, j.shoulderY, 5], [3, j.shoulderY - 5, 6], 0.7, '#3c2414');
      m.blob(0, hy - 4, hz + 3, 4.5, 4.5, 2.5, '#6c3c1c');
      eyes(m, hy + 1, hz + 4, 2, '#3c2c1c', '#f8f0e8', 1);
      m.box(-3, hy + 3, hz + 4, -1, hy + 3, hz + 4, '#4c2c14').box(1, hy + 3, hz + 4, 3, hy + 3, hz + 4, '#4c2c14');
      m.blob(0, hy + 4, hz - 1, 5, 2, 4.5, '#4c2c14');
      m.carve((v) => v.y > hy + 4 && v.c === skin);
      // Hammer raised.
      const [hx, hhy, hhz] = j.rHand;
      m.capsule([hx, hhy - 3, hhz], [hx, hhy + 9, hhz], 0.9, '#6c4c2c');
      m.box(hx - 3, hhy + 9, hhz - 2, hx + 3, hhy + 12, hhz + 2, '#8c8c98');
      m.box(hx - 3, hhy + 12, hhz - 2, hx + 3, hhy + 12, hhz + 2, '#b8b8c4');
      break;
    }
    case 'priest': {
      const skin = '#ecc8a4';
      const robe = '#f0ece0';
      const j = figure(m, {
        legLen: 15, torso: 14, hipW: 3.5, shoulderW: 6, legR: 2.4, armR: 2.2, chest: 4.5, headR: 5,
        skin, top: robe, bottom: robe, boots: robe, lHand: [-2, 24, 7], rHand: [2, 24, 7],
      });
      const [, hy, hz] = j.headC;
      m.capsule([0, 16, 0], [0, 2, 0], 6, robe, 9);
      m.paint((v) => v.c === robe && Math.abs(v.x) <= 1 && v.z > 3, '#d8b030');
      m.paint((v) => v.c === robe && v.y <= 3, '#d8b030');
      m.blob(0, hy + 1, hz - 1.5, 6, 6, 6, '#e0dccc');
      m.carve((v) => v.c === '#e0dccc' && v.z > hz + 1 && v.y < hy + 4 && Math.abs(v.x) < 5);
      eyes(m, hy + 1, hz + 4, 2, '#58884c', '#fcfcf4', 1);
      m.box(-1, hy - 2, hz + 4, 1, hy - 2, hz + 4, '#c87c6c');
      // Holy sun symbol held up.
      m.blob(0, 28, 9, 3, 3, 1, '#f8d800');
      m.blob(0, 28, 10, 1.6, 1.6, 0.6, '#fff8c0');
      for (const [dx, dy] of [[0, 5], [0, -5], [5, 0], [-5, 0], [4, 4], [-4, 4], [4, -4], [-4, -4]]) m.dot(dx, 28 + dy, 9, '#f8c800');
      break;
    }
    case 'guildmaster': {
      const skin = '#e4bc98';
      const robe = '#2c3c9c';
      const j = figure(m, {
        legLen: 15, torso: 15, hipW: 3.5, shoulderW: 6, legR: 2.4, armR: 2.2, chest: 4.5, headR: 5,
        skin, top: robe, bottom: robe, boots: robe, rHand: [8, 22, 6],
      });
      const [, hy, hz] = j.headC;
      m.capsule([0, 16, 0], [0, 2, 0], 6, robe, 9);
      m.paint((v) => v.c === robe && (v.x * 7 + v.y * 11 + v.z * 3) % 17 === 0, '#f8e070');
      m.blob(0, hy - 5, hz + 3, 4, 6, 2.5, '#f0f0f0');
      eyes(m, hy + 1, hz + 4, 2, '#3c6cd8', '#fcfcf8', 1);
      m.box(-3, hy + 3, hz + 4, -1, hy + 3, hz + 4, '#d8d8d8').box(1, hy + 3, hz + 4, 3, hy + 3, hz + 4, '#d8d8d8');
      // Tall hat.
      m.blob(0, hy + 4, hz, 8, 1.2, 8, '#1c2c7c');
      m.chain([[0, hy + 4, hz], [0, hy + 12, hz - 1], [1, hy + 18, hz - 3], [3, hy + 21, hz - 5]], 4.5, '#1c2c7c', 0.6);
      m.paint((v) => v.c === '#1c2c7c' && v.y > hy + 6 && (v.x + v.y + v.z) % 6 === 0, '#f8e070');
      const [sx0, sy0, sz0] = j.rHand;
      m.capsule([sx0, 1, sz0], [sx0, sy0 + 16, sz0], 0.9, '#6c4c2c');
      m.blob(sx0, sy0 + 18, sz0, 2.4, 2.4, 2.4, '#58b8ff');
      m.dot(sx0 - 1, sy0 + 19, sz0 + 2, '#e8f8ff');
      break;
    }
    case 'chest':
    case 'chestOpen': {
      const wood = '#8c5c2c';
      m.box(-8, 0, -5, 8, 7, 5, wood);
      m.paint((v) => v.x % 4 === 0, '#6c4420');
      for (const x of [-8, -1, 8]) m.box(x, 0, -5, x, 7, 5, '#a8a8b0');
      m.box(-8, 0, 5, 8, 0, 5, '#a8a8b0');
      if (id === 'chest') {
        m.capsule([-8, 8, 0], [8, 8, 0], 5, '#9c6c34');
        m.carve((v) => v.y < 8 && v.c === '#9c6c34');
        for (const x of [-8, -1, 8]) m.paint((v) => v.x === x && v.y >= 8, '#a8a8b0');
        m.box(-1, 5, 6, 1, 9, 6, '#f8d800');
        m.dot(0, 6, 7, '#3c2c10');
      } else {
        m.box(-8, 8, -6, 8, 15, -5, '#9c6c34');
        m.blob(0, 7, 0, 7, 2, 4, '#f8d800');
        for (const [x, z] of [[-4, 1], [3, -2], [0, 3]]) m.dot(x, 9, z, '#fff8c0');
      }
      break;
    }
    case 'fountain':
      m.blob(0, 2, 0, 13, 2.5, 13, '#8c8c94');
      m.blob(0, 3.5, 0, 11.5, 1, 11.5, '#3c7cd8');
      m.capsule([0, 3, 0], [0, 14, 0], 2, '#a8a8b0');
      m.blob(0, 15, 0, 6, 1.5, 6, '#9c9ca4');
      m.blob(0, 16, 0, 5, 0.6, 5, '#58a8f8');
      m.capsule([0, 16, 0], [0, 22, 0], 0.8, '#b8e0ff');
      for (const [dx, dz] of [[4, 0], [-4, 0], [0, 4], [0, -4]]) m.chain([[dx, 16, dz], [dx * 1.8, 12, dz * 1.8], [dx * 2.4, 5, dz * 2.4]], 0.6, '#a8d8ff');
      break;
    case 'crystal':
      m.capsule([0, 0, 0], [0, 8, 0], 5, '#8c8c98', 4);
      m.blob(0, 9, 0, 5, 1.2, 5, '#a8a8b4');
      m.capsule([0, 10, 0], [0, 24, 0], 3.5, '#88e0ff', 0.4);
      m.capsule([0, 10, 0], [0, 17, 0], 3.8, '#a8ecff', 2);
      m.paint((v) => v.c === '#88e0ff' && (v.x + v.y) % 3 === 0, '#d8f8ff');
      m.dot(-1, 20, 2, '#ffffff');
      break;
    case 'throne':
      m.box(-11, 0, -4, 11, 9, 6, '#4c3c5c');
      m.box(-11, 10, -6, 11, 44, -3, '#4c3c5c');
      m.paint((v) => (v.x + v.y) % 6 === 0 && v.z >= -3, '#5c4c6c');
      for (const sx of [-1, 1]) {
        m.box(sx * 11, 10, -3, sx * 9, 17, 6, '#4c3c5c');
        m.blob(sx * 10, 18, 5, 2, 2, 2, '#f8c800');
        m.capsule([sx * 11, 44, -4], [sx * 11, 50, -4], 1.5, '#f8c800');
      }
      m.box(-6, 10, -2, 6, 38, -2, '#7c2020');
      m.box(-11, 44, -4, 11, 45, -4, '#f8c800');
      break;
    case 'gate':
      // The hidden exit, once found: an arch of pale stone around a shimmering portal.
      m.box(-14, 0, -2, -10, 46, 2, '#b8b0c8').box(10, 0, -2, 14, 46, 2, '#b8b0c8');
      m.capsule([-12, 46, 0], [12, 46, 0], 3, '#c8c0d8');
      m.box(-9, 0, 0, 9, 44, 0, '#58d8ff');
      m.paint((v) => v.c === '#58d8ff' && (v.x * 3 + v.y) % 5 === 0, '#c8f8ff');
      break;
  }
  return m;
}

export const MODEL_SIZE = 128;

/** Small creatures are drawn a bit larger than life so they read at a distance. */
const SIZE_BOOST: Partial<Record<ModelId, number>> = { rat: 1.6, goblin: 1.12, imp: 1.18, slime: 1.05, chest: 1.1, scorpion: 1.2, serpent: 1.1, diamond: 1.1 };

/**
 * Renders a model face-on into a raycaster sprite texture (and a canvas for UI
 * use), with a soft contact shadow under it.
 */
export function renderModel(id: ModelId, size = MODEL_SIZE): { tex: SpriteTex; canvas: HTMLCanvasElement } {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  const unit = (size / 64) * (SIZE_BOOST[id] ?? 1);
  const originY = 0.95;
  renderVoxels(ctx, build(id), Math.PI + 0.32, { size, unit, pitch: 0.14, originY, grain: 0.08, ao: 0.1 });
  pixelate(ctx, 0, 0, size, size, true);
  // Contact shadow, drawn behind the figure.
  const floating = id === 'bat' || id === 'ghost' || id === 'wraith' || id === 'dustDevil';
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = `rgba(0,0,0,${floating ? 0.25 : 0.45})`;
  ctx.beginPath();
  ctx.ellipse(size / 2, size * originY, size * (floating ? 0.14 : 0.22), size * 0.035, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  const px = new Uint32Array(ctx.getImageData(0, 0, size, size).data.buffer.slice(0));
  return { tex: { w: size, h: size, px }, canvas: cv };
}

/**
 * Sprite textures map one texture height to this many wall heights; each
 * model's own voxel height then sets its size (a rat ~16 voxels, a troll ~56).
 */
export const SPRITE_SCALE = 1.3;
