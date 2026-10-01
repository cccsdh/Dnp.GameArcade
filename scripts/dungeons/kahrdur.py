"""Builds public/dungeons/stronghold-of-kahr-dur.json - after Eamon EDX-24 by Derek C. Jeter."""
import os
import sys
from mapkit import Grid, check_level, check_music, show, write

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'dungeons', 'stronghold-of-kahr-dur.json')
Grid.walls = {'w', 'k', 'F', 'v'}

# --- Level 1: the upper stronghold -------------------------------------------------
g = Grid(48, 55, 'w')
# Fahrnor road: a lit camp before the gates, with the city's traders.
g.room(14, 50, 30, 53, 'x')
for x, ch in ((16, 'T'), (19, 'P'), (22, 'E'), (25, 'S'), (28, 'H')):
    g.set(x, 54, ch)
g.set(13, 51, 'G')
for x, y in ((13, 53), (31, 51), (31, 53)):
    g.set(x, y, 't')
g.set(21, 50, 'g'); g.set(23, 50, 'g')
g.set(22, 52, '@')
# Entryway, Grand Hallways, Welcome Hall ... up the spine to the throne.
g.set(22, 49, '.')
g.room(18, 46, 26, 48, '.')
g.set(22, 47, 's')
for x, y in ((17, 47), (27, 47)):
    g.set(x, y, 't')
g.set(22, 45, '.')
g.room(21, 40, 23, 44, '.')
for x, y in ((20, 41), (24, 41), (20, 43), (24, 43)):
    g.set(x, y, 's')
g.set(22, 39, '.')
g.room(17, 34, 27, 38, '.', ring='y')
g.set(22, 33, '.')
g.room(21, 28, 23, 32, '.')
g.set(20, 29, 't'); g.set(24, 31, 't')
g.set(22, 27, '.')
g.room(17, 22, 27, 26, '.')
g.set(17, 21, 't'); g.set(27, 21, 't')
g.set(22, 21, '.')
g.room(21, 16, 23, 20, '.')
for x, y in ((20, 17), (24, 17), (20, 19), (24, 19)):
    g.set(x, y, 's')
g.set(22, 15, '.')
g.room(17, 10, 27, 14, 'r', ring='y')
g.set(22, 9, '.')
g.room(16, 2, 28, 8, 'r', ring='y')
g.set(17, 5, 'K')
for x, y in ((18, 2), (26, 2), (18, 8), (26, 8)):
    g.set(x, y, 's')
# Doorwardens' chamber, off the Welcome Hall.
g.set(16, 36, 'D')
g.room(11, 35, 15, 37, '.')
g.set(11, 35, 'c'); g.set(11, 37, 'c')
# West wing: gallery, scorched long hallway, library + treasury, cloak room, storage, office.
g.set(16, 24, 'D')
g.room(9, 23, 15, 25, '.')
for x, y in ((10, 23), (13, 23), (10, 25), (13, 25)):
    g.set(x, y, 's')
g.set(8, 24, '.'); g.set(7, 24, '.')
g.room(6, 17, 6, 32, '.')
g.set(7, 30, 'D')
g.room(8, 29, 14, 32, '.')
g.set(11, 28, 'z')
g.room(9, 27, 13, 27, '.')
g.set(9, 27, 'c'); g.set(11, 27, 'c'); g.set(13, 27, 'c')
g.set(6, 33, 'D')
g.room(4, 34, 8, 36, '.')
g.set(4, 36, 'c')
g.set(7, 20, 'D')
g.room(8, 19, 12, 21, '.')
g.set(12, 19, 'c')
g.set(6, 16, 'D')
g.room(3, 12, 9, 15, '.')
g.set(9, 12, 'c')
# Armory, behind the western iron doors of the Antechamber.
g.set(16, 12, 'D')
g.room(12, 12, 15, 12, '.')
g.room(11, 9, 14, 11, '.')
g.set(11, 9, 'c'); g.set(14, 9, 'c')
# East wing: grand dining hall, kitchen, soldiers' mess and quarters.
g.set(28, 24, 'D')
g.room(29, 22, 32, 26, '.')
g.set(33, 24, 'D')
g.room(34, 22, 40, 26, '.')
g.set(40, 26, 'c')
g.set(37, 21, 'D')
g.room(34, 16, 40, 20, '.')
g.set(37, 15, 'D')
g.room(34, 9, 40, 14, '.')
g.set(40, 9, 'c')
g.set(28, 12, 'D')
g.room(29, 12, 33, 12, '.')
# King's quarters, his sitting room, and the laboratory hidden behind the armoire.
g.set(29, 5, 'D')
g.room(30, 3, 35, 7, 'r')
g.set(32, 8, 'D')
g.room(30, 9, 32, 10, '.')
g.set(36, 5, 'z')
g.room(37, 2, 44, 7, '.')
g.set(43, 8, '.')
g.room(42, 9, 46, 16, ';', ring='q')
g.set(44, 17, '>')
for x, y in ((41, 3), (45, 5)):
    g.set(x, y, 't')
