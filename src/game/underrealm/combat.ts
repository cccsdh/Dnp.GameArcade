import { SPELLS, type MonsterDef, type SpellId } from './config';
import { armorOf, maxHp, skill, weaponOf, type Hero } from './hero';

/**
 * Turn-based encounters in the Alternate Reality mould: you pick an action,
 * it resolves, then the monster answers. Every roll is spelled out in the log.
 */

export type FightAction = 'attack' | 'charge' | 'parry' | 'trick' | 'offer' | 'flee' | 'potion' | `spell:${SpellId}`;

export type FightOutcome = 'continue' | 'won' | 'fled' | 'bribed' | 'dead';

export type FightSfx = 'hit' | 'miss' | 'hurt' | 'spell' | 'coins' | 'potion' | 'death' | 'kill';

export interface Fight {
  mon: MonsterDef;
  hp: number;
  maxHp: number;
  round: number;
  /** Rounds the monster is confused (skips its attack). */
  confused: number;
  /** Charging leaves you open: bonus to the monster's next attack. */
  exposed: boolean;
  /** Visual: how recently the monster was hit / attacked (for flashes). */
  monHitFlash: number;
  heroHitFlash: number;
  /** Visual: the monster lunging at you (1 = just attacked). */
  lunge: number;
  /** Toughening for meeting it deeper than its home levels. */
  hitBonus: number;
  dmgBonus: number;
  xpScale: number;
}

export interface TurnResult {
  lines: string[];
  outcome: FightOutcome;
  sfx: FightSfx[];
  xp?: number;
  gold?: number;
  loot?: 'potion';
}

const roll = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const chance = (pct: number) => Math.random() * 100 < pct;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** "the Skeleton" / "The Skeleton", but just "The Lich King" for names that carry their own article. */
function the(mon: MonsterDef, capital = false): string {
  if (/^the /i.test(mon.name)) return mon.name;
  return `${capital ? 'The' : 'the'} ${mon.name}`;
}

export function startFight(mon: MonsterDef, depth: number): Fight {
  // Met deeper than its home levels, a monster is tougher (and worth more).
  const home = mon.levels.length ? Math.min(...mon.levels) : depth;
  const delta = mon.special === 'boss' ? 0 : Math.max(0, depth - home);
  const hp = roll(mon.hp[0], mon.hp[1]) + delta * 4;
  return {
    mon,
    hp,
    maxHp: hp,
    round: 0,
    confused: 0,
    exposed: false,
    monHitFlash: 0,
    heroHitFlash: 0,
    lunge: 0,
    hitBonus: delta * 2,
    dmgBonus: Math.floor(delta / 2),
    xpScale: 1 + delta * 0.15,
  };
}

export function bribeCost(h: Hero, f: Fight): number {
  if (f.mon.bribe <= 0) return 0;
  const charm = clamp(1.45 - h.stats.CHR / 22, 0.6, 1.3);
  return Math.max(5, Math.round(f.mon.bribe * charm));
}

function heroHitChance(h: Hero, f: Fight): number {
  return clamp(58 + (skill(h) - 10) * 3 + h.level * 2 - f.mon.def * 4, 10, 95);
}

function heroDamage(h: Hero): number {
  const w = weaponOf(h);
  let d = roll(w.min, w.max) + Math.floor((h.stats.STR - 10) / 2);
  if (h.stats.STR < w.str) d -= 2;
  return Math.max(1, d);
}

function monsterAttack(h: Hero, f: Fight, parrying: boolean, r: TurnResult): void {
  if (f.confused > 0) {
    f.confused--;
    r.lines.push(`${the(f.mon, true)} stumbles about, confused.`);
    return;
  }
  const mon = f.mon;
  // The boss hurls a death bolt every third round, straight through armour.
  const bolt = mon.bolt ?? [8, 16];
  if (mon.special === 'boss' && f.round % 3 === 0 && bolt[1] > 0) {
    f.lunge = 1;
    const d = roll(bolt[0], bolt[1]);
    h.hp -= d;
    f.heroHitFlash = 1;
    r.sfx.push('hurt');
    r.lines.push(`${the(mon, true)} ${mon.boltText ?? 'hurls a death bolt'}! It burns for ${d}.`);
    return;
  }
  f.lunge = 1;
  const ac = armorOf(h).ac;
  let hit = 50 + mon.hit + f.hitBonus - ac * 4 - (skill(h) - 10) * 2;
  if (parrying) hit -= 18;
  if (f.exposed) hit += 15;
  f.exposed = false;
  if (!chance(clamp(hit, 5, 95))) {
    r.lines.push(parrying ? `You parry ${the(mon)}'s blow.` : `${the(mon, true)} misses you.`);
    r.sfx.push('miss');
    return;
  }
  let d = Math.max(1, roll(mon.dmg[0], mon.dmg[1]) + f.dmgBonus - Math.floor(ac / 3));
  if (parrying) d = Math.max(1, Math.floor(d / 2));
  h.hp -= d;
  f.heroHitFlash = 1;
  r.sfx.push('hurt');
  r.lines.push(`${the(mon, true)} hits you for ${d}.`);
  if (mon.special === 'poison' && !h.poisoned && chance(30)) {
    h.poisoned = true;
    r.lines.push('You have been poisoned!');
  }
  if (mon.special === 'drain' && chance(25)) {
    const lost = Math.min(h.xp, d * 4);
    h.xp -= lost;
    r.lines.push(`A deathly chill drains ${lost} experience!`);
  }
  if (mon.special === 'steal' && chance(30) && h.gold > 0) {
    const took = Math.max(1, Math.floor(h.gold * (0.15 + Math.random() * 0.2)));
    h.gold -= took;
    r.lines.push(`${the(mon, true)} snatches ${took} gold and bolts!`);
    r.outcome = 'fled';
  }
}

