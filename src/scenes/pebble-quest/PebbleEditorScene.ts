import Phaser from 'phaser';
import { PQ_LEVEL_COUNT, PQ_TILE } from '../../game/pebble-quest/config';
import {
  blankLevel,
  campaignLevel,
  clearOverride,
  cloneLevel,
  deleteCustom,
  hasOverride,
  loadLibrary,
  parseLevelJson,
  saveCustom,
  saveOverride,
  validateLevel,
} from '../../game/pebble-quest/LevelLibrary';
import { LEVELS } from '../../game/pebble-quest/levels.generated';
import { solveIter, type SolveProgress, type SolveResult } from '../../game/pebble-quest/solver';
import type { Action } from '../../game/pebble-quest/rules';
import type { Direction, EnemyKind, LevelDef, PowerKind, Vec2 } from '../../game/pebble-quest/types';
import { SoundManager, loadMuted } from '../../game/shared/Sound';
import type { PebbleLevelInitData } from './PebbleLevelScene';

export type EditorSource = { kind: 'new' } | { kind: 'campaign'; id: number } | { kind: 'custom'; slot: number };

export interface PebbleEditorInitData {
  level?: LevelDef;
  source?: EditorSource;
  /** Undo history (serialized levels), kept across a play-test round trip. */
  history?: string[];
  dirty?: boolean;
}

type ToolId =
  | 'floor' | 'rock' | 'tree' | 'water' | 'bridge' | 'grass' | 'sand' | 'wall'
  | 'arrow_up' | 'arrow_down' | 'arrow_left' | 'arrow_right'
  | 'pebble' | 'shotPebble' | 'chest' | 'door' | 'player' | 'framer'
  | EnemyKind | 'rotate' | 'erase';

interface ToolDef {
  id: ToolId;
  icon: string;
  name: string;
  help: string;
  /** Terrain char this tool paints, for terrain tools. */
  ch?: string;
}

const TOOLS: ToolDef[] = [
  { id: 'floor', icon: 'pq_floor', name: 'Floor', help: 'Plain floor', ch: '.' },
  { id: 'rock', icon: 'pq_rock', name: 'Boulder', help: 'Blocks movement, gazes and shots. A Hammer smashes one.', ch: 'R' },
  { id: 'tree', icon: 'pq_tree', name: 'Tree', help: 'Blocks movement only - gazes and shots pass over it', ch: 'T' },
  { id: 'water', icon: 'pq_water', name: 'Water', help: 'Impassable until bridged (Bridge power, or push an egg in to float on)', ch: 'W' },
  { id: 'bridge', icon: 'pq_bridge_v', name: 'Bridge', help: 'Walkable water', ch: '=' },
  { id: 'grass', icon: 'pq_grass', name: 'Grass', help: 'You can walk on it; enemies cannot', ch: 'g' },
  { id: 'sand', icon: 'pq_sand', name: 'Sand', help: 'Floor (cosmetic)', ch: 's' },
  { id: 'wall', icon: 'pq_wall', name: 'Wall', help: 'Brick wall', ch: '#' },
  { id: 'arrow_up', icon: 'pq_arrow_up', name: 'Arrow up', help: "One-way: can't be crossed against the arrow", ch: '^' },
  { id: 'arrow_down', icon: 'pq_arrow_down', name: 'Arrow down', help: "One-way: can't be crossed against the arrow", ch: 'v' },
  { id: 'arrow_left', icon: 'pq_arrow_left', name: 'Arrow left', help: "One-way: can't be crossed against the arrow", ch: '<' },
  { id: 'arrow_right', icon: 'pq_arrow_right', name: 'Arrow right', help: "One-way: can't be crossed against the arrow", ch: '>' },
  { id: 'pebble', icon: 'pq_pebble', name: 'Pebble', help: 'Collect every pebble to open the chest', ch: 'H' },
  { id: 'shotPebble', icon: 'pq_pebble_shot', name: 'Shot pebble', help: 'A pebble that also gives 2 magic shots. Click again to make it plain.' },
  { id: 'chest', icon: 'pq_chest_closed', name: 'Chest', help: 'Opens when all pebbles are in; its jewel clears the room (one per room)', ch: 'C' },
  { id: 'door', icon: 'pq_door_locked', name: 'Door', help: 'The exit - place it in the border wall', ch: 'D' },
  { id: 'player', icon: 'pq_player_down', name: 'Player start', help: 'Where you start' },
  { id: 'framer', icon: 'pq_framer', name: 'Emerald framer', help: 'Pushable block - blocks enemies, gazes and shots' },
  { id: 'snakey', icon: 'pq_snakey', name: 'Snakey', help: 'Harmless, never moves' },
  { id: 'rocky', icon: 'pq_rocky', name: 'Rocky', help: 'Harmless; charges you when lined up, to box you in' },
  { id: 'leeper', icon: 'pq_leeper', name: 'Leeper', help: 'Harmless; chases you and falls asleep for good when it touches you' },
  { id: 'gol', icon: 'pq_gol', name: 'Gol', help: 'Wakes when all pebbles are in, then fires along its facing. Rotate to aim.' },
  { id: 'medusa', icon: 'pq_medusa', name: 'Medusa', help: "Deadly gaze in all four directions. Can't be egged." },
  { id: 'donMedusa', icon: 'pq_donMedusa', name: 'Don Medusa', help: "Paces its axis; deadly gaze ahead of it. Can't be egged. Rotate to set axis." },
  { id: 'alma', icon: 'pq_alma', name: 'Alma', help: 'Charges you when lined up; kills on contact' },
  { id: 'skull', icon: 'pq_skull', name: 'Skull', help: 'Dormant until the last pebble, then charges you when lined up' },
  { id: 'rotate', icon: 'pq_icon_arrow', name: 'Rotate', help: "Click a Gol to turn its facing, or a Don Medusa to change its axis/heading" },
  { id: 'erase', icon: 'pq_floor', name: 'Eraser', help: 'Clears a tile back to floor (right-click erases with any tool)' },
];

