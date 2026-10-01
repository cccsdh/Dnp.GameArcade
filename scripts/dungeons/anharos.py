"""Builds public/dungeons/pyramid-of-anharos.json - after the Eamon adventure by Pat Hurst."""
import os
import sys
from mapkit import Grid, check_level, check_music, show, write

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'dungeons', 'pyramid-of-anharos.json')
Grid.walls = {'d', 'p', 'h'}

# --- Level 1: the Desert of Terza -------------------------------------------------------
g = Grid(56, 40, 'd')
# The bazaar at the end of the defile from the Main Hall.
g.room(2, 16, 8, 22, 'x')
g.set(3, 15, 'P'); g.set(6, 15, 'S'); g.set(1, 18, 'T'); g.set(1, 20, 'H'); g.set(4, 23, 'G')
g.set(2, 22, 'j'); g.set(8, 16, 'j')
g.set(7, 19, '@')
g.path([(9, 19), (12, 19)], ',')               # Desert's Edge
g.blob(18, 19, 5, 4, ',')                      # the desert wastes
g.path([(15, 15), (15, 12)], ',')
g.blob(15, 9, 4, 3, ',')
g.set(12, 8, 'c')
g.path([(17, 24), (17, 27)], ',')
g.blob(17, 30, 4, 3, ',')                      # old bones of a traveller
g.set(14, 31, 'c')
g.path([(24, 19), (26, 19)], ',')
# The Pyramid of Anharos, and the sand around its faces.
g.room(27, 5, 47, 24, ',')
g.fill(30, 8, 44, 21, 'p')
g.set(30, 15, '>')
g.set(30, 14, 'h'); g.set(30, 16, 'h')
for x in range(33, 42, 4):
    g.set(x, 8, 'h'); g.set(x, 21, 'h')
g.path([(37, 4), (37, 3)], ',')                # a caravan in the lee of a dune
g.blob(37, 2, 3, 1, ',')
g.set(34, 2, 'j'); g.set(40, 2, 'j')
g.path([(48, 15), (50, 15)], ',')              # out to the obelisk
g.blob(51, 10, 3, 3, ',')
g.set(51, 10, 'o')
g.path([(51, 14), (51, 25)], ',')              # tracks leading south
# The Riff camp around the oasis.
g.room(44, 26, 51, 33, '"')
g.set(47, 30, 'f')
g.set(44, 26, 'j'); g.set(50, 27, 'j'); g.set(45, 32, 'j')
Grid.walls = {'d'}
g.room(40, 27, 42, 29, 'r', ring='n')          # guard tent
g.set(43, 28, 'r')
g.room(40, 32, 42, 34, 'r', ring='n')          # storage tent
g.set(43, 33, 'r')
g.room(53, 27, 54, 29, 'r', ring='n')          # women's tent
g.set(52, 28, 'r')
g.room(46, 35, 50, 37, 'r', ring='n')          # the sheik's tent
g.set(48, 34, 'r')
g.set(48, 37, 'Q')
g.set(50, 37, 'c'); g.set(40, 27, 'c'); g.set(40, 32, 'c'); g.set(40, 34, 'c'); g.set(54, 27, 'c')
L1 = g.rows()

