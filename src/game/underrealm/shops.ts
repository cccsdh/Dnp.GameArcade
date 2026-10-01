import type { ModelId } from './models';

/** The five establishments of the Undercroft market. */
export type ShopId = 'tavern' | 'provisioner' | 'smithy' | 'temple' | 'guild';

export interface ShopDef {
  id: ShopId;
  name: string;
  keeper: ModelId;
  keeperName: string;
  greeting: string;
  /** Interior colours: back wall, shelves, counter. */
  wall: string;
  shelf: string;
  counter: string;
}

export const SHOP_DEFS: Record<ShopId, ShopDef> = {
  tavern: {
    id: 'tavern',
    name: 'The Sleeping Wyrm Tavern',
    keeper: 'barkeep',
    keeperName: 'Old Brannoc',
    greeting: '"Welcome, friend! Food, drink and a warm bed."',
    wall: '#5c3820',
    shelf: '#3c2410',
    counter: '#7c4c24',
  },
  provisioner: {
    id: 'provisioner',
    name: "Moldo's Provisions",
    keeper: 'provisioner',
    keeperName: 'Moldo',
    greeting: '"Torches, rations, remedies - all you need below."',
    wall: '#4c5030',
    shelf: '#383c20',
    counter: '#6c6034',
  },
  smithy: {
    id: 'smithy',
    name: 'The Iron Brand Smithy',
    keeper: 'smith',
    keeperName: 'Hask the Smith',
    greeting: '"Steel for the stout-hearted. Prices are... negotiable."',
    wall: '#3c3434',
    shelf: '#282424',
    counter: '#5c5454',
  },
  temple: {
    id: 'temple',
    name: 'Temple of the Dawn',
    keeper: 'priest',
    keeperName: 'Sister Aluin',
    greeting: '"The light heals all who can pay the offering."',
    wall: '#c8c0a8',
    shelf: '#a89c80',
    counter: '#e8e0c8',
  },
  guild: {
    id: 'guild',
    name: 'Guild of the Open Eye',
    keeper: 'guildmaster',
    keeperName: 'Master Veyl',
    greeting: '"Experience is nothing without training."',
    wall: '#28305c',
    shelf: '#1c2448',
    counter: '#3c4c8c',
  },
};

export const RUMORS = [
  'They say the Lich King keeps the Crystal of Echoes on the third level, and never leaves his throne.',
  'An iron door always has its key somewhere on the same level - check every chest.',
  'Ghosts and wraiths shrug off steel. A firebolt, though...',
  'Goblins and orcs will take a bribe, if you can stand to pay it.',
  'Trolls heal while they fight - hit them hard and fast.',
  'Drink from the old fountains at your own risk. Some bless, some curse.',
  'The Guild trains those with the experience - and the coin.',
  'Never let your last torch burn out down there. The dark is where the worst things hunt.',
  'A spider bite festers. The temple can cure it, or a potion will.',
  "The Lich's death bolt goes straight through armour. Bring potions.",
  'A clever tongue can confuse a slow monster. Keep your wits about you.',
  'Mind your food and water - a hungry, thirsty adventurer is a dead one.',
];
