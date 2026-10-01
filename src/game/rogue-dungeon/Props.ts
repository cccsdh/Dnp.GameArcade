import Phaser from 'phaser';
import { DEPTH } from '../../config';

export class Chest extends Phaser.Physics.Arcade.Sprite {
  opened = false;
  constructor(scene: Phaser.Scene, x: number, y: number, variant: 1 | 2) {
    super(scene, x, y, `obj_Chest${variant}_D`, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    (this.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    (this.body as Phaser.Physics.Arcade.Body).immovable = true;
    this.setOrigin(0.5, 0.78);
    this.setDepth(DEPTH.decor);
  }

  open(): void {
    if (this.opened) return;
    this.opened = true;
    this.anims.play(this.texture.key + '-open');
  }
}

export class Trapdoor extends Phaser.GameObjects.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'obj_Trapdoor', 'open');
    scene.add.existing(this);
    this.setOrigin(0.5, 0.6);
    this.setDepth(DEPTH.floor + 1);
  }
}

export class Spikes extends Phaser.Physics.Arcade.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'obj_Spikes');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    (this.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    (this.body as Phaser.Physics.Arcade.Body).immovable = true;
    this.setDepth(DEPTH.floor + 1);
    this.anims.play('obj_Spikes-loop');
  }
}

export class Torch extends Phaser.GameObjects.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'obj_Fire1');
    scene.add.existing(this);
    this.setDepth(DEPTH.wallTop);
    this.anims.play('obj_Fire1-loop');
  }
}

export class Door extends Phaser.GameObjects.Sprite {
  private opened = false;
  private triggerDist: number;
  constructor(scene: Phaser.Scene, x: number, y: number, big: boolean) {
    super(scene, x, y, big ? 'obj_BigDoor_D' : 'obj_Door_D', 0);
    scene.add.existing(this);
    this.setOrigin(0.5, 0.78);
    this.setDepth(DEPTH.decor);
    this.triggerDist = big ? 46 : 30;
  }

  updateProximity(px: number, py: number): void {
    if (this.opened) return;
    if (Phaser.Math.Distance.Between(this.x, this.y, px, py) <= this.triggerDist) {
      this.opened = true;
      this.anims.play(this.texture.key + '-open');
    }
  }
}