level1 = {
    'name': 'The Desert of Terza',
    'depth': 1,
    'style': {'palette': 'desert'},
    'daylight': True,
    'encounters': {'rate': 0.045, 'monsters': ['scorpion', 'dustDevil', 'hermit', 'riffRaider']},
    'map': L1,
    'chests': [
        {'at': [12, 8], 'gold': 12, 'item': 'potion'},
        {'at': [14, 31], 'gold': 20, 'item': 'food'},
        {'at': [50, 37], 'gold': 150},
        {'at': [40, 27], 'gold': 20, 'item': 'weapon', 'gear': 'mace'},
        {'at': [40, 32], 'gold': 5, 'item': 'food'},
        {'at': [40, 34], 'gold': 5, 'item': 'torches'},
        {'at': [54, 27], 'gold': 35, 'item': 'potion'},
    ],
    'guardians': [
        {'at': [37, 2], 'monster': 'caravan'},
        {'at': [41, 28], 'monster': 'fouad'},
        {'at': [53, 28], 'monster': 'sheba'},
        {'at': [48, 35], 'monster': 'masoud'},
        {'at': [48, 37], 'monster': 'sheik'},
    ],
    'messages': [
        {'at': [7, 19], 'text': 'A black cloud shaped like a taloned hand hangs over the Main Hall. East lies the Desert of Endless Sorrows.'},
        {'at': [5, 19], 'text': 'Omar the guide spits in the sand: "The pyramid is east. The Riff dogs who robbed it camp at an oasis beyond the obelisk."'},
        {'at': [11, 19], 'text': 'The burning sands stretch out of sight. Nothing disturbs the contoured dunes. Drink while you can.'},
        {'at': [15, 9], 'text': 'Only the susurrus of the shifting sand. The sun beats down mercilessly.'},
        {'at': [17, 30], 'text': 'The bleached bones of some unfortunate traveller lie half-buried here.'},
        {'at': [26, 19], 'text': 'A strangely pointed dune to the east... no - a pyramid of gigantic stone blocks!'},
        {'at': [29, 15], 'text': 'A ponderous stone door is set in the base of the pyramid, adorned with strange glyphs. It stands ajar.'},
        {'at': [46, 23], 'text': 'Look out! You wrench your foot free of a sinkhole in the sand.'},
        {'at': [37, 6], 'text': 'The north face is less worn - the winds come from the south. The heat wrings the moisture from you.'},
        {'at': [51, 13], 'text': 'An obelisk of sandstone, its faces etched with glyphs. The name "Terza" is carved prominently. Old blood spots its base.'},
        {'at': [51, 20], 'text': 'A dying merchant, Farouk, lies in the sand. "Riffs... they took my water... they went south..." He says no more.'},
        {'at': [51, 25], 'text': 'Green vegetation springs from the dead land. Black Riff tents surround an oasis.'},
        {'at': [48, 34], 'text': 'Rich furnishings and a Persian carpet: the sheik\'s tent. A giant, emaciated man sits among the cushions, trembling.'},
    ],
}

# --- Level 2: inside the Pyramid ---------------------------------------------------------
Grid.walls = {'p'}
g = Grid(36, 34, 'p')
g.set(18, 33, '<')
g.room(17, 29, 19, 32, ',', ring='h')          # corridor of glyphs praising Anharos
g.set(17, 29, 'c')
g.path([(16, 31), (10, 31)], ',')              # deep in the pyramid
g.set(9, 31, 'Z')
g.room(5, 30, 8, 32, ',')
g.set(5, 31, 'c')
g.set(18, 28, ',')
g.room(15, 24, 21, 27, ',')                    # small chamber
g.set(14, 25, ',')
g.room(10, 24, 13, 27, ',')                    # guardroom
g.set(10, 27, 'c')
g.set(22, 25, ',')
g.room(23, 24, 26, 27, ',')                    # slaves' quarters
g.set(26, 24, 'c')
g.path([(18, 23), (18, 17)], ',')              # the steep stone ramps
g.room(16, 13, 20, 16, ',')                    # small room
g.set(21, 14, 'D')                             # doorway hung with strings of glass beads
g.room(22, 13, 26, 16, ',')                    # small storeroom
g.set(26, 13, 'c')
g.set(15, 14, ',')
g.room(10, 13, 14, 16, ',', ring='h')          # handmaidens' chamber
g.set(10, 13, 'c')
g.set(18, 12, ',')
g.room(12, 3, 24, 11, '.', ring='h')           # the Chamber of Krell
g.set(18, 5, 'q')
g.set(18, 2, '>')
L2 = g.rows()

