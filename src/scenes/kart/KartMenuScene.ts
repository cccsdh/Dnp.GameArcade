import Phaser from 'phaser';
import { VEHICLES } from '../../game/kart/config';
import { KART_FRAMES } from '../../game/kart/sprites';
import { TRACKS, getTrack } from '../../game/kart/tracks';
import { SoundManager, loadMuted } from '../../game/shared/Sound';
import type { KartRaceInitData } from './KartRaceScene';

/** Remembered between visits so "Karts & Tracks" returns to your last picks. */
let lastVehicle = 0;
let lastTrack = 0;

type Step = 'vehicle' | 'track';

export class KartMenuScene extends Phaser.Scene {
  private sfx!: SoundManager;
  private step: Step = 'vehicle';
  private vehicleIdx = 0;
  private trackIdx = 0;
  private layer!: Phaser.GameObjects.Container;
  private spinners: Phaser.GameObjects.Image[] = [];
  private cards: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super('KartMenu');
  }

  create(): void {
    this.sfx = new SoundManager(this);
    this.sfx.playMusic('kartMenu');
    this.sound.mute = loadMuted();
    this.vehicleIdx = lastVehicle;
    this.trackIdx = lastTrack;
    this.step = 'vehicle';

    const { width: W, height: H } = this.scale;
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1830a0, 0x1830a0, 0xf87838, 0xf87838, 1);
    bg.fillRect(0, 0, W, H);
    // Checkered flag stripe.
    for (let x = 0; x < W; x += 20) {
      for (let r = 0; r < 2; r++) {
        bg.fillStyle((x / 20 + r) % 2 ? 0x000000 : 0xffffff, 1).fillRect(x, H * 0.16 + r * 20, 20, 20);
      }
    }
    this.add
      .text(W / 2, H * 0.08, 'TURBO KART', {
        fontFamily: 'monospace',
        fontSize: `${Math.round(Math.min(56, W / 14))}px`,
        color: '#f8d800',
        fontStyle: 'bold italic',
        stroke: '#000000',
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    const back = this.add
      .text(16, 14, '< Games', { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff', stroke: '#000', strokeThickness: 3 })
      .setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.goBack());

    this.layer = this.add.container(0, 0);
    this.buildStep();

    const kb = this.input.keyboard!;
    kb.on('keydown-LEFT', () => this.move(-1));
    kb.on('keydown-A', () => this.move(-1));
    kb.on('keydown-RIGHT', () => this.move(1));
    kb.on('keydown-D', () => this.move(1));
    kb.on('keydown-ENTER', () => this.confirm());
    kb.on('keydown-SPACE', () => this.confirm());
    kb.on('keydown-ESC', () => this.goBack());
  }

  update(time: number): void {
    const frame = Math.floor(time / 110) % KART_FRAMES;
    this.spinners.forEach((s, i) => s.setFrame(i === this.vehicleIdx ? frame : 2));
  }

  private goBack(): void {
    this.sfx.play('uiClick');
    if (this.step === 'track') {
      this.step = 'vehicle';
      this.buildStep();
    } else {
      this.scene.start('GameSelect');
    }
  }

  private move(d: number): void {
    const n = this.step === 'vehicle' ? VEHICLES.length : TRACKS.length;
    if (this.step === 'vehicle') this.vehicleIdx = (this.vehicleIdx + d + n) % n;
    else this.trackIdx = (this.trackIdx + d + n) % n;
    this.sfx.play('kartItemTick');
    this.highlight();
  }

  private confirm(): void {
    this.sfx.play('uiClick');
    if (this.step === 'vehicle') {
      lastVehicle = this.vehicleIdx;
      this.step = 'track';
      this.buildStep();
      return;
    }
    lastTrack = this.trackIdx;
    const data: KartRaceInitData = { vehicleId: VEHICLES[this.vehicleIdx].id, trackId: TRACKS[this.trackIdx].id };
    this.scene.start('KartRace', data);
  }

  private highlight(): void {
    const sel = this.step === 'vehicle' ? this.vehicleIdx : this.trackIdx;
    this.cards.forEach((c, i) => {
      c.setStrokeStyle(i === sel ? 5 : 2, i === sel ? 0xf8d800 : 0xffffff, i === sel ? 1 : 0.5);
      c.setFillStyle(0x000000, i === sel ? 0.55 : 0.35);
    });
  }

  private buildStep(): void {
    this.layer.removeAll(true);
    this.spinners = [];
    this.cards = [];
    const { width: W, height: H } = this.scale;
    const heading = this.step === 'vehicle' ? 'CHOOSE YOUR RACER' : 'CHOOSE A TRACK';
    this.layer.add(
      this.add
        .text(W / 2, H * 0.28, heading, { fontFamily: 'monospace', fontSize: '22px', color: '#ffffff', fontStyle: 'bold', stroke: '#000', strokeThickness: 5 })
        .setOrigin(0.5),
    );
    const hint =
      this.step === 'vehicle'
        ? 'Left/Right to choose, Enter (pad: A) to pick.  You race two rivals: a sharp one and a clumsy one.'
        : 'Left/Right to choose, Enter (pad: A) to race.  Esc (pad: B) to go back.';
    this.layer.add(
      this.add.text(W / 2, H - 22, hint, { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5),
    );

    if (this.step === 'vehicle') this.buildVehicles(W, H);
    else this.buildTracks(W, H);
    this.highlight();
  }

  private card(x: number, y: number, w: number, h: number, index: number): void {
    const c = this.add.rectangle(x, y, w, h, 0x000000, 0.35).setStrokeStyle(2, 0xffffff, 0.5).setInteractive({ useHandCursor: true });
    c.on('pointerover', () => {
      if (this.step === 'vehicle') this.vehicleIdx = index;
      else this.trackIdx = index;
      this.highlight();
    });
    c.on('pointerdown', () => this.confirm());
    this.cards.push(c);
    this.layer.add(c);
  }

  private buildVehicles(W: number, H: number): void {
    const n = VEHICLES.length;
    const cw = Math.min(250, (W - 40) / n - 14);
    const ch = Math.min(400, H * 0.6);
    const y = H * 0.33 + ch / 2;
    VEHICLES.forEach((v, i) => {
      const x = W / 2 + (i - (n - 1) / 2) * (cw + 14);
      this.card(x, y, cw, ch, i);
      const img = this.add.image(x, y - ch * 0.22, `kartbig_${v.id}`, 2).setScale(Math.min(1, cw / 210));
      this.spinners.push(img);
      const style = { fontFamily: 'monospace', color: '#ffffff', stroke: '#000', strokeThickness: 3 };
      this.layer.add([
        img,
        this.add.text(x, y + ch * 0.02, v.name, { ...style, fontSize: '17px', fontStyle: 'bold', color: '#f8d800' }).setOrigin(0.5),
        this.add.text(x, y + ch * 0.02 + 22, v.driverName, { ...style, fontSize: '12px' }).setOrigin(0.5),
        this.add
          .text(x, y + ch * 0.02 + 42, v.blurb, { ...style, fontSize: '11px', align: 'center', wordWrap: { width: cw - 20 } })
          .setOrigin(0.5, 0),
      ]);
      const bars: [string, number][] = [
        ['SPEED', v.bars.speed],
        ['ACCEL', v.bars.accel],
        ['HANDLING', v.bars.handling],
        ['WEIGHT', v.bars.weight],
      ];
      const g = this.add.graphics();
      bars.forEach(([label, val], j) => {
        const by = y + ch * 0.26 + j * 20;
        this.layer.add(this.add.text(x - cw / 2 + 12, by, label, { ...style, fontSize: '10px' }).setOrigin(0, 0.5));
        for (let b = 0; b < 5; b++) {
          g.fillStyle(b < val ? 0xf8d800 : 0x404040, 1).fillRect(x - cw / 2 + 86 + b * ((cw - 100) / 5), by - 5, (cw - 100) / 5 - 3, 10);
        }
      });
      this.layer.add(g);
    });
  }

  private buildTracks(W: number, H: number): void {
    const n = TRACKS.length;
    const cw = Math.min(300, (W - 40) / n - 16);
    const ch = Math.min(400, H * 0.6);
    const y = H * 0.33 + ch / 2;
    TRACKS.forEach((def, i) => {
      const x = W / 2 + (i - (n - 1) / 2) * (cw + 16);
      this.card(x, y, cw, ch, i);
      const t = getTrack(def);
      const key = `kthumb_${def.id}`;
      if (!this.textures.exists(key)) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 256;
        const c = cv.getContext('2d')!;
        c.drawImage(t.texture, 0, 0, 256, 256);
        this.textures.addCanvas(key, cv);
      }
      const size = Math.min(cw - 24, ch * 0.55);
      const style = { fontFamily: 'monospace', color: '#ffffff', stroke: '#000', strokeThickness: 3 };
      this.layer.add([
        this.add.image(x, y - ch * 0.18, key).setDisplaySize(size, size),
        this.add.text(x, y + ch * 0.16, def.name, { ...style, fontSize: '18px', fontStyle: 'bold', color: '#f8d800' }).setOrigin(0.5),
        this.add.text(x, y + ch * 0.16 + 26, def.blurb, { ...style, fontSize: '11px', align: 'center', wordWrap: { width: cw - 20 } }).setOrigin(0.5, 0),
        this.add.text(x, y + ch * 0.42, `${Math.round(t.length / 10)} m lap  -  3 laps`, { ...style, fontSize: '11px' }).setOrigin(0.5),
      ]);
    });
    const v = VEHICLES[this.vehicleIdx];
    this.layer.add(
      this.add
        .text(W / 2, H * 0.28 + 26, `Racing as ${v.driverName} in the ${v.name}`, { fontFamily: 'monospace', fontSize: '13px', color: '#ffffff', stroke: '#000', strokeThickness: 3 })
        .setOrigin(0.5),
    );
  }
}
