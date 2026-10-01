import Phaser from 'phaser';
import { PLAYER_EVENTS, type PlayerStats } from '../../game/rogue-dungeon/entities/Player';

export class HUDScene extends Phaser.Scene {
  private hpBarBg!: Phaser.GameObjects.Graphics;
  private hpBarFill!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private potionText!: Phaser.GameObjects.Text;
  private floorText!: Phaser.GameObjects.Text;
  private readonly barX = 30;
  private readonly barY = 14;
  private readonly barW = 90;
  private readonly barH = 10;

  constructor() {
    super('HUD');
  }

  create(): void {
    this.add.image(14, this.barY + this.barH / 2, 'icon_heart').setScale(2).setScrollFactor(0);

    this.hpBarBg = this.add.graphics().setScrollFactor(0);
    this.hpBarBg.fillStyle(0x14151f, 0.9);
    this.hpBarBg.fillRoundedRect(this.barX, this.barY, this.barW, this.barH, 2);
    this.hpBarBg.lineStyle(1, 0x3b3f52, 1);
    this.hpBarBg.strokeRoundedRect(this.barX, this.barY, this.barW, this.barH, 2);

    this.hpBarFill = this.add.graphics().setScrollFactor(0);

    this.hpText = this.add
      .text(this.barX + this.barW + 6, this.barY - 1, '', { fontFamily: 'monospace', fontSize: '11px', color: '#e7e2d3' })
      .setScrollFactor(0);

    this.add.image(14, 34, 'icon_potion_hud').setScale(2).setScrollFactor(0).setTint(0xff8fa0);
    this.potionText = this.add
      .text(26, 28, '', { fontFamily: 'monospace', fontSize: '12px', color: '#e7e2d3' })
      .setScrollFactor(0);

    this.add.image(14, 52, 'icon_gold').setScale(2).setScrollFactor(0).setTint(0xffd35c);
    this.goldText = this.add
      .text(26, 46, '', { fontFamily: 'monospace', fontSize: '12px', color: '#e7e2d3' })
      .setScrollFactor(0);

    this.floorText = this.add
      .text(this.scale.width - 10, 12, '', { fontFamily: 'monospace', fontSize: '13px', color: '#e7e2d3' })
      .setOrigin(1, 0)
      .setScrollFactor(0);

    this.add
      .text(this.scale.width - 10, this.scale.height - 10, 'Q: potion', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#767e94',
      })
      .setOrigin(1, 1)
      .setScrollFactor(0);

    this.game.events.on(PLAYER_EVENTS.stats, this.onStats, this);
    this.game.events.on('floor-changed', this.onFloor, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(PLAYER_EVENTS.stats, this.onStats, this);
      this.game.events.off('floor-changed', this.onFloor, this);
    });
  }

  private onStats(stats: PlayerStats): void {
    const pct = Phaser.Math.Clamp(stats.hp / stats.maxHp, 0, 1);
    this.hpBarFill.clear();
    this.hpBarFill.fillStyle(pct > 0.5 ? 0x7fd858 : pct > 0.25 ? 0xe0a83c : 0xd85858, 1);
    this.hpBarFill.fillRoundedRect(this.barX + 1, this.barY + 1, Math.max(0, (this.barW - 2) * pct), this.barH - 2, 1);
    this.hpText.setText(`${stats.hp}/${stats.maxHp}`);
    this.goldText.setText(`${stats.gold}`);
    this.potionText.setText(`${stats.potions}`);
  }

  private onFloor(floor: number): void {
    this.floorText.setText(`Floor ${floor}`);
  }
}
