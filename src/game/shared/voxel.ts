/**
 * A tiny voxel modeller + software renderer, shared by the games that need
 * original 3D-looking sprites without art files: Turbo Kart's karts, drivers,
 * items and props (16 viewing angles per kart, so the Mode-7 view can show
 * every side), and The Underrealm's monsters and dungeon props. Models are
 * built from coloured voxels and rendered into sprite frames at load time.
 *
 * Model space: x = right, y = up, z = forward. At yaw 0 the model's front
 * (+z) points away from the viewer; yaw = PI shows it face-on.
 */

export interface Voxel {
  x: number;
  y: number;
  z: number;
  c: string;
}

export class VoxelModel {
  private map = new Map<string, Voxel>();

  /** Fills an inclusive box. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: string): this {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) this.map.set(`${x},${y},${z}`, { x, y, z, c });
    return this;
  }

  /** A box plus its mirror image across x = 0. */
  pair(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: string): this {
    return this.box(x0, y0, z0, x1, y1, z1, c).box(-x0, y0, z0, -x1, y1, z1, c);
  }

  dot(x: number, y: number, z: number, c: string): this {
    return this.box(x, y, z, x, y, z, c);
  }

  /** Rough filled ellipsoid. */
  blob(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, c: string): this {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
          const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
          if (d <= 1) this.map.set(`${x},${y},${z}`, { x, y, z, c });
        }
    return this;
  }

  /** A rounded limb: every voxel within `r` of the segment a-b (r can taper from ra to rb). */
  capsule(a: [number, number, number], b: [number, number, number], ra: number, c: string, rb = ra): this {
    const [ax, ay, az] = a;
    const [bx, by, bz] = b;
    const r = Math.max(ra, rb);
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const len2 = dx * dx + dy * dy + dz * dz || 1;
    for (let x = Math.floor(Math.min(ax, bx) - r); x <= Math.ceil(Math.max(ax, bx) + r); x++)
      for (let y = Math.floor(Math.min(ay, by) - r); y <= Math.ceil(Math.max(ay, by) + r); y++)
        for (let z = Math.floor(Math.min(az, bz) - r); z <= Math.ceil(Math.max(az, bz) + r); z++) {
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / len2));
          const px = ax + dx * t - x;
          const py = ay + dy * t - y;
          const pz = az + dz * t - z;
          const rr = ra + (rb - ra) * t;
          if (px * px + py * py + pz * pz <= rr * rr) this.map.set(`${x},${y},${z}`, { x, y, z, c });
        }
    return this;
  }

  /** A chain of capsules through the given points (bent arms, curling tails). */
  chain(points: [number, number, number][], r: number, c: string, rEnd = r): this {
    for (let i = 0; i < points.length - 1; i++) {
      const t0 = i / (points.length - 1);
      const t1 = (i + 1) / (points.length - 1);
      this.capsule(points[i], points[i + 1], r + (rEnd - r) * t0, c, r + (rEnd - r) * t1);
    }
    return this;
  }

  /** A flat triangle one voxel thick in the x-y plane at depth z (wing membranes, capes). */
  tri(a: [number, number], b: [number, number], c3: [number, number], z: number, c: string, thick = 1): this {
    const minX = Math.floor(Math.min(a[0], b[0], c3[0]));
    const maxX = Math.ceil(Math.max(a[0], b[0], c3[0]));
    const minY = Math.floor(Math.min(a[1], b[1], c3[1]));
    const maxY = Math.ceil(Math.max(a[1], b[1], c3[1]));
    const sign = (p: [number, number], q: [number, number], r: [number, number]) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
    for (let x = minX; x <= maxX; x++)
      for (let y = minY; y <= maxY; y++) {
        const p: [number, number] = [x, y];
        const d1 = sign(p, a, b);
        const d2 = sign(p, b, c3);
        const d3 = sign(p, c3, a);
        const neg = d1 < 0 || d2 < 0 || d3 < 0;
        const pos = d1 > 0 || d2 > 0 || d3 > 0;
        if (neg && pos) continue;
        for (let t = 0; t < thick; t++) this.map.set(`${x},${y},${z + t}`, { x, y, z: z + t, c });
      }
    return this;
  }

  /** Recolours existing voxels that match a test (belts, stripes, markings). */
  paint(test: (v: Voxel) => boolean, c: string): this {
    for (const v of this.map.values()) if (test(v)) v.c = c;
    return this;
  }

  /** Mirrors every voxel with x < 0 onto x > 0 (build one side, get both). */
  mirrorX(): this {
    for (const v of [...this.map.values()]) if (v.x < 0) this.map.set(`${-v.x},${v.y},${v.z}`, { ...v, x: -v.x });
    return this;
  }

  remove(x: number, y: number, z: number): this {
    this.map.delete(`${x},${y},${z}`);
    return this;
  }

  /** Removes voxels that match a test (tears in cloth, eye sockets). */
  carve(test: (v: Voxel) => boolean): this {
    for (const [k, v] of this.map) if (test(v)) this.map.delete(k);
    return this;
  }

  has(x: number, y: number, z: number): boolean {
    return this.map.has(`${x},${y},${z}`);
  }

  voxels(): Voxel[] {
    return [...this.map.values()];
  }
}

