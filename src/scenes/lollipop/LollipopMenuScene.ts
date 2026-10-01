import Phaser from 'phaser';
import { FLAVORS } from '../../game/lollipop/config';
import { POP_HEAD_Y, POP_H, buildLollipopTextures } from '../../game/lollipop/textures';
import { MenuNav, type NavItem } from '../../game/shared/MenuNav';
import { MENU_PROFILE, setPadProfile } from '../../game/shared/Pad';
import { SaveData } from '../../game/shared/SaveData';
import { SoundManager, loadMuted } from '../../game/shared/Sound';
import type { LollipopBattleInitData } from './LollipopBattleScene';

export interface LollipopRecord {
  best: number;
  bestWave: number;
  wins: number;
}

export const LOLLIPOP_SAVE = new SaveData<LollipopRecord>('lollipop-legion', { best: 0, bestWave: 0, wins: 0 });

/** Remembered between visits so the cursor starts on your last flavour. */
let lastPick = 0;

export class LollipopMenuScene extends Phaser.Scene {
  private sfx!: SoundManager;
  private pops: Phaser.GameObjects.Image[] = [];
  private focused = 0;

  constructor() {
    super('LollipopMenu');
  }

  create(): void {
    buildLollipopTextures(this);
    this.sfx = new SoundManager(this);
    this.sound.mute = loadMuted();
    this.sfx.playMusic('lpMenu');
    setPadProfile(this, { ...MENU_PROFILE, hint: 'D-pad choose   A play   B back' });
    this.pops = [];
    this.focused = lastPick;

    const { width: W, height: H } = this.scale;
    this.add.tileSprite(0, 0, W, H, 'lp_floor').setOrigin(0);
    this.add.rectangle(W / 2, H / 2, W, H, 0x301040, 0.35);

    const titleSize = Math.round(Math.min(60, W / 13));
    this.add
      .text(W / 2, H * 0.1, 'LOLLIPOP LEGION', {
        fontFamily: 'monospace',
        fontSize: `${titleSize}px`,
        color: '#fcfcfc',
        fontStyle: 'bold',
        stroke: '#e83060',
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setShadow(4, 4, '#301040', 0, true, true);
    this.add
      .text(W / 2, H * 0.1 + titleSize * 0.85, 'The germs are coming! Pick your flavour.', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#fcfcfc',
        stroke: '#301040',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    const back = this.add
      .text(16, 14, '< Games', { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff', stroke: '#301040', strokeThickness: 4 })
      .setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.goBack());

    // Flavour cards: a row of four, or two rows of two on a narrow screen.
    const cols = W < 680 ? 2 : 4;
    const rows = Math.ceil(FLAVORS.length / cols);
    const gap = 14;
    const cw = Math.min(220, (W - 32) / cols - gap);
    const top = H * 0.1 + titleSize * 0.85 + 30;
    const ch = Math.min(320, (H - top - 70) / rows - gap);
    const items: NavItem[] = FLAVORS.map((_, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = W / 2 + (col - (cols - 1) / 2) * (cw + gap);
      const y = top + ch / 2 + row * (ch + gap);
      return this.buildCard(i, x, y, cw, ch);
    });

    const rec = LOLLIPOP_SAVE.load();
    const record = rec.best
      ? `Best score ${rec.best}   Furthest wave ${rec.bestWave}/10${rec.wins ? `   Victories ${rec.wins}` : ''}`
      : 'Clear 10 waves of germs and defeat Duke Grime!';
    this.add
      .text(W / 2, H - 44, record, { fontFamily: 'monospace', fontSize: '13px', color: '#f8e040', stroke: '#301040', strokeThickness: 4 })
      .setOrigin(0.5);
    this.add
      .text(W / 2, H - 20, 'Arrows choose, Enter / Space (pad: A) to play, Esc (pad: B) back', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffffff',
        stroke: '#301040',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    new MenuNav(this, items, {
      initial: lastPick,
      box: false,
      onMove: (i) => {
        lastPick = i;
        this.focused = i;
        this.sfx.play('kartItemTick');
      },
    });
    this.input.keyboard!.on('keydown-ESC', () => this.goBack());
  }

  update(time: number): void {
    // The focused lollipop bounces and wiggles; the rest sway gently.
    this.pops.forEach((p, i) => {
      const on = i === this.focused;
      p.y = p.getData('baseY') + (on ? -Math.abs(Math.sin(time / 180)) * 14 : Math.sin(time / 600 + i) * 3);
      p.angle = on ? Math.sin(time / 120) * 10 : Math.sin(time / 900 + i) * 4;
    });
  }

  private buildCard(i: number, x: number, y: number, w: number, h: number): NavItem {
    const f = FLAVORS[i];
    const bg = this.add.rectangle(x, y, w, h, 0x301040, 0.55).setStrokeStyle(3, f.color, 0.9);
    const pop = this.add.image(x, y - h / 2 + 18 + POP_HEAD_Y, `lp_pop_${f.id}`).setOrigin(0.5, POP_HEAD_Y / POP_H);
    const scale = Math.min(1.3, (h * 0.42) / POP_H);
    pop.setScale(scale).setData('baseY', y - h / 2 + 14 + POP_HEAD_Y * scale);
    this.pops.push(pop);

    const style = { fontFamily: 'monospace', color: '#ffffff', stroke: '#301040', strokeThickness: 3 };
    const nameY = y - h / 2 + h * 0.5;
    const hex = `#${f.color.toString(16).padStart(6, '0')}`;
    this.add.text(x, nameY, f.name, { ...style, fontSize: '17px', fontStyle: 'bold', color: hex, strokeThickness: 5 }).setOrigin(0.5);
    const blurb = this.add
      .text(x, nameY + 16, f.blurb, { ...style, fontSize: '11px', align: 'center', wordWrap: { width: w - 18 } })
      .setOrigin(0.5, 0);

    const bars: [string, number][] = [
      ['SPEED', f.bars.speed],
      ['HEALTH', f.bars.health],
      ['POWER', f.bars.power],
    ];
    const g = this.add.graphics();
    const barTop = Math.max(nameY + 22 + blurb.height, y + h / 2 - 66);
    const segW = (w - 96) / 5;
    bars.forEach(([label, val], j) => {
      const by = barTop + j * 18;
      this.add.text(x - w / 2 + 10, by, label, { ...style, fontSize: '10px' }).setOrigin(0, 0.5);
      for (let b = 0; b < 5; b++) g.fillStyle(b < val ? f.color : 0x504060, 1).fillRoundedRect(x - w / 2 + 70 + b * segW, by - 5, segW - 3, 10, 3);
    });

    const hit = this.add.rectangle(x, y, w, h, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.start(i));
    return {
      x,
      y,
      w,
      h,
      activate: () => this.start(i),
      onFocus: (on) => {
        bg.setStrokeStyle(on ? 5 : 3, on ? 0xffffff : f.color, 1);
        bg.setFillStyle(0x301040, on ? 0.8 : 0.55);
      },
      hover: hit,
    };
  }

  private start(i: number): void {
    lastPick = i;
    this.sfx.play('uiClick');
    const data: LollipopBattleInitData = { flavor: FLAVORS[i].id };
    this.scene.start('LollipopBattle', data);
  }

  private goBack(): void {
    this.sfx.play('uiClick');
    this.scene.start('GameSelect');
  }
}
