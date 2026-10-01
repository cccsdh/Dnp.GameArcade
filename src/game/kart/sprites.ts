import Phaser from 'phaser';
import { VEHICLES, type ItemId } from './config';
import { bananaModel, decorModel, itemBoxModel, orbModel, starModel, turboModel, vehicleModel } from './models';
import type { DecorKind } from './tracks';
import { renderSheet, type RenderOpts } from '../shared/voxel';

/** Frames rendered per kart (one every 22.5 degrees). */
export const KART_FRAMES = 16;
/** Kart sprite cell size, and world units per sprite pixel (1 voxel = 1 world unit). */
export const KART_CELL = 64;
const KART_UNIT = 1.7;
export const KART_WORLD_PER_PX = 1 / KART_UNIT;
/** Where the ground contact point sits inside a kart cell (fraction of height). */
export const KART_ORIGIN_Y = 0.72;

export const PROP_CELL = 64;
const PROP_UNIT = 2;
export const PROP_WORLD_PER_PX = 1 / PROP_UNIT;
export const PROP_ORIGIN_Y = 0.9;

export const ITEMBOX_FRAMES = 8;

const DECOR_KINDS: DecorKind[] = ['tree', 'bush', 'flowers', 'tires', 'cactus', 'rock', 'barrel', 'pine', 'snowman', 'crystal'];

function addSheet(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement, frames: number, cell: number): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, canvas)!;
  for (let i = 0; i < frames; i++) tex.add(i, 0, i * cell, 0, cell, cell);
}

function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  scene.textures.addCanvas(key, cv);
}

export function itemModel(id: ItemId) {
  switch (id) {
    case 'banana':
      return bananaModel();
    case 'bouncer':
      return orbModel('#38c838', '#88f070');
    case 'homer':
      return orbModel('#e83030', '#f88888');
    case 'star':
      return starModel();
    default:
      return turboModel();
  }
}

/** Builds every Turbo Kart texture. Safe to call more than once. */
export function generateKartTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('kart_kart')) return;
  const kartOpts: RenderOpts = { size: KART_CELL, unit: KART_UNIT, pitch: 0.36, originY: KART_ORIGIN_Y };
  const bigOpts: RenderOpts = { size: 200, unit: 5.5, pitch: 0.4, originY: 0.72 };
  for (const v of VEHICLES) {
    const model = vehicleModel(v);
    addSheet(scene, `kart_${v.id}`, renderSheet(model, KART_FRAMES, kartOpts), KART_FRAMES, KART_CELL);
    addSheet(scene, `kartbig_${v.id}`, renderSheet(model, KART_FRAMES, bigOpts), KART_FRAMES, 200);
  }

  const propOpts: RenderOpts = { size: PROP_CELL, unit: PROP_UNIT, pitch: 0.3, originY: PROP_ORIGIN_Y };
  for (const kind of DECOR_KINDS) {
    const sheet = renderSheet(decorModel(kind), 1, { ...propOpts, unit: kind === 'tree' || kind === 'pine' ? 2.2 : PROP_UNIT });
    addSheet(scene, `deco_${kind}`, sheet, 1, PROP_CELL);
  }
  addSheet(scene, 'itembox', renderSheet(itemBoxModel(), ITEMBOX_FRAMES, { ...propOpts, originY: 0.75 }), ITEMBOX_FRAMES, PROP_CELL);
  for (const id of ['turbo', 'banana', 'bouncer', 'homer', 'star'] as ItemId[]) {
    addSheet(scene, `item_${id}`, renderSheet(itemModel(id), 1, { ...propOpts, originY: 0.75 }), 1, PROP_CELL);
    addSheet(scene, `icon_${id}`, renderSheet(itemModel(id), 1, { size: 96, unit: 6, pitch: 0.35, originY: 0.78 }), 1, 96);
  }

  // Particles and overlays.
  canvasTexture(scene, 'kp_px', 4, 4, (c) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, 4, 4);
  });
  canvasTexture(scene, 'kp_puff', 16, 16, (c) => {
    const g = c.createRadialGradient(8, 8, 1, 8, 8, 8);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 16, 16);
  });
  canvasTexture(scene, 'kp_spark', 8, 8, (c) => {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(4, 0);
    c.lineTo(5, 3);
    c.lineTo(8, 4);
    c.lineTo(5, 5);
    c.lineTo(4, 8);
    c.lineTo(3, 5);
    c.lineTo(0, 4);
    c.lineTo(3, 3);
    c.fill();
  });
  canvasTexture(scene, 'kp_flame', 16, 24, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 24);
    g.addColorStop(0, '#fff8a0');
    g.addColorStop(0.4, '#ffb020');
    g.addColorStop(1, 'rgba(255,60,0,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(8, 24);
    c.quadraticCurveTo(0, 10, 4, 0);
    c.quadraticCurveTo(8, 6, 12, 0);
    c.quadraticCurveTo(16, 10, 8, 24);
    c.fill();
  });
  canvasTexture(scene, 'kp_hitstar', 12, 12, (c) => {
    c.fillStyle = '#f8e040';
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 2.5 : 6;
      const a = (Math.PI * i) / 5 - Math.PI / 2;
      c.lineTo(6 + Math.cos(a) * r, 6 + Math.sin(a) * r);
    }
    c.fill();
  });
  canvasTexture(scene, 'kp_shadow', 32, 12, (c) => {
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath();
    c.ellipse(16, 6, 15, 5, 0, 0, Math.PI * 2);
    c.fill();
  });
}
