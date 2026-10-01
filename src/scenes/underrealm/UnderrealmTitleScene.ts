import Phaser from 'phaser';
import { loadPackAssets } from '../../game/underrealm/assets';
import { STATS, STAT_HELP, type StatId } from '../../game/underrealm/config';
import { clearSave, loadHero, maxHp, newHero, rollStats, type Hero } from '../../game/underrealm/hero';
import { findAdventure } from '../../game/underrealm/packStore';
import { MenuNav, type NavItem } from '../../game/shared/MenuNav';
import { SoundManager, loadMuted } from '../../game/shared/Sound';

/**
 * Title screen: roll a new adventurer (who then heads to the Hall of
 * Adventurers to pick an adventure), or continue a saved hero - back into
 * their adventure, or to the Hall if they're between adventures.
 */
export class UnderrealmTitleScene extends Phaser.Scene {
  private sfx!: SoundManager;
  private stats: Record<StatId, number> = rollStats();
  private panel: Phaser.GameObjects.Container | null = null;
  private status!: Phaser.GameObjects.Text;
  /** The current panel's buttons, for the arrow-key / D-pad cursor. */
  private navItems: NavItem[] = [];
  private nav: MenuNav | null = null;

  constructor() {
    super('UnderrealmTitle');
  }

  preload(): void {
    // Doors, coins, potions, hits and deaths use the arcade's CC0 clips.
    SoundManager.preload(this, { music: false });
  }

