import Phaser from 'phaser';
import { Actor } from './Actor';
import type { HeroId } from '../../../config';
import type { SoundManager } from '../../shared/Sound';

export const PLAYER_EVENTS = {
  stats: 'player-stats',
  died: 'player-died',
} as const;

export interface PlayerStats {
  hp: number;
  maxHp: number;
  gold: number;
  potions: number;
}

const SPEED = 92;
const ATTACK_COOLDOWN = 420;
const ATTACK_HIT_DELAY = 140;
const HURT_INVULN_MS = 700;
const ATTACK_RANGE = 22;

export class Player extends Actor {
  gold = 0;
  potions = 1;
  private rawCursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys: Record<'up' | 'down' | 'left' | 'right' | 'attack' | 'potion', Phaser.Input.Keyboard.Key>;
  private lastAttackAt = -Infinity;
  private invulnUntil = 0;
  private sound: SoundManager;
  onAttackSwing?: (x: number, y: number, dir: string) => void;
  onRequestHit?: (x: number, y: number, dir: string, range: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, heroId: HeroId, sound: SoundManager) {
    super(scene, x, y, `hero${heroId}`, 100);
    this.sound = sound;
    this.attachShadow();
    this.body!.setSize(14, 12);
    (this.body as Phaser.Physics.Arcade.Body).setOffset(9, 20);

    const kb = scene.input.keyboard!;
    this.keys = {
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      attack: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      potion: kb.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
    };
    this.rawCursors = kb.createCursorKeys();
    this.playAnim('idle');
    this.emitStats();
  }

  isAttacking(): boolean {
    return this.getCurrentAnim() === 'attack' && this.anims.isPlaying;
  }

  update(time: number): void {
    if (this.isDead) return;

    const attackPressed = Phaser.Input.Keyboard.JustDown(this.keys.attack);
    if (attackPressed && time - this.lastAttackAt >= ATTACK_COOLDOWN && !this.isAttacking()) {
      this.doAttack(time);
    }

    if (this.isAttacking()) {
      (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      return;
    }

    const left = this.keys.left.isDown || this.rawCursors.left?.isDown;
    const right = this.keys.right.isDown || this.rawCursors.right?.isDown;
    const up = this.keys.up.isDown || this.rawCursors.up?.isDown;
    const down = this.keys.down.isDown || this.rawCursors.down?.isDown;

    let dx = 0;
    let dy = 0;
    if (left) dx -= 1;
    if (right) dx += 1;
    if (up) dy -= 1;
    if (down) dy += 1;

    const body = this.body as Phaser.Physics.Arcade.Body;
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      body.setVelocity((dx / len) * SPEED, (dy / len) * SPEED);
      this.setFacing({ dx, dy });
      this.playAnim('walk');
    } else {
      body.setVelocity(0, 0);
      this.playAnim('idle');
    }
  }

  private doAttack(time: number): void {
    this.lastAttackAt = time;
    this.playAnim('attack', { restartIfSame: true });
    this.sound.play('playerAttack');
    this.scene.time.delayedCall(ATTACK_HIT_DELAY, () => {
      if (this.isDead) return;
      const offset = this.facingOffset();
      this.onRequestHit?.(this.x + offset.x, this.y + offset.y, this.dir, ATTACK_RANGE);
    });
  }

  private facingOffset(): { x: number; y: number } {
    if (this.dir === 'up') return { x: 0, y: -14 };
    if (this.dir === 'down') return { x: 0, y: 14 };
    // Side art faces left unflipped, so flipX now means facing right.
    return { x: this.flipX ? 16 : -16, y: 0 };
  }

  takeDamage(amount: number, time: number): void {
    if (this.isDead || time < this.invulnUntil) return;
    this.hp = Math.max(0, this.hp - amount);
    this.invulnUntil = time + HURT_INVULN_MS;
    this.sound.play('playerHurt');
    this.emitStats();
    if (this.hp <= 0) {
      this.die();
      return;
    }
    this.playAnim('hurt', { restartIfSame: true });
    this.scene.tweens.add({
      targets: this,
      alpha: 0.3,
      duration: 80,
      yoyo: true,
      repeat: 4,
    });
  }

  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.emitStats();
  }

  usePotion(): boolean {
    if (this.potions <= 0 || this.hp >= this.maxHp) return false;
    this.potions -= 1;
    this.heal(40);
    this.sound.play('pickupPotion');
    this.emitStats();
    return true;
  }

  addGold(amount: number): void {
    this.gold += amount;
    this.sound.play('pickupGold');
    this.emitStats();
  }

  addPotion(amount = 1): void {
    this.potions += amount;
    this.emitStats();
  }

  private die(): void {
    this.isDead = true;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.sound.play('playerDeath');
    this.playAnim('death', { restartIfSame: true });
    this.emitStats();
    this.scene.events.emit(PLAYER_EVENTS.died);
  }

  private emitStats(): void {
    const stats: PlayerStats = { hp: this.hp, maxHp: this.maxHp, gold: this.gold, potions: this.potions };
    this.scene.events.emit(PLAYER_EVENTS.stats, stats);
  }
}
