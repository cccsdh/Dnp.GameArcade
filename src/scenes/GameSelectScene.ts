import Phaser from 'phaser';
import { MenuNav, type NavItem } from '../game/shared/MenuNav';
import { setPadProfile } from '../game/shared/Pad';
import { ARCADE_PAD } from '../game/shared/PadProfiles';
import { SoundManager } from '../game/shared/Sound';

interface GameCardDef {
  title: string;
  tagline: string;
  description: string;
  accent: number;
  startScene: string;
  /** Texture key of a picture filling the card's upper area; used instead of drawIcon when set. */
  iconImage?: string;
  drawIcon?: (g: Phaser.GameObjects.Graphics, cx: number, cy: number) => void;
}

const CARDS: GameCardDef[] = [
  {
    title: 'ROGUE DUNGEON',
    tagline: 'Action roguelike',
    description: 'Pick a hero and descend through 5 procedurally\ngenerated dungeon floors. Fight, loot, survive.',
    accent: 0xd85858,
    startScene: 'Preload',
    drawIcon: (g, cx, cy) => {
      // A sword crossed in front of a round shield.
      g.fillStyle(0x7c4c24, 1).fillCircle(cx + 8, cy + 2, 22);
      g.lineStyle(3, 0xc79a2e, 1).strokeCircle(cx + 8, cy + 2, 22);
      g.fillStyle(0xc79a2e, 1).fillCircle(cx + 8, cy + 2, 5);
      g.lineStyle(6, 0xd8dce4, 1).lineBetween(cx - 22, cy + 26, cx + 22, cy - 22);
      g.lineStyle(2, 0xfcfcfc, 1).lineBetween(cx - 16, cy + 18, cx + 21, cy - 21);
      g.lineStyle(5, 0xc79a2e, 1).lineBetween(cx - 22, cy + 10, cx - 8, cy + 24);
      g.lineStyle(5, 0x5c3418, 1).lineBetween(cx - 20, cy + 22, cx - 28, cy + 30);
    },
  },
  {
    title: 'PEBBLE QUEST',
    tagline: 'Puzzle adventure',
    description: 'An Adventures of Lolo-style puzzle tower: 50 rooms,\nmagic shots, eggs, Medusas - plus a level editor.',
    accent: 0xf878f8,
    startScene: 'PebblePreload',
    drawIcon: (g, cx, cy) => {
      // A heart pebble, like the room collectibles.
      const heart = (dx: number, dy: number, r: number, color: number) => {
        g.fillStyle(color, 1);
        g.fillCircle(cx + dx - r * 0.55, cy + dy - r * 0.2, r * 0.6);
        g.fillCircle(cx + dx + r * 0.55, cy + dy - r * 0.2, r * 0.6);
        g.fillTriangle(cx + dx - r * 1.13, cy + dy + r * 0.05, cx + dx + r * 1.13, cy + dy + r * 0.05, cx + dx, cy + dy + r * 1.25);
      };
      heart(0, 0, 22, 0x000000);
      heart(0, 0, 19, 0xd85890);
      heart(-2, -2, 16, 0xf8a8c8);
      g.fillStyle(0xfcfcfc, 1);
      g.fillCircle(cx - 12, cy - 9, 3);
    },
  },
  {
    title: 'TURBO KART',
    tagline: 'Kart racer',
    description: 'Drift, boost and throw orbs around 3 tracks.\nPick a racer and beat two rivals.',
    accent: 0xf8a020,
    startScene: 'KartPreload',
    drawIcon: (g, cx, cy) => {
      // A checkered flag.
      g.fillStyle(0x8c8c8c, 1).fillRect(cx - 24, cy - 26, 4, 54);
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 6; c++) g.fillStyle((r + c) % 2 ? 0x101010 : 0xfcfcfc, 1).fillRect(cx - 20 + c * 8, cy - 26 + r * 8, 8, 8);
    },
  },
  {
    title: 'THE UNDERREALM',
    tagline: 'First-person dungeon adventure',
    description: 'Roll a hero, haggle, then explore eleven\nlevels in 3D - or load your own dungeon pack.',
    accent: 0xb888f8,
    startScene: 'UnderrealmTitle',
    drawIcon: (g, cx, cy) => {
      // A stone archway with a torch beside it.
      g.fillStyle(0x6c6c74, 1).fillRect(cx - 24, cy - 24, 40, 50);
      g.fillStyle(0x0a0a10, 1).fillRect(cx - 16, cy - 8, 24, 34);
      g.fillCircle(cx - 4, cy - 8, 12);
      g.fillStyle(0x7c4c24, 1).fillRect(cx + 22, cy - 6, 4, 16);
      g.fillStyle(0xff8c20, 1).fillTriangle(cx + 19, cy - 6, cx + 29, cy - 6, cx + 24, cy - 22);
      g.fillStyle(0xffe070, 1).fillTriangle(cx + 22, cy - 6, cx + 26, cy - 6, cx + 24, cy - 15);
    },
  },
  {
    title: 'LOLLIPOP LEGION',
    tagline: 'Candy arena shooter',
    description: 'Lollipops versus germs! Blast 10 waves of\nslime, recruit candy buddies, beat Duke Grime.',
    accent: 0xf85898,
    startScene: 'LollipopMenu',
    drawIcon: (g, cx, cy) => {
      // A swirly lollipop squaring up to a little green germ.
      g.fillStyle(0xf0e0c0, 1).fillRect(cx - 14, cy - 4, 4, 32);
      g.fillStyle(0xe83060, 1).fillCircle(cx - 12, cy - 10, 17);
      g.lineStyle(4, 0xfcfcfc, 1).beginPath();
      for (let t = 0; t <= 1; t += 0.02) {
        const a = t * Math.PI * 5;
        const r = 2 + t * 13;
        g.lineTo(cx - 12 + Math.cos(a) * r, cy - 10 + Math.sin(a) * r);
      }
      g.strokePath();
      g.fillStyle(0x4cc038, 1).fillCircle(cx + 20, cy + 10, 12);
      g.fillCircle(cx + 12, cy + 4, 5).fillCircle(cx + 28, cy + 2, 5).fillCircle(cx + 27, cy + 19, 5);
      g.fillStyle(0xfcfcfc, 1).fillCircle(cx + 16, cy + 7, 3).fillCircle(cx + 24, cy + 7, 3);
      g.fillStyle(0x101010, 1).fillCircle(cx + 15, cy + 8, 1.5).fillCircle(cx + 23, cy + 8, 1.5);
    },
  },
];

