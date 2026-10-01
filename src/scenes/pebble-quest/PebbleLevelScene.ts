import Phaser from 'phaser';
import { PuzzleState, type Direction } from '../../game/pebble-quest/PuzzleState';
import {
  PQ_TILE,
  PQ_LEVEL_COUNT,
  PQ_PROGRESS_KEY,
  PQ_SUPER_PUSH_UNLOCK_LEVEL,
  PEBBLE_PROGRESS_DEFAULT,
  loadPebbleProgress,
  type PebbleProgress,
} from '../../game/pebble-quest/config';
import { campaignLevel } from '../../game/pebble-quest/LevelLibrary';
import {
  allCollected,
  chestOpen,
  doorOpen,
  gazeTiles,
  popcount,
  powerReady,
  tileAt,
  type StepEvents,
} from '../../game/pebble-quest/rules';
import type { Action } from '../../game/pebble-quest/rules';
import type { LevelDef, Vec2 } from '../../game/pebble-quest/types';
import { MenuNav, type NavItem } from '../../game/shared/MenuNav';
import { MENU_PROFILE, setPadProfile } from '../../game/shared/Pad';
import { PEBBLE_PAD } from '../../game/shared/PadProfiles';
import { SaveData } from '../../game/shared/SaveData';
import { SoundManager, loadMuted, saveMuted } from '../../game/shared/Sound';
import type { PebbleEditorInitData } from './PebbleEditorScene';

export interface PebbleLevelInitData {
  /** A campaign room (1-based). */
  levelId?: number;
  /** Or an explicit room - a custom room or an editor play-test. */
  level?: LevelDef;
  /** When set, Esc / clearing the room returns to the editor with this state. */
  editor?: PebbleEditorInitData;
  /** Auto-plays these actions (the editor's "Watch" of a verified solution). */
  demo?: Action[];
}

const POWER_NAMES = { hammer: 'Hammer', bridge: 'Bridge', arrow: 'Arrow' } as const;

type KeyName =
  | 'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd'
  | 'reset' | 'back' | 'shift' | 'shoot' | 'power' | 'undo' | 'mute';

/** Texture for one terrain tile in its current state. */
function terrainTexture(p: PuzzleState, x: number, y: number, waterFrame: number): string {
  const { ctx, state } = p;
  const ch = tileAt(ctx, state, x, y);
  switch (ch) {
    case '#':
      return 'pq_wall';
    case 'R':
      return 'pq_rock';
    case 'T':
      return 'pq_tree';
    case 'W':
      return waterFrame ? 'pq_water2' : 'pq_water';
    case '=': {
      const wet = (c: string) => c === 'W' || c === '=';
      return wet(tileAt(ctx, state, x, y - 1)) && wet(tileAt(ctx, state, x, y + 1)) ? 'pq_bridge_h' : 'pq_bridge_v';
    }
    case 'g':
      return 'pq_grass';
    case 's':
      return 'pq_sand';
    case '^':
      return 'pq_arrow_up';
    case 'v':
      return 'pq_arrow_down';
    case '<':
      return 'pq_arrow_left';
    case '>':
      return 'pq_arrow_right';
    case 'H': {
      const shot = p.level.shotPebbles.some((s) => s.x === x && s.y === y);
      return shot ? 'pq_pebble_shot' : 'pq_pebble';
    }
    case 'C':
      if (state.jewel) return 'pq_chest_empty';
      return chestOpen(ctx, state) ? 'pq_chest_open' : 'pq_chest_closed';
    case 'D':
      return doorOpen(ctx, state) ? 'pq_door_open' : 'pq_door_locked';
    default:
      return 'pq_floor';
  }
}

export class PebbleLevelScene extends Phaser.Scene {
  private levelId = 0;
  private editorData: PebbleEditorInitData | null = null;
  private puzzle!: PuzzleState;
  private store = new SaveData<PebbleProgress>(PQ_PROGRESS_KEY, PEBBLE_PROGRESS_DEFAULT);
  private sfx!: SoundManager;
  private superPushUnlocked = false;