level2 = {
    'name': 'The Pyramid of Anharos',
    'depth': 3,
    'style': {'palette': 'desert'},
    'encounters': {'rate': 0.05, 'monsters': ['mummy', 'scorpion', 'spider', 'bat', 'riffRaider']},
    'map': L2,
    'chests': [
        {'at': [17, 29], 'gold': 0, 'item': 'torches'},
        {'at': [5, 31], 'gold': 70, 'item': 'potion'},
        {'at': [10, 27], 'gold': 30, 'item': 'armor', 'gear': 'chain'},
        {'at': [26, 24], 'gold': 15, 'item': 'food'},
        {'at': [26, 13], 'gold': 20, 'item': 'food'},
        {'at': [10, 13], 'gold': 45, 'item': 'potion'},
    ],
    'guardians': [
        {'at': [12, 25], 'monster': 'tombGuard'},
    ],
    'messages': [
        {'at': [18, 32], 'text': 'Walls covered with glyphs praising the name of Anharos. Two unlit torches sit in their brackets.'},
        {'at': [13, 31], 'text': 'Forms that might be men, curiously flattened, lie in dark stains. The ceiling blocks here are... loose.'},
        {'at': [10, 31], 'text': 'A draught whispers from a crack in the wall to the west.'},
        {'at': [18, 25], 'text': 'Dust covers the floor. A ramp leads steeply down to the north.'},
        {'at': [14, 25], 'text': 'Two desiccated guards lie in the dust - slain to guard Anharos in the afterlife. One of them twitches.'},
        {'at': [23, 25], 'text': 'The dried husks of four slaves, roped together and slain to serve their king.'},
        {'at': [18, 20], 'text': '"Quiet as a tomb." A strong spiritual presence fills this place.'},
        {'at': [15, 14], 'text': 'Scraps of rich fabric strewn about by searchers. Four silk-clad handmaids lie at rest.'},
        {'at': [21, 14], 'text': 'Strings of coloured glass beads clatter as you pass.'},
        {'at': [18, 10], 'text': 'A giant statue of the dreaded Krell, jackal-headed, rises fifty feet to the vaulted ceiling.'},
        {'at': [18, 3], 'text': 'Handholds climb into the gaping stone jaws of Krell. A corridor leads on behind them.'},
    ],
}

# --- Level 3: the Trials of Alaxar, and the Pedestal Room ---------------------------------------
Grid.walls = {'h'}
g = Grid(40, 38, 'h')
g.set(20, 0, '<')
g.room(19, 1, 21, 3, ',')                     # corridor by the moat
g.set(20, 4, 'M')
g.room(19, 5, 21, 6, ',')                     # between moat and flames
g.set(20, 7, 'W')
g.room(19, 8, 21, 9, ',')                     # between flames and cloud
g.set(20, 10, 'Y')
g.room(19, 11, 21, 13, ',')                   # by the dark cloud
g.set(20, 14, ',')
g.room(16, 15, 24, 19, '.')                   # the Chamber of Alaxar
g.path([(20, 20), (20, 21)], '.')
g.room(16, 22, 24, 30, '.')                   # the Pedestal Room
g.set(20, 26, 'b')
# Eight arches, eight coloured rooms.
g.set(15, 26, '.'); g.room(10, 25, 14, 27, '2', ring='O')               # orange (W)
g.set(25, 26, '.'); g.room(26, 25, 30, 27, '5', ring='I')               # blue (E)
g.set(31, 26, 'D'); g.room(32, 25, 35, 27, '8', ring='k')               # black, beyond the blue
g.set(20, 31, '.'); g.room(18, 32, 22, 35, '7', ring='w')               # white (S)
g.set(20, 36, '>')
g.path([(15, 22), (13, 22)], '.'); g.room(8, 19, 12, 22, '1', ring='R') # red (NW)
g.path([(25, 22), (27, 22)], '.'); g.room(28, 19, 32, 22, '6', ring='J')  # violet (NE)
g.path([(15, 30), (13, 30)], '.'); g.room(8, 29, 12, 32, '4', ring='V')  # green (SW)
g.path([(25, 30), (27, 30)], '.'); g.room(28, 29, 32, 32, '3', ring='U')  # yellow (SE)
g.set(8, 30, 'f')
g.set(8, 19, 'c'); g.set(10, 25, 'c'); g.set(32, 32, 'c'); g.set(30, 25, 'c'); g.set(32, 19, 'c'); g.set(35, 26, 'c')
L3 = g.rows()