  create(): void {
    this.sfx = new SoundManager(this);
    this.sound.mute = loadMuted();
    this.sfx.playMusic('realmTitle');
    const { width: W, height: H } = this.scale;
    const g = this.add.graphics();
    g.fillGradientStyle(0x05040a, 0x05040a, 0x1c1030, 0x1c1030, 1).fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) g.fillStyle(0xffffff, Math.random() * 0.6).fillRect(Math.random() * W, Math.random() * H * 0.5, 2, 2);
    g.fillStyle(0x0c0a10, 1);
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) g.lineTo(x, H * 0.66 + Math.sin(x / 70) * 30 + Math.sin(x / 23) * 10);
    g.lineTo(W, H);
    g.fillPath();
    g.fillStyle(0x000000, 1).fillEllipse(W / 2, H * 0.82, W * 0.3, H * 0.26);

    this.add
      .text(W / 2, H * 0.11, 'THE UNDERREALM', {
        fontFamily: 'monospace',
        fontSize: `${Math.round(Math.min(64, W / 13))}px`,
        color: '#f8d870',
        fontStyle: 'bold',
        stroke: '#3c1c08',
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    this.add.text(W / 2, H * 0.11 + 50, 'A first-person dungeon adventure', { fontFamily: 'monospace', fontSize: '15px', color: '#c8b898' }).setOrigin(0.5);
    this.status = this.add.text(W / 2, H - 26, '', { fontFamily: 'monospace', fontSize: '13px', color: '#f88888' }).setOrigin(0.5);

    const back = this.add.text(16, 14, '< Games', { fontFamily: 'monospace', fontSize: '14px', color: '#c8c8c8' }).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('GameSelect'));
    this.showMain();
  }

  private newPanel(y: number): Phaser.GameObjects.Container {
    this.panel?.destroy();
    this.nav?.destroy();
    this.nav = null;
    this.navItems = [];
    this.input.keyboard!.removeAllListeners();
    this.panel = this.add.container(this.scale.width / 2, y);
    return this.panel;
  }

  private button(c: Phaser.GameObjects.Container, y: number, label: string, onClick: () => void, key?: string, size = 18): void {
    const t = this.add
      .text(0, y, label, { fontFamily: 'monospace', fontSize: `${size}px`, color: '#88d8ff', stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    t.on('pointerover', () => t.setColor('#ffffff'));
    t.on('pointerout', () => t.setColor('#88d8ff'));
    t.on('pointerdown', () => {
      this.sfx.play('realmBlip');
      onClick();
    });
    c.add(t);
    // Enter belongs to the cursor (it presses the highlighted button); other hotkeys still work directly.
    if (key && key !== 'ENTER') this.input.keyboard!.on(`keydown-${key}`, () => this.panel === c && onClick());
    this.navItems.push({
      x: c.x,
      y: c.y + y,
      w: t.width,
      h: t.height,
      activate: () => {
        this.sfx.play('realmBlip');
        onClick();
      },
      onFocus: (on) => t.setColor(on ? '#ffffff' : '#88d8ff'),
      hover: t,
    });
    if (key === 'ENTER') this.navStart = this.navItems.length - 1;
  }

  private navStart = 0;

  /** Arrow keys / D-pad move between the panel's buttons; Enter / A presses one. */
  private startNav(initial = this.navStart): void {
    this.nav = new MenuNav(this, this.navItems, { initial, color: 0x88d8ff });
    this.navStart = 0;
  }

  private showMain(): void {
    const c = this.newPanel(this.scale.height * 0.38);
    const save = loadHero();
    c.add(
      this.add
        .text(0, -30, 'Roll an adventurer, choose an adventure in the Hall of Adventurers,\nthen explore it in first person - and find your way out alive.', {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#e8e0d0',
          align: 'center',
          lineSpacing: 4,
        })
        .setOrigin(0.5),
    );
    this.button(c, 36, '1) Create a new adventurer', () => this.showCreate(), 'ONE');
    if (save) {
      const where = save.packId ? `level ${save.level}, on an adventure` : `level ${save.level}, in the Hall of Adventurers`;
      this.button(c, 72, `2) Continue (${where})`, () => this.continueHero(save), 'TWO');
    }
    this.input.keyboard!.on('keydown-ESC', () => this.panel === c && this.scene.start('GameSelect'));
    this.startNav(save ? 1 : 0);
  }

  private async continueHero(save: Hero): Promise<void> {
    if (save.packId === undefined) {
      this.status.setText('That save is from an older version of the game and can\'t be continued.');
      return;
    }
    if (!save.packId) {
      this.scene.start('UnderrealmHall', { hero: save });
      return;
    }
    this.status.setColor('#c8c8c8').setText('Returning to your adventure...');
    const pack = await findAdventure(save.packId);
    if (!pack) {
      this.status.setColor('#f88888').setText('Your adventure is no longer in the hall - your hero returns there instead.');
      this.time.delayedCall(1400, () => this.scene.start('UnderrealmHall', { hero: save }));
      return;
    }
    try {
      const assets = await loadPackAssets(pack, this.sound);
      this.scene.start('Underrealm', { hero: save, pack, assets });
    } catch (err) {
      this.status.setColor('#f88888').setText(`Couldn't load this adventure: ${(err as Error).message}`);
    }
  }

  private showCreate(): void {
    const c = this.newPanel(this.scale.height * 0.3);
    c.add(this.add.text(0, -24, 'Roll your adventurer', { fontFamily: 'monospace', fontSize: '18px', color: '#f8d870' }).setOrigin(0.5));
    const lines = this.add.text(-200, 8, '', { fontFamily: 'monospace', fontSize: '15px', color: '#e8e8e8', lineSpacing: 6 });
    c.add(lines);
    const refresh = () => {
      const s = this.stats;
      const total = STATS.reduce((a, k) => a + s[k], 0);
      lines.setText([...STATS.map((k) => `${k}  ${String(s[k]).padStart(2)}   ${STAT_HELP[k]}`), '', `Total ${total}   Hit points ${maxHp(newHero(s))}`]);
    };
    refresh();
    const reroll = () => {
      this.stats = rollStats();
      this.sfx.play('realmBlip');
      refresh();
    };
    this.button(c, 230, 'R) Roll again', reroll, 'R');
    this.button(c, 266, 'Enter) Accept - to the Hall of Adventurers', () => this.begin(), 'ENTER');
    this.button(c, 302, 'Esc) Back', () => this.showMain(), 'ESC');
    this.startNav();
  }

  private begin(): void {
    clearSave();
    this.sfx.play('realmLevelUp');
    this.scene.start('UnderrealmHall', { hero: newHero({ ...this.stats }) });
  }
}
