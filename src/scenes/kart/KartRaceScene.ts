import Phaser from 'phaser';
import { DumbBrain, SmartBrain, type Brain, type RaceView } from '../../game/kart/ai';
import { DRIFT_TIERS, ITEM_NAMES, LAPS, STAR_TIME, TRACK_SIZE, VEHICLES, rollItem, type ItemId, type VehicleDef } from '../../game/kart/config';
import { angleDiff, collideKarts, Kart, NO_INPUT, type KartEvents, type KartInput } from '../../game/kart/kart';
import { createMode7Shader } from '../../game/kart/mode7';
import {
  ITEMBOX_FRAMES,
  KART_FRAMES,
  KART_ORIGIN_Y,
  KART_WORLD_PER_PX,
  PROP_ORIGIN_Y,
  PROP_WORLD_PER_PX,
} from '../../game/kart/sprites';
import { SURFACE, TRACKS, getTrack, themeFog, themeOut, type DecorKind, type TrackData } from '../../game/kart/tracks';
import { createEngineVoice, createNoiseVoice, setChipSongRate, type EngineVoice, type NoiseVoice } from '../../game/shared/Chiptune';
import { setPadProfile } from '../../game/shared/Pad';
import { KART_PAD } from '../../game/shared/PadProfiles';
import { SoundManager, loadMuted, saveMuted } from '../../game/shared/Sound';

export interface KartRaceInitData {
  vehicleId: string;
  trackId: string;
}

const DECOR_SCALE: Record<DecorKind, number> = {
  tree: 2.6,
  pine: 2.6,
  bush: 1.6,
  flowers: 1.3,
  tires: 1.5,
  cactus: 2.2,
  rock: 2.4,
  barrel: 1.4,
  snowman: 1.8,
  crystal: 1.8,
};

const DUST: Record<string, number> = { meadow: 0x6cc048, canyon: 0xe8c890, frost: 0xffffff };

interface WorldItem {
  kind: 'banana' | 'bouncer' | 'homer';
  x: number;
  y: number;
  angle: number;
  speed: number;
  life: number;
  owner: Kart;
  immune: number;
  target: Kart | null;
  idx: number;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
  grow: number;
  gravity: number;
  img: Phaser.GameObjects.Image;
}

interface Racer {
  kart: Kart;
  brain: Brain | null;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  flame: Phaser.GameObjects.Image;
}

type Phase = 'countdown' | 'racing' | 'finished';

const ORDINAL = ['1st', '2nd', '3rd', '4th'];
const PLACE_COLORS = ['#f8d800', '#d8e0f0', '#e89858', '#bcbcbc'];

function fmtTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

export class KartRaceScene extends Phaser.Scene {
  private vehicle!: VehicleDef;
  private track!: TrackData;
  private sfx!: SoundManager;

  private racers: Racer[] = [];
  private player!: Kart;
  private items: WorldItem[] = [];
  private boxes: { x: number; y: number; respawn: number; sprite: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image }[] = [];
  private decorSprites: Phaser.GameObjects.Image[] = [];
  private particles: Particle[] = [];
  private particlePool: Phaser.GameObjects.Image[] = [];

  private shader!: Phaser.GameObjects.Shader;
  private sky!: Phaser.GameObjects.TileSprite;
  private camX = 0;
  private camY = 0;
  private camAngle = 0;
  private horizon = 200;
  private focal = 600;
  private camHeight = 30;
  private camDist = 62;

  private phase: Phase = 'countdown';
  private countdown = 4;
  private raceTime = 0;
  private lastBeep = 4;
  private accelPressedAt = -1;
  private finishTimer = 0;
  private resultsShown = false;

  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private hud!: {
    lap: Phaser.GameObjects.Text;
    time: Phaser.GameObjects.Text;
    place: Phaser.GameObjects.Text;
    placeOf: Phaser.GameObjects.Text;
    speed: Phaser.GameObjects.Text;
    speedBar: Phaser.GameObjects.Graphics;
    itemFrame: Phaser.GameObjects.Graphics;
    itemIcon: Phaser.GameObjects.Image;
    itemName: Phaser.GameObjects.Text;
    banner: Phaser.GameObjects.Text;
    sub: Phaser.GameObjects.Text;
    lights: Phaser.GameObjects.Graphics;
    miniDots: Phaser.GameObjects.Graphics;
    fx: Phaser.GameObjects.Graphics;
  };
  private miniMap = { x: 0, y: 0, size: 150 };
  private bannerTimer = 0;
  private rouletteTick = 0;

  private engine: EngineVoice | null = null;
  private screech: NoiseVoice | null = null;
  private rumble: NoiseVoice | null = null;

  constructor() {
    super('KartRace');
  }

  init(data: KartRaceInitData): void {
    this.vehicle = VEHICLES.find((v) => v.id === data.vehicleId) ?? VEHICLES[0];
    const def = TRACKS.find((t) => t.id === data.trackId) ?? TRACKS[0];
    this.track = getTrack(def);
    this.racers = [];
    this.items = [];
    this.boxes = [];
    this.decorSprites = [];
    this.particles = [];
    this.particlePool = [];
    this.phase = 'countdown';
    this.countdown = 4;
    this.raceTime = 0;
    this.lastBeep = 4;
    this.accelPressedAt = -1;
    this.finishTimer = 0;
    this.resultsShown = false;
  }

