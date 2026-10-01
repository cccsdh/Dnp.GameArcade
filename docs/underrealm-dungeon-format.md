# The Underrealm dungeon pack format

The Underrealm's engine (first-person raycaster, turn-based combat, shops, survival, automap, saving) doesn't hard-code any dungeon. It loads a **dungeon pack**, a single JSON file that describes:

- the levels, drawn as ASCII maps or generated from settings;
- the tile legend;
- the monsters;
- custom wall and floor textures and sprites;
- the starting kit and what it takes to win.

The built-in 11-level Underrealm is itself a pack (`BUILTIN_PACK` in `src/game/underrealm/pack.ts`). `public/dungeons/crypt-of-tharn.json` is a complete hand-made example. `stronghold-of-kahr-dur.json` and `pyramid-of-anharos.json` are larger four-level adventures adapted from classic Eamon adventures. They're built by the Python scripts in `scripts/dungeons/` (run `python kahrdur.py` or `python anharos.py` there), which draw the maps and check that every stair, exit, chest and guardian can be reached.

**Adventures and the Hall.** Each pack is an *adventure*. A newly rolled hero goes to the **Hall of Adventurers**, which lists every adventure:

- the built-in Underrealm;
- the packs bundled with the game (listed in `public/dungeons/index.json`);
- the packs you have uploaded.

Press **U** in the Hall to upload a `.json` pack. It's checked, then saved in the browser (IndexedDB, database `game-arcade-underrealm`), so it stays in the list across sessions. **Del** removes an uploaded pack. Uploading a pack with the same `id` again replaces the old version. Heroes carry their level, stats, gold and gear from one adventure to the next. When you escape, the adventure is marked *completed* and you return to the Hall. To ship a pack with the game, drop it in `public/dungeons/` and add its file name to `public/dungeons/index.json`.

## Top level

```jsonc
{
  "format": "underrealm-dungeon",   // required, exactly this
  "version": 1,
  "id": "crypt-of-tharn",           // required, unique (saves remember it)
  "name": "The Crypt of Tharn",     // required
  "author": "...",
  "description": "One line for the dungeon list.",
  "intro": ["Lines shown when you start."],
  "victory": ["Lines shown when you escape."],
  "goal": { "requires": "crystal" }, // or {} - reach any exit tile to win
  "start": { "gold": 140, "food": 4, "water": 4, "torches": 3, "potions": 2, "weapon": "shortsword", "armor": "leather" },
  "tiles": { },      // extra / overridden legend characters (below)
  "textures": { },   // custom wall / floor textures (below)
  "sprites": { },    // custom sprites (below)
  "monsters": [ ],   // extra monsters, or overrides of built-in ones by id (below)
  "music": { },      // the adventure's own soundtrack (below) - optional
  "levels": [ ]      // required, level 1 first (below)
}
```

With `"requires": "crystal"`, beating a boss on a throne leaves the Crystal of Echoes on the throne, and exit gates stay sealed until you carry it. The relic can be renamed and restyled:

```jsonc
"goal": {
  "requires": "crystal",
  "item": "Lady Mirabelle",          // its name in messages (default "the Crystal of Echoes")
  "sprite": "captive",               // what appears on the throne once the boss falls (default "crystal")
  "taken": "You strike the chains from Lady Mirabelle...",  // shown when you pick it up
  "barred": "Jollifrud bars the gate. \"Not without my daughter!\"",  // shown at the exit without it
  "hum": false                       // don't hint how close the exit is while carrying it
}
```

## Levels

Each level is either a **map**, which is used when present, or **generate** settings.

```jsonc
{
  "name": "The Ossuary",
  "depth": 3,                        // difficulty: monster toughness + loot (default = level number)
  "style": { "palette": "crypt" },   // or { "wall": "#4c5c6c", "floor": "#3c3c44", "ceiling": "#16161c" }
  "lit": false,                      // true = fully lit and monster-free
  "daylight": false,                 // true = open sky: fully lit, no torch burns, monsters still roam
  "encounters": { "rate": 0.06, "monsters": ["skeleton", "ghost"] },

  "map": [                           // rows of tile characters, up to 64 x 64
    "bbbbbbbb",
    "b<....>b",
    "bbbbbbbb"
  ],
  "chests":    [{ "at": [x, y], "gold": 50, "item": "potion" }],  // item: potion | torches | food | key | weapon | armor (+ "gear": id)
  "guardians": [{ "at": [x, y], "monster": "warden" }],            // fought when you step next to them; on a throne tile = the boss
  "messages":  [{ "at": [x, y], "text": "A draught blows from the south..." }]
}
```

**Palettes:** `stone`, `moss`, `basalt`, `ice`, `ember`, `crypt`, `desert`, `cavern`, `forest`.

**Encounters:** random encounters happen at `rate` per step, default `0.03 + depth × 0.004`. They draw from the `monsters` list or, without one, from monsters whose `levels` include this depth.

**Generated levels** are always 32 × 32:

