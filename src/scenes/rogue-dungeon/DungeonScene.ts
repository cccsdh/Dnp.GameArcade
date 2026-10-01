import Phaser from 'phaser';
import {
  DEPTH,
  DUNGEON_HEIGHT,
  DUNGEON_WIDTH,
  FLOOR_TILES,
  MAX_FLOOR,
  TILE,
  WALL_TILES,
  type EnemyId,
  type HeroId,
} from '../../config';
import { generateDungeon, randomFloorTileInRoom } from '../../game/rogue-dungeon/dungeon/generate';
import { Cell, type Dungeon, type Room, roomCenter } from '../../game/rogue-dungeon/dungeon/types';
import { Player, PLAYER_EVENTS, type PlayerStats } from '../../game/rogue-dungeon/entities/Player';
import { Enemy, ENEMY_EVENTS, type EnemyDiedPayload } from '../../game/rogue-dungeon/entities/Enemy';
import { ENEMY_DEFS, enemyIdsForFloor } from '../../game/rogue-dungeon/EnemyDefs';
import { Pickup } from '../../game/rogue-dungeon/Pickup';
import { Chest, Door, Spikes, Torch, Trapdoor } from '../../game/rogue-dungeon/Props';
import { setPadProfile } from '../../game/shared/Pad';
import { ROGUE_PAD } from '../../game/shared/PadProfiles';
import { SoundManager } from '../../game/shared/Sound';

export interface DungeonInitData {
  heroId: HeroId;
  floor: number;
  carryStats: { hp: number; maxHp: number; gold: number; potions: number } | null;
}

const DECOR_KEYS = [
  'decor_Box1', 'decor_Box2', 'decor_Box3',
  'decor_Table1', 'decor_Table2',
  'decor_Chair1', 'decor_Chair2',
  'decor_Bookshelf1', 'decor_Bookshelf2',
  'decor_Rubble1', 'decor_Rubble2',
  'decor_Torch1', 'decor_Torch2',
];

export class DungeonScene extends Phaser.Scene {
  private heroId!: HeroId;
  private floor!: number;
  private carryStats: DungeonInitData['carryStats'] = null;

  private dungeon!: Dungeon;
  private wallLayer!: Phaser.Tilemaps.TilemapLayer;
  private player!: Player;
  private enemies: Enemy[] = [];
  private chests: Chest[] = [];
  private doors: Door[] = [];
  private spikesList: Spikes[] = [];
  private spikeCooldown = new Map<Spikes, number>();
  private trapdoor: Trapdoor | null = null;
  private sfx!: SoundManager;

  constructor() {
    super('Dungeon');
  }

  init(data: DungeonInitData): void {
    this.heroId = data.heroId;
    this.floor = data.floor;
    this.carryStats = data.carryStats;
    this.enemies = [];
    this.chests = [];
    this.doors = [];
    this.spikesList = [];
    this.spikeCooldown = new Map();
    this.trapdoor = null;
  }

  create(): void {
    this.sfx = new SoundManager(this);
    this.sfx.playMusic('dungeon');

    this.dungeon = generateDungeon({
      width: DUNGEON_WIDTH,
      height: DUNGEON_HEIGHT,
      maxRooms: Math.min(16, 9 + this.floor),
    });

    this.buildTilemap();

    const startRoom = this.dungeon.rooms[0];
    const start = roomCenter(startRoom);
    this.player = new Player(this, start.x * TILE + TILE / 2, start.y * TILE + TILE / 2, this.heroId, this.sfx);
    if (this.carryStats) {
      this.player.maxHp = this.carryStats.maxHp;
      this.player.hp = this.carryStats.hp;
      this.player.gold = this.carryStats.gold;
      this.player.potions = this.carryStats.potions;
    }
    this.player.onRequestHit = (x, y, _dir, range) => this.handlePlayerHit(x, y, range);

    this.physics.add.collider(this.player, this.wallLayer);

    this.populateRooms(startRoom);

    const worldW = this.dungeon.width * TILE;
    const worldH = this.dungeon.height * TILE;
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setZoom(3);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setRoundPixels(true);

    this.game.events.emit('floor-changed', this.floor);
    this.forwardPlayerEvents();

    this.input.keyboard!.on('keydown-Q', () => this.player.usePotion());
    setPadProfile(this, ROGUE_PAD);

    this.scene.launch('HUD');
  }