L1 = g.rows()

level1 = {
    'name': 'The Stronghold of Kahr-Dur',
    'depth': 2,
    'style': {'palette': 'stone'},
    'music': 'depths',
    'encounters': {'rate': 0.035, 'monsters': ['rat', 'bat', 'goblin', 'skeleton']},
    'map': L1,
    'chests': [
        {'at': [11, 35], 'gold': 45, 'item': 'torches'},
        {'at': [11, 37], 'gold': 10, 'item': 'potion'},
        {'at': [9, 27], 'gold': 90},
        {'at': [11, 27], 'gold': 140, 'item': 'potion'},
        {'at': [13, 27], 'gold': 90, 'item': 'torches'},
        {'at': [4, 36], 'gold': 6},
        {'at': [12, 19], 'gold': 4, 'item': 'torches'},
        {'at': [9, 12], 'gold': 20, 'item': 'potion'},
        {'at': [11, 9], 'gold': 0, 'item': 'armor', 'gear': 'chain'},
        {'at': [14, 9], 'gold': 35, 'item': 'weapon', 'gear': 'mace'},
        {'at': [40, 26], 'gold': 5, 'item': 'food'},
        {'at': [40, 9], 'gold': 25, 'item': 'food'},
    ],
    'guardians': [
        {'at': [13, 36], 'monster': 'darkGuard'},
        {'at': [22, 13], 'monster': 'guardCaptain'},
        {'at': [37, 11], 'monster': 'darkGuard'},
        {'at': [37, 24], 'monster': 'darkGuard'},
        {'at': [39, 4], 'monster': 'stoneGolem'},
        {'at': [43, 7], 'monster': 'ironGolem'},
    ],
    'messages': [
        {'at': [22, 52], 'text': 'The gates of Kahr-Dur loom in the mountainside. Stone gargoyles glare down at you.'},
        {'at': [22, 49], 'text': 'Your brother Jollifrud grips your arm: "Find Mirabelle. I will hold the gate."'},
        {'at': [22, 46], 'text': 'A tall statue of some long-dead warrior stands in the middle of the entryway.'},
        {'at': [22, 38], 'text': 'Tattered tapestries hang in the Welcome Hall. The fine furniture lies smashed.'},
        {'at': [15, 36], 'text': 'An iron storage locker sits in the corner of the Doorwardens\' chamber.'},
        {'at': [15, 24], 'text': 'Broken statues and shattered pottery litter the ruined gallery.'},
        {'at': [6, 22], 'text': 'The walls of this narrow hall are scorched, as if a terrible battle was fought here.'},
        {'at': [11, 29], 'text': 'One bookshelf along the north wall still stands, fixed to the stone. A draught stirs the pages...'},
        {'at': [6, 14], 'text': 'Faded maps of the mountain are pinned to the walls of this old office.'},
        {'at': [15, 12], 'text': 'The heavy iron doors grind open onto an old armory. Most of it is rust.'},
        {'at': [22, 11], 'text': 'Dark guards in spiked black helms stand watch over the antechamber.'},
        {'at': [18, 5], 'text': 'A huge throne sits on its dais. Every gem has been pried from it.'},
        {'at': [35, 5], 'text': 'A battered armoire stands against the east wall. Cold air seeps from behind it.'},
        {'at': [38, 5], 'text': 'Shattered vials and rune-covered devices: a wizard\'s laboratory. Something huge stirs.'},
        {'at': [44, 12], 'text': 'Summoning runes are cut into the floor. Empty iron cages. Narrow stairs lead down into the rock.'},
        {'at': [36, 17], 'text': 'Soldiers\' mess. Someone has been eating here - recently.'},
    ],
}