  create(): void {
    const { width: W, height: H } = this.scale;
    this.sfx = new SoundManager(this);
    this.sfx.stopMusic();
    this.sound.mute = loadMuted();

    this.horizon = Math.round(H * 0.34);
    this.focal = H * 0.95;
    this.camHeight = 30;
    const t = this.track;
    const trackKey = `ktrack_${t.def.id}`;
    const skyKey = `ksky_${t.def.id}`;
    if (!this.textures.exists(trackKey)) this.textures.addCanvas(trackKey, t.texture);
    if (!this.textures.exists(skyKey)) this.textures.addCanvas(skyKey, t.sky);

    this.cameras.main.setBackgroundColor(themeFog(t));
    const skyScale = (this.horizon + 4) / 256;
    // Stretch the 360-degree panorama so the visible slice matches the camera's field of view.
    const fov = 2 * Math.atan(W / 2 / this.focal);
    this.sky = this.add
      .tileSprite(0, 0, W, this.horizon + 4, skyKey)
      .setOrigin(0)
      .setDepth(-10)
      .setTileScale(W / (t.sky.width * (fov / (Math.PI * 2))), skyScale);

    if (this.renderer.type !== Phaser.WEBGL) {
      this.add.text(W / 2, H / 2, 'Turbo Kart needs WebGL.', { fontFamily: 'monospace', fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);
      return;
    }
    this.shader = this.add.shader(createMode7Shader(themeFog(t), themeOut(t)), 0, 0, W, H).setOrigin(0).setDepth(-5);
    this.shader.setChannel0(trackKey);
    this.shader.setUniform('uTrackSize.value', TRACK_SIZE);
    this.shader.setUniform('uPix.value', Math.max(2, Math.round(H / 280)));

    // Scenery.
    for (const d of t.decor) {
      const img = this.add.image(0, 0, `deco_${d.kind}`).setOrigin(0.5, PROP_ORIGIN_Y).setVisible(false);
      this.decorSprites.push(img);
    }
    for (const b of t.boxes) {
      this.boxes.push({
        ...b,
        respawn: 0,
        sprite: this.add.image(0, 0, 'itembox', 0).setOrigin(0.5, 0.75).setVisible(false),
        shadow: this.add.image(0, 0, 'kp_shadow').setVisible(false),
      });
    }

    // Racers: smart AI on pole, clumsy AI second, the player starts third.
    const others = Phaser.Utils.Array.Shuffle(VEHICLES.filter((v) => v.id !== this.vehicle.id));
    const lineup: { def: VehicleDef; brain: Brain | null; label: string }[] = [
      { def: others[0], brain: new SmartBrain(), label: others[0].driverName.split(' ')[0] },
      { def: others[1], brain: new DumbBrain(), label: others[1].driverName.split(' ')[0] },
      { def: this.vehicle, brain: null, label: 'YOU' },
    ];
    lineup.forEach((l, i) => {
      const g = t.grid[i];
      const kart = new Kart(l.def, l.brain === null, l.label, g.x, g.y, g.a, t);
      this.racers.push({
        kart,
        brain: l.brain,
        sprite: this.add.image(0, 0, `kart_${l.def.id}`, 0).setOrigin(0.5, KART_ORIGIN_Y),
        shadow: this.add.image(0, 0, 'kp_shadow'),
        flame: this.add.image(0, 0, 'kp_flame').setOrigin(0.5, 0).setVisible(false).setBlendMode(Phaser.BlendModes.ADD),
      });
      if (!l.brain) this.player = kart;
    });
    this.camAngle = this.player.heading;

    for (let i = 0; i < 260; i++) this.particlePool.push(this.add.image(0, 0, 'kp_px').setVisible(false));

    this.buildHud(W, H);

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: kb.addKey(K.UP),
      down: kb.addKey(K.DOWN),
      left: kb.addKey(K.LEFT),
      right: kb.addKey(K.RIGHT),
      w: kb.addKey(K.W),
      s: kb.addKey(K.S),
      a: kb.addKey(K.A),
      d: kb.addKey(K.D),
      drift: kb.addKey(K.SPACE),
      shift: kb.addKey(K.SHIFT),
      item: kb.addKey(K.X),
      item2: kb.addKey(K.E),
      item3: kb.addKey(K.CTRL),
      esc: kb.addKey(K.ESC),
      mute: kb.addKey(K.M),
      restart: kb.addKey(K.R),
      enter: kb.addKey(K.ENTER),
    };
    setPadProfile(this, KART_PAD);

    this.engine = createEngineVoice(this.sound);
    this.screech = createNoiseVoice(this.sound, 'bandpass', 2600, 6);
    this.rumble = createNoiseVoice(this.sound, 'lowpass', 260, 1);
    this.events.once('shutdown', () => {
      this.engine?.stop();
      this.screech?.stop();
      this.rumble?.stop();
      this.engine = this.screech = this.rumble = null;
      setChipSongRate(1);
    });

    this.updateCamera(0);
    this.renderWorld();
  }

  // --- HUD ------------------------------------------------------------------