const ENEMY_TOOL = new Set<ToolId>(['snakey', 'rocky', 'leeper', 'gol', 'medusa', 'donMedusa', 'alma', 'skull']);
const SOLID = new Set(['#', 'R', 'T', 'W', 'C', 'D']);
const FACINGS: Direction[] = ['down', 'left', 'up', 'right'];
const POWER_CYCLE: (PowerKind | null)[] = [null, 'hammer', 'bridge', 'arrow'];

const TEXT = { fontFamily: 'monospace', color: '#fcfcfc' };

export class PebbleEditorScene extends Phaser.Scene {
  private level!: LevelDef;
  private source!: EditorSource;
  private history: string[] = [];
  private dirty = false;
  private tool: ToolDef = TOOLS[1];
  private sfx!: SoundManager;

  private board!: Phaser.GameObjects.Container;
  private boardScale = 1;
  private tiles: Phaser.GameObjects.Image[][] = [];
  private entityLayer!: Phaser.GameObjects.Container;
  private overlay!: Phaser.GameObjects.Graphics;
  private hover!: Phaser.GameObjects.Rectangle;
  private toolButtons = new Map<ToolId, Phaser.GameObjects.Rectangle>();

  private titleText!: Phaser.GameObjects.Text;
  private helpText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private verifyText!: Phaser.GameObjects.Text;
  private powerLabel!: Phaser.GameObjects.Text;

  private painting = false;
  private strokeSaved = false;
  private verifying: Generator<SolveProgress, SolveResult> | null = null;
  private lastSolution: Action[] | null = null;

  constructor() {
    super('PebbleEditor');
  }

  init(data: PebbleEditorInitData): void {
    this.source = data.source ?? { kind: 'new' };
    this.level = data.level ? cloneLevel(data.level) : blankLevel();
    this.history = data.history ?? [];
    this.dirty = data.dirty ?? false;
    this.tiles = [];
    this.toolButtons = new Map();
    this.verifying = null;
    this.lastSolution = null;
    this.painting = false;
  }

  create(): void {
    this.sfx = new SoundManager(this);
    this.sfx.playMusic('menu');
    this.sound.mute = loadMuted();
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000);
    this.input.mouse?.disableContextMenu();

    this.titleText = this.add.text(16, 10, '', { ...TEXT, fontSize: '15px', fontStyle: 'bold', color: '#f7d8a5' });
    this.helpText = this.add.text(16, height - 22, '', { ...TEXT, fontSize: '11px', color: '#bcbcbc' });

