import Phaser from 'phaser';
import { DEPTH } from '../../config';

export type PickupKind = 'gold' | 'potion';

export class Pickup extends Phaser.Physics.Arcade.Sprite {
  readonly kind: PickupKind;
  readonly amount: number;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: PickupKind, amount: number) {
    super(scene, x, y, kind === 'gold' ? 'icon_gold' : 'icon_potion');
    this.kind = kind;
    this.amount = amount;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.decor);
    this.setScale(2);
    if (kind === 'gold') this.setTint(0xffd35c);
    else this.setTint(0xff6b7a);
    (this.body as Phaser.Physics.Arcade.Body).setSize(10, 10);

    scene.tweens.add({
      targets: this,
      y: y - 3,
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}
