import { angleDiff, type Kart, type KartInput } from './kart';
import type { TrackData } from './tracks';

export interface Hazard {
  x: number;
  y: number;
}

export interface RaceView {
  track: TrackData;
  karts: Kart[];
  hazards: Hazard[];
  time: number;
}

export interface Brain {
  readonly label: string;
  think(k: Kart, race: RaceView, dt: number): KartInput;
}

/**
 * Shared "I'm stuck against a wall" recovery: when a kart has barely moved
 * for a second, steer straight at the centreline a little way ahead with the
 * gas floored until it's rolling again.
 */
class StuckWatch {
  private slow = 0;
  private recover = 0;

  check(k: Kart, track: TrackData, dt: number): KartInput | null {
    if (this.recover > 0) {
      this.recover -= dt;
      const p = track.pts[(k.idx + 3) % track.pts.length];
      const diff = angleDiff(k.heading, Math.atan2(p.y - k.y, p.x - k.x));
      // Facing away: back up while turning; otherwise drive at it.
      if (Math.abs(diff) > 1.8) return { throttle: -1, steer: -Math.sign(diff), drift: false, useItem: false };
      return { throttle: 1, steer: Math.max(-1, Math.min(1, diff * 3)), drift: false, useItem: false };
    }
    if (Math.abs(k.speed) < 35 && k.spin <= 0) this.slow += dt;
    else this.slow = 0;
    if (this.slow > 0.9) {
      this.slow = 0;
      this.recover = 1.2;
    }
    return null;
  }
}

/** How much the track turns over the next `ahead` samples (radians, absolute). */
function turnAhead(track: TrackData, idx: number, ahead: number): number {
  const n = track.pts.length;
  return Math.abs(angleDiff(track.pts[idx % n].a, track.pts[(idx + ahead) % n].a));
}

function signedTurnAhead(track: TrackData, idx: number, ahead: number): number {
  const n = track.pts.length;
  return angleDiff(track.pts[idx % n].a, track.pts[(idx + ahead) % n].a);
}

/**
 * A competent racer: follows the racing line with a speed-scaled lookahead,
 * lifts for hairpins, drifts through long bends for mini-turbos, steers around
 * bananas, and uses items with some thought.
 */
export class SmartBrain implements Brain {
  readonly label = 'smart';
  private holdItem = 0;
  private stuck = new StuckWatch();

  think(k: Kart, race: RaceView, dt: number): KartInput {
    const { track } = race;
    const unstick = this.stuck.check(k, track, dt);
    if (unstick) return unstick;
    const n = track.pts.length;
    const look = 7 + Math.floor(Math.max(0, k.speed) / 38);
    const t = track.line[(k.idx + look) % n];
    let tx = t.x;
    let ty = t.y;

    // Dodge hazards sitting near the path ahead.
    for (const h of race.hazards) {
      const dx = h.x - k.x;
      const dy = h.y - k.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 140 || dist < 5) continue;
      const rel = angleDiff(k.heading, Math.atan2(dy, dx));
      if (Math.abs(rel) < 0.5) {
        const side = rel > 0 ? -1 : 1;
        tx += -Math.sin(k.heading) * 34 * side;
        ty += Math.cos(k.heading) * 34 * side;
      }
    }

    const want = Math.atan2(ty - k.y, tx - k.x);
    const diff = angleDiff(k.heading, want);
    let steer = Math.max(-1, Math.min(1, diff * 3));

    const sharp = turnAhead(track, k.idx, 22);
    let throttle = 1;
    if (sharp > 1.25 && k.speed > k.def.topSpeed * 0.78) throttle = 0.25;
    if (Math.abs(diff) > 1.2) throttle = 0.4;

    // Drift the long bends: start when a real bend is coming, hold while it lasts.
    const bend = signedTurnAhead(track, k.idx, 16);
    let drift = false;
    if (Math.abs(bend) > 0.55 && k.speed > 150 && Math.sign(bend) === Math.sign(steer || bend)) drift = true;
    if (k.drifting && Math.abs(signedTurnAhead(track, k.idx, 8)) > 0.22) drift = true;
    if (drift && !k.drifting && Math.abs(steer) < 0.35) steer = Math.sign(bend) * 0.6;