  private container!: Phaser.GameObjects.Container;
  private tileSprites: Phaser.GameObjects.Image[][] = [];
  private framerSprites: Phaser.GameObjects.Image[] = [];
  private enemySprites: Phaser.GameObjects.Image[] = [];
  private eggTimers: Phaser.GameObjects.Text[] = [];
  private playerSprite!: Phaser.GameObjects.Image;
  private gazeGraphics!: Phaser.GameObjects.Graphics;
  private waterFrame = 0;

  private titleText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private powerText!: Phaser.GameObjects.Text;
  private powerIcon!: Phaser.GameObjects.Image;
  private messageText!: Phaser.GameObjects.Text;
  private messageTimer?: Phaser.Time.TimerEvent;

  private keys!: Record<KeyName, Phaser.Input.Keyboard.Key>;
  private locked = false;
  private demo: Action[] | null = null;

  constructor() {
    super('PebbleLevel');
  }

  init(data: PebbleLevelInitData): void {
    this.levelId = data.levelId ?? 0;
    this.editorData = data.editor ?? null;
    const level = data.level ?? campaignLevel(this.levelId);
    this.puzzle = new PuzzleState(level);
    this.locked = false;
    this.tileSprites = [];
    this.framerSprites = [];
    this.enemySprites = [];
    this.eggTimers = [];
    this.demo = data.demo ?? null;
  }

  create(): void {
    this.sfx = new SoundManager(this);
    // Floors 6-10 get the darker room theme.
    this.sfx.playMusic(this.levelId > 25 ? 'puzzleDeep' : 'puzzle');
    this.sound.mute = loadMuted();
    this.superPushUnlocked = loadPebbleProgress(this.store).superPushUnlocked;

    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000);

    this.buildHud(width, height);
    this.buildBoard(width, height);
    this.render(false);

