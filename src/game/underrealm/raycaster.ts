import { TEX, type Texture } from './textures';

/**
 * A classic grid raycaster (Wolfenstein-style): one ray per screen column
 * finds the nearest wall with a DDA walk; floors and ceilings are cast per
 * row; billboard sprites are drawn last against a per-column depth buffer.
 * Everything is shaded by distance from the player's light (a torch), which
 * is what gives the dungeon its closing-in darkness.
 */

export interface Sprite {
  x: number;
  y: number;
  tex: SpriteTex;
  /** Height as a fraction of a wall. */
  scale: number;
  /** Vertical offset (fraction of wall height, + = up) - flying things. */
  lift: number;
  alpha?: number;
  /** Tint flash (0 = none). */
  flash?: number;
}

export interface SpriteTex {
  w: number;
  h: number;
  px: Uint32Array;
}

export interface RaySceneInput {
  camX: number;
  camY: number;
  angle: number;
  /** Returns the wall texture for a solid tile, or null for open floor. */
  wallAt(x: number, y: number): Texture | null;
  floorAt(x: number, y: number): Texture;
  ceilAt(x: number, y: number): Texture;
  /** Light radius in tiles, and an ambient floor (0..1). */
  lightRadius: number;
  ambient: number;
  flicker: number;
  sprites: Sprite[];
  /** Called for every map cell a ray passes through (for the automap). */
  onSeen?: (x: number, y: number) => void;
}

