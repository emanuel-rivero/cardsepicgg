import { Rarity } from './types';

/**
 * Faixas de bônus oficial para normalização de qualidade.
 * Baseado na solicitação do usuário para classificação visual.
 */
export const QUALITY_RANGES: Record<Rarity, [number, number]> = {
  Common: [0.00, 0.20],
  Uncommon: [0.00, 0.30],
  Rare: [0.00, 0.50],
  Epic: [0.00, 0.80],
  Legendary: [0.00, 1.20],
  Mythic: [0.00, 1.80],
  Hero: [0.00, 3.00],
};

export type RollQuality = 'Low Roll' | 'Good Roll' | 'High Roll' | 'Perfect Roll';

/**
 * Calcula a qualidade de um roll baseado no bônus e raridade.
 * Retorna o texto da classificação e o percentual normalizado (0 a 1).
 */
export function getRollQuality(bonusRoll: number, rarity: Rarity): { 
  rollQuality: RollQuality; 
  rollQualityPercent: number;
} {
  const [min, max] = QUALITY_RANGES[rarity] || [0, 0];
  
  if (max === 0) {
    return { rollQuality: 'Low Roll', rollQualityPercent: 0 };
  }

  // Step 2: Normalize and Clamp
  let percent = (bonusRoll - min) / (max - min);
  percent = Math.max(0, Math.min(1, percent));

  // Step 3: Classify
  let quality: RollQuality = 'Low Roll';
  if (percent >= 0.90) {
    quality = 'Perfect Roll';
  } else if (percent >= 0.60) {
    quality = 'High Roll';
  } else if (percent >= 0.25) {
    quality = 'Good Roll';
  }

  return {
    rollQuality: quality,
    rollQualityPercent: percent,
  };
}
