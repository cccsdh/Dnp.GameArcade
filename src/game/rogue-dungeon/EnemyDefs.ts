import type { EnemyId } from '../../config';

export interface EnemyDef {
  id: EnemyId;
  name: string;
  hp: number;
  speed: number;
  damage: number;
  aggroRadius: number;
  attackRange: number;
  attackCooldown: number;
  contactDamage: number;
  goldDrop: [number, number];
}

export const ENEMY_DEFS: Record<EnemyId, EnemyDef> = {
  '1': {
    id: '1',
    name: 'Skulker',
    hp: 28,
    speed: 46,
    damage: 8,
    aggroRadius: 110,
    attackRange: 20,
    attackCooldown: 1100,
    contactDamage: 4,
    goldDrop: [1, 4],
  },
  '2': {
    id: '2',
    name: 'Stalker',
    hp: 22,
    speed: 62,
    damage: 6,
    aggroRadius: 130,
    attackRange: 18,
    attackCooldown: 900,
    contactDamage: 3,
    goldDrop: [1, 3],
  },
  '3': {
    id: '3',
    name: 'Brute',
    hp: 46,
    speed: 34,
    damage: 12,
    aggroRadius: 100,
    attackRange: 22,
    attackCooldown: 1400,
    contactDamage: 6,
    goldDrop: [2, 6],
  },
  '4': {
    id: '4',
    name: 'Wraith',
    hp: 34,
    speed: 50,
    damage: 10,
    aggroRadius: 140,
    attackRange: 20,
    attackCooldown: 1000,
    contactDamage: 5,
    goldDrop: [2, 5],
  },
};

export function enemyIdsForFloor(floor: number): EnemyId[] {
  if (floor <= 1) return ['1'];
  if (floor === 2) return ['1', '2'];
  if (floor === 3) return ['2', '3'];
  if (floor === 4) return ['2', '3', '4'];
  return ['3', '4'];
}