    this.buildPalette();
    this.buildBoard();
    this.buildSidePanel();

    this.input.on('pointerup', () => {
      this.painting = false;
      this.strokeSaved = false;
    });
    const kb = this.input.keyboard!;
    kb.on('keydown-Z', () => this.undo());
    kb.on('keydown-ESC', () => this.scene.start('PebbleMap'));

    this.selectTool(this.tool.id);
    this.refresh();
  }

  update(): void {
    if (!this.verifying) return;
    const deadline = performance.now() + 12;
    while (performance.now() < deadline) {
      const r = this.verifying.next();
      if (r.done) {
        this.verifying = null;
        this.showVerifyResult(r.value);
        return;
      }
      this.verifyText.setText(`Verifying... ${r.value.explored.toLocaleString()} states`);
    }
  }

  // --- Layout -----------------------------------------------------------------

  private buildPalette(): void {
    const size = 34;
    const cols = 3;
    const x0 = 16;
    const y0 = 40;
    TOOLS.forEach((t, i) => {
      const x = x0 + (i % cols) * (size + 4) + size / 2;
      const y = y0 + Math.floor(i / cols) * (size + 4) + size / 2;
      const bg = this.add.rectangle(x, y, size, size, 0x222222).setStrokeStyle(2, 0x444444).setInteractive({ useHandCursor: true });
      const icon = this.add.image(x, y, t.icon).setDisplaySize(size - 6, size - 6);
      if (t.id === 'erase') {
        const g = this.add.graphics();
        g.lineStyle(3, 0xe40058, 1);
        g.lineBetween(x - 9, y - 9, x + 9, y + 9);
        g.lineBetween(x + 9, y - 9, x - 9, y + 9);
      }
      bg.on('pointerdown', () => {
        this.sfx.play('uiClick');
        this.selectTool(t.id);
      });
      bg.on('pointerover', () => this.helpText.setText(`${t.name}: ${t.help}`));
      bg.on('pointerout', () => this.helpText.setText(`${this.tool.name}: ${this.tool.help}`));
      icon.setDepth(1);
      this.toolButtons.set(t.id, bg);
    });
  }

  private buildBoard(): void {
    const { width, height } = this.scale;
    const n = this.level.width;
    const left = 16 + 3 * 38 + 16;
    const right = width - 236;
    const availW = right - left;
    const availH = height - 40 - 36;
    const fit = Math.min(availW, availH) / (n * PQ_TILE);
    this.boardScale = fit >= 1 ? Math.floor(fit * 2) / 2 : fit;
    const size = n * PQ_TILE * this.boardScale;
    const ox = Math.round(left + (availW - size) / 2);
    const oy = Math.round(40 + (availH - size) / 2);
    this.board = this.add.container(ox, oy).setScale(this.boardScale);

    for (let y = 0; y < this.level.height; y++) {
      const row: Phaser.GameObjects.Image[] = [];
      for (let x = 0; x < this.level.width; x++) {
        const img = this.add.image(x * PQ_TILE + PQ_TILE / 2, y * PQ_TILE + PQ_TILE / 2, 'pq_floor');
        img.setInteractive();
        img.on('pointerdown', (p: Phaser.Input.Pointer) => {
          this.painting = true;
          this.strokeSaved = false;
          this.applyAt(x, y, p.rightButtonDown());
        });
        img.on('pointerover', (p: Phaser.Input.Pointer) => {
          this.hover.setPosition(img.x, img.y).setVisible(true);
          if (this.painting && p.isDown && this.tool.ch !== undefined) this.applyAt(x, y, p.rightButtonDown());
        });
        this.board.add(img);
        row.push(img);
      }
      this.tiles.push(row);
    }
    this.overlay = this.add.graphics();
    this.entityLayer = this.add.container(0, 0);
    this.hover = this.add.rectangle(0, 0, PQ_TILE, PQ_TILE).setStrokeStyle(2, 0xfcfcfc, 0.8).setVisible(false);
    this.board.add([this.entityLayer, this.overlay, this.hover]);
  }

  private buildSidePanel(): void {
    const { width } = this.scale;
    const x = width - 118;
    let y = 42;
    const button = (label: string, onClick: () => void, w = 200) => {
      const bx = x;
      const bg = this.add
        .rectangle(bx, y, w, 24, 0x561d00)
        .setStrokeStyle(1, 0xf7d8a5)
        .setInteractive({ useHandCursor: true });
      const t = this.add.text(bx, y, label, { ...TEXT, fontSize: '12px' }).setOrigin(0.5);
      bg.on('pointerover', () => bg.setFillStyle(0x7a3208));
      bg.on('pointerout', () => bg.setFillStyle(0x561d00));
      bg.on('pointerdown', () => {
        this.sfx.play('uiClick');
        onClick();
      });
      y += 30;
      return t;
    };
    const pair = (a: string, fa: () => void, b: string, fb: () => void) => {
      const saveY = y;
      const mk = (label: string, fn: () => void, cx: number) => {
        const bg = this.add.rectangle(cx, saveY, 97, 24, 0x561d00).setStrokeStyle(1, 0xf7d8a5).setInteractive({ useHandCursor: true });
        this.add.text(cx, saveY, label, { ...TEXT, fontSize: '12px' }).setOrigin(0.5);
        bg.on('pointerover', () => bg.setFillStyle(0x7a3208));
        bg.on('pointerout', () => bg.setFillStyle(0x561d00));
        bg.on('pointerdown', () => {
          this.sfx.play('uiClick');
          fn();
        });
      };
      mk(a, fa, x - 51);
      mk(b, fb, x + 51);
      y += 30;
    };

    pair('< Load', () => this.loadAdjacent(-1), 'Load >', () => this.loadAdjacent(1));
    pair('New', () => this.newLevel(), 'Rename', () => this.rename());
    pair('Save', () => this.save(false), 'Save copy', () => this.save(true));
    pair('Revert', () => this.revertOrDelete(), 'Undo (Z)', () => this.undo());
    y += 6;
    button('PLAY-TEST', () => this.playTest(null));
    pair('Verify', () => this.startVerify(), 'Watch', () => this.watchSolution());
    pair('Export', () => this.exportLevel(), 'Import', () => this.importLevel());
    y += 6;
    this.powerLabel = button('', () => this.cyclePower());
    pair('- pebbles', () => this.adjustPowerPebbles(-1), '+ pebbles', () => this.adjustPowerPebbles(1));
    y += 4;
    this.verifyText = this.add.text(x - 100, y, '', { ...TEXT, fontSize: '11px', color: '#b8f818', wordWrap: { width: 204 } });
    y += 44;
    this.infoText = this.add.text(x - 100, y, '', { ...TEXT, fontSize: '11px', color: '#bcbcbc', wordWrap: { width: 204 }, lineSpacing: 2 });
    const back = this.add
      .text(this.scale.width - 16, 10, '< Back to map (Esc)', { ...TEXT, fontSize: '12px', color: '#bcbcbc' })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    back.on('pointerover', () => back.setColor('#fcfcfc'));
    back.on('pointerout', () => back.setColor('#bcbcbc'));
    back.on('pointerdown', () => this.scene.start('PebbleMap'));
  }

  // --- Editing ----------------------------------------------------------------

  private selectTool(id: ToolId): void {
    this.tool = TOOLS.find((t) => t.id === id)!;
    for (const [tid, bg] of this.toolButtons) bg.setStrokeStyle(2, tid === id ? 0xf878f8 : 0x444444);
    this.helpText.setText(`${this.tool.name}: ${this.tool.help}`);
  }

  private snapshot(): void {
    this.history.push(JSON.stringify(this.level));
    if (this.history.length > 200) this.history.shift();
  }

  private undo(): void {
    const prev = this.history.pop();
    if (!prev) return;
    this.level = JSON.parse(prev) as LevelDef;
    this.dirty = true;
    this.lastSolution = null;
    this.refresh();
  }

  private setTile(x: number, y: number, ch: string): void {
    const row = this.level.rows[y];
    this.level.rows[y] = row.slice(0, x) + ch + row.slice(x + 1);
  }

  private removeEntitiesAt(x: number, y: number): void {
    this.level.framers = this.level.framers.filter((f) => f.x !== x || f.y !== y);
    this.level.enemies = this.level.enemies.filter((e) => e.pos.x !== x || e.pos.y !== y);
  }

  private isBorder(x: number, y: number): boolean {
    return x === 0 || y === 0 || x === this.level.width - 1 || y === this.level.height - 1;
  }

  private applyAt(x: number, y: number, erase: boolean): void {
    const before = JSON.stringify(this.level);
    const changed = this.edit(x, y, erase ? TOOLS.find((t) => t.id === 'erase')! : this.tool);
    if (!changed) return;
    const after = JSON.stringify(this.level);
    if (before === after) return;
    // One undo step per click-and-drag stroke.
    if (!this.strokeSaved) {
      this.history.push(before);
      this.strokeSaved = true;
    }
    this.dirty = true;
    this.lastSolution = null;
    this.verifyText.setText('');
    this.refresh();
  }

  /** Applies `tool` at (x, y); returns false (with a hint) if it isn't allowed there. */
  private edit(x: number, y: number, tool: ToolDef): boolean {
    const L = this.level;
    const border = this.isBorder(x, y);
    const isPlayer = L.player.x === x && L.player.y === y;
    const cur = L.rows[y][x];
    const hint = (msg: string) => {
      this.helpText.setText(msg);
      return false;
    };

    if (tool.id === 'erase') {
      if (border) {
        this.setTile(x, y, '#');
        return true;
      }
      this.setTile(x, y, '.');
      this.removeEntitiesAt(x, y);
      L.shotPebbles = L.shotPebbles.filter((p) => p.x !== x || p.y !== y);
      return true;
    }
    if (border && tool.id !== 'door' && tool.id !== 'wall') return hint('The border can only hold wall or a door');

    if (tool.ch !== undefined) {
      const ch = tool.ch;
      if (isPlayer && SOLID.has(ch)) return hint("Can't put that under the player start");
      if (ch === 'C') {
        L.rows = L.rows.map((r) => r.replace(/C/g, '.'));
      }
      if (SOLID.has(ch) || ch === 'H') this.removeEntitiesAt(x, y);
      if (cur === 'H' && ch !== 'H') L.shotPebbles = L.shotPebbles.filter((p) => p.x !== x || p.y !== y);
      if (ch === 'H' && L.rows.join('').split('H').length - 1 >= 30 && cur !== 'H') return hint('At most 30 pebbles');
      this.setTile(x, y, ch);
      return true;
    }

    switch (tool.id) {
      case 'shotPebble': {
        const i = L.shotPebbles.findIndex((p) => p.x === x && p.y === y);
        if (i >= 0) {
          L.shotPebbles.splice(i, 1);
          return true;
        }
        if (cur !== 'H') {
          if (SOLID.has(cur) && isPlayer) return false;
          this.removeEntitiesAt(x, y);
          this.setTile(x, y, 'H');
        }
        L.shotPebbles.push({ x, y });
        return true;
      }
      case 'player':
        if (SOLID.has(cur)) this.setTile(x, y, '.');
        this.removeEntitiesAt(x, y);
        L.player = { x, y };
        return true;
      case 'framer': {
        if (isPlayer) return hint("Can't stack things on the player start");
        const i = L.framers.findIndex((f) => f.x === x && f.y === y);
        if (i >= 0) {
          L.framers.splice(i, 1);
          return true;
        }
        if (SOLID.has(cur) || cur === 'H') this.setTile(x, y, '.');
        this.removeEntitiesAt(x, y);
        L.framers.push({ x, y });
        return true;
      }
      case 'rotate': {
        const e = L.enemies.find((en) => en.pos.x === x && en.pos.y === y);
        if (!e) return hint('Click a Gol or Don Medusa to rotate it');
        this.rotateEnemy(e);
        return true;
      }
      default: {
        if (!ENEMY_TOOL.has(tool.id)) return false;
        if (isPlayer) return hint("Can't stack things on the player start");
        const kind = tool.id as EnemyKind;
        const existing = L.enemies.find((en) => en.pos.x === x && en.pos.y === y);
        if (existing && existing.kind === kind) {
          if (kind === 'gol' || kind === 'donMedusa') this.rotateEnemy(existing);
          return true;
        }
        if (SOLID.has(cur) || cur === 'H') this.setTile(x, y, '.');
        this.removeEntitiesAt(x, y);
        const e: LevelDef['enemies'][number] = { kind, pos: { x, y } };
        if (kind === 'gol') e.facing = 'down';
        if (kind === 'donMedusa') {
          e.axis = 'h';
          e.dir = 1;
        }
        L.enemies.push(e);
        return true;
      }
    }
  }

  private rotateEnemy(e: LevelDef['enemies'][number]): void {
    if (e.kind === 'gol') {
      e.facing = FACINGS[(FACINGS.indexOf(e.facing ?? 'down') + 1) % 4];
    } else if (e.kind === 'donMedusa') {
      // h,+1 -> h,-1 -> v,+1 -> v,-1
      const order: ['h' | 'v', 1 | -1][] = [['h', 1], ['h', -1], ['v', 1], ['v', -1]];
      const i = order.findIndex(([a, d]) => a === (e.axis ?? 'h') && d === (e.dir ?? 1));
      [e.axis, e.dir] = order[(i + 1) % 4];
    }
  }

  // --- Rendering --------------------------------------------------------------

  private tileTexture(x: number, y: number): string {
    const ch = this.level.rows[y][x];
    const map: Record<string, string> = {
      '#': 'pq_wall', '.': 'pq_floor', R: 'pq_rock', T: 'pq_tree', W: 'pq_water', g: 'pq_grass', s: 'pq_sand',
      '^': 'pq_arrow_up', v: 'pq_arrow_down', '<': 'pq_arrow_left', '>': 'pq_arrow_right',
      C: 'pq_chest_closed', D: 'pq_door_locked',
    };
    if (ch === '=') {
      const wet = (c: string | undefined) => c === 'W' || c === '=';
      return wet(this.level.rows[y - 1]?.[x]) && wet(this.level.rows[y + 1]?.[x]) ? 'pq_bridge_h' : 'pq_bridge_v';
    }
    if (ch === 'H') return this.level.shotPebbles.some((p) => p.x === x && p.y === y) ? 'pq_pebble_shot' : 'pq_pebble';
    return map[ch] ?? 'pq_floor';
  }

  private refresh(): void {
    const L = this.level;
    for (let y = 0; y < L.height; y++) for (let x = 0; x < L.width; x++) this.tiles[y][x].setTexture(this.tileTexture(x, y));

    this.entityLayer.removeAll(true);
    const at = (p: Vec2) => ({ x: p.x * PQ_TILE + PQ_TILE / 2, y: p.y * PQ_TILE + PQ_TILE / 2 });
    for (const f of L.framers) this.entityLayer.add(this.add.image(at(f).x, at(f).y, 'pq_framer'));
    for (const e of L.enemies) this.entityLayer.add(this.add.image(at(e.pos).x, at(e.pos).y, `pq_${e.kind}`));
    this.entityLayer.add(this.add.image(at(L.player).x, at(L.player).y, 'pq_player_down'));

    // Direction markers for Gol (facing) and Don Medusa (axis + heading).
    const g = this.overlay;
    g.clear();
    const D: Record<Direction, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    for (const e of L.enemies) {
      let dir: Direction | null = null;
      if (e.kind === 'gol') dir = e.facing ?? 'down';
      if (e.kind === 'donMedusa') dir = (e.axis ?? 'h') === 'h' ? ((e.dir ?? 1) > 0 ? 'right' : 'left') : (e.dir ?? 1) > 0 ? 'down' : 'up';
      if (!dir) continue;
      const c = at(e.pos);
      const [dx, dy] = D[dir];
      g.fillStyle(e.kind === 'gol' ? 0xf8b800 : 0xe40058, 1);
      g.fillTriangle(c.x + dx * 16, c.y + dy * 16, c.x + dx * 9 - dy * 5, c.y + dy * 9 - dx * 5, c.x + dx * 9 + dy * 5, c.y + dy * 9 + dx * 5);
    }

    this.titleText.setText(`LEVEL EDITOR  -  ${this.sourceLabel()}${this.dirty ? ' *' : ''}  -  "${L.name ?? ''}"`);
    const flat = L.rows.join('');
    const count = (c: string) => flat.split(c).length - 1;
    const problems = validateLevel(L);
    this.infoText.setText(
      [
        `Pebbles ${count('H')} (${L.shotPebbles.length} give shots)`,
        `Framers ${L.framers.length}   Enemies ${L.enemies.length}`,
        count('C') ? 'Chest: yes' : 'Chest: none (door opens on last pebble)',
        '',
        problems.length ? `Problems: ${problems.join('; ')}` : 'Ready to play-test / verify.',
        '',
        'Left-click/drag paints, right-click erases.',
        'Click a Gol / Don Medusa again to turn it.',
      ].join('\n'),
    );
    const p = L.power;
    this.powerLabel.setText(p ? `Power: ${p.kind} after ${p.pebbles} pebble${p.pebbles === 1 ? '' : 's'}` : 'Power: none');
  }

  private sourceLabel(): string {
    const s = this.source;
    if (s.kind === 'campaign') {
      const floor = Math.floor((s.id - 1) / 5) + 1;
      return `Campaign ${floor}-${((s.id - 1) % 5) + 1}${hasOverride(s.id) ? ' (edited)' : ''}`;
    }
    if (s.kind === 'custom') return `My room ${s.slot + 1}`;
    return 'New room (unsaved)';
  }

  // --- Commands ---------------------------------------------------------------

  /** Every loadable room in order: campaign 1..N, then the player's own rooms. */
  private sources(): EditorSource[] {
    const out: EditorSource[] = [];
    for (let id = 1; id <= PQ_LEVEL_COUNT; id++) out.push({ kind: 'campaign', id });
    loadLibrary().custom.forEach((_, slot) => out.push({ kind: 'custom', slot }));
    return out;
  }

  private loadSource(src: EditorSource): void {
    this.snapshot();
    this.source = src;
    if (src.kind === 'campaign') this.level = cloneLevel(campaignLevel(src.id));
    else if (src.kind === 'custom') this.level = cloneLevel(loadLibrary().custom[src.slot]);
    this.dirty = false;
    this.lastSolution = null;
    this.verifyText.setText('');
    this.refresh();
  }

  private loadAdjacent(delta: number): void {
    const all = this.sources();
    const s = this.source;
    let i = all.findIndex((o) => o.kind === s.kind && (o.kind === 'campaign' ? o.id === (s as { id: number }).id : o.kind === 'custom' && o.slot === (s as { slot: number }).slot));
    if (i < 0) i = delta > 0 ? -1 : 0;
    this.loadSource(all[(i + delta + all.length) % all.length]);
  }

  private newLevel(): void {
    this.snapshot();
    this.source = { kind: 'new' };
    this.level = blankLevel(0, `My room ${loadLibrary().custom.length + 1}`);
    this.dirty = false;
    this.lastSolution = null;
    this.verifyText.setText('');
    this.refresh();
  }

  private rename(): void {
    const name = window.prompt('Room name', this.level.name ?? '');
    if (name === null) return;
    this.snapshot();
    this.level.name = name.trim().slice(0, 40) || this.level.name;
    this.dirty = true;
    this.refresh();
  }

  private save(asCopy: boolean): void {
    const problems = validateLevel(this.level);
    if (problems.length) {
      this.verifyText.setColor('#e40058').setText(`Can't save: ${problems.join('; ')}`);
      return;
    }
    const s = this.source;
    if (!asCopy && s.kind === 'campaign') {
      saveOverride({ ...this.level, id: s.id });
      this.verifyText.setColor('#b8f818').setText(`Saved - the campaign now plays your version of this room. "Revert" restores the original.`);
    } else {
      const slot = saveCustom({ ...this.level, id: 0 }, !asCopy && s.kind === 'custom' ? s.slot : -1);
      this.source = { kind: 'custom', slot };
      this.verifyText.setColor('#b8f818').setText(`Saved as My room ${slot + 1}.`);
    }
    this.dirty = false;
    this.refresh();
  }

  private revertOrDelete(): void {
    const s = this.source;
    if (s.kind === 'campaign') {
      if (!hasOverride(s.id)) {
        this.loadSource(s);
        this.verifyText.setColor('#bcbcbc').setText('Reloaded the original room.');
        return;
      }
      clearOverride(s.id);
      this.snapshot();
      this.level = cloneLevel(LEVELS[s.id - 1]);
      this.dirty = false;
      this.verifyText.setColor('#bcbcbc').setText('Reverted to the original room.');
    } else if (s.kind === 'custom') {
      deleteCustom(s.slot);
      this.source = { kind: 'new' };
      this.dirty = true;
      this.verifyText.setColor('#bcbcbc').setText('Deleted from My rooms (still open here - Save to keep it, Z to undo edits).');
    }
    this.refresh();
  }

  private editorState(): PebbleEditorInitData {
    return { level: cloneLevel(this.level), source: this.source, history: this.history, dirty: this.dirty };
  }

  private playTest(demo: Action[] | null): void {
    const problems = validateLevel(this.level);
    if (problems.length) {
      this.verifyText.setColor('#e40058').setText(`Can't play: ${problems.join('; ')}`);
      return;
    }
    const data: PebbleLevelInitData = { level: cloneLevel(this.level), editor: this.editorState() };
    if (demo) data.demo = demo;
    this.scene.start('PebbleLevel', data);
  }

  private startVerify(): void {
    const problems = validateLevel(this.level);
    if (problems.length) {
      this.verifyText.setColor('#e40058').setText(`Can't verify: ${problems.join('; ')}`);
      return;
    }
    this.lastSolution = null;
    this.verifyText.setColor('#b8f818').setText('Verifying...');
    this.verifying = solveIter(cloneLevel(this.level), { maxStates: 400_000 });
  }

  private showVerifyResult(r: SolveResult): void {
    if (r.solved) {
      this.lastSolution = r.path!;
      this.verifyText.setColor('#b8f818').setText(`Solvable! Found a ${r.path!.length}-move solution (${r.explored.toLocaleString()} states). "Watch" plays it.`);
    } else if (r.aborted) {
      this.verifyText.setColor('#f8b800').setText(`Undecided: the search gave up after ${r.explored.toLocaleString()} states. It may still be solvable - play-test it.`);
    } else {
      this.verifyText.setColor('#e40058').setText(`No solution exists (checked all ${r.explored.toLocaleString()} reachable states).`);
    }
  }

  private watchSolution(): void {
    if (!this.lastSolution) {
      this.verifyText.setColor('#f8b800').setText('Verify first, then Watch replays the solution.');
      return;
    }
    this.playTest(this.lastSolution);
  }

  private exportLevel(): void {
    const json = JSON.stringify(this.level, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const slug = (this.level.name ?? 'room').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    a.download = `pebble-${slug}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    navigator.clipboard?.writeText(json).catch(() => undefined);
    this.verifyText
      .setColor('#b8f818')
      .setText('Exported: downloaded as JSON and copied to the clipboard. To ship it, add it to scripts/pebble-overrides.json.');
  }

  private importLevel(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      file.text().then((text) => {
        try {
          const level = parseLevelJson(text);
          this.snapshot();
          this.level = level;
          this.source = { kind: 'new' };
          this.dirty = true;
          this.lastSolution = null;
          this.verifyText.setColor('#b8f818').setText(`Imported "${level.name}". Save to keep it.`);
          this.refresh();
        } catch (err) {
          this.verifyText.setColor('#e40058').setText(`Import failed: ${(err as Error).message}`);
        }
      });
    };
    input.click();
  }

  private cyclePower(): void {
    this.snapshot();
    const cur = this.level.power?.kind ?? null;
    const next = POWER_CYCLE[(POWER_CYCLE.indexOf(cur) + 1) % POWER_CYCLE.length];
    if (next) this.level.power = { kind: next, pebbles: this.level.power?.pebbles ?? 0 };
    else delete this.level.power;
    this.dirty = true;
    this.lastSolution = null;
    this.refresh();
  }

  private adjustPowerPebbles(delta: number): void {
    if (!this.level.power) return;
    this.snapshot();
    const max = this.level.rows.join('').split('H').length - 1;
    this.level.power.pebbles = Math.max(0, Math.min(max, this.level.power.pebbles + delta));
    this.dirty = true;
    this.lastSolution = null;
    this.refresh();
  }
}
