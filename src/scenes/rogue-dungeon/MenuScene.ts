import Phaser from 'phaser';
import type { HeroId } from '../../config';
import { HERO_IDS } from '../../config';
import { SoundManager } from '../../game/shared/Sound';

const HERO_NAMES: Record<HeroId, string> = { '1': 'Ranger', '2': 'Knight', '3': 'Mage' };

export class MenuScene extends Phaser.Scene {
  private selectedHero: HeroId = '1';
  private sfx!: SoundManager;
  private heroPreview!: Phaser.GameObjects.Sprite;
  private heroLabel!: Phaser.GameObjects.Text;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.started = false;
    this.sfx = new SoundManager(this);
    this.sfx.playMusic('rogueMenu');
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x11121c);
    this.add.image(width / 2, height * 0.22, 'logo').setScale(2);

    const backBtn = this.add
      .text(16, 16, '< Games', { fontFamily: 'monospace', fontSize: '13px', color: '#8d98ad' })
      .setInteractive({ useHandCursor: true });
    backBtn.on('pointerover', () => backBtn.setColor('#e7e2d3'));
    backBtn.on('pointerout', () => backBtn.setColor('#8d98ad'));
    backBtn.on('pointerdown', () => {
      this.sfx.play('uiClick');
      this.scene.start('GameSelect');
    });
    this.input.keyboard!.once('keydown-ESC', () => this.scene.start('GameSelect'));

    this.add
      .text(width / 2, height * 0.4, 'ROGUE DUNGEON', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#e7e2d3',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.heroPreview = this.add.sprite(width / 2, height * 0.56, 'hero1_D_Idle').setScale(3);
    this.heroLabel = this.add
      .text(width / 2, height * 0.56 + 46, '', { fontFamily: 'monospace', fontSize: '14px', color: '#c9cdd6' })
      .setOrigin(0.5);

    const leftArrow = this.add
      .text(width / 2 - 90, height * 0.56, '<', { fontFamily: 'monospace', fontSize: '26px', color: '#8d98ad' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const rightArrow = this.add
      .text(width / 2 + 90, height * 0.56, '>', { fontFamily: 'monospace', fontSize: '26px', color: '#8d98ad' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    leftArrow.on('pointerdown', () => this.cycleHero(-1));
    rightArrow.on('pointerdown', () => this.cycleHero(1));

    this.updateHeroPreview();

    const startBtn = this.add.image(width / 2, height * 0.76, 'button').setInteractive({ useHandCursor: true }).setScale(3, 2);
    this.add
      .text(width / 2, height * 0.76, 'START', { fontFamily: 'monospace', fontSize: '16px', color: '#2a2320' })
      .setOrigin(0.5);
    startBtn.on('pointerover', () => this.sfx.play('uiHover'));
    startBtn.on('pointerdown', () => this.startGame());

    this.add
      .text(width / 2, height * 0.88, 'WASD/Arrows move   SPACE attack   Q potion      Pad: A attack   B potion', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#767e94',
      })
      .setOrigin(0.5);

    // Keyboard / controller: Left / Right pick a hero, Space / Enter (A / Start) starts.
    const kb = this.input.keyboard!;
    kb.on('keydown-LEFT', () => this.cycleHero(-1));
    kb.on('keydown-RIGHT', () => this.cycleHero(1));
    kb.once('keydown-SPACE', () => this.startGame());
    kb.once('keydown-ENTER', () => this.startGame());
  }

  private cycleHero(delta: number): void {
    const idx = HERO_IDS.indexOf(this.selectedHero);
    const next = (idx + delta + HERO_IDS.length) % HERO_IDS.length;
    this.selectedHero = HERO_IDS[next];
    this.sfx.play('uiClick');
    this.updateHeroPreview();
  }

  private updateHeroPreview(): void {
    this.heroPreview.setTexture(`hero${this.selectedHero}_D_Idle`);
    this.heroPreview.play(`hero${this.selectedHero}-idle-down`);
    this.heroLabel.setText(HERO_NAMES[this.selectedHero]);
  }

  private started = false;

  private startGame(): void {
    if (this.started) return;
    this.started = true;
    this.sfx.play('uiClick');
    this.scene.start('Dungeon', {
      heroId: this.selectedHero,
      floor: 1,
      carryStats: null,
    });
  }
}