export class GameSelectScene extends Phaser.Scene {
  constructor() {
    super('GameSelect');
  }

  create(): void {
    // Coming back from a game: silence whatever track it left playing.
    new SoundManager(this).stopMusic();
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x0b0b12);

    this.add
      .text(width / 2, height * 0.12, 'GAME ARCADE', {
        fontFamily: 'monospace',
        fontSize: '34px',
        color: '#e7e2d3',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height * 0.19, 'Choose a game', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#767e94',
      })
      .setOrigin(0.5);

    const n = CARDS.length;
    const gap = 24;
    const stacked = width < 760;
    const cardW = stacked ? Math.min(420, width * 0.86) : Math.min(340, (width - gap * (n + 1)) / n);
    const cardH = stacked ? Math.min(200, (height * 0.74 - gap * (n - 1)) / n) : Math.min(380, height * 0.6);
    const totalW = stacked ? cardW : cardW * n + gap * (n - 1);
    const startX = width / 2 - totalW / 2 + cardW / 2;
    const centerY = height * 0.58;

    const items: NavItem[] = CARDS.map((card, i) => {
      const x = stacked ? width / 2 : startX + i * (cardW + gap);
      const y = stacked ? centerY + (i - (n - 1) / 2) * (cardH + gap) : centerY;
      return this.buildCard(card, x, y, cardW, cardH);
    });