# --- Level 2: the caves beneath -------------------------------------------------------
g = Grid(44, 34, 'k')
g.blob(8, 30, 2, 1, ',')
g.set(8, 33, '<'); g.set(8, 32, ','); g.set(8, 31, ',')
g.path([(8, 28), (8, 25)], ',')
g.blob(8, 22, 3, 2, ',')                       # smelly cavern (ochre jelly)
g.path([(5, 22), (3, 22)], ',')                # west to the small chambers
g.blob(3, 21, 1, 1, ',')
g.path([(3, 20), (3, 12)], ',')
g.blob(3, 16, 2, 2, ',')                       # the ghoul's cavern
g.set(1, 16, 'c')
g.blob(4, 9, 3, 2, ',')                        # large natural chamber
g.path([(7, 9), (14, 9)], ',')
g.set(15, 9, ','); g.set(15, 8, '>')           # the T-intersection, the great hewn stair down
g.path([(16, 9), (24, 9)], ',')
g.blob(27, 9, 3, 2, ',')                       # large cavern with the portcullis
g.set(31, 9, 'L')
g.path([(32, 9), (35, 9)], ',')
g.blob(37, 9, 1, 1, ',')
g.path([(37, 7), (37, 5)], '.')
g.room(33, 1, 41, 4, '.', ring='t')            # the Necromancer's chamber, lit by candelabras
g.set(37, 1, 'A')
g.set(33, 1, 'c'); g.set(41, 1, 'c')
g.path([(27, 12), (27, 20)], ',')
g.blob(27, 16, 1, 1, ',')
g.blob(27, 23, 3, 2, ',')                      # huge natural cavern
g.path([(31, 23), (35, 23)], ',')
g.blob(38, 23, 2, 2, ',')                      # goblin lair
g.set(40, 23, 'c')
g.path([(23, 23), (12, 23)], ',')
g.blob(18, 23, 2, 1, ',')
L2 = g.rows()

level2 = {
    'name': 'The Caves Beneath Kahr-Dur',
    'depth': 3,
    'style': {'palette': 'cavern'},
    'encounters': {'rate': 0.05, 'monsters': ['bat', 'rat', 'goblinSoldier', 'goblin', 'spider', 'ghoul']},
    'map': L2,
    'chests': [
        {'at': [1, 16], 'gold': 120, 'item': 'potion'},
        {'at': [40, 23], 'gold': 80, 'item': 'weapon', 'gear': 'broadsword'},
        {'at': [33, 1], 'gold': 150, 'item': 'potion'},
        {'at': [41, 1], 'gold': 60, 'item': 'weapon', 'gear': 'runeblade'},
    ],
    'guardians': [
        {'at': [8, 22], 'monster': 'ochreJelly'},
        {'at': [3, 16], 'monster': 'ghoul'},
        {'at': [38, 23], 'monster': 'goblinChief'},
        {'at': [37, 1], 'monster': 'necromancer'},
    ],
    'messages': [
        {'at': [8, 30], 'text': 'Rough-hewn walls, thick with moss and lichen. A broken tunnel leads north into natural caves.'},
        {'at': [8, 24], 'text': 'A particularly foul odour hangs in the air here...'},
        {'at': [3, 18], 'text': 'Gnawed bones. Something here eats men.'},
        {'at': [15, 9], 'text': 'A huge stair, roughly hewn and scarred from battle, leads down into the darkness.'},
        {'at': [29, 9], 'text': 'To the east, a heavy portcullis thrums with magic - its lock is carved with the runes of some deeper temple. Beyond it, a woman is weeping.'},
        {'at': [37, 6], 'text': 'A shimmering light to the north. Evil runes, written in blood, cover the walls.'},
        {'at': [36, 23], 'text': 'Goblin voices, and the clatter of arms. A war-camp!'},
    ],
}

