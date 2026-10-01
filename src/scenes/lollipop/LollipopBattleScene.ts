import Phaser from 'phaser';
import {
  BUDDY_FIRE_DELAY,
  BUDDY_HP,
  FLAVORS,
  GERMS,
  HURT_GRACE,
  MAX_BUDDIES,
  SHOT_SPEED,
  SLIME_SPEED,
  SPIN_COOLDOWN,
  SPIN_DAMAGE,
  SPIN_RADIUS,
  SPRINKLE_TIME,
  WAVES,
  getFlavor,
  type FlavorDef,
  type FlavorId,
  type GermDef,
  type GermKind,
} from '../../game/lollipop/config';
import { POP_H, POP_HEAD_Y, buildLollipopTextures } from '../../game/lollipop/textures';
import { MenuNav, type NavItem } from '../../game/shared/MenuNav';
import { setPadProfile } from '../../game/shared/Pad';
import { LOLLIPOP_PAD } from '../../game/shared/PadProfiles';
import { SoundManager, loadMuted, saveMuted } from '../../game/shared/Sound';
import { LOLLIPOP_SAVE } from './LollipopMenuScene';

export interface LollipopBattleInitData {
  flavor: FlavorId;
}

type Img = Phaser.GameObjects.Image;

interface Pop {
  flavor: FlavorDef;
  img: Img;
  shadow: Img;
  hero: boolean;
  scale: number;
  radius: number;
  hp: number;
  maxHp: number;
  hurtUntil: number;
  nextShot: number;
}

interface Germ {
  def: GermDef;
  img: Img;
  shadow: Img;
  hp: number;
  maxHp: number;
  /** Knockback velocity, which decays. */
  kx: number;
  ky: number;
  phase: number;
  /** Harmless and untouchable while it fades in. */
  spawnUntil: number;
  flashUntil: number;
  nextAct: number;
  lungeUntil: number;
  lungeX: number;
  lungeY: number;
  orbit: number;
  attack: number;
}

interface Shot {
  img: Img;
  vx: number;
  vy: number;
  damage: number;
  life: number;
}

interface Slime {
  img: Img;
  vx: number;
  vy: number;
  life: number;
}

interface Pickup {
  img: Img;
  kind: 'heart' | 'sprinkle';
  expires: number;
}

const GERM_COLOR: Record<GermKind, number> = {
  blob: 0x4cc038,
  virus: 0xa040c0,
  splitter: 0xf08828,
  mini: 0xf08828,
  spitter: 0x3890d8,
  boss: 0x3a8a28,
};

const FONT = 'monospace';
const INK = '#301040';
const HUD_DEPTH = 2000;
const TOP_BAR = 56;
/** Most germs on the field at once; the wave waits for room. */
const MAX_GERMS = 30;

export class LollipopBattleScene extends Phaser.Scene {
  private sfx!: SoundManager;
  private flavor!: FlavorDef;

  /** Game clock (ms). Stands still while paused, unlike scene time. */
  private clock = 0;
  private phase: 'fight' | 'break' | 'over' = 'fight';
  private paused = false;
  private pauseLayer: Phaser.GameObjects.GameObject[] = [];
  private pauseNav: MenuNav | null = null;

  private hero!: Pop;
  private buddies: Pop[] = [];
  private recruited = 0;
  private germs: Germ[] = [];
  private shots: Shot[] = [];
  private slimes: Slime[] = [];
  private pickups: Pickup[] = [];
  private boss: Germ | null = null;

  private wave = 0;
  private queue: GermKind[] = [];
  private nextSpawn = 0;
  private breakUntil = 0;
  private score = 0;
  private facing = new Phaser.Math.Vector2(0, -1);
  private spinReadyAt = 0;
  private spinUntil = 0;
  private sprinkleUntil = 0;
  private nextSparkle = 0;
  private bannerObjs: Phaser.GameObjects.Text[] = [];

  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private floor!: Phaser.GameObjects.TileSprite;
  private topBar!: Phaser.GameObjects.Rectangle;
  private hearts: Img[] = [];
  private hud!: Phaser.GameObjects.Graphics;
  private waveText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private spinText!: Phaser.GameObjects.Text;
  private bossText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;

  constructor() {
    super('LollipopBattle');
  }

  init(data: LollipopBattleInitData): void {
    this.flavor = getFlavor(data.flavor);
    this.clock = 0;
    this.phase = 'fight';
    this.paused = false;
    this.pauseLayer = [];
    this.pauseNav = null;
    this.buddies = [];
    this.recruited = 0;
    this.germs = [];
    this.shots = [];
    this.slimes = [];
    this.pickups = [];
    this.boss = null;
    this.wave = 0;
    this.queue = [];
    this.score = 0;
    this.facing.set(0, -1);
    this.spinReadyAt = 0;
    this.spinUntil = 0;
    this.sprinkleUntil = 0;
    this.nextSparkle = 0;
    this.bannerObjs = [];
    this.hearts = [];
  }

