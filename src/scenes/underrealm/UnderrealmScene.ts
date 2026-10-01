import Phaser from 'phaser';
import type { PackAssets } from '../../game/underrealm/assets';
import { ambush, bribeCost, heroTurn, startFight, type Fight, type FightAction, type TurnResult } from '../../game/underrealm/combat';
import {
  ARMORS,
  HUNGER_STEPS,
  MAX_LEVEL,
  PRICES,
  SPELLS,
  STATS,
  THIRST_STEPS,
  TORCH_STEPS,
  WEAPONS,
  type SpellId,
} from '../../game/underrealm/config';
import { armorOf, loadHero, maxHp, maxMana, nextLevelXp, saveHero, timeString, weaponOf, type Hero } from '../../game/underrealm/hero';
import { SPRITE_SCALE } from '../../game/underrealm/models';
import { packMonsters, type DungeonPack, type PackMonster, type TileDef } from '../../game/underrealm/pack';
import { Raycaster, type Sprite } from '../../game/underrealm/raycaster';
import { RUMORS, SHOP_DEFS, type ShopId } from '../../game/underrealm/shops';
import { textureSet, type Texture } from '../../game/underrealm/textures';
import {
  DIR_DX,
  DIR_DY,
  DIR_NAMES,
  buildLevel,
  isSafe,
  isSolidAt,
  isSolidTile,
  tileAt,
  tileKey,
  type Dir,
  type Level,
} from '../../game/underrealm/world';
import { MENU_PROFILE, setPadProfile } from '../../game/shared/Pad';
import { UNDERREALM_PAD } from '../../game/shared/PadProfiles';
import { SoundManager, loadMuted, saveMuted, type MusicKey } from '../../game/shared/Sound';

export interface UnderrealmInitData {
  hero: Hero;
  pack: DungeonPack;
  assets: PackAssets;
}

const VW = 320;
const VH = 200;

interface MenuOption {
  key: string;
  label: string;
  action: () => void;
  disabled?: boolean;
}

interface Menu {
  title: string;
  lines: string[];
  options: MenuOption[];
}

/** One keycap in the controls panel (lights up while its key is held). */
interface Keycap {
  keys: string[];
  bg: Phaser.GameObjects.Rectangle;
}

const angleOf = (d: Dir) => ((d - 1) * Math.PI) / 2;
const charm = (h: Hero) => Math.max(0.8, Math.min(1.2, 1.3 - h.stats.CHR / 40));

export class UnderrealmScene extends Phaser.Scene {
  private hero!: Hero;
  private pack!: DungeonPack;
  private assets!: PackAssets;
  private monsters = new Map<string, PackMonster>();
  private level!: Level;
  private sfx!: SoundManager;
  private ray = new Raycaster(VW, VH);

  private viewTex!: Phaser.Textures.CanvasTexture;
  private view!: Phaser.GameObjects.Image;
  private viewScale = 2;
  private viewX = 0;
  private viewY = 0;
  private flashRect!: Phaser.GameObjects.Rectangle;

  private statText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private locText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private menuTexts: Phaser.GameObjects.Text[] = [];
  /** The menu's option labels, and which one the arrow keys / D-pad have highlighted. */
  private optionTexts: Phaser.GameObjects.Text[] = [];
  private menuSel = 0;
  private mini!: Phaser.GameObjects.Graphics;
  private bigMap!: Phaser.GameObjects.Graphics;
  private miniBox = { x: 0, y: 0, size: 0 };
  private keycaps: Keycap[] = [];
  private pressed = new Set<string>();

  private log: string[] = [];
  private menu: Menu | null = null;
  private showMap = false;

  private camX = 0;
  private camY = 0;
  private camA = 0;
  private anim: { fx: number; fy: number; tx: number; ty: number; fa: number; ta: number; t: number; dur: number } | null = null;

  private fight: Fight | null = null;
  /** Tile key of the guardian / boss being fought (null for wandering monsters). */
  private fightAt: string | null = null;
  private encounterSprite: string | null = null;
  private shop: { id: ShopId; bg: HTMLCanvasElement; keeper: HTMLCanvasElement } | null = null;
  private shopMood = 1;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private shake = 0;

  constructor() {
    super('Underrealm');
  }

  init(data: UnderrealmInitData): void {
    this.hero = data.hero;
    this.pack = data.pack;
    this.assets = data.assets;
    this.monsters = new Map(packMonsters(this.pack).map((m) => [m.id, m]));
    this.hero.revealed ??= {};
    this.hero.slain ??= {};
    this.log = [];
    this.menu = null;
    this.fight = null;
    this.fightAt = null;
    this.encounterSprite = null;
    this.shop = null;
    this.showMap = false;
    this.anim = null;
    this.menuTexts = [];
    this.keycaps = [];
    this.pressed = new Set();
  }

  create(): void {
    this.sfx = new SoundManager(this);
    this.sound.mute = loadMuted();
    const { width: W, height: H } = this.scale;
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000);

    // Layout: stats on top, the view in the middle, controls on the left, map on the right, messages below.
    const font = Math.max(12, Math.round(H / 52));
    const topH = font * 5.6;
    const bottomH = font * 12;
    const sideL = Math.min(230, Math.max(150, W * 0.16));
    const sideR = Math.min(230, Math.max(120, W * 0.15));
    const availW = W - sideL - sideR - 40;
    this.viewScale = Math.max(1, Math.min(Math.floor((H - topH - bottomH) / VH), Math.floor(availW / VW)));
    if (this.viewScale < 2) this.viewScale = Math.max(1, Math.min((H - topH - bottomH) / VH, availW / VW));
    const vw = VW * this.viewScale;
    const vh = VH * this.viewScale;
    this.viewX = Math.round(sideL + 20 + (availW - vw) / 2);
    this.viewY = Math.round(topH + 6);

    const style = { fontFamily: 'monospace', fontSize: `${font}px`, color: '#e8e8e8' };
    this.statText = this.add.text(this.viewX, 8, '', { ...style, lineSpacing: 2 });
    this.locText = this.add.text(this.viewX + vw / 2, this.viewY - 12, '', { ...style, color: '#f8d870' }).setOrigin(0.5, 1);

    this.viewTex = this.textures.exists('urView') ? (this.textures.get('urView') as Phaser.Textures.CanvasTexture) : this.textures.createCanvas('urView', VW, VH)!;
    this.view = this.add.image(this.viewX, this.viewY, 'urView').setOrigin(0).setScale(this.viewScale);
    const frame = this.add.graphics();
    frame.lineStyle(4, 0x9c7c4c, 1).strokeRect(this.viewX - 4, this.viewY - 4, vw + 8, vh + 8);
    frame.lineStyle(2, 0x3c2c1c, 1).strokeRect(this.viewX - 7, this.viewY - 7, vw + 14, vh + 14);
    this.flashRect = this.add.rectangle(this.viewX, this.viewY, vw, vh, 0xff2020, 0).setOrigin(0);

    const below = this.viewY + vh + 12;
    this.statusText = this.add.text(this.viewX, below, '', { ...style, color: '#a8e8a8' });
    this.infoText = this.add.text(this.viewX, below + font * 1.35, '', { ...style, color: '#a8c8f8' });
    this.logText = this.add.text(this.viewX, below + font * 3.1, '', { ...style, lineSpacing: 3, wordWrap: { width: vw } });

