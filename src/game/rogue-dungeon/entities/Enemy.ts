import Phaser from 'phaser';
import { Actor } from './Actor';
import type { EnemyDef } from '../EnemyDefs';
import type { Player } from './Player';
import type { SoundManager } from '../../shared/Sound';

export const ENEMY_EVENTS = {
  died: 'enemy-died',
} as const;

export interface EnemyDiedPayload {
  enemy: Enemy;
  goldDrop: number;
}

const ATTACK_HIT_DELAY = 220;

export class Enemy extends Actor {
  readonly def: EnemyDef;
  private dmgScale: number;
  private target: Player;
  private sound: SoundManager;
  private lastAttackAt = -Infinity;
  private aiState: 'idle' | 'chase' | 'attack' | 'dead' = 'idle';
  hpBar: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    def: EnemyDef,
    target: Player,
    sound: SoundManager,
    difficultyScale: number,
  ) {
    const hpScale = difficultyScale;
    const dmgScale = 1 + (difficultyScale - 1) * 0.6;
    super(scene, x, y, `enemy${def.id}`, Math.round(def.hp * hpScale));
    this.def = def;
    this.dmgScale = dmgScale;
    this.target = target;
    this.sound = sound;
    this.attachShadow();
    this.body!.setSize(14, 12);
    (this.body as Phaser.Physics.Arcade.Body).setOffset(9, 20);
    this.playAnim('idle');

    this.hpBar = scene.add.graphics();
    this.hpBar.setDepth(20);
  }

  isAttacking(): boolean {
    return this.getCurrentAnim() === 'attack' && this.anims.isPlaying;
  }

  update(time: number, onAttack: (x: number, y: number, range: number, damage: number) => void): void {
    if (this.isDead) return;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (this.aiState === 'attack' && this.isAttacking()) {
      body.setVelocity(0, 0);
      this.drawHpBar();
      return;
    }

    if (dist <= this.def.attackRange + 4 && dist <= this.def.aggroRadius) {
      this.aiState = 'attack';
      body.setVelocity(0, 0);
      this.setFacing({ dx: this.target.x - this.x, dy: this.target.y - this.y });
      if (time - this.lastAttackAt >= this.def.attackCooldown) {
        this.lastAttackAt = time;
        this.playAnim('attack', { restartIfSame: true });
        this.scene.time.delayedCall(ATTACK_HIT_DELAY, () => {
          if (this.isDead) return;
          onAttack(this.x, this.y, this.def.attackRange + 6, Math.round(this.def.damage * this.dmgScale));
        });
      } else {
        this.playAnim('idle');
      }
    } else if (dist <= this.def.aggroRadius) {
      this.aiState = 'chase';
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      const len = Math.hypot(dx, dy) || 1;
      body.setVelocity((dx / len) * this.def.speed, (dy / len) * this.def.speed);
      this.setFacing({ dx, dy });
      this.playAnim('walk');
    } else {
      this.aiState = 'idle';
      body.setVelocity(0, 0);
      this.playAnim('idle');
    }
    this.drawHpBar();
  }

  takeDamage(amount: number): void {
    if (this.isDead) return;
    this.hp = Math.max(0, this.hp - amount);
    this.sound.play('enemyHurt');
    if (this.hp <= 0) {
      this.die();
      return;
    }
    this.playAnim('hurt', { restartIfSame: true });
    this.scene.tweens.add({ targets: this, alpha: 0.4, duration: 60, yoyo: true, repeat: 2 });
  }

  private drawHpBar(): void {
    this.hpBar.clear();
    if (this.hp >= this.maxHp) return;
    const w = 20;
    const pct = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
    const x = this.x - w / 2;
    const y = this.y - 30;
    this.hpBar.fillStyle(0x000000, 0.6);
    this.hpBar.fillRect(x - 1, y - 1, w + 2, 4);
    this.hpBar.fillStyle(pct > 0.4 ? 0x7fd858 : 0xd85858, 1);
    this.hpBar.fillRect(x, y, w * pct, 2);
  }

  private die(): void {
    this.isDead = true;
    this.aiState = 'dead';
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    this.hpBar.destroy();
    this.sound.play('enemyDeath');
    this.playAnim('death', { restartIfSame: true });
    const gold = Phaser.Math.Between(this.def.goldDrop[0], this.def.goldDrop[1]);
    this.scene.events.emit(ENEMY_EVENTS.died, { enemy: this, goldDrop: gold } as EnemyDiedPayload);
    this.scene.time.delayedCall(900, () => this.destroy());
  }

  destroy(fromScene?: boolean): void {
    this.hpBar.destroy();
    super.destroy(fromScene);
  }
}
