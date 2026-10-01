/**
 * Lollipop Legion: candy heroes versus germs. Tuning for the lollipops you can
 * play (and recruit as buddies), the germs, and the ten waves.
 */

export type FlavorId = 'cherry' | 'lemon' | 'grape' | 'razz';

export interface FlavorDef {
  id: FlavorId;
  name: string;
  blurb: string;
  /** Candy colour, its darker rim, and the swirl stripe. */
  color: number;
  dark: number;
  stripe: number;
  /** Pixels per second. */
  speed: number;
  hp: number;
  /** Milliseconds between shots. */
  fireDelay: number;
  damage: number;
  /** Shots per volley, fanned out (1 = a single straight shot). */
  spread: number;
  bars: { speed: number; health: number; power: number };
}

export const FLAVORS: FlavorDef[] = [
  {
    id: 'cherry',
    name: 'Cherry Pop',
    blurb: 'Brave and balanced. A good first pick.',
    color: 0xe83060,
    dark: 0x901838,
    stripe: 0xfcfcfc,
    speed: 210,
    hp: 5,
    fireDelay: 200,
    damage: 1,
    spread: 1,
    bars: { speed: 3, health: 3, power: 3 },
  },
  {
    id: 'lemon',
    name: 'Lemon Zing',
    blurb: 'Zippy and sour. Runs rings around the slime.',
    color: 0xf8d830,
    dark: 0xb08c10,
    stripe: 0xfcfcfc,
    speed: 265,
    hp: 4,
    fireDelay: 150,
    damage: 1,
    spread: 1,
    bars: { speed: 5, health: 2, power: 2 },
  },
  {
    id: 'grape',
    name: 'Grape Crush',
    blurb: 'Big, slow and tough. Every shot hits hard.',
    color: 0x9048d8,
    dark: 0x502080,
    stripe: 0xe0c8fc,
    speed: 175,
    hp: 7,
    fireDelay: 300,
    damage: 2,
    spread: 1,
    bars: { speed: 2, health: 5, power: 4 },
  },
  {
    id: 'razz',
    name: 'Blue Razz',
    blurb: 'Sprays three candies at once. Crowd control!',
    color: 0x30a0f0,
    dark: 0x1860a0,
    stripe: 0xfcfcfc,
    speed: 205,
    hp: 5,
    fireDelay: 360,
    damage: 1,
    spread: 3,
    bars: { speed: 3, health: 3, power: 4 },
  },
];

export const getFlavor = (id: FlavorId): FlavorDef => FLAVORS.find((f) => f.id === id) ?? FLAVORS[0];

export type GermKind = 'blob' | 'virus' | 'splitter' | 'mini' | 'spitter' | 'boss';

export interface GermDef {
  kind: GermKind;
  hp: number;
  speed: number;
  /** Collision radius. */
  radius: number;
  points: number;
  /** Damage dealt to a lollipop on contact. */
  bite: number;
}

export const GERMS: Record<GermKind, GermDef> = {
  // Slow and steady: oozes straight at the nearest lollipop.
  blob: { kind: 'blob', hp: 3, speed: 70, radius: 18, points: 10, bite: 1 },
  // Circles in, then lunges.
  virus: { kind: 'virus', hp: 2, speed: 110, radius: 14, points: 15, bite: 1 },
  // Bursts into two minis when popped.
  splitter: { kind: 'splitter', hp: 5, speed: 60, radius: 20, points: 20, bite: 1 },
  mini: { kind: 'mini', hp: 1, speed: 125, radius: 9, points: 5, bite: 1 },
  // Keeps its distance and spits slime.
  spitter: { kind: 'spitter', hp: 3, speed: 80, radius: 17, points: 25, bite: 1 },
  // Duke Grime: spits slime rings and calls in blobs.
  boss: { kind: 'boss', hp: 160, speed: 45, radius: 52, points: 500, bite: 2 },
};

export interface WaveDef {
  /** Germs to send, in order, a few at a time. */
  germs: Partial<Record<GermKind, number>>;
  /** Milliseconds between spawns. */
  gap: number;
  boss?: { hp: number };
}

export const WAVES: WaveDef[] = [
  { germs: { blob: 6 }, gap: 900 },
  { germs: { blob: 8, virus: 3 }, gap: 800 },
  { germs: { blob: 6, virus: 5, splitter: 2 }, gap: 700 },
  { germs: { blob: 6, virus: 4, spitter: 3, splitter: 2 }, gap: 650 },
  { germs: { blob: 4 }, gap: 1200, boss: { hp: 160 } },
  { germs: { blob: 10, virus: 6, splitter: 3 }, gap: 520 },
  { germs: { virus: 10, spitter: 5, splitter: 3 }, gap: 480 },
  { germs: { blob: 12, virus: 8, spitter: 5, splitter: 4 }, gap: 420 },
  { germs: { blob: 10, virus: 10, spitter: 8, splitter: 6 }, gap: 360 },
  { germs: { virus: 6, spitter: 4 }, gap: 900, boss: { hp: 280 } },
];

/** Buddies that join the legion, most you can have at once, and their stats. */
export const MAX_BUDDIES = 3;
export const BUDDY_HP = 3;
export const BUDDY_FIRE_DELAY = 650;

/** Sugar spin: radius, damage, and cooldown (ms). */
export const SPIN_RADIUS = 110;
export const SPIN_DAMAGE = 3;
export const SPIN_COOLDOWN = 5000;

/** Sprinkle power-up: triple rapid shots for this long (ms). */
export const SPRINKLE_TIME = 8000;

export const SHOT_SPEED = 520;
export const SLIME_SPEED = 210;
/** Invulnerable time after being hit (ms). */
export const HURT_GRACE = 1000;
