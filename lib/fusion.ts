import { Rarity, Card } from './types';

export type FusionTier = {
  sourceRarity: Rarity;
  targetRarity: Rarity;
  requiredCount: number;
  baseChance: number; // 1.0 = guaranteed, 0.9 = 90%, etc.
  isGuaranteed: boolean;
  afpReward: number; // AFP earned on success
};

export const FUSION_TIERS: FusionTier[] = [
  {
    sourceRarity: 'Common',
    targetRarity: 'Uncommon',
    requiredCount: 5,
    baseChance: 1.0,
    isGuaranteed: true,
    afpReward: 1,
  },
  {
    sourceRarity: 'Uncommon',
    targetRarity: 'Rare',
    requiredCount: 3,
    baseChance: 1.0,
    isGuaranteed: true,
    afpReward: 2,
  },
  {
    sourceRarity: 'Rare',
    targetRarity: 'Epic',
    requiredCount: 3,
    baseChance: 0.9,
    isGuaranteed: false,
    afpReward: 3,
  },
  {
    sourceRarity: 'Epic',
    targetRarity: 'Legendary',
    requiredCount: 2,
    baseChance: 0.8,
    isGuaranteed: false,
    afpReward: 5,
  },
  {
    sourceRarity: 'Legendary',
    targetRarity: 'Mythic',
    requiredCount: 2,
    baseChance: 0.7,
    isGuaranteed: false,
    afpReward: 8,
  },
  {
    sourceRarity: 'Mythic',
    targetRarity: 'Hero',
    requiredCount: 2,
    baseChance: 0.5,
    isGuaranteed: false,
    afpReward: 12,
  },
];

export const FUSION_BY_SOURCE: Record<string, FusionTier> = Object.fromEntries(
  FUSION_TIERS.map((t) => [t.sourceRarity, t])
);

export const AFP_FAILURE_REWARD = 5;
export const AFP_PER_CHANCE = 0.02; // +2% per AFP
export const AFP_MAX_CHANCE = 0.95; // 95% cap

/** Calculate the final success chance after AFP spending */
export function calcFinalChance(baseChance: number, afpSpent: number): number {
  if (baseChance >= 1.0) return 1.0;
  const bonus = afpSpent * AFP_PER_CHANCE;
  return Math.min(AFP_MAX_CHANCE, baseChance + bonus);
}

/** Roll the fusion — returns true for success */
export function rollFusion(finalChance: number): boolean {
  return Math.random() < finalChance;
}

/** Pick a random active card of the target rarity from the global card pool */
export function getRandomCardByRarity(allCards: Card[], rarity: Rarity): Card | null {
  const pool = allCards.filter((c) => c.isActive && c.rarity === rarity);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export const RARITY_ORDER: Rarity[] = [
  'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Hero',
];

export const RARITY_COLORS: Record<string, string> = {
  Common: '#8a97ab',
  Uncommon: '#2ecc71',
  Rare: '#4a9eff',
  Epic: '#c062f0',
  Legendary: '#d4af37',
  Mythic: '#ff4757',
  Hero: '#00d2d3',
};

export const RARITY_GLOWS: Record<string, string> = {
  Common: 'rgba(138,151,171,0.5)',
  Uncommon: 'rgba(46,204,113,0.6)',
  Rare: 'rgba(74,158,255,0.6)',
  Epic: 'rgba(192,98,240,0.7)',
  Legendary: 'rgba(212,175,55,0.8)',
  Mythic: 'rgba(255,71,87,0.8)',
  Hero: 'rgba(0,210,211,0.9)',
};
