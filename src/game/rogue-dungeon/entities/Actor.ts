import Phaser from 'phaser';
import { animKey, type ActorAnim, type Dir } from '../anim/actorAnims';
import { DEPTH } from '../../../config';

export type FacingInput = { dx: number; dy: number };

export class Actor extends Phaser.Physics.Arcade.Sprite {
  readonly actorKey: string;
  maxHp: number;
  hp: number;
  dir: Dir = 'down';
  protected currentAnim: ActorAnim = 'idle';
  isDead = false;
  shadow: Phaser.GameObjects.Sprite | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, actorKey: string, maxHp: number) {
    super(scene, x, y, `${actorKey}_D_Idle`);
    this.actorKey = actorKey;
    this.maxHp = maxHp;
    this.hp = maxHp;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.entity);
    this.setOrigin(0.5, 0.75);
  }

  attachShadow(): void {
    this.shadow = this.scene.add.sprite(this.x, this.y, 'fx_Shadow');
    this.shadow.setOrigin(0.5, 0.5);
    this.shadow.setDepth(DEPTH.shadow);
  }

  protected syncShadow(): void {
    if (!this.shadow) return;
    this.shadow.setPosition(this.x, this.y + 2);
    this.shadow.setVisible(this.visible);
  }

  setFacing(input: FacingInput): void {
    const { dx, dy } = input;
    if (dx === 0 && dy === 0) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.dir = 'side';
      // The side-view art faces left by default, so mirror it for rightward motion instead.
      this.setFlipX(dx > 0);
    } else {
      this.dir = dy < 0 ? 'up' : 'down';
      this.setFlipX(false);
    }
  }

  playAnim(anim: ActorAnim, opts: { restartIfSame?: boolean } = {}): void {
    if (this.isDead && anim !== 'death') return;
    this.currentAnim = anim;
    const key = animKey(this.actorKey, anim, this.dir);
    if (!opts.restartIfSame && this.anims.currentAnim?.key === key && this.anims.isPlaying) return;
    this.anims.play(key, true);
  }

  getCurrentAnim(): ActorAnim {
    return this.currentAnim;
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this.syncShadow();
  }

  destroy(fromScene?: boolean): void {
    this.shadow?.destroy();
    super.destroy(fromScene);
  }
}
