import Phaser from 'phaser';

/**
 * NES-style USB controller support for every game in the arcade.
 *
 * The games are written against the keyboard, so rather than teach each one
 * about gamepads, this bridge reads the controller (the browser Gamepad API)
 * once a frame and turns its eight inputs - the D-pad, A, B, Select and Start -
 * into ordinary keyboard events. Each scene says what the buttons mean there
 * with `setPadProfile` (e.g. A = "SPACE" in Rogue Dungeon, A = "W"/"ENTER" in
 * Turbo Kart); scenes that don't say get the menu default below. The keyboard
 * keeps working exactly as before.
 *
 * Cheap NES pads report their buttons in all sorts of orders, so the default
 * layout is a best guess (standard-mapped pads are reliable; others vary) and
 * `PadSetupScene` lets you press each button to remap it. Mappings are
 * remembered per controller model in localStorage.
 */

export type PadButton = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'select' | 'start';
export const PAD_BUTTONS: PadButton[] = ['up', 'down', 'left', 'right', 'a', 'b', 'select', 'start'];
const DPAD: PadButton[] = ['up', 'down', 'left', 'right'];

/**
 * What a button does: a key (Phaser key name - "SPACE", "UP", "E", "ONE"...),
 * several keys at once, or a tap/hold pair: `hold` is pressed while the
 * button is held, and `tap` is sent on release if nothing else was pressed
 * meanwhile (so B can be "sidestep modifier" when held and "inventory" when tapped).
 */
export type PadBinding = string | string[] | { hold?: string; tap?: string };

export interface PadProfile {
  up?: PadBinding;
  down?: PadBinding;
  left?: PadBinding;
  right?: PadBinding;
  a?: PadBinding;
  b?: PadBinding;
  select?: PadBinding;
  start?: PadBinding;
  /** Pressing Select and Start together sends this key (then neither sends its own). */
  selectStart?: string;
  /** One-line summary for the controller screen and HUD hints. */
  hint?: string;
}

/** Menus: D-pad moves, A / Start choose, B goes back. */
export const MENU_PROFILE: PadProfile = {
  up: 'UP',
  down: 'DOWN',
  left: 'LEFT',
  right: 'RIGHT',
  a: 'ENTER',
  b: 'ESC',
  start: 'ENTER',
  hint: 'D-pad choose   A / Start select   B back',
};

// --- Key events ------------------------------------------------------------------

interface KeyInfo {
  key: string;
  code: string;
  keyCode: number;
}

const NAMED: Record<string, KeyInfo> = {
  UP: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
  DOWN: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
  LEFT: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
  RIGHT: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
  ENTER: { key: 'Enter', code: 'Enter', keyCode: 13 },
  SPACE: { key: ' ', code: 'Space', keyCode: 32 },
  ESC: { key: 'Escape', code: 'Escape', keyCode: 27 },
  SHIFT: { key: 'Shift', code: 'ShiftLeft', keyCode: 16 },
  CTRL: { key: 'Control', code: 'ControlLeft', keyCode: 17 },
  TAB: { key: 'Tab', code: 'Tab', keyCode: 9 },
  BACKSPACE: { key: 'Backspace', code: 'Backspace', keyCode: 8 },
};
const DIGITS = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];

function keyInfo(name: string): KeyInfo {
  const n = NAMED[name];
  if (n) return n;
  const d = DIGITS.indexOf(name);
  if (d >= 0) return { key: String(d), code: `Digit${d}`, keyCode: 48 + d };
  if (/^[A-Z]$/.test(name)) return { key: name.toLowerCase(), code: `Key${name}`, keyCode: name.charCodeAt(0) };
  throw new Error(`Pad: unknown key "${name}"`);
}

function sendKey(name: string, down: boolean, repeat = false): void {
  const k = keyInfo(name);
  const ev = new KeyboardEvent(down ? 'keydown' : 'keyup', { key: k.key, code: k.code, repeat, bubbles: true, cancelable: true });
  // Phaser reads the (deprecated) keyCode, which a constructed event leaves at 0.
  Object.defineProperty(ev, 'keyCode', { get: () => k.keyCode });
  Object.defineProperty(ev, 'which', { get: () => k.keyCode });
  window.dispatchEvent(ev);
}

/** Keys "tapped" last frame, let go this frame - so code polling JustDown sees them. */
let pendingUp: string[] = [];

function tapKey(name: string): void {
  sendKey(name, true);
  pendingUp.push(name);
}

// --- Reading the controller -----------------------------------------------------

/** Where a controller input lives: a button, one direction of an axis, or a direction of a POV-hat axis. */
export type PadInput = { type: 'button'; index: number } | { type: 'axis'; index: number; dir: 1 | -1 } | { type: 'hat'; index: number; dir: 'up' | 'down' | 'left' | 'right' };

export type PadLayout = Record<PadButton, PadInput[]>;

const LAYOUT_KEY = 'game-arcade.pad-layouts.v1';

