// Card and monster data, matching the printable deck.
import type { ArtId, DieKind, EnemyArtId } from './art';

export type Free = 'dog' | 'clover' | 'shield' | 'potion';

export interface HeroDef {
  art: ArtId;
  /** Dice rolled when played as an attack. */
  roll?: DieKind[];
  /** Free cards are played any time and don't count as an attack. */
  free?: Free;
  count: number;
}

export type Special = 'mimic' | 'ghost' | 'troll' | 'golem';

export interface EnemyDef {
  art: EnemyArtId;
  /** 1 easy – 3 hard. */
  rank: 1 | 2 | 3;
  /** Roll this much or more to win. */
  power: number;
  /** Hearts lost on a miss. */
  hits: number;
  special?: Special;
}

export const HERO: HeroDef[] = [
  { art: 'sword', roll: ['w', 'w'], count: 6 },
  { art: 'bigsword', roll: ['w', 'w', 'w'], count: 4 },
  { art: 'axe', roll: ['w', 'w', 'w', 'w'], count: 2 },
  { art: 'bow', roll: ['g', 'g'], count: 3 },
  { art: 'wand', roll: ['p'], count: 4 },
  { art: 'fireball', roll: ['p', 'w', 'w'], count: 2 },
  { art: 'mega', roll: ['w', 'w', 'w', 'w', 'w', 'w'], count: 1 },
  { art: 'dog', free: 'dog', count: 2 },
  { art: 'clover', free: 'clover', count: 2 },
  { art: 'shield', free: 'shield', count: 2 },
  { art: 'potion', free: 'potion', count: 2 },
];

export const ENEMY: EnemyDef[] = [
  { art: 'rat', rank: 1, power: 6, hits: 1 },
  { art: 'bat', rank: 1, power: 7, hits: 1 },
  { art: 'slime', rank: 1, power: 8, hits: 1 },
  { art: 'goblin', rank: 1, power: 9, hits: 1 },
  { art: 'spider', rank: 2, power: 11, hits: 1 },
  { art: 'skeleton', rank: 2, power: 12, hits: 2 },
  { art: 'mimic', rank: 2, power: 13, hits: 1, special: 'mimic' },
  { art: 'ghost', rank: 2, power: 13, hits: 1, special: 'ghost' },
  { art: 'orc', rank: 3, power: 15, hits: 2 },
  { art: 'troll', rank: 3, power: 17, hits: 2, special: 'troll' },
  { art: 'golem', rank: 3, power: 19, hits: 2, special: 'golem' },
];

export const MAX_HEARTS = 10;
export const DRAGON_HP = 60;
export const HAND_SIZE = 4;
export const HAND_MAX = 6;
/** Solo play: up to 2 attack cards per turn. */
export const MAX_ATTACKS = 2;

export type DragonMove = 'snore' | 'claw' | 'tail' | 'fire' | 'snack' | 'roar';

/** Red d20 → what the Dragon does. */
export function dragonMove(roll: number): DragonMove {
  if (roll <= 5) return 'snore';
  if (roll <= 10) return 'claw';
  if (roll <= 14) return 'tail';
  if (roll <= 17) return 'fire';
  if (roll <= 19) return 'snack';
  return 'roar';
}

/** Green die → Dragon power multiplier. */
export const dragonPower = (g: number) => (g >= 6 ? 3 : g >= 4 ? 2 : 1);

const shuffle = <T>(a: T[]) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export { shuffle };

/** Short: 2 one-skull, 2 two-skull, 1 three-skull. Long: all of them. Easiest first. */
export function buildDungeon(long: boolean): EnemyDef[] {
  if (long) return [...ENEMY];
  const of = (r: number, n: number) => shuffle(ENEMY.filter((e) => e.rank === r)).slice(0, n).sort((a, b) => a.power - b.power);
  return [...of(1, 2), ...of(2, 2), ...of(3, 1)];
}
