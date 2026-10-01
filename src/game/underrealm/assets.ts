import { renderModel, MODEL_SIZE, type ModelId } from './models';
import { decodeChipAudio, registerChipSong } from '../shared/Chiptune';
import { MUSIC_SLOTS, type DungeonPack, type SpriteDef, type TrackDef } from './pack';
import type { SpriteTex } from './raycaster';
import { loadImage, loadPackTextures, type Texture } from './textures';

/**
 * Everything a dungeon pack brings with it, ready to use: its custom
 * wall/floor textures, its sprites (built-in voxel models, re-tinted models,
 * or images - plus the built-in models on demand) and its own soundtrack.
 */

export interface SpriteAsset {
  tex: SpriteTex;
  canvas: HTMLCanvasElement;
}

/** A track ready to hand to SoundManager.playTrack. */
export interface ResolvedTrack {
  key: string;
  track: { song: string } | { buffer: AudioBuffer; volume?: number };
}

export interface PackAssets {
  textures: Record<string, Texture>;
  sprite(id: string): SpriteAsset;
  /** The adventure's own music, by slot ("town", "depths", "abyss", "battle") or "level:N". */
  music: Record<string, ResolvedTrack>;
}

const BUILTIN_MODELS = new Map<string, SpriteAsset>();

function builtin(id: string): SpriteAsset {
  let a = BUILTIN_MODELS.get(id);
  if (!a) {
    a = renderModel(id as ModelId);
    BUILTIN_MODELS.set(id, a);
  }
  return a;
}

function fromCanvas(cv: HTMLCanvasElement): SpriteAsset {
  const px = new Uint32Array(cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data.buffer.slice(0));
  return { tex: { w: cv.width, h: cv.height, px }, canvas: cv };
}

/** Multiplies a model's colours by a tint (a quick way to make a "frost skeleton" etc). */
function tinted(base: SpriteAsset, tint: string): SpriteAsset {
  const cv = document.createElement('canvas');
  cv.width = base.canvas.width;
  cv.height = base.canvas.height;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  c.drawImage(base.canvas, 0, 0);
  c.globalCompositeOperation = 'multiply';
  c.fillStyle = tint;
  c.fillRect(0, 0, cv.width, cv.height);
  c.globalCompositeOperation = 'destination-in';
  c.drawImage(base.canvas, 0, 0);
  return fromCanvas(cv);
}

async function imageSprite(def: { image: string; scale?: number }): Promise<SpriteAsset> {
  const img = await loadImage(def.image);
  const cv = document.createElement('canvas');
  cv.width = cv.height = MODEL_SIZE;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  c.imageSmoothingEnabled = false;
  // Fit inside the square, standing on its bottom edge.
  const scale = Math.min(MODEL_SIZE / img.width, MODEL_SIZE / img.height) * (def.scale ?? 1);
  const w = img.width * scale;
  const h = img.height * scale;
  c.drawImage(img, (MODEL_SIZE - w) / 2, MODEL_SIZE * 0.95 - h, w, h);
  return fromCanvas(cv);
}

const PACK_CACHE = new Map<string, PackAssets>();

async function resolveTrack(pack: DungeonPack, name: string, def: TrackDef, sound: unknown): Promise<ResolvedTrack | null> {
  const key = `pack:${pack.id}:${name}`;
  if ('song' in def) return { key: `song:${def.song}`, track: { song: def.song } };
  if ('chiptune' in def) {
    registerChipSong(key, def.chiptune);
    return { key, track: { song: key } };
  }
  const res = await fetch(def.audio);
  if (!res.ok) throw new Error(`Couldn't load music ${def.audio.slice(0, 60)} (${res.status})`);
  const buffer = await decodeChipAudio(sound, await res.arrayBuffer());
  return buffer ? { key, track: { buffer, volume: def.volume } } : null;
}

/**
 * Loads (once per pack) its textures, custom sprites and soundtrack. `sound`
 * is a Phaser sound manager (its audio context decodes any music files).
 */
export async function loadPackAssets(pack: DungeonPack, sound?: unknown): Promise<PackAssets> {
  const cached = PACK_CACHE.get(pack.id);
  if (cached) return cached;
  const textures = await loadPackTextures(pack.textures);
  const custom = new Map<string, SpriteAsset>();
  for (const [id, def] of Object.entries(pack.sprites ?? {}) as [string, SpriteDef][]) {
    if ('image' in def) custom.set(id, await imageSprite(def));
    else custom.set(id, def.tint ? tinted(builtin(def.model), def.tint) : builtin(def.model));
  }
  const music: Record<string, ResolvedTrack> = {};
  for (const slot of MUSIC_SLOTS) {
    const def = pack.music?.[slot];
    if (!def) continue;
    const t = await resolveTrack(pack, slot, def, sound);
    if (t) music[slot] = t;
  }
  for (const [i, level] of pack.levels.entries()) {
    if (!level.music || typeof level.music === 'string') continue;
    const t = await resolveTrack(pack, `level${i + 1}`, level.music, sound);
    if (t) music[`level:${i + 1}`] = t;
  }
  const assets: PackAssets = {
    textures,
    sprite: (id) => custom.get(id) ?? builtin(id),
    music,
  };
  PACK_CACHE.set(pack.id, assets);
  return assets;
}

/** Forgets a pack's cached assets (after loading a new version of it). */
export function dropPackAssets(id: string): void {
  PACK_CACHE.delete(id);
}