function loadLayouts(): Record<string, PadLayout> {
  try {
    return JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? '{}') as Record<string, PadLayout>;
  } catch {
    return {};
  }
}

export function saveLayout(padId: string, layout: PadLayout | null): void {
  try {
    const all = loadLayouts();
    if (layout) all[padId] = layout;
    else delete all[padId];
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(all));
  } catch {
    // Storage blocked: the mapping just lasts for this session.
  }
  layoutCache.delete(padId);
}

export function hasCustomLayout(padId: string): boolean {
  return padId in loadLayouts();
}

/** A best guess for a controller nobody has set up yet. */
function defaultLayout(pad: Gamepad): PadLayout {
  const axes: PadLayout = {
    up: [{ type: 'axis', index: 1, dir: -1 }],
    down: [{ type: 'axis', index: 1, dir: 1 }],
    left: [{ type: 'axis', index: 0, dir: -1 }],
    right: [{ type: 'axis', index: 0, dir: 1 }],
    a: [],
    b: [],
    select: [{ type: 'button', index: 8 }],
    start: [{ type: 'button', index: 9 }],
  };
  if (pad.mapping === 'standard') {
    // Standard layout: the NES A sits where the right face button is, B the bottom one.
    return {
      ...axes,
      up: [{ type: 'button', index: 12 }, ...axes.up],
      down: [{ type: 'button', index: 13 }, ...axes.down],
      left: [{ type: 'button', index: 14 }, ...axes.left],
      right: [{ type: 'button', index: 15 }, ...axes.right],
      a: [{ type: 'button', index: 1 }],
      b: [{ type: 'button', index: 0 }],
    };
  }
  // Generic USB NES pads mostly report A = 1, B = 2 and the D-pad on axes 0/1;
  // some put the D-pad on a POV-hat axis (usually 9) instead.
  const hat = (dir: 'up' | 'down' | 'left' | 'right'): PadInput[] => (pad.axes.length > 9 ? [{ type: 'hat', index: 9, dir }] : []);
  return {
    ...axes,
    up: [...axes.up, ...hat('up')],
    down: [...axes.down, ...hat('down')],
    left: [...axes.left, ...hat('left')],
    right: [...axes.right, ...hat('right')],
    a: [{ type: 'button', index: 1 }],
    b: [{ type: 'button', index: 2 }],
  };
}

const layoutCache = new Map<string, PadLayout>();

function layoutFor(pad: Gamepad): PadLayout {
  let l = layoutCache.get(pad.id);
  if (!l) {
    l = loadLayouts()[pad.id] ?? defaultLayout(pad);
    layoutCache.set(pad.id, l);
  }
  return l;
}

const HAT_DIRS: string[][] = [['up'], ['up', 'right'], ['right'], ['down', 'right'], ['down'], ['down', 'left'], ['left'], ['up', 'left']];

/** Decodes a POV-hat axis value (-1 = up, stepping 2/7 clockwise; > 1 = centred). */
export function hatDirs(v: number): string[] {
  if (Math.abs(v) > 1.05) return [];
  return HAT_DIRS[Math.round((v + 1) / (2 / 7)) % 8] ?? [];
}

function inputDown(pad: Gamepad, inp: PadInput): boolean {
  if (inp.type === 'button') {
    const b = pad.buttons[inp.index];
    return !!b && (b.pressed || b.value > 0.5);
  }
  const v = pad.axes[inp.index];
  if (v === undefined) return false;
  if (inp.type === 'axis') return v * inp.dir > 0.5;
  return hatDirs(v).includes(inp.dir);
}

/** The first connected controller, if any. */
export function activePad(): Gamepad | null {
  const pads = navigator.getGamepads?.() ?? [];
  for (const p of pads) if (p && p.connected) return p;
  return null;
}

/** Which NES buttons are down on the active controller right now (null if none is connected). */
export function padState(): Record<PadButton, boolean> | null {
  const pad = activePad();
  if (!pad) return null;
  const layout = layoutFor(pad);
  const out = {} as Record<PadButton, boolean>;
  for (const b of PAD_BUTTONS) out[b] = layout[b].some((inp) => inputDown(pad, inp));
  return out;
}

// --- The bridge ---------------------------------------------------------------------

const profiles = new WeakMap<Phaser.Scene, PadProfile>();

/** Sets what the controller does while this scene is on top. Call again any time (e.g. when a menu opens). */
export function setPadProfile(scene: Phaser.Scene, profile: PadProfile): void {
  profiles.set(scene, profile);
}

/** Stops the bridge sending key events (the controller setup screen reads the pad itself). */
let suspended = false;
export function suspendPad(on: boolean): void {
  suspended = on;
  if (on) releaseAll();
}

interface Held {
  /** Keys this press has sent down. */
  keys: string[];
  /** A tap key to send on release, unless cancelled. */
  tap?: string;
  since: number;
  lastRepeat: number;
}

const held = new Map<PadButton, Held>();
let chordFired = false;
let game: Phaser.Game | null = null;
let lastPadId = '';