# --- Level 3: out onto the cliff and into Tangledoom Forest ---------------------------------
g = Grid(40, 46, 'F')
g.fill(13, 38, 35, 45, 'k')
g.room(28, 41, 32, 43, ',')                   # hewn chamber
g.set(30, 44, '<')
g.path([(27, 42), (22, 42)], ',')              # long hewn corridor
g.room(17, 40, 21, 43, ',')                    # large hewn entry chamber
g.set(19, 39, ',')
g.room(16, 36, 22, 38, '_')                    # edge of the steep cliff
g.path([(19, 35), (19, 32)], '_')              # steep winding stone path
g.path([(19, 31), (19, 28)], ':')              # edge of the forest, path in the woods
g.blob(19, 26, 2, 2, '"')                      # large clearing
g.set(17, 24, 'e'); g.set(21, 28, 'e')
g.path([(22, 26), (25, 26)], ':')
g.set(26, 26, ':')                             # T-intersection
g.path([(27, 26), (31, 26)], ':')
g.blob(33, 26, 1, 1, '"')                      # small clearing (an ent)
g.path([(33, 24), (33, 21)], ':')
g.blob(33, 19, 2, 1, '"')                      # large clearing (a dark guard with a pouch)
g.set(35, 19, 'c')
g.path([(26, 25), (26, 22)], ':')
g.blob(26, 21, 1, 1, '"')
g.path([(26, 19), (26, 16)], ':')
g.set(26, 15, ':')                             # 4-way intersection
g.path([(26, 14), (26, 12)], ':')
g.blob(26, 10, 2, 1, '"')                      # clearing with a brook
g.path([(26, 8), (26, 7)], ':')
g.blob(26, 6, 1, 0, '"')
g.path([(26, 5), (26, 4)], ':')
g.blob(26, 2, 3, 1, '"')                       # the marble fountain
g.set(26, 1, 'f')
g.set(23, 2, 'e')
g.path([(27, 15), (30, 15)], ':')
g.blob(32, 15, 2, 1, '"')                      # stone bridge over a brook
g.path([(35, 15), (36, 15)], ':')
g.blob(37, 15, 1, 1, '"')                      # the pit
g.set(38, 15, '>')
g.path([(25, 15), (20, 15)], ':')
g.set(19, 15, ':')                             # T-intersection
g.path([(19, 14), (19, 10)], ':')
g.blob(19, 8, 2, 2, '"')                       # yellow thorns (an ent)
g.set(17, 7, 'c')
g.path([(19, 16), (19, 23)], ':')
L3 = g.rows()

level3 = {
    'name': 'Tangledoom Forest',
    'depth': 4,
    'style': {'palette': 'forest'},
    'daylight': True,
    'music': {
        'chiptune': {
            'bpm': 84,
            'leadWave': 'triangle',
            'volume': 0.6,
            'lead': 'E4 - G4 - B4 - A4 G4 F#4 - - - E4 - D4 - E4 - - - B3 - D4 - E4 - G4 F#4 E4 - - - '
                    'E4 - G4 - B4 - C5 B4 A4 - - - G4 - F#4 - G4 - - - A4 - F#4 - D#4 - F#4 - E4 - - -',
            'harmony': 'E3 . B3 . E3 . B3 . D3 . A3 . D3 . A3 . C3 . G3 . C3 . G3 . B2 . F#3 . B2 . F#3 . '
                       'E3 . B3 . E3 . B3 . A2 . E3 . A2 . E3 . C3 . G3 . B2 . F#3 . E3 . B3 . E3 . B3 .',
            'bass': 'E2 - - - - - - - D2 - - - - - - - C2 - - - - - - - B1 - - - - - - - '
                    'E2 - - - - - - - A1 - - - - - - - C2 - - - B1 - - - E2 - - - - - - -',
            'drums': 'k . . . h . . . k . . . h . . . k . . . h . . . k . . . h . h . '
                     'k . . . h . . . k . . . h . . . k . . . h . . . k . . . s . . .',
        }
    },
    'encounters': {'rate': 0.05, 'monsters': ['spider', 'serpent', 'goblinSoldier', 'orc', 'bat']},
    'map': L3,
    'chests': [
        {'at': [35, 19], 'gold': 65, 'item': 'potion'},
        {'at': [17, 7], 'gold': 30, 'item': 'potion'},
    ],
    'guardians': [
        {'at': [33, 26], 'monster': 'ent'},
        {'at': [33, 19], 'monster': 'darkGuard'},
        {'at': [19, 8], 'monster': 'ent'},
        {'at': [26, 2], 'monster': 'ent'},
    ],
    'messages': [
        {'at': [30, 42], 'text': 'Bones and debris of some long-fought battle litter the hewn chamber.'},
        {'at': [19, 41], 'text': 'Exotic designs by a master stonemason. Bright sunlight shines up the great stair.'},
        {'at': [19, 37], 'text': 'A high ledge over an enclosed valley, ringed by snowcapped peaks. A dark forest fills it.'},
        {'at': [19, 31], 'text': 'An old wooden sign, decrepit with age, barely reads "Tangledoom Forest".'},
        {'at': [19, 26], 'text': 'The forest is eerily quiet. No birds sing. You dare not step off the path.'},
        {'at': [32, 15], 'text': 'A narrow stone bridge, green with moss, arches over a brook.'},
        {'at': [37, 15], 'text': 'A great pit yawns in the clearing. You cannot see the bottom.'},
        {'at': [19, 10], 'text': 'A curious yellow plant with heavy thorns grows in patches here.'},
        {'at': [26, 4], 'text': 'A beautiful marble fountain ahead. Its water is cloudy, and smells foul.'},
        {'at': [33, 21], 'text': 'Heavy footfalls in the clearing ahead - armoured, and not an ent.'},
    ],
}

