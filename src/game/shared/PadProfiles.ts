import { MENU_PROFILE, type PadProfile } from './Pad';

/**
 * What the NES controller's buttons do in each game (see Pad.ts). Kept in one
 * place so the controller screen can list them all.
 */

/** The arcade screen: menus, plus Select for the controller setup. */
export const ARCADE_PAD: PadProfile = { ...MENU_PROFILE, select: 'C', hint: 'D-pad choose   A / Start play   Select controller setup' };

export const ROGUE_PAD: PadProfile = {
  up: 'UP',
  down: 'DOWN',
  left: 'LEFT',
  right: 'RIGHT',
  a: 'SPACE',
  b: 'Q',
  hint: 'D-pad move   A attack   B drink a potion',
};

export const PEBBLE_PAD: PadProfile = {
  up: 'UP',
  down: 'DOWN',
  left: 'LEFT',
  right: 'RIGHT',
  a: 'SPACE',
  // Tap B for the room's power; hold it while moving to super-push.
  b: { hold: 'SHIFT', tap: 'E' },
  select: 'Z',
  start: 'ESC',
  selectStart: 'R',
  hint: 'D-pad move   A magic shot   B power (hold + move: super push)   Select undo   Start leave   Select+Start restart',
};

export const KART_PAD: PadProfile = {
  up: 'X',
  down: 'DOWN',
  left: 'LEFT',
  right: 'RIGHT',
  // A accelerates (and restarts from the results screen).
  a: ['W', 'ENTER'],
  b: 'SPACE',
  select: 'X',
  start: 'ESC',
  hint: 'A accelerate   B drift   D-pad steer, Down brake/reverse   Up or Select use item   Start quit race',
};

export const UNDERREALM_PAD: PadProfile = {
  up: 'UP',
  down: 'DOWN',
  left: 'LEFT',
  right: 'RIGHT',
  a: 'F',
  // Tap B for your pack; hold it with Left / Right to sidestep.
  b: { hold: 'SHIFT', tap: 'I' },
  select: 'M',
  start: 'ESC',
  hint: 'D-pad walk / turn   A search   B inventory (hold + Left/Right: sidestep)   Select map   Start menu',
};

export const LOLLIPOP_PAD: PadProfile = {
  up: 'UP',
  down: 'DOWN',
  left: 'LEFT',
  right: 'RIGHT',
  a: 'SPACE',
  b: 'SHIFT',
  select: 'M',
  start: 'ESC',
  hint: 'D-pad move   A fire (aims itself)   B sugar spin   Select mute   Start pause',
};

/** For the controller screen's reference list. */
export const PAD_REFERENCE: { game: string; hint: string }[] = [
  { game: 'Menus (everywhere)', hint: MENU_PROFILE.hint! },
  { game: 'Rogue Dungeon', hint: ROGUE_PAD.hint! },
  { game: 'Pebble Quest', hint: PEBBLE_PAD.hint! },
  { game: 'Turbo Kart', hint: KART_PAD.hint! },
  { game: 'The Underrealm', hint: UNDERREALM_PAD.hint! },
  { game: 'Lollipop Legion', hint: LOLLIPOP_PAD.hint! },
];
