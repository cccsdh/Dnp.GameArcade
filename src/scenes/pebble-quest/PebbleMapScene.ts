import Phaser from 'phaser';
import {
  PQ_FLOORS,
  PQ_PROGRESS_KEY,
  PQ_ROOMS_PER_FLOOR,
  PEBBLE_PROGRESS_DEFAULT,
  loadPebbleProgress,
  type PebbleProgress,
} from '../../game/pebble-quest/config';
import { hasOverride } from '../../game/pebble-quest/LevelLibrary';
import { MenuNav, type NavItem } from '../../game/shared/MenuNav';
import { SaveData } from '../../game/shared/SaveData';
import { SoundManager, loadMuted } from '../../game/shared/Sound';

export class PebbleMapScene extends Phaser.Scene {
  private store = new SaveData<PebbleProgress>(PQ_PROGRESS_KEY, PEBBLE_PROGRESS_DEFAULT);
  private progress!: PebbleProgress;
  private sfx!: SoundManager;

  constructor() {
    super('PebbleMap');
  }

  create(): void {
    this.progress = loadPebbleProgress(this.store);
    this.sfx = new SoundManager(this);
    this.sfx.playMusic('menu');
    this.sound.mute = loadMuted();

    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000);

    this.add
      .text(width / 2, height * 0.06, 'PEBBLE QUEST', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#f7d8a5',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height * 0.06 + 26, 'Climb the tower - choose a room', { fontFamily: 'monospace', fontSize: '12px', color: '#bcbcbc' })
      .setOrigin(0.5);

    const backBtn = this.add
      .text(16, 16, '< Games', { fontFamily: 'monospace', fontSize: '13px', color: '#bcbcbc' })
      .setInteractive({ useHandCursor: true });
    backBtn.on('pointerover', () => backBtn.setColor('#fcfcfc'));
    backBtn.on('pointerout', () => backBtn.setColor('#bcbcbc'));
    backBtn.on('pointerdown', () => this.scene.start('GameSelect'));
    this.input.keyboard!.once('keydown-ESC', () => this.scene.start('GameSelect'));

    const editBtn = this.add
      .text(width - 16, 16, 'Level editor >', { fontFamily: 'monospace', fontSize: '13px', color: '#f878f8' })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    editBtn.on('pointerover', () => editBtn.setColor('#fcfcfc'));
    editBtn.on('pointerout', () => editBtn.setColor('#f878f8'));
    const openEditor = () => {
      this.sfx.play('uiClick');
      this.scene.start('PebbleEditor', {});
    };
    editBtn.on('pointerdown', openEditor);
    const items: NavItem[] = [];

    // The tower: floor 1 at the bottom, floor 10 at the top.
    const gridTop = height * 0.06 + 50;
    const gridBottom = height - 36;
    const cellH = Math.min(52, (gridBottom - gridTop) / PQ_FLOORS);
    const cellW = Math.min(76, (width * 0.8) / PQ_ROOMS_PER_FLOOR);
    const totalW = cellW * PQ_ROOMS_PER_FLOOR;
    const originX = width / 2 - totalW / 2 + cellW / 2 + 24;

    for (let floor = 0; floor < PQ_FLOORS; floor++) {
      const y = gridTop + (PQ_FLOORS - 1 - floor) * cellH + cellH / 2;
      this.add
        .text(originX - cellW / 2 - 8, y, `FLOOR ${floor + 1}`, { fontFamily: 'monospace', fontSize: '11px', color: '#994e00' })
        .setOrigin(1, 0.5);
      for (let col = 0; col < PQ_ROOMS_PER_FLOOR; col++) {
        const levelId = floor * PQ_ROOMS_PER_FLOOR + col + 1;
        const item = this.buildCell(levelId, floor + 1, col + 1, originX + col * cellW, y, cellW - 6, cellH - 6);
        if (item) items.push(item);
      }
    }

    this.add
      .text(width / 2, height - 14, 'Collect every pebble, open the chest, take the jewel, leave by the door.', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#7c7c7c',
      })
      .setOrigin(0.5);

    // Arrows / D-pad move between rooms, Enter / A goes in. Start on the first room not yet cleared.
    const rooms = items.length;
    items.push({
      x: editBtn.x - editBtn.width / 2,
      y: editBtn.y + editBtn.height / 2,
      w: editBtn.width,
      h: editBtn.height,
      activate: openEditor,
      onFocus: (on) => editBtn.setColor(on ? '#fcfcfc' : '#f878f8'),
      hover: editBtn,
    });
    const firstOpen = items.findIndex((_, i) => i < rooms && !this.progress.completed[i]);
    new MenuNav(this, items, { initial: firstOpen >= 0 ? firstOpen : Math.max(0, rooms - 1), color: 0xfcfcfc });
  }

  private buildCell(levelId: number, floor: number, room: number, x: number, y: number, w: number, h: number): NavItem | null {
    const unlocked = levelId <= this.progress.unlockedUpTo;
    const completed = this.progress.completed[levelId - 1] === true;

    const accent = completed ? 0xf878f8 : unlocked ? 0xf7d8a5 : 0x3a2a1a;
    const bg = this.add.rectangle(x, y, w, h, unlocked ? 0x561d00 : 0x1a0a00, 1).setStrokeStyle(2, accent, unlocked ? 1 : 0.5);

    if (unlocked) {
      this.add.text(x, y, `${floor}-${room}`, { fontFamily: 'monospace', fontSize: '14px', color: '#fcfcfc' }).setOrigin(0.5);
      if (completed) this.add.image(x + w / 2 - 8, y - h / 2 + 8, 'pq_pebble').setScale(0.4);
      if (hasOverride(levelId)) {
        this.add.text(x - w / 2 + 3, y - h / 2 + 1, 'edited', { fontFamily: 'monospace', fontSize: '8px', color: '#b8f818' });
      }
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => bg.setStrokeStyle(3, 0xfcfcfc, 1));
      bg.on('pointerout', () => bg.setStrokeStyle(2, accent, 1));
      const enter = () => {
        this.sfx.play('uiClick');
        this.scene.start('PebbleLevel', { levelId });
      };
      bg.on('pointerdown', enter);
      return { x, y, w, h, activate: enter, hover: bg };
    } else {
      const g = this.add.graphics();
      g.lineStyle(2, 0x3a2a1a, 1);
      g.strokeRoundedRect(x - 6, y - 2, 12, 9, 2);
      g.strokeCircle(x, y - 4, 5);
    }
    return null;
  }
}