  private buildHud(W: number, H: number): void {
    const txt = (x: number, y: number, size: number, color = '#ffffff') =>
      this.add
        .text(x, y, '', { fontFamily: 'monospace', fontSize: `${size}px`, color, fontStyle: 'bold', stroke: '#000000', strokeThickness: Math.max(3, size / 6) })
        .setDepth(30000);
    const u = Math.max(1, H / 720);
    this.hud = {
      lap: txt(18, 14, Math.round(26 * u)),
      time: txt(18, 14 + 34 * u, Math.round(18 * u), '#f8f8a0'),
      place: txt(W - 20, 10, Math.round(56 * u), '#f8d800').setOrigin(1, 0),
      placeOf: txt(W - 20, 10 + 60 * u, Math.round(16 * u)).setOrigin(1, 0),
      speed: txt(18, H - 44 * u, Math.round(22 * u)),
      speedBar: this.add.graphics().setDepth(30000),
      itemFrame: this.add.graphics().setDepth(30000),
      itemIcon: this.add.image(W / 2, 52 * u, 'icon_turbo').setDepth(30001).setScale(0.8 * u).setVisible(false),
      itemName: txt(W / 2, 98 * u, Math.round(13 * u)).setOrigin(0.5, 0),
      banner: txt(W / 2, H * 0.3, Math.round(64 * u), '#f8d800').setOrigin(0.5),
      sub: txt(W / 2, H * 0.3 + 56 * u, Math.round(18 * u)).setOrigin(0.5),
      lights: this.add.graphics().setDepth(30000),
      miniDots: this.add.graphics().setDepth(30001),
      fx: this.add.graphics().setDepth(29000),
    };
    this.hud.itemFrame.fillStyle(0x101018, 0.85).fillRoundedRect(W / 2 - 44 * u, 12 * u, 88 * u, 80 * u, 10);
    this.hud.itemFrame.lineStyle(3, 0xffffff, 0.9).strokeRoundedRect(W / 2 - 44 * u, 12 * u, 88 * u, 80 * u, 10);

    // Minimap: the track outline, drawn once.
    const size = Math.round(150 * u);
    this.miniMap = { x: W - size - 16, y: H - size - 16, size };
    const g = this.add.graphics().setDepth(30000);
    g.fillStyle(0x000000, 0.35).fillRoundedRect(this.miniMap.x - 6, this.miniMap.y - 6, size + 12, size + 12, 8);
    g.lineStyle(Math.max(3, 5 * u), 0xffffff, 0.85);
    g.beginPath();
    this.track.pts.forEach((p, i) => {
      const x = this.miniMap.x + (p.x / TRACK_SIZE) * size;
      const y = this.miniMap.y + (p.y / TRACK_SIZE) * size;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
    g.closePath();
    g.strokePath();
    const s0 = this.track.pts[0];
    g.fillStyle(0xe83030, 1).fillRect(this.miniMap.x + (s0.x / TRACK_SIZE) * size - 4, this.miniMap.y + (s0.y / TRACK_SIZE) * size - 4, 8, 8);

    this.add
      .text(W / 2, H - 10, 'Arrows/WASD drive   Space drift   X use item   M sound   Esc quit      Pad: A gas  B drift  Up/Select item', {
        fontFamily: 'monospace',
        fontSize: `${Math.round(11 * u)}px`,
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(30000)
      .setAlpha(0.75);
  }

  private showBanner(text: string, sub = '', time = 1.6, color = '#f8d800'): void {
    this.hud.banner.setText(text).setColor(color).setScale(1.4).setAlpha(1);
    this.tweens.add({ targets: this.hud.banner, scale: 1, duration: 220, ease: 'Back.Out' });
    this.hud.sub.setText(sub).setAlpha(1);
    this.bannerTimer = time;
  }

  // --- Main loop --------------------------------------------------------------

  update(_: number, deltaMs: number): void {
    if (!this.shader) return;
    const dt = Math.min(0.05, deltaMs / 1000);
    const J = Phaser.Input.Keyboard.JustDown;
    if (J(this.keys.esc)) {
      this.scene.start('KartMenu');
      return;
    }
    if (J(this.keys.mute)) {
      this.sound.mute = !this.sound.mute;
      saveMuted(this.sound.mute);
    }

    const input = this.playerInput();
    if (this.phase === 'countdown') this.updateCountdown(dt, input);
    else this.raceTime += dt;

    const view: RaceView = {
      track: this.track,
      karts: this.racers.map((r) => r.kart),
      hazards: this.items.filter((i) => i.kind !== 'homer'),
      time: this.raceTime,
    };

    for (const r of this.racers) {
      const k = r.kart;
      let inp: KartInput = NO_INPUT;
      if (this.phase !== 'countdown') {
        if (r.brain) inp = r.brain.think(k, view, dt);
        else inp = this.phase === 'finished' ? { throttle: 0.5, steer: this.autoSteer(k), drift: false, useItem: false } : input;
      }
      if (r.brain) this.rubberBand(k);
      const ev = k.update(dt, inp, this.track, this.raceTime);
      this.handleKartEvents(k, ev);
      if (inp.useItem) this.useItem(k);
      this.emitKartParticles(k, dt);
    }
    for (const hit of collideKarts(this.racers.map((r) => r.kart))) {
      if (hit.a.isPlayer || hit.b.isPlayer) {
        this.sfx.play(hit.starHit ? 'kartSpinOut' : 'kartBump');
        if (hit.starHit?.isPlayer) this.cameras.main.shake(180, 0.008);
      }
      if (hit.starHit) this.burstHitStars(hit.starHit);
    }

    this.updateItems(dt);
    this.updateBoxes(dt);
    this.updatePlacings();
    this.updateCamera(dt);
    this.updateParticles(dt);
    this.renderWorld();
    this.updateHud(dt);
    this.updateAudio(input);

    if (this.phase === 'finished') {
      this.finishTimer += dt;
      if (!this.resultsShown && this.finishTimer > 2.2) this.showResults();
      if (this.resultsShown) {
        if (J(this.keys.restart) || J(this.keys.enter)) this.scene.restart({ vehicleId: this.vehicle.id, trackId: this.track.def.id });
      }
    }
  }

  private playerInput(): KartInput {
    const k = this.keys;
    const J = Phaser.Input.Keyboard.JustDown;
    const up = k.up.isDown || k.w.isDown;
    const down = k.down.isDown || k.s.isDown;
    const left = k.left.isDown || k.a.isDown;
    const right = k.right.isDown || k.d.isDown;
    return {
      throttle: up ? 1 : down ? -1 : 0,
      steer: (right ? 1 : 0) - (left ? 1 : 0),
      drift: k.drift.isDown || k.shift.isDown,
      useItem: J(k.item) || J(k.item2) || J(k.item3),
    };
  }

  /** After the finish line the player's kart drives itself around. */
  private autoSteer(k: Kart): number {
    const p = this.track.line[(k.idx + 10) % this.track.line.length];
    return Math.max(-1, Math.min(1, angleDiff(k.heading, Math.atan2(p.y - k.y, p.x - k.x)) * 2.5));
  }

  private updateCountdown(dt: number, input: KartInput): void {
    const before = this.countdown;
    this.countdown -= dt;
    if (input.throttle > 0 && this.accelPressedAt < 0) this.accelPressedAt = this.countdown;
    if (input.throttle <= 0) this.accelPressedAt = -1;
    const beepAt = Math.ceil(this.countdown);
    if (before > 3 && this.countdown <= 3) this.sfx.playMusic(this.track.def.music);
    if (beepAt < this.lastBeep && beepAt >= 1 && beepAt <= 3) {
      this.sfx.play('kartCountBeep');
      this.showBanner(`${beepAt}`, '', 0.9, '#ffffff');
    }
    this.lastBeep = beepAt;
    if (this.countdown <= 0) {
      this.phase = 'racing';
      this.sfx.play('kartCountGo');
      this.showBanner('GO!', '', 1, '#48e848');
      // Rocket start: hit the gas just before GO (not too early).
      if (this.accelPressedAt >= 0 && this.accelPressedAt < 0.7) {
        this.player.boost = 1.1;
        this.sfx.play('kartBoost');
        this.showBanner('GO!', 'ROCKET START!', 1.2, '#48e848');
      }
      for (const r of this.racers) if (r.brain instanceof SmartBrain) r.kart.boost = 0.6;
    }
  }

  private rubberBand(k: Kart): void {
    const gap = this.player.progress(this.track) - k.progress(this.track);
    const smart = this.racers.find((r) => r.kart === k)?.brain instanceof SmartBrain;
    if (gap > 500) k.rubber = smart ? 1.07 : 1.1;
    else if (gap < -700) k.rubber = smart ? 0.96 : 0.94;
    else k.rubber = smart ? 1 : 0.95;
  }

  private handleKartEvents(k: Kart, ev: KartEvents): void {
    const near = k.isPlayer;
    if (ev.miniTurbo !== undefined) {
      if (near) this.sfx.play('kartMiniTurbo');
      this.burst(k.x, k.y, 6, DRIFT_TIERS[ev.miniTurbo].color, 12, 'kp_spark');
    }
    if (ev.boostPad && near) this.sfx.play('kartBoost');
    if (ev.wall || ev.decorHit) {
      if (near) {
        this.sfx.play('kartCrash');
        this.cameras.main.shake(120, 0.006);
      }
      this.burst(k.x, k.y, 6, 0xffffff, 6, 'kp_spark');
    }
    if (ev.lap && near) {
      if (ev.lap === LAPS) {
        this.sfx.play('kartFinalLap');
        this.showBanner('FINAL LAP!', '', 2, '#f85858');
        setChipSongRate(1.12);
      } else {
        this.sfx.play('kartLap');
        this.showBanner(`LAP ${ev.lap}`, '', 1.4, '#ffffff');
      }
    }
    if (ev.finished && near) {
      this.phase = 'finished';
      this.sfx.stopMusic();
      this.sfx.play('kartFinish');
      const place = this.racers.filter((r) => r.kart.finished && r.kart.finishTime <= k.finishTime).length;
      this.showBanner('FINISH!', `${ORDINAL[place - 1]} place   ${fmtTime(k.finishTime)}`, 99, PLACE_COLORS[place - 1]);
      this.confetti();
    }
  }

  // --- Items ------------------------------------------------------------------

  private useItem(k: Kart): void {
    if (!k.item || k.roulette > 0 || k.spin > 0) return;
    const item = k.item;
    k.item = null;
    const fx = Math.cos(k.heading);
    const fy = Math.sin(k.heading);
    const near = k.isPlayer || Math.hypot(k.x - this.player.x, k.y - this.player.y) < 500;
    switch (item) {
      case 'turbo':
        k.boost = Math.max(k.boost, 1.3);
        if (near) this.sfx.play('kartBoost');
        break;
      case 'star':
        k.star = STAR_TIME;
        if (near) this.sfx.play('kartStar');
        break;
      case 'banana':
        this.spawnItem('banana', k.x - fx * 20, k.y - fy * 20, k.heading, 0, k);
        if (near) this.sfx.play('kartBanana');
        break;
      case 'bouncer':
        this.spawnItem('bouncer', k.x + fx * 16, k.y + fy * 16, k.heading, 480 + Math.max(0, k.speed) * 0.3, k);
        if (near) this.sfx.play('kartThrow');
        break;
      case 'homer': {
        const mine = k.progress(this.track);
        const ahead = this.racers
          .map((r) => r.kart)
          .filter((o) => o !== k && !o.finished && o.progress(this.track) > mine)
          .sort((a, b) => a.progress(this.track) - b.progress(this.track))[0];
        const it = this.spawnItem('homer', k.x + fx * 16, k.y + fy * 16, k.heading, 440 + Math.max(0, k.speed) * 0.3, k);
        it.target = ahead ?? null;
        if (near) this.sfx.play('kartThrow');
        break;
      }
    }
  }

  private spawnItem(kind: WorldItem['kind'], x: number, y: number, angle: number, speed: number, owner: Kart): WorldItem {
    const tex = kind === 'banana' ? 'item_banana' : kind === 'bouncer' ? 'item_bouncer' : 'item_homer';
    const it: WorldItem = {
      kind,
      x,
      y,
      angle,
      speed,
      life: kind === 'banana' ? 60 : kind === 'bouncer' ? 7 : 9,
      owner,
      immune: 0.4,
      target: null,
      idx: this.track.nearest(x, y, owner.idx, 20),
      sprite: this.add.image(0, 0, tex).setOrigin(0.5, 0.75),
      shadow: this.add.image(0, 0, 'kp_shadow'),
    };
    this.items.push(it);
    return it;
  }

  private updateItems(dt: number): void {
    const t = this.track;
    for (const it of this.items) {
      it.life -= dt;
      it.immune -= dt;
      if (it.kind !== 'banana') {
        if (it.kind === 'homer') {
          it.idx = t.nearest(it.x, it.y, it.idx, 20);
          let tx: number;
          let ty: number;
          if (it.target && Math.hypot(it.target.x - it.x, it.target.y - it.y) < 280) {
            tx = it.target.x;
            ty = it.target.y;
          } else {
            const p = t.pts[(it.idx + 8) % t.pts.length];
            tx = p.x;
            ty = p.y;
          }
          const want = Math.atan2(ty - it.y, tx - it.x);
          it.angle += Math.max(-6 * dt, Math.min(6 * dt, angleDiff(it.angle, want)));
        }
        const nx = it.x + Math.cos(it.angle) * it.speed * dt;
        const ny = it.y + Math.sin(it.angle) * it.speed * dt;
        if (t.surfaceAt(nx, ny) === SURFACE.OUT) {
          // Bounce: flip whichever velocity component hit the wall.
          const vx = Math.cos(it.angle);
          const vy = Math.sin(it.angle);
          const hitX = t.surfaceAt(nx, it.y) === SURFACE.OUT;
          const hitY = t.surfaceAt(it.x, ny) === SURFACE.OUT;
          it.angle = Math.atan2(hitY || !hitX ? -vy : vy, hitX || !hitY ? -vx : vx);
          if (it.kind === 'homer') it.life -= 1.5;
        } else {
          it.x = nx;
          it.y = ny;
        }
        if (Math.random() < 0.6) this.spawnParticle(it.x, it.y, 3, 0, 0, 10, 0.3, it.kind === 'homer' ? 0xff6060 : 0x80ff80, 0.5, 0.6, 'kp_puff');
      }
      for (const r of this.racers) {
        const k = r.kart;
        if (it.life <= 0) break;
        if (k === it.owner && it.immune > 0) continue;
        if (Math.hypot(k.x - it.x, k.y - it.y) < 15) {
          it.life = 0;
          if (k.hit()) {
            this.burstHitStars(k);
            if (k.isPlayer) this.cameras.main.shake(200, 0.01);
            if (k.isPlayer || it.owner.isPlayer) this.sfx.play('kartSpinOut');
          } else {
            this.burst(it.x, it.y, 6, 0xffffff, 8, 'kp_spark');
          }
        }
      }
    }
    // Projectiles knock out bananas they run into.
    for (const a of this.items) {
      if (a.kind === 'banana' || a.life <= 0) continue;
      for (const b of this.items) {
        if (b === a || b.life <= 0 || b.kind !== 'banana') continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) < 14) {
          a.life = 0;
          b.life = 0;
          this.burst(b.x, b.y, 4, 0xf8d800, 8, 'kp_px');
        }
      }
    }
    for (const it of this.items.filter((i) => i.life <= 0)) {
      it.sprite.destroy();
      it.shadow.destroy();
    }
    this.items = this.items.filter((i) => i.life > 0);
  }

  private updateBoxes(dt: number): void {
    for (const b of this.boxes) {
      if (b.respawn > 0) {
        b.respawn -= dt;
        continue;
      }
      for (const r of this.racers) {
        const k = r.kart;
        if (Math.hypot(k.x - b.x, k.y - b.y) > 18) continue;
        b.respawn = 2.5;
        this.burst(b.x, b.y, 8, 0xffffff, 10, 'kp_px', true);
        if (k.isPlayer) this.sfx.play('kartBoxBreak');
        if (!k.item) {
          k.item = rollItem(k.place - 1);
          k.roulette = k.isPlayer ? 1.2 : 0.6;
        }
        break;
      }
    }
  }

  private updatePlacings(): void {
    const sorted = [...this.racers.map((r) => r.kart)].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress(this.track) - a.progress(this.track);
    });
    sorted.forEach((k, i) => (k.place = i + 1));
  }