  private forwardPlayerEvents(): void {
    this.events.on(PLAYER_EVENTS.stats, (stats: PlayerStats) => this.game.events.emit(PLAYER_EVENTS.stats, stats));
    this.events.on(PLAYER_EVENTS.died, () => {
      this.time.delayedCall(1400, () => {
        this.scene.stop('HUD');
        this.scene.start('GameOver', { victory: false, floor: this.floor, gold: this.player.gold });
      });
    });
    this.events.on(ENEMY_EVENTS.died, (payload: EnemyDiedPayload) => {
      this.player.addGold(payload.goldDrop);
      this.enemies = this.enemies.filter((e) => e !== payload.enemy);
    });
    // Emit once immediately so the HUD has correct starting values.
    this.events.emit(PLAYER_EVENTS.stats, {
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      gold: this.player.gold,
      potions: this.player.potions,
    } as PlayerStats);
  }

  private buildTilemap(): void {
    const data: number[][] = [];
    for (let y = 0; y < this.dungeon.height; y++) {
      const row: number[] = [];
      for (let x = 0; x < this.dungeon.width; x++) {
        const isWall = this.dungeon.grid[y][x] === Cell.Wall;
        const palette = isWall ? WALL_TILES : FLOOR_TILES;
        row.push(palette[Math.floor(Math.random() * palette.length)]);
      }
      data.push(row);
    }
    const map = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('dungeon', 'tileset', TILE, TILE, 0, 0)!;
    const layer = map.createLayer(0, tileset, 0, 0)!;
    layer.setCollision(WALL_TILES);
    layer.setDepth(DEPTH.floor);
    this.wallLayer = layer;
  }

  private populateRooms(startRoom: Room): void {
    const rooms = this.dungeon.rooms;
    const others = rooms.filter((r) => r !== startRoom);
    if (others.length === 0) return;

    const start = roomCenter(startRoom);
    let farthest = others[0];
    let bestDist = -1;
    for (const r of others) {
      const c = roomCenter(r);
      const d = Phaser.Math.Distance.Between(start.x, start.y, c.x, c.y);
      if (d > bestDist) {
        bestDist = d;
        farthest = r;
      }
    }
    const exit = roomCenter(farthest);
    this.trapdoor = new Trapdoor(this, exit.x * TILE + TILE / 2, exit.y * TILE + TILE / 2);

    const chestRoom = others[Phaser.Math.Between(0, others.length - 1)];
    this.spawnChest(chestRoom, farthest === chestRoom);
    if (this.floor >= 3 && others.length > 2) {
      const secondChestRoom = Phaser.Utils.Array.GetRandom(others.filter((r) => r !== chestRoom));
      this.spawnChest(secondChestRoom, farthest === secondChestRoom);
    }

    const pool = enemyIdsForFloor(this.floor);
    const enemyCount = Math.min(14, 3 + this.floor * 2);
    for (let i = 0; i < enemyCount; i++) {
      const room = Phaser.Utils.Array.GetRandom(others);
      const id = Phaser.Utils.Array.GetRandom(pool);
      this.spawnEnemy(room, id);
    }

    const goldCount = 4 + rooms.length;
    for (let i = 0; i < goldCount; i++) {
      const room = Phaser.Utils.Array.GetRandom(others);
      const pos = randomFloorTileInRoom(room);
      new Pickup(this, pos.x * TILE + TILE / 2, pos.y * TILE + TILE / 2, 'gold', Phaser.Math.Between(1, 5));
    }
    const potionCount = 1 + Math.floor(others.length / 3);
    for (let i = 0; i < potionCount; i++) {
      const room = Phaser.Utils.Array.GetRandom(others);
      const pos = randomFloorTileInRoom(room);
      new Pickup(this, pos.x * TILE + TILE / 2, pos.y * TILE + TILE / 2, 'potion', 1);
    }

    for (const room of rooms) {
      this.decorateRoom(room);
    }

    this.spawnSpikeTraps(3 + Math.floor(this.floor / 2));

    this.physics.add.overlap(this.player, this.getPickupGroup(), (_p, pickup) => this.collectPickup(pickup as Pickup));
    this.physics.add.overlap(this.player, this.chests, (_p, chest) => (chest as Chest).open());
  }

  private spawnEnemy(room: Room, id: EnemyId): void {
    const pos = randomFloorTileInRoom(room);
    const difficultyScale = 1 + (this.floor - 1) * 0.18;
    const enemy = new Enemy(
      this,
      pos.x * TILE + TILE / 2,
      pos.y * TILE + TILE / 2,
      ENEMY_DEFS[id],
      this.player,
      this.sfx,
      difficultyScale,
    );
    this.physics.add.collider(enemy, this.wallLayer);
    this.physics.add.collider(enemy, this.player);
    this.enemies.push(enemy);
  }

