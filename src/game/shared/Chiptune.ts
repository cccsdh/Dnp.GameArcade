/**
 * A tiny NES-style synthesizer: pulse (12.5% / 25% / 50% duty), triangle and
 * noise voices, scheduled with Web Audio. Pebble Quest's and Turbo Kart's
 * music and sound effects are generated here at runtime - original
 * compositions, no audio files - plus Turbo Kart's live engine and tyre voices.
 *
 * It plays through Phaser's Web Audio sound manager (its context and master
 * output), so Phaser's global mute / volume apply. Under the HTML5-audio or
 * no-audio fallbacks it simply stays silent.
 */

type Wave = 'pulse12' | 'pulse25' | 'pulse50' | 'triangle' | 'saw';

const NOTE_INDEX: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

/** "A4" -> 440, "C#5" -> ... */
export function noteFreq(note: string): number {
  const m = /^([A-G]#?)(-?\d)$/.exec(note);
  if (!m) throw new Error(`bad note ${note}`);
  const midi = (Number(m[2]) + 1) * 12 + NOTE_INDEX[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

interface Tone {
  wave: Wave;
  freq: number;
  /** Optional pitch glide target (Hz), reached at the end of the note. */
  slideTo?: number;
  dur: number;
  vol: number;
  /** Seconds after the scheduled time. */
  at?: number;
}

interface Noise {
  dur: number;
  vol: number;
  /** Filter: 'high' for hats/cracks, 'low' for thuds, 'band' for snares. */
  filter: 'high' | 'low' | 'band';
  cutoff: number;
  at?: number;
}

type Voice = { tone: Tone } | { noise: Noise };

// --- Songs --------------------------------------------------------------------
//
// Each channel is a space-separated list of steps: a note ("E5"), "-" to hold
// the previous note, or "." for silence. Drums use k (kick), s (snare), h (hat).

export interface Song {
  bpm: number;
  /** Steps per beat (2 = eighth notes). */
  steps: number;
  lead: string;
  leadWave: Wave;
  harmony?: string;
  bass: string;
  drums?: string;
  volume: number;
}

const SONGS: Record<string, Song> = {
  // The tower map / editor: an easy-going walk.
  tower: {
    bpm: 104,
    steps: 2,
    leadWave: 'pulse25',
    volume: 0.8,
    lead:
      'C5 - - E5 G5 - - . A5 - G5 - E5 - - . F5 - - A5 G5 - E5 - D5 - - - - - . . ' +
      'C5 - - E5 G5 - - . C6 - B5 - A5 - G5 - F5 - E5 - D5 - G4 - C5 - - - - - . .',
    harmony:
      'E4 G4 C5 G4 E4 G4 C5 G4 F4 A4 C5 A4 E4 G4 C5 G4 F4 A4 C5 A4 E4 G4 C5 G4 D4 G4 B4 G4 D4 G4 B4 G4 ' +
      'E4 G4 C5 G4 G4 B4 E5 B4 A4 C5 E5 C5 E4 A4 C5 A4 F4 A4 C5 A4 D4 G4 B4 G4 E4 G4 C5 G4 C5 . . .',
    bass:
      'C3 - - - G2 - - - F2 - - - C3 - - - F2 - - - C3 - - - G2 - - - G2 - - - ' +
      'C3 - - - E3 - - - A2 - - - E3 - - - F2 - - - G2 - - - C3 - - - - - - -',
    drums: 'h . . . h . . . '.repeat(8),
  },
  // Rooms on floors 1-5: bouncy and bright.
  room: {
    bpm: 150,
    steps: 2,
    leadWave: 'pulse25',
    volume: 0.8,
    lead:
      'E5 . G5 . C6 - B5 A5 G5 - E5 - D5 . E5 . F5 . A5 . D6 - C6 B5 A5 - - - G5 . . . ' +
      'E5 . G5 . C6 - D6 E6 D6 - C6 - A5 . G5 . F5 . E5 . D5 . G5 . C5 - - - . . . .',
    harmony:
      '. E4 . E4 . E4 . E4 . E4 . E4 . G4 . G4 . A4 . A4 . A4 . A4 . B4 . B4 . D4 . D4 ' +
      '. C5 . C5 . C5 . C5 . A4 . A4 . A4 . A4 . B4 . B4 . B4 . B4 . E4 . G4 . . . .',
    bass:
      'C3 . G3 . C3 . G3 . C3 . G3 . E3 . G3 . F3 . C4 . F3 . C4 . G3 . D4 . G3 . B3 . ' +
      'A3 . E4 . A3 . E4 . F3 . C4 . F3 . C4 . G3 . D4 . G3 . B3 . C3 . G3 . C3 . . .',
    drums: 'k . h . s . h . '.repeat(7) + 'k . h . s s s s',
  },
  // Rooms on floors 6-10: minor key, a little more urgent.
  deep: {
    bpm: 140,
    steps: 2,
    leadWave: 'pulse50',
    volume: 0.7,
    lead:
      'A4 . C5 . E5 . A5 G5 E5 - D5 - C5 . D5 . F5 . E5 . D5 . C5 D5 E5 - - - . . . . ' +
      'A4 . C5 . E5 . A5 B5 C6 - B5 - A5 . G5 . F5 . D5 . E5 . G#5 . A5 - - - . . . .',
    harmony:
      '. C5 . C5 . C5 . C5 . C5 . C5 . B4 . B4 . A4 . A4 . A4 . A4 . G#4 . G#4 . B4 . B4 ' +
      '. C5 . C5 . E5 . E5 . A4 . A4 . B4 . B4 . A4 . A4 . G#4 . B4 . C5 . E5 . . . .',
    bass:
      'A2 . A3 . A2 . A3 . A2 . A3 . G2 . G3 . F2 . F3 . F2 . F3 . E2 . E3 . E2 . E3 . ' +
      'A2 . A3 . A2 . A3 . F2 . F3 . G2 . G3 . D3 . D3 . E2 . E3 . A2 . E3 . A2 . . .',
    drums: 'k . h k s . h . '.repeat(7) + 'k k s . s s s s',
  },
  // Turbo Kart: the menu, then one theme per track.
  kartMenu: {
    bpm: 128,
    steps: 2,
    leadWave: 'pulse25',
    volume: 0.8,
    lead:
      'F5 . . C5 F5 . A5 . G5 . F5 . D5 . C5 . A#4 . . C5 D5 . F5 . E5 - - - C5 - - - ' +
      'F5 . . C5 F5 . A5 . C6 . A5 . F5 . D5 . A#5 . A5 . G5 . E5 . F5 - - - . . . .',
    harmony:
      '. A4 . A4 . A4 . A4 . F4 . F4 . F4 . F4 . D4 . D4 . D4 . D4 . E4 . E4 . G4 . G4 ' +
      '. A4 . A4 . C5 . C5 . F4 . F4 . A4 . A4 . D4 . D4 . E4 . E4 . A4 . . . . . .',
    bass:
      'F2 . F3 . F2 . F3 . D2 . D3 . D2 . D3 . A#2 . A#3 . A#2 . A#3 . C3 . C4 . C3 . C4 . ' +
      'F2 . F3 . F2 . F3 . D2 . D3 . D2 . D3 . A#2 . A#3 . C3 . C4 . F2 . C3 . F2 . . .',
    drums: 'k . h . s . h . k . h k s . h . '.repeat(4),
  },
  kartMeadow: {
    bpm: 168,
    steps: 2,
    leadWave: 'pulse25',
    volume: 0.85,
    lead:
      'G5 . E5 G5 C6 . G5 . A5 . F5 A5 D6 - C6 . B5 . G5 B5 D6 . B5 . C6 - - - E6 - D6 - ' +
      'G5 . E5 G5 C6 . G5 . A5 . C6 A5 F5 - A5 . G5 . F5 E5 D5 . G5 . C5 - - - . . . .',
    harmony:
      '. E5 . E5 . E5 . E5 . F5 . F5 . A5 . A5 . D5 . D5 . G5 . G5 . E5 . E5 . G5 . G5 ' +
      '. E5 . E5 . C5 . C5 . F5 . F5 . A4 . A4 . D5 . D5 . B4 . B4 . E5 . E5 . . . .',
    bass:
      'C3 C4 C3 C4 C3 C4 C3 C4 F2 F3 F2 F3 F2 F3 F2 F3 G2 G3 G2 G3 G2 G3 G2 G3 C3 C4 C3 C4 C3 C4 C3 C4 ' +
      'C3 C4 C3 C4 A2 A3 A2 A3 F2 F3 F2 F3 F2 F3 F2 F3 G2 G3 G2 G3 G2 G3 B2 B3 C3 C4 C3 C4 C3 . . .',
    drums: 'k . h . s . h k '.repeat(7) + 'k . s . s s s s',
  },
  kartCanyon: {
    bpm: 160,
    steps: 2,
    leadWave: 'pulse50',
    volume: 0.75,
    lead:
      'A4 . A4 C5 D5 . E5 . G5 . E5 . D5 C5 D5 . A4 . A4 C5 D5 . E5 G5 A5 - G5 - E5 - - - ' +
      'A5 . A5 G5 E5 . D5 . C5 . D5 E5 G5 - E5 . D5 . C5 A4 C5 . D5 . A4 - - - . . . .',
    harmony:
      '. E4 . E4 . E4 . E4 . E4 . E4 . G4 . G4 . F4 . F4 . F4 . F4 . E4 . E4 . E4 . E4 ' +
      '. C5 . C5 . B4 . B4 . C5 . C5 . B4 . B4 . A4 . A4 . G#4 . G#4 . C5 . C5 . . . .',
    bass:
      'A2 . A2 A3 A2 . G2 . A2 . A2 A3 A2 . C3 . D3 . D3 D4 D3 . C3 . A2 . A2 A3 G2 . E2 . ' +
      'F2 . F2 F3 F2 . G2 . A2 . A2 A3 A2 . G2 . D3 . D3 D4 E3 . E3 . A2 . A2 A3 A2 . . .',
    drums: 'k . h . s . h . k k h . s . h h '.repeat(3) + 'k . h . s . h . k k s . s s s s',
  },
  kartFrost: {
    bpm: 150,
    steps: 2,
    leadWave: 'pulse25',
    volume: 0.8,
    lead:
      'B4 . E5 . G5 . B5 . A5 . G5 . F#5 . D5 . E5 . G5 . B5 . E6 . D6 - B5 - - - . . ' +
      'C6 . B5 . A5 . G5 . F#5 . G5 . A5 . D5 . G5 . F#5 . E5 . D#5 . E5 - - - . . . .',
    harmony:
      'E4 G4 B4 G4 E4 G4 B4 G4 D4 F#4 A4 F#4 D4 F#4 A4 F#4 C4 E4 G4 E4 C4 E4 G4 E4 B3 D#4 F#4 D#4 B3 D#4 F#4 D#4 ' +
      'A3 C4 E4 C4 A3 C4 E4 C4 D4 F#4 A4 F#4 D4 F#4 A4 F#4 G3 B3 D4 B3 C4 E4 G4 E4 B3 D#4 F#4 D#4 E4 G4 B4 .',
    bass:
      'E2 - - - E2 - E3 - D2 - - - D2 - D3 - C2 - - - C2 - C3 - B1 - - - B1 - B2 - ' +
      'A1 - - - A1 - A2 - D2 - - - D2 - D3 - G2 - - - C2 - C3 - B1 - - - E2 - - -',
    drums: 'k . h . s . h . '.repeat(7) + 'k . s . s . s s',
  },
  // The Underrealm.
  realmTitle: {
    bpm: 80,
    steps: 2,
    leadWave: 'pulse25',
    volume: 0.75,
    lead:
      'D5 - - - F5 - A5 - G5 - F5 - E5 - - - D5 - - - A4 - D5 - F5 - E5 - D5 - - - ' +
      'A#4 - - - D5 - F5 - A5 - G5 - F5 - - - E5 - C#5 - E5 - A5 - D5 - - - - - . .',
    harmony: 'D4 F4 A4 F4 D4 F4 A4 F4 C4 E4 G4 E4 C4 E4 G4 E4 A#3 D4 F4 D4 A#3 D4 F4 D4 A3 C#4 E4 C#4 A3 C#4 E4 C#4 '.repeat(2),
    bass: 'D2 - - - - - - - C2 - - - - - - - A#1 - - - - - - - A1 - - - - - - - '.repeat(2),
  },
  realmTown: {
    bpm: 112,
    steps: 2,
    leadWave: 'pulse12',
    volume: 0.8,
    lead:
      'G5 . B5 . D6 . B5 . C6 . A5 . F#5 . A5 . G5 . E5 . C5 . E5 . D5 - - - . . . . ' +
      'G5 . B5 . D6 . G6 . E6 . C6 . A5 . C6 . B5 . G5 . A5 . F#5 . G5 - - - . . . .',
    harmony:
      '. D5 . D5 . D5 . D5 . C5 . C5 . D5 . D5 . B4 . B4 . C5 . C5 . A4 . A4 . . . . ' +
      '. D5 . D5 . D5 . D5 . G5 . G5 . E5 . E5 . D5 . D5 . C5 . C5 . B4 . B4 . . . .',
    bass:
      'G2 . D3 . G2 . D3 . A2 . E3 . D2 . A2 . E2 . B2 . C3 . G2 . D2 . A2 . D3 . . . ' +
      'G2 . D3 . G2 . D3 . C3 . G3 . A2 . E3 . G2 . D3 . D2 . A2 . G2 . D3 . G2 . . .',
    drums: 'k . . h s . . h '.repeat(8),
  },
  realmDepths: {
    bpm: 92,
    steps: 2,
    leadWave: 'pulse50',
    volume: 0.55,
    lead:
      'A4 - - - . . C5 - B4 - - - . . E4 - A4 - - - . . C5 - D5 - C5 - B4 - - - ' +
      'A4 - - - . . E5 - D5 - - - . . C5 - B4 - - - G#4 - - - A4 - - - - - - -',
    harmony: 'A3 . E4 . A4 . E4 . G3 . D4 . G4 . D4 . F3 . C4 . F4 . C4 . E3 . B3 . E4 . B3 . '.repeat(2),
    bass: 'A1 - - - - - - - G1 - - - - - - - F1 - - - - - - - E1 - - - - - - - '.repeat(2),
    drums: 'k . . . . . . . '.repeat(8),
  },
  realmAbyss: {
    bpm: 76,
    steps: 2,
    leadWave: 'pulse50',
    volume: 0.6,
    lead:
      'E4 - F4 - E4 - - - B3 - C4 - B3 - - - E4 - G4 - F4 - E4 - D4 - - - C4 - - - ' +
      'E4 - F4 - G4 - A4 - B4 - - - A4 - G4 - F4 - E4 - F4 - E4 - D#4 - E4 - - - - -',
    harmony: '. . E3 . . . F3 . . . E3 . . . C3 . '.repeat(4),
    bass: 'E1 - - - - - - - F1 - - - - - - - E1 - - - - - - - C2 - B1 - - - - - '.repeat(2),
    drums: 'k . . . . . k . . . . . s . . . '.repeat(4),
  },
  realmBattle: {
    bpm: 150,
    steps: 2,
    leadWave: 'pulse25',
    volume: 0.8,
    lead:
      'D5 . D5 F5 E5 . D5 . C5 . A4 C5 D5 . . . F5 . F5 A5 G5 . F5 . E5 . C5 E5 D5 - - - ' +
      'A5 . G5 F5 G5 . F5 E5 F5 . E5 D5 E5 . C#5 . D5 . F5 . A5 . G5 . F5 E5 D5 C#5 D5 - - -',
    harmony: '. F4 . F4 . F4 . F4 . E4 . E4 . E4 . E4 . D4 . D4 . D4 . D4 . C#4 . C#4 . E4 . E4 '.repeat(2),
    bass: 'D2 D3 D2 D3 D2 D3 D2 D3 C2 C3 C2 C3 C2 C3 C2 C3 A#1 A#2 A#1 A#2 A#1 A#2 A#1 A#2 A1 A2 A1 A2 A1 A2 C#2 C#3 '.repeat(2),
    drums: 'k . h . s . h k '.repeat(8),
  },
  // Lollipop Legion's title screen: a sugary skip.
  lpMenu: {
    bpm: 116,
    steps: 2,
    leadWave: 'pulse25',
    volume: 0.8,
    lead:
      'E5 - G5 - C6 - B5 A5 G5 - E5 - C5 - - . D5 - F5 - A5 - G5 F5 E5 - D5 - C5 - - . ' +
      'E5 - G5 - C6 - D6 E6 D6 - C6 - A5 - - . F5 - A5 - G5 - E5 C5 D5 - - - C5 - - .',
    bass:
      'C3 . G2 . C3 . G2 . A2 . E3 . A2 . E3 . F2 . C3 . F2 . C3 . G2 . D3 . G2 . B2 . ' +
      'C3 . G2 . C3 . G2 . A2 . E3 . A2 . E3 . F2 . C3 . G2 . D3 . C3 . G2 . C3 . . .',
    drums: 'h . h . s . h . '.repeat(8),
  },
  // Lollipop Legion's waves: fast and punchy.
  lpBattle: {
    bpm: 168,
    steps: 2,
    leadWave: 'pulse25',
    volume: 0.75,
    lead:
      'A4 . C5 . E5 . A5 . G5 . E5 . D5 E5 . . C5 . D5 . E5 . G5 . A5 . G5 E5 D5 C5 D5 . ' +
      'A4 . C5 . E5 . A5 . B5 . C6 . B5 A5 . . G5 . F5 . E5 . D5 . E5 - - - . . . .',
    harmony: '. C5 . C5 . C5 . C5 . A4 . A4 . A4 . A4 . E4 . E4 . E4 . E4 . B4 . B4 . G#4 . G#4 '.repeat(2),
    bass:
      'A2 A3 A2 A3 A2 A3 A2 A3 F2 F3 F2 F3 F2 F3 F2 F3 C3 C4 C3 C4 C3 C4 C3 C4 G2 G3 G2 G3 E2 E3 E2 E3 '.repeat(2),
    drums: 'k . h k s . h . '.repeat(8),
  },
};

/** Built-in song ids, plus any registered at runtime (e.g. by an Underrealm adventure pack). */
export type SongId = string;

// --- Sound effects ------------------------------------------------------------

const n = noteFreq;
const arp = (notes: string[], step: number, dur: number, vol: number, wave: Wave = 'pulse25'): Voice[] =>
  notes.map((note, i) => ({ tone: { wave, freq: n(note), dur, vol, at: i * step } }));

const SFX = {
  /** Picking up a heart pebble. */
  pebble: [...arp(['E6', 'B6'], 0.06, 0.09, 0.28)],
  /** A shot-granting pebble: a longer sparkle. */
  shotsGained: [...arp(['C6', 'E6', 'G6', 'C7'], 0.05, 0.08, 0.24, 'pulse12')],
  /** Pushing a framer or an egg. */
  push: [
    { noise: { dur: 0.07, vol: 0.35, filter: 'low', cutoff: 700 } },
    { tone: { wave: 'triangle', freq: 110, slideTo: 70, dur: 0.08, vol: 0.5 } },
  ],
  /** Magic shot fired. */
  shot: [{ tone: { wave: 'pulse25', freq: 1800, slideTo: 380, dur: 0.16, vol: 0.22 } }],
  /** A shot turns an enemy into an egg. */
  egg: [
    { tone: { wave: 'triangle', freq: 330, slideTo: 880, dur: 0.12, vol: 0.5, at: 0.05 } },
    { noise: { dur: 0.03, vol: 0.2, filter: 'high', cutoff: 5000, at: 0.05 } },
  ],
  /** A shot sends an egg flying away. */
  eggAway: [{ tone: { wave: 'pulse12', freq: 500, slideTo: 2400, dur: 0.22, vol: 0.22, at: 0.05 } }],
  /** A shot bounces off a Medusa. */
  absorbed: [{ tone: { wave: 'pulse50', freq: 98, dur: 0.14, vol: 0.2, at: 0.05 } }],
  /** An egg hatches back into its enemy. */
  hatch: [
    { noise: { dur: 0.05, vol: 0.3, filter: 'high', cutoff: 3000 } },
    { tone: { wave: 'pulse25', freq: 220, slideTo: 330, dur: 0.07, vol: 0.2, at: 0.04 } },
  ],
  /** The last pebble: the chest opens and Gols / Skulls wake. */
  chest: [
    ...arp(['C5', 'E5', 'G5', 'C6', 'E6'], 0.06, 0.12, 0.24),
    { tone: { wave: 'triangle', freq: n('C3'), dur: 0.4, vol: 0.45, at: 0.3 } },
  ],
  /** Taking the jewel. */
  jewel: [...arp(['G6', 'C7', 'E7', 'G7', 'C7', 'E7', 'G7', 'C8'], 0.045, 0.1, 0.18, 'pulse12')],
  /** Using the hammer / bridge / arrow power. */
  power: [
    { noise: { dur: 0.18, vol: 0.45, filter: 'band', cutoff: 900 } },
    { tone: { wave: 'triangle', freq: 150, slideTo: 60, dur: 0.18, vol: 0.5 } },
  ],
  /** A Leeper falls asleep. */
  sleep: [{ tone: { wave: 'triangle', freq: 660, slideTo: 260, dur: 0.35, vol: 0.4 } }],
  /** Caught / gazed / drowned. */
  death: [
    ...arp(['E5', 'C5', 'A4', 'F4'], 0.09, 0.1, 0.25, 'pulse50'),
    { tone: { wave: 'pulse50', freq: n('E4'), slideTo: n('E2'), dur: 0.4, vol: 0.25, at: 0.36 } },
  ],
  /** Room cleared fanfare. */
  clear: [
    ...arp(['C5', 'E5', 'G5', 'C6'], 0.08, 0.1, 0.26),
    { tone: { wave: 'pulse25', freq: n('G5'), dur: 0.16, vol: 0.26, at: 0.36 } },
    { tone: { wave: 'pulse25', freq: n('C6'), dur: 0.6, vol: 0.26, at: 0.52 } },
    { tone: { wave: 'triangle', freq: n('C3'), dur: 0.32, vol: 0.5, at: 0 } },
    { tone: { wave: 'triangle', freq: n('G3'), dur: 0.2, vol: 0.5, at: 0.36 } },
    { tone: { wave: 'triangle', freq: n('C4'), dur: 0.6, vol: 0.5, at: 0.52 } },
  ],
  /** Undo / reset. */
  rewind: [{ tone: { wave: 'pulse12', freq: 900, slideTo: 450, dur: 0.08, vol: 0.14 } }],

  // --- Turbo Kart ---
  countBeep: [{ tone: { wave: 'pulse50', freq: n('A4'), dur: 0.28, vol: 0.28 } }],
  countGo: [
    { tone: { wave: 'pulse50', freq: n('A5'), dur: 0.7, vol: 0.26 } },
    { tone: { wave: 'pulse25', freq: n('E6'), dur: 0.7, vol: 0.14 } },
  ],
  boost: [
    { noise: { dur: 0.45, vol: 0.35, filter: 'band', cutoff: 1400 } },
    { tone: { wave: 'saw', freq: 180, slideTo: 720, dur: 0.4, vol: 0.12 } },
  ],
  miniTurbo: [
    { tone: { wave: 'pulse25', freq: 420, slideTo: 1700, dur: 0.22, vol: 0.18 } },
    { noise: { dur: 0.25, vol: 0.25, filter: 'high', cutoff: 2500 } },
  ],
  itemTick: [{ tone: { wave: 'pulse12', freq: n('C7'), dur: 0.035, vol: 0.12 } }],
  itemGet: [...arp(['C6', 'E6', 'G6', 'C7'], 0.05, 0.1, 0.2)],
  throwItem: [{ tone: { wave: 'pulse25', freq: 900, slideTo: 280, dur: 0.14, vol: 0.2 } }],
  spinOut: [
    { noise: { dur: 0.3, vol: 0.5, filter: 'low', cutoff: 1200 } },
    { tone: { wave: 'pulse50', freq: 900, slideTo: 180, dur: 0.6, vol: 0.2, at: 0.05 } },
    { tone: { wave: 'pulse25', freq: 700, slideTo: 140, dur: 0.6, vol: 0.12, at: 0.12 } },
  ],
  bananaDrop: [{ tone: { wave: 'triangle', freq: 320, slideTo: 140, dur: 0.12, vol: 0.5 } }],
  starGet: [...arp(['C6', 'D6', 'E6', 'G6', 'A6', 'C7', 'D7', 'E7'], 0.04, 0.09, 0.18, 'pulse12')],
  boxBreak: [
    { noise: { dur: 0.08, vol: 0.3, filter: 'high', cutoff: 4000 } },
    { tone: { wave: 'pulse12', freq: n('G6'), dur: 0.08, vol: 0.16, at: 0.02 } },
  ],
  kartBump: [
    { noise: { dur: 0.1, vol: 0.45, filter: 'low', cutoff: 600 } },
    { tone: { wave: 'triangle', freq: 95, slideTo: 55, dur: 0.12, vol: 0.6 } },
  ],
  lap: [...arp(['G5', 'C6', 'E6', 'G6'], 0.07, 0.12, 0.22)],
  finalLap: [...arp(['C5', 'E5', 'G5', 'C6', 'E5', 'G5', 'C6', 'E6', 'G5', 'C6', 'E6', 'G6'], 0.055, 0.1, 0.2)],
  finish: [
    ...arp(['G5', 'G5', 'G5', 'D#6'], 0.14, 0.12, 0.24, 'pulse50'),
    { tone: { wave: 'pulse50', freq: n('F6'), dur: 0.14, vol: 0.24, at: 0.62 } },
    { tone: { wave: 'pulse50', freq: n('G6'), dur: 0.9, vol: 0.24, at: 0.78 } },
    { tone: { wave: 'triangle', freq: n('C4'), dur: 0.5, vol: 0.5 } },
    { tone: { wave: 'triangle', freq: n('G3'), dur: 0.9, vol: 0.5, at: 0.78 } },
  ],

  // --- The Underrealm ---
  realmStep: [{ noise: { dur: 0.06, vol: 0.4, filter: 'low', cutoff: 700 } }],
  realmBump: [{ tone: { wave: 'triangle', freq: 90, slideTo: 50, dur: 0.12, vol: 0.5 } }],
  realmMiss: [{ noise: { dur: 0.16, vol: 0.25, filter: 'band', cutoff: 2600 } }],
  realmSpell: [
    ...arp(['E5', 'G#5', 'B5', 'E6', 'G#6'], 0.04, 0.12, 0.16, 'pulse12'),
    { noise: { dur: 0.3, vol: 0.2, filter: 'high', cutoff: 3000, at: 0.1 } },
  ],
  realmEat: [
    { noise: { dur: 0.06, vol: 0.6, filter: 'low', cutoff: 1200 } },
    { noise: { dur: 0.06, vol: 0.6, filter: 'low', cutoff: 1200, at: 0.12 } },
    { noise: { dur: 0.06, vol: 0.6, filter: 'low', cutoff: 1200, at: 0.24 } },
  ],
  realmFountain: [...arp(['C6', 'G5', 'E6', 'C6', 'G6'], 0.06, 0.08, 0.2, 'triangle')],
  realmEncounter: [
    { tone: { wave: 'pulse50', freq: n('E4'), dur: 0.18, vol: 0.22 } },
    { tone: { wave: 'pulse50', freq: n('A#4'), dur: 0.5, vol: 0.22, at: 0.16 } },
    { tone: { wave: 'triangle', freq: n('E2'), dur: 0.6, vol: 0.5 } },
  ],
  realmFightWon: [...arp(['C5', 'E5', 'G5', 'C6'], 0.08, 0.14, 0.22)],
  realmLevelUp: [...arp(['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'], 0.07, 0.16, 0.2), { tone: { wave: 'triangle', freq: n('C3'), dur: 0.8, vol: 0.5 } }],
  realmDeath: [
    ...arp(['A4', 'G#4', 'G4', 'F#4'], 0.28, 0.3, 0.22, 'pulse50'),
    { tone: { wave: 'triangle', freq: n('D2'), dur: 1.4, vol: 0.5, at: 0.2 } },
  ],
  realmWin: [
    ...arp(['D5', 'F#5', 'A5', 'D6'], 0.12, 0.16, 0.24),
    { tone: { wave: 'pulse25', freq: n('A5'), dur: 0.2, vol: 0.24, at: 0.5 } },
    { tone: { wave: 'pulse25', freq: n('D6'), dur: 1.2, vol: 0.24, at: 0.72 } },
    { tone: { wave: 'triangle', freq: n('D3'), dur: 1.9, vol: 0.5 } },
  ],
  realmBlip: [{ tone: { wave: 'pulse12', freq: n('A5'), dur: 0.05, vol: 0.14 } }],
  realmDenied: [
    { tone: { wave: 'pulse50', freq: n('C3'), dur: 0.12, vol: 0.2 } },
    { tone: { wave: 'pulse50', freq: n('C3'), dur: 0.2, vol: 0.2, at: 0.16 } },
  ],

  // --- Lollipop Legion ---
  lpShot: [{ tone: { wave: 'pulse25', freq: 1100, slideTo: 1700, dur: 0.05, vol: 0.08 } }],
  lpHit: [
    { noise: { dur: 0.05, vol: 0.22, filter: 'band', cutoff: 2200 } },
    { tone: { wave: 'pulse12', freq: 520, slideTo: 300, dur: 0.05, vol: 0.1 } },
  ],
  lpSquish: [
    { tone: { wave: 'triangle', freq: 420, slideTo: 80, dur: 0.2, vol: 0.55 } },
    { noise: { dur: 0.16, vol: 0.3, filter: 'low', cutoff: 900 } },
  ],
  lpHurt: [
    { tone: { wave: 'pulse50', freq: 330, slideTo: 110, dur: 0.28, vol: 0.22 } },
    { noise: { dur: 0.12, vol: 0.35, filter: 'low', cutoff: 1400 } },
  ],
  lpSpin: [
    { tone: { wave: 'pulse25', freq: 300, slideTo: 1500, dur: 0.32, vol: 0.18 } },
    { noise: { dur: 0.35, vol: 0.2, filter: 'band', cutoff: 3000 } },
  ],
  lpSpit: [{ tone: { wave: 'triangle', freq: 240, slideTo: 110, dur: 0.1, vol: 0.4 } }],
  lpBuddy: [...arp(['G5', 'C6', 'E6', 'G6', 'C7'], 0.06, 0.1, 0.2)],
  lpBuddyPop: [...arp(['E5', 'C5', 'A4'], 0.08, 0.1, 0.2, 'pulse50')],
  lpPickup: [...arp(['E6', 'G6', 'C7'], 0.05, 0.08, 0.2, 'pulse12')],
  lpWave: [
    ...arp(['C5', 'E5', 'G5', 'C6', 'G5', 'C6'], 0.08, 0.1, 0.22),
    { tone: { wave: 'triangle', freq: n('C3'), dur: 0.5, vol: 0.5 } },
  ],
  lpBoss: [
    { tone: { wave: 'pulse50', freq: n('C4'), dur: 0.25, vol: 0.22 } },
    { tone: { wave: 'pulse50', freq: n('F#3'), dur: 0.7, vol: 0.22, at: 0.24 } },
    { tone: { wave: 'triangle', freq: n('C2'), dur: 1, vol: 0.6 } },
    { noise: { dur: 0.8, vol: 0.2, filter: 'low', cutoff: 500 } },
  ],
} satisfies Record<string, Voice[]>;

export type ChipSfxId = keyof typeof SFX;

// --- Engine -------------------------------------------------------------------

interface PhaserWebAudio {
  context: AudioContext;
  destination?: AudioNode;
}

class ChipEngine {
  readonly ctx: AudioContext;
  private out: AudioNode;
  private waves = new Map<Wave, PeriodicWave | OscillatorType>();
  private noiseBuf: AudioBuffer;

  constructor(ctx: AudioContext, out: AudioNode) {
    this.ctx = ctx;
    this.out = out;
    for (const [id, duty] of [['pulse12', 0.125], ['pulse25', 0.25]] as const) this.waves.set(id, this.pulseWave(duty));
    this.waves.set('pulse50', 'square');
    this.waves.set('triangle', 'triangle');
    this.waves.set('saw', 'sawtooth');
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  /** Fourier series of a pulse wave with the given duty cycle. */
  private pulseWave(duty: number): PeriodicWave {
    const size = 64;
    const real = new Float32Array(size);
    const imag = new Float32Array(size);
    for (let k = 1; k < size; k++) {
      real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty) * Math.cos(k * Math.PI * duty);
      imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty) * Math.sin(k * Math.PI * duty);
    }
    return this.ctx.createPeriodicWave(real, imag);
  }

  tone(t: Tone, time: number, dest: AudioNode = this.out): void {
    const osc = this.ctx.createOscillator();
    const w = this.waves.get(t.wave)!;
    if (typeof w === 'string') osc.type = w as OscillatorType;
    else osc.setPeriodicWave(w);
    const start = time + (t.at ?? 0);
    osc.frequency.setValueAtTime(t.freq, start);
    if (t.slideTo) osc.frequency.exponentialRampToValueAtTime(t.slideTo, start + t.dur);
    const g = this.ctx.createGain();
    // Quick attack, short hold, then a decay - an NES-ish volume envelope.
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(t.vol, start + 0.005);
    g.gain.setValueAtTime(t.vol, start + t.dur * 0.6);
    g.gain.linearRampToValueAtTime(0, start + t.dur);
    osc.connect(g).connect(dest);
    osc.start(start);
    osc.stop(start + t.dur + 0.02);
  }

  noise(nz: Noise, time: number, dest: AudioNode = this.out): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = nz.filter === 'high' ? 'highpass' : nz.filter === 'low' ? 'lowpass' : 'bandpass';
    f.frequency.value = nz.cutoff;
    const g = this.ctx.createGain();
    const start = time + (nz.at ?? 0);
    g.gain.setValueAtTime(nz.vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + nz.dur);
    src.connect(f).connect(g).connect(dest);
    src.start(start, Math.random() * 0.5);
    src.stop(start + nz.dur + 0.02);
  }

  sfx(id: ChipSfxId): void {
    const now = this.ctx.currentTime + 0.01;
    for (const v of SFX[id] as Voice[]) {
      if ('tone' in v) this.tone(v.tone, now);
      else this.noise(v.noise, now);
    }
  }

  /** The shared output node (Phaser's master output). */
  bus(): AudioNode {
    return this.out;
  }

  noiseBuffer(): AudioBuffer {
    return this.noiseBuf;
  }

  createBus(volume: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = volume;
    g.connect(this.out);
    return g;
  }
}

/** A looping song, scheduled a little ahead of the audio clock. */
class SongPlayer {
  private engine: ChipEngine;
  private song: Song;
  private bus: GainNode;
  private timer: number;
  private step = 0;
  private nextTime: number;
  private channels: { steps: string[]; wave: Wave; vol: number; bass?: boolean }[];
  private drums: string[];
  private length: number;

  constructor(engine: ChipEngine, song: Song) {
    this.engine = engine;
    this.song = song;
    this.bus = engine.createBus(0.32 * song.volume);
    const split = (s?: string) => (s ? s.trim().split(/\s+/) : []);
    this.channels = [
      { steps: split(song.lead), wave: song.leadWave, vol: 0.32 },
      { steps: split(song.harmony), wave: 'pulse12', vol: 0.14 },
      { steps: split(song.bass), wave: 'triangle', vol: 0.55, bass: true },
    ];
    this.drums = split(song.drums);
    this.length = Math.max(...this.channels.map((c) => c.steps.length), this.drums.length);
    this.nextTime = engine.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  /** Playback speed multiplier (the final lap speeds the music up). */
  rate = 1;

  private stepDur(): number {
    return 60 / (this.song.bpm * this.rate) / this.song.steps;
  }

  /** How many steps a note at `i` lasts (itself plus any "-" holds after it). */
  private noteLength(steps: string[], i: number): number {
    let len = 1;
    while (steps[(i + len) % steps.length] === '-' && len < steps.length) len++;
    return len;
  }

  private schedule(): void {
    const ctx = this.engine.ctx;
    // After the tab was throttled/suspended, skip ahead instead of bursting notes.
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05;
    const d = this.stepDur();
    while (this.nextTime < ctx.currentTime + 0.15) {
      const i = this.step % this.length;
      for (const ch of this.channels) {
        const tok = ch.steps[i % ch.steps.length];
        if (!tok || tok === '-' || tok === '.') continue;
        const len = this.noteLength(ch.steps, i % ch.steps.length);
        const dur = len * d * (ch.bass ? 0.95 : 0.85);
        this.engine.tone({ wave: ch.wave, freq: noteFreq(tok), dur, vol: ch.vol }, this.nextTime, this.bus);
      }
      const dr = this.drums[i % (this.drums.length || 1)];
      if (dr === 'k') {
        this.engine.tone({ wave: 'triangle', freq: 150, slideTo: 45, dur: 0.12, vol: 0.9 }, this.nextTime, this.bus);
      } else if (dr === 's') {
        this.engine.noise({ dur: 0.12, vol: 0.35, filter: 'band', cutoff: 1800 }, this.nextTime, this.bus);
      } else if (dr === 'h') {
        this.engine.noise({ dur: 0.04, vol: 0.18, filter: 'high', cutoff: 7000 }, this.nextTime, this.bus);
      }
      this.nextTime += d;
      this.step++;
    }
  }

  stop(): void {
    window.clearInterval(this.timer);
    const t = this.engine.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setValueAtTime(this.bus.gain.value, t);
    this.bus.gain.linearRampToValueAtTime(0, t + 0.15);
    const bus = this.bus;
    window.setTimeout(() => bus.disconnect(), 400);
  }
}

let engine: ChipEngine | null = null;
let engineCtx: AudioContext | null = null;
let current: SongPlayer | null = null;

function getEngine(sound: unknown): ChipEngine | null {
  const wa = sound as PhaserWebAudio;
  if (!wa || !wa.context || typeof wa.context.createOscillator !== 'function') return null;
  if (!engine || engineCtx !== wa.context) {
    engine = new ChipEngine(wa.context, wa.destination ?? wa.context.destination);
    engineCtx = wa.context;
  }
  return engine;
}

export function hasChipSong(id: string): id is SongId {
  return id in SONGS;
}

export function hasChipSfx(id: string): id is ChipSfxId {
  return id in SFX;
}

/** Plays a synthesized sound effect through `sound` (a Phaser sound manager). */
export function playChipSfx(sound: unknown, id: ChipSfxId): void {
  getEngine(sound)?.sfx(id);
}

/** Starts a synthesized song (replacing any other one). */
export function playChipSong(sound: unknown, id: SongId): void {
  stopChipSong();
  const e = getEngine(sound);
  if (e) current = new SongPlayer(e, SONGS[id]);
}

export function stopChipSong(): void {
  current?.stop();
  current = null;
  if (currentBuffer) {
    const { src, gain, ctx } = currentBuffer;
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.2);
    try {
      src.stop(t + 0.25);
    } catch {
      // already stopped
    }
    currentBuffer = null;
  }
}

/** Adds (or replaces) a song at runtime - an adventure's own chiptune. */
export function registerChipSong(id: string, song: Partial<Song> & { bpm: number; lead: string; bass: string }): void {
  SONGS[id] = { steps: 2, leadWave: 'pulse25', volume: 0.8, ...song } as Song;
}

let currentBuffer: { src: AudioBufferSourceNode; gain: GainNode; ctx: AudioContext } | null = null;

/** Decodes an audio file (MP3 / OGG / WAV bytes) with the game's audio context. */
export async function decodeChipAudio(sound: unknown, bytes: ArrayBuffer): Promise<AudioBuffer | null> {
  const e = getEngine(sound);
  if (!e) return null;
  return e.ctx.decodeAudioData(bytes);
}

/** Loops a decoded audio file as the music (replacing whatever was playing). */
export function playBufferSong(sound: unknown, buffer: AudioBuffer, volume = 0.5): void {
  stopChipSong();
  const e = getEngine(sound);
  if (!e) return;
  const src = e.ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const gain = e.createBus(0);
  gain.gain.setValueAtTime(0, e.ctx.currentTime);
  gain.gain.linearRampToValueAtTime(volume, e.ctx.currentTime + 0.4);
  src.connect(gain);
  src.start();
  currentBuffer = { src, gain, ctx: e.ctx };
}

/** Speeds the current song up or down (1 = normal). */
export function setChipSongRate(rate: number): void {
  if (current) current.rate = rate;
}

/**
 * A continuous engine voice: a buzzy sawtooth plus a sub-octave square
 * through a low-pass filter. `set()` it every frame from the kart's speed.
 */
export class EngineVoice {
  private oscA: OscillatorNode;
  private oscB: OscillatorNode;
  private filter: BiquadFilterNode;
  private gain: GainNode;
  private ctx: AudioContext;

  constructor(e: ChipEngine) {
    const ctx = e.ctx;
    this.ctx = ctx;
    this.oscA = ctx.createOscillator();
    this.oscA.type = 'sawtooth';
    this.oscB = ctx.createOscillator();
    this.oscB.type = 'square';
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 4;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    const mixB = ctx.createGain();
    mixB.gain.value = 0.5;
    this.oscA.connect(this.filter);
    this.oscB.connect(mixB).connect(this.filter);
    this.filter.connect(this.gain).connect(e.bus());
    this.oscA.start();
    this.oscB.start();
  }

  /** speed01: fraction of top speed; throttle: 0..1; volume: 0..1. */
  set(speed01: number, throttle: number, volume = 1): void {
    const t = this.ctx.currentTime;
    const f = 55 + speed01 * 150 + throttle * 12;
    this.oscA.frequency.setTargetAtTime(f, t, 0.05);
    this.oscB.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.filter.frequency.setTargetAtTime(350 + speed01 * 1400 + throttle * 300, t, 0.05);
    this.gain.gain.setTargetAtTime((0.05 + throttle * 0.035 + speed01 * 0.03) * volume, t, 0.05);
  }

  stop(): void {
    const t = this.ctx.currentTime;
    this.gain.gain.setTargetAtTime(0, t, 0.05);
    this.oscA.stop(t + 0.3);
    this.oscB.stop(t + 0.3);
  }
}

/** A looping filtered-noise voice (tyre screech while drifting, wind while boosting). */
export class NoiseVoice {
  private src: AudioBufferSourceNode;
  private filter: BiquadFilterNode;
  private gain: GainNode;
  private ctx: AudioContext;

  constructor(e: ChipEngine, type: BiquadFilterType, freq: number, q: number) {
    const ctx = e.ctx;
    this.ctx = ctx;
    this.src = ctx.createBufferSource();
    this.src.buffer = e.noiseBuffer();
    this.src.loop = true;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = type;
    this.filter.frequency.value = freq;
    this.filter.Q.value = q;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.src.connect(this.filter).connect(this.gain).connect(e.bus());
    this.src.start();
  }

  set(volume: number, freq?: number): void {
    const t = this.ctx.currentTime;
    this.gain.gain.setTargetAtTime(volume, t, 0.04);
    if (freq) this.filter.frequency.setTargetAtTime(freq, t, 0.05);
  }

  stop(): void {
    const t = this.ctx.currentTime;
    this.gain.gain.setTargetAtTime(0, t, 0.04);
    this.src.stop(t + 0.3);
  }
}

export function createEngineVoice(sound: unknown): EngineVoice | null {
  const e = getEngine(sound);
  return e ? new EngineVoice(e) : null;
}

export function createNoiseVoice(sound: unknown, type: BiquadFilterType, freq: number, q = 1): NoiseVoice | null {
  const e = getEngine(sound);
  return e ? new NoiseVoice(e, type, freq, q) : null;
}