level3 = {
    'name': 'The Trials of Alaxar',
    'depth': 5,
    'style': {'palette': 'desert'},
    'encounters': {'rate': 0.04, 'monsters': ['mummy', 'wraith', 'ghost', 'spider']},
    'map': L3,
    'chests': [
        {'at': [8, 19], 'gold': 90},
        {'at': [10, 25], 'gold': 20, 'item': 'food'},
        {'at': [32, 32], 'gold': 160},
        {'at': [30, 25], 'gold': 30, 'item': 'torches'},
        {'at': [32, 19], 'gold': 50, 'item': 'potion'},
        {'at': [35, 26], 'gold': 250, 'item': 'weapon', 'gear': 'runeblade'},
    ],
    'guardians': [
        {'at': [20, 17], 'monster': 'avatar'},
        {'at': [10, 20], 'monster': 'fireSpirit'},
        {'at': [30, 20], 'monster': 'twilightShade'},
        {'at': [34, 26], 'monster': 'shadow'},
    ],
    'messages': [
        {'at': [20, 2], 'text': 'A fresh body lies here, its flesh partly dissolved. South, the corridor is cut by a wide moat.'},
        {'at': [20, 5], 'text': 'A blackened corpse, burned only recently. Ahead, a wall of flame roars without scorching the stone.'},
        {'at': [20, 8], 'text': 'A corpse lies rigid, hair singed, teeth clenched. Ahead, a black cloud spits tiny bolts of lightning.'},
        {'at': [20, 12], 'text': 'A body in a dried pool of blood. A bloody trail leads south through an arch, glyphs carved before it.'},
        {'at': [20, 15], 'text': 'A statue stands at the centre of the chamber: a man\'s body, a hawk\'s head, and hands shaped into cruel talons.'},
        {'at': [20, 23], 'text': 'A ray of light rises from a white marble pedestal. Eight arches, each crowned by an ankh of a different colour.'},
        {'at': [20, 25], 'text': 'The pedestal has a diamond-shaped depression in its top. The beam splashes against the ceiling, far above.'},
        {'at': [11, 21], 'text': 'Murals of fires and volcanoes. A red glow, uncomfortably warm.'},
        {'at': [12, 26], 'text': 'Murals of orange produce heaped in copper bowls.'},
        {'at': [30, 31], 'text': 'Hundreds of yellow suns beam down from the murals.'},
        {'at': [10, 31], 'text': 'Leafy forest murals, and the coolness of a forest glade. Water trickles from a basin.'},
        {'at': [28, 26], 'text': 'The blue skies of a summer day. To the east, an arch opens onto utter darkness.'},
        {'at': [29, 21], 'text': 'Dusk advancing into twilight. Something in the violet light is watching you.'},
        {'at': [32, 26], 'text': 'Total, impenetrable darkness. Something breathes in it.'},
        {'at': [20, 33], 'text': 'A room finished all in white. A pool of milky brilliance, cold as the moon, glows at its heart.'},
    ],
}

# --- Level 4: the Tomb of Anharos -----------------------------------------------------------
g = Grid(25, 30, 'h')
g.set(12, 29, '<')
g.room(8, 24, 16, 28, '.')                    # outer chamber
g.set(12, 25, 'u')
g.set(7, 26, '.'); g.room(5, 25, 6, 27, ',')
g.set(17, 26, '.'); g.room(18, 25, 19, 27, ',')
g.set(5, 25, 'c'); g.set(19, 25, 'c')
g.set(12, 23, '.')
g.room(8, 17, 16, 22, '.')                    # inner chamber
g.set(9, 19, 'K')
g.set(15, 19, 's')
g.set(12, 16, '.')
g.room(6, 8, 18, 15, '.')                     # the Tomb of Anharos
g.set(7, 11, 'K')
g.set(17, 11, 's')
g.set(12, 7, 'z')                             # the door in the painted ark
g.room(9, 3, 15, 6, ',')
g.set(12, 2, 'E')
L4 = g.rows()

level4 = {
    'name': 'The Tomb of Anharos',
    'depth': 6,
    'style': {'palette': 'desert'},
    'encounters': {'rate': 0.035, 'monsters': ['mummy', 'wraith', 'ghost']},
    'map': L4,
    'chests': [
        {'at': [5, 25], 'gold': 120, 'item': 'potion'},
        {'at': [19, 25], 'gold': 100, 'item': 'potion'},
    ],
    'guardians': [
        {'at': [6, 26], 'monster': 'tombGuard'},
        {'at': [18, 26], 'monster': 'tombGuard'},
        {'at': [12, 5], 'monster': 'krell'},
    ],
    'messages': [
        {'at': [12, 28], 'text': 'A white marble stair has carried you up from the moonpool. Milky liquid bubbles from the floor here.'},
        {'at': [12, 24], 'text': 'Murals of the battles and triumphs of Anharos cover the walls.'},
        {'at': [12, 20], 'text': 'A sarcophagus and a throne, both small for a man. Murals of Anharos with a beautiful woman.'},
        {'at': [12, 14], 'text': 'The sarcophagus of a great king, crested with the Seal of Anharos. Alaxar beams light upon him from the murals.'},
        {'at': [12, 8], 'text': 'A life-size mural: four slaves carrying a golden ark. There is a door painted in the ark\'s side... or is it painted?'},
        {'at': [12, 4], 'text': 'Beyond Krell, the Seal of Anharos glows in the wall - a diamond-shaped hollow at its heart.'},
    ],
}