  private spawnChest(room: Room, isExitRoom: boolean): void {
    const pos = randomFloorTileInRoom(room);
    const variant = Math.random() < 0.5 ? 1 : 2;
    const chest = new Chest(this, pos.x * TILE + TILE / 2, pos.y * TILE + TILE / 2, variant);
    chest.on('animationcomplete', () => {
      const reward = variant === 2 || isExitRoom ? Phaser.Math.Between(8, 16) : Phaser.Math.Between(3, 8);
      this.player.addGold(reward);
      if (Math.random() < 0.5) this.player.addPotion(1);
      this.sfx.play('chestOpen');
    });
    this.chests.push(chest);
  }

  private spawnSpikeTraps(count: number): void {
    const corridorTiles: { x: number; y: number }[] = [];
    for (let y = 1; y < this.dungeon.height - 1; y++) {
      for (let x = 1; x < this.dungeon.width - 1; x++) {
        if (this.dungeon.grid[y][x] !== Cell.Floor) continue;
        const inRoom = this.dungeon.rooms.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
        if (!inRoom) corridorTiles.push({ x, y });
      }
    }
    Phaser.Utils.Array.Shuffle(corridorTiles);
    for (let i = 0; i < Math.min(count, corridorTiles.length); i++) {
      const t = corridorTiles[i];
      const spikes = new Spikes(this, t.x * TILE + TILE / 2, t.y * TILE + TILE / 2);
      this.spikesList.push(spikes);
    }
    if (this.spikesList.length > 0) {
      this.physics.add.overlap(this.player, this.spikesList, (_p, s) => this.handleSpikeOverlap(s as Spikes));
    }
  }

  private decorateRoom(room: Room): void {
    const doorChance = 0.35;
    if (Math.random() < doorChance && room.w >= 5) {
      const big = Math.random() < 0.3;
      this.doors.push(new Door(this, (room.x + Math.floor(room.w / 2)) * TILE + TILE / 2, room.y * TILE, big));
    }
    if (Math.random() < 0.5) {
      new Torch(this, (room.x + 1) * TILE + TILE / 2, room.y * TILE);
    }
    if (Math.random() < 0.5) {
      new Torch(this, (room.x + room.w - 2) * TILE + TILE / 2, room.y * TILE);
    }
    const decorCount = Phaser.Math.Between(0, 2);
    for (let i = 0; i < decorCount; i++) {
      const pos = randomFloorTileInRoom(room);
      const key = Phaser.Utils.Array.GetRandom(DECOR_KEYS);
      const decor = this.add.image(pos.x * TILE + TILE / 2, pos.y * TILE + TILE / 2, key);
      decor.setDepth(DEPTH.decor);
    }
  }

  private getPickupGroup(): Pickup[] {
    return (this.children.list.filter((c) => c instanceof Pickup) as Pickup[]);
  }

  private collectPickup(pickup: Pickup): void {
    if (!pickup.active) return;
    if (pickup.kind === 'gold') this.player.addGold(pickup.amount);
    else this.player.addPotion(pickup.amount);
    pickup.destroy();
  }

  private handleSpikeOverlap(spikes: Spikes): void {
    const now = this.time.now;
    const last = this.spikeCooldown.get(spikes) ?? -Infinity;
    if (now - last < 650) return;
    this.spikeCooldown.set(spikes, now);
    this.player.takeDamage(6, now);
    this.sfx.play('trapHit');
  }

  private handlePlayerHit(x: number, y: number, range: number): void {
    for (const enemy of this.enemies) {
      if (enemy.isDead) continue;
      const d = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (d <= range) {
        enemy.takeDamage(18 + Math.floor(this.floor * 0.5));
        this.spawnBlood(enemy.x, enemy.y);
      }
    }
  }

  private spawnBlood(x: number, y: number): void {
    const fx = this.add.sprite(x, y, 'fx_D_Blood');
    fx.setDepth(DEPTH.entityFx);
    fx.play('fx-blood');
    fx.once('animationcomplete', () => fx.destroy());
  }

  private descend(): void {
    this.sfx.play('stairsDescend');
    const nextFloor = this.floor + 1;
    const carry = { hp: this.player.hp, maxHp: this.player.maxHp, gold: this.player.gold, potions: this.player.potions };
    this.scene.stop('HUD');
    if (nextFloor > MAX_FLOOR) {
      this.scene.start('GameOver', { victory: true, floor: this.floor, gold: this.player.gold });
      return;
    }
    this.scene.start('Dungeon', { heroId: this.heroId, floor: nextFloor, carryStats: carry });
  }

  update(time: number): void {
    if (!this.player || this.player.isDead) return;
    this.player.update(time);

    for (const enemy of this.enemies) {
      enemy.update(time, (x, y, range, damage) => {
        const d = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y);
        if (d <= range) this.player.takeDamage(damage, time);
      });
    }

    for (const door of this.doors) door.updateProximity(this.player.x, this.player.y);

    if (this.trapdoor) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.trapdoor.x, this.trapdoor.y);
      if (d < 10) this.descend();
    }
  }
}
