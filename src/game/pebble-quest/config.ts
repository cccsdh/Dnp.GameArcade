import type { SaveData } from '../shared/SaveData';

export const PQ_TILE = 32;
/** 10 floors of 5 rooms, like the NES Adventures of Lolo. */
export const PQ_FLOORS = 10;
export const PQ_ROOMS_PER_FLOOR = 5;
export const PQ_LEVEL_COUNT = PQ_FLOORS * PQ_ROOMS_PER_FLOOR;
/** Clearing this level (the end of floor 8) permanently unlocks super push. */
export const PQ_SUPER_PUSH_UNLOCK_LEVEL = 40;
/** The editor's room size: an 11x11 play area inside a 1-tile wall, as in Lolo. */
export const PQ_ROOM_SIZE = 13;

/** Namespace for the progress save - bumped when the room set was replaced, so old progress doesn't unlock new rooms. */
export const PQ_PROGRESS_KEY = 'pebble-quest.progress.v2';

export interface PebbleProgress {
  /** Highest level id the player is allowed to play (1-based). */
  unlockedUpTo: number;
  completed: boolean[];
  /** Once true, pushes can be held (Shift+direction) to slide a framer until it's stopped. */
  superPushUnlocked: boolean;
}

export const PEBBLE_PROGRESS_DEFAULT: PebbleProgress = {
  unlockedUpTo: 1,
  completed: new Array(PQ_LEVEL_COUNT).fill(false),
  superPushUnlocked: false,
};

/**
 * Loads Pebble Quest progress, padding `completed` up to PQ_LEVEL_COUNT.
 * `SaveData.load()` shallow-merges `{...fallback, ...saved}`, so an existing
 * save from before a PQ_LEVEL_COUNT bump keeps its shorter `completed` array
 * as-is - this repairs that rather than corrupting new levels' index math.
 */
export function loadPebbleProgress(store: SaveData<PebbleProgress>): PebbleProgress {
  const progress = store.load();
  if (progress.completed.length < PQ_LEVEL_COUNT) {
    progress.completed = [...progress.completed, ...new Array(PQ_LEVEL_COUNT - progress.completed.length).fill(false)];
  }
  return progress;
}
