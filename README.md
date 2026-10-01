# Game Arcade

A browser-based mini arcade built with [Phaser 3](https://phaser.io/) + TypeScript + Vite. The title screen is a game-select page; each game lives in its own subfolder and doesn't depend on the others.

- **Rogue Dungeon** - a top-down action roguelike, using the pixel art in `Rogue_Art/`.
- **Pebble Quest** - an Adventures of Lolo-style puzzle tower: collect every pebble, open the chest, take the jewel and leave by the door, past Snakeys, Medusas, Almas and Skulls, with magic shots, eggs and power-ups. 50 solver-verified rooms across 10 floors, modelled on the NES original's rooms, plus a built-in level editor.
- **Turbo Kart** - a Mode-7 kart racer: 4 animal drivers in 4 vehicles, 3 tracks, two AI rivals (one sharp, one clumsy), drifting, boosts and items.
- **The Underrealm** - a first-person dungeon adventure after *Alternate Reality: The Dungeon*: roll your stats, haggle in the market, then descend ten raycast 3D levels to take the Crystal of Echoes from the Lich King, and find the hidden way out of the labyrinth below. Heroes pick their adventure in the **Hall of Adventurers**, which also takes uploaded **dungeon packs** (JSON), each with its own soundtrack if it wants one.
- **Lollipop Legion** - a candy arena shooter: pick a lollipop flavour and pop 10 waves of germs, recruiting lollipop buddies along the way, then squish the germ king Duke Grime.

## Why this stack

Phaser is the standard, best-supported engine for 2D tile-based browser games (tilemaps, arcade physics, sprite animation, camera, all built in). Vite gives instant reload during development and compiles the whole thing down to plain static HTML/JS/CSS - so it can be hosted anywhere that serves static files: itch.io, GitHub Pages, Netlify, Vercel, a plain S3 bucket, etc. No server/backend required.

## Getting started

```
npm install
npm run dev       # local dev server with hot reload, opens automatically
npm run build     # production build -> dist/
npm run preview   # serve the production build locally
```

To deploy: run `npm run build` and upload the contents of `dist/` to any static host.

### Playing locally without Visual Studio

All you need is [Node.js](https://nodejs.org/) (the LTS version). Then either double-click **`scripts\start-local.cmd`**, or run it from PowerShell in the repo root:

```
.\scripts\start-local.ps1            # dev server with hot reload -> http://localhost:5173
.\scripts\start-local.ps1 -Preview   # build for production and serve that -> http://localhost:4173
.\scripts\start-local.ps1 -Port 8080 # use another port
.\scripts\start-local.ps1 -NoOpen    # don't open a browser tab
```

The script checks that Node is installed and runs `npm install` on the first run, and again whenever `package-lock.json` changes. It then starts the server and opens the arcade in your default browser. Press **Ctrl+C** in the window to stop it. The `.cmd` wrapper runs the PowerShell script with the execution policy bypassed, so it works on machines that block unsigned scripts, and it keeps the window open if something fails so you can read the error.

### Deploying to the Hyper-V VM

`scripts\deploy-hyperv.ps1` (run from an elevated PowerShell) builds the game and publishes `dist/` to an Ubuntu VM named `game-arcade`, where nginx serves it on port 5180 (`http://game-arcade.mshome.net:5180/`). The first run creates the VM from the cached Ubuntu cloud image; later runs just push the new build. Use `-SkipBuild` to deploy the current `dist/` as-is.

### Installing on a Raspberry Pi

The `raspberry-pi/` folder turns a Pi into a game server for your home network: `install.sh` installs nginx, serves the arcade on port 5180, opens that port in the firewall, and can optionally open the arcade full-screen on the Pi's own screen. From the PC, `.\raspberry-pi\make-bundle.ps1 -PiHost pi@raspberrypi.local -Install` builds the game, copies it over and installs it in one go. The full step-by-step guide, from flashing the SD card to troubleshooting, is [`raspberry-pi/INSTALL.md`](raspberry-pi/INSTALL.md).

## Controllers

Every game can be played with the keyboard or a **USB NES-style controller** (any gamepad the browser's Gamepad API sees). Plug it in and press a button: a notice at the bottom of the screen confirms it was found. The keyboard keeps working alongside it.

| | D-pad | A | B | Select | Start |
| --- | --- | --- | --- | --- | --- |
| **Menus** (everywhere) | move the highlight | choose | back | | choose |
| **Rogue Dungeon** | move | attack | drink a potion | | |
| **Pebble Quest** | move | magic shot | tap: power, hold + move: super push | undo | leave the room (Select+Start: restart it) |
| **Turbo Kart** | steer, Down brakes/reverses, Up uses your item | accelerate | drift | use item | quit the race |
| **The Underrealm** | walk / turn | search | tap: inventory, hold + Left/Right: sidestep | full map | menu |
| **Lollipop Legion** | move | fire (aims itself) | sugar spin | mute | pause |

Menus that used to need the mouse now have a highlight cursor, for both the arrow keys and the D-pad:

- the arcade's game cards;
- Pebble Quest's tower map and room-cleared panel;
- Rogue Dungeon's hero picker;
- The Underrealm's title screen and every in-game menu (fights, shops, the pause menu).

Pebble Quest's level editor still needs a mouse. So does uploading an adventure in the Hall of Adventurers, which opens a file picker.

**Setting up a controller.** Cheap USB NES pads report their buttons in different orders. The default layout suits standard-mapped pads (8BitDo, Xbox-style) and the common generic ones (A = button 1, B = button 2, D-pad on the stick axes or a POV hat). If a button does the wrong thing, open **Controller setup**: press **C** on the arcade screen, pick it at the bottom of the screen, or press **Select** on the pad. There, buttons light up on a drawn NES controller as you press them. Press **Select** (or **R**) to map the controller by pressing each button when asked. The mapping is saved in the browser for that controller model, and **D** returns to the default layout. The screen also lists what the buttons do in each game.

**How it works.** `src/game/shared/Pad.ts` reads the controller every frame and turns its eight inputs into ordinary keyboard events. Each scene says what the buttons mean there with `setPadProfile(scene, profile)`, and the profiles are in `PadProfiles.ts`. A button can send a key, several keys, or a tap/hold pair, so B can be "inventory" when tapped and "sidestep" when held. A new screen ignores buttons that are still held from the last one. `MenuNav.ts` is the highlight cursor for mouse-built screens: it moves to the nearest item in the pressed direction, so it works for lists, rows and grids.

## Rogue Dungeon

- Pick one of 3 heroes on the title screen (Ranger, Knight or Mage; all heroes currently share the same stats), then descend through procedurally generated dungeon floors.
- **WASD / Arrow keys** move, **Space** attacks, **Q** drinks a potion (heals, consumes one).
- Fight 4 enemy types (introduced gradually as you go deeper), collect gold and potions, open chests, avoid spike traps, and find the trapdoor to descend.
- Reach floor 5's trapdoor to win. Dying shows how far you got and how much gold you collected.
- Difficulty (enemy HP/damage/count) scales up with floor number.

## Pebble Quest

Modelled on the NES *Adventures of Lolo*  It's turn-based: each move, shot or power use is one turn, and then the enemies react.

- 50 single-screen rooms (10 floors x 5), chosen from a tower map. Each unlocks when the one before it is cleared; progress is saved to `localStorage`.
- **Goal:** collect every **pebble** (the heart-shaped stones). That opens the **chest**. Step onto it to take the jewel, which makes every enemy vanish and opens the **door** in the wall.
- **Controls:** **WASD / arrows** move (pressing toward something you can't enter just turns you, for free). **Space** fires a magic shot. **E** uses the room's power. **Z** undoes, **R** resets, **M** toggles sound, **Esc** returns to the map. After you clear room 8-5, **Shift+move** does a *super push*: the framer slides until something stops it.
- **Terrain:** boulders block movement, gazes and shots. Trees block movement only; gazes and shots pass over them. Water is impassable until bridged. Grass is walkable by you but not by enemies. One-way arrows can't be crossed against the arrow. Sand is ordinary floor.
- **Emerald framers:** green blocks you push, one tile at a time. They block enemies, gazes and shots, and can't go into water.
- **Magic shots:** some pebbles (marked with a sparkle) give you 2 shots each. A shot turns an enemy into an **egg** for 12 turns. You can push an egg, and pushed into water it floats as a **raft** you can stand on until it sinks. Shoot an egg to send it away; the enemy reappears where it started 16 turns later. Medusa and Don Medusa can't be egged.
- **Powers** (Lolo's PW box): some rooms have a **Hammer** (smash a boulder), **Bridge** (span a water tile) or **Arrow** (flip a one-way arrow). Each unlocks after a set number of pebbles, is used once, and targets the tile you face.
- **Enemies:**
  - **Snakey**: harmless, never moves. A handy gaze shield.
  - **Rocky**: harmless, but charges at you while you share a row or column, to box you in.
  - **Leeper**: harmless. It chases you and falls asleep for good the moment it touches you, becoming a permanent obstacle.
  - **Gol**: stationary. Once the last pebble is taken it wakes and fires along its facing (a small arrow shows which way).
  - **Medusa**: stationary, with a deadly gaze in all four directions.
  - **Don Medusa**: paces back and forth, with a deadly gaze in the direction it's heading.
  - **Alma**: charges at you when lined up. Kills on contact.
  - **Skull**: dormant until the last pebble, then charges at you when lined up. Kills on contact.
- Live gazes are shaded on the board, and eggs show their remaining turns. Dying steps you back one move rather than restarting the room.

### Level generation

The 50 campaign rooms come from `scripts/generate-pebble-levels.mjs` and are checked in as `src/game/pebble-quest/levels.generated.ts`:

1. **Templates.** `scripts/pebble-templates.json` holds all 50 NES rooms, transcribed tile by tile from the map image: boulders, trees, water, bridges, grass, arrows, framers, enemy line-up, heart (pebble) positions, chest, door and start. The transcription is exact because the map image lines up with the 16px NES tile grid; it has 61 distinct tiles.
2. **Variation.** Each room is a variant of its template, not a copy. It's randomly mirrored, some pebbles are nudged a tile, Gol facings and Don Medusa axes are chosen from the open lines, and shot-granting pebbles are assigned. If a pebble, the chest or the door is sealed off (behind boulders, water or a one-way arrow, as some Lolo rooms are), the room gets the matching Hammer, Bridge or Arrow power.
3. **Verification.** Every variant is checked by the solver in `src/game/pebble-quest/solver.ts`, a best-first search over whole-room states (moves, shots, eggs, powers, enemy positions and timers). The solver calls the same `rules.ts` the game runs, bundled with esbuild, so a verified room plays out exactly as the solver saw it. If a variant can't be solved within the search budget, it's re-rolled and then relaxed one step at a time: an extra shot pebble first, then the most dangerous enemies are swapped for tamer ones, then enemies are thinned out, then framers are dropped. From the 10th step on, one-way arrows become plain floor. A heavily relaxed room is a good candidate for touching up in the editor.

```
npm run pebble:levels                       # regenerate all 50 rooms (several minutes)
PQ_START=11 PQ_END=15 npm run pebble:levels # regenerate just rooms 11-15, merged into the file
```

To ship hand-made rooms in the campaign, put LevelDefs exported from the editor into `scripts/pebble-overrides.json`, as `{ "<level id>": { ...room } }`. The generator uses them as-is, after verifying them.

### Level editor

Open it from the tower map (**Level editor >**). In the editor you can:

- Paint terrain (floor, boulder, tree, water, bridge, grass, sand, wall, one-way arrows) and place pebbles, shot pebbles, the chest, the door (in the border wall), emerald framers, the player start and any of the 8 enemies. Left-click or drag to paint, right-click to erase. Click a Gol or Don Medusa again, or use **Rotate**, to change where it looks.
- Give the room a power (Hammer / Bridge / Arrow) and set how many pebbles unlock it.
- **Verify** runs the same solver the generator uses. It reports whether the room is solvable, and **Watch** replays the solution it found. **Play-test** plays the room and brings you back to the editor.
- **Save** a new room to *My rooms*. Loading a campaign room with **< Load / Load >**, editing it and saving makes the campaign play your version; it shows as *edited* on the map, and **Revert** restores the original. **Save copy** always saves to *My rooms*. **Z** undoes edits.
- **Export** downloads the room as JSON and copies it to the clipboard. **Import** loads a JSON file.

Saved rooms and campaign edits live in `localStorage` under `game-arcade.pebble-quest.levels`.

## Turbo Kart

A Super-Mario-Kart-style racer with a behind-the-kart, Mode-7 view.

- **Racers:** pick one of 4, each an animal driver in a different vehicle with its own stats. All four drivers ride open vehicles, so you can see them from every angle.
  - Zippy the Fox in the **Classic Kart**: an all-rounder.
  - Hopper the Frog in the **Dune Buggy**: best acceleration, and loses the least speed off-road.
  - Dash the Bunny in the **Rocket Racer**: highest top speed, slowest acceleration.
  - Bruno the Bear in the **Mini Monster**: heavy, and shoves the others around.
- **Tracks:** 3 tracks of 3 laps each.
  - **Meadow Circuit**: sweeping bends between lakes.
  - **Canyon Run**: tight hairpins between desert mesas.
  - **Frost Pass**: a winding snowy road with slippery ice patches.
- **Rivals:** you race two AI drivers who take the other vehicles.
  - A **smart** one follows a racing line, lifts off for hairpins, drifts through long bends for mini-turbos, steers around bananas and uses items tactically.
  - A **clumsy** one weaves about, reacts slowly, brakes late, never drifts, gets distracted and fires items at random.
  - Both get a little rubber-banding so races stay close.
- **Controls:** **Arrows/WASD** drive. **Space** (or Shift) hops, and holding it while steering drifts. **X** (or E/Ctrl) uses your item. **M** toggles sound, **Esc** quits to the menu. On the results screen, **R** or **Enter** races again.
- **Racing:**
  - **Drift boosts:** hold a drift to charge a mini-turbo; the sparks go blue, then orange, then pink.
  - **Boost pads** are the yellow chevrons.
  - **Rocket start:** press the gas just before GO.
  - **Surfaces:** grass, sand and snow slow you down, ice patches cut your grip, and barriers bounce you back.
- **Items**, from the rainbow item boxes: **Turbo**, **Banana** (dropped behind you), **Bouncing Orb** (fires straight ahead and bounces off walls), **Homing Orb** (chases the racer ahead of you) and **Super Star** (invincible and faster; hits spin others out). Which item you get depends on your position: leaders get defensive ones, stragglers get the strong ones.
- **Effects:** drift sparks, boost flames, speed lines and a camera pull-back while boosting, dust off-road, hit stars and a spin-out, screen shake, item-box shards, rainbow star trails, countdown lights, lap and final-lap banners, a wrong-way warning, finish confetti, and a results table.

**How it's drawn.** The track floor is a WebGL fragment shader (`src/game/kart/mode7.ts`). For every pixel below the horizon it projects back onto the flat track and samples a 2048x2048 track texture, snapped to chunky pixels and fogged into the distance. The texture is painted procedurally from each track's control points (`src/game/kart/tracks.ts`), which also produces the surface map used by the physics, the AI's centreline and racing line, the scenery and a 360° sky panorama. Karts, items and props are placed as sprites with the same projection.

**Sprites.** I searched for freely licensed kart sprites with drivers, drawn from the many angles a behind-the-kart view needs, and found none. [Kenney's Racing Pack](https://kenney.nl/assets/racing-pack) (CC0) is top-down only, and [OpenGameArt's racing kart](https://opengameart.org/content/racing-kart) (CC0) is a single 3D model with no driver. Instead, every kart, driver, item and prop is a small original voxel model (`src/game/kart/models.ts`). At load time a tiny software renderer (`src/game/shared/voxel.ts`) draws it into pixel-art sprites, 16 viewing angles per kart, so each kart shows the right side as it turns.

**Audio.** The four songs are original chiptunes played by `src/game/shared/Chiptune.ts`: a menu theme and one per track, with the final lap playing faster. The engine is a live synth voice whose pitch follows your speed, and tyre screech and off-road rumble are filtered-noise voices. The effects (countdown, boosts, mini-turbos, item roulette, throws, spin-outs, lap and finish jingles) are synthesized too. Kart bumps and barrier hits reuse two of the CC0 Kenney impact clips.

## The Underrealm

A first-person dungeon adventure in the style of *Alternate Reality: The Dungeon* (Datasoft, 1987). The stair behind you collapses, so the only way out is down. Fight through ten levels to the Lich King, take the Crystal of Echoes from his throne, then find the hidden gate in the eleventh level, the Labyrinth of Echoes, which only the crystal can open.

- **Character:** roll six stats, re-rolling as often as you like. A new hero then enters the **Hall of Adventurers** to choose an adventure (below).
  - **STA** (stamina) sets your hit points.
  - **CHR** (charisma) sets prices and bribes.
  - **STR** (strength) adds damage.
  - **INT** (intelligence) powers tricks and firebolts.
  - **WIS** (wisdom) sets mana and healing.
  - **SKL** (skill) sets how often you hit and dodge.
- **The Undercroft market** (level 1) is lit and monster-free. It has five establishments:
  - **The Sleeping Wyrm Tavern:** food, water, ale, rumours, and a room for the night, which heals you and saves the game.
  - **Moldo's Provisions:** torches, rations and healing potions.
  - **The Iron Brand Smithy:** weapons and armour, with Alternate Reality-style haggling. Offer 90%, 75% or 60% of the asking price, and the smith may accept, counter-offer, or throw you out if you keep lowballing. Your old gear is traded in.
  - **Temple of the Dawn:** healing, curing poison, and a blessing that adds +2 SKL for a while.
  - **Guild of the Open Eye:** train up a level once you have the experience and the fee (two random stats +1, more HP), and learn Firebolt, Mend and Blink.
- **The dungeon:** eleven 32×32 levels, generated from your character's seed so a saved game rebuilds the same maps. Levels 1-10 are rooms and corridors, with the market on top of level 1 and the Lich King's throne on level 10. Level 11 is a labyrinth whose exit is hidden in the wall at its farthest dead end. The palette changes as you go down (stone, moss, ice, ember, basalt, crypt), and monsters get tougher the deeper you meet them. You'll find:
  - wooden doors;
  - locked iron vaults, whose key is in a chest on the same level;
  - chests with gold, potions, torches, rations or better gear;
  - fountains, which heal, raise a stat, poison you, or leave a few coins;
  - torches on the walls;
  - stairs;
  - on level 10, the Lich King on his throne;
  - on level 11, the hidden way out. Walk into the right wall or **Search** (F) to reveal it; once you have the Crystal, it hums louder as you get closer.
- **Survival:** food and water run down as you walk, and you eat and drink automatically while you have supplies. Torches burn out, and without one the view closes to a couple of tiles. Starving, thirst and poison cost hit points.
- **Encounters** are turn-based, with the monster standing in front of you.
  - **Attack.**
  - **Charge:** harder hit, but you're left open.
  - **Parry:** half damage, with a chance to counter.
  - **Trick:** INT against the monster's gullibility, to confuse it or slip away.
  - **Offer gold:** some monsters take a bribe.
  - **Drink a potion.**
  - **Cast a spell.**
  - **Flee.**

  There are 15 monsters plus the Lich King: rats, bats, slimes, goblin thieves (steal gold), skeletons, orcs, giant spiders (poison), zombies, ghosts and wraiths (drain experience), dark knights, cave trolls (regenerate), fire imps, minotaurs. The Lich's death bolt goes straight through armour. A friendly peddler also wanders the halls with overpriced supplies.
- **Controls:** a key-cap panel to the left of the view shows every key and lights up as you press it.
  - **Arrows/WASD:** step forward or back and turn 90°.
  - **Q/E:** sidestep.
  - **F:** search the walls ahead and beside you for secret passages.
  - Walk into doors, shop fronts and stairs to use them.
  - **1-9** or clicking picks menu options; Enter takes the first option and Esc backs out.
  - **I:** inventory, where you can drink a potion, eat or drink early, or cast Mend.
  - **M:** full map.
  - **Esc:** pause, save, quit.
  - **Shift+N:** mute.
- **Saving:** the automap on the right fills in as you see things. The game saves when you rest at the tavern, when you take stairs, and from the pause menu. Death offers a reload of the last save.

**How it's drawn.** The view is a classic grid raycaster (`src/game/underrealm/raycaster.ts`) rendering into a 320×200 canvas that's scaled up. It draws textured walls with a DDA ray per column, per-row floor and ceiling casting, billboard sprites against a depth buffer, and torch-radius lighting with flicker. The camera glides between grid squares and turns smoothly, as Alternate Reality did. All wall and floor textures are painted procedurally (`textures.ts`), with a different palette per level. Monsters, shopkeepers and props are original voxel models (`models.ts`) built from rounded shapes: capsule limbs, ellipsoid bodies, membrane wings, cloth and armour detail. The shared voxel renderer draws them with ambient occlusion, surface grain and soft contact shadows. In a fight the monster lunges at you when it attacks and recoils when hit, and shopkeepers idle behind their counters. There are no art files.

**The Hall of Adventurers and dungeon packs.** The engine loads any dungeon described as a JSON pack: hand-drawn ASCII maps and/or generator settings, a tile legend, monsters, custom textures and sprites, a soundtrack, a starting kit and a win condition. Each pack is an *adventure*. The Hall lists:

- the built-in Underrealm, which is itself a pack;
- the bundled sample, **The Crypt of Tharn** (`public/dungeons/crypt-of-tharn.json`): three hand-built levels with a custom boss, guardians, secret doors, a hidden gate and its own music;
- any packs you've uploaded.

Press **U** to upload a pack. It's validated and saved in the browser's IndexedDB, so it stays in the Hall. **Del** removes it. Your hero keeps their level, stats and gear between adventures. Escaping an adventure marks it *completed* and brings you back to the Hall for the next one. *Continue* on the title screen resumes your current adventure, or returns you to the Hall between adventures. The full format is in [`docs/underrealm-dungeon-format.md`](docs/underrealm-dungeon-format.md).

**Per-pack soundtracks.** A pack can set its own music for four slots:

- `town`: the market and shops;
- `depths`: the upper levels;
- `abyss`: depth 5 and below;
- `battle`: fights.

Each slot can be a built-in song, a custom chiptune written in note strings, or a looping audio file (URL or data: URI). Individual levels can also have their own music. Any slot a pack doesn't set uses the game's default.

**Audio.** Five original chiptunes: a title theme, a jaunty market/shop tune, the upper dungeon ambience (levels 1-4), the abyss (levels 5-11), and a battle theme. Footsteps, bumps, misses, spells, the encounter sting, level-ups, death and victory are synthesized. Doors, coins, potions, weapon hits, monster deaths and stairs use the CC0 Kenney clips already in `Audio_Art/`.

## Sound

All audio goes through the shared `src/game/shared/Sound.ts`. **Rogue Dungeon** has real audio: a chiptune soundtrack (title, dungeon, victory and game-over tracks) and sound effects for attacks, hits, deaths, gold, potions, chests, traps, stairs and UI clicks. Everything is CC0 (public domain, no credit required) - sources are listed in `Audio_Art/CREDITS.md`. **Pebble Quest** shares the UI click sound; everything else is synthesized at runtime by `src/game/shared/Chiptune.ts`, a small NES-style Web Audio synth (pulse, triangle and noise voices). It's all original music, not the Lolo soundtrack, and needs no audio files: a tower-map theme, a bright room theme for floors 1-5, a minor-key theme for floors 6-10, a room-cleared fanfare, and effects for pebbles, pushes, magic shots, eggs, hatching, the chest, the jewel, powers, a sleeping Leeper, death and undo. It plays through Phaser's sound output, so muting (**M**, remembered between sessions) covers it. To tweak a tune or effect, edit the `SONGS` / `SFX` tables in `Chiptune.ts`; songs are written as note strings, e.g. `'E5 . G5 - C6'`.

To add or swap a recorded clip:
1. Put `<name>.ogg` and `<name>.mp3` (the MP3 is for Safari) in `Audio_Art/sfx/` or `Audio_Art/music/`.
2. Run `npm run assets:sync` to copy them into `public/assets/audio/`.
3. Register the cue in the `SFX_FILES` / `MUSIC_FILES` maps at the top of `Sound.ts`.

## Pixel art

- **Rogue Dungeon** uses the purchased/downloaded art pack in `Rogue_Art/` (untouched); `npm run assets:sync` copies just the files the game references into `public/assets/`.
- **Pebble Quest** ships with *no* external art files. Every sprite is original 16x16 pixel art (drawn at 2x) in `src/game/pebble-quest/Sprites.ts`, generated at runtime onto canvas textures. The look follows the NES Lolo rooms: brown brick floor, tan brick border, tan boulders, green bushes, blue water, heart pebbles, emerald framers and the eight enemies. None of it is copied from the game. Creatures are ASCII pixel maps; repeating terrain is drawn in code.
  - To swap in hand-drawn art, load PNGs under the same texture keys (listed in `TEXTURE_KEYS` in `Sprites.ts`) in `PebblePreloadScene`. Nothing else refers to the sprites except by key.

## Project layout

```
Rogue_Art/                       Source pixel art pack for Rogue Dungeon (left untouched)
Audio_Art/                       Rogue Dungeon's CC0 music + sound effects (see CREDITS.md)
scripts/
  sync-assets.mjs                 Copies the Rogue Dungeon files the game uses into public/assets/
  generate-pebble-levels.mjs      Generates + solver-verifies the 50 Pebble Quest rooms from the templates
  pebble-templates.json           The 50 NES Lolo rooms, transcribed from adventures-of-lolo-rooms-nes-map.webp
public/assets/                    Clean, game-ready copy of Rogue Dungeon's art (regenerate with `npm run assets:sync`)
src/
  config.ts                       Rogue Dungeon constants (tile size, tile indices, depths, floor count...)
  main.ts                         Phaser game bootstrap + full scene list (both games)
  scenes/
    GameSelectScene.ts             The game-select title page (first scene shown)
    PadSetupScene.ts               Controller test + button mapping, and what the buttons do in each game
    rogue-dungeon/                 Boot -> Preload -> Menu -> Dungeon (+HUD overlay) -> GameOver
    pebble-quest/                  Preload -> Map (tower) -> Level (gameplay), plus Editor (level editor)
    kart/                          Preload (builds sprites) -> Menu (racer + track select) -> Race
    underrealm/                    Title (character roll) -> Hall of Adventurers (pick / upload an adventure) -> Underrealm (exploration, encounters, shops)
  game/
    shared/                        Sound.ts (audio, used by every game), Chiptune.ts (the synth: music, effects, engine voice), voxel.ts (voxel modeller/renderer), SaveData.ts (localStorage helper), Pad.ts (USB controller -> key events), PadProfiles.ts (each game's buttons), MenuNav.ts (keyboard/pad cursor for menus)
    rogue-dungeon/                 Rogue Dungeon's entities, dungeon generator, anim helpers, enemy defs, props
    pebble-quest/
      types.ts                     LevelDef (tile chars, framers, enemies, shot pebbles, power) and enemy kinds
      rules.ts                     The pure turn rules - shared by the game, the editor's Verify and the generator
      solver.ts                    Best-first solver used by the generator and the editor
      PuzzleState.ts               Live play session (current state + undo) wrapping rules.ts
      LevelLibrary.ts              Campaign-room lookup, editor overrides, "My rooms", JSON import/validation
      config.ts                    Tile size, floor/room counts, super-push unlock, save-data shape
      Sprites.ts                   Procedural NES-style pixel art (see above)
      levels.generated.ts          The 50 checked-in, solver-verified rooms (regenerate, don't hand-edit)
    kart/
      config.ts                    Vehicles/drivers + stats, drift tiers, item odds
      tracks.ts                    Track definitions + builder (texture, surface map, racing line, scenery, sky)
      mode7.ts                     The Mode-7 floor shader
      kart.ts                      Kart physics (drift, boost, surfaces, walls, laps) + kart-kart collisions
      ai.ts                        Smart and clumsy AI drivers
      models.ts                    Kart, driver, item and prop voxel models
      sprites.ts                   Renders every model into sprite sheets at load time
    underrealm/
      config.ts                    Stats, weapons, armour, spells, monsters, prices, survival rates
      world.ts                     Level builder: ASCII maps, rooms-and-corridors (with the market), mazes, vaults, secrets, hidden exits
      raycaster.ts                 The first-person renderer (walls, floor/ceiling, sprites, torchlight)
      textures.ts                  Procedural wall / floor textures per level
      models.ts                    Voxel monsters, shopkeepers and props
      hero.ts                      The adventurer (and the save game)
      combat.ts                    Turn-based encounter rules
      pack.ts                      The dungeon pack format, the built-in 11-level pack, loading + validation
      assets.ts                    Loads a pack's custom textures, sprites and soundtrack
      packStore.ts                 The Hall's adventure list: built-in, bundled (public/dungeons) and uploaded (IndexedDB) packs
      shops.ts                     The five market establishments and tavern rumours
```

## Known simplifications

- Rogue Dungeon: tile art isn't fully auto-tiled (blob/edge matching); decorative props don't have collision; doors/levers are cosmetic rather than gating progression.
- Pebble Quest: it's turn-based, not real-time like the NES game, so enemies are deterministic. Rocky, Alma and Skull charge only while lined up with you; Leeper always closes in; eggs and respawns are counted in turns. Eggs on water stay where you push them rather than drifting downstream. Sand is only cosmetic, and the two lava rooms are drawn as water. The solver finds *a* solution, not necessarily the shortest. Super push is keyboard-only (Shift+direction).
- Turbo Kart: the track is flat (no hills or jumps beyond the drift hop), off-screen AI karts are simulated with the same physics but only the player's engine is audible, and it needs WebGL for the Mode-7 floor. Controls are keyboard-only.
- The Underrealm: movement is on a grid with 90-degree turns (as in Alternate Reality). Encounters are random or triggered rather than monsters you can see roaming, and there are no guild alignments, curses or hidden stats. Hand-drawn pack maps aren't checked for completability. Saves live in `localStorage` (`game-arcade.underrealm.save`). Uploaded packs live in IndexedDB, so they're per-browser.

## Lollipop Legion

A top-down arena shooter: lollipops versus germs. All of its art is drawn at runtime (`src/game/lollipop/textures.ts`) and its music and sound effects come from the chiptune synth, so it has no asset files.

- **Pick a flavour:** **Cherry Pop** (balanced), **Lemon Zing** (fast, fragile, rapid fire), **Grape Crush** (slow, tough, 2-damage shots) or **Blue Razz** (fires a fan of three).
- **Controls:** **WASD / arrows** move. **Space** (or J / Z) fires at the nearest germ, or straight ahead if there isn't one; **hold the left mouse button** to aim at the cursor instead. **Shift** (or K / X, or right-click) does a **sugar spin**: the lollipop twirls, hurting and knocking back every germ nearby and wiping out slime, and is invulnerable while it spins. It recharges in 5 seconds (the bar under your hearts). **Esc / P** pauses, **M** mutes.
- **Germs:**
  - **Blob**: green, slow, oozes straight at you.
  - **Virus**: purple and spiky; circles in, then lunges.
  - **Splitter**: an orange bacterium that bursts into two fast **minis** when popped.
  - **Spitter**: blue goo that keeps its distance and spits slime.
  - **Duke Grime**: the crowned germ king, on waves 5 and 10. He fires slime rings and fans and calls in minions, and gets faster below half health.
- **The Legion:** each cleared wave heals you one heart and recruits a **buddy** lollipop (up to 3). Buddies follow you in a conga line and shoot on their own. Germs go for whichever lollipop is closest, and a buddy pops after 3 hits.
- **Pickups:** popped germs sometimes drop a **candy heart** (heals you, or your most hurt buddy) or a **sprinkle star** (8 seconds of faster, wider shots).
- Clear all 10 waves to win. Your best score, furthest wave and number of wins are saved to `localStorage` under `game-arcade.lollipop-legion`.
- Tuning (flavours, germ stats, the waves) is in `src/game/lollipop/config.ts`.
