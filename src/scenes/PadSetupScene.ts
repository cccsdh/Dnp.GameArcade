import Phaser from 'phaser';
import {
  PAD_BUTTONS,
  activePad,
  hasCustomLayout,
  hatDirs,
  padState,
  saveLayout,
  setPadProfile,
  shortName,
  suspendPad,
  type PadButton,
  type PadInput,
  type PadLayout,
} from '../game/shared/Pad';
import { PAD_REFERENCE } from '../game/shared/PadProfiles';
import { SoundManager } from '../game/shared/Sound';

const LABEL: Record<PadButton, string> = {
  up: 'UP on the D-pad',
  down: 'DOWN on the D-pad',
  left: 'LEFT on the D-pad',
  right: 'RIGHT on the D-pad',
  a: 'the A button',
  b: 'the B button',
  select: 'SELECT',
  start: 'START',
};

// Where each button sits on the drawn controller (in its 460 x 190 frame).
const DPAD_C = { x: 96, y: 112 };
const SPOTS: Record<PadButton, { x: number; y: number }> = {
  up: { x: DPAD_C.x, y: DPAD_C.y - 30 },
  down: { x: DPAD_C.x, y: DPAD_C.y + 30 },
  left: { x: DPAD_C.x - 30, y: DPAD_C.y },
  right: { x: DPAD_C.x + 30, y: DPAD_C.y },
  select: { x: 196, y: 128 },
  start: { x: 262, y: 128 },
  b: { x: 336, y: 124 },
  a: { x: 404, y: 124 },
};

type Mode = { kind: 'waiting' } | { kind: 'test' } | { kind: 'map'; step: number; ready: boolean; layout: Partial<PadLayout> };

/**
 * Controller setup: shows a NES pad that lights up as you press its buttons,
 * lets you map a controller whose buttons come out in the wrong order (press
 * each button when asked), and lists what the buttons do in every game.
 */
export class PadSetupScene extends Phaser.Scene {
  private mode: Mode = { kind: 'waiting' };
  private pad!: Phaser.GameObjects.Graphics;
  private status!: Phaser.GameObjects.Text;
  private padName!: Phaser.GameObjects.Text;
  private originX = 0;
  private originY = 0;
  private scaleF = 1;
  private axisRest: number[] = [];
  private sfx!: SoundManager;

  constructor() {
    super('PadSetup');
  }