function win(h: Hero, f: Fight, r: TurnResult): void {
  const mon = f.mon;
  const gold = roll(mon.gold[0], mon.gold[1]);
  const xp = Math.round(mon.xp * f.xpScale);
  r.outcome = 'won';
  r.xp = xp;
  r.gold = gold;
  h.xp += xp;
  h.gold += gold;
  h.kills++;
  r.sfx.push('kill');
  r.lines.push(`${the(mon, true)} is slain!`, `You gain ${xp} experience${gold ? ` and ${gold} gold` : ''}.`);
  if (mon.special !== 'boss' && Math.random() < 0.14) {
    h.potions++;
    r.loot = 'potion';
    r.lines.push('It dropped a healing potion.');
  }
}

export function heroTurn(h: Hero, f: Fight, action: FightAction): TurnResult {
  const r: TurnResult = { lines: [], outcome: 'continue', sfx: [] };
  f.round++;
  const mon = f.mon;
  let parrying = false;
  let monsterActs = true;

  const strike = (mult: number, penalty: number) => {
    if (chance(heroHitChance(h, f) - penalty)) {
      const d = Math.round(heroDamage(h) * mult);
      f.hp -= d;
      f.monHitFlash = 1;
      r.sfx.push('hit');
      r.lines.push(`You hit ${the(mon)} for ${d}.`);
    } else {
      r.sfx.push('miss');
      r.lines.push(`You miss ${the(mon)}.`);
    }
  };

  switch (action) {
    case 'attack':
      strike(1, 0);
      break;
    case 'charge':
      strike(1.6, 12);
      f.exposed = true;
      break;
    case 'parry':
      parrying = true;
      r.lines.push('You raise your guard.');
      if (chance(20 + (skill(h) - 10) * 2)) {
        r.lines.push('...and see an opening!');
        strike(0.6, -10);
      }
      break;
    case 'potion':
      if (h.potions <= 0) {
        r.lines.push('You have no potions!');
        f.round--;
        return r;
      }
      h.potions--;
      {
        const heal = 15 + h.level * 3;
        h.hp = Math.min(maxHp(h), h.hp + heal);
        h.poisoned = false;
        r.sfx.push('potion');
        r.lines.push(`You gulp a potion and recover ${heal} hit points.`);
      }
      break;
    case 'trick': {
      const pct = clamp(28 + (h.stats.INT - 10) * 4 + mon.gullible * 45, 5, 90);
      if (chance(pct)) {
        if (Math.random() < 0.5 && mon.special !== 'boss') {
          r.lines.push(`You point behind ${the(mon)} and slip away while it looks!`);
          r.outcome = 'fled';
          return r;
        }
        f.confused = 2;
        monsterActs = false;
        r.lines.push(`Your feint leaves ${the(mon)} bewildered.`);
      } else {
        r.lines.push(`${the(mon, true)} isn't fooled.`);
      }
      break;
    }
    case 'offer': {
      const cost = bribeCost(h, f);
      if (cost === 0) {
        r.lines.push(`${the(mon, true)} has no use for gold!`);
      } else if (h.gold < cost) {
        r.lines.push(`${the(mon, true)} wants ${cost} gold - you don't have it.`);
      } else {
        h.gold -= cost;
        r.sfx.push('coins');
        r.lines.push(`You toss ${cost} gold. ${the(mon, true)} grabs it and leaves you be.`);
        r.outcome = 'bribed';
        return r;
      }
      break;
    }
    case 'flee': {
      const pct = clamp(42 + (skill(h) - 10) * 4 - mon.hit / 2 - (mon.special === 'boss' ? 30 : 0), 5, 90);
      if (chance(pct)) {
        r.lines.push('You turn and run - and get away!');
        r.outcome = 'fled';
        return r;
      }
      r.lines.push("You try to run, but can't get away!");
      break;
    }
    default: {
      const id = action.slice(6) as SpellId;
      const sp = SPELLS[id];
      if (!h.spells.includes(id) || h.mana < sp.cost) {
        r.lines.push("You don't have the mana for that.");
        f.round--;
        return r;
      }
      h.mana -= sp.cost;
      r.sfx.push('spell');
      if (id === 'firebolt') {
        const d = roll(6, 14) + Math.floor(h.stats.INT / 2) + h.level;
        f.hp -= d;
        f.monHitFlash = 1;
        r.lines.push(`A firebolt sears ${the(mon)} for ${d}!`);
      } else if (id === 'mend') {
        const heal = 10 + h.stats.WIS + h.level * 2;
        h.hp = Math.min(maxHp(h), h.hp + heal);
        r.lines.push(`Warm light mends ${heal} hit points.`);
      } else {
        r.lines.push('You blink out of sight and reappear well away.');
        r.outcome = 'fled';
        return r;
      }
    }
  }

  if (f.hp <= 0) {
    win(h, f, r);
    return r;
  }
  if (mon.special === 'regen' && f.hp < f.maxHp) {
    f.hp = Math.min(f.maxHp, f.hp + 3);
    r.lines.push(`${the(mon, true)}'s wounds knit back together.`);
  }
  if (monsterActs) monsterAttack(h, f, parrying, r);
  if (h.hp <= 0) {
    h.hp = 0;
    r.outcome = 'dead';
    r.sfx.push('death');
    r.lines.push('You collapse...');
  }
  return r;
}

/** When a monster gets the jump on you before you can act. */
export function ambush(h: Hero, f: Fight): TurnResult {
  const r: TurnResult = { lines: [], outcome: 'continue', sfx: [] };
  monsterAttack(h, f, false, r);
  if (h.hp <= 0) {
    h.hp = 0;
    r.outcome = 'dead';
    r.lines.push('You collapse...');
  }
  return r;
}