export class Raycaster {
  readonly w: number;
  readonly h: number;
  readonly image: ImageData;
  private buf: Uint32Array;
  private zbuf: Float32Array;
  private fov = 0.66;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.image = new ImageData(w, h);
    this.buf = new Uint32Array(this.image.data.buffer);
    this.zbuf = new Float32Array(w);
  }

  private light(dist: number, s: RaySceneInput): number {
    const f = Math.max(0, 1 - dist / s.lightRadius);
    return Math.min(1, s.ambient + f * f * s.flicker);
  }

  render(s: RaySceneInput): void {
    const { w, h, buf, zbuf } = this;
    const dirX = Math.cos(s.angle);
    const dirY = Math.sin(s.angle);
    const planeX = -dirY * this.fov;
    const planeY = dirX * this.fov;
    const half = h / 2;
    const mask = TEX - 1;

    // --- Floor and ceiling ----------------------------------------------------
    for (let y = Math.floor(half) + 1; y < h; y++) {
      const rowDist = half / (y - half);
      const lit = this.light(rowDist, s);
      const stepX = (rowDist * 2 * planeX) / w;
      const stepY = (rowDist * 2 * planeY) / w;
      let fx = s.camX + rowDist * (dirX - planeX);
      let fy = s.camY + rowDist * (dirY - planeY);
      const ceilRow = h - 1 - y;
      for (let x = 0; x < w; x++) {
        const cx = Math.floor(fx);
        const cy = Math.floor(fy);
        const tx = Math.floor((fx - cx) * TEX) & mask;
        const ty = Math.floor((fy - cy) * TEX) & mask;
        const fl = s.floorAt(cx, cy)[ty * TEX + tx];
        const ce = s.ceilAt(cx, cy)[ty * TEX + tx];
        buf[y * w + x] = shadePx(fl, lit);
        buf[ceilRow * w + x] = shadePx(ce, lit * 0.8);
        fx += stepX;
        fy += stepY;
      }
    }

    // --- Walls ------------------------------------------------------------------
    for (let x = 0; x < w; x++) {
      const camX = (2 * x) / w - 1;
      const rdx = dirX + planeX * camX;
      const rdy = dirY + planeY * camX;
      let mapX = Math.floor(s.camX);
      let mapY = Math.floor(s.camY);
      const ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx);
      const ddy = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
      const stepX = rdx < 0 ? -1 : 1;
      const stepY = rdy < 0 ? -1 : 1;
      let sideX = rdx < 0 ? (s.camX - mapX) * ddx : (mapX + 1 - s.camX) * ddx;
      let sideY = rdy < 0 ? (s.camY - mapY) * ddy : (mapY + 1 - s.camY) * ddy;
      let side = 0;
      let tex: Texture | null = null;
      for (let i = 0; i < 64; i++) {
        if (sideX < sideY) {
          sideX += ddx;
          mapX += stepX;
          side = 0;
        } else {
          sideY += ddy;
          mapY += stepY;
          side = 1;
        }
        s.onSeen?.(mapX, mapY);
        tex = s.wallAt(mapX, mapY);
        if (tex) break;
      }
      const dist = side === 0 ? sideX - ddx : sideY - ddy;
      zbuf[x] = dist;
      if (!tex) continue;
      let wallX = side === 0 ? s.camY + dist * rdy : s.camX + dist * rdx;
      wallX -= Math.floor(wallX);
      let texX = Math.floor(wallX * TEX);
      if ((side === 0 && rdx < 0) || (side === 1 && rdy > 0)) texX = TEX - 1 - texX;
      const lineH = h / Math.max(0.0001, dist);
      const top = Math.floor(half - lineH / 2);
      const y0 = Math.max(0, top);
      const y1 = Math.min(h, Math.floor(half + lineH / 2));
      const lit = this.light(dist, s) * (side === 1 ? 0.78 : 1);
      const texStep = TEX / lineH;
      let texPos = (y0 - top) * texStep;
      for (let y = y0; y < y1; y++) {
        const ty = Math.min(TEX - 1, Math.floor(texPos));
        texPos += texStep;
        buf[y * w + x] = shadePx(tex[ty * TEX + texX], lit);
      }
    }

    // --- Sprites (far to near) ----------------------------------------------------
    const inv = 1 / (planeX * dirY - dirX * planeY);
    const sorted = s.sprites
      .map((sp) => ({ sp, d: (sp.x - s.camX) ** 2 + (sp.y - s.camY) ** 2 }))
      .sort((a, b) => b.d - a.d);
    for (const { sp } of sorted) {
      const rx = sp.x - s.camX;
      const ry = sp.y - s.camY;
      const tX = inv * (dirY * rx - dirX * ry);
      const tY = inv * (-planeY * rx + planeX * ry);
      if (tY <= 0.12) continue;
      const screenX = Math.floor((w / 2) * (1 + tX / tY));
      const sh = Math.abs(h / tY) * sp.scale;
      const sw = sh * (sp.tex.w / sp.tex.h);
      const floorY = half + h / (2 * tY) - (sp.lift * h) / tY;
      const top = Math.floor(floorY - sh);
      const left = Math.floor(screenX - sw / 2);
      const lit = this.light(tY, s);
      const alpha = sp.alpha ?? 1;
      for (let x = Math.max(0, left); x < Math.min(w, left + sw); x++) {
        if (tY >= zbuf[x]) continue;
        const tx = Math.floor(((x - left) / sw) * sp.tex.w);
        for (let y = Math.max(0, top); y < Math.min(h, top + sh); y++) {
          const ty = Math.floor(((y - top) / sh) * sp.tex.h);
          const c = sp.tex.px[ty * sp.tex.w + tx];
          const a = c >>> 24;
          if (a < 16) continue;
          let out = shadePx(c, lit);
          if (sp.flash) out = mixPx(out, 0xffffffff, sp.flash);
          // Semi-transparent texels (contact shadows) blend; ghosts blend as a whole.
          const k = (a / 255) * alpha;
          buf[y * w + x] = k < 0.99 ? mixPx(buf[y * w + x], out, k) : out;
        }
      }
    }
  }
}

function shadePx(c: number, f: number): number {
  const r = (c & 255) * f;
  const g = ((c >>> 8) & 255) * f;
  const b = ((c >>> 16) & 255) * f;
  return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
}

function mixPx(a: number, b: number, t: number): number {
  const r = (a & 255) * (1 - t) + (b & 255) * t;
  const g = ((a >>> 8) & 255) * (1 - t) + ((b >>> 8) & 255) * t;
  const bl = ((a >>> 16) & 255) * (1 - t) + ((b >>> 16) & 255) * t;
  return (0xff000000 | (bl << 16) | (g << 8) | r) >>> 0;
}
