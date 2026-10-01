// Copies the specific pixel-art files the game actually uses out of
// `Rogue_Art/` (the raw purchased/downloaded asset pack, left untouched)
// into `public/assets/` (clean names, no spaces, only what's referenced
// in code). Re-run with `npm run assets:sync` any time art is added.
import { existsSync, mkdirSync, copyFileSync, cpSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, 'Rogue_Art');
const DEST = join(ROOT, 'public', 'assets');

function copy(src, dest) {
  const from = join(SRC, src);
  const to = join(DEST, dest);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}

function copyDir(src, dest, { exclude = [] } = {}) {
  const from = join(SRC, src);
  const to = join(DEST, dest);
  mkdirSync(to, { recursive: true });
  cpSync(from, to, {
    recursive: true,
    filter: (path) => {
      const base = path.split(/[\\/]/).pop() ?? '';
      if (base === '.DS_Store') return false;
      if (base.toUpperCase() === '__MACOSX') return false;
      if (exclude.includes(base)) return false;
      return true;
    },
  });
}

if (existsSync(DEST)) rmSync(DEST, { recursive: true, force: true });

// --- Characters (3 playable heroes), 3 directions x 5 animation sheets ---
const DIRS = ['D', 'S', 'U'];
const ANIMS = ['Idle', 'Walk', 'Attack', 'Hurt', 'Death'];
const HERO_SRC = { '1': '1', '2': '2', '3': '3' };
for (const [hero, srcDir] of Object.entries(HERO_SRC)) {
  for (const dir of DIRS) {
    for (const anim of ANIMS) {
      const file = `${dir}_${anim}.png`;
      copy(`1 Characters/${srcDir}/${file}`, `characters/hero${hero}/${file}`);
    }
  }
}
for (const file of ['Shadow.png', 'D_Blood.png', 'S_Blood.png', 'U_Blood.png', 'Arrow.png', 'Fireball.png']) {
  copy(`1 Characters/Other/${file}`, `characters/fx/${file}`);
}

// --- Enemies (4 types), same layout as characters ---
for (const enemy of ['1', '2', '3', '4']) {
  for (const dir of DIRS) {
    for (const anim of ANIMS) {
      const file = `${dir}_${anim}.png`;
      copy(`3 Dungeon Enemies/${enemy}/${file}`, `enemies/e${enemy}/${file}`);
    }
  }
}
for (const file of ['Shadow.png', 'D_Blood.png', 'S_Blood.png', 'U_Blood.png']) {
  copy(`3 Dungeon Enemies/Other/${file}`, `enemies/fx/${file}`);
}

// --- Dungeon tileset ---
copy('2 Dungeon Tileset/1 Tiles/Tileset.png', 'tiles/Tileset.png');

// --- Animated dungeon objects (doors, chests, fire, levers, spikes, trapdoors) ---
const ANIMATED_OBJECTS = [
  'BigDoor_D', 'BigDoor_S', 'BigDoor_U',
  'Chest1_D', 'Chest1_S', 'Chest1_U',
  'Chest2_D', 'Chest2_S', 'Chest2_U',
  'Door_D', 'Door_S', 'Door_U',
  'Fire1', 'Lever1', 'Lever2', 'Spikes',
  'Trapdoor_D', 'Trapdoor_S', 'Trapdoor_U',
];
for (const name of ANIMATED_OBJECTS) {
  copy(`2 Dungeon Tileset/3 Animated objects/${name}.png`, `objects/anim/${name}.png`);
}

// --- Static decor props (freestanding room dressing) ---
const DECOR = [
  ['Boxes/1.png', 'Box1.png'],
  ['Boxes/2.png', 'Box2.png'],
  ['Boxes/9.png', 'Box3.png'],
  ['Tables/1.png', 'Table1.png'],
  ['Tables/2.png', 'Table2.png'],
  ['Chairs/1.png', 'Chair1.png'],
  ['Chairs/2.png', 'Chair2.png'],
  ['Bookshelf/1.png', 'Bookshelf1.png'],
  ['Bookshelf/2.png', 'Bookshelf2.png'],
  ['Torches/1.png', 'Torch1.png'],
  ['Torches/5.png', 'Torch2.png'],
  ['Blockage/1.png', 'Rubble1.png'],
  ['Blockage/2.png', 'Rubble2.png'],
];
for (const [src, dest] of DECOR) {
  copy(`2 Dungeon Tileset/2 Objects/${src}`, `objects/decor/${dest}`);
}

// --- GUI ---
copyDir('4 GUI/3 Icons', 'gui/icons', { exclude: ['Iconset1.png', 'Iconset2.png', 'Iconset3.png', 'Iconset4.png', 'Iconset5.png', 'Iconset6.png', 'Iconset7.png'] });
copyDir('4 GUI/4 Bars', 'gui/bars', { exclude: ['BarsMap.png'] });
copyDir('4 GUI/2 Buttons', 'gui/buttons', { exclude: ['ButtonsMap.png', 'ButtonsMap2.png'] });
copy('4 GUI/6 Logo/1.png', 'gui/logo.png');
copy('4 GUI/Fog.png', 'gui/fog.png');

// --- Audio (CC0, see Audio_Art/CREDITS.md) - lives outside Rogue_Art/ since it's not from that pack ---
cpSync(join(ROOT, 'Audio_Art', 'sfx'), join(DEST, 'audio', 'sfx'), { recursive: true });
cpSync(join(ROOT, 'Audio_Art', 'music'), join(DEST, 'audio', 'music'), { recursive: true });

console.log('Assets synced into public/assets');