  create(): void {
    buildLollipopTextures(this);
    this.sfx = new SoundManager(this);
    this.sfx.setMuted(loadMuted());
    setPadProfile(this, LOLLIPOP_PAD);

    const { width: W, height: H } = this.scale;
    this.floor = this.add.tileSprite(0, 0, W, H, 'lp_floor').setOrigin(0).setDepth(-10);

    this.hero = this.makePop(this.flavor, W / 2, H / 2 + 40, true);

    this.buildHud();
    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', this.layout, this));

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,J,Z,SHIFT,K,X') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown-ESC', () => this.togglePause());
    kb.on('keydown-P', () => this.togglePause());
    kb.on('keydown-M', () => {
      const muted = !this.sfx.isMuted();
      this.sfx.setMuted(muted);
      saveMuted(muted);
    });
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) this.trySpin();
    });

    this.startWave(0);
  }

  // --- Main loop -------------------------------------------------------------------

  update(_time: number, delta: number): void {
    if (this.paused) return;
    const dtMs = Math.min(delta, 50);
    const dt = dtMs / 1000;
    this.clock += dtMs;

    if (this.phase !== 'over') {
      this.moveHero(dt);
      this.heroActions();
    }
    this.moveBuddies(dt);
    this.buddiesFire();
    this.updateGerms(dt);
    this.updateShots(dt);
    this.updateSlimes(dt);
    this.updatePickups();
    this.contacts();
    this.updateWave();
    this.drawPops();
    this.drawHud();
  }

  private arena(): { left: number; right: number; top: number; bottom: number } {
    const { width: W, height: H } = this.scale;
    return { left: 26, right: W - 26, top: TOP_BAR + 30, bottom: H - 26 };
  }

  // --- Lollipops -------------------------------------------------------------------

  private makePop(flavor: FlavorDef, x: number, y: number, hero: boolean): Pop {
    const scale = hero ? 1 : 0.72;
    const shadow = this.add.image(x, y, 'lp_shadow').setScale(scale * 0.8);
    const img = this.add.image(x, y, `lp_pop_${flavor.id}`).setOrigin(0.5, POP_HEAD_Y / POP_H).setScale(scale);
    const hp = hero ? flavor.hp : BUDDY_HP;
    return { flavor, img, shadow, hero, scale, radius: 21 * scale, hp, maxHp: hp, hurtUntil: 0, nextShot: 0 };
  }

  private moveHero(dt: number): void {
    const k = this.keys;
    let dx = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
    let dy = (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0);
    const img = this.hero.img;
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
      this.facing.set(dx, dy);
      const a = this.arena();
      img.x = Phaser.Math.Clamp(img.x + dx * this.flavor.speed * dt, a.left, a.right);
      img.y = Phaser.Math.Clamp(img.y + dy * this.flavor.speed * dt, a.top, a.bottom - 50);
      if (this.clock > this.spinUntil) img.angle = Math.sin(this.clock / 70) * 9;
    } else if (this.clock > this.spinUntil) {
      img.angle *= 0.8;
    }
  }

  private heroActions(): void {
    const k = this.keys;
    const p = this.input.activePointer;
    const mouseFire = p.isDown && !p.rightButtonDown();
    if ((k.SPACE.isDown || k.J.isDown || k.Z.isDown || mouseFire) && this.clock >= this.hero.nextShot) {
      let angle: number;
      if (mouseFire) {
        angle = Math.atan2(p.worldY - this.hero.img.y, p.worldX - this.hero.img.x);
      } else {
        // Keyboard / pad: aim at the nearest germ, or straight ahead if there are none.
        const t = this.nearestGerm(this.hero.img.x, this.hero.img.y, 750);
        angle = t ? Math.atan2(t.img.y - this.hero.img.y, t.img.x - this.hero.img.x) : Math.atan2(this.facing.y, this.facing.x);
      }
      const sprinkled = this.clock < this.sprinkleUntil;
      this.volley(this.hero, angle, this.flavor.spread + (sprinkled ? 2 : 0));
      this.hero.nextShot = this.clock + this.flavor.fireDelay * (sprinkled ? 0.6 : 1);
      this.sfx.play('lpShot');
    }
    if (Phaser.Input.Keyboard.JustDown(k.SHIFT) || Phaser.Input.Keyboard.JustDown(k.K) || Phaser.Input.Keyboard.JustDown(k.X)) this.trySpin();

    // Sprinkle power: a rainbow shimmer and a sparkly trail.
    if (this.clock < this.sprinkleUntil) {
      const c = Phaser.Display.Color.HSVToRGB((this.clock / 600) % 1, 0.35, 1) as Phaser.Types.Display.ColorObject;
      this.hero.img.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      if (this.clock >= this.nextSparkle) {
        this.nextSparkle = this.clock + 50;
        const c2 = Phaser.Display.Color.HSVToRGB(Math.random(), 0.7, 1) as Phaser.Types.Display.ColorObject;
        this.burst(this.hero.img.x, this.hero.img.y + 10, Phaser.Display.Color.GetColor(c2.r, c2.g, c2.b), 1, 20);
      }
    } else {
      this.hero.img.clearTint();
    }
  }

  private volley(pop: Pop, angle: number, count: number): void {
    const step = 0.2;
    for (let i = 0; i < count; i++) {
      const a = angle + (i - (count - 1) / 2) * step;
      const x = pop.img.x + Math.cos(a) * pop.radius;
      const y = pop.img.y + Math.sin(a) * pop.radius;
      const img = this.add.image(x, y, `lp_shot_${pop.flavor.id}`).setDepth(1500).setScale(pop.hero ? 1.1 : 0.9);
      this.shots.push({ img, vx: Math.cos(a) * SHOT_SPEED, vy: Math.sin(a) * SHOT_SPEED, damage: pop.flavor.damage, life: 1400 });
    }
  }

  private trySpin(): void {
    if (this.paused || this.phase === 'over' || this.clock < this.spinReadyAt) return;
    this.spinReadyAt = this.clock + SPIN_COOLDOWN;
    this.spinUntil = this.clock + 450;
    this.sfx.play('lpSpin');
    const { x, y } = this.hero.img;
    for (const p of [this.hero, ...this.buddies]) {
      this.tweens.add({ targets: p.img, angle: { from: 0, to: 720 }, duration: 450, ease: 'Cubic.easeOut', onComplete: () => p.img.setAngle(0) });
    }
    const ring = this.add.graphics({ x, y }).setDepth(1400);
    ring.lineStyle(10, this.flavor.color, 0.9).strokeCircle(0, 0, SPIN_RADIUS);
    ring.lineStyle(4, 0xffffff, 0.9).strokeCircle(0, 0, SPIN_RADIUS - 8);
    ring.setScale(0.25);
    this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 320, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });

    for (const g of [...this.germs]) {
      if (g.spawnUntil > this.clock) continue;
      const d = Phaser.Math.Distance.Between(x, y, g.img.x, g.img.y);
      if (d < SPIN_RADIUS + g.def.radius) this.hurtGerm(g, SPIN_DAMAGE, Math.atan2(g.img.y - y, g.img.x - x), g.def.kind === 'boss' ? 120 : 520);
    }
    this.slimes = this.slimes.filter((s) => {
      if (Phaser.Math.Distance.Between(x, y, s.img.x, s.img.y) > SPIN_RADIUS) return true;
      this.burst(s.img.x, s.img.y, 0x70e050, 4, 24);
      s.img.destroy();
      return false;
    });
  }

  /** Buddies trail behind the hero in a conga line. */
  private moveBuddies(dt: number): void {
    let lead: Img = this.hero.img;
    for (const b of this.buddies) {
      const d = Phaser.Math.Distance.Between(b.img.x, b.img.y, lead.x, lead.y);
      const gap = 42;
      if (d > gap) {
        const step = Math.min(d - gap, this.flavor.speed * 1.15 * dt + (d > gap * 2.5 ? (d - gap * 2.5) * 0.2 : 0));
        b.img.x += ((lead.x - b.img.x) / d) * step;
        b.img.y += ((lead.y - b.img.y) / d) * step;
        if (this.clock > this.spinUntil) b.img.angle = Math.sin(this.clock / 70 + b.img.x) * 9;
      } else if (this.clock > this.spinUntil) {
        b.img.angle *= 0.8;
      }
      lead = b.img;
    }
  }

  private buddiesFire(): void {
    if (this.phase === 'over') return;
    for (const b of this.buddies) {
      if (this.clock < b.nextShot) continue;
      const t = this.nearestGerm(b.img.x, b.img.y, 480);
      if (!t) continue;
      this.volley(b, Math.atan2(t.img.y - b.img.y, t.img.x - b.img.x), 1);
      b.nextShot = this.clock + BUDDY_FIRE_DELAY + Math.random() * 150;
    }
  }

  private recruitBuddy(): FlavorDef | null {
    if (this.buddies.length >= MAX_BUDDIES) return null;
    const others = FLAVORS.filter((f) => f.id !== this.flavor.id);
    const f = others[this.recruited % others.length];
    this.recruited++;
    const tail = this.buddies.length ? this.buddies[this.buddies.length - 1].img : this.hero.img;
    const b = this.makePop(f, tail.x, tail.y + 30, false);
    b.img.setScale(0);
    this.tweens.add({ targets: b.img, scale: b.scale, duration: 400, ease: 'Back.easeOut' });
    this.burst(b.img.x, b.img.y, f.color, 14, 60);
    this.buddies.push(b);
    this.sfx.play('lpBuddy');
    return f;
  }

  private hurtPop(p: Pop, dmg: number): void {
    if (this.phase === 'over' || this.clock < p.hurtUntil) return;
    if (p.hero && this.clock < this.spinUntil) return;
    p.hp -= dmg;
    p.hurtUntil = this.clock + (p.hero ? HURT_GRACE : 800);
    this.burst(p.img.x, p.img.y, p.flavor.color, 6, 40);
    if (p.hero) {
      this.sfx.play('lpHurt');
      this.cameras.main.shake(160, 0.008);
      if (p.hp <= 0) this.gameOver();
    } else if (p.hp <= 0) {
      // A buddy popped.
      this.sfx.play('lpBuddyPop');
      this.burst(p.img.x, p.img.y, p.flavor.color, 18, 70);
      this.floatText(p.img.x, p.img.y - 20, `${p.flavor.name} popped!`, '#ffffff');
      p.img.destroy();
      p.shadow.destroy();
      this.buddies = this.buddies.filter((b) => b !== p);
    } else {
      this.sfx.play('lpHit');
    }
  }

  private drawPops(): void {
    for (const p of [this.hero, ...this.buddies]) {
      if (!p.img.active) continue;
      p.shadow.setPosition(p.img.x, p.img.y + (POP_H - POP_HEAD_Y - 4) * p.scale).setDepth(p.img.y - 1);
      p.img.setDepth(p.img.y + 30);
      p.img.setAlpha(this.clock < p.hurtUntil && Math.floor(this.clock / 80) % 2 ? 0.35 : 1);
    }
  }

  // --- Germs -----------------------------------------------------------------------

  private spawnGerm(kind: GermKind, at?: { x: number; y: number }, hp?: number): Germ {
    const def = GERMS[kind];
    const a = this.arena();
    let x = 0;
    let y = 0;
    if (at) {
      x = at.x;
      y = at.y;
    } else {
      // Ooze in from a random edge, not right on top of the hero.
      for (let tries = 0; tries < 6; tries++) {
        const side = Phaser.Math.Between(0, 3);
        x = side === 0 ? a.left + 10 : side === 1 ? a.right - 10 : Phaser.Math.Between(a.left, a.right);
        y = side === 2 ? a.top + 10 : side === 3 ? a.bottom - 20 : Phaser.Math.Between(a.top, a.bottom - 20);
        if (Phaser.Math.Distance.Between(x, y, this.hero.img.x, this.hero.img.y) > 220) break;
      }
    }
    const shadow = this.add.image(x, y, 'lp_shadow').setScale((def.radius * 2.2) / 48, (def.radius * 0.9) / 16);
    const img = this.add.image(x, y, `lp_germ_${kind}`).setAlpha(0);
    const maxHp = hp ?? def.hp;
    const g: Germ = {
      def,
      img,
      shadow,
      hp: maxHp,
      maxHp,
      kx: 0,
      ky: 0,
      phase: Math.random() * Math.PI * 2,
      spawnUntil: this.clock + (kind === 'mini' ? 150 : 600),
      flashUntil: 0,
      nextAct: this.clock + 1500 + Math.random() * 1500,
      lungeUntil: 0,
      lungeX: 0,
      lungeY: 0,
      orbit: Math.random() < 0.5 ? -1 : 1,
      attack: 0,
    };
    this.germs.push(g);
    return g;
  }

  /** The lollipop a germ goes after: whichever is closest. */
  private targetFor(x: number, y: number): Pop {
    let best = this.hero;
    let bestD = Phaser.Math.Distance.Between(x, y, best.img.x, best.img.y);
    for (const b of this.buddies) {
      const d = Phaser.Math.Distance.Between(x, y, b.img.x, b.img.y);
      if (d < bestD) {
        best = b;
        bestD = d;
      }
    }
    return best;
  }

  private nearestGerm(x: number, y: number, maxD: number): Germ | null {
    let best: Germ | null = null;
    let bestD = maxD;
    for (const g of this.germs) {
      if (g.spawnUntil > this.clock) continue;
      const d = Phaser.Math.Distance.Between(x, y, g.img.x, g.img.y) - g.def.radius;
      if (d < bestD) {
        best = g;
        bestD = d;
      }
    }
    return best;
  }

  private updateGerms(dt: number): void {
    const a = this.arena();
    const pace = 1 + this.wave * 0.04;
    for (const g of this.germs) {
      const img = g.img;
      const spawning = g.spawnUntil > this.clock;
      const grow = spawning ? 1 - (g.spawnUntil - this.clock) / 600 : 1;
      img.setAlpha(Math.min(1, grow + 0.2));

      // Squish and wobble.
      const wob = Math.sin(this.clock / 180 + g.phase) * 0.07;
      img.setScale(Math.max(0.1, grow) * (1 + wob), Math.max(0.1, grow) * (1 - wob));
      if (g.def.kind === 'virus') img.angle += (g.lungeUntil > this.clock ? 540 : 90) * dt;
      if (this.clock < g.flashUntil) img.setTintFill(0xffffff);
      else img.clearTint();

      if (!spawning && this.phase !== 'over') {
        const t = this.targetFor(img.x, img.y);
        const dx = t.img.x - img.x;
        const dy = t.img.y - img.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        const ux = dx / d;
        const uy = dy / d;
        const sp = g.def.speed * pace;
        let mx = ux * sp;
        let my = uy * sp;

        switch (g.def.kind) {
          case 'virus':
            if (this.clock < g.lungeUntil) {
              mx = g.lungeX * sp * 3.4;
              my = g.lungeY * sp * 3.4;
            } else {
              mx = (ux + -uy * 0.9 * g.orbit) * sp * 0.75;
              my = (uy + ux * 0.9 * g.orbit) * sp * 0.75;
              if (this.clock >= g.nextAct && d < 380) {
                g.lungeUntil = this.clock + 420;
                g.lungeX = ux;
                g.lungeY = uy;
                g.nextAct = this.clock + 1800 + Math.random() * 1400;
              }
            }
            break;
          case 'spitter':
            if (d < 200) {
              mx = -ux * sp;
              my = -uy * sp;
            } else if (d < 300) {
              mx = -uy * sp * 0.7 * g.orbit;
              my = ux * sp * 0.7 * g.orbit;
            }
            if (this.clock >= g.nextAct && d < 520) {
              this.spit(img.x, img.y + 6, Math.atan2(dy, dx));
              g.nextAct = this.clock + 1900 + Math.random() * 900;
            }
            break;
          case 'boss':
            if (this.clock >= g.nextAct) this.bossAttack(g, Math.atan2(dy, dx));
            break;
        }

        img.x += (mx + g.kx) * dt;
        img.y += (my + g.ky) * dt;
      }
      const decay = Math.pow(0.02, dt);
      g.kx *= decay;
      g.ky *= decay;
      // Duke Grime is big: keep all of him on screen.
      const m = g.def.kind === 'boss' ? g.def.radius * 0.8 : 0;
      img.x = Phaser.Math.Clamp(img.x, a.left + m, a.right - m);
      img.y = Phaser.Math.Clamp(img.y, a.top + m, a.bottom - 10 - m);
    }

    // Keep germs from piling into one blob.
    for (let i = 0; i < this.germs.length; i++) {
      const g1 = this.germs[i];
      for (let j = i + 1; j < this.germs.length; j++) {
        const g2 = this.germs[j];
        const dx = g2.img.x - g1.img.x;
        const dy = g2.img.y - g1.img.y;
        const min = (g1.def.radius + g2.def.radius) * 0.85;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        const w1 = g1.def.kind === 'boss' ? 0.1 : g2.def.kind === 'boss' ? 1.9 : 1;
        const w2 = 2 - w1;
        g1.img.x -= (dx / d) * push * w1;
        g1.img.y -= (dy / d) * push * w1;
        g2.img.x += (dx / d) * push * w2;
        g2.img.y += (dy / d) * push * w2;
      }
    }

    for (const g of this.germs) {
      g.shadow.setPosition(g.img.x, g.img.y + g.def.radius * 0.95).setDepth(g.img.y - 1);
      g.shadow.setAlpha(g.img.alpha);
      g.img.setDepth(g.img.y + g.def.radius * 0.5);
    }
  }

  private spit(x: number, y: number, angle: number): void {
    const img = this.add.image(x, y, 'lp_slime').setDepth(1500);
    this.slimes.push({ img, vx: Math.cos(angle) * SLIME_SPEED, vy: Math.sin(angle) * SLIME_SPEED, life: 3500 });
    this.sfx.play('lpSpit');
  }

  private bossAttack(g: Germ, aim: number): void {
    const enraged = g.hp < g.maxHp / 2;
    const kind = g.attack % 3;
    g.attack++;
    if (kind === 0) {
      // A ring of slime.
      const n = enraged ? 20 : 14;
      const off = Math.random() * Math.PI;
      for (let i = 0; i < n; i++) this.spit(g.img.x, g.img.y, off + (i / n) * Math.PI * 2);
    } else if (kind === 1) {
      // An aimed fan.
      const n = enraged ? 7 : 5;
      for (let i = 0; i < n; i++) this.spit(g.img.x, g.img.y, aim + (i - (n - 1) / 2) * 0.18);
    } else if (this.germs.length < MAX_GERMS) {
      // Calls in some minions.
      const n = enraged ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        this.spawnGerm(i === 0 && enraged ? 'virus' : 'blob', { x: g.img.x + Math.cos(a) * 80, y: g.img.y + Math.sin(a) * 80 });
      }
      this.sfx.play('lpSpit');
    }
    g.nextAct = this.clock + (enraged ? 1600 : 2500);
  }

  private hurtGerm(g: Germ, dmg: number, angle: number, knock: number): void {
    if (g.hp <= 0) return;
    g.hp -= dmg;
    g.flashUntil = this.clock + 70;
    g.kx += Math.cos(angle) * knock;
    g.ky += Math.sin(angle) * knock;
    if (g.hp <= 0) this.killGerm(g);
    else this.sfx.play('lpHit');
  }

  private killGerm(g: Germ): void {
    const { x, y } = g.img;
    const kind = g.def.kind;
    this.germs = this.germs.filter((o) => o !== g);
    g.img.destroy();
    g.shadow.destroy();
    this.score += g.def.points;
    this.sfx.play('lpSquish');
    this.burst(x, y, GERM_COLOR[kind], kind === 'boss' ? 60 : 12, kind === 'boss' ? 160 : 55);
    this.floatText(x, y - g.def.radius, `+${g.def.points}`, '#f8e040');

    if (kind === 'splitter') {
      for (const s of [-1, 1]) {
        const m = this.spawnGerm('mini', { x: x + s * 14, y });
        m.kx = s * 260;
        m.ky = (Math.random() - 0.5) * 160;
      }
    }
    if (kind === 'boss') {
      this.boss = null;
      this.cameras.main.shake(400, 0.015);
      this.cameras.main.flash(250, 255, 255, 255);
      for (let i = 0; i < 3; i++) this.dropPickup('heart', x + (i - 1) * 40, y);
      this.dropPickup('sprinkle', x, y + 40);
      this.sfx.playMusic('lpBattle');
      return;
    }
    const r = Math.random();
    if (r < 0.07) this.dropPickup('heart', x, y);
    else if (r < 0.1) this.dropPickup('sprinkle', x, y);
  }

  // --- Projectiles and pickups -----------------------------------------------------

  private updateShots(dt: number): void {
    const a = this.arena();
    this.shots = this.shots.filter((s) => {
      s.img.x += s.vx * dt;
      s.img.y += s.vy * dt;
      s.img.angle += 720 * dt;
      s.life -= dt * 1000;
      const out = s.img.x < a.left - 30 || s.img.x > a.right + 30 || s.img.y < TOP_BAR || s.img.y > a.bottom + 40;
      let hit: Germ | null = null;
      if (!out && s.life > 0) {
        for (const g of this.germs) {
          if (g.spawnUntil > this.clock) continue;
          const r = g.def.radius + 6;
          const dx = g.img.x - s.img.x;
          const dy = g.img.y - s.img.y;
          if (dx * dx + dy * dy < r * r) {
            hit = g;
            break;
          }
        }
      }
      if (hit) {
        this.burst(s.img.x, s.img.y, 0xffffff, 3, 20);
        this.hurtGerm(hit, s.damage, Math.atan2(s.vy, s.vx), hit.def.kind === 'boss' ? 8 : 90);
      }
      if (hit || out || s.life <= 0) {
        s.img.destroy();
        return false;
      }
      return true;
    });
  }

  private updateSlimes(dt: number): void {
    const a = this.arena();
    this.slimes = this.slimes.filter((s) => {
      s.img.x += s.vx * dt;
      s.img.y += s.vy * dt;
      s.life -= dt * 1000;
      let hit = false;
      if (this.phase !== 'over') {
        for (const p of [this.hero, ...this.buddies]) {
          if (Phaser.Math.Distance.Between(p.img.x, p.img.y, s.img.x, s.img.y) < p.radius + 6) {
            this.hurtPop(p, 1);
            hit = true;
            break;
          }
        }
      }
      const out = s.img.x < a.left - 20 || s.img.x > a.right + 20 || s.img.y < TOP_BAR || s.img.y > a.bottom + 30;
      if (hit || out || s.life <= 0) {
        if (hit) this.burst(s.img.x, s.img.y, 0x70e050, 5, 26);
        s.img.destroy();
        return false;
      }
      return true;
    });
  }

  /** Germs bumping into lollipops. */
  private contacts(): void {
    if (this.phase === 'over') return;
    for (const g of this.germs) {
      if (g.spawnUntil > this.clock) continue;
      for (const p of [this.hero, ...this.buddies]) {
        const dx = g.img.x - p.img.x;
        const dy = g.img.y - p.img.y;
        const r = g.def.radius + p.radius * 0.85;
        if (dx * dx + dy * dy > r * r) continue;
        const ang = Math.atan2(dy, dx);
        if (p.hero && this.clock < this.spinUntil) {
          this.hurtGerm(g, 1, ang, 400);
        } else {
          this.hurtPop(p, g.def.bite);
          if (g.def.kind !== 'boss') {
            g.kx += Math.cos(ang) * 280;
            g.ky += Math.sin(ang) * 280;
          }
        }
        break;
      }
    }
  }

  private dropPickup(kind: Pickup['kind'], x: number, y: number): void {
    const a = this.arena();
    x = Phaser.Math.Clamp(x, a.left, a.right);
    y = Phaser.Math.Clamp(y, a.top, a.bottom - 20);
    const img = this.add.image(x, y, kind === 'heart' ? 'lp_heart' : 'lp_star').setDepth(y);
    this.tweens.add({ targets: img, y: y - 6, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (kind === 'sprinkle') this.tweens.add({ targets: img, angle: 360, duration: 2400, repeat: -1 });
    this.pickups.push({ img, kind, expires: this.clock + 9000 });
  }

  private updatePickups(): void {
    this.pickups = this.pickups.filter((pk) => {
      const left = pk.expires - this.clock;
      pk.img.setAlpha(left < 2000 && Math.floor(this.clock / 100) % 2 ? 0.3 : 1);
      const got = this.phase !== 'over' && Phaser.Math.Distance.Between(pk.img.x, pk.img.y, this.hero.img.x, this.hero.img.y) < 34;
      if (got) this.collect(pk);
      if (got || left <= 0) {
        pk.img.destroy();
        return false;
      }
      return true;
    });
  }

  private collect(pk: Pickup): void {
    this.sfx.play('lpPickup');
    this.burst(pk.img.x, pk.img.y, pk.kind === 'heart' ? 0xf85898 : 0xf8e040, 10, 40);
    if (pk.kind === 'sprinkle') {
      this.sprinkleUntil = this.clock + SPRINKLE_TIME;
      this.floatText(pk.img.x, pk.img.y - 20, 'SPRINKLE POWER!', '#f8e040');
      return;
    }
    // Hearts heal the hero, or the most battered buddy if the hero is fine.
    const hurt = [this.hero, ...this.buddies].filter((p) => p.hp < p.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    const who = this.hero.hp < this.hero.maxHp ? this.hero : hurt[0];
    if (who) who.hp++;
    this.floatText(pk.img.x, pk.img.y - 20, who ? '+1 HEART' : '+50', '#f85898');
    if (!who) this.score += 50;
  }

  // --- Waves -----------------------------------------------------------------------

  private startWave(i: number): void {
    this.wave = i;
    const def = WAVES[i];
    const queue: GermKind[] = [];
    for (const [kind, n] of Object.entries(def.germs) as [GermKind, number][]) for (let k = 0; k < n; k++) queue.push(kind);
    this.queue = Phaser.Utils.Array.Shuffle(queue);
    this.nextSpawn = this.clock + 1200;
    this.phase = 'fight';
    if (def.boss) {
      const { width: W } = this.scale;
      this.boss = this.spawnGerm('boss', { x: W / 2, y: this.arena().top + 60 }, def.boss.hp);
      this.boss.nextAct = this.clock + 2500;
      this.sfx.play('lpBoss');
      this.sfx.playMusic('lpBoss');
      this.banner(`WAVE ${i + 1}`, i === WAVES.length - 1 ? 'Duke Grime is back, and he is FURIOUS!' : 'Here comes DUKE GRIME!');
    } else {
      this.sfx.playMusic('lpBattle');
      this.banner(`WAVE ${i + 1}`, i === 0 ? 'Pop those germs!' : `${this.queue.length} germs incoming`);
    }
  }

  private updateWave(): void {
    if (this.phase === 'fight') {
      if (this.queue.length && this.clock >= this.nextSpawn && this.germs.length < MAX_GERMS) {
        this.spawnGerm(this.queue.shift()!);
        this.nextSpawn = this.clock + WAVES[this.wave].gap;
      }
      if (!this.queue.length && !this.germs.length) this.waveCleared();
    } else if (this.phase === 'break' && this.clock >= this.breakUntil) {
      this.startWave(this.wave + 1);
    }
  }

  private waveCleared(): void {
    this.score += 100 * (this.wave + 1);
    this.slimes.forEach((s) => s.img.destroy());
    this.slimes = [];
    if (this.wave === WAVES.length - 1) {
      this.victory();
      return;
    }
    this.sfx.play('lpWave');
    this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + 1);
    const joined = this.recruitBuddy();
    this.banner('WAVE CLEARED!', joined ? `${joined.name} joins the Legion!` : `+${100 * (this.wave + 1)} bonus`);
    this.phase = 'break';
    this.breakUntil = this.clock + 3200;
  }

  // --- Endings ---------------------------------------------------------------------

  private gameOver(): void {
    this.phase = 'over';
    this.sfx.stopMusic();
    this.sfx.play('lpLose');
    const { x, y } = this.hero.img;
    this.burst(x, y, this.flavor.color, 40, 110);
    this.hero.img.setVisible(false);
    this.hero.shadow.setVisible(false);
    this.cameras.main.shake(300, 0.012);
    this.time.delayedCall(1400, () => this.showEnd(false));
  }

  private victory(): void {
    this.phase = 'over';
    this.sfx.stopMusic();
    this.sfx.play('lpWin');
    const { width: W, height: H } = this.scale;
    const colors = [0xe83060, 0xf8d830, 0x9048d8, 0x30a0f0, 0x60d040, 0xfcfcfc];
    for (let i = 0; i < 8; i++) {
      this.time.delayedCall(i * 180, () => this.burst(Phaser.Math.Between(W * 0.2, W * 0.8), Phaser.Math.Between(H * 0.25, H * 0.7), colors[i % colors.length], 24, 120));
    }
    this.time.delayedCall(1600, () => this.showEnd(true));
  }

  private showEnd(won: boolean): void {
    const rec = LOLLIPOP_SAVE.load();
    const newBest = this.score > rec.best;
    rec.best = Math.max(rec.best, this.score);
    rec.bestWave = Math.max(rec.bestWave, won ? WAVES.length : this.wave + 1);
    if (won) rec.wins++;
    LOLLIPOP_SAVE.save(rec);

    const { width: W, height: H } = this.scale;
    const pw = Math.min(460, W - 32);
    const ph = 300;
    const depth = HUD_DEPTH + 10;
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45).setDepth(depth);
    this.add.rectangle(W / 2, H / 2, pw, ph, 0x301040, 0.95).setStrokeStyle(4, won ? 0xf8e040 : 0x4cc038).setDepth(depth);
    this.add
      .text(W / 2, H / 2 - 110, won ? 'SWEET VICTORY!' : 'THE GERMS WIN...', {
        fontFamily: FONT,
        fontSize: '30px',
        fontStyle: 'bold',
        color: won ? '#f8e040' : '#70e050',
        stroke: '#000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(depth);
    const lines = [
      won ? 'Duke Grime is squished for good!' : `You reached wave ${this.wave + 1} of ${WAVES.length}.`,
      `Score ${this.score}${newBest ? '   NEW BEST!' : `   Best ${rec.best}`}`,
    ];
    this.add
      .text(W / 2, H / 2 - 55, lines.join('\n'), { fontFamily: FONT, fontSize: '15px', color: '#ffffff', align: 'center', lineSpacing: 8 })
      .setOrigin(0.5)
      .setDepth(depth);

    const opts: [string, () => void][] = [
      ['Play again', () => this.scene.restart({ flavor: this.flavor.id } satisfies LollipopBattleInitData)],
      ['Change flavour', () => this.scene.start('LollipopMenu')],
      ['Arcade', () => this.scene.start('GameSelect')],
    ];
    const items = this.buttons(opts, H / 2 + 20, depth);
    // A short wait so a held fire button doesn't pick "Play again" by accident.
    this.time.delayedCall(700, () => new MenuNav(this, items, { depth: depth + 1 }));
  }

  private buttons(opts: [string, () => void][], top: number, depth: number): NavItem[] {
    const { width: W } = this.scale;
    return opts.map(([label, fn], i) => {
      const y = top + i * 42;
      const bg = this.add.rectangle(W / 2, y, 220, 34, 0xe83060, 0.25).setStrokeStyle(2, 0xf85898).setDepth(depth);
      const t = this.add.text(W / 2, y, label, { fontFamily: FONT, fontSize: '16px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(depth);
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.sfx.play('uiClick');
        fn();
      });
      this.pauseLayer.push(bg, t);
      return {
        x: W / 2,
        y,
        w: 220,
        h: 34,
        activate: () => {
          this.sfx.play('uiClick');
          fn();
        },
        onFocus: (on: boolean) => bg.setFillStyle(0xe83060, on ? 0.6 : 0.25),
        hover: bg,
      };
    });
  }

  private togglePause(): void {
    if (this.phase === 'over') return;
    if (this.paused) {
      this.paused = false;
      this.tweens.resumeAll();
      this.pauseNav?.destroy();
      this.pauseNav = null;
      this.pauseLayer.forEach((o) => o.destroy());
      this.pauseLayer = [];
      return;
    }
    this.paused = true;
    this.tweens.pauseAll();
    const { width: W, height: H } = this.scale;
    const depth = HUD_DEPTH + 10;
    this.pauseLayer.push(
      this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.5).setDepth(depth),
      this.add
        .text(W / 2, H / 2 - 80, 'PAUSED', { fontFamily: FONT, fontSize: '36px', fontStyle: 'bold', color: '#ffffff', stroke: INK, strokeThickness: 8 })
        .setOrigin(0.5)
        .setDepth(depth),
    );
    const items = this.buttons(
      [
        ['Resume', () => this.togglePause()],
        ['Quit to menu', () => this.scene.start('LollipopMenu')],
      ],
      H / 2 - 10,
      depth,
    );
    this.pauseNav = new MenuNav(this, items, { depth: depth + 1 });
  }

  // --- Effects ---------------------------------------------------------------------

  private burst(x: number, y: number, color: number, n: number, dist: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = dist * (0.4 + Math.random() * 0.6);
      const dot = this.add
        .image(x, y, 'lp_dot')
        .setTint(color)
        .setScale(0.4 + Math.random() * 0.6)
        .setDepth(1800);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d,
        alpha: 0,
        scale: 0.1,
        duration: 320 + Math.random() * 260,
        ease: 'Quad.easeOut',
        onComplete: () => dot.destroy(),
      });
    }
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    const t = this.add
      .text(x, y, text, { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color, stroke: INK, strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(1900);
    this.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: 800, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  private banner(title: string, sub: string): void {
    // A new banner replaces any that's still showing.
    this.bannerObjs.forEach((o) => {
      this.tweens.killTweensOf(o);
      o.destroy();
    });
    const { width: W, height: H } = this.scale;
    const size = Math.round(Math.min(56, W / 11));
    const t = this.add
      .text(W / 2, H * 0.36, title, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color: '#ffffff', stroke: '#e83060', strokeThickness: 10 })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH - 1)
      .setScale(0.3);
    const s = this.add
      .text(W / 2, H * 0.36 + size * 0.85, sub, { fontFamily: FONT, fontSize: '17px', color: '#ffffff', stroke: INK, strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH - 1)
      .setAlpha(0);
    this.bannerObjs = [t, s];
    this.tweens.add({ targets: t, scale: 1, duration: 350, ease: 'Back.easeOut' });
    this.tweens.add({ targets: s, alpha: 1, duration: 300, delay: 150 });
    this.tweens.add({ targets: [t, s], alpha: 0, delay: 1900, duration: 400, onComplete: () => {
        t.destroy();
        s.destroy();
      },
    });
  }

  // --- HUD -------------------------------------------------------------------------

  private buildHud(): void {
    const style = { fontFamily: FONT, color: '#ffffff', stroke: INK, strokeThickness: 4 };
    this.topBar = this.add.rectangle(0, 0, 10, TOP_BAR, 0x301040, 0.6).setOrigin(0).setDepth(HUD_DEPTH);
    for (let i = 0; i < this.hero.maxHp; i++) this.hearts.push(this.add.image(24 + i * 26, 18, 'lp_heart').setScale(0.8).setDepth(HUD_DEPTH));
    this.hud = this.add.graphics().setDepth(HUD_DEPTH);
    this.spinText = this.add.text(12, 38, 'SPIN', { ...style, fontSize: '11px', fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(HUD_DEPTH);
    this.waveText = this.add.text(0, TOP_BAR / 2, '', { ...style, fontSize: '20px', fontStyle: 'bold' }).setOrigin(0.5).setDepth(HUD_DEPTH);
    this.scoreText = this.add.text(0, TOP_BAR / 2, '', { ...style, fontSize: '20px', fontStyle: 'bold', color: '#f8e040' }).setOrigin(1, 0.5).setDepth(HUD_DEPTH);
    this.bossText = this.add
      .text(0, 0, 'DUKE GRIME', { ...style, fontSize: '13px', fontStyle: 'bold', color: '#70e050' })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH)
      .setVisible(false);
    this.hintText = this.add
      .text(0, 0, 'WASD / arrows move   Space or click: fire   Shift or right-click: sugar spin   Esc pause   M mute', {
        ...style,
        fontSize: '12px',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(HUD_DEPTH);
    this.tweens.add({ targets: this.hintText, alpha: 0, delay: 9000, duration: 1000 });
  }

  private layout(): void {
    const { width: W, height: H } = this.scale;
    this.floor.setSize(W, H);
    this.topBar.setSize(W, TOP_BAR);
    this.waveText.setX(W / 2);
    this.scoreText.setX(W - 16);
    this.bossText.setPosition(W / 2, H - 40);
    this.hintText.setPosition(W / 2, H - 6).setWordWrapWidth(W - 20);
  }

  private drawHud(): void {
    const { width: W, height: H } = this.scale;
    this.hearts.forEach((h, i) => {
      const full = i < this.hero.hp;
      h.setAlpha(full ? 1 : 0.25);
      if (full) h.clearTint();
      else h.setTint(0x505050);
    });
    this.waveText.setText(`WAVE ${this.wave + 1} / ${WAVES.length}`);
    this.scoreText.setText(`${this.score}`);

    const g = this.hud;
    g.clear();
    // Sugar spin cooldown.
    const ready = this.clock >= this.spinReadyAt;
    const frac = ready ? 1 : 1 - (this.spinReadyAt - this.clock) / SPIN_COOLDOWN;
    g.fillStyle(0x000000, 0.5).fillRoundedRect(46, 33, 110, 10, 4);
    g.fillStyle(ready ? 0xf8e040 : this.flavor.color, 1).fillRoundedRect(46, 33, Math.max(4, 110 * frac), 10, 4);
    this.spinText.setColor(ready && Math.floor(this.clock / 300) % 2 ? '#f8e040' : '#ffffff');
    // Sprinkle timer.
    if (this.clock < this.sprinkleUntil) {
      const left = (this.sprinkleUntil - this.clock) / SPRINKLE_TIME;
      g.fillStyle(0xf8e040, 1).fillRoundedRect(166, 33, 60 * left, 10, 4);
    }
    // Buddies' health pips.
    for (const b of this.buddies) {
      for (let i = 0; i < b.maxHp; i++) {
        g.fillStyle(i < b.hp ? 0xf85898 : 0x404040, 1).fillCircle(b.img.x - (b.maxHp - 1) * 4 + i * 8, b.img.y - 26, 3);
      }
    }
    // Boss health.
    const boss = this.boss;
    this.bossText.setVisible(!!boss);
    if (boss) {
      const bw = Math.min(420, W - 60);
      g.fillStyle(0x000000, 0.6).fillRoundedRect(W / 2 - bw / 2 - 3, H - 30, bw + 6, 16, 6);
      g.fillStyle(boss.hp < boss.maxHp / 2 ? 0xe83030 : 0x4cc038, 1).fillRoundedRect(W / 2 - bw / 2, H - 27, Math.max(0, bw * (boss.hp / boss.maxHp)), 10, 4);
    }
  }
}
