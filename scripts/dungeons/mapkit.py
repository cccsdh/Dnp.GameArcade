"""Tiny helpers for drawing Underrealm ASCII maps and checking them."""
import json
from collections import deque

SOLID = {'wall', 'door', 'locked', 'secret', 'hiddenExit', 'exit', 'stairsUp', 'stairsDown', 'shop'}
DEFAULT = {
    '#': 'wall', 'B': 'wall', 't': 'wall', '.': 'floor', 'x': 'floor', '@': 'start', 'D': 'door', 'L': 'locked',
    'Z': 'secret', 'X': 'hiddenExit', 'E': 'exit', '<': 'stairsUp', '>': 'stairsDown', 'T': 'shop', 'P': 'shop',
    'S': 'shop', 'H': 'shop', 'G': 'shop', 'c': 'chest', 'f': 'fountain', 'K': 'throne',
}


class Grid:
    def __init__(self, w, h, fill):
        self.w, self.h = w, h
        self.g = [[fill] * w for _ in range(h)]

    def set(self, x, y, ch):
        assert 0 <= x < self.w and 0 <= y < self.h, (x, y, ch)
        self.g[y][x] = ch

    def get(self, x, y):
        return self.g[y][x]

    def fill(self, x0, y0, x1, y1, ch):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, ch)

    def room(self, x0, y0, x1, y1, floor, ring=None):
        """Interior floor; optionally re-skin the surrounding wall ring (only where it is still wall)."""
        if ring:
            for y in range(y0 - 1, y1 + 2):
                for x in range(x0 - 1, x1 + 2):
                    if 0 <= x < self.w and 0 <= y < self.h and (x < x0 or x > x1 or y < y0 or y > y1):
                        self.ringable(x, y, ring)
        self.fill(x0, y0, x1, y1, floor)

    def ringable(self, x, y, ch):
        if self.g[y][x] in self.walls:
            self.g[y][x] = ch

    walls = frozenset()

    def blob(self, cx, cy, rx, ry, floor):
        for y in range(cy - ry, cy + ry + 1):
            for x in range(cx - rx, cx + rx + 1):
                dx = (x - cx) / (rx + 0.5)
                dy = (y - cy) / (ry + 0.5)
                if dx * dx + dy * dy <= 1.0:
                    self.set(x, y, floor)

    def path(self, pts, floor):
        """Orthogonal polyline through the given points (x first, then y)."""
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            sx = 1 if x1 >= x0 else -1
            for x in range(x0, x1 + sx, sx):
                self.set(x, y0, floor)
            sy = 1 if y1 >= y0 else -1
            for y in range(y0, y1 + sy, sy):
                self.set(x1, y, floor)

    def rows(self):
        return [''.join(r) for r in self.g]


def check_level(name, rows, legend, level, needs_start=False, needs_up=True, needs_down=True, exits_ok=False):
    types = dict(DEFAULT)
    types.update({k: v['type'] for k, v in legend.items()})
    walk = lambda ch: types.get(ch, 'wall') not in SOLID and not (types.get(ch) == 'prop' and not legend.get(ch, {}).get('walkable'))
    h = len(rows)
    w = max(len(r) for r in rows)
    assert h <= 64 and w <= 64, f'{name}: too big {w}x{h}'
    assert all(len(r) == w for r in rows), f'{name}: ragged rows'
    for ch in {c for r in rows for c in r}:
        assert ch in types, f'{name}: unknown tile {ch!r}'
    find = lambda t: [(x, y) for y in range(h) for x in range(w) if types[rows[y][x]] == t]
    starts = find('start')
    ups = find('stairsUp')
    downs = find('stairsDown')
    exits = find('exit') + find('hiddenExit')
    if needs_start:
        assert len(starts) == 1, f'{name}: need one start'
    if needs_up:
        assert ups, f'{name}: no stairs up'
    if needs_down:
        assert downs, f'{name}: no stairs down'
    # Arrival: start, or the floor next to the first stairs up (scan order like the game).
    def neighbour(x, y):
        for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and walk(rows[ny][nx]):
                return nx, ny
        return None
    origin = starts[0] if starts else neighbour(*ups[0])
    assert origin, f'{name}: arrival blocked'
    # Flood through floors, doors, secrets and locked doors.
    passable = lambda ch: walk(ch) or types[ch] in ('door', 'secret', 'locked')
    seen = {origin}
    q = deque([origin])
    while q:
        x, y = q.popleft()
        for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen and passable(rows[ny][nx]):
                seen.add((nx, ny))
                q.append((nx, ny))
    touch = lambda p: any((p[0] + dx, p[1] + dy) in seen for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)))
    for p in downs + ups + exits:
        assert touch(p), f'{name}: {types[rows[p[1]][p[0]]]} at {p} unreachable'
    for c in level.get('chests', []):
        x, y = c['at']
        assert types[rows[y][x]] == 'chest', f'{name}: chest entry at {c["at"]} is {rows[y][x]!r}'
        assert (x, y) in seen, f'{name}: chest {c["at"]} unreachable'
    for gd in level.get('guardians', []):
        x, y = gd['at']
        assert walk(rows[y][x]), f'{name}: guardian {gd["monster"]} at {gd["at"]} on {rows[y][x]!r}'
        assert (x, y) in seen, f'{name}: guardian {gd} unreachable'
    for m in level.get('messages', []):
        x, y = m['at']
        assert walk(rows[y][x]) or types[rows[y][x]] in ('door', 'secret'), f'{name}: message at {m["at"]} on {rows[y][x]!r}'
        assert (x, y) in seen, f'{name}: message {m["at"]} unreachable'
    chest_tiles = find('chest')
    listed = {tuple(c['at']) for c in level.get('chests', [])}
    for p in chest_tiles:
        assert p in listed, f'{name}: chest tile {p} has no contents entry'
    unreached = [p for p in chest_tiles if p not in seen]
    assert not unreached, f'{name}: chests unreachable {unreached}'
    print(f'  ok  {name}: {w}x{h}, {len(seen)} open tiles, {len(chest_tiles)} chests, {len(level.get("guardians", []))} guardians')


def show(rows):
    w = len(rows[0])
    print('    ' + ''.join(str(x // 10) for x in range(w)))
    print('    ' + ''.join(str(x % 10) for x in range(w)))
    for y, r in enumerate(rows):
        print(f'{y:3} {r}')


def write(pack, path):
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        text = json.dumps(pack, indent=2, ensure_ascii=False)
        # Keep map rows and small arrays on one line each for readability.
        import re
        text = re.sub(r'\[\s+(-?\d+),\s+(-?\d+)\s+\]', r'[\1, \2]', text)
        f.write(text + '\n')


def check_music(pack):
    import re
    tracks = [(f'music.{k}', v) for k, v in pack.get('music', {}).items()]
    tracks += [(lv.get('name', '?'), lv['music']) for lv in pack['levels'] if isinstance(lv.get('music'), dict)]
    for where, t in tracks:
        c = t.get('chiptune')
        if not c:
            continue
        lens = {k: len(c[k].split()) for k in ('lead', 'harmony', 'bass', 'drums') if k in c}
        assert len(set(lens.values())) == 1, f'{where}: channel lengths differ {lens}'
        for k in ('lead', 'harmony', 'bass'):
            for tok in c.get(k, '').split():
                assert tok in '-.' or re.fullmatch(r'[A-G]#?-?\d', tok), f'{where}: bad note {tok}'
        print(f'  ok  {where}: {lens}')
