import Phaser from 'phaser';
import { GameSelectScene } from './scenes/GameSelectScene';
import { PreloadScene } from './scenes/rogue-dungeon/PreloadScene';
import { MenuScene } from './scenes/rogue-dungeon/MenuScene';
import { DungeonScene } from './scenes/rogue-dungeon/DungeonScene';
import { HUDScene } from './scenes/rogue-dungeon/HUDScene';
import { GameOverScene } from './scenes/rogue-dungeon/GameOverScene';
import { PebblePreloadScene } from './scenes/pebble-quest/PebblePreloadScene';
import { PebbleMapScene } from './scenes/pebble-quest/PebbleMapScene';
import { PebbleLevelScene } from './scenes/pebble-quest/PebbleLevelScene';
import { PebbleEditorScene } from './scenes/pebble-quest/PebbleEditorScene';
import { KartPreloadScene } from './scenes/kart/KartPreloadScene';
import { KartMenuScene } from './scenes/kart/KartMenuScene';
import { KartRaceScene } from './scenes/kart/KartRaceScene';
import { UnderrealmTitleScene } from './scenes/underrealm/UnderrealmTitleScene';
import { UnderrealmScene } from './scenes/underrealm/UnderrealmScene';
import { UnderrealmHallScene } from './scenes/underrealm/UnderrealmHallScene';
import { LollipopMenuScene } from './scenes/lollipop/LollipopMenuScene';
import { LollipopBattleScene } from './scenes/lollipop/LollipopBattleScene';
import { PadSetupScene } from './scenes/PadSetupScene';
import { installPad } from './game/shared/Pad';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: window.innerWidth,
  height: window.innerHeight,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#0b0b12',
  scale: {
    // RESIZE keeps the canvas at native window resolution (no fractional CSS
    // stretch), so the only pixel-art scaling is the integer camera zoom set
    // per-scene - that's what keeps sprites crisp instead of unevenly blocky.
    mode: Phaser.Scale.RESIZE,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [
    GameSelectScene,
    PreloadScene,
    MenuScene,
    DungeonScene,
    HUDScene,
    GameOverScene,
    PebblePreloadScene,
    PebbleMapScene,
    PebbleLevelScene,
    PebbleEditorScene,
    KartPreloadScene,
    KartMenuScene,
    KartRaceScene,
    UnderrealmTitleScene,
    UnderrealmScene,
    UnderrealmHallScene,
    LollipopMenuScene,
    LollipopBattleScene,
    PadSetupScene,
  ],
};

const game = new Phaser.Game(config);
// A USB NES-style controller works in every game, alongside the keyboard.
installPad(game);
// Handy for poking at scenes from the browser console during development.
if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