  create(): void {
    this.sfx = new SoundManager(this);
    this.mode = { kind: 'waiting' };
    const { width: W, height: H } = this.scale;
    this.add.rectangle(W / 2, H / 2, W, H, 0x0b0b12);
    this.add.text(W / 2, H * 0.07, 'CONTROLLER', { fontFamily: 'monospace', fontSize: '30px', color: '#e7e2d3', fontStyle: 'bold' }).setOrigin(0.5);
    this.padName = this.add.text(W / 2, H * 0.07 + 30, '', { fontFamily: 'monospace', fontSize: '12px', color: '#767e94' }).setOrigin(0.5);

    this.scaleF = Math.min(1.2, (W * 0.8) / 460, (H * 0.34) / 190);
    this.originX = W / 2 - (460 * this.scaleF) / 2;
    this.originY = H * 0.14;
    this.pad = this.add.graphics();
    this.add
      .text(this.originX + 229 * this.scaleF, this.originY + 102 * this.scaleF, 'SELECT       START', {
        fontFamily: 'monospace',
        fontSize: `${Math.round(10 * this.scaleF)}px`,
        color: '#e03828',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(1);
    for (const [b, s] of [['b', SPOTS.b], ['a', SPOTS.a]] as const) {
      this.add
        .text(this.originX + (s.x + 20) * this.scaleF, this.originY + (s.y + 36) * this.scaleF, b.toUpperCase(), {
          fontFamily: 'monospace',
          fontSize: `${Math.round(14 * this.scaleF)}px`,
          color: '#e03828',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(1);
    }

    const statusY = this.originY + 190 * this.scaleF + 26;
    this.status = this.add
      .text(W / 2, statusY, '', { fontFamily: 'monospace', fontSize: '15px', color: '#f8d800', align: 'center', lineSpacing: 6 })
      .setOrigin(0.5, 0);

    const refY = statusY + 86;
    this.add.text(W / 2, refY, 'WHAT THE BUTTONS DO', { fontFamily: 'monospace', fontSize: '13px', color: '#8d98ad', fontStyle: 'bold' }).setOrigin(0.5);
    const wrap = Math.min(W - 40, 900);
    let y = refY + 24;
    for (const r of PAD_REFERENCE) {
      const t = this.add.text(W / 2 - wrap / 2, y, [r.game, `  ${r.hint}`], {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#c9cdd6',
        lineSpacing: 2,
        wordWrap: { width: wrap },
      });
      y += t.height + 8;
    }
    this.add
      .text(W / 2, H - 16, 'Keyboard: R map buttons   D use default layout   Esc back.  The keyboard always works too.', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#767e94',
      })
      .setOrigin(0.5);

    const back = this.add.text(16, 14, '< Games', { fontFamily: 'monospace', fontSize: '14px', color: '#c8c8c8' }).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.leave());

    // While testing, Start leaves and Select re-maps; the other buttons just light up.
    setPadProfile(this, { start: 'ESC', select: 'R' });
    const kb = this.input.keyboard!;
    kb.on('keydown-ESC', () => (this.mode.kind === 'map' ? this.stopMapping('Mapping cancelled.') : this.leave()));
    kb.on('keydown-R', () => this.startMapping());
    kb.on('keydown-D', () => this.useDefaults());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => suspendPad(false));
  }

  private leave(): void {
    this.sfx.play('uiClick');
    this.scene.start('GameSelect');
  }

  private startMapping(): void {
    const pad = activePad();
    if (!pad) {
      this.status.setText('No controller found - plug one in and press any of its buttons.');
      return;
    }
    suspendPad(true);
    this.axisRest = [...pad.axes];
    this.mode = { kind: 'map', step: 0, ready: false, layout: {} };
  }

  private stopMapping(msg: string): void {
    suspendPad(false);
    this.mode = { kind: activePad() ? 'test' : 'waiting' };
    this.flash(msg);
  }

  private useDefaults(): void {
    const pad = activePad();
    if (!pad) return;
    saveLayout(pad.id, null);
    this.flash('Using the default layout for this controller.');
  }

  private flashMsg = '';
  private flashUntil = 0;

  private flash(msg: string): void {
    this.flashMsg = msg;
    this.flashUntil = this.time.now + 2600;
  }

  /** The input that has just moved away from rest, if any. */
  private detect(pad: Gamepad): PadInput | null {
    for (let i = 0; i < pad.buttons.length; i++) {
      if (pad.buttons[i].pressed || pad.buttons[i].value > 0.5) return { type: 'button', index: i };
    }
    for (let i = 0; i < pad.axes.length; i++) {
      const v = pad.axes[i];
      const rest = this.axisRest[i] ?? 0;
      if (Math.abs(rest) > 1.05) {
        // A POV hat: centred reads as a value above 1.
        const dirs = hatDirs(v);
        if (dirs.length === 1) return { type: 'hat', index: i, dir: dirs[0] as 'up' };
      } else if (Math.abs(v) > 0.6 && Math.abs(v - rest) > 0.5) {
        return { type: 'axis', index: i, dir: v > 0 ? 1 : -1 };
      }
    }
    return null;
  }

  update(): void {
    const pad = activePad();
    const m = this.mode;
    if (!pad) {
      if (m.kind === 'map') suspendPad(false);
      this.mode = { kind: 'waiting' };
    } else if (m.kind === 'waiting') {
      this.mode = { kind: 'test' };
    }
    this.padName.setText(pad ? `${shortName(pad.id)}  -  ${hasCustomLayout(pad.id) ? 'your button mapping' : 'default layout'}` : '');

    let lit: Partial<Record<PadButton, boolean>> = {};
    let target: PadButton | null = null;
    let msg: string;
    if (this.mode.kind === 'waiting') {
      msg = 'No controller found.\nPlug in a USB controller and press one of its buttons.';
    } else if (this.mode.kind === 'test') {
      lit = padState() ?? {};
      msg = 'Press buttons to test them - they light up above.\nWrong ones? Press SELECT (or R) to map them.   START (or Esc) to go back.';
    } else {
      const mm = this.mode;
      const btn = PAD_BUTTONS[mm.step];
      target = btn;
      const hit = this.detect(pad!);
      if (!mm.ready) {
        // Wait for everything to be let go before asking for the next button.
        if (!hit) mm.ready = true;
      } else if (hit) {
        mm.layout[btn] = [hit];
        this.sfx.play('uiClick');
        mm.step++;
        mm.ready = false;
        if (mm.step >= PAD_BUTTONS.length) {
          saveLayout(pad!.id, mm.layout as PadLayout);
          this.stopMapping('Saved! Your controller is set up.');
        }
      }
      msg = `Press ${LABEL[btn]}   (${mm.step + 1} of ${PAD_BUTTONS.length})\nEsc cancels.`;
    }
    if (this.time.now < this.flashUntil && this.mode.kind !== 'map') msg = `${this.flashMsg}\n${msg}`;
    this.status.setText(msg);
    this.drawPad(lit, target);
  }

  private drawPad(lit: Partial<Record<PadButton, boolean>>, target: PadButton | null): void {
    const g = this.pad;
    const s = this.scaleF;
    const X = (x: number) => this.originX + x * s;
    const Y = (y: number) => this.originY + y * s;
    const pulse = 0.55 + 0.45 * Math.sin(this.time.now / 140);
    const glow = (b: PadButton) => (lit[b] ? 0xf8d800 : target === b ? Phaser.Display.Color.GetColor(248, Math.round(216 * pulse), 0) : 0);
    g.clear();
    // Body and face plate.
    g.fillStyle(0xbcbcbc, 1).fillRoundedRect(X(0), Y(0), 460 * s, 190 * s, 14 * s);
    g.fillStyle(0x1c1c1c, 1).fillRoundedRect(X(14), Y(34), 432 * s, 142 * s, 8 * s);
    g.fillStyle(0xa8a8a8, 1).fillRect(X(160), Y(46), 138 * s, 16 * s);
    g.fillStyle(0xa8a8a8, 1).fillRect(X(160), Y(70), 138 * s, 16 * s);
    g.fillStyle(0xbcbcbc, 1).fillRoundedRect(X(160), Y(112), 138 * s, 34 * s, 6 * s);
    // D-pad.
    g.fillStyle(0x0c0c0c, 1).fillRect(X(DPAD_C.x - 15), Y(DPAD_C.y - 46), 30 * s, 92 * s);
    g.fillRect(X(DPAD_C.x - 46), Y(DPAD_C.y - 15), 92 * s, 30 * s);
    for (const d of ['up', 'down', 'left', 'right'] as const) {
      const c = glow(d);
      if (!c) continue;
      const p = SPOTS[d];
      g.fillStyle(c, 1).fillRect(X(p.x - 13), Y(p.y - 13), 26 * s, 26 * s);
    }
    // Select / Start.
    for (const b of ['select', 'start'] as const) {
      const p = SPOTS[b];
      g.fillStyle(glow(b) || 0x2c2c2c, 1).fillRoundedRect(X(p.x - 22), Y(p.y - 7), 44 * s, 14 * s, 7 * s);
    }
    // B / A.
    for (const b of ['b', 'a'] as const) {
      const p = SPOTS[b];
      g.fillStyle(0xd8d8d8, 1).fillRoundedRect(X(p.x - 30), Y(p.y - 30), 60 * s, 60 * s, 8 * s);
      g.fillStyle(glow(b) || 0xc81c10, 1).fillCircle(X(p.x), Y(p.y), 24 * s);
    }
  }
}
