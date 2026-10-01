/**
 * Shared audio layer.
 *
 * Cues listed in SFX_FILES / MUSIC_FILES play real clips (Rogue Dungeon's CC0
 * audio - see Audio_Art/CREDITS.md). Cues in SYNTH_SFX / SYNTH_MUSIC are
 * generated at runtime by the chiptune synth in Chiptune.ts. `playTrack` plays
 * anything else (an Underrealm adventure's own chiptune or audio file). Any other cue is a stub that just logs to the
 * console, so gameplay code can call play()/playMusic() freely.
 * To add a clip: drop `<name>.ogg` + `<name>.mp3` into Audio_Art/sfx or
 * Audio_Art/music, run `npm run assets:sync`, and list it below.
 */

import { playBufferSong, playChipSfx, playChipSong, stopChipSong, type ChipSfxId, type SongId } from './Chiptune';

const sfx = (name: string): string[] => [`assets/audio/sfx/${name}.ogg`, `assets/audio/sfx/${name}.mp3`];
const music = (name: string): string[] => [`assets/audio/music/${name}.ogg`, `assets/audio/music/${name}.mp3`];

const SFX_FILES: Partial<Record<SfxKey, string[]>> = {
  uiClick: sfx('ui-click'),
  uiHover: sfx('ui-hover'),
  playerAttack: sfx('player-attack'),
  playerHurt: sfx('player-hurt'),
  playerDeath: sfx('player-death'),
  enemyHurt: sfx('enemy-hurt'),
  enemyDeath: sfx('enemy-death'),
  pickupGold: sfx('pickup-gold'),
  pickupPotion: sfx('pickup-potion'),
  chestOpen: sfx('chest-open'),
  stairsDescend: sfx('stairs-descend'),
  trapHit: sfx('trap-hit'),
  // Turbo Kart reuses the CC0 impact clips for kart-on-kart and wall hits.
  kartBump: sfx('enemy-hurt'),
  kartCrash: sfx('player-hurt'),
};

const SYNTH_SFX: Partial<Record<SfxKey, ChipSfxId>> = {
  pqPebble: 'pebble',
  pqShotsGained: 'shotsGained',
  pqPush: 'push',
  pqShot: 'shot',
  pqEgg: 'egg',
  pqEggAway: 'eggAway',
  pqAbsorbed: 'absorbed',
  pqHatch: 'hatch',
  pqChest: 'chest',
  pqJewel: 'jewel',
  pqPower: 'power',
  pqSleep: 'sleep',
  pqDeath: 'death',
  pqClear: 'clear',
  pqRewind: 'rewind',
  kartCountBeep: 'countBeep',
  kartCountGo: 'countGo',
  kartBoost: 'boost',
  kartMiniTurbo: 'miniTurbo',
  kartItemTick: 'itemTick',
  kartItemGet: 'itemGet',
  kartThrow: 'throwItem',
  kartSpinOut: 'spinOut',
  kartBanana: 'bananaDrop',
  kartStar: 'starGet',
  kartBoxBreak: 'boxBreak',
  kartBumpSynth: 'kartBump',
  kartLap: 'lap',
  kartFinalLap: 'finalLap',
  kartFinish: 'finish',
  realmStep: 'realmStep',
  realmBump: 'realmBump',
  realmMiss: 'realmMiss',
  realmSpell: 'realmSpell',
  realmEat: 'realmEat',
  realmFountain: 'realmFountain',
  realmEncounter: 'realmEncounter',
  realmFightWon: 'realmFightWon',
  realmLevelUp: 'realmLevelUp',
  realmDeath: 'realmDeath',
  realmWin: 'realmWin',
  realmBlip: 'realmBlip',
  realmDenied: 'realmDenied',
  lpShot: 'lpShot',
  lpHit: 'lpHit',
  lpSquish: 'lpSquish',
  lpHurt: 'lpHurt',
  lpSpin: 'lpSpin',
  lpSpit: 'lpSpit',
  lpBuddy: 'lpBuddy',
  lpBuddyPop: 'lpBuddyPop',
  lpPickup: 'lpPickup',
  lpWave: 'lpWave',
  lpBoss: 'lpBoss',
  lpWin: 'realmWin',
  lpLose: 'realmDeath',
};

const SYNTH_MUSIC: Partial<Record<MusicKey, SongId>> = {
  menu: 'tower',
  puzzle: 'room',
  puzzleDeep: 'deep',
  kartMenu: 'kartMenu',
  kartMeadow: 'kartMeadow',
  kartCanyon: 'kartCanyon',
  kartFrost: 'kartFrost',
  realmTitle: 'realmTitle',
  realmTown: 'realmTown',
  realmDepths: 'realmDepths',
  realmAbyss: 'realmAbyss',
  realmBattle: 'realmBattle',
  lpMenu: 'lpMenu',
  lpBattle: 'lpBattle',
  // The boss waves borrow The Underrealm's fight theme.
  lpBoss: 'realmBattle',
};

const MUSIC_FILES: Partial<Record<MusicKey, string[]>> = {
  rogueMenu: music('rogue-menu'),
  dungeon: music('dungeon'),
  victory: music('victory'),
  gameover: music('gameover'),
};

