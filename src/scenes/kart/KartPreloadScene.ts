import Phaser from 'phaser';
import { generateKartTextures } from '../../game/kart/sprites';
import { SoundManager } from '../../game/shared/Sound';

export class KartPreloadScene extends Phaser.Scene {
  constructor() {
    super('KartPreload');
  }

  preload(): void {
    // The CC0 impact clips (kart bumps and crashes); everything else is synthesized.
    SoundManager.preload(this, { music: false });
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, 'Building karts...', { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' })
      .setOrigin(0.5);
  }

  create(): void {
    // Let the loading text paint before the (brief) sprite rendering blocks the frame.
    this.time.delayedCall(30, () => {
      generateKartTextures(this);
      this.scene.start('KartMenu');
    });
  }
}