```jsonc
"generate": {
  "rooms": 10,          // rooms-and-corridors, with doors, a locked vault + key, chests, fountains, torches
  "market": true,       // level 1 of the Underrealm: the lit market square with the five shops on top
  "maze": true,         // a labyrinth instead of rooms
  "boss": "lich",       // a throne with this boss in the farthest room
  "hiddenExit": true,   // the way out, hidden in the wall at the farthest dead end
  "stairsDown": true    // default: true unless a boss or hidden exit is placed
}
```

Generation is seeded per adventurer, so a saved game rebuilds the same maps. Stairs, doors and vaults are placed so the way on is always reachable. Vaults are always optional.

## Tile legend

These characters are built in. A pack's `tiles` can add new ones or redefine any of them.

| Char | Type | Notes |
| --- | --- | --- |
| `#` `B` `t` | wall | stone, brick, wall with a burning torch |
| `.` | floor | |
| `x` | floor | market floor: lit and safe |
| `@` | start | where a new adventurer starts (level 1) |
| `D` | door | opens when you walk into it |
| `L` | locked | needs an iron key (from a chest) |
| `Z` | secret | looks like a wall; walk into it or Search (F) to open |
| `X` | hiddenExit | looks like a wall; revealed by walking into it or searching, it becomes `E` |
| `E` | exit | the way out: walk into it to win (if the goal is met) |
| `<` `>` | stairsUp / stairsDown | |
| `T` `P` `S` `H` `G` | shop | Tavern, Provisioner, Smithy, Temple, Guild |
| `c` | chest | contents from the level's `chests` list |
| `f` | fountain | drink: heal, raise a stat, poison, or coins |
| `K` | throne | put a guardian here to make it the boss |

A tile definition looks like this:

```jsonc
"tiles": {
  "b": { "type": "wall",  "texture": "boneWall" },
  "s": { "type": "prop",  "sprite": "statue", "walkable": false },
  ",": { "type": "floor", "floor": "tombFloor" },
  "!": { "type": "floor", "message": "Words are scratched into the floor here." }
}
```

- **Types:** `wall`, `floor`, `door`, `locked`, `secret`, `hiddenExit`, `exit`, `stairsUp`, `stairsDown`, `shop` (with `"shop": "tavern" | "provisioner" | "smithy" | "temple" | "guild"`), `chest`, `fountain`, `throne`, `prop`, `start`.
- **`texture`:** for solid tiles, a built-in wall texture or one from `textures`. Built-in wall textures: `wall`, `brick`, `torch`, `door`, `locked`, `stairsUp`, `stairsDown`, `gate`, `shopTavern`, `shopProvisioner`, `shopSmithy`, `shopTemple`, `shopGuild`.
- **`floor`:** for walkable tiles. Built-in: `floor`, `market`.
- **Other fields:** `sprite`, `safe`, `walkable` (props) and `message`.

## Textures

Each texture is 64 × 64, used on walls or floors:

```jsonc
"textures": {
  "boneWall": { "preset": "bone", "color": "#9c9484", "mortar": "#2c2820" },
  "planks":   { "preset": "wood", "color": "#8c5c2c" },
  "mural":    { "image": "data:image/png;base64,...." }   // or a URL; resampled to 64x64
}
```

**Presets:** `stone`, `brick`, `moss`, `wood`, `plain`, `bone`, `ice`, `ember`, plus:

| Preset | Surface | `color` / `mortar` / `accent` |
| --- | --- | --- |
| `sandstone` | big wind-worn ashlar blocks | stone / joints |
| `glyphs` | sandstone carved with bands of painted glyphs and a cartouche | stone / joints / paint |
| `cave` | rough natural rock | rock / shadow |
| `runes` | dark stone with a glowing sigil | stone / joints / glow |
| `tapestry` | stone with a hanging heraldic tapestry | stone / joints / cloth |
| `trees` | a wall of forest: trunks under a canopy | leaves / - / bark |
| `tent` | striped cloth hanging in folds | cloth / - / stripe |
| `flame` | a roaring wall of fire | - |
| `storm` | a black cloud full of lightning | cloud / - / bolts |
| `water` | still liquid (a moat, a pool) | water / - / highlights |
| `gate` | the glowing exit arch, set in stone of your colour | stone |
| `sand` | wind-rippled sand (floor, or dune walls) | sand |
| `grass` | grass over bare earth | grass |
| `rubble` | packed earth and pebbles | earth |
| `carpet` | a woven rug | ground / - / pattern |
| `sky` | open sky with clouds | sky |

**Ceilings:** a pack texture named `<floorId>Ceil` is drawn as the ceiling over that floor. For example, `"grassCeil": { "preset": "sky" }` puts sky over every `grass` tile.

Door tiles can carry any texture and a `message`, which makes them good obstacles: a `water` moat, a `flame` wall or a `storm` cloud that you push through.

## Sprites

Chests, props, thrones and monsters are billboard sprites:

```jsonc
"sprites": {
  "statue": { "model": "knight", "tint": "#9c9ca8" },   // a built-in voxel model, re-tinted
  "imp2":   { "image": "https://example.com/imp.png", "scale": 0.8 }  // an image, standing on the floor
}
```

**Built-in models:**
- **Creatures:** `rat`, `bat`, `slime`, `goblin`, `skeleton`, `peddler`, `orc`, `spider`, `zombie`, `ghost`, `knight`, `troll`, `imp`, `wraith`, `minotaur`, `lich`, `darkGuard`, `golem`, `hydra`, `ent`, `ghoul`, `necromancer`, `hellhound`, `demon`, `serpent`, `scorpion`, `dustDevil`, `mummy`, `hawkman`, `riff` (a desert raider), `sheik`.
- **Shopkeepers:** `barkeep`, `provisioner`, `smith`, `priest`, `guildmaster`.
- **Objects:** `chest`, `chestOpen`, `fountain`, `crystal`, `throne`, `gate`, `captive` (a chained prisoner), `altar`, `gargoyle`, `tree`, `obelisk`, `palm`, `diamond`, `sarcophagus`.

For a chest tile with a custom `sprite`, the open chest uses the same id with `Open` appended.

## Monsters

```jsonc
"monsters": [
  {
    "id": "warden", "name": "Bone Warden", "sprite": "warden",
    "levels": [],                 // depths it wanders at random ([] = guardians only)
    "hp": [26, 32], "dmg": [3, 8],
    "hit": 10, "def": 3,          // bonus to hit you; armour against your hits
    "xp": 60, "gold": [20, 40],
    "gullible": 0.2,              // 0-1: how easily Trick works
    "bribe": 0,                   // gold it wants to leave you be (0 = never)
    "special": "boss",            // optional: poison | steal | regen | drain | boss | friendly
    "bolt": [8, 16],              // bosses: damage of the bolt hurled every third round ([0, 0] = none)
    "boltText": "hurls a death bolt",  // ...and how it's described
    "intro": "A Bone Warden rattles to life!"
  }
]
```

A monster with the id of a built-in one (for example `"orc"`) overrides just the fields you give. Monsters met deeper than their shallowest level get tougher and are worth more XP.

## Music

An adventure can have its own soundtrack. Music plays in four **slots**:

| Slot | When it plays | Game default |
| --- | --- | --- |
| `town` | in the market and other safe squares, and in shops | `realmTown` |
| `depths` | exploring levels shallower than depth 5 | `realmDepths` |
| `abyss` | exploring at depth 5 and below | `realmAbyss` |
| `battle` | during a fight | `realmBattle` |

Any slot the pack leaves out uses the game's default, so a pack with no `music` sounds like the Underrealm. Each track is one of three forms:

```jsonc
"music": {
  // 1. One of the game's built-in songs:
  "abyss": { "song": "realmAbyss" },

  // 2. A custom chiptune, in the same note-string format as the built-in songs:
  "depths": {
    "chiptune": {
      "bpm": 70,                 // required
      "steps": 2,                // steps per beat (default 2 = eighth notes)
      "leadWave": "pulse50",     // pulse12 | pulse25 (default) | pulse50 | triangle | saw
      "volume": 0.6,             // default 0.8
      "lead":    "D4 - - - F4 - E4 - D4 . . .",   // required
      "harmony": "D3 . A3 . D3 . A3 .",            // optional
      "bass":    "D2 - - - - - - -",               // required
      "drums":   "k . . . s . . ."                 // optional
    }
  },

  // 3. An audio file (MP3 / OGG / WAV) that loops - a URL, or a data: URI to keep the pack self-contained:
  "battle": { "audio": "https://example.com/battle.ogg", "volume": 0.5 }
}
```

In note strings, each space-separated step is a note (`E5`, `C#4`, `A#2`), `-` to hold the previous note, or `.` for silence. Drums use `k` (kick), `s` (snare) and `h` (hi-hat). Every channel should have the same number of steps, because the song loops when the lead ends.

**Built-in songs:** `realmTitle`, `realmTown`, `realmDepths`, `realmAbyss`, `realmBattle` (the Underrealm), `tower`, `room`, `deep` (Pebble Quest), and `kartMenu`, `kartMeadow`, `kartCanyon`, `kartFrost` (Turbo Kart).

**Per-level music:** a level's `"music"` picks the exploring music for that level only. It can be a slot name (`"music": "abyss"`, useful for a quiet first level that should already sound deep) or a track of its own in any of the three forms. The market and fights still use the `town` and `battle` slots.

`crypt-of-tharn.json` has examples: a custom slow `depths` dirge, a built-in `abyss`, and a custom `battle` theme, with the market left on the game's default.

## Checking a pack

The game validates a pack when it's uploaded and when it loads: the format, id, name and levels are required, maps can be at most 64 × 64, and music tracks must be well-formed, with valid note names. It reports what's wrong. It doesn't yet check that a hand-drawn map can be completed, so walk your levels yourself.
