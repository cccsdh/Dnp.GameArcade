import {
  BOOST_SPEED,
  DRIFT_TIERS,
  KART_RADIUS,
  LAPS,
  SPIN_TIME,
  STAR_SPEED,
  type ItemId,
  type VehicleDef,
} from './config';
import { SURFACE, type TrackData } from './tracks';

export interface KartInput {
  /** -1 (brake / reverse) .. 1 (accelerate). */
  throttle: number;
  /** -1 (left) .. 1 (right). */
  steer: number;
  /** Held: hop into a drift (while steering). */
  drift: boolean;
  /** Pressed this frame: use the held item. */
  useItem: boolean;
}

export const NO_INPUT: KartInput = { throttle: 0, steer: 0, drift: false, useItem: false };

/** Things the kart reports back to the scene each update (for sounds/effects). */
export interface KartEvents {
  miniTurbo?: number;
  boostPad?: boolean;
  wall?: boolean;
  decorHit?: boolean;
  lap?: number;
  finished?: boolean;
  hop?: boolean;
}

export function angleDiff(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * One kart's state and arcade physics on the flat track plane. Heading is the
 * way the nose points; `moveAngle` is the way it's actually travelling - the
 * two separate while drifting or on ice, which is what makes it slide.
 */
export class Kart {
  readonly def: VehicleDef;
  readonly isPlayer: boolean;
  readonly label: string;
  x: number;
  y: number;
  heading: number;
  moveAngle: number;
  speed = 0;
  z = 0;
  vz = 0;

  drifting = false;
  driftDir = 0;
  driftCharge = 0;
  private driftHeld = false;
  boost = 0;
  star = 0;
  spin = 0;
  /** Visual steering lean, -1..1, for picking the sprite frame. */
  lean = 0;

  item: ItemId | null = null;
  /** Item roulette time remaining (the item is decided but not usable yet). */
  roulette = 0;

  /** Speed multiplier from AI rubber-banding (1 for the player). */
  rubber = 1;

  // Race progress.
  idx: number;
  lapsDone = 0;
  crossedStart = false;
  private maxIdxThisLap = 0;
  finished = false;
  finishTime = 0;
  place = 0;
  surface: number = SURFACE.ROAD;
  wrongWayTime = 0;
  private bumpCooldown = 0;

  constructor(def: VehicleDef, isPlayer: boolean, label: string, x: number, y: number, heading: number, track: TrackData) {
    this.def = def;
    this.isPlayer = isPlayer;
    this.label = label;
    this.x = x;
    this.y = y;
    this.heading = heading;
    this.moveAngle = heading;
    this.idx = track.nearest(x, y);
  }

  get driftTier(): number {
    let tier = -1;
    DRIFT_TIERS.forEach((t, i) => {
      if (this.driftCharge >= t.charge) tier = i;
    });
    return tier;
  }

  /** Continuous race progress in world units (for placings). */
  progress(track: TrackData): number {
    const n = track.pts.length;
    const along = !this.crossedStart && this.idx > n / 2 ? (this.idx - n) * track.step : this.idx * track.step;
    return this.lapsDone * track.length + along;
  }

  /** Current lap number for the HUD (1-based, capped at LAPS). */
  get lap(): number {
    return Math.min(LAPS, this.lapsDone + 1);
  }

  hit(time = SPIN_TIME): boolean {
    if (this.star > 0 || this.spin > 0) return false;
    this.spin = time;
    this.drifting = false;
    this.driftCharge = 0;
    this.boost = 0;
    this.vz = 60;
    return true;
  }

  update(dt: number, input: KartInput, track: TrackData, raceTime: number): KartEvents {
    const ev: KartEvents = {};
    const def = this.def;
    this.bumpCooldown = Math.max(0, this.bumpCooldown - dt);
    this.boost = Math.max(0, this.boost - dt);
    this.star = Math.max(0, this.star - dt);
    this.roulette = Math.max(0, this.roulette - dt);

    // Hop / bounce.
    this.vz -= 420 * dt;
    this.z = Math.max(0, this.z + this.vz * dt);
    if (this.z === 0) this.vz = 0;

    let throttle = input.throttle;
    let steer = input.steer;
    if (this.spin > 0) {
      this.spin -= dt;
      this.heading += 13 * dt;
      throttle = 0;
      steer = 0;
      this.speed *= Math.pow(0.25, dt);
    }
    if (this.finished && !this.isPlayer) throttle = Math.min(throttle, 0.6);

    // --- Surface --------------------------------------------------------------
    const surf = track.surfaceAt(this.x, this.y);
    this.surface = surf;
    let surfaceMax = 1;
    let grip = def.grip;
    if (surf === SURFACE.OFFROAD && this.boost <= 0 && this.star <= 0) surfaceMax = def.offroad;
    if (surf === SURFACE.BOOST) {
      if (this.boost < 0.6) ev.boostPad = true;
      this.boost = Math.max(this.boost, 1.0);
    }
    if (surf === SURFACE.ICE) grip *= 0.18;

    let maxSpeed = def.topSpeed * surfaceMax * this.rubber;
    if (this.boost > 0) maxSpeed *= BOOST_SPEED;
    if (this.star > 0) maxSpeed *= STAR_SPEED;

    // --- Drift ------------------------------------------------------------------
    if (input.drift && !this.driftHeld && this.z === 0 && this.spin <= 0) {
      this.vz = 70;
      ev.hop = true;
      if (Math.abs(steer) > 0.3 && this.speed > 110) {
        this.drifting = true;
        this.driftDir = Math.sign(steer);
        this.driftCharge = 0;
      }
    }
    // Landing from a hop while steering also starts a drift.
    if (input.drift && !this.drifting && this.z > 0 && Math.abs(steer) > 0.3 && this.speed > 110 && this.spin <= 0) {
      this.drifting = true;
      this.driftDir = Math.sign(steer);
      this.driftCharge = 0;
    }
    this.driftHeld = input.drift;
    if (this.drifting) {
      const ending = !input.drift || this.speed < 80 || this.spin > 0 || surf === SURFACE.OUT;
      if (ending) {
        const tier = this.driftTier;
        if (tier >= 0 && this.spin <= 0) {
          this.boost = Math.max(this.boost, DRIFT_TIERS[tier].boost);
          ev.miniTurbo = tier;
        }
        this.drifting = false;
        this.driftCharge = 0;
      } else {
        // Steering into the drift tightens it (and charges faster); steering out widens it.
        const into = steer * this.driftDir;
        this.driftCharge += dt * (surf === SURFACE.OFFROAD ? 0.5 : 1) * (0.75 + 0.5 * Math.max(0, into));
        steer = this.driftDir * (0.62 + 0.38 * into);
        grip *= 0.32;
      }
    }

    // --- Speed ------------------------------------------------------------------
    if (throttle > 0) {
      if (this.speed < maxSpeed) this.speed += def.accel * throttle * dt * (1.15 - (0.75 * Math.max(0, this.speed)) / maxSpeed);
      else this.speed = Math.max(maxSpeed, this.speed - 260 * dt);
    } else if (throttle < 0) {
      if (this.speed > 0) this.speed = Math.max(0, this.speed + throttle * 420 * dt);
      else this.speed = Math.max(-90, this.speed + throttle * 140 * dt);
    } else {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 70 * dt);
      if (this.speed > maxSpeed) this.speed = Math.max(maxSpeed, this.speed - 260 * dt);
    }
    if (this.boost > 0 && this.spin <= 0) this.speed = Math.max(this.speed, maxSpeed * 0.92);

    // --- Steering -------------------------------------------------------------
    const speedFactor = Math.min(1, Math.abs(this.speed) / 90);
    const dir = this.speed >= 0 ? 1 : -1;
    const turnRate = def.turn * (this.drifting ? 1.25 : 1) * (this.boost > 0 ? 0.9 : 1);
    this.heading += steer * turnRate * speedFactor * dir * dt;
    this.lean += (steer - this.lean) * Math.min(1, dt * 8);

    // Travel direction catches up with the heading at a rate set by grip.
    const slip = angleDiff(this.moveAngle, this.heading);
    this.moveAngle += slip * Math.min(1, grip * dt);
    if (this.drifting) this.speed -= Math.abs(slip) * 30 * dt;

    // --- Move + collide -------------------------------------------------------
    const nx = this.x + Math.cos(this.moveAngle) * this.speed * dt;
    const ny = this.y + Math.sin(this.moveAngle) * this.speed * dt;
    if (track.surfaceAt(nx, ny) === SURFACE.OUT) {
      // Barrier: bounce back toward the road and lose most of the speed.
      if (Math.abs(this.speed) > 60 && this.bumpCooldown <= 0) {
        ev.wall = true;
        this.bumpCooldown = 0.3;
      }
      const p = track.pts[this.idx];
      const toRoadX = p.x - this.x;
      const toRoadY = p.y - this.y;
      const len = Math.hypot(toRoadX, toRoadY) || 1;
      this.x += (toRoadX / len) * 3;
      this.y += (toRoadY / len) * 3;
      this.speed *= -0.25;
      this.drifting = false;
      this.driftCharge = 0;
    } else {
      this.x = nx;
      this.y = ny;
    }

    for (const d of track.decor) {
      if (!d.solid) continue;
      const dx = this.x - d.x;
      const dy = this.y - d.y;
      const dist = Math.hypot(dx, dy);
      const min = KART_RADIUS + 7;
      if (dist < min && dist > 0.001) {
        this.x = d.x + (dx / dist) * min;
        this.y = d.y + (dy / dist) * min;
        if (Math.abs(this.speed) > 60 && this.bumpCooldown <= 0) {
          ev.decorHit = true;
          this.bumpCooldown = 0.3;
        }
        this.speed *= 0.5;
      }
    }

    // --- Progress / laps ------------------------------------------------------
    const n = track.pts.length;
    const prev = this.idx;
    this.idx = track.nearest(this.x, this.y, this.idx, 30);
    if (prev > n * 0.85 && this.idx < n * 0.15) {
      // Crossed the line going forward.
      if (!this.crossedStart) {
        this.crossedStart = true;
        this.maxIdxThisLap = 0;
      } else if (this.maxIdxThisLap > n * 0.6 && !this.finished) {
        this.lapsDone++;
        this.maxIdxThisLap = 0;
        if (this.lapsDone >= LAPS && !this.finished) {
          this.finished = true;
          this.finishTime = raceTime;
          ev.finished = true;
        } else if (!this.finished) {
          ev.lap = this.lapsDone + 1;
        }
      }
    } else if (this.crossedStart && this.idx > this.maxIdxThisLap && this.idx - this.maxIdxThisLap < 40) {
      // Only continuous forward progress counts toward the lap, so backing over
      // the line and driving across it again can't farm laps.
      this.maxIdxThisLap = this.idx;
    }

    // Wrong way: travelling against the track direction for a while.
    const along = Math.cos(angleDiff(track.pts[this.idx].a, this.moveAngle));
    if (along < -0.3 && this.speed > 40) this.wrongWayTime += dt;
    else this.wrongWayTime = 0;

    return ev;
  }
}