    this.time.addEvent({
      delay: 450,
      loop: true,
      callback: () => {
        this.waterFrame ^= 1;
        this.refreshTiles();
      },
    });

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: kb.addKey(K.UP),
      down: kb.addKey(K.DOWN),
      left: kb.addKey(K.LEFT),
      right: kb.addKey(K.RIGHT),
      w: kb.addKey(K.W),
      a: kb.addKey(K.A),
      s: kb.addKey(K.S),
      d: kb.addKey(K.D),
      reset: kb.addKey(K.R),
      back: kb.addKey(K.ESC),
      shift: kb.addKey(K.SHIFT),
      shoot: kb.addKey(K.SPACE),
      power: kb.addKey(K.E),
      undo: kb.addKey(K.Z),
      mute: kb.addKey(K.M),
    };
    setPadProfile(this, PEBBLE_PAD);

    if (this.demo) this.playDemo(this.demo);
  }

  /** Replays a solver solution one action at a time (input is locked meanwhile, Esc still leaves). */
  private playDemo(actions: Action[]): void {
    this.locked = true;
    this.flashMessage("Watching the solver's solution... (Esc to stop)");
    let i = 0;
    this.time.addEvent({
      delay: 220,
      repeat: actions.length - 1,
      callback: () => {
        const from = { x: this.puzzle.state.x, y: this.puzzle.state.y };
        const ev = this.puzzle.act(actions[i++]);
        if (ev) {
          this.playEvents(ev, from.x, from.y);
          this.render(true);
        }
        if (this.puzzle.state.status === 'won') this.onWin();
      },
    });
    this.input.keyboard!.once('keydown-ESC', () => this.leave());
  }

  update(): void {
    if (this.locked) return;
    const J = Phaser.Input.Keyboard.JustDown;

    if (J(this.keys.back)) {
      this.leave();
      return;
    }
    if (J(this.keys.mute)) {
      this.sound.mute = !this.sound.mute;
      saveMuted(this.sound.mute);
      this.flashMessage(this.sound.mute ? 'Sound off (M)' : 'Sound on (M)');
      return;
    }
    if (J(this.keys.reset)) {
      this.sfx.play('pqRewind');
      this.puzzle.reset();
      this.render(false);
      return;
    }
    if (J(this.keys.undo)) {
      if (this.puzzle.undo()) {
        this.sfx.play('pqRewind');
        this.render(false);
      }
      return;
    }
    if (J(this.keys.shoot)) {
      this.perform({ type: 'shoot', dir: this.puzzle.state.facing });
      return;
    }
    if (J(this.keys.power)) {
      this.perform({ type: 'power', dir: this.puzzle.state.facing });
      return;
    }

    let dir: Direction | null = null;
    if (J(this.keys.up) || J(this.keys.w)) dir = 'up';
    else if (J(this.keys.down) || J(this.keys.s)) dir = 'down';
    else if (J(this.keys.left) || J(this.keys.a)) dir = 'left';
    else if (J(this.keys.right) || J(this.keys.d)) dir = 'right';
    if (!dir) return;

    const superPush = this.superPushUnlocked && this.keys.shift.isDown;
    if (!this.perform({ type: 'move', dir, superPush })) {
      // Blocked: just turn to face that way (free), so you can aim a shot or power.
      this.puzzle.turn(dir);
      this.render(false);
    }
  }

  private perform(action: Parameters<PuzzleState['act']>[0]): boolean {
    const before = this.puzzle.state;
    const ev = this.puzzle.act(action);
    if (!ev) {
      if (action.type === 'shoot') this.flashMessage(this.puzzle.state.shots > 0 ? '' : 'No magic shots - some pebbles give you 2');
      if (action.type === 'power') this.flashMessage(this.powerHint(true));
      return false;
    }
    this.playEvents(ev, before.x, before.y);
    this.render(true);
    if (ev.won) this.onWin();
    else if (this.puzzle.state.status === 'dead') this.onDeath(ev);
    return true;
  }

  private playEvents(ev: StepEvents, fromX: number, fromY: number): void {
    if (ev.shot) {
      this.sfx.play('pqShot');
      if (ev.shot === 'egg') this.sfx.play('pqEgg');
      else if (ev.shot === 'away') this.sfx.play('pqEggAway');
      else if (ev.shot === 'absorbed') this.sfx.play('pqAbsorbed');
      if (ev.shotEnd) this.animateShot({ x: fromX, y: fromY }, ev.shotEnd);
      if (ev.shot === 'absorbed') this.flashMessage("Medusas can't be egged!");
    }
    if (ev.jewel) {
      this.sfx.play('pqJewel');
      this.flashMessage('Jewel taken! Every enemy vanishes - the door is open.');
    } else if (ev.chestOpened) {
      this.sfx.play('pqChest');
      this.flashMessage('All pebbles! The chest is open.');
    } else if (ev.collected) {
      this.sfx.play(ev.shotsGained ? 'pqShotsGained' : 'pqPebble');
      if (ev.shotsGained) this.flashMessage(`+${ev.shotsGained} magic shots (Space)`);
    } else if (ev.power) {
      this.sfx.play('pqPower');
    } else if (ev.pushed) {
      this.sfx.play('pqPush');
    }
    if (ev.hatched) this.sfx.play('pqHatch');
    if (ev.slept) {
      this.sfx.play('pqSleep');
      this.flashMessage('The Leeper fell asleep.');
    }
    // Announce a power the turn it unlocks.
    const power = this.puzzle.level.power;
    if (ev.collected && power && !ev.chestOpened && popcount(this.puzzle.state.collected) === power.pebbles) {
      this.flashMessage(`${POWER_NAMES[power.kind]} ready - face a target and press E`);
    }
  }

  private buildHud(width: number, height: number): void {
    const style = { fontFamily: 'monospace', color: '#fcfcfc' };
    this.titleText = this.add.text(16, 12, '', { ...style, fontSize: '16px', fontStyle: 'bold' });
    this.statusText = this.add.text(16, 36, '', { ...style, fontSize: '12px', color: '#f7d8a5' });
    this.powerIcon = this.add.image(width - 30, 28, 'pq_icon_hammer').setVisible(false);
    this.powerText = this.add.text(width - 52, 20, '', { ...style, fontSize: '12px', color: '#f878f8' }).setOrigin(1, 0);
    const hints = [
      'Arrows/WASD move',
      'Space magic shot',
      'E power',
      'Z undo',
      'R reset',
      'M sound',
      this.editorData ? 'Esc editor' : 'Esc map',
    ];
    if (this.superPushUnlocked) hints.push('Shift+move super push');
    this.add
      .text(width / 2, height - 14, hints.join('   '), { ...style, fontSize: '10px', color: '#7c7c7c' })
      .setOrigin(0.5, 1);
    this.messageText = this.add
      .text(width / 2, height - 34, '', { ...style, fontSize: '13px', color: '#f8b800' })
      .setOrigin(0.5, 1);
  }

  private buildBoard(width: number, height: number): void {
    const def = this.puzzle.level;
    const gridW = def.width * PQ_TILE;
    const gridH = def.height * PQ_TILE;
    const top = 60;
    const availW = width - 32;
    const availH = height - top - 56;
    const fit = Math.min(availW / gridW, availH / gridH);
    // Whole-number zoom keeps the pixel art crisp whenever there's room for it.
    const scale = fit >= 1 ? Math.floor(fit * 2) / 2 : Math.max(0.4, fit);
    const originX = Math.round(width / 2 - (gridW * scale) / 2);
    const originY = Math.round(top + (availH - gridH * scale) / 2);
    this.container = this.add.container(originX, originY).setScale(scale);

    for (let y = 0; y < def.height; y++) {
      const row: Phaser.GameObjects.Image[] = [];
      for (let x = 0; x < def.width; x++) {
        const img = this.add.image(x * PQ_TILE + PQ_TILE / 2, y * PQ_TILE + PQ_TILE / 2, 'pq_floor');
        this.container.add(img);
        row.push(img);
      }
      this.tileSprites.push(row);
    }
    this.gazeGraphics = this.add.graphics();
    this.container.add(this.gazeGraphics);

    for (let i = 0; i < def.framers.length; i++) {
      const img = this.add.image(0, 0, 'pq_framer');
      this.container.add(img);
      this.framerSprites.push(img);
    }
    for (const e of def.enemies) {
      const img = this.add.image(0, 0, `pq_${e.kind}`);
      this.container.add(img);
      this.enemySprites.push(img);
      const t = this.add
        .text(0, 0, '', { fontFamily: 'monospace', fontSize: '11px', color: '#000000', fontStyle: 'bold' })
        .setOrigin(0.5);
      this.container.add(t);
      this.eggTimers.push(t);
    }
    this.playerSprite = this.add.image(0, 0, 'pq_player_up');
    this.container.add(this.playerSprite);
  }

  private toPx(p: Vec2): { x: number; y: number } {
    return { x: p.x * PQ_TILE + PQ_TILE / 2, y: p.y * PQ_TILE + PQ_TILE / 2 };
  }

  private place(obj: Phaser.GameObjects.Image | Phaser.GameObjects.Text, p: Vec2, animate: boolean): void {
    const px = this.toPx(p);
    this.tweens.killTweensOf(obj);
    if (animate && obj.visible && (obj.x !== px.x || obj.y !== px.y)) {
      this.tweens.add({ targets: obj, x: px.x, y: px.y, duration: 80 });
    } else {
      obj.setPosition(px.x, px.y);
    }
  }

  private refreshTiles(): void {
    for (let y = 0; y < this.tileSprites.length; y++) {
      for (let x = 0; x < this.tileSprites[y].length; x++) {
        const key = terrainTexture(this.puzzle, x, y, this.waterFrame);
        const img = this.tileSprites[y][x];
        if (img.texture.key !== key) img.setTexture(key);
      }
    }
  }

  private render(animate: boolean): void {
    const p = this.puzzle;
    const s = p.state;
    const ctx = p.ctx;
    const def = p.level;

    this.refreshTiles();

    const title = def.name ?? (this.levelId ? `Room ${this.levelId}` : 'Custom room');
    this.titleText.setText(this.levelId ? `${title}   (${this.levelId}/${PQ_LEVEL_COUNT})` : title);
    const total = ctx.pebbles.length;
    const got = popcount(s.collected);
    let goal = total > 0 && got < total ? 'collect every pebble' : '';
    if (!goal) goal = ctx.hasChest && !s.jewel ? 'open the chest' : 'head for the door';
    this.statusText.setText(`Pebbles ${got}/${total}    Shots ${s.shots}    Moves ${s.moves}    Goal: ${goal}`);
    this.powerText.setText(this.powerHint(false));
    this.powerIcon.setVisible(!!def.power);
    if (def.power) {
      this.powerIcon.setTexture(`pq_icon_${def.power.kind}`).setAlpha(powerReady(ctx, s) ? 1 : 0.35);
    }

    this.place(this.playerSprite, s, animate);
    this.playerSprite.setTexture(`pq_player_${s.facing}`);
    s.framers.forEach((f, i) => this.place(this.framerSprites[i], f, animate));

    const awake = allCollected(ctx, s);
    s.enemies.forEach((e, i) => {
      const sprite = this.enemySprites[i];
      const timer = this.eggTimers[i];
      const kind = def.enemies[i].kind;
      if (e.mode === 'gone' || e.mode === 'dead') {
        sprite.setVisible(false);
        timer.setVisible(false);
        return;
      }
      let tex = `pq_${kind}`;
      if (e.mode === 'egg') tex = 'pq_egg';
      else if (e.mode === 'raft') tex = 'pq_raft';
      else if (e.mode === 'asleep') tex = 'pq_leeper_asleep';
      sprite.setTexture(tex);
      this.place(sprite, e, animate);
      sprite.setVisible(true);
      const dormant = (kind === 'skull' || kind === 'gol') && !awake && e.mode === 'active';
      sprite.setTint(dormant ? 0x9a9a9a : 0xffffff);
      const egg = e.mode === 'egg' || e.mode === 'raft';
      timer.setVisible(egg).setText(egg ? `${e.timer}` : '');
      if (egg) {
        this.place(timer, e, animate);
        timer.setColor(e.timer <= 3 ? '#e40058' : '#000000');
        sprite.setAlpha(e.timer <= 3 && e.timer % 2 === 1 ? 0.6 : 1);
      } else {
        sprite.setAlpha(1);
      }
    });

    this.drawGaze();
  }

  private drawGaze(): void {
    const p = this.puzzle;
    const g = this.gazeGraphics;
    g.clear();
    p.state.enemies.forEach((_, i) => {
      const tiles = gazeTiles(p.ctx, p.state, i);
      if (tiles.length === 0) return;
      const kind = p.level.enemies[i].kind;
      g.fillStyle(kind === 'gol' ? 0xf8b800 : 0xe40058, 0.22);
      for (const t of tiles) g.fillRect(t.x * PQ_TILE + 2, t.y * PQ_TILE + 2, PQ_TILE - 4, PQ_TILE - 4);
    });
    // Gol's facing, so you can see where it'll fire once it wakes.
    p.level.enemies.forEach((def, i) => {
      const e = p.state.enemies[i];
      if (def.kind !== 'gol' || e.mode !== 'active') return;
      const c = this.toPx(e);
      const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[def.facing ?? 'down'];
      const tipX = c.x + d[0] * 15;
      const tipY = c.y + d[1] * 15;
      g.fillStyle(0xf8b800, 0.9);
      g.fillTriangle(tipX, tipY, c.x + d[0] * 10 - d[1] * 4, c.y + d[1] * 10 - d[0] * 4, c.x + d[0] * 10 + d[1] * 4, c.y + d[1] * 10 + d[0] * 4);
    });
  }

  private powerHint(forFailedUse: boolean): string {
    const p = this.puzzle;
    const power = p.level.power;
    if (!power) return forFailedUse ? 'No power in this room' : '';
    const name = POWER_NAMES[power.kind];
    if (p.state.powerUsed) return `${name}: used`;
    const need = power.pebbles - popcount(p.state.collected);
    if (need > 0) return `${name}: ${need} more pebble${need === 1 ? '' : 's'}`;
    if (forFailedUse) {
      const what = { hammer: 'a boulder', bridge: 'water', arrow: 'an arrow' }[power.kind];
      return `${name}: face ${what} next to you and press E`;
    }
    return `${name}: ready (E)`;
  }

  private animateShot(from: Vec2, to: Vec2): void {
    const a = this.toPx(from);
    const b = this.toPx(to);
    const shot = this.add.image(a.x, a.y, 'pq_shot');
    this.container.add(shot);
    const dist = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
    this.tweens.add({ targets: shot, x: b.x, y: b.y, duration: 40 * dist, onComplete: () => shot.destroy() });
  }

  private flashMessage(msg: string): void {
    this.messageText.setText(msg);
    this.messageTimer?.remove();
    if (msg) this.messageTimer = this.time.delayedCall(2400, () => this.messageText.setText(''));
  }

  private onDeath(ev: StepEvents): void {
    this.locked = true;
    this.sfx.play('pqDeath');
    const why = { contact: 'Caught!', gaze: 'Turned to stone by a gaze!', drown: 'The egg sank under you!' }[ev.died ?? 'contact'];
    this.flashMessage(`${why}  Stepping back one move...`);
    this.cameras.main.flash(250, 228, 0, 88);
    this.time.delayedCall(700, () => {
      this.puzzle.undo();
      this.render(false);
      this.locked = false;
    });
  }

  private leave(): void {
    if (this.editorData) this.scene.start('PebbleEditor', this.editorData);
    else this.scene.start('PebbleMap');
  }

  private onWin(): void {
    this.locked = true;
    // Drop the room music for the fanfare; the next room starts it again.
    this.sfx.stopMusic();
    this.sfx.play('pqClear');
    if (this.levelId && !this.editorData) {
      const progress = loadPebbleProgress(this.store);
      progress.completed[this.levelId - 1] = true;
      if (this.levelId + 1 > progress.unlockedUpTo) progress.unlockedUpTo = Math.min(PQ_LEVEL_COUNT, this.levelId + 1);
      if (this.levelId === PQ_SUPER_PUSH_UNLOCK_LEVEL) progress.superPushUnlocked = true;
      this.store.save(progress);
    }
    this.showWinOverlay();
  }

  private showWinOverlay(): void {
    const { width, height } = this.scale;
    const container = this.add.container(width / 2, height / 2);
    const panelW = Math.min(380, width * 0.85);
    const panelH = 180;
    const campaign = this.levelId > 0 && !this.editorData;
    const allClear = campaign && this.levelId >= PQ_LEVEL_COUNT;
    const justUnlockedSuperPush = campaign && this.levelId === PQ_SUPER_PUSH_UNLOCK_LEVEL;

    const panel = this.add.rectangle(0, 0, panelW, panelH, 0x000000, 0.95).setStrokeStyle(3, 0xf7d8a5);
    const title = this.add
      .text(0, -panelH / 2 + 32, allClear ? 'THE GREAT DEVIL IS BEATEN!' : 'ROOM CLEARED!', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#f878f8',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const moves = this.puzzle.state.moves;
    const subtitle = this.add
      .text(0, -panelH / 2 + 58, justUnlockedSuperPush ? `${moves} moves - SUPER PUSH unlocked!` : `Cleared in ${moves} moves`, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#fcfcfc',
      })
      .setOrigin(0.5);
    container.add([panel, title, subtitle]);

    const nav: NavItem[] = [];
    const makeButton = (label: string, y: number, onClick: () => void) => {
      const btn = this.add
        .rectangle(0, y, panelW * 0.6, 32, 0x561d00, 1)
        .setStrokeStyle(2, 0xf7d8a5)
        .setInteractive({ useHandCursor: true });
      const txt = this.add.text(0, y, label, { fontFamily: 'monospace', fontSize: '13px', color: '#fcfcfc' }).setOrigin(0.5);
      btn.on('pointerdown', onClick);
      container.add([btn, txt]);
      nav.push({ x: width / 2, y: height / 2 + y, w: panelW * 0.6, h: 32, activate: onClick, hover: btn });
    };

    if (this.editorData) {
      makeButton('BACK TO EDITOR', 26, () => this.leave());
    } else if (campaign && !allClear) {
      makeButton('NEXT ROOM', 12, () => this.scene.start('PebbleLevel', { levelId: this.levelId + 1 } as PebbleLevelInitData));
      makeButton('MAP', 54, () => this.scene.start('PebbleMap'));
    } else {
      makeButton('BACK TO MAP', 26, () => this.scene.start('PebbleMap'));
    }
    // Arrows / D-pad pick a button, Enter / A presses it.
    new MenuNav(this, nav, { color: 0xf878f8 });
    setPadProfile(this, MENU_PROFILE);
  }
}