# --- Level 4: the burrow, and the demonic temple ------------------------------------------
g = Grid(48, 36, 'v')
g.room(22, 1, 26, 3, ',')                       # low-ceilinged cavern under the pit
g.set(24, 0, '<')
g.path([(24, 4), (24, 7)], ',')                 # narrow burrow
g.room(21, 8, 27, 10, ',')                      # collapsed stair-head, broken demon statue
g.set(22, 9, 'g'); g.set(26, 8, 'g')
g.path([(24, 11), (24, 12)], '.')               # the massive stonework stairs
g.room(21, 13, 27, 15, '.', ring='u')           # base of the stairs
g.set(20, 13, 't'); g.set(28, 13, 't')
g.path([(28, 14), (33, 14)], '.')
g.room(34, 12, 39, 16, '.', ring='u')           # skeletons' lair
g.set(39, 12, 'c'); g.set(39, 16, 'c')
g.path([(20, 14), (15, 14)], '.')
g.room(9, 12, 14, 16, '.', ring='u')            # zombies' lair
g.path([(8, 14), (6, 14)], '.')
g.room(1, 12, 5, 16, '.', ring='u')             # wraiths' lair
g.path([(3, 17), (3, 21)], '.')
g.room(1, 22, 7, 27, '.', ring='u')             # temple narthex
g.set(4, 24, 'n')
g.path([(12, 17), (12, 21)], '.')
g.room(9, 22, 15, 26, '.', ring='u')            # hydra's lair
g.set(8, 24, '.')
g.set(15, 26, 'c')
g.set(4, 28, 'D')                               # huge double doors to the sanctuary
g.room(1, 29, 15, 34, 'm', ring='u')
for x in (3, 6, 10, 13):
    for y in (30, 32):
        g.set(x, y, 'u')
g.set(8, 34, 'a')
g.set(7, 34, 'c'); g.set(9, 34, 'c')
g.set(6, 34, 'u'); g.set(10, 34, 'u')
L4 = g.rows()

level4 = {
    'name': 'The Demonic Temple',
    'depth': 6,
    'style': {'palette': 'basalt'},
    'music': 'abyss',
    'encounters': {'rate': 0.05, 'monsters': ['skeleton', 'zombie', 'hellhound', 'serpent', 'fireDemon', 'wraith']},
    'map': L4,
    'chests': [
        {'at': [39, 12], 'gold': 90, 'item': 'potion'},
        {'at': [39, 16], 'gold': 60, 'item': 'armor', 'gear': 'plate'},
        {'at': [15, 26], 'gold': 200, 'item': 'potion'},
        {'at': [7, 34], 'gold': 250, 'item': 'key'},
        {'at': [9, 34], 'gold': 100, 'item': 'armor', 'gear': 'mithril'},
    ],
    'guardians': [
        {'at': [36, 14], 'monster': 'skeletonGuard'},
        {'at': [11, 14], 'monster': 'zombieHorde'},
        {'at': [3, 14], 'monster': 'wraith'},
        {'at': [12, 24], 'monster': 'hydra'},
        {'at': [8, 33], 'monster': 'sharruk'},
    ],
    'messages': [
        {'at': [24, 2], 'text': 'Claw marks score the walls - a burrow dug by something huge. Light spills from the pit above.'},
        {'at': [24, 9], 'text': 'Rubble, and the shattered pieces of an enormous statue of some terrible demon.'},
        {'at': [24, 14], 'text': 'Iron sconces twisted into demon shapes. Tapestries of sacrifice. A demonic temple.'},
        {'at': [33, 14], 'text': 'Clack... clack-clack. Bones, chattering in alarm.'},
        {'at': [15, 14], 'text': 'The stench from the west is almost unbearable.'},
        {'at': [12, 20], 'text': 'Something vast breathes in the chamber below. Five somethings.'},
        {'at': [5, 14], 'text': 'A chill runs through you. The shadows here are moving.'},
        {'at': [3, 25], 'text': 'A dry fountain, choked with dust. Great doors lead south.'},
        {'at': [8, 30], 'text': 'Stained glass, backlit by magic, rings the sanctuary. On the altar lies an ancient tome.'},
        {'at': [7, 33], 'text': "Sharruk's hoard lies heaped by the altar - and among it, a heavy key etched with portcullis runes."},
    ],
}