    this.miniBox = { x: this.viewX + vw + 18, y: this.viewY, size: Math.min(sideR, 220) };
    this.mini = this.add.graphics();
    this.bigMap = this.add.graphics().setDepth(10);
    // The controls panel hugs the left edge of the view.
    const panelW = Math.min(sideL, this.viewX - 36);
    this.buildControls(Math.max(16, this.viewX - 30 - panelW), this.viewY, panelW);

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: kb.addKey(K.UP),
      down: kb.addKey(K.DOWN),
      left: kb.addKey(K.LEFT),
      right: kb.addKey(K.RIGHT),
      w: kb.addKey(K.W),
      s: kb.addKey(K.S),
      a: kb.addKey(K.A),
      d: kb.addKey(K.D),
      q: kb.addKey(K.Q),
      e: kb.addKey(K.E),
      shift: kb.addKey(K.SHIFT),
    };
    kb.on('keydown', (ev: KeyboardEvent) => this.onKey(ev));
    setPadProfile(this, UNDERREALM_PAD);

    // A hero just setting out starts at the adventure's entrance; a saved one where they left off.
    const starting = this.hero.pos.level === 0;
    if (starting) this.enterLevel(1, 'down');
    else this.enterLevel(this.hero.pos.level, null);
    if (starting) {
      this.say(...(this.pack.intro ?? [`You enter ${this.pack.name}.`]));
      saveHero(this.hero);
    } else this.say(`You are on ${this.level.name}.`);
    this.refreshHud();
    this.prewarmSprites();
  }

  /** Renders every monster sprite in the background so the first encounter doesn't hitch. */
  private prewarmSprites(): void {
    const ids = [...new Set([...this.monsters.values()].map((m) => m.sprite))];
    if (!ids.length) return;
    this.time.addEvent({ delay: 40, repeat: ids.length - 1, callback: () => this.assets.sprite(ids.shift()!) });
  }

  // --- Controls panel -------------------------------------------------------------

  private buildControls(x0: number, y0: number, width: number): void {
    if (width < 120) return;
    const cap = Math.max(22, Math.min(34, Math.floor(width / 6.6)));
    const gap = 4;
    const small = `${Math.max(10, Math.round(cap * 0.4))}px`;
    const labelStyle = { fontFamily: 'monospace', fontSize: small, color: '#c8b898' };
    let y = y0;
    const title = (text: string) => {
      this.add.text(x0, y, text, { fontFamily: 'monospace', fontSize: small, color: '#f8d870', fontStyle: 'bold' });
      y += cap * 0.7;
    };
    const key = (x: number, yy: number, label: string, keys: string[], w = cap) => {
      const bg = this.add.rectangle(x, yy, w, cap, 0x2c2c34).setOrigin(0).setStrokeStyle(2, 0x8c8c9c);
      this.add.rectangle(x + 2, yy + cap - 5, w - 4, 3, 0x18181c).setOrigin(0);
      this.add
        .text(x + w / 2, yy + cap / 2 - 1, label, {
          fontFamily: 'monospace',
          fontSize: `${Math.round(cap * (label.length > 2 ? 0.34 : 0.48))}px`,
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      this.keycaps.push({ keys, bg });
    };
    title('MOVE');
    key(x0 + cap + gap, y, 'W', ['w', 'arrowup']);
    key(x0, y + cap + gap, 'A', ['a', 'arrowleft']);
    key(x0 + cap + gap, y + cap + gap, 'S', ['s', 'arrowdown']);
    key(x0 + (cap + gap) * 2, y + cap + gap, 'D', ['d', 'arrowright']);
    const ax = x0 + (cap + gap) * 3 + 8;
    if (ax + (cap + gap) * 3 < x0 + width + 20) {
      key(ax + cap + gap, y, '↑', ['w', 'arrowup']);
      key(ax, y + cap + gap, '←', ['a', 'arrowleft']);
      key(ax + cap + gap, y + cap + gap, '↓', ['s', 'arrowdown']);
      key(ax + (cap + gap) * 2, y + cap + gap, '→', ['d', 'arrowright']);
    }
    y += (cap + gap) * 2 + 4;
    this.add.text(x0, y, 'W/S  step forward / back\nA/D  turn left / right', { ...labelStyle, lineSpacing: 2 });
    y += cap * 1.4;
    const row = (label: string, keys: string[], text: string, w = cap) => {
      key(x0, y, label, keys, w);
      this.add.text(x0 + w + 8, y + cap / 2, text, labelStyle).setOrigin(0, 0.5);
      y += cap + gap + 2;
    };
    title('ACTIONS');
    key(x0, y, 'Q', ['q']);
    key(x0 + cap + gap, y, 'E', ['e']);
    this.add.text(x0 + (cap + gap) * 2 + 4, y + cap / 2, 'sidestep\n(or Shift+A/D)', { ...labelStyle, lineSpacing: 1 }).setOrigin(0, 0.5);
    y += cap + gap + 2;
    row('F', ['f'], 'search walls');
    row('I', ['i'], 'inventory');
    row('M', ['m'], 'full map');
    row('Esc', ['escape'], 'menu / save', cap * 1.5);
    y += 4;
    title('IN MENUS');
    row('1-9', ['1', '2', '3', '4', '5', '6', '7', '8', '9'], 'choose', cap * 1.5);
    row('↑↓', ['arrowup', 'arrowdown'], 'highlight', cap * 1.5);
    row('Enter', ['enter'], 'pick highlighted', cap * 1.9);
    const tip = this.add.text(x0, y + 2, 'Walk into doors, stairs\nand shop fronts to use\nthem.  Shift+N: sound', { ...labelStyle, color: '#8c8478', lineSpacing: 2 });
    y += tip.height + 10;
    title('NES PAD');
    this.add.text(x0, y, 'A search   B pack\nB + ←/→  sidestep\nSelect map  Start menu\nMenus: D-pad + A, B back', { ...labelStyle, lineSpacing: 2 });
  }

  private lightKeys(held: Set<string>): void {
    for (const k of this.keycaps) {
      const on = k.keys.some((key) => held.has(key));
      k.bg.setFillStyle(on ? 0x9c7c4c : 0x2c2c34).setStrokeStyle(2, on ? 0xf8d870 : 0x8c8c9c);
    }
  }

  // --- Level + music ------------------------------------------------------------

  private enterLevel(n: number, arriving: 'down' | 'up' | null): void {
    const h = this.hero;
    this.level = buildLevel(this.pack, n, h.seed);
    for (const k of h.opened[n] ?? []) {
      const [x, y] = k.split(',').map(Number);
      this.level.grid[y][x] = '.';
    }
    for (const k of h.revealed?.[n] ?? []) {
      const [x, y] = k.split(',').map(Number);
      this.level.grid[y][x] = 'E';
    }
    if (arriving === 'down') h.pos = { level: n, ...this.level.arriveDown };
    if (arriving === 'up' && this.level.arriveUp) h.pos = { level: n, ...this.level.arriveUp };
    h.pos.level = n;
    this.camX = h.pos.x + 0.5;
    this.camY = h.pos.y + 0.5;
    this.camA = angleOf(h.pos.dir);
    this.updateMusic();
    this.markExplored();
    this.drawMini();
  }

  /**
   * Picks the music slot for the moment (battle, town, or the level's own),
   * then plays the adventure's track for it - or the game's default.
   */
  private updateMusic(): void {
    const lvl = this.level;
    let slot: string;
    if (this.fight) slot = 'battle';
    else if (this.shop || isSafe(lvl, this.hero.pos.x, this.hero.pos.y)) slot = 'town';
    else if (lvl.def.music && typeof lvl.def.music === 'object') slot = `level:${lvl.n}`;
    else slot = lvl.def.music ?? (lvl.depth >= 5 ? 'abyss' : 'depths');
    const custom = this.assets.music[slot];
    if (custom) {
      this.sfx.playTrack(custom.key, custom.track);
      return;
    }
    const DEFAULTS: Record<string, MusicKey> = { battle: 'realmBattle', town: 'realmTown', depths: 'realmDepths', abyss: 'realmAbyss' };
    this.sfx.playMusic(DEFAULTS[slot] ?? (lvl.depth >= 5 ? 'realmAbyss' : 'realmDepths'));
  }

  // --- Messages + menus ----------------------------------------------------------

  private say(...lines: string[]): void {
    this.log.push(...lines);
    this.log = this.log.slice(-6);
    if (!this.menu) this.renderLog();
  }

  private renderLog(): void {
    this.clearMenuTexts();
    this.logText.setVisible(true).setText(this.log.join('\n'));
  }

  private clearMenuTexts(): void {
    this.menuTexts.forEach((t) => t.destroy());
    this.menuTexts = [];
  }

  private openMenu(m: Menu): void {
    this.menu = m;
    this.clearMenuTexts();
    this.logText.setVisible(false);
    const font = this.logText.style.fontSize as string;
    const size = parseInt(font, 10);
    let y = this.logText.y;
    const x = this.logText.x;
    const add = (text: string, color: string) => {
      const t = this.add.text(x, y, text, { fontFamily: 'monospace', fontSize: font, color, wordWrap: { width: VW * this.viewScale } });
      this.menuTexts.push(t);
      y += t.height + 2;
    };
    if (m.title) add(m.title, '#f8d870');
    for (const l of m.lines) add(l, '#e8e8e8');
    const colW = (VW * this.viewScale) / 2;
    const twoCol = m.options.length > 4;
    const startY = y;
    this.optionTexts = [];
    m.options.forEach((o, i) => {
      const col = twoCol ? i % 2 : 0;
      const row = twoCol ? Math.floor(i / 2) : i;
      const t = this.add
        .text(x + col * colW, startY + row * (size + 5), '', { fontFamily: 'monospace', fontSize: font })
        .setInteractive({ useHandCursor: !o.disabled });
      t.on('pointerover', () => this.highlightOption(i));
      t.on('pointerdown', () => this.choose(o));
      this.menuTexts.push(t);
      this.optionTexts.push(t);
    });
    // The highlight starts on the first option you can take (Enter / A picks it).
    const first = m.options.findIndex((o) => !o.disabled);
    this.highlightOption(first >= 0 ? first : 0);
    setPadProfile(this, MENU_PROFILE);
  }

  private highlightOption(i: number): void {
    if (!this.menu) return;
    this.menuSel = i;
    this.menu.options.forEach((o, j) => {
      const on = j === i;
      this.optionTexts[j]?.setText(`${on ? '>' : ' '}${o.key}) ${o.label}`).setColor(o.disabled ? (on ? '#a0a0a0' : '#686868') : on ? '#ffffff' : '#88d8ff');
    });
  }

  /** Arrow keys / D-pad in a menu: up / down a row (two-column menus: left / right too), skipping greyed-out options. */
  private moveMenuSel(step: number): void {
    const opts = this.menu!.options;
    const n = opts.length;
    let i = this.menuSel;
    for (let tries = 0; tries < n; tries++) {
      i = (((i + step) % n) + n) % n;
      if (!opts[i].disabled) break;
    }
    if (i !== this.menuSel) this.sfx.play('realmBlip');
    this.highlightOption(i);
  }

  private closeMenu(): void {
    this.menu = null;
    setPadProfile(this, UNDERREALM_PAD);
    this.renderLog();
  }

  private choose(o: MenuOption): void {
    if (o.disabled) {
      this.sfx.play('realmDenied');
      return;
    }
    this.sfx.play('realmBlip');
    o.action();
    this.refreshHud();
  }

  private onKey(ev: KeyboardEvent): void {
    const k = ev.key.toLowerCase();
    this.pressed.add(k);
    this.time.delayedCall(160, () => this.pressed.delete(k));
    if (k === 'm' && !this.menu) {
      this.showMap = !this.showMap;
      this.drawBigMap();
      return;
    }
    if (k === 'n' && ev.shiftKey) {
      this.sound.mute = !this.sound.mute;
      saveMuted(this.sound.mute);
      this.say(this.sound.mute ? 'Sound off.' : 'Sound on.');
      return;
    }
    if (this.menu) {
      const twoCol = this.menu.options.length > 4;
      const moves: Record<string, number> = { arrowup: twoCol ? -2 : -1, arrowdown: twoCol ? 2 : 1, arrowleft: twoCol ? -1 : 0, arrowright: twoCol ? 1 : 0 };
      if (moves[k]) {
        this.moveMenuSel(moves[k]);
        return;
      }
      const opt = this.menu.options.find((o) => o.key.toLowerCase() === k) ?? (k === 'enter' || k === ' ' ? (ev.repeat ? undefined : this.menu.options[this.menuSel]) : undefined);
      if (opt) this.choose(opt);
      else if (k === 'escape') {
        const leave = this.menu.options.find((o) => /leave|close|resume|continue|stay|forget|farewell|back|not yet|turn back/i.test(o.label));
        if (leave) this.choose(leave);
      }
      return;
    }
    if (this.anim) return;
    if (k === 'i') this.openInventory();
    else if (k === 'f') this.search();
    else if (k === 'escape') this.openPauseMenu();
  }

  // --- Main loop --------------------------------------------------------------------

  update(time: number, delta: number): void {
    const dt = delta / 1000;
    if (this.anim) {
      const a = this.anim;
      a.t = Math.min(1, a.t + dt / a.dur);
      const e = a.t < 0.5 ? 2 * a.t * a.t : 1 - (-2 * a.t + 2) ** 2 / 2;
      this.camX = a.fx + (a.tx - a.fx) * e;
      this.camY = a.fy + (a.ty - a.fy) * e;
      this.camA = a.fa + (a.ta - a.fa) * e;
      if (a.t >= 1) {
        this.anim = null;
        this.camA = angleOf(this.hero.pos.dir);
        if (a.fx !== a.tx || a.fy !== a.ty) this.arrive();
      }
    } else if (!this.menu) {
      this.pollMovement();
    }
    // Keycaps light up for tapped keys and held movement keys.
    const held = new Set(this.pressed);
    const k = this.keys;
    if (k.up.isDown || k.w.isDown) held.add('w');
    if (k.down.isDown || k.s.isDown) held.add('s');
    if (k.left.isDown || k.a.isDown) held.add('a');
    if (k.right.isDown || k.d.isDown) held.add('d');
    if (k.q.isDown) held.add('q');
    if (k.e.isDown) held.add('e');
    this.lightKeys(held);

    this.renderView(time);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      this.view.setPosition(this.viewX + (Math.random() - 0.5) * 32 * this.shake, this.viewY + (Math.random() - 0.5) * 24 * this.shake);
    } else {
      this.view.setPosition(this.viewX, this.viewY);
    }
    if (this.fight) {
      this.fight.monHitFlash = Math.max(0, this.fight.monHitFlash - dt * 3);
      this.fight.heroHitFlash = Math.max(0, this.fight.heroHitFlash - dt * 3);
      this.fight.lunge = Math.max(0, this.fight.lunge - dt * 2.5);
      this.flashRect.setAlpha(this.fight.heroHitFlash * 0.35);
    } else {
      this.flashRect.setAlpha(0);
    }
  }

  private pollMovement(): void {
    const k = this.keys;
    const h = this.hero;
    if (k.up.isDown || k.w.isDown) this.tryMove(h.pos.dir, true);
    else if (k.down.isDown || k.s.isDown) this.tryMove(((h.pos.dir + 2) % 4) as Dir, false);
    else if ((k.left.isDown || k.a.isDown) && k.shift.isDown) this.tryMove(((h.pos.dir + 3) % 4) as Dir, false);
    else if ((k.right.isDown || k.d.isDown) && k.shift.isDown) this.tryMove(((h.pos.dir + 1) % 4) as Dir, false);
    else if (k.left.isDown || k.a.isDown) this.turn(-1);
    else if (k.right.isDown || k.d.isDown) this.turn(1);
    else if (k.q.isDown) this.tryMove(((h.pos.dir + 3) % 4) as Dir, false);
    else if (k.e.isDown) this.tryMove(((h.pos.dir + 1) % 4) as Dir, false);
  }

  private turn(d: number): void {
    const h = this.hero;
    const from = angleOf(h.pos.dir);
    h.pos.dir = ((((h.pos.dir + d) % 4) + 4) % 4) as Dir;
    this.anim = { fx: this.camX, fy: this.camY, tx: this.camX, ty: this.camY, fa: from, ta: from + (d * Math.PI) / 2, t: 0, dur: 0.18 };
    this.refreshHud();
  }

  private tryMove(dir: Dir, forward: boolean): void {
    const h = this.hero;
    const nx = h.pos.x + DIR_DX[dir];
    const ny = h.pos.y + DIR_DY[dir];
    const t = tileAt(this.level, nx, ny);
    if (isSolidTile(t)) {
      if (forward) this.interactWall(t, nx, ny);
      else this.bump();
      return;
    }
    h.pos.x = nx;
    h.pos.y = ny;
    this.sfx.play('realmStep');
    const a = angleOf(h.pos.dir);
    this.anim = { fx: this.camX, fy: this.camY, tx: nx + 0.5, ty: ny + 0.5, fa: a, ta: a, t: 0, dur: 0.24 };
  }

  private bump(): void {
    this.sfx.play('realmBump');
    this.shake = 0.12;
    this.anim = { fx: this.camX, fy: this.camY, tx: this.camX, ty: this.camY, fa: this.camA, ta: this.camA, t: 0, dur: 0.2 };
  }

  private levelLabel(n: number): string {
    return this.pack.levels[n - 1]?.name ?? `level ${n}`;
  }

  private interactWall(t: TileDef, x: number, y: number): void {
    const h = this.hero;
    switch (t.type) {
      case 'door':
        this.openPassage(x, y);
        this.say('The door creaks open.');
        return;
      case 'locked':
        if (h.keys > 0) {
          h.keys--;
          this.openPassage(x, y);
          this.say('Your key turns in the lock. The iron door swings open.');
        } else {
          this.bump();
          this.say('The iron door is locked. Its key must be somewhere on this level.');
        }
        return;
      case 'secret':
        this.openPassage(x, y);
        this.sfx.play('realmSpell');
        this.say('The wall gives way under your hand - a secret passage!');
        return;
      case 'hiddenExit':
        this.revealExit(x, y);
        return;
      case 'exit':
        this.tryExit();
        return;
      case 'stairsDown':
        if (this.level.n >= this.pack.levels.length) {
          this.bump();
          return;
        }
        this.openMenu({
          title: 'A stairway spirals down into the dark.',
          lines: [`It leads to ${this.levelLabel(this.level.n + 1)}.`],
          options: [
            { key: '1', label: 'Go down', action: () => this.changeLevel(this.level.n + 1) },
            { key: '2', label: 'Stay here', action: () => this.closeMenu() },
          ],
        });
        return;
      case 'stairsUp':
        if (this.level.n === 1) {
          this.bump();
          this.say('Rubble chokes the stairway above. The only way out is deeper down.');
          return;
        }
        this.openMenu({
          title: 'A stairway leads up.',
          lines: [`Back to ${this.levelLabel(this.level.n - 1)}.`],
          options: [
            { key: '1', label: 'Go up', action: () => this.changeLevel(this.level.n - 1) },
            { key: '2', label: 'Stay here', action: () => this.closeMenu() },
          ],
        });
        return;
      case 'shop':
        if (t.shop) this.enterShop(t.shop);
        return;
      default:
        this.bump();
        if (t.message) this.say(t.message);
    }
  }

  private openPassage(x: number, y: number): void {
    this.level.grid[y][x] = '.';
    (this.hero.opened[this.level.n] ??= []).push(tileKey(x, y));
    this.sfx.play('chestOpen');
    this.markExplored();
    this.drawMini();
  }

  private revealExit(x: number, y: number): void {
    this.level.grid[y][x] = 'E';
    (this.hero.revealed![this.level.n] ??= []).push(tileKey(x, y));
    this.sfx.play('realmLevelUp');
    this.shake = 0.3;
    this.say('The stones grind aside, revealing a shimmering gate!');
    saveHero(this.hero);
  }

  /** F: feel the walls ahead and to either side for hidden passages. */
  private search(): void {
    const h = this.hero;
    h.minutes += 2;
    const dirs = [h.pos.dir, (h.pos.dir + 1) % 4, (h.pos.dir + 3) % 4];
    const chance = Math.min(0.95, 0.55 + (h.stats.INT + h.stats.WIS - 20) * 0.02);
    for (const d of dirs) {
      const x = h.pos.x + DIR_DX[d];
      const y = h.pos.y + DIR_DY[d];
      const t = tileAt(this.level, x, y);
      if ((t.type === 'secret' || t.type === 'hiddenExit') && Math.random() < chance) {
        if (t.type === 'secret') {
          this.openPassage(x, y);
          this.say('You find a loose stone... and a hidden passage opens!');
        } else this.revealExit(x, y);
        this.refreshHud();
        return;
      }
    }
    this.sfx.play('realmBump');
    this.say('You search the walls around you but find nothing.');
  }

  private tryExit(): void {
    const h = this.hero;
    if (this.pack.goal?.requires === 'crystal' && !h.crystal) {
      this.bump();
      const g = this.pack.goal;
      this.say(g.barred ?? (g.item ? `The way is barred. You cannot leave without ${this.relicName()}.` : 'The gate is sealed. A crystal-shaped socket sits empty in the arch...'));
      return;
    }
    this.openMenu({
      title: 'Light spills from the gate.',
      lines: [h.crystal ? `${this.relicTitle()} ${this.pack.goal?.item ? 'is with you' : 'blazes in answer'}. The way out lies open.` : 'The way out lies open.'],
      options: [
        { key: '1', label: 'Step through', action: () => this.victory() },
        { key: '2', label: 'Not yet', action: () => this.closeMenu() },
      ],
    });
  }

  private changeLevel(n: number): void {
    const down = n > this.level.n;
    this.sfx.play('stairsDescend');
    this.closeMenu();
    this.enterLevel(n, down ? 'down' : 'up');
    this.say(`You ${down ? 'descend' : 'climb'} to ${this.level.name}.`);
    if (this.level.boss && !this.isSlain(this.level.boss.x, this.level.boss.y)) this.say('The air is cold and still. Something ancient waits here.');
    if (this.levelHasExit()) this.say(this.hero.crystal ? `${this.relicTitle()} stirs...` : 'Somewhere in these halls lies the way out.');
    saveHero(this.hero);
    this.refreshHud();
  }

  private levelHasExit(): boolean {
    return this.level.grid.some((row) => row.some((ch) => ['hiddenExit', 'exit'].includes(this.level.legend[ch]?.type ?? '')));
  }

  /** The relic a boss leaves on its throne (the pack can rename it). */
  private relicName(): string {
    return this.pack.goal?.item ?? 'the Crystal of Echoes';
  }

  private relicTitle(): string {
    const n = this.relicName();
    return n.charAt(0).toUpperCase() + n.slice(1);
  }

  private isSlain(x: number, y: number): boolean {
    return (this.hero.slain![this.level.n] ?? []).includes(tileKey(x, y));
  }

  // --- Arriving on a tile: time, survival, events -------------------------------------

  private arrive(): void {
    const h = this.hero;
    const lvl = this.level;
    const safe = isSafe(lvl, h.pos.x, h.pos.y);
    h.steps++;
    h.minutes += 2;
    h.blessed = Math.max(0, h.blessed - 1);
    this.markExplored();
    this.drawMini();
    this.updateMusic();

    h.hunger++;
    h.thirst++;
    if (h.hunger >= HUNGER_STEPS) {
      if (h.food > 0) {
        h.food--;
        h.hunger = 0;
        this.sfx.play('realmEat');
        this.say('You eat a food packet.');
      } else if (h.steps % 4 === 0) {
        h.hp--;
        this.say('You are starving!');
      }
    }
    if (h.thirst >= THIRST_STEPS) {
      if (h.water > 0) {
        h.water--;
        h.thirst = 0;
        this.say('You drink from a water flask.');
      } else if (h.steps % 4 === 0) {
        h.hp--;
        this.say('You are parched with thirst!');
      }
    }
    if (!safe && !lvl.def.daylight) {
      if (h.torchLeft > 0) {
        h.torchLeft--;
        if (h.torchLeft === 0) {
          if (h.torches > 0) {
            h.torches--;
            h.torchLeft = TORCH_STEPS;
            this.say('Your torch burns out. You light a fresh one.');
          } else this.say('Your last torch gutters out! Darkness closes in...');
        } else if (h.torchLeft === 30 && h.torches === 0) this.say('Your torch is burning low, and you have no spare!');
      } else if (h.torches > 0) {
        h.torches--;
        h.torchLeft = TORCH_STEPS;
        this.say('You light a torch.');
      }
    }
    if (h.poisoned && h.steps % 6 === 0) {
      h.hp--;
      if (h.steps % 24 === 0) this.say('The poison burns in your veins.');
    }
    if (!h.poisoned && h.hunger < HUNGER_STEPS && h.thirst < THIRST_STEPS && h.steps % 12 === 0) h.hp = Math.min(maxHp(h), h.hp + 1);
    if (h.hp <= 0) {
      this.die();
      return;
    }

    // The crystal senses the way out.
    if (h.crystal && h.steps % 7 === 0 && this.pack.goal?.hum !== false) this.crystalHum();

    const key = tileKey(h.pos.x, h.pos.y);
    const t = tileAt(lvl, h.pos.x, h.pos.y);
    const msg = lvl.messages.get(key) ?? t.message;
    if (msg) this.say(msg);
    const looted = (h.looted[lvl.n] ?? []).includes(key);
    const guardian = this.adjacentGuardian();
    if (t.type === 'chest' && !looted) {
      this.openChest(key);
    } else if (t.type === 'fountain') {
      this.fountain();
    } else if (guardian) {
      this.fightAt = guardian.key;
      this.startEncounter(guardian.monster, false);
    } else if (t.type === 'throne' && lvl.boss && this.isSlain(lvl.boss.x, lvl.boss.y) && this.pack.goal?.requires === 'crystal' && !h.crystal) {
      h.crystal = true;
      this.sfx.play('realmLevelUp');
      this.say(...(this.pack.goal?.taken ? [this.pack.goal.taken] : ['You lift the Crystal of Echoes from the throne. It hums in your hands!', 'Now find the way out, below.']));
      saveHero(h);
    } else if (!safe) {
      const rate = lvl.def.encounters?.rate ?? 0.03 + lvl.depth * 0.004;
      if (Math.random() < rate) this.randomEncounter();
    }
    this.refreshHud();
  }

  /** A guardian or boss next to (or on) your tile that hasn't been beaten yet. */
  private adjacentGuardian(): { key: string; monster: PackMonster } | null {
    const h = this.hero;
    const lvl = this.level;
    const spots: { x: number; y: number; id: string }[] = [];
    if (lvl.boss) spots.push({ ...lvl.boss, id: lvl.boss.monster });
    for (const [k, id] of lvl.guardians) {
      const [x, y] = k.split(',').map(Number);
      spots.push({ x, y, id });
    }
    for (const s of spots) {
      if (Math.abs(s.x - h.pos.x) + Math.abs(s.y - h.pos.y) > 1 || this.isSlain(s.x, s.y)) continue;
      const m = this.monsters.get(s.id);
      if (m) return { key: tileKey(s.x, s.y), monster: m };
    }
    return null;
  }

  private crystalHum(): void {
    const h = this.hero;
    let best = Infinity;
    const g = this.level.grid;
    for (let y = 0; y < g.length; y++)
      for (let x = 0; x < g[y].length; x++) {
        const type = this.level.legend[g[y][x]]?.type;
        if (type === 'hiddenExit' || type === 'exit') best = Math.min(best, Math.abs(x - h.pos.x) + Math.abs(y - h.pos.y));
      }
    if (!Number.isFinite(best)) return;
    const r = this.relicTitle();
    if (best <= 3) this.say(`${r} blazes with light - the way out is right here!`);
    else if (best <= 8) this.say(`${r} hums loudly. You are close.`);
    else if (best <= 15) this.say(`${r} hums softly.`);
    else this.say(`${r} is quiet. The way out is far from here.`);
  }

  private openChest(key: string): void {
    const h = this.hero;
    const c = this.level.chests.get(key) ?? { gold: 5 };
    (h.looted[this.level.n] ??= []).push(key);
    this.sfx.play('chestOpen');
    const found: string[] = [];
    if (c.gold) {
      h.gold += c.gold;
      found.push(`${c.gold} gold`);
      this.sfx.play('pickupGold');
    }
    if (c.item === 'potion') {
      h.potions++;
      found.push('a healing potion');
    } else if (c.item === 'torches') {
      h.torches += 2;
      found.push('two torches');
    } else if (c.item === 'food') {
      h.food += 2;
      h.water += 2;
      found.push('rations and water');
    } else if (c.item === 'key') {
      h.keys++;
      found.push('an iron key');
    }
    this.say(`You open a chest and find ${found.join(', ') || 'nothing'}.`);
    if ((c.item === 'weapon' || c.item === 'armor') && c.gear) this.offerGear(c.item, c.gear);
  }

  private offerGear(kind: 'weapon' | 'armor', id: string): void {
    const h = this.hero;
    const isWeapon = kind === 'weapon';
    const w = WEAPONS.find((x) => x.id === id);
    const a = ARMORS.find((x) => x.id === id);
    const def = (isWeapon ? w : a);
    if (!def) return;
    const cur = isWeapon ? weaponOf(h) : armorOf(h);
    const desc = isWeapon ? `${def.name} (damage ${w!.min}-${w!.max})` : `${def.name} (armour ${a!.ac})`;
    this.openMenu({
      title: `Inside lies a ${desc}!`,
      lines: [`You are using: ${cur.name}.`],
      options: [
        {
          key: '1',
          label: `Take the ${def.name}`,
          action: () => {
            if (isWeapon) h.weapon = id;
            else h.armor = id;
            this.closeMenu();
            this.say(`You equip the ${def.name}.`);
          },
        },
        { key: '2', label: 'Leave it', action: () => this.closeMenu() },
      ],
    });
  }

  private fountain(): void {
    this.openMenu({
      title: 'An old stone fountain bubbles here.',
      lines: ['The water glitters strangely in your torchlight.'],
      options: [
        {
          key: '1',
          label: 'Drink',
          action: () => {
            const h = this.hero;
            this.sfx.play('realmFountain');
            const r = Math.random();
            h.thirst = 0;
            h.water = Math.max(h.water, 3);
            if (r < 0.4) {
              h.hp = maxHp(h);
              this.say('Cool and pure! You feel refreshed and whole. (Flasks refilled.)');
            } else if (r < 0.6) {
              const s = STATS[Math.floor(Math.random() * STATS.length)];
              h.stats[s]++;
              this.say(`A tingle runs through you. Your ${s} rises to ${h.stats[s]}!`);
            } else if (r < 0.8) {
              h.poisoned = true;
              this.say('It tastes foul... You have been poisoned! (Flasks refilled.)');
            } else {
              h.mana = maxMana(h);
              h.gold += 10;
              this.say('You find a few coins at the bottom as you drink. (Flasks refilled.)');
            }
            this.closeMenu();
          },
        },
        { key: '2', label: 'Leave it', action: () => this.closeMenu() },
      ],
    });
  }

  // --- Encounters ------------------------------------------------------------------

  private randomEncounter(): void {
    const depth = this.level.depth;
    const peddler = this.monsters.get('peddler');
    if (peddler && Math.random() < 0.08) {
      this.startEncounter(peddler, false);
      return;
    }
    const named = this.level.def.encounters?.monsters;
    const eligible = (m: PackMonster) => m.special !== 'friendly' && m.special !== 'boss';
    let pool = [...this.monsters.values()].filter((m) => eligible(m) && (named ? named.includes(m.id) : m.levels.includes(depth)));
    if (!pool.length) pool = [...this.monsters.values()].filter((m) => eligible(m) && m.levels.length > 0);
    if (!pool.length) return;
    this.startEncounter(pool[Math.floor(Math.random() * pool.length)], Math.random() < 0.2);
  }

  private startEncounter(def: PackMonster, ambushed: boolean): void {
    this.fight = startFight(def, this.level.depth);
    this.encounterSprite = def.sprite;
    this.sfx.play('realmEncounter');
    this.updateMusic();
    if (def.special === 'friendly') {
      this.peddlerMenu();
      return;
    }
    const lines = [def.intro];
    if (ambushed) {
      lines.push('It attacks before you can react!');
      const r = ambush(this.hero, this.fight);
      lines.push(...r.lines);
      this.playFightSfx(r);
      if (r.outcome === 'dead') {
        this.endFight(r, lines);
        return;
      }
    }
    this.fightMenu(lines);
  }

  private fightMenu(lines: string[]): void {
    const f = this.fight!;
    const h = this.hero;
    const bribe = bribeCost(h, f);
    const opts: MenuOption[] = [
      { key: '1', label: 'Attack', action: () => this.fightTurn('attack') },
      { key: '2', label: 'Charge', action: () => this.fightTurn('charge') },
      { key: '3', label: 'Parry', action: () => this.fightTurn('parry') },
      { key: '4', label: 'Trick', action: () => this.fightTurn('trick') },
      { key: '5', label: bribe ? `Offer ${bribe} gold` : 'Offer gold', action: () => this.fightTurn('offer'), disabled: bribe > 0 && h.gold < bribe },
      { key: '6', label: `Potion (${h.potions})`, action: () => this.fightTurn('potion'), disabled: h.potions === 0 },
      { key: '7', label: 'Cast a spell', action: () => this.spellMenu(), disabled: h.spells.length === 0 },
      { key: '8', label: 'Flee', action: () => this.fightTurn('flee') },
    ];
    const bar = Math.max(0, Math.round((f.hp / f.maxHp) * 10));
    this.openMenu({ title: `${f.mon.name}  [${'#'.repeat(bar)}${'.'.repeat(10 - bar)}]`, lines: lines.slice(-4), options: opts });
  }

  private spellMenu(): void {
    const h = this.hero;
    const opts: MenuOption[] = h.spells.map((id, i) => ({
      key: `${i + 1}`,
      label: `${SPELLS[id].name} (${SPELLS[id].cost} mana)`,
      action: () => this.fightTurn(`spell:${id}` as FightAction),
      disabled: h.mana < SPELLS[id].cost,
    }));
    opts.push({ key: `${opts.length + 1}`, label: 'Back', action: () => this.fightMenu([]) });
    this.openMenu({ title: `Cast which spell? (mana ${h.mana}/${maxMana(h)})`, lines: [], options: opts });
  }

  private playFightSfx(r: TurnResult): void {
    for (const s of r.sfx) {
      if (s === 'hit') this.sfx.play('playerAttack');
      else if (s === 'miss') this.sfx.play('realmMiss');
      else if (s === 'hurt') {
        this.sfx.play('playerHurt');
        this.shake = 0.25;
      } else if (s === 'spell') this.sfx.play('realmSpell');
      else if (s === 'coins') this.sfx.play('pickupGold');
      else if (s === 'potion') this.sfx.play('pickupPotion');
      else if (s === 'kill') this.sfx.play('enemyDeath');
    }
  }

  private fightTurn(action: FightAction): void {
    const r = heroTurn(this.hero, this.fight!, action);
    this.playFightSfx(r);
    if (r.outcome === 'continue') this.fightMenu(r.lines);
    else this.endFight(r, r.lines);
  }

  private endFight(r: TurnResult, lines: string[]): void {
    const f = this.fight!;
    const h = this.hero;
    if (r.outcome === 'dead') {
      this.fight = null;
      this.fightAt = null;
      this.encounterSprite = null;
      this.die(lines);
      return;
    }
    if (r.outcome === 'won') {
      this.sfx.play('realmFightWon');
      if (this.fightAt) (h.slain![this.level.n] ??= []).push(this.fightAt);
      if (f.mon.special === 'boss') {
        h.bossDead = true;
        if (this.pack.goal?.requires === 'crystal' && !h.crystal) lines.push(this.pack.goal?.item ? `${f.mon.name} falls. ${this.relicTitle()} is yours to claim.` : `${f.mon.name} crumbles to dust. On the throne, a crystal glows...`);
        saveHero(h);
      }
      if (h.xp >= nextLevelXp(h) && h.level < MAX_LEVEL) lines.push('You feel ready to train at the Guild.');
    } else if (this.fightAt) {
      // Got away from a guardian: step back so you don't walk straight into it again.
      this.stepBack();
    }
    this.fight = null;
    this.fightAt = null;
    this.encounterSprite = null;
    this.openMenu({
      title: r.outcome === 'won' ? 'Victory!' : r.outcome === 'bribed' ? 'Paid off.' : 'You got away.',
      lines: lines.slice(-5),
      options: [
        {
          key: '1',
          label: 'Continue',
          action: () => {
            this.closeMenu();
            this.updateMusic();
          },
        },
      ],
    });
    this.updateMusic();
  }

  private stepBack(): void {
    const h = this.hero;
    const back = ((h.pos.dir + 2) % 4) as Dir;
    const nx = h.pos.x + DIR_DX[back];
    const ny = h.pos.y + DIR_DY[back];
    if (isSolidAt(this.level, nx, ny)) return;
    h.pos.x = nx;
    h.pos.y = ny;
    this.camX = nx + 0.5;
    this.camY = ny + 0.5;
  }

  private peddlerMenu(): void {
    const h = this.hero;
    const c = charm(h);
    const price = (p: number) => Math.max(1, Math.round(p * 1.4 * c));
    const buy = (label: string, cost: number, give: () => void): MenuOption => ({
      key: '',
      label: `${label} - ${cost}g`,
      disabled: h.gold < cost,
      action: () => {
        h.gold -= cost;
        give();
        this.sfx.play('pickupGold');
        this.peddlerMenu();
      },
    });
    const opts = [
      buy('Healing potion', price(PRICES.potion), () => h.potions++),
      buy('Torch', price(PRICES.torch), () => h.torches++),
      buy('Food packet', price(PRICES.food), () => h.food++),
      buy('Water flask', price(PRICES.water), () => h.water++),
      {
        key: '',
        label: 'Say farewell',
        action: () => {
          this.fight = null;
          this.encounterSprite = null;
          this.closeMenu();
          this.say('The peddler shuffles off into the dark.');
          this.updateMusic();
        },
      },
    ].map((o, i) => ({ ...o, key: `${i + 1}` }));
    this.openMenu({ title: 'Wandering Peddler', lines: ['"Supplies, traveller? A bit dear, but you won\'t find a shop down here."', `Your gold: ${h.gold}`], options: opts });
  }

  // --- Shops ------------------------------------------------------------------------

  private enterShop(id: ShopId): void {
    const def = SHOP_DEFS[id];
    this.shop = { id, bg: this.drawShopBackground(id), keeper: this.assets.sprite(def.keeper).canvas };
    this.shopMood = 1;
    this.sfx.play('chestOpen');
    this.updateMusic();
    this.say(`You enter ${def.name}.`);
    this.shopMenu(id, def.greeting);
  }

  private leaveShop(): void {
    this.shop = null;
    this.closeMenu();
    this.updateMusic();
  }

  private drawShopBackground(id: ShopId): HTMLCanvasElement {
    const def = SHOP_DEFS[id];
    const cv = document.createElement('canvas');
    cv.width = VW;
    cv.height = VH;
    const c = cv.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    c.fillStyle = def.wall;
    c.fillRect(0, 0, VW, VH);
    for (let y = 0; y < 130; y += 12) {
      c.fillStyle = 'rgba(0,0,0,0.18)';
      c.fillRect(0, y, VW, 2);
    }
    const wares: Record<ShopId, string[]> = {
      tavern: ['#a86c34', '#58a038', '#c8a040', '#7c3c24'],
      provisioner: ['#e8c070', '#8c6c3c', '#c84838', '#f8e8a8'],
      smithy: ['#c8c8d0', '#9c9ca8', '#7c7c88', '#d8d8e0'],
      temple: ['#f8d800', '#e8e0c8', '#f8f0d8', '#c8a040'],
      guild: ['#58b8ff', '#c858f8', '#f8d800', '#48d848'],
    };
    for (const sy of [36, 72]) {
      c.fillStyle = def.shelf;
      c.fillRect(20, sy, 280, 6);
      for (let x = 28; x < 292; x += 18) {
        c.fillStyle = wares[id][((x / 18 + sy) % 4) | 0];
        if (id === 'smithy') c.fillRect(x + 4, sy - 22, 3, 22);
        else c.fillRect(x, sy - 12, 10, 12);
      }
    }
    if (id === 'tavern' || id === 'smithy') {
      const g = c.createRadialGradient(270, 110, 4, 270, 110, 50);
      g.addColorStop(0, 'rgba(255,170,60,0.9)');
      g.addColorStop(1, 'rgba(255,120,20,0)');
      c.fillStyle = g;
      c.fillRect(200, 60, 120, 100);
    }
    c.fillStyle = '#f8d870';
    c.font = 'bold 12px monospace';
    c.textAlign = 'center';
    c.fillText(def.name.toUpperCase(), VW / 2, 16);
    return cv;
  }

  private drawShop(time: number): void {
    const ctx = this.viewTex.getContext();
    const s = this.shop!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(s.bg, 0, 0);
    // The shopkeeper breathes and shifts behind the counter.
    const bob = Math.round(Math.sin(time / 420) * 2);
    ctx.drawImage(s.keeper, 90, 22 + bob, 140, 140);
    const def = SHOP_DEFS[s.id];
    ctx.fillStyle = def.counter;
    ctx.fillRect(0, 130, VW, 70);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, 130, VW, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let x = 0; x < VW; x += 40) ctx.fillRect(x, 134, 2, 66);
    this.viewTex.refresh();
  }

  private price(base: number): number {
    return Math.max(1, Math.round(base * charm(this.hero)));
  }

  private shopMenu(id: ShopId, note = ''): void {
    const h = this.hero;
    const def = SHOP_DEFS[id];
    const buy = (label: string, cost: number, give: () => string | void): MenuOption => ({
      key: '',
      label: `${label} - ${cost}g`,
      disabled: h.gold < cost,
      action: () => {
        h.gold -= cost;
        this.sfx.play('pickupGold');
        const msg = give();
        this.shopMenu(id, msg || `${def.keeperName} hands it over.`);
      },
    });
    const leave: MenuOption = { key: '', label: 'Leave', action: () => this.leaveShop() };
    let opts: MenuOption[] = [];
    switch (id) {
      case 'tavern':
        opts = [
          buy('Food packet', this.price(PRICES.food), () => void h.food++),
          buy('Water flask', this.price(PRICES.water), () => void h.water++),
          buy('A mug of ale', this.price(PRICES.ale), () => {
            const r = Math.random();
            if (r < 0.5) {
              h.hp = Math.min(maxHp(h), h.hp + 3);
              return 'The ale warms you through. (+3 HP)';
            }
            if (r < 0.8) return `A regular leans over: "${RUMORS[Math.floor(Math.random() * RUMORS.length)]}"`;
            h.hp = Math.max(1, h.hp - 1);
            return 'Strong stuff! The room spins a little.';
          }),
          buy('Rent a room and rest', this.price(PRICES.room), () => {
            h.hp = maxHp(h);
            h.mana = maxMana(h);
            h.hunger = 0;
            h.thirst = 0;
            const day = Math.floor(h.minutes / 1440);
            h.minutes = (day + 1) * 1440 + 7 * 60;
            saveHero(h);
            return 'You sleep soundly and wake refreshed. (Game saved.)';
          }),
          buy('Ask about rumours', 1, () => `"${RUMORS[Math.floor(Math.random() * RUMORS.length)]}"`),
          leave,
        ];
        break;
      case 'provisioner':
        opts = [
          buy('Torch', this.price(PRICES.torch), () => void h.torches++),
          buy('Food packet', this.price(PRICES.food), () => void h.food++),
          buy('Water flask', this.price(PRICES.water), () => void h.water++),
          buy('Healing potion', this.price(PRICES.potion), () => void h.potions++),
          leave,
        ];
        break;
      case 'temple': {
        const missing = maxHp(h) - h.hp;
        const heal = this.price(Math.max(1, missing) * PRICES.heal);
        opts = [
          {
            ...buy(`Healing (${missing} HP)`, heal, () => {
              h.hp = maxHp(h);
              return 'Warm light closes your wounds.';
            }),
            disabled: missing === 0 || h.gold < heal,
          },
          {
            ...buy('Cure poison', this.price(PRICES.cure), () => {
              h.poisoned = false;
              return 'The poison drains away.';
            }),
            disabled: !h.poisoned || h.gold < this.price(PRICES.cure),
          },
          buy('Blessing of the Dawn', this.price(PRICES.blessing), () => {
            h.blessed = 300;
            return 'You feel the light guide your hand. (+2 SKL for a while)';
          }),
          leave,
        ];
        break;
      }
      case 'guild': {
        const need = nextLevelXp(h);
        const fee = this.price(PRICES.train * h.level);
        const canTrain = h.level < MAX_LEVEL && h.xp >= need;
        opts = [
          { ...buy(h.level >= MAX_LEVEL ? 'Train (mastered)' : `Train to level ${h.level + 1}`, fee, () => this.levelUp()), disabled: !canTrain || h.gold < fee },
          ...(Object.keys(SPELLS) as SpellId[]).map((sid) => ({
            ...buy(`Learn ${SPELLS[sid].name}: ${SPELLS[sid].blurb}`, this.price(SPELLS[sid].price), () => {
              h.spells.push(sid);
              h.mana = maxMana(h);
              return `Master Veyl teaches you ${SPELLS[sid].name}.`;
            }),
            disabled: h.spells.includes(sid) || h.gold < this.price(SPELLS[sid].price),
          })),
          leave,
        ];
        if (!note || note === def.greeting) note = h.level >= MAX_LEVEL ? note : canTrain ? 'You are ready to train.' : `You need ${need - h.xp} more experience to train.`;
        break;
      }
      case 'smithy':
        this.smithyMenu(note);
        return;
    }
    opts = opts.map((o, i) => ({ ...o, key: `${i + 1}` }));
    this.openMenu({ title: `${def.name}  -  ${def.keeperName}`, lines: [note, `Your gold: ${h.gold}`].filter(Boolean), options: opts });
  }

  private levelUp(): string {
    const h = this.hero;
    const before = maxHp(h);
    h.level++;
    const picks = Phaser.Utils.Array.Shuffle([...STATS]).slice(0, 2);
    for (const s of picks) h.stats[s]++;
    h.hp += maxHp(h) - before;
    h.mana = maxMana(h);
    this.sfx.play('realmLevelUp');
    return `You are now level ${h.level}! ${picks.join(' and ')} +1, max HP ${maxHp(h)}.`;
  }

  private smithyMenu(note = ''): void {
    const h = this.hero;
    const def = SHOP_DEFS.smithy;
    const stock = [
      ...WEAPONS.filter((w) => w.price > 0 && w.id !== 'runeblade' && w.price > weaponOf(h).price),
      ...ARMORS.filter((a) => a.price > 0 && a.id !== 'mithril' && a.price > armorOf(h).price),
    ];
    const opts: MenuOption[] = stock.map((it, i) => {
      const ask = Math.round(this.price(it.price) / this.shopMood);
      const stat = 'min' in it ? `dmg ${it.min}-${it.max}` : `armour ${it.ac}`;
      return { key: `${i + 1}`, label: `${it.name} (${stat}) ${ask}g`, action: () => this.haggle(it.id, ask) };
    });
    opts.push({ key: `${opts.length + 1}`, label: 'Leave', action: () => this.leaveShop() });
    this.openMenu({
      title: `${def.name}  -  ${def.keeperName}`,
      lines: [note || def.greeting, `Your gold: ${h.gold}   Wielding: ${weaponOf(h).name}   Wearing: ${armorOf(h).name}`],
      options: opts,
    });
  }

  /** Alternate-Reality-style haggling: offer less, and the smith may take it - or take offence. */
  private haggle(itemId: string, ask: number): void {
    const h = this.hero;
    const item = WEAPONS.find((w) => w.id === itemId) ?? ARMORS.find((a) => a.id === itemId)!;
    const isWeapon = WEAPONS.some((w) => w.id === itemId);
    const old = isWeapon ? weaponOf(h) : armorOf(h);
    const tradeIn = Math.floor(old.price * 0.3);
    const buyAt = (price: number) => {
      const due = Math.max(0, price - tradeIn);
      if (h.gold < due) {
        this.sfx.play('realmDenied');
        this.smithyMenu(`"You can't afford it - even with ${tradeIn}g for your ${old.name}."`);
        return;
      }
      h.gold -= due;
      if (isWeapon) h.weapon = itemId;
      else h.armor = itemId;
      this.sfx.play('pickupGold');
      this.smithyMenu(`"A fine choice." You pay ${due}g${tradeIn ? ` (after ${tradeIn}g for your old ${old.name})` : ''} and take the ${item.name}.`);
    };
    const offer = (pct: number): MenuOption => {
      const amount = Math.round(ask * pct);
      return {
        key: '',
        label: `Offer ${amount}g`,
        action: () => {
          const base = pct >= 0.9 ? 0.8 : pct >= 0.75 ? 0.45 : 0.15;
          const p = base + (h.stats.CHR - 10) * 0.03 - (1 - this.shopMood) * 0.6;
          if (Math.random() < p) {
            buyAt(amount);
            return;
          }
          this.shopMood -= 0.15;
          if (this.shopMood < 0.5) {
            this.sfx.play('realmDenied');
            this.shop = null;
            this.closeMenu();
            this.updateMusic();
            this.say('"Insulting! Get out of my shop!" Hask throws you out.');
            return;
          }
          const counter = Math.round((ask + amount) / 2 + ask * 0.05);
          this.sfx.play('realmDenied');
          this.haggleMenu(item.name, counter, `Hask scowls. "${counter}, and not a copper less."`, offer, buyAt);
        },
      };
    };
    this.haggleMenu(item.name, ask, `"The ${item.name}? That'll be ${ask} gold."`, offer, buyAt);
  }

  private haggleMenu(name: string, ask: number, line: string, offer: (pct: number) => MenuOption, buyAt: (p: number) => void): void {
    const opts: MenuOption[] = [
      { key: '1', label: `Agree to ${ask}g`, action: () => buyAt(ask) },
      { ...offer(0.9), key: '2' },
      { ...offer(0.75), key: '3' },
      { ...offer(0.6), key: '4' },
      { key: '5', label: 'Forget it', action: () => this.smithyMenu() },
    ];
    this.openMenu({ title: `Haggling over the ${name}`, lines: [line, `Your gold: ${this.hero.gold}`], options: opts });
  }

  // --- Inventory, pause, death, victory ---------------------------------------------

  private openInventory(): void {
    const h = this.hero;
    const w = weaponOf(h);
    const a = armorOf(h);
    const spells = h.spells.map((s) => SPELLS[s].name).join(', ') || 'none';
    this.openMenu({
      title: 'Inventory',
      lines: [
        `Weapon: ${w.name} (${w.min}-${w.max})   Armour: ${a.name} (${a.ac})`,
        `Potions ${h.potions}   Keys ${h.keys}   Spells: ${spells}${h.crystal ? `   * ${this.relicTitle()} *` : ''}`,
        `Hunger ${Math.round((h.hunger / HUNGER_STEPS) * 100)}%   Thirst ${Math.round((h.thirst / THIRST_STEPS) * 100)}%   Torch ${h.torchLeft} steps`,
      ],
      options: [
        {
          key: '1',
          label: 'Drink a potion',
          disabled: h.potions === 0,
          action: () => {
            h.potions--;
            h.hp = Math.min(maxHp(h), h.hp + 15 + h.level * 3);
            h.poisoned = false;
            this.sfx.play('pickupPotion');
            this.openInventory();
          },
        },
        {
          key: '2',
          label: 'Eat now',
          disabled: h.food === 0,
          action: () => {
            h.food--;
            h.hunger = 0;
            this.sfx.play('realmEat');
            this.openInventory();
          },
        },
        {
          key: '3',
          label: 'Drink water now',
          disabled: h.water === 0,
          action: () => {
            h.water--;
            h.thirst = 0;
            this.openInventory();
          },
        },
        {
          key: '4',
          label: 'Cast Mend',
          disabled: !h.spells.includes('mend') || h.mana < SPELLS.mend.cost,
          action: () => {
            h.mana -= SPELLS.mend.cost;
            h.hp = Math.min(maxHp(h), h.hp + 10 + h.stats.WIS + h.level * 2);
            this.sfx.play('realmSpell');
            this.openInventory();
          },
        },
        { key: '5', label: 'Close', action: () => this.closeMenu() },
      ],
    });
  }

  private openPauseMenu(): void {
    this.openMenu({
      title: 'Paused',
      lines: [`${this.pack.name} - ${this.level.name}. ${timeString(this.hero)}. Kills: ${this.hero.kills}.`],
      options: [
        { key: '1', label: 'Resume', action: () => this.closeMenu() },
        {
          key: '2',
          label: 'Save game',
          action: () => {
            saveHero(this.hero);
            this.closeMenu();
            this.say('Game saved.');
          },
        },
        {
          key: '3',
          label: 'Save and quit to title',
          action: () => {
            saveHero(this.hero);
            this.scene.start('UnderrealmTitle');
          },
        },
        { key: '4', label: 'Quit to the arcade', action: () => this.scene.start('GameSelect') },
      ],
    });
  }

  private die(lines: string[] = []): void {
    this.sfx.stopMusic();
    this.sfx.play('playerDeath');
    this.sfx.play('realmDeath');
    const saved = loadHero();
    this.openMenu({
      title: 'You have died.',
      lines: [...lines.slice(-3), `Your adventure in ${this.pack.name} ends here...`],
      options: [
        {
          key: '1',
          label: 'Restore last save',
          disabled: !saved || saved.packId !== this.pack.id,
          action: () => this.scene.start('Underrealm', { hero: loadHero()!, pack: this.pack, assets: this.assets }),
        },
        { key: '2', label: 'Back to the title', action: () => this.scene.start('UnderrealmTitle') },
      ],
    });
  }

  private victory(): void {
    const h = this.hero;
    this.sfx.stopMusic();
    this.sfx.play('realmWin');
    // Back to the Hall between adventures, with this one ticked off.
    h.completed = [...new Set([...(h.completed ?? []), this.pack.id])];
    h.packId = '';
    h.pos = { level: 0, x: 0, y: 0, dir: 2 };
    saveHero(h);
    this.openMenu({
      title: `*** You have escaped ${this.pack.name}! ***`,
      lines: [...(this.pack.victory ?? ['You step out into the light.']), `Level ${h.level}, ${h.kills} foes defeated, ${h.gold} gold - in ${timeString(h)}.`],
      options: [
        { key: '1', label: 'Return to the Hall of Adventurers', action: () => this.scene.start('UnderrealmHall', { hero: h }) },
        { key: '2', label: 'Back to the title', action: () => this.scene.start('UnderrealmTitle') },
      ],
    });
  }

  // --- Rendering ----------------------------------------------------------------------

  private markExplored(): void {
    const h = this.hero;
    const set = new Set(h.explored[this.level.n] ?? []);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) set.add(tileKey(h.pos.x + dx, h.pos.y + dy));
    h.explored[this.level.n] = [...set];
  }

  private levelSprites(): Sprite[] {
    const h = this.hero;
    const lvl = this.level;
    const out: Sprite[] = [];
    const looted = new Set(h.looted[lvl.n] ?? []);
    const spr = (id: string) => this.assets.sprite(id).tex;
    for (let y = 0; y < lvl.h; y++) {
      for (let x = 0; x < lvl.w; x++) {
        const t = lvl.legend[lvl.grid[y][x]];
        if (!t) continue;
        const k = tileKey(x, y);
        if (t.type === 'chest') {
          const base = t.sprite ?? 'chest';
          out.push({ x: x + 0.5, y: y + 0.5, tex: spr(looted.has(k) ? `${base}Open` : base), scale: SPRITE_SCALE, lift: 0 });
        } else if (t.type === 'fountain' || t.type === 'prop') {
          out.push({ x: x + 0.5, y: y + 0.5, tex: spr(t.sprite ?? 'fountain'), scale: SPRITE_SCALE, lift: 0 });
        } else if (t.type === 'throne') {
          out.push({ x: x + 0.5, y: y + 0.3, tex: spr(t.sprite ?? 'throne'), scale: SPRITE_SCALE, lift: 0 });
          const boss = lvl.boss && lvl.boss.x === x && lvl.boss.y === y ? this.monsters.get(lvl.boss.monster) : null;
          if (boss && !this.isSlain(x, y) && this.fightAt !== k) out.push({ x: x + 0.5, y: y + 0.6, tex: spr(boss.sprite), scale: SPRITE_SCALE, lift: 0 });
          else if (boss && this.pack.goal?.requires === 'crystal' && !h.crystal) out.push({ x: x + 0.5, y: y + 0.65, tex: spr(this.pack.goal?.sprite ?? 'crystal'), scale: SPRITE_SCALE, lift: 0 });
        }
      }
    }
    for (const [k, id] of lvl.guardians) {
      const [x, y] = k.split(',').map(Number);
      if (this.isSlain(x, y) || this.fightAt === k) continue;
      const m = this.monsters.get(id);
      if (m) out.push({ x: x + 0.5, y: y + 0.5, tex: spr(m.sprite), scale: SPRITE_SCALE, lift: 0 });
    }
    return out;
  }

  private wallTexture(x: number, y: number, frame: number): Texture | null {
    const t = tileAt(this.level, x, y);
    if (!isSolidTile(t)) return null;
    const set = textureSet(this.level.def.style ?? {});
    let id = t.texture ?? 'wall';
    if (id === 'torch') {
      const nearSafe = [0, 1, 2, 3].some((d) => tileAt(this.level, x + DIR_DX[d], y + DIR_DY[d]).safe);
      id = `${nearSafe ? 'torchBrick' : 'torch'}${frame}`;
    }
    return this.assets.textures[id] ?? set.walls[id] ?? set.walls.wall;
  }

  private renderView(time: number): void {
    if (this.shop) {
      this.drawShop(time);
      return;
    }
    const h = this.hero;
    const lvl = this.level;
    const set = textureSet(lvl.def.style ?? {});
    const frame = Math.floor(time / 180) % 2;
    const safe = isSafe(lvl, h.pos.x, h.pos.y);
    const day = safe || !!lvl.def.daylight;
    const lit = h.torchLeft > 0 || day;
    const flicker = day ? 1 : 0.85 + Math.sin(time / 90) * 0.06 + Math.sin(time / 37) * 0.04;
    const seen = new Set(h.explored[lvl.n] ?? []);
    const before = seen.size;
    const radius = day ? 13 : lit ? 6.5 : 1.8;

    const sprites = this.levelSprites();
    if (this.encounterSprite && this.fight) {
      const dx = DIR_DX[h.pos.dir];
      const dy = DIR_DY[h.pos.dir];
      const blocked = isSolidAt(lvl, h.pos.x + dx, h.pos.y + dy);
      // Lunges in when it attacks, recoils when hit.
      const d = (blocked ? 0.8 : 1.4) - this.fight.lunge * 0.45 + this.fight.monHitFlash * 0.18;
      const bob = Math.sin(time / 260) * 0.025;
      sprites.push({
        x: this.camX + dx * d,
        y: this.camY + dy * d,
        tex: this.assets.sprite(this.encounterSprite).tex,
        scale: SPRITE_SCALE,
        lift: bob,
        alpha: this.fight.mon.special === 'drain' ? 0.72 : 1,
        flash: this.fight.monHitFlash * 0.7,
      });
    }

    const floorOf = (x: number, y: number) => {
      const id = tileAt(lvl, x, y).floor ?? 'floor';
      return this.assets.textures[id] ?? set.floors[id] ?? set.floors.floor;
    };
    const ceilOf = (x: number, y: number) => {
      const id = tileAt(lvl, x, y).floor;
      if (id === 'market') return set.floors.marketCeil;
      return (id && this.assets.textures[`${id}Ceil`]) || set.floors.ceil;
    };
    this.ray.render({
      camX: this.camX,
      camY: this.camY,
      angle: this.camA,
      wallAt: (x, y) => this.wallTexture(x, y, frame),
      floorAt: floorOf,
      ceilAt: ceilOf,
      lightRadius: radius,
      ambient: day ? 0.3 : 0.03,
      flicker,
      sprites,
      onSeen: (x, y) => {
        if (Math.hypot(x + 0.5 - this.camX, y + 0.5 - this.camY) <= radius + 0.5) seen.add(tileKey(x, y));
      },
    });
    if (seen.size !== before) {
      h.explored[lvl.n] = [...seen];
      this.drawMini();
      if (this.showMap) this.drawBigMap();
    }
    const ctx = this.viewTex.getContext();
    ctx.putImageData(this.ray.image, 0, 0);
    this.viewTex.refresh();
  }

  private tileColor(x: number, y: number): number | null {
    const t = tileAt(this.level, x, y);
    const looted = (this.hero.looted[this.level.n] ?? []).includes(tileKey(x, y));
    switch (t.type) {
      case 'floor':
      case 'start':
        return t.safe ? 0x6c5c44 : 0x3c3c44;
      case 'door':
        return 0xa86c34;
      case 'locked':
        return 0x9ca0a8;
      case 'stairsUp':
      case 'stairsDown':
        return 0xf8f8a0;
      case 'exit':
        return 0x58d8ff;
      case 'chest':
        return looted ? 0x5c4c3c : 0xf8d800;
      case 'fountain':
        return 0x3c7cd8;
      case 'throne':
        return 0xc858f8;
      case 'shop':
        return 0xf87838;
      case 'prop':
        return t.walkable ? 0x3c3c44 : null;
      default:
        return null;
    }
  }

  private drawMap(g: Phaser.GameObjects.Graphics, x0: number, y0: number, cell: number, cx: number, cy: number, radius: number): void {
    const h = this.hero;
    const seen = new Set(h.explored[this.level.n] ?? []);
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (x < 0 || y < 0 || x >= this.level.w || y >= this.level.h || !seen.has(tileKey(x, y))) continue;
        const col = this.tileColor(x, y);
        const px = x0 + (x - (cx - radius)) * cell;
        const py = y0 + (y - (cy - radius)) * cell;
        g.fillStyle(col ?? 0x8c8c94, col === null ? 0.9 : 1).fillRect(px, py, cell - (col === null ? 0 : 1), cell - (col === null ? 0 : 1));
      }
    }
    const px = x0 + (h.pos.x - (cx - radius)) * cell + cell / 2;
    const py = y0 + (h.pos.y - (cy - radius)) * cell + cell / 2;
    const a = angleOf(h.pos.dir);
    const r = cell * 0.55;
    g.fillStyle(0x48e848, 1).fillTriangle(
      px + Math.cos(a) * r,
      py + Math.sin(a) * r,
      px + Math.cos(a + 2.4) * r,
      py + Math.sin(a + 2.4) * r,
      px + Math.cos(a - 2.4) * r,
      py + Math.sin(a - 2.4) * r,
    );
  }

  private drawMini(): void {
    const g = this.mini;
    g.clear();
    if (!this.miniBox.size) return;
    const { x, y, size } = this.miniBox;
    const radius = 7;
    const cell = Math.floor(size / (radius * 2 + 1));
    const box = cell * (radius * 2 + 1) + 8;
    g.fillStyle(0x000000, 1).fillRect(x - 4, y - 4, box, box);
    g.lineStyle(2, 0x9c7c4c, 1).strokeRect(x - 4, y - 4, box, box);
    this.drawMap(g, x, y, cell, this.hero.pos.x, this.hero.pos.y, radius);
  }

  private drawBigMap(): void {
    const g = this.bigMap;
    g.clear();
    if (!this.showMap) return;
    const vw = VW * this.viewScale;
    const vh = VH * this.viewScale;
    g.fillStyle(0x000000, 0.92).fillRect(this.viewX, this.viewY, vw, vh);
    const cell = Math.floor(Math.min(vw / this.level.w, vh / this.level.h));
    const ox = this.viewX + (vw - cell * this.level.w) / 2;
    const oy = this.viewY + (vh - cell * this.level.h) / 2;
    const r = Math.max(this.level.w, this.level.h);
    this.drawMap(g, ox - (this.hero.pos.x - r) * cell, oy - (this.hero.pos.y - r) * cell, cell, this.hero.pos.x, this.hero.pos.y, r);
  }

  private refreshHud(): void {
    const h = this.hero;
    const s = h.stats;
    const statsLine = `Stats  ${STATS.map((k) => `${k} ${String(s[k]).padStart(2)}`).join('  ')}`;
    const need = nextLevelXp(h);
    const mana = maxMana(h) ? `   Mana ${h.mana}/${maxMana(h)}` : '';
    const xpLine = `Level ${h.level}   Experience ${h.xp}${Number.isFinite(need) ? `/${need}` : ''}   Hit Points ${h.hp}/${maxHp(h)}${mana}`;
    this.statText.setText([statsLine, xpLine]);
    this.statusText.setText(
      `Gold ${h.gold}   Food ${h.food}   Water ${h.water}   Torches ${h.torches}${h.torchLeft > 0 ? '+' : ''}   Potions ${h.potions}${h.keys ? `   Keys ${h.keys}` : ''}${h.crystal ? `   ${this.pack.goal?.item ? 'Relic' : 'Crystal'}` : ''}`,
    );
    const conds = [h.poisoned ? 'Poisoned' : '', h.blessed > 0 ? 'Blessed' : '', h.hunger >= HUNGER_STEPS ? 'Starving' : '', h.thirst >= THIRST_STEPS ? 'Parched' : ''].filter(Boolean);
    this.infoText.setText(`Facing ${DIR_NAMES[h.pos.dir]}   ${timeString(h)}${conds.length ? '   ' + conds.join(' ') : ''}`);
    this.locText.setText(this.describe());
  }

  private describe(): string {
    const h = this.hero;
    const lvl = this.level;
    if (this.shop) return '';
    const t = tileAt(lvl, h.pos.x + DIR_DX[h.pos.dir], h.pos.y + DIR_DY[h.pos.dir]);
    if (t.type === 'shop' && t.shop) return `You see ${SHOP_DEFS[t.shop].name}.`;
    if (t.type === 'stairsDown') return 'You see a stairway leading down.';
    if (t.type === 'stairsUp') return lvl.n === 1 ? 'You see the rubble-choked stairs you came down.' : 'You see a stairway leading up.';
    if (t.type === 'door') return 'You see a wooden door.';
    if (t.type === 'locked') return 'You see a locked iron door.';
    if (t.type === 'exit') return 'You see a shimmering gate!';
    if (isSafe(lvl, h.pos.x, h.pos.y) && lvl.def.generate?.market) return 'You are in the Undercroft market.';
    return `${lvl.name}  (level ${lvl.n} of ${this.pack.levels.length})`;
  }
}