export type SfxKey =
  // shared / UI
  | 'uiClick'
  | 'uiHover'
  | 'levelUp'
  // Rogue Dungeon
  | 'playerAttack'
  | 'playerHurt'
  | 'playerDeath'
  | 'enemyHurt'
  | 'enemyDeath'
  | 'pickupGold'
  | 'pickupPotion'
  | 'chestOpen'
  | 'stairsDescend'
  | 'trapHit'
  // Pebble Quest (synthesized)
  | 'pqPebble'
  | 'pqShotsGained'
  | 'pqPush'
  | 'pqShot'
  | 'pqEgg'
  | 'pqEggAway'
  | 'pqAbsorbed'
  | 'pqHatch'
  | 'pqChest'
  | 'pqJewel'
  | 'pqPower'
  | 'pqSleep'
  | 'pqDeath'
  | 'pqClear'
  | 'pqRewind'
  // Turbo Kart
  | 'kartCountBeep'
  | 'kartCountGo'
  | 'kartBoost'
  | 'kartMiniTurbo'
  | 'kartItemTick'
  | 'kartItemGet'
  | 'kartThrow'
  | 'kartSpinOut'
  | 'kartBanana'
  | 'kartStar'
  | 'kartBoxBreak'
  | 'kartBumpSynth'
  | 'kartBump'
  | 'kartCrash'
  | 'kartLap'
  | 'kartFinalLap'
  | 'kartFinish'
  // The Underrealm
  | 'realmStep'
  | 'realmBump'
  | 'realmMiss'
  | 'realmSpell'
  | 'realmEat'
  | 'realmFountain'
  | 'realmEncounter'
  | 'realmFightWon'
  | 'realmLevelUp'
  | 'realmDeath'
  | 'realmWin'
  | 'realmBlip'
  | 'realmDenied'
  // Lollipop Legion
  | 'lpShot'
  | 'lpHit'
  | 'lpSquish'
  | 'lpHurt'
  | 'lpSpin'
  | 'lpSpit'
  | 'lpBuddy'
  | 'lpBuddyPop'
  | 'lpPickup'
  | 'lpWave'
  | 'lpBoss'
  | 'lpWin'
  | 'lpLose';

export type MusicKey =
  | 'menu'
  | 'rogueMenu'
  | 'dungeon'
  | 'victory'
  | 'gameover'
  | 'puzzle'
  | 'puzzleDeep'
  | 'kartMenu'
  | 'kartMeadow'
  | 'kartCanyon'
  | 'kartFrost'
  | 'realmTitle'
  | 'realmTown'
  | 'realmDepths'
  | 'realmAbyss'
  | 'realmBattle'
  | 'lpMenu'
  | 'lpBattle'
  | 'lpBoss';

// Phaser's sound manager is game-wide, so music outlives the scene that started
// it. Track the current track here (not per SoundManager instance) so a new
// scene's playMusic() replaces - or, for the same key, continues - what's playing.
let currentMusicKey: string | null = null;
let currentMusic: Phaser.Sound.BaseSound | null = null;

export class SoundManager {
  private scene: Phaser.Scene;
  private muted = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Queues the registered clips; pass `music: false` to skip the (larger) music files. */
  static preload(scene: Phaser.Scene, { music = true }: { music?: boolean } = {}): void {
    for (const [key, urls] of Object.entries(SFX_FILES)) scene.load.audio(`sfx-${key}`, urls);
    if (!music) return;
    for (const [key, urls] of Object.entries(MUSIC_FILES)) scene.load.audio(`music-${key}`, urls);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.scene.sound.mute = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  play(key: SfxKey): void {
    if (this.muted) return;
    if (SFX_FILES[key] && this.scene.cache.audio.has(`sfx-${key}`)) {
      this.scene.sound.play(`sfx-${key}`, { volume: 0.6 });
      return;
    }
    const synth = SYNTH_SFX[key];
    if (synth) {
      playChipSfx(this.scene.sound, synth);
      return;
    }
    // Stub: no audio asset yet, just trace the cue so gameplay code stays wired up.
    console.debug(`[sfx] ${key}`);
  }

  playMusic(key: MusicKey): void {
    if (currentMusicKey === key) return;
    this.stopMusic();
    currentMusicKey = key;
    if (MUSIC_FILES[key] && this.scene.cache.audio.has(`music-${key}`)) {
      currentMusic = this.scene.sound.add(`music-${key}`, { loop: true, volume: 0.4 });
      if (!this.muted) currentMusic.play();
      return;
    }
    const song = SYNTH_MUSIC[key];
    if (song) {
      playChipSong(this.scene.sound, song);
      return;
    }
    console.debug(`[music] play "${key}" (stub - no audio file registered)`);
  }

  /**
   * Plays a track that isn't one of the fixed cues - e.g. an Underrealm
   * adventure's own music: a (runtime-registered) chiptune song id, or a
   * decoded audio buffer. `key` identifies it so re-requesting the same track
   * keeps it playing instead of restarting it.
   */
  playTrack(key: string, track: { song: SongId } | { buffer: AudioBuffer; volume?: number }): void {
    if (currentMusicKey === key) return;
    this.stopMusic();
    currentMusicKey = key;
    if ('song' in track) playChipSong(this.scene.sound, track.song);
    else playBufferSong(this.scene.sound, track.buffer, track.volume ?? 0.5);
  }

  stopMusic(): void {
    currentMusic?.stop();
    currentMusic?.destroy();
    currentMusic = null;
    currentMusicKey = null;
    stopChipSong();
  }
}

const MUTE_KEY = 'game-arcade.muted';

/** The player's persisted mute preference (toggled with M in Pebble Quest). */
export function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // Storage unavailable - the setting just won't persist.
  }
}
