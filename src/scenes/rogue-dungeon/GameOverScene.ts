import Phaser from 'phaser';
import { SoundManager } from '../../game/shared/Sound';

export interface GameOverData {
  victory: boolean;
  floor: number;
  gold: number;
}

export class GameOverScene extends Phaser.Scene {
  private resultData!: GameOverData;

  constructor() {
    super('GameOver');
  }

  init(data: GameOverData): void {
    this.resultData = data;
  }

  create(): void {
    const sound = new SoundManager(this);
    sound.playMusic(this.resultData.victory ? 'victory' : 'gameover');
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0b0b12);

    this.add
      .text(width / 2, height * 0.32, this.resultData.victory ? 'VICTORY' : 'YOU DIED', {
        fontFamily: 'monospace',
        fontSize: '30px',
        color: this.resultData.victory ? '#f4d35c' : '#d85858',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const summary = this.resultData.victory
      ? `You cleared the dungeon with ${this.resultData.gold} gold.`
      : `You fell on floor ${this.resultData.floor} with ${this.resultData.gold} gold.`;
    this.add
      .text(width / 2, height * 0.48, summary, { fontFamily: 'monospace', fontSize: '13px', color: '#c9cdd6' })
      .setOrigin(0.5);

    const btn = this.add.image(width / 2, height * 0.66, 'button').setInteractive({ useHandCursor: true }).setScale(3, 2);
    this.add
      .text(width / 2, height * 0.66, 'RESTART', { fontFamily: 'monospace', fontSize: '15px', color: '#2a2320' })
      .setOrigin(0.5);
    btn.on('pointerdown', () => {
      sound.play('uiClick');
      this.scene.start('Menu');
    });
    this.input.keyboard!.once('keydown-SPACE', () => this.scene.start('Menu'));
    this.input.keyboard!.once('keydown-ENTER', () => this.scene.start('Menu'));
  }
}