pack = {
    'format': 'underrealm-dungeon',
    'version': 1,
    'id': 'pyramid-of-anharos',
    'name': 'The Pyramid of Anharos',
    'author': 'After the Eamon adventure by Pat Hurst (Eamon CS port by Michael Penner)',
    'description': 'Cross the Desert of Terza, take the stolen Diamond of Purity back from the Riff raiders, and restore it to the tomb of Anharos.',
    'intro': [
        'At nine in the morning the sky over the Main Hall goes black: a storm-cloud shaped like a taloned',
        'hand. Pindar Rambis, the high priest, cries out: the tomb of Anharos has been robbed, and his',
        'Diamond of Purity stolen. Take it back from the thieves - and set it in the seal of his tomb.',
    ],
    'victory': [
        'You set the Diamond of Purity into the Seal of Anharos. Light pours from every glyph in the tomb.',
        'Far to the west, the taloned cloud over the Main Hall tears apart, and the sun returns.',
    ],
    'goal': {
        'requires': 'crystal',
        'item': 'the Diamond of Purity',
        'sprite': 'diamond',
        'taken': 'Under the sheik\'s carpet you find an onyx case. Inside blazes the Diamond of Purity! Now take it to the tomb of Anharos.',
        'barred': 'The Seal of Anharos lies dark. A diamond-shaped hollow waits at its heart, empty.',
    },
    'start': {'gold': 100, 'food': 5, 'water': 8, 'torches': 4, 'potions': 2, 'weapon': 'shortsword', 'armor': 'leather'},
    'music': {
        'depths': {
            'chiptune': {
                'bpm': 96,
                'leadWave': 'pulse25',
                'volume': 0.65,
                'lead': 'E4 - F4 G#4 A4 - G#4 F4 E4 - - - B3 - C4 - B3 - A3 - B3 - C4 D4 E4 - F4 - E4 - - -',
                'harmony': 'E3 . B3 . E3 . B3 . F3 . C4 . F3 . C4 . E3 . B3 . E3 . B3 . D3 . A3 . E3 . B3 .',
                'bass': 'E2 - - - - - - - F2 - - - - - - - E2 - - - - - - - D2 - - - E2 - - -',
                'drums': 'k . . h s . h . k . . h s . h . k . . h s . h . k . k . s . h .',
            }
        },
    },
    'textures': {
        'duneWall': {'preset': 'sand', 'color': '#c09860'},
        'sandFloor': {'preset': 'sand', 'color': '#d8b87c'},
        'sandFloorCeil': {'preset': 'sky', 'color': '#78a8e0'},
        'oasisGrass': {'preset': 'grass', 'color': '#5c8c3c'},
        'oasisGrassCeil': {'preset': 'sky', 'color': '#78a8e0'},
        'pyramidWall': {'preset': 'sandstone', 'color': '#c8a46c', 'mortar': '#7c6440'},
        'glyphWall': {'preset': 'glyphs', 'color': '#c0a068', 'mortar': '#7c6440', 'accent': '#2c6ca8'},
        'tentWall': {'preset': 'tent', 'color': '#2c2424', 'accent': '#a82c20'},
        'tentRug': {'preset': 'carpet', 'color': '#7c1c24', 'accent': '#c8a040'},
        'tentRugCeil': {'preset': 'tent', 'color': '#3c3030', 'accent': '#7c2c20'},
        'dust': {'preset': 'plain', 'color': '#8c7c60'},
        'moat': {'preset': 'water', 'color': '#5c6c3c', 'accent': '#c8d8a0'},
        'flames': {'preset': 'flame'},
        'darkCloud': {'preset': 'storm', 'color': '#24202c', 'accent': '#c8e0ff'},
        'redWall': {'preset': 'glyphs', 'color': '#a84830', 'mortar': '#4c1c10', 'accent': '#f8c030'},
        'redFloor': {'preset': 'plain', 'color': '#7c2c1c'},
        'orangeWall': {'preset': 'glyphs', 'color': '#c87830', 'mortar': '#5c3410', 'accent': '#4c2c08'},
        'orangeFloor': {'preset': 'plain', 'color': '#9c5c28'},
        'yellowWall': {'preset': 'glyphs', 'color': '#d8c040', 'mortar': '#6c5c10', 'accent': '#f8f8a0'},
        'yellowFloor': {'preset': 'plain', 'color': '#a89030'},
        'greenWall': {'preset': 'moss', 'color': '#4c7c40', 'mortar': '#1c3014'},
        'greenFloor': {'preset': 'grass', 'color': '#3c6c30'},
        'blueWall': {'preset': 'glyphs', 'color': '#4c78b8', 'mortar': '#1c2c50', 'accent': '#f8f8ff'},
        'blueFloor': {'preset': 'plain', 'color': '#34507c'},
        'violetWall': {'preset': 'glyphs', 'color': '#7c4ca0', 'mortar': '#2c1840', 'accent': '#f0c8ff'},
        'violetFloor': {'preset': 'plain', 'color': '#4c2c68'},
        'whiteWall': {'preset': 'sandstone', 'color': '#e8e4dc', 'mortar': '#9c9890'},
        'whiteFloor': {'preset': 'plain', 'color': '#d8d4cc'},
        'blackWall': {'preset': 'plain', 'color': '#141418'},
        'blackFloor': {'preset': 'plain', 'color': '#0c0c10'},
        'muralWall': {'preset': 'glyphs', 'color': '#c8a46c', 'mortar': '#7c6440', 'accent': '#e8b828'},
        'sealGate': {'preset': 'gate', 'color': '#c8a46c'},
    },
    'sprites': {
        'hermit': {'model': 'peddler', 'tint': '#e0c8a0'},
        'herder': {'model': 'sheik', 'tint': '#b89c7c'},
        'sheikSeat': {'model': 'throne', 'tint': '#f0d8a8'},
        'krellStatue': {'model': 'demon', 'tint': '#9c9080'},
        'krell': {'model': 'demon', 'tint': '#a898b8'},
        'beam': {'model': 'crystal', 'tint': '#fff8e0'},
        'fireSpirit': {'model': 'demon', 'tint': '#ffd0a0'},
        'shade': {'model': 'wraith', 'tint': '#e0a8ff'},
        'darkGhost': {'model': 'ghost', 'tint': '#484858'},
        'milkyFountain': {'model': 'fountain', 'tint': '#f8f8ff'},
    },
    'tiles': {
        'd': {'type': 'wall', 'texture': 'duneWall'},
        ',': {'type': 'floor', 'floor': 'sandFloor'},
        '"': {'type': 'floor', 'floor': 'oasisGrass'},
        'p': {'type': 'wall', 'texture': 'pyramidWall'},
        'h': {'type': 'wall', 'texture': 'glyphWall'},
        'n': {'type': 'wall', 'texture': 'tentWall'},
        'r': {'type': 'floor', 'floor': 'tentRug'},
        'j': {'type': 'prop', 'sprite': 'palm', 'walkable': False},
        'o': {'type': 'prop', 'sprite': 'obelisk', 'walkable': False},
        'Q': {'type': 'throne', 'sprite': 'sheikSeat'},
        'q': {'type': 'prop', 'sprite': 'krellStatue', 'walkable': False},
        'b': {'type': 'prop', 'sprite': 'beam', 'walkable': False},
        's': {'type': 'prop', 'sprite': 'sarcophagus', 'walkable': False},
        'u': {'type': 'fountain', 'sprite': 'milkyFountain'},
        'z': {'type': 'secret', 'texture': 'muralWall'},
        'E': {'type': 'exit', 'texture': 'sealGate'},
        'M': {'type': 'door', 'texture': 'moat', 'message': 'You swim the moat. The oily liquid stings your skin, and broken glass lines its walls.'},
        'W': {'type': 'door', 'texture': 'flames', 'message': 'You hurl yourself through the wall of flame - and out the other side, singed but alive!'},
        'Y': {'type': 'door', 'texture': 'darkCloud', 'message': 'Lightning crackles over your armour as you force your way through the black cloud!'},
        'R': {'type': 'wall', 'texture': 'redWall'}, '1': {'type': 'floor', 'floor': 'redFloor'},
        'O': {'type': 'wall', 'texture': 'orangeWall'}, '2': {'type': 'floor', 'floor': 'orangeFloor'},
        'U': {'type': 'wall', 'texture': 'yellowWall'}, '3': {'type': 'floor', 'floor': 'yellowFloor'},
        'V': {'type': 'wall', 'texture': 'greenWall'}, '4': {'type': 'floor', 'floor': 'greenFloor'},
        'I': {'type': 'wall', 'texture': 'blueWall'}, '5': {'type': 'floor', 'floor': 'blueFloor'},
        'J': {'type': 'wall', 'texture': 'violetWall'}, '6': {'type': 'floor', 'floor': 'violetFloor'},
        'w': {'type': 'wall', 'texture': 'whiteWall'}, '7': {'type': 'floor', 'floor': 'whiteFloor'},
        'k': {'type': 'wall', 'texture': 'blackWall'}, '8': {'type': 'floor', 'floor': 'blackFloor'},
    },
    'monsters': [
        {'id': 'scorpion', 'name': 'Giant Scorpion', 'sprite': 'scorpion', 'levels': [1, 2, 3], 'hp': [8, 12], 'dmg': [2, 5], 'hit': 4, 'def': 3,
         'xp': 16, 'gold': [0, 0], 'gullible': 0.3, 'bribe': 0, 'special': 'poison',
         'intro': 'A four-foot scorpion scuttles across the sand, pincers snapping, tail arched to sting!'},
        {'id': 'dustDevil', 'name': 'Dust Devil', 'sprite': 'dustDevil', 'levels': [1, 2], 'hp': [7, 10], 'dmg': [1, 6], 'hit': 6, 'def': 2,
         'xp': 12, 'gold': [0, 3], 'gullible': 0.2, 'bribe': 0,
         'intro': 'A whirling figure of sand and dust comes at you, seeking to envelop you in its lethal grip!'},
        {'id': 'hermit', 'name': 'Crazed Hermit', 'sprite': 'hermit', 'levels': [1, 2], 'hp': [5, 8], 'dmg': [1, 3], 'hit': 0, 'def': 0,
         'xp': 6, 'gold': [0, 8], 'gullible': 0.8, 'bribe': 5,
         'intro': 'A sun-seared man in rags lurches at you, waving his arms and mumbling gibberish.'},
        {'id': 'riffRaider', 'name': 'Riff Raider', 'sprite': 'riff', 'levels': [1, 2, 3, 4], 'hp': [9, 13], 'dmg': [2, 6], 'hit': 5, 'def': 1,
         'xp': 16, 'gold': [5, 20], 'gullible': 0.35, 'bribe': 25, 'special': 'steal',
         'intro': 'A Riff raider in a black burnoose draws his scimitar: "Die, dog of an infidel!"'},
        {'id': 'caravan', 'name': 'Spice Caravan', 'sprite': 'peddler', 'levels': [], 'hp': [12, 12], 'dmg': [1, 2], 'hit': 0, 'def': 1,
         'xp': 0, 'gold': [0, 0], 'gullible': 0, 'bribe': 0, 'special': 'friendly',
         'intro': 'A spice caravan rests in the lee of a dune. Its master waves you over to trade.'},
        {'id': 'fouad', 'name': 'Fouad the Riff Warrior', 'sprite': 'riff', 'levels': [], 'hp': [14, 18], 'dmg': [2, 7], 'hit': 6, 'def': 1,
         'xp': 30, 'gold': [10, 25], 'gullible': 0.3, 'bribe': 30,
         'intro': 'Fouad cocks his old flintlock and levels it at you: "Die! Dog of an infidel!"'},
        {'id': 'sheba', 'name': 'Sheba the Matriarch', 'sprite': 'riff', 'levels': [], 'hp': [10, 14], 'dmg': [1, 5], 'hit': 4, 'def': 1,
         'xp': 20, 'gold': [5, 30], 'gullible': 0.3, 'bribe': 20,
         'intro': 'An old woman in a black chadour drops her pot and flies at you, screaming like a banshee!'},
        {'id': 'masoud', 'name': 'Masoud the Raider', 'sprite': 'riff', 'levels': [], 'hp': [18, 22], 'dmg': [3, 7], 'hit': 7, 'def': 2,
         'xp': 45, 'gold': [20, 40], 'gullible': 0.2, 'bribe': 50,
         'intro': 'Masoud, the sheik\'s second, draws a black scimitar notched for tearing flesh.'},
        {'id': 'sheik', 'name': 'Saala el Kahir', 'sprite': 'sheik', 'levels': [], 'hp': [34, 34], 'dmg': [3, 7], 'hit': 6, 'def': 2,
         'xp': 250, 'gold': [200, 200], 'gullible': 0.1, 'bribe': 0, 'special': 'boss',
         'bolt': [3, 7], 'boltText': 'raises the stolen Diamond - its light sears you',
         'intro': 'Saala el Kahir, sheik of the Riffs, rises trembling from his cushions. The Diamond\'s curse is eating him alive - but he will not give it up!'},
        {'id': 'mummy', 'name': 'Mummy', 'sprite': 'mummy', 'levels': [2, 3, 4, 5], 'hp': [14, 20], 'dmg': [3, 7], 'hit': 4, 'def': 3,
         'xp': 30, 'gold': [0, 20], 'gullible': 0.5, 'bribe': 0,
         'intro': 'A mummy in yellowed wrappings shambles out of a niche, arms outstretched.'},
        {'id': 'tombGuard', 'name': 'Mummified Guard', 'sprite': 'mummy', 'levels': [], 'hp': [24, 28], 'dmg': [3, 8], 'hit': 6, 'def': 3,
         'xp': 60, 'gold': [10, 30], 'gullible': 0.3, 'bribe': 0,
         'intro': 'The shrivelled body of a tomb guard stirs to life and moves to attack the defiler - you!'},
        {'id': 'avatar', 'name': 'Avatar of Alaxar', 'sprite': 'hawkman', 'levels': [], 'hp': [48, 52], 'dmg': [5, 11], 'hit': 12, 'def': 5,
         'xp': 180, 'gold': [0, 0], 'gullible': 0.1, 'bribe': 0,
         'intro': 'The hawk-headed statue of Alaxar comes to life! It claws with its talons and stabs with its beak!'},
        {'id': 'fireSpirit', 'name': 'Flame of the Red Room', 'sprite': 'fireSpirit', 'levels': [], 'hp': [26, 30], 'dmg': [4, 10], 'hit': 10,
         'def': 4, 'xp': 80, 'gold': [0, 0], 'gullible': 0.3, 'bribe': 0,
         'intro': 'The painted volcanoes flare, and a figure of living flame steps out of the mural!'},
        {'id': 'twilightShade', 'name': 'Twilight Shade', 'sprite': 'shade', 'levels': [], 'hp': [22, 26], 'dmg': [4, 9], 'hit': 10, 'def': 5,
         'xp': 70, 'gold': [0, 0], 'gullible': 0.3, 'bribe': 0, 'special': 'drain',
         'intro': 'The violet dusk thickens into a shade with burning eyes!'},
        {'id': 'shadow', 'name': 'Thing in the Dark', 'sprite': 'darkGhost', 'levels': [], 'hp': [24, 28], 'dmg': [4, 10], 'hit': 12, 'def': 6,
         'xp': 90, 'gold': [0, 0], 'gullible': 0.2, 'bribe': 0, 'special': 'drain',
         'intro': 'Something in the utter darkness reaches for you with cold hands!'},
        {'id': 'krell', 'name': 'Krell, the Bound Demon', 'sprite': 'krell', 'levels': [], 'hp': [60, 66], 'dmg': [6, 13], 'hit': 14, 'def': 6,
         'xp': 350, 'gold': [150, 150], 'gullible': 0.05, 'bribe': 0, 'special': 'regen',
         'intro': 'Krell, arch-demon of Anharos, strains at the bonds of Alaxar: "No thief shall touch the Seal!"'},
    ],
    'levels': [level1, level2, level3, level4],
}

legend = pack['tiles']
if '--show' in sys.argv:
    for lv in pack['levels']:
        print(lv['name']); show(lv['map'])
check_level('L1', L1, legend, level1, needs_start=True, needs_up=False)
check_level('L2', L2, legend, level2)
check_level('L3', L3, legend, level3)
check_level('L4', L4, legend, level4, needs_down=False)
check_music(pack)
write(pack, OUT)
print('wrote', OUT)
