import Phaser from 'phaser';
import { FLAVORS, type FlavorDef } from './config';

/**
 * Lollipop Legion draws all of its art at runtime with Graphics and bakes it
 * into textures, so there are no image files. Everything is smoothed (LINEAR)
 * rather than pixel-art, since it's round candy and squishy germs.
 */

type G = Phaser.GameObjects.Graphics;

/** Lollipop texture size, and where the candy's centre sits (the rotation pivot). */
export const POP_W = 56;
export const POP_H = 90;
export const POP_HEAD_Y = 28;

export function buildLollipopTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('lp_floor')) return;

  for (const f of FLAVORS) {
    bake(scene, `lp_pop_${f.id}`, POP_W, POP_H, (g) => drawLollipop(g, f, POP_W / 2, POP_HEAD_Y, 22));
    bake(scene, `lp_shot_${f.id}`, 16, 16, (g) => {
      g.fillStyle(f.dark, 1).fillCircle(8, 8, 7);
      g.fillStyle(f.color, 1).fillCircle(8, 8, 6);
      spiral(g, 8, 8, 5, 1.5, 2, f.stripe);
    });
  }

  bake(scene, 'lp_germ_blob', 60, 60, (g) => {
    lumpyBody(g, 30, 31, 18, 7, 0x4cc038, 0x246c18, 1);
    spots(g, 30, 31, 14, 0x3a9a2a, 2);
    angryFace(g, 30, 29, 1, true);
  });

  bake(scene, 'lp_germ_virus', 56, 56, (g) => {
    const cx = 28;
    const cy = 28;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      g.lineStyle(3, 0x5a1470, 1).lineBetween(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12, cx + Math.cos(a) * 23, cy + Math.sin(a) * 23);
      g.fillStyle(0xf070c0, 1).fillCircle(cx + Math.cos(a) * 23, cy + Math.sin(a) * 23, 3.5);
    }
    g.fillStyle(0x5a1470, 1).fillCircle(cx, cy, 16);
    g.fillStyle(0xa040c0, 1).fillCircle(cx, cy, 14);
    g.fillStyle(0xc070e0, 1).fillCircle(cx - 5, cy - 5, 4);
    // One big mean eye.
    g.fillStyle(0xfcfcfc, 1).fillCircle(cx, cy - 1, 7);
    g.fillStyle(0xd02020, 1).fillCircle(cx + 1, cy, 3.5);
    g.fillStyle(0x101010, 1).fillCircle(cx + 1, cy, 1.8);
    g.lineStyle(3, 0x2a0838, 1).lineBetween(cx - 9, cy - 10, cx + 9, cy - 6);
    g.fillStyle(0x2a0838, 1).fillRect(cx - 5, cy + 8, 10, 3);
  });

  bake(scene, 'lp_germ_splitter', 64, 48, (g) => {
    // A pill-shaped bacterium, pinched in the middle where it's about to split.
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      g.lineStyle(2, 0xa05010, 1).lineBetween(32 + Math.cos(a) * 24, 24 + Math.sin(a) * 15, 32 + Math.cos(a) * 30, 24 + Math.sin(a) * 21);
    }
    g.fillStyle(0xa05010, 1).fillRoundedRect(5, 7, 54, 34, 17);
    g.fillStyle(0xf08828, 1).fillRoundedRect(7, 9, 50, 30, 15);
    g.fillStyle(0xf8b060, 1).fillRoundedRect(11, 12, 18, 7, 3);
    g.lineStyle(2, 0xa05010, 1);
    for (let y = 12; y < 38; y += 6) g.lineBetween(32, y, 32, y + 3);
    angryFace(g, 20, 24, 0.7, false);
    angryFace(g, 44, 24, 0.7, false);
  });

  bake(scene, 'lp_germ_mini', 26, 26, (g) => {
    lumpyBody(g, 13, 13, 8, 5, 0xf08828, 0xa05010, 3);
    g.fillStyle(0xfcfcfc, 1).fillCircle(10, 12, 2.6).fillCircle(16, 12, 2.6);
    g.fillStyle(0x101010, 1).fillCircle(10.5, 12.5, 1.3).fillCircle(16.5, 12.5, 1.3);
  });

  bake(scene, 'lp_germ_spitter', 60, 64, (g) => {
    // Drippy blue goo with a big round spitting mouth.
    g.fillStyle(0x1c4c80, 1);
    for (const dx of [-11, 0, 11]) g.fillRoundedRect(30 + dx - 5, 36, 10, 22 - Math.abs(dx) * 0.6, 5);
    g.fillStyle(0x3890d8, 1);
    for (const dx of [-11, 0, 11]) g.fillRoundedRect(30 + dx - 3.5, 37, 7, 19 - Math.abs(dx) * 0.6, 3.5);
    lumpyBody(g, 30, 28, 17, 8, 0x3890d8, 0x1c4c80, 5);
    spots(g, 30, 28, 12, 0x68b0e8, 6);
    angryFace(g, 30, 23, 0.9, false);
    g.fillStyle(0x0c2440, 1).fillCircle(30, 36, 6);
    g.fillStyle(0x70e050, 1).fillCircle(30, 37, 3);
  });

  bake(scene, 'lp_germ_boss', 150, 150, (g) => {
    const cx = 75;
    const cy = 82;
    lumpyBody(g, cx, cy, 50, 11, 0x3a8a28, 0x163c0c, 7);
    spots(g, cx, cy, 40, 0x2c6c1c, 8, 9);
    angryFace(g, cx, cy - 4, 2.4, true);
    // Duke Grime's crown.
    g.fillStyle(0x806010, 1);
    g.fillPoints(crown(cx, cy - 44, 34, 22).map((p) => new Phaser.Math.Vector2(p.x, p.y + 2)), true);
    g.fillStyle(0xf8c830, 1).fillPoints(crown(cx, cy - 44, 32, 20), true);
    g.fillStyle(0xe83060, 1).fillCircle(cx, cy - 52, 4);
    g.fillStyle(0x30a0f0, 1).fillCircle(cx - 18, cy - 50, 3).fillCircle(cx + 18, cy - 50, 3);
  });

  bake(scene, 'lp_slime', 18, 18, (g) => {
    g.fillStyle(0x2c7820, 1).fillCircle(9, 9, 8);
    g.fillStyle(0x70e050, 1).fillCircle(9, 9, 6.5);
    g.fillStyle(0xd0fcb0, 1).fillCircle(7, 6, 2);
  });

  bake(scene, 'lp_heart', 28, 26, (g) => {
    heart(g, 14, 11, 12, 0x901838);
    heart(g, 14, 11, 10.5, 0xf85898);
    g.fillStyle(0xfcd0e0, 1).fillCircle(9, 8, 3);
  });

  bake(scene, 'lp_star', 32, 32, (g) => {
    g.fillStyle(0xb08010, 1).fillPoints(star(16, 16, 15, 7), true);
    g.fillStyle(0xf8e040, 1).fillPoints(star(16, 16, 13, 6), true);
    const dots = [0xe83060, 0x30a0f0, 0x60d040, 0x9048d8, 0xfcfcfc];
    dots.forEach((c, i) => {
      const a = (i / dots.length) * Math.PI * 2;
      g.fillStyle(c, 1).fillRect(16 + Math.cos(a) * 5 - 1.5, 16 + Math.sin(a) * 5 - 1.5, 3, 3);
    });
  });

  bake(scene, 'lp_dot', 10, 10, (g) => g.fillStyle(0xffffff, 1).fillCircle(5, 5, 5));
  bake(scene, 'lp_shadow', 48, 16, (g) => g.fillStyle(0x000000, 0.22).fillEllipse(24, 8, 46, 14));

  bake(scene, 'lp_floor', 96, 96, (g) => {
    g.fillStyle(0xfcd8e4, 1).fillRect(0, 0, 96, 96);
    g.fillStyle(0xf8c8da, 1).fillRect(0, 0, 48, 48).fillRect(48, 48, 48, 48);
    // Sprinkles, from a fixed seed so the tile is the same every time.
    const rnd = new Phaser.Math.RandomDataGenerator(['sprinkles']);
    const colors = [0xf85898, 0x60c0f0, 0xf8d830, 0x80d860, 0xb080f0, 0xfcfcfc];
    for (let i = 0; i < 16; i++) {
      const x = rnd.between(4, 92);
      const y = rnd.between(4, 92);
      const a = rnd.realInRange(0, Math.PI);
      g.lineStyle(3, rnd.pick(colors), 0.8).lineBetween(x, y, x + Math.cos(a) * 6, y + Math.sin(a) * 6);
    }
  });
}

