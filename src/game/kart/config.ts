/**
 * Turbo Kart tuning: the four vehicles (each with its own animal driver),
 * physics constants and item odds. World units: the track texture is
 * TRACK_SIZE x TRACK_SIZE units, a kart is ~20 units long.
 */

export const TRACK_SIZE = 2048;
export const LAPS = 3;

export type DriverId = 'fox' | 'frog' | 'bunny' | 'bear';
export type VehicleId = 'kart' | 'buggy' | 'rocket' | 'truck';

export interface VehicleDef {
  id: VehicleId;
  name: string;
  driverName: string;
  driver: DriverId;
  blurb: string;
  /** 1-5 bars for the select screen. */
  bars: { speed: number; accel: number; handling: number; weight: number };
  topSpeed: number;
  accel: number;
  /** Radians per second at full steer. */
  turn: number;
  /** How fast the travel direction snaps back to the heading (higher = grippier). */
  grip: number;
  weight: number;
  /** Top-speed multiplier on grass / sand / snow. */
  offroad: number;
  /** Paint colours used by the voxel model. */
  body: string;
  trim: string;
}

export const VEHICLES: VehicleDef[] = [
  {
    id: 'kart',
    name: 'Classic Kart',
    driverName: 'Zippy the Fox',
    driver: 'fox',
    blurb: 'All-rounder. Easy to handle.',
    bars: { speed: 3, accel: 3, handling: 4, weight: 2 },
    topSpeed: 300,
    accel: 200,
    turn: 2.55,
    grip: 7,
    weight: 1,
    offroad: 0.5,
    body: '#e83838',
    trim: '#fcfcfc',
  },
  {
    id: 'buggy',
    name: 'Dune Buggy',
    driverName: 'Hopper the Frog',
    driver: 'frog',
    blurb: 'Quick off the line, shrugs off rough ground.',
    bars: { speed: 2, accel: 5, handling: 3, weight: 2 },
    topSpeed: 285,
    accel: 250,
    turn: 2.5,
    grip: 6.5,
    weight: 1,
    offroad: 0.68,
    body: '#f8b800',
    trim: '#3c3c3c',
  },
  {
    id: 'rocket',
    name: 'Rocket Racer',
    driverName: 'Dash the Bunny',
    driver: 'bunny',
    blurb: 'Blistering top speed, slow to get going.',
    bars: { speed: 5, accel: 2, handling: 2, weight: 1 },
    topSpeed: 330,
    accel: 160,
    turn: 2.3,
    grip: 6,
    weight: 0.85,
    offroad: 0.45,
    body: '#3cbcfc',
    trim: '#f878f8',
  },
  {
    id: 'truck',
    name: 'Mini Monster',
    driverName: 'Bruno the Bear',
    driver: 'bear',
    blurb: 'Heavy - shoves everyone else around.',
    bars: { speed: 4, accel: 2, handling: 2, weight: 5 },
    topSpeed: 310,
    accel: 170,
    turn: 2.2,
    grip: 7.5,
    weight: 1.7,
    offroad: 0.6,
    body: '#38a838',
    trim: '#f8f8a0',
  },
];

export const KART_RADIUS = 9;

/** Drift charge (seconds of drifting) needed for each mini-turbo tier, and its boost length. */
export const DRIFT_TIERS = [
  { charge: 0.8, boost: 0.5, color: 0x58b8ff },
  { charge: 1.7, boost: 0.95, color: 0xffa020 },
  { charge: 2.8, boost: 1.4, color: 0xff58f0 },
];

export const BOOST_SPEED = 1.35;
export const STAR_SPEED = 1.15;
export const STAR_TIME = 6;
export const SPIN_TIME = 1.1;

export type ItemId = 'turbo' | 'banana' | 'bouncer' | 'homer' | 'star';

export const ITEM_NAMES: Record<ItemId, string> = {
  turbo: 'Turbo',
  banana: 'Banana',
  bouncer: 'Bouncing Orb',
  homer: 'Homing Orb',
  star: 'Super Star',
};

/** Item odds by race position (index 0 = leader). */
export const ITEM_ODDS: Record<ItemId, number>[] = [
  { banana: 45, bouncer: 35, turbo: 20, homer: 0, star: 0 },
  { banana: 15, bouncer: 25, turbo: 30, homer: 30, star: 0 },
  { banana: 5, bouncer: 10, turbo: 35, homer: 30, star: 20 },
];

export function rollItem(position: number, rng: () => number = Math.random): ItemId {
  const odds = ITEM_ODDS[Math.min(position, ITEM_ODDS.length - 1)];
  const total = Object.values(odds).reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (const [id, w] of Object.entries(odds) as [ItemId, number][]) {
    r -= w;
    if (r < 0) return id;
  }
  return 'turbo';
}
