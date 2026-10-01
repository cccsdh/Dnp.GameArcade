import Phaser from 'phaser';
import { generatePebbleTextures } from '../../game/pebble-quest/Sprites';
import { PQ_TILE } from '../../game/pebble-quest/config';
import { SoundManager } from '../../game/shared/Sound';

export class PebblePreloadScene extends Phaser.Scene {
  constructor() {
    super('PebblePreload');
  }

  preload(): void {
    SoundManager.preload(this, { music: false });
  }

  create(): void {
    generatePebbleTextures(this, PQ_TILE);
    this.scene.start('PebbleMap');
  }
}