function releaseAll(): void {
  for (const h of held.values()) for (const k of h.keys) sendKey(k, false);
  held.clear();
}

function currentProfile(): PadProfile {
  if (!game) return MENU_PROFILE;
  const scenes = game.scene.getScenes(true);
  // Topmost scene first, so an overlay's profile wins over the scene beneath it.
  for (let i = scenes.length - 1; i >= 0; i--) {
    const p = profiles.get(scenes[i]);
    if (p) return p;
  }
  return MENU_PROFILE;
}

function press(btn: PadButton, profile: PadProfile, now: number): void {
  // Any other press turns a pending tap into a hold.
  for (const h of held.values()) h.tap = undefined;
  const bind = profile[btn];
  const h: Held = { keys: [], since: now, lastRepeat: now };
  const inChord = profile.selectStart && (btn === 'select' || btn === 'start');
  if (inChord) {
    const other = held.get(btn === 'select' ? 'start' : 'select');
    if (other) {
      // Both down: the chord replaces what either would have done.
      other.tap = undefined;
      chordFired = true;
      tapKey(profile.selectStart!);
      held.set(btn, h);
      return;
    }
    // Wait for the release to see if this was the chord or a tap.
    if (typeof bind === 'string') h.tap = bind;
    else if (bind && !Array.isArray(bind)) h.tap = bind.tap;
    held.set(btn, h);
    return;
  }
  if (typeof bind === 'string') h.keys = [bind];
  else if (Array.isArray(bind)) h.keys = [...bind];
  else if (bind) {
    if (bind.hold) h.keys = [bind.hold];
    h.tap = bind.tap;
  }
  for (const k of h.keys) sendKey(k, true);
  held.set(btn, h);
}

function release(btn: PadButton): void {
  const h = held.get(btn);
  if (!h) return;
  held.delete(btn);
  for (const k of h.keys) sendKey(k, false);
  if (h.tap && !chordFired) tapKey(h.tap);
  if (!held.has('select') && !held.has('start')) chordFired = false;
}

let lastProfile: PadProfile | null = null;

function poll(): void {
  for (const k of pendingUp) sendKey(k, false);
  pendingUp = [];
  if (suspended) return;
  const pad = activePad();
  if (!pad) {
    if (held.size) releaseAll();
    return;
  }
  if (pad.id !== lastPadId) {
    lastPadId = pad.id;
    toast(`Controller connected: ${shortName(pad.id)}${hasCustomLayout(pad.id) ? '' : ' - press C on the arcade screen to set up its buttons'}`);
  }
  const profile = currentProfile();
  const layout = layoutFor(pad);
  const now = performance.now();
  if (profile !== lastProfile) {
    // Buttons held across a scene / menu change would otherwise stick down -
    // and must not count as fresh presses on the new screen either (the A that
    // chose a menu option shouldn't also pick something on the next one), so
    // they're ignored until let go.
    releaseAll();
    lastProfile = profile;
    for (const btn of PAD_BUTTONS) {
      if (layout[btn].some((inp) => inputDown(pad, inp))) held.set(btn, { keys: [], since: now, lastRepeat: now });
    }
    chordFired = held.has('select') || held.has('start');
  }
  for (const btn of PAD_BUTTONS) {
    const down = layout[btn].some((inp) => inputDown(pad, inp));
    const was = held.get(btn);
    if (down && !was) press(btn, profile, now);
    else if (!down && was) release(btn);
    else if (down && was && DPAD.includes(btn) && was.keys.length) {
      // Auto-repeat the D-pad like a held key, for scrolling through menus.
      if (now - was.since > 380 && now - was.lastRepeat > 110) {
        was.lastRepeat = now;
        for (const k of was.keys) sendKey(k, true, true);
      }
    }
  }
}

export function shortName(id: string): string {
  return id.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || 'gamepad';
}

// --- A small on-page notice --------------------------------------------------------

let toastEl: HTMLDivElement | null = null;
let toastTimer = 0;

function toast(msg: string): void {
  if (!toastEl) {
    toastEl = document.createElement('div');
    Object.assign(toastEl.style, {
      position: 'fixed',
      left: '50%',
      bottom: '18px',
      transform: 'translateX(-50%)',
      padding: '8px 14px',
      background: 'rgba(12, 12, 20, 0.92)',
      color: '#e7e2d3',
      border: '1px solid #767e94',
      borderRadius: '6px',
      font: '13px monospace',
      pointerEvents: 'none',
      zIndex: '10',
      transition: 'opacity 0.4s',
    });
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.style.opacity = '1';
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl && (toastEl.style.opacity = '0'), 4200);
}

/** Starts reading the controller every frame. Call once, after creating the game. */
export function installPad(g: Phaser.Game): void {
  game = g;
  g.events.on(Phaser.Core.Events.PRE_STEP, poll);
  window.addEventListener('gamepaddisconnected', () => {
    if (!activePad()) {
      releaseAll();
      lastPadId = '';
      toast('Controller disconnected');
    }
  });
}