    let useItem = false;
    if (k.item && k.roulette <= 0) {
      this.holdItem += dt;
      const ahead = race.karts.filter((o) => o !== k && o.progress(track) > k.progress(track));
      const behind = race.karts.filter((o) => o !== k && o.progress(track) < k.progress(track) && k.progress(track) - o.progress(track) < 220);
      switch (k.item) {
        case 'turbo':
          useItem = sharp < 0.3 || k.surface === 1;
          break;
        case 'star':
          useItem = true;
          break;
        case 'banana':
          useItem = behind.length > 0 || this.holdItem > 8;
          break;
        case 'bouncer':
          useItem = ahead.some((o) => {
            const d = Math.hypot(o.x - k.x, o.y - k.y);
            return d < 420 && Math.abs(angleDiff(k.heading, Math.atan2(o.y - k.y, o.x - k.x))) < 0.14;
          }) || this.holdItem > 10;
          break;
        case 'homer':
          useItem = ahead.length > 0 || this.holdItem > 6;
          break;
      }
      if (useItem) this.holdItem = 0;
    }

    return { throttle, steer, drift, useItem };
  }
}

/**
 * A clumsy racer: weaves about instead of holding a line, reacts slowly,
 * brakes only for the worst hairpins, never drifts, gets distracted now and
 * then, and fires items off at random.
 */
export class DumbBrain implements Brain {
  readonly label = 'dumb';
  private steer = 0;
  private distracted = 0;
  private nextDistraction = 6 + Math.random() * 6;
  private distractSteer = 0;
  private itemDelay = -1;
  private seed = Math.random() * 10;
  private stuck = new StuckWatch();

  think(k: Kart, race: RaceView, dt: number): KartInput {
    const { track } = race;
    const unstick = this.stuck.check(k, track, dt);
    if (unstick) return unstick;
    const n = track.pts.length;
    const look = 6 + Math.floor(Math.max(0, k.speed) / 45);
    const c = track.pts[(k.idx + look) % n];
    const l = track.line[(k.idx + look) % n];
    // Halfway between the centreline and the racing line, plus a lazy weave.
    const wobble = Math.sin(race.time * 0.8 + this.seed) * track.def.roadWidth * 0.16;
    const tx = (c.x + l.x) / 2 - Math.sin(c.a) * wobble;
    const ty = (c.y + l.y) / 2 + Math.cos(c.a) * wobble;
    const diff = angleDiff(k.heading, Math.atan2(ty - k.y, tx - k.x));
    let target = Math.max(-1, Math.min(1, diff * 2.4 + (Math.random() - 0.5) * 0.3));

    this.nextDistraction -= dt;
    if (this.nextDistraction <= 0) {
      this.distracted = 0.4 + Math.random() * 0.3;
      this.distractSteer = Math.random() < 0.5 ? -1 : 1;
      this.nextDistraction = 9 + Math.random() * 8;
    }
    if (this.distracted > 0) {
      this.distracted -= dt;
      target = this.distractSteer * 0.6;
    }
    // Slowish reactions: steering eases toward what it wants.
    this.steer += (target - this.steer) * Math.min(1, dt * 6);

    // Brakes late and only for the worst hairpins; never drifts.
    const throttle = turnAhead(track, k.idx, 18) > 1.5 && k.speed > k.def.topSpeed * 0.7 ? 0.35 : 0.95;

    let useItem = false;
    if (k.item && k.roulette <= 0) {
      if (this.itemDelay < 0) this.itemDelay = 0.5 + Math.random() * 2.5;
      this.itemDelay -= dt;
      if (this.itemDelay <= 0) {
        useItem = true;
        this.itemDelay = -1;
      }
    }

    return { throttle, steer: this.steer, drift: false, useItem };
  }
}