  // --- Camera + projection ------------------------------------------------------

  private updateCamera(dt: number): void {
    const p = this.player;
    // Look along a blend of heading and travel direction, easing behind the kart.
    const target = p.heading + angleDiff(p.heading, p.moveAngle) * 0.4;
    this.camAngle += angleDiff(this.camAngle, target) * Math.min(1, dt * 5);
    const boosting = p.boost > 0 || p.star > 0;
    const wantDist = boosting ? 74 : 62;
    this.camDist += (wantDist - this.camDist) * Math.min(1, dt * 3);
    this.camX = p.x - Math.cos(this.camAngle) * this.camDist;
    this.camY = p.y - Math.sin(this.camAngle) * this.camDist;
  }

  private project(wx: number, wy: number, wz = 0): { x: number; y: number; scale: number; fwd: number } | null {
    const cos = Math.cos(this.camAngle);
    const sin = Math.sin(this.camAngle);
    const rx = wx - this.camX;
    const ry = wy - this.camY;
    const fwd = rx * cos + ry * sin;
    if (fwd < 12) return null;
    const rgt = -rx * sin + ry * cos;
    const scale = this.focal / fwd;
    return { x: this.scale.width / 2 + rgt * scale, y: this.horizon + (this.camHeight - wz) * scale, scale, fwd };
  }