function bake(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void): void {
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/** A lollipop with a face, centred on its candy at (cx, cy). */
export function drawLollipop(g: G, f: FlavorDef, cx: number, cy: number, r: number): void {
  // Stick.
  g.fillStyle(0xc8b890, 1).fillRoundedRect(cx - 3.5, cy + r - 6, 7, r * 2, 3);
  g.fillStyle(0xf8f0dc, 1).fillRoundedRect(cx - 2.5, cy + r - 6, 4, r * 2 - 2, 2);
  // Candy with its swirl.
  g.fillStyle(f.dark, 1).fillCircle(cx, cy, r + 2);
  g.fillStyle(f.color, 1).fillCircle(cx, cy, r);
  spiral(g, cx, cy, r - 3, 2.6, r / 4.5, f.stripe);
  g.fillStyle(0xffffff, 0.45).fillEllipse(cx - r * 0.45, cy - r * 0.5, r * 0.6, r * 0.35);
  // Friendly face.
  const s = r / 22;
  g.fillStyle(0xfcfcfc, 1).fillCircle(cx - 7 * s, cy - 2 * s, 5.5 * s).fillCircle(cx + 7 * s, cy - 2 * s, 5.5 * s);
  g.fillStyle(0x101010, 1).fillCircle(cx - 6 * s, cy - 1 * s, 3 * s).fillCircle(cx + 8 * s, cy - 1 * s, 3 * s);
  g.fillStyle(0xffffff, 1).fillCircle(cx - 7 * s, cy - 2.5 * s, 1.1 * s).fillCircle(cx + 7 * s, cy - 2.5 * s, 1.1 * s);
  g.fillStyle(0xff90b0, 0.8).fillEllipse(cx - 12 * s, cy + 5 * s, 6 * s, 3.5 * s).fillEllipse(cx + 12 * s, cy + 5 * s, 6 * s, 3.5 * s);
  g.fillStyle(0x401020, 1);
  g.beginPath();
  g.arc(cx, cy + 4 * s, 5 * s, 0.1 * Math.PI, 0.9 * Math.PI, false);
  g.closePath();
  g.fillPath();
}

function spiral(g: G, cx: number, cy: number, rMax: number, turns: number, width: number, color: number): void {
  g.lineStyle(width, color, 1);
  g.beginPath();
  const steps = Math.ceil(turns * 40);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    const r = t * rMax;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.strokePath();
}

/** A round body with bumps around its edge, outlined in `dark`. */
function lumpyBody(g: G, cx: number, cy: number, r: number, lumps: number, body: number, dark: number, seed: number): void {
  const rnd = new Phaser.Math.RandomDataGenerator([`lumps${seed}`]);
  const bumps = Array.from({ length: lumps }, (_, i) => {
    const a = (i / lumps) * Math.PI * 2 + rnd.realInRange(-0.2, 0.2);
    return { x: cx + Math.cos(a) * r * 0.85, y: cy + Math.sin(a) * r * 0.85, r: r * rnd.realInRange(0.38, 0.5) };
  });
  g.fillStyle(dark, 1).fillCircle(cx, cy, r + 2);
  for (const b of bumps) g.fillCircle(b.x, b.y, b.r + 2);
  g.fillStyle(body, 1).fillCircle(cx, cy, r);
  for (const b of bumps) g.fillCircle(b.x, b.y, b.r);
}

function spots(g: G, cx: number, cy: number, r: number, color: number, seed: number, n = 5): void {
  const rnd = new Phaser.Math.RandomDataGenerator([`spots${seed}`]);
  g.fillStyle(color, 1);
  for (let i = 0; i < n; i++) {
    const a = rnd.realInRange(0, Math.PI * 2);
    const d = rnd.realInRange(0.3, 0.9) * r;
    g.fillCircle(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rnd.realInRange(1.5, 3.5) * (r / 14));
  }
}

/** Two angry eyes under slanted brows, and (optionally) a toothy grin. */
function angryFace(g: G, cx: number, cy: number, s: number, teeth: boolean): void {
  g.fillStyle(0xfcfcfc, 1).fillCircle(cx - 6 * s, cy - 2 * s, 5 * s).fillCircle(cx + 6 * s, cy - 2 * s, 5 * s);
  g.fillStyle(0xd02020, 1).fillCircle(cx - 5 * s, cy - 1 * s, 2.8 * s).fillCircle(cx + 5 * s, cy - 1 * s, 2.8 * s);
  g.fillStyle(0x101010, 1).fillCircle(cx - 5 * s, cy - 1 * s, 1.5 * s).fillCircle(cx + 5 * s, cy - 1 * s, 1.5 * s);
  g.lineStyle(3 * s, 0x101010, 1);
  g.lineBetween(cx - 12 * s, cy - 10 * s, cx - 2 * s, cy - 6 * s);
  g.lineBetween(cx + 12 * s, cy - 10 * s, cx + 2 * s, cy - 6 * s);
  if (!teeth) return;
  g.fillStyle(0x301008, 1).fillEllipse(cx, cy + 8 * s, 16 * s, 8 * s);
  g.fillStyle(0xfcfcf0, 1);
  g.fillTriangle(cx - 6 * s, cy + 4.5 * s, cx - 2 * s, cy + 4.5 * s, cx - 4 * s, cy + 8 * s);
  g.fillTriangle(cx + 2 * s, cy + 4.5 * s, cx + 6 * s, cy + 4.5 * s, cx + 4 * s, cy + 8 * s);
}

function heart(g: G, cx: number, cy: number, r: number, color: number): void {
  g.fillStyle(color, 1);
  g.fillCircle(cx - r * 0.5, cy - r * 0.1, r * 0.55);
  g.fillCircle(cx + r * 0.5, cy - r * 0.1, r * 0.55);
  g.fillTriangle(cx - r * 1.03, cy + r * 0.1, cx + r * 1.03, cy + r * 0.1, cx, cy + r * 1.1);
}

function star(cx: number, cy: number, outer: number, inner: number): Phaser.Math.Vector2[] {
  return Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? inner : outer;
    return new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  });
}

function crown(cx: number, baseY: number, halfW: number, h: number): Phaser.Math.Vector2[] {
  const V = Phaser.Math.Vector2;
  return [
    new V(cx - halfW, baseY),
    new V(cx - halfW, baseY - h),
    new V(cx - halfW / 2, baseY - h * 0.45),
    new V(cx, baseY - h * 1.1),
    new V(cx + halfW / 2, baseY - h * 0.45),
    new V(cx + halfW, baseY - h),
    new V(cx + halfW, baseY),
  ];
}