/** Pushes overlapping karts apart; heavier karts shove lighter ones. Star karts spin others out. */
export function collideKarts(karts: Kart[]): { a: Kart; b: Kart; starHit?: Kart }[] {
  const hits: { a: Kart; b: Kart; starHit?: Kart }[] = [];
  for (let i = 0; i < karts.length; i++) {
    for (let j = i + 1; j < karts.length; j++) {
      const a = karts[i];
      const b = karts[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const min = KART_RADIUS * 2;
      if (dist >= min || dist < 0.001) continue;
      const push = (min - dist) / 2;
      const ux = dx / dist;
      const uy = dy / dist;
      const wa = a.def.weight;
      const wb = b.def.weight;
      a.x -= ux * push * (2 * wb) / (wa + wb);
      a.y -= uy * push * (2 * wb) / (wa + wb);
      b.x += ux * push * (2 * wa) / (wa + wb);
      b.y += uy * push * (2 * wa) / (wa + wb);
      let starHit: Kart | undefined;
      if (a.star > 0 && b.star <= 0 && b.hit()) starHit = b;
      else if (b.star > 0 && a.star <= 0 && a.hit()) starHit = a;
      else {
        a.speed *= 0.92;
        b.speed *= 0.92;
      }
      hits.push({ a, b, starHit });
    }
  }
  return hits;
}
