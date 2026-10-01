import { FRAME } from '../../../config';

export type Dir = 'down' | 'side' | 'up';
export type ActorAnim = 'idle' | 'walk' | 'attack' | 'hurt' | 'death';

const DIR_CODE: Record<Dir, string> = { down: 'D', side: 'S', up: 'U' };
const ANIM_LABEL: Record<ActorAnim, string> = {
  idle: 'Idle',
  walk: 'Walk',
  attack: 'Attack',
  hurt: 'Hurt',
  death: 'Death',
};
const ANIM_FRAMERATE: Record<ActorAnim, number> = { idle: 6, walk: 10, attack: 14, hurt: 10, death: 8 };
const ANIM_LOOP: Record<ActorAnim, boolean> = { idle: true, walk: true, attack: false, hurt: false, death: false };

export function textureKey(actorKey: string, dir: Dir, anim: ActorAnim): string {
  return `${actorKey}_${DIR_CODE[dir]}_${ANIM_LABEL[anim]}`;
}

export function animKey(actorKey: string, anim: ActorAnim, dir: Dir): string {
  return `${actorKey}-${anim}-${dir}`;
}

/** Loads the 15 (3 dir x 5 anim) sheets for one hero/enemy id into the given scene's loader. */
export function preloadActorSheets(scene: Phaser.Scene, actorKey: string, basePath: string): void {
  const dirs: Dir[] = ['down', 'side', 'up'];
  const anims: ActorAnim[] = ['idle', 'walk', 'attack', 'hurt', 'death'];
  for (const dir of dirs) {
    for (const anim of anims) {
      const key = textureKey(actorKey, dir, anim);
      scene.load.spritesheet(key, `${basePath}/${DIR_CODE[dir]}_${ANIM_LABEL[anim]}.png`, {
        frameWidth: FRAME,
        frameHeight: FRAME,
      });
    }
  }
}

/** Registers Phaser animations for one actor id from its already-loaded sheets. */
export function createActorAnimations(scene: Phaser.Scene, actorKey: string): void {
  const dirs: Dir[] = ['down', 'side', 'up'];
  const anims: ActorAnim[] = ['idle', 'walk', 'attack', 'hurt', 'death'];
  for (const dir of dirs) {
    for (const anim of anims) {
      const key = animKey(actorKey, anim, dir);
      if (scene.anims.exists(key)) continue;
      const tex = textureKey(actorKey, dir, anim);
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(tex, {}),
        frameRate: ANIM_FRAMERATE[anim],
        repeat: ANIM_LOOP[anim] ? -1 : 0,
      });
    }
  }
}