    // The controller screen (C, or Select on the pad).
    const padBtn = this.add
      .text(width / 2, height - 22, 'C) Controller setup', { fontFamily: 'monospace', fontSize: '13px', color: '#8d98ad' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    padBtn.on('pointerdown', () => this.launch('PadSetup'));
    items.push({
      x: padBtn.x,
      y: padBtn.y,
      w: padBtn.width,
      h: padBtn.height,
      activate: () => this.launch('PadSetup'),
      onFocus: (on) => padBtn.setColor(on ? '#f8d800' : '#8d98ad'),
      hover: padBtn,
    });
    this.input.keyboard!.on('keydown-C', () => this.launch('PadSetup'));

    // Arrows / D-pad pick a game, Enter / A plays it; the number keys still jump straight in.
    new MenuNav(this, items, { initial: GameSelectScene.lastPick, box: false, onMove: (i) => (GameSelectScene.lastPick = i) });
    setPadProfile(this, ARCADE_PAD);
    const keys = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'];
    CARDS.forEach((card, i) => this.input.keyboard!.on(`keydown-${keys[i]}`, () => this.launch(card.startScene)));
  }

  /** The card the cursor was on last, so coming back from a game lands on it again. */
  private static lastPick = 0;

  private buildCard(card: GameCardDef, x: number, y: number, w: number, h: number): NavItem {
    const container = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, w, h, 0x171826).setStrokeStyle(2, card.accent, 0.8);
    let icon: Phaser.GameObjects.GameObject;
    if (card.iconImage) {
      // Fit the picture between the card's top edge and the title.
      const top = -h / 2 + 10;
      const bottom = h * 0.08 - 16;
      const img = this.add.image(0, (top + bottom) / 2, card.iconImage);
      img.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      img.setScale((bottom - top) / img.height);
      icon = img;
    } else {
      const iconG = this.add.graphics();
      card.drawIcon?.(iconG, 0, -h * 0.2);
      icon = iconG;
    }

    // Shrink the title to fit narrow cards (a monospace glyph is ~0.6em wide).
    const titleSize = Math.min(20, Math.floor((w - 16) / (card.title.length * 0.6)));
    const title = this.add
      .text(0, h * 0.08, card.title, { fontFamily: 'monospace', fontSize: `${titleSize}px`, color: '#e7e2d3', fontStyle: 'bold' })
      .setOrigin(0.5);
    const tagline = this.add
      .text(0, h * 0.08 + 24, card.tagline, { fontFamily: 'monospace', fontSize: '11px', color: '#8d98ad' })
      .setOrigin(0.5);
    // Keep the hand-broken lines when they fit; otherwise re-wrap to the card.
    const longest = Math.max(...card.description.split('\n').map((l) => l.length));
    const fits = longest * 6.7 <= w - 16;
    const desc = this.add
      .text(0, h * 0.08 + 46, fits ? card.description : card.description.replace(/\n/g, ' '), {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#c9cdd6',
        align: 'center',
        lineSpacing: 4,
        wordWrap: fits ? undefined : { width: w - 16 },
      })
      .setOrigin(0.5, 0);

    const btn = this.add.rectangle(0, h * 0.42, w * 0.6, 36, card.accent, 0.15).setStrokeStyle(2, card.accent);
    const btnLabel = this.add
      .text(0, h * 0.42, 'PLAY', { fontFamily: 'monospace', fontSize: '14px', color: '#e7e2d3', fontStyle: 'bold' })
      .setOrigin(0.5);

    container.add([bg, icon, title, tagline, desc, btn, btnLabel]);

    const hitZone = this.add.rectangle(x, y, w, h, 0xffffff, 0).setInteractive({ useHandCursor: true });
    const setFocus = (on: boolean) => {
      bg.setStrokeStyle(on ? 4 : 2, on ? 0xf8d800 : card.accent, on ? 1 : 0.8);
      btn.setFillStyle(card.accent, on ? 0.3 : 0.15);
      container.setScale(on ? 1.03 : 1);
    };
    hitZone.on('pointerdown', () => this.launch(card.startScene));
    return { x, y, w, h, activate: () => this.launch(card.startScene), onFocus: setFocus, hover: hitZone };
  }

  private launch(sceneKey: string): void {
    this.scene.start(sceneKey);
  }
}