  private place(img: Phaser.GameObjects.Image, wx: number, wy: number, wz: number, worldPerPx: number, maxDist = 2600): boolean {
    const p = this.project(wx, wy, wz);
    if (!p || p.fwd > maxDist || p.x < -200 || p.x > this.scale.width + 200) {
      img.setVisible(false);
      return false;
    }
    img.setVisible(true).setPosition(p.x, p.y).setScale(p.scale * worldPerPx).setDepth(20000 - p.fwd);
    return true;
  }

  private renderWorld(): void {
    const cos = Math.cos(this.camAngle);
    const sin = Math.sin(this.camAngle);
    this.shader.setUniform('uCam.value.x', this.camX);
    this.shader.setUniform('uCam.value.y', this.camY);
    this.shader.setUniform('uDir.value.x', cos);
    this.shader.setUniform('uDir.value.y', sin);
    this.shader.setUniform('uHorizon.value', this.horizon);
    this.shader.setUniform('uFocal.value', this.focal);
    this.shader.setUniform('uHeight.value', this.camHeight);
    // Sky pans with the camera: a full turn scrolls the whole panorama.
    const skyW = this.track.sky.width;
    this.sky.tilePositionX = ((((this.camAngle / (Math.PI * 2)) * skyW) % skyW) + skyW) % skyW;

    const t = this.track;
    t.decor.forEach((d, i) => this.place(this.decorSprites[i], d.x, d.y, 0, PROP_WORLD_PER_PX * DECOR_SCALE[d.kind]));

    const time = this.time.now / 1000;
    for (const b of this.boxes) {
      const shown = b.respawn <= 0;
      b.sprite.setFrame(Math.floor(time * 8) % ITEMBOX_FRAMES);
      if (!shown || !this.place(b.sprite, b.x, b.y, 7 + Math.sin(time * 3 + b.x) * 2, PROP_WORLD_PER_PX * 1.35)) b.sprite.setVisible(false);
      if (!shown || !this.place(b.shadow, b.x, b.y, 0, 0.5)) b.shadow.setVisible(false);
    }
    for (const it of this.items) {
      const z = it.kind === 'banana' ? 0 : 3;
      this.place(it.sprite, it.x, it.y, z, PROP_WORLD_PER_PX * 1.3);
      it.sprite.setDepth(it.sprite.depth + 1);
      this.place(it.shadow, it.x, it.y, 0, 0.35);
    }

    for (const r of this.racers) {
      const k = r.kart;
      const bob = k.speed > 5 ? Math.sin(time * 40 + k.x) * 0.25 : 0;
      if (!this.place(r.sprite, k.x, k.y, k.z + bob, KART_WORLD_PER_PX)) {
        r.shadow.setVisible(false);
        r.flame.setVisible(false);
        continue;
      }
      const view = Math.atan2(k.y - this.camY, k.x - this.camX);
      const rel = angleDiff(view, k.heading) + k.lean * 0.2;
      const frame = ((Math.round(rel / ((Math.PI * 2) / KART_FRAMES)) % KART_FRAMES) + KART_FRAMES) % KART_FRAMES;
      r.sprite.setFrame(frame);
      if (k.star > 0) {
        const c = Phaser.Display.Color.HSVToRGB((time * 3) % 1, 0.6, 1) as Phaser.Types.Display.ColorObject;
        r.sprite.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      } else if (k.spin > 0) {
        r.sprite.setTint(0xffc0c0);
      } else {
        r.sprite.clearTint();
      }
      this.place(r.shadow, k.x, k.y, 0, 0.75);
      r.shadow.setDepth(r.sprite.depth - 0.5);

      const boosting = k.boost > 0 && k.spin <= 0;
      if (boosting) {
        const bx = k.x - Math.cos(k.heading) * 11;
        const by = k.y - Math.sin(k.heading) * 11;
        const p = this.project(bx, by, 4);
        if (p) {
          r.flame
            .setVisible(true)
            .setPosition(p.x, p.y)
            .setScale(p.scale * (0.18 + Math.random() * 0.08), p.scale * (0.22 + Math.random() * 0.14))
            .setDepth(r.sprite.depth + (Math.cos(rel) > 0 ? 0.5 : -0.5))
            .setTint(k.star > 0 ? 0xff80ff : 0xffffff);
        }
      } else {
        r.flame.setVisible(false);
      }
    }
  }

