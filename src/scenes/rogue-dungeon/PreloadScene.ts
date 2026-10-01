import Phaser from 'phaser';
import { HERO_IDS, ENEMY_IDS } from '../../config';
import { preloadActorSheets, createActorAnimations } from '../../game/rogue-dungeon/anim/actorAnims';
import { createPropAnimations } from '../../game/rogue-dungeon/anim/propAnims';
import { SoundManager } from '../../game/shared/Sound';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    this.drawLoadingUI();

    for (const id of HERO_IDS) preloadActorSheets(this, `hero${id}`, `assets/characters/hero${id}`);
    for (const id of ENEMY_IDS) preloadActorSheets(this, `enemy${id}`, `assets/enemies/e${id}`);

    this.load.spritesheet('fx_D_Blood', 'assets/characters/fx/D_Blood.png', { frameWidth: 32, frameHeight: 32 });
    this.load.image('fx_Shadow', 'assets/characters/fx/Shadow.png');

    this.load.image('tileset', 'assets/tiles/Tileset.png');

    this.load.spritesheet('obj_Fire1', 'assets/objects/anim/Fire1.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('obj_Spikes', 'assets/objects/anim/Spikes.png', { frameWidth: 17, frameHeight: 17 });
    this.load.spritesheet('obj_Door_D', 'assets/objects/anim/Door_D.png', { frameWidth: 20, frameHeight: 20 });
    this.load.spritesheet('obj_BigDoor_D', 'assets/objects/anim/BigDoor_D.png', { frameWidth: 36, frameHeight: 36 });
    this.load.spritesheet('obj_Chest1_D', 'assets/objects/anim/Chest1_D.png', { frameWidth: 16, frameHeight: 24 });
    this.load.spritesheet('obj_Chest2_D', 'assets/objects/anim/Chest2_D.png', { frameWidth: 16, frameHeight: 24 });
    this.load.image('obj_Trapdoor_raw', 'assets/objects/anim/Trapdoor_D.png');

    for (const name of ['Box1', 'Box2', 'Box3', 'Table1', 'Table2', 'Chair1', 'Chair2', 'Bookshelf1', 'Bookshelf2', 'Torch1', 'Torch2', 'Rubble1', 'Rubble2']) {
      this.load.image(`decor_${name}`, `assets/objects/decor/${name}.png`);
    }

    this.load.image('icon_gold', 'assets/gui/icons/Icon_09.png');
    this.load.image('icon_potion', 'assets/gui/icons/Icon_50.png');
    this.load.image('icon_heart', 'assets/gui/icons/Icon_41.png');
    this.load.image('icon_potion_hud', 'assets/gui/icons/Icon_50.png');
    this.load.image('icon_skull', 'assets/gui/icons/Icon_08.png');

    this.load.image('bar_left', 'assets/gui/bars/BarTile_01.png');
    this.load.image('bar_mid', 'assets/gui/bars/BarTile_02.png');
    this.load.image('bar_right', 'assets/gui/bars/BarTile_03.png');
    this.load.image('bar_bg_left', 'assets/gui/bars/BarTile_10.png');
    this.load.image('bar_bg_mid', 'assets/gui/bars/BarTile_11.png');
    this.load.image('bar_bg_right', 'assets/gui/bars/BarTile_12.png');

    this.load.image('button', 'assets/gui/buttons/Button2.png');
    this.load.image('logo', 'assets/gui/logo.png');

    SoundManager.preload(this);
  }

  create(): void {
    for (const id of HERO_IDS) createActorAnimations(this, `hero${id}`);
    for (const id of ENEMY_IDS) createActorAnimations(this, `enemy${id}`);

    if (!this.anims.exists('fx-blood')) {
      this.anims.create({
        key: 'fx-blood',
        frames: this.anims.generateFrameNumbers('fx_D_Blood', {}),
        frameRate: 14,
        repeat: 0,
      });
    }

    createPropAnimations(this);

    if (!this.textures.exists('obj_Trapdoor')) {
      const raw = this.textures.get('obj_Trapdoor_raw');
      const src = raw.getSourceImage() as HTMLImageElement;
      const w = src.height; // square frame; crop from the sheet's edges rather than assume frame count
      const totalW = src.width;
      this.textures.addImage('obj_Trapdoor', src);
      this.textures.get('obj_Trapdoor').add('open', 0, totalW - w, 0, w, w);
      this.textures.get('obj_Trapdoor').add('closed', 0, 0, 0, w, w);
    }

    this.scene.start('Menu');
  }

  private drawLoadingUI(): void {
    const { width, height } = this.scale;
    const box = this.add.rectangle(width / 2, height / 2, 220, 18, 0x1a1c2a).setStrokeStyle(2, 0x8d98ad);
    const bar = this.add.rectangle(width / 2 - 106, height / 2, 4, 12, 0x8d98ad).setOrigin(0, 0.5);
    const label = this.add
      .text(width / 2, height / 2 - 24, 'Loading dungeon...', { fontFamily: 'monospace', fontSize: '12px', color: '#c9cdd6' })
      .setOrigin(0.5);
    this.load.on('progress', (p: number) => {
      bar.width = Math.max(2, 212 * p);
    });
    this.load.on('complete', () => {
      box.destroy();
      bar.destroy();
      label.destroy();
    });
  }
}