pack = {
    'format': 'underrealm-dungeon',
    'version': 1,
    'id': 'stronghold-of-kahr-dur',
    'name': 'The Stronghold of Kahr-Dur',
    'author': 'After Eamon Deluxe EDX-24 by Derek C. Jeter (Eamon CS port by Michael Penner)',
    'description': 'A mountain fortress, the caves beneath it, a haunted forest and a demon temple. Rescue Lady Mirabelle from the Necromancer.',
    'intro': [
        'A raven brings word from your brother Jollifrud in the city of Fahrnor: something in the',
        'abandoned fortress of Kahr-Dur has been stealing people in the night - his daughter,',
        'Lady Mirabelle, among them. Find her, deal with the evil, and bring her home.',
    ],
    'victory': [
        'You lead Lady Mirabelle out through the gates of Kahr-Dur, into the morning light.',
        'Jollifrud weeps as he embraces his daughter. Fahrnor will sleep soundly tonight.',
    ],
    'goal': {
        'requires': 'crystal',
        'item': 'Lady Mirabelle',
        'sprite': 'captive',
        'hum': False,
        'taken': 'You strike the chains from Lady Mirabelle. "Take me home!" she cries. Lead her back out through the gates of Kahr-Dur.',
        'barred': 'Jollifrud bars the gate. "Not without my daughter!"',
    },
    'start': {'gold': 120, 'food': 5, 'water': 5, 'torches': 4, 'potions': 2, 'weapon': 'shortsword', 'armor': 'leather'},
    'music': {
        'battle': {
            'chiptune': {
                'bpm': 150,
                'leadWave': 'pulse25',
                'lead': 'A4 A4 . C5 . A4 E5 . D5 C5 B4 . G#4 . B4 . A4 A4 . C5 . A4 F5 . E5 D5 C5 . B4 . G#4 .',
                'bass': 'A1 A2 A1 A2 A1 A2 A1 A2 E1 E2 E1 E2 E1 E2 E1 E2 F1 F2 F1 F2 F1 F2 F1 F2 E1 E2 E1 E2 E1 E2 E1 E2',
                'drums': 'k . h k s . h . k . h k s . h . k . h k s . h . k k h k s . s s',
            }
        },
        'abyss': {'song': 'realmAbyss'},
    },
    'textures': {
        'keepWall': {'preset': 'stone', 'color': '#6c6c74', 'mortar': '#26262a'},
        'tapestryWall': {'preset': 'tapestry', 'color': '#6c6c74', 'mortar': '#26262a', 'accent': '#5c1c2c'},
        'conjureWall': {'preset': 'runes', 'color': '#24202a', 'mortar': '#0c0a0e', 'accent': '#f83c28'},
        'conjureFloor': {'preset': 'runes', 'color': '#2c2830', 'mortar': '#141216', 'accent': '#c83020'},
        'rug': {'preset': 'carpet', 'color': '#5c1820', 'accent': '#a88838'},
        'caveWall': {'preset': 'cave', 'color': '#6c6258', 'mortar': '#1c1814'},
        'caveFloor': {'preset': 'rubble', 'color': '#4c443c'},
        'forestWall': {'preset': 'trees', 'color': '#2c5424', 'accent': '#3c2c1c'},
        'grass': {'preset': 'grass', 'color': '#3c6c2c'},
        'grassCeil': {'preset': 'sky', 'color': '#6c8cb8'},
        'dirtPath': {'preset': 'rubble', 'color': '#6c5438'},
        'dirtPathCeil': {'preset': 'sky', 'color': '#6c8cb8'},
        'ledge': {'preset': 'rubble', 'color': '#7c7468'},
        'ledgeCeil': {'preset': 'sky', 'color': '#7c9cc8'},
        'templeStone': {'preset': 'stone', 'color': '#3c3444', 'mortar': '#141018'},
        'templeRunes': {'preset': 'runes', 'color': '#2c2434', 'mortar': '#0c0a10', 'accent': '#b048f8'},
        'sanctuaryFloor': {'preset': 'carpet', 'color': '#241c34', 'accent': '#7c3cb8'},
    },
    'sprites': {
        'statue': {'model': 'knight', 'tint': '#a8a8b0'},
        'darkCaptain': {'model': 'darkGuard', 'tint': '#ffb8b0'},
        'ironGolem': {'model': 'golem', 'tint': '#a8b8e0'},
        'ochreJelly': {'model': 'slime', 'tint': '#f0b848'},
        'goblinChief': {'model': 'goblin', 'tint': '#ffd8a0'},
        'goblinSoldier': {'model': 'goblin', 'tint': '#c8c8b0'},
        'sharruk': {'model': 'lich', 'tint': '#e0d0ff'},
        'dryFountain': {'model': 'fountain', 'tint': '#8c8478'},
    },
    'tiles': {
        'w': {'type': 'wall', 'texture': 'keepWall'},
        'y': {'type': 'wall', 'texture': 'tapestryWall'},
        'z': {'type': 'secret', 'texture': 'keepWall'},
        'q': {'type': 'wall', 'texture': 'conjureWall'},
        ';': {'type': 'floor', 'floor': 'conjureFloor'},
        'r': {'type': 'floor', 'floor': 'rug'},
        's': {'type': 'prop', 'sprite': 'statue', 'walkable': False},
        'g': {'type': 'prop', 'sprite': 'gargoyle', 'walkable': False},
        'k': {'type': 'wall', 'texture': 'caveWall'},
        ',': {'type': 'floor', 'floor': 'caveFloor'},
        'A': {'type': 'throne', 'sprite': 'altar'},
        'F': {'type': 'wall', 'texture': 'forestWall'},
        '"': {'type': 'floor', 'floor': 'grass'},
        ':': {'type': 'floor', 'floor': 'dirtPath'},
        '_': {'type': 'floor', 'floor': 'ledge'},
        'e': {'type': 'prop', 'sprite': 'tree', 'walkable': False},
        'v': {'type': 'wall', 'texture': 'templeStone'},
        'u': {'type': 'wall', 'texture': 'templeRunes'},
        'm': {'type': 'floor', 'floor': 'sanctuaryFloor'},
        'n': {'type': 'prop', 'sprite': 'dryFountain', 'walkable': False},
        'a': {'type': 'prop', 'sprite': 'altar', 'walkable': False},
    },
    'monsters': [
        {'id': 'darkGuard', 'name': 'Dark Guard', 'sprite': 'darkGuard', 'levels': [], 'hp': [18, 24], 'dmg': [3, 8], 'hit': 8, 'def': 4,
         'xp': 45, 'gold': [10, 30], 'gullible': 0.15, 'bribe': 0,
         'intro': 'A dark guard in a spiked black helm raises its battle axe. Two red eyes burn behind the visor.'},
        {'id': 'guardCaptain', 'name': 'Dark Guard Captain', 'sprite': 'darkCaptain', 'levels': [], 'hp': [30, 34], 'dmg': [4, 9], 'hit': 10,
         'def': 5, 'xp': 80, 'gold': [30, 60], 'gullible': 0.1, 'bribe': 0,
         'intro': 'The captain of the dark guards bars the way to the throne room!'},
        {'id': 'stoneGolem', 'name': 'Stone Golem', 'sprite': 'golem', 'levels': [], 'hp': [34, 40], 'dmg': [4, 10], 'hit': 6, 'def': 6,
         'xp': 90, 'gold': [0, 0], 'gullible': 0.6, 'bribe': 0,
         'intro': 'A massive stone golem lurches forward, fists that could smash through walls!'},
        {'id': 'ironGolem', 'name': 'Iron Golem', 'sprite': 'ironGolem', 'levels': [], 'hp': [30, 36], 'dmg': [5, 11], 'hit': 9, 'def': 7,
         'xp': 100, 'gold': [0, 0], 'gullible': 0.55, 'bribe': 0,
         'intro': 'A gigantic iron golem turns its glowing yellow eyes on you, blade-fingers flexing.'},
        {'id': 'ochreJelly', 'name': 'Ochre Jelly', 'sprite': 'ochreJelly', 'levels': [], 'hp': [26, 30], 'dmg': [2, 6], 'hit': 0, 'def': 1,
         'xp': 50, 'gold': [5, 25], 'gullible': 0.2, 'bribe': 0, 'special': 'poison',
         'intro': 'A massive pulsing blob of ooze heaves toward you. Bones float inside it.'},
        {'id': 'goblinSoldier', 'name': 'Goblin Soldier', 'sprite': 'goblinSoldier', 'levels': [2, 3, 4], 'hp': [9, 13], 'dmg': [2, 6],
         'hit': 6, 'def': 2, 'xp': 18, 'gold': [4, 16], 'gullible': 0.4, 'bribe': 20, 'intro': 'A goblin soldier charges, ready for battle!'},
        {'id': 'goblinChief', 'name': 'Goblin Chieftain', 'sprite': 'goblinChief', 'levels': [], 'hp': [24, 28], 'dmg': [3, 8], 'hit': 8,
         'def': 3, 'xp': 70, 'gold': [40, 80], 'gullible': 0.3, 'bribe': 60,
         'intro': 'A fierce goblin chieftain snarls, a ruby amulet swinging at his throat.'},
        {'id': 'ghoul', 'name': 'Ghoul', 'sprite': 'ghoul', 'levels': [3, 4, 5], 'hp': [16, 20], 'dmg': [3, 7], 'hit': 8, 'def': 3,
         'xp': 40, 'gold': [0, 15], 'gullible': 0.3, 'bribe': 0, 'special': 'poison',
         'intro': 'A wicked, snarling ghoul springs at you, black claws raking!'},
        {'id': 'necromancer', 'name': 'The Necromancer', 'sprite': 'necromancer', 'levels': [], 'hp': [80, 80], 'dmg': [6, 13], 'hit': 14,
         'def': 6, 'xp': 600, 'gold': [300, 300], 'gullible': 0.05, 'bribe': 0, 'special': 'boss',
         'bolt': [6, 12], 'boltText': 'hurls a bolt of necrotic fire',
         'intro': 'The Necromancer turns from the altar, milky eyes blazing. He grins with needle teeth: "Another for my collection!"'},
        {'id': 'serpent', 'name': 'Demonic Serpent', 'sprite': 'serpent', 'levels': [4, 5, 6], 'hp': [12, 16], 'dmg': [3, 7], 'hit': 10,
         'def': 2, 'xp': 32, 'gold': [0, 0], 'gullible': 0.4, 'bribe': 0, 'special': 'poison',
         'intro': 'A demonic serpent rears up, dagger-like fangs bared!'},
        {'id': 'hellhound', 'name': 'Hell Hound', 'sprite': 'hellhound', 'levels': [5, 6, 7], 'hp': [18, 24], 'dmg': [4, 9], 'hit': 10,
         'def': 3, 'xp': 50, 'gold': [0, 0], 'gullible': 0.35, 'bribe': 0,
         'intro': 'A snarling hell hound bounds out of the dark, eyes glowing red!'},
        {'id': 'fireDemon', 'name': 'Fire Demon', 'sprite': 'demon', 'levels': [6, 7], 'hp': [26, 32], 'dmg': [5, 11], 'hit': 12, 'def': 5,
         'xp': 80, 'gold': [10, 40], 'gullible': 0.3, 'bribe': 0, 'intro': 'A fire demon unfurls its wings in a burst of flame!'},
        {'id': 'ent', 'name': 'Evil Tree Ent', 'sprite': 'ent', 'levels': [], 'hp': [36, 44], 'dmg': [5, 12], 'hit': 4, 'def': 6,
         'xp': 110, 'gold': [0, 0], 'gullible': 0.4, 'bribe': 0, 'special': 'regen',
         'intro': 'The branches of a huge oak sweep aside to reveal a terrible wooden face - and teeth!'},
        {'id': 'skeletonGuard', 'name': 'Skeleton Warriors', 'sprite': 'skeleton', 'levels': [], 'hp': [30, 34], 'dmg': [4, 9], 'hit': 10,
         'def': 3, 'xp': 70, 'gold': [10, 30], 'gullible': 0.25, 'bribe': 0,
         'intro': 'Three skeletons clack and chatter in alarm, then rush you as one!'},
        {'id': 'zombieHorde', 'name': 'Zombie Horde', 'sprite': 'zombie', 'levels': [], 'hp': [38, 44], 'dmg': [4, 9], 'hit': 4, 'def': 2,
         'xp': 75, 'gold': [5, 30], 'gullible': 0.7, 'bribe': 0,
         'intro': 'A horde of rotting zombies lurches at you, reeking of the grave!'},
        {'id': 'hydra', 'name': 'Undead Hydra', 'sprite': 'hydra', 'levels': [], 'hp': [52, 58], 'dmg': [6, 13], 'hit': 12, 'def': 4,
         'xp': 200, 'gold': [40, 90], 'gullible': 0.2, 'bribe': 0, 'special': 'regen',
         'intro': 'A massive five-headed undead hydra rises, black bones showing through its rotting hide!'},
        {'id': 'sharruk', 'name': 'Sharruk the Lich', 'sprite': 'sharruk', 'levels': [], 'hp': [70, 70], 'dmg': [6, 14], 'hit': 16,
         'def': 7, 'xp': 420, 'gold': [150, 150], 'gullible': 0.1, 'bribe': 250, 'special': 'drain',
         'intro': 'Sharruk the Lich fixes you with piercing yellow eyes. "Free me from this temple," he hisses, "or join my servants!"'},
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