export interface RenderOpts {
  /** Canvas size (square). */
  size: number;
  /** Screen pixels per voxel. */
  unit: number;
  /** Camera pitch, radians (0 = side-on, positive = looking down). */
  pitch: number;
  /** Where model origin (0,0,0) lands, as a fraction of size. */
  originY: number;
  /** Draw a 1px dark outline around the silhouette. */
  outline?: boolean;
  /** Per-voxel brightness jitter (0 = flat colour, ~0.1 = subtle grain). */
  grain?: number;
  /** Ambient occlusion strength: darkens faces tucked into creases. */
  ao?: number;
}

const FACES: { n: [number, number, number]; corners: [number, number, number][] }[] = [
  { n: [1, 0, 0], corners: [[0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [0.5, -0.5, 0.5]] },
  { n: [-1, 0, 0], corners: [[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]] },
  { n: [0, 1, 0], corners: [[-0.5, 0.5, -0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5]] },
  { n: [0, -1, 0], corners: [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]] },
  { n: [0, 0, 1], corners: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]] },
  { n: [0, 0, -1], corners: [[-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5], [0.5, -0.5, -0.5]] },
];

function parseColor(c: string): [number, number, number] {
  const v = parseInt(c.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/**
 * Renders `model` turned by `yaw` (radians; 0 = nose pointing away from the
 * viewer, positive = nose turned toward the viewer's right) into `ctx` at
 * (ox, oy) within a `size` cell.
 */
export function renderVoxels(ctx: CanvasRenderingContext2D, model: VoxelModel, yaw: number, o: RenderOpts, ox = 0, oy = 0): void {
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const cosP = Math.cos(o.pitch);
  const sinP = Math.sin(o.pitch);
  const view = (x: number, y: number, z: number): [number, number, number] => {
    const xv = x * cosY + z * sinY;
    const zv = -x * sinY + z * cosY;
    const sx = xv;
    const sy = -(y * cosP + zv * sinP);
    const depth = zv * cosP - y * sinP;
    return [sx, sy, depth];
  };
  // Light from the upper left, slightly toward the camera.
  const light = [-0.45, 0.8, -0.4];
  const ll = Math.hypot(light[0], light[1], light[2]);
  const toCam = [0, sinP, -cosP];

  const faces = FACES.map((f) => {
    const [nx, ny, nz] = f.n;
    const vx = nx * cosY + nz * sinY;
    const vz = -nx * sinY + nz * cosY;
    const visible = vx * toCam[0] + ny * toCam[1] + vz * toCam[2] > 0.01;
    const lit = Math.max(0, (vx * light[0] + ny * light[1] + vz * light[2]) / ll);
    return { ...f, visible, shade: 0.58 + 0.42 * lit };
  }).filter((f) => f.visible);

  const vox = model.voxels().map((v) => ({ v, d: view(v.x, v.y, v.z)[2] }));
  vox.sort((a, b) => b.d - a.d);

  const grain = o.grain ?? 0;
  const aoStrength = o.ao ?? 0;
  const cx = ox + o.size / 2;
  const cy = oy + o.size * o.originY;
  for (const { v } of vox) {
    const [r, g, b] = parseColor(v.c);
    // Deterministic per-voxel grain so surfaces don't look flat-shaded.
    const h = ((Math.imul(v.x * 73856093 ^ v.y * 19349663 ^ v.z * 83492791, 2654435761) >>> 0) % 1000) / 1000;
    const jitter = 1 + (h - 0.5) * 2 * grain;
    for (const f of faces) {
      const [nx, ny, nz] = f.n;
      // Faces buried against a neighbour can never be seen.
      if (model.has(v.x + nx, v.y + ny, v.z + nz)) continue;
      let occl = 0;
      if (aoStrength > 0) {
        // Count solid voxels hugging this face's edges (crease darkening).
        const ax = nx !== 0 ? [0, 1, 0] : [1, 0, 0];
        const bx = nz !== 0 ? [0, 1, 0] : [0, 0, 1];
        for (const [ux, uy, uz] of [ax, bx]) {
          if (model.has(v.x + nx + ux, v.y + ny + uy, v.z + nz + uz)) occl++;
          if (model.has(v.x + nx - ux, v.y + ny - uy, v.z + nz - uz)) occl++;
        }
      }
      const k = f.shade * jitter * (1 - occl * aoStrength);
      ctx.beginPath();
      f.corners.forEach(([dx, dy, dz], i) => {
        const [sx, sy] = view(v.x + dx, v.y + dy, v.z + dz);
        const px = cx + sx * o.unit;
        const py = cy + sy * o.unit;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      const col = `rgb(${Math.min(255, Math.round(r * k))},${Math.min(255, Math.round(g * k))},${Math.min(255, Math.round(b * k))})`;
      ctx.fillStyle = col;
      ctx.strokeStyle = col;
      ctx.lineWidth = 0.6;
      ctx.fill();
      ctx.stroke();
    }
  }
}

/**
 * Crisps up a rendered cell into pixel art: hard alpha edges, plus an optional
 * dark outline around the silhouette.
 */
export function pixelate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, outline: boolean): void {
  const img = ctx.getImageData(x, y, w, h);
  const d = img.data;
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    solid[i] = d[i * 4 + 3] >= 110 ? 1 : 0;
    d[i * 4 + 3] = solid[i] ? 255 : 0;
  }
  if (outline) {
    for (let py = 0; py < h; py++)
      for (let px = 0; px < w; px++) {
        const i = py * w + px;
        if (solid[i]) continue;
        const near =
          (px > 0 && solid[i - 1]) || (px < w - 1 && solid[i + 1]) || (py > 0 && solid[i - w]) || (py < h - 1 && solid[i + w]);
        if (near) {
          d[i * 4] = 16;
          d[i * 4 + 1] = 12;
          d[i * 4 + 2] = 20;
          d[i * 4 + 3] = 255;
        }
      }
  }
  ctx.putImageData(img, x, y);
}

/** Renders `frames` evenly spaced yaw angles side by side into a new canvas. */
export function renderSheet(model: VoxelModel, frames: number, o: RenderOpts): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = o.size * frames;
  cv.height = o.size;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  for (let f = 0; f < frames; f++) {
    renderVoxels(ctx, model, (f / frames) * Math.PI * 2, o, f * o.size, 0);
    pixelate(ctx, f * o.size, 0, o.size, o.size, o.outline ?? true);
  }
  return cv;
}