  // --- Particles --------------------------------------------------------------

  private spawnParticle(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    tint: number,
    size: number,
    grow: number,
    tex = 'kp_px',
    gravity = 0,
  ): void {
    const img = this.particlePool.pop();
    if (!img) return;
    img.setTexture(tex).setTint(tint).setAlpha(1).setVisible(true);
    this.particles.push({ x, y, z, vx, vy, vz, life, max: life, size, grow, gravity, img });
  }

  private burst(x: number, y: number, z: number, tint: number, count: number, tex: string, rainbow = false): void {
    const colors = [0xf84848, 0xf8b800, 0x48d848, 0x48a8f8, 0xc858f8];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 80;
      this.spawnParticle(x, y, z, Math.cos(a) * s, Math.sin(a) * s, 60 + Math.random() * 90, 0.5 + Math.random() * 0.3, rainbow ? colors[i % colors.length] : tint, 0.9, 0, tex, 260);
    }
  }

  private burstHitStars(k: Kart): void {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.spawnParticle(k.x, k.y, 16, Math.cos(a) * 45, Math.sin(a) * 45, 70, 0.8, 0xffffff, 1.2, 0, 'kp_hitstar', 120);
    }
  }

  private emitKartParticles(k: Kart, dt: number): void {
    const fx = Math.cos(k.heading);
    const fy = Math.sin(k.heading);
    const rx = -fy;
    const ry = fx;
    const rear = (side: number) => ({ x: k.x - fx * 9 + rx * 6 * side, y: k.y - fy * 9 + ry * 6 * side });
    if (k.drifting && k.z === 0) {
      const tier = k.driftTier;
      const color = tier >= 0 ? DRIFT_TIERS[tier].color : 0xd8d8d8;
      for (const side of [-1, 1]) {
        const p = rear(side);
        if (tier >= 0) this.spawnParticle(p.x, p.y, 1, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, 60 + Math.random() * 60, 0.25, color, 0.4, 0, 'kp_spark', 300);
        else if (Math.random() < 0.5) this.spawnParticle(p.x, p.y, 1, 0, 0, 12, 0.35, 0xe0e0e0, 0.5, 1.4, 'kp_puff');
      }
    }
    if (k.surface === SURFACE.OFFROAD && Math.abs(k.speed) > 60 && Math.random() < dt * 30) {
      const p = rear(Math.random() < 0.5 ? -1 : 1);
      this.spawnParticle(p.x, p.y, 1, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 25, 0.45, DUST[this.track.def.theme], 0.6, 1.6, 'kp_puff');
    }
    if (k.boost > 0 && k.spin <= 0 && Math.random() < dt * 40) {
      const p = rear(0);
      this.spawnParticle(p.x, p.y, 4, -fx * 40, -fy * 40, 10, 0.3, Math.random() < 0.5 ? 0xffa020 : 0xfff080, 0.6, 1.2, 'kp_puff');
    }
    if (k.star > 0 && Math.random() < dt * 25) {
      const colors = [0xf84848, 0xf8b800, 0x48d848, 0x48a8f8, 0xc858f8];
      this.spawnParticle(k.x + (Math.random() - 0.5) * 16, k.y + (Math.random() - 0.5) * 16, 6 + Math.random() * 10, 0, 0, 20, 0.5, colors[Math.floor(Math.random() * 5)], 0.8, 0, 'kp_spark');
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vz -= p.gravity * dt;
      p.z = Math.max(0, p.z + p.vz * dt);
      const prj = p.life > 0 ? this.project(p.x, p.y, p.z) : null;
      if (!prj) {
        p.img.setVisible(false);
        continue;
      }
      const age = 1 - p.life / p.max;
      p.img
        .setVisible(true)
        .setPosition(prj.x, prj.y)
        .setScale(prj.scale * p.size * (1 + p.grow * age))
        .setAlpha(Math.min(1, p.life / p.max * 1.6))
        .setDepth(20000 - prj.fwd + 0.8);
    }
    for (const p of this.particles.filter((q) => q.life <= 0)) {
      p.img.setVisible(false);
      this.particlePool.push(p.img);
    }
    this.particles = this.particles.filter((q) => q.life > 0);
  }

  private confetti(): void {
    const { width: W } = this.scale;
    const colors = [0xf84848, 0xf8b800, 0x48d848, 0x48a8f8, 0xc858f8, 0xffffff];
    for (let i = 0; i < 120; i++) {
      const r = this.add
        .rectangle(Math.random() * W, -20 - Math.random() * 300, 6 + Math.random() * 6, 10 + Math.random() * 6, colors[i % colors.length])
        .setDepth(29500);
      this.tweens.add({
        targets: r,
        y: this.scale.height + 40,
        x: r.x + (Math.random() - 0.5) * 200,
        angle: Math.random() * 720,
        duration: 2600 + Math.random() * 2200,
        onComplete: () => r.destroy(),
      });
    }
  }

  // --- HUD / audio ------------------------------------------------------------

  private updateHud(dt: number): void {
    const { width: W, height: H } = this.scale;
    const p = this.player;
    const u = Math.max(1, H / 720);
    this.hud.lap.setText(`LAP ${p.lap}/${LAPS}`);
    this.hud.time.setText(fmtTime(this.phase === 'finished' ? p.finishTime : this.raceTime));
    this.hud.place.setText(ORDINAL[p.place - 1] ?? '').setColor(PLACE_COLORS[p.place - 1] ?? '#ffffff');
    this.hud.placeOf.setText(`of ${this.racers.length}`);
    const kmh = Math.round(Math.max(0, p.speed) * 0.42);
    this.hud.speed.setText(`${kmh} km/h`);
    const bar = this.hud.speedBar;
    bar.clear();
    const bw = 180 * u;
    const frac = Math.min(1.3, Math.max(0, p.speed) / p.def.topSpeed) / 1.3;
    bar.fillStyle(0x000000, 0.5).fillRect(18, H - 52 * u - 14 * u, bw, 10 * u);
    bar.fillStyle(p.boost > 0 ? 0xffa020 : 0x48e848, 1).fillRect(18, H - 52 * u - 14 * u, bw * frac, 10 * u);
    if (p.drifting && p.driftTier >= 0) {
      bar.fillStyle(DRIFT_TIERS[p.driftTier].color, 1).fillRect(18, H - 52 * u - 26 * u, bw * Math.min(1, p.driftCharge / DRIFT_TIERS[2].charge), 6 * u);
    }

    // Item slot (with roulette).
    if (p.item) {
      let id: ItemId = p.item;
      if (p.roulette > 0) {
        const all: ItemId[] = ['turbo', 'banana', 'bouncer', 'homer', 'star'];
        id = all[Math.floor(this.time.now / 70) % all.length];
        this.rouletteTick -= dt;
        if (this.rouletteTick <= 0) {
          this.sfx.play('kartItemTick');
          this.rouletteTick = 0.07;
        }
      } else if (this.rouletteTick > -1) {
        this.sfx.play('kartItemGet');
        this.rouletteTick = -1;
      }
      this.hud.itemIcon.setTexture(`icon_${id}`).setVisible(true);
      this.hud.itemName.setText(p.roulette > 0 ? '' : ITEM_NAMES[p.item]);
    } else {
      this.hud.itemIcon.setVisible(false);
      this.hud.itemName.setText('');
      this.rouletteTick = 0;
    }

    // Countdown lights.
    const lg = this.hud.lights;
    lg.clear();
    if (this.phase === 'countdown' && this.countdown < 3.6) {
      const cx = W / 2;
      const cy = H * 0.18;
      lg.fillStyle(0x202020, 0.9).fillRoundedRect(cx - 80 * u, cy - 26 * u, 160 * u, 52 * u, 12);
      for (let i = 0; i < 3; i++) {
        const lit = this.countdown <= 3 - i;
        lg.fillStyle(lit ? 0xf83030 : 0x481010, 1).fillCircle(cx + (i - 1) * 48 * u, cy, 18 * u);
      }
    } else if (this.phase === 'racing' && this.raceTime < 0.8) {
      const cx = W / 2;
      const cy = H * 0.18;
      lg.fillStyle(0x202020, 0.9).fillRoundedRect(cx - 80 * u, cy - 26 * u, 160 * u, 52 * u, 12);
      for (let i = 0; i < 3; i++) lg.fillStyle(0x30f830, 1).fillCircle(cx + (i - 1) * 48 * u, cy, 18 * u);
    }

    // Banner fade.
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0.3) {
        this.hud.banner.setAlpha(Math.max(0, this.bannerTimer / 0.3));
        this.hud.sub.setAlpha(Math.max(0, this.bannerTimer / 0.3));
      }
    }
    if (p.wrongWayTime > 1 && this.phase === 'racing' && this.bannerTimer <= 0) {
      this.hud.banner.setText('WRONG WAY!').setColor('#f84848').setScale(1).setAlpha(Math.floor(this.time.now / 300) % 2 ? 1 : 0.3);
      this.hud.sub.setText('');
    } else if (this.bannerTimer <= 0) {
      this.hud.banner.setAlpha(0);
    }

    // Minimap dots.
    const md = this.hud.miniDots;
    md.clear();
    for (const r of this.racers) {
      const k = r.kart;
      const x = this.miniMap.x + (k.x / TRACK_SIZE) * this.miniMap.size;
      const y = this.miniMap.y + (k.y / TRACK_SIZE) * this.miniMap.size;
      md.fillStyle(0x000000, 1).fillCircle(x, y, (k.isPlayer ? 7 : 5) * u);
      md.fillStyle(parseInt(k.def.body.slice(1), 16), 1).fillCircle(x, y, (k.isPlayer ? 5 : 3.5) * u);
    }

    // Speed lines while boosting.
    const fx = this.hud.fx;
    fx.clear();
    if ((p.boost > 0 || p.star > 0) && p.spin <= 0) {
      fx.lineStyle(2, 0xffffff, 0.55);
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2;
        const r0 = Math.min(W, H) * (0.42 + Math.random() * 0.1);
        const len = 40 + Math.random() * 80;
        const cx = W / 2;
        const cy = H * 0.55;
        fx.lineBetween(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.7, cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len) * 0.7);
      }
    }
  }

  private updateAudio(input: KartInput): void {
    const p = this.player;
    const racing = this.phase !== 'countdown' || this.countdown < 3.5;
    const throttle = this.phase === 'countdown' ? Math.max(0, input.throttle) : Math.max(0, input.throttle);
    this.engine?.set(Math.abs(p.speed) / p.def.topSpeed, throttle, racing ? 1 : 0.6);
    const tier = p.driftTier;
    this.screech?.set(p.drifting && p.z === 0 ? 0.05 + (tier + 1) * 0.015 : 0, 2200 + (tier + 1) * 500);
    this.rumble?.set(p.surface === SURFACE.OFFROAD ? Math.min(1, Math.abs(p.speed) / 200) * 0.18 : 0);
  }

  // --- Results ----------------------------------------------------------------

  private showResults(): void {
    this.resultsShown = true;
    const { width: W, height: H } = this.scale;
    const u = Math.max(1, H / 720);
    // Karts still racing get a projected time from their remaining distance.
    const rows = this.racers
      .map((r) => {
        const k = r.kart;
        let time = k.finishTime;
        let est = false;
        if (!k.finished) {
          const remaining = LAPS * this.track.length - k.progress(this.track);
          const avg = Math.max(80, k.progress(this.track) / Math.max(1, this.raceTime));
          time = this.raceTime + remaining / avg;
          est = true;
        }
        return { k, time, est };
      })
      .sort((a, b) => a.time - b.time);

    const panelW = Math.min(560 * u, W * 0.9);
    const panelH = 300 * u;
    const c = this.add.container(W / 2, H / 2).setDepth(31000);
    c.add(this.add.rectangle(0, 0, panelW, panelH, 0x000000, 0.82).setStrokeStyle(3, 0xf8d800));
    c.add(
      this.add
        .text(0, -panelH / 2 + 30 * u, 'RESULTS', { fontFamily: 'monospace', fontSize: `${Math.round(28 * u)}px`, color: '#f8d800', fontStyle: 'bold' })
        .setOrigin(0.5),
    );
    rows.forEach((row, i) => {
      const y = -panelH / 2 + (84 + i * 42) * u;
      const style = { fontFamily: 'monospace', fontSize: `${Math.round(18 * u)}px`, color: row.k.isPlayer ? '#48e848' : '#ffffff', fontStyle: 'bold' };
      c.add(this.add.text(-panelW / 2 + 24 * u, y, ORDINAL[i], { ...style, color: PLACE_COLORS[i] }).setOrigin(0, 0.5));
      c.add(this.add.image(-panelW / 2 + 110 * u, y, `kart_${row.k.def.id}`, 2).setScale(0.8 * u));
      const name = row.k.isPlayer ? `YOU (${row.k.def.driverName.split(' ')[0]})` : row.k.def.driverName;
      c.add(this.add.text(-panelW / 2 + 150 * u, y, name, style).setOrigin(0, 0.5));
      c.add(this.add.text(panelW / 2 - 24 * u, y, (row.est ? '~' : '') + fmtTime(row.time), style).setOrigin(1, 0.5));
    });
    const btn = (label: string, x: number, onClick: () => void) => {
      const b = this.add.rectangle(x, panelH / 2 - 36 * u, 170 * u, 38 * u, 0x303030).setStrokeStyle(2, 0xffffff).setInteractive({ useHandCursor: true });
      b.on('pointerover', () => b.setFillStyle(0x505050));
      b.on('pointerout', () => b.setFillStyle(0x303030));
      b.on('pointerdown', onClick);
      c.add(b);
      c.add(this.add.text(x, panelH / 2 - 36 * u, label, { fontFamily: 'monospace', fontSize: `${Math.round(14 * u)}px`, color: '#ffffff' }).setOrigin(0.5));
    };
    btn('RACE AGAIN (R)', -180 * u, () => this.scene.restart({ vehicleId: this.vehicle.id, trackId: this.track.def.id }));
    btn('KARTS & TRACKS', 0, () => this.scene.start('KartMenu'));
    btn('ARCADE', 180 * u, () => this.scene.start('GameSelect'));
  }
}
