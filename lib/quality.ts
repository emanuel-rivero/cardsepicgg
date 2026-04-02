import { Rarity } from './types';

/**
 * Faixas de bônus para normalização de qualidade — cartas de PACK.
 * Também usadas como base de geração no cardGenerator.ts.
 */
export const QUALITY_RANGES: Record<Rarity, [number, number]> = {
  Common:    [0.00, 0.20],
  Uncommon:  [0.00, 0.30],
  Rare:      [0.00, 0.50],
  Epic:      [0.00, 0.80],
  Legendary: [0.00, 1.20],
  Mythic:    [0.00, 1.80],
  Hero:      [0.00, 3.00],
};

/**
 * Faixas de bônus ampliadas para normalização de cartas de FUSION.
 * Estas cartas historicamente recebiam valores maiores no sistema anterior,
 * e este range garante que a classificação de tiers seja justa para elas.
 */
export const QUALITY_RANGES_FUSION: Record<Rarity, [number, number]> = {
  Common:    [0.00, 0.20],  // Não fusionável, mantido por segurança
  Uncommon:  [0.00, 0.50],
  Rare:      [0.00, 0.80],
  Epic:      [0.00, 1.20],
  Legendary: [0.00, 1.80],
  Mythic:    [0.00, 2.30],
  Hero:      [0.00, 3.00],
};

export type RollQuality = 'Low Roll' | 'Good Roll' | 'High Roll' | 'Perfect Roll';

/**
 * Calcula a qualidade de um roll baseado no bônus, raridade e origem da carta.
 *
 * - source 'fusion': usa QUALITY_RANGES_FUSION (teto maior, histórico de fusão).
 * - demais origens: usa QUALITY_RANGES padrão (cartas de pack, admin, legacy).
 *
 * Isso corrige a classificação de cartas de fusão antigas que tinham valores
 * de bônus gerados em ranges maiores do que os tetos de pack.
 */
export function getRollQuality(
  bonusRoll: number,
  rarity: Rarity,
  source?: string,
): { 
  rollQuality: RollQuality; 
  rollQualityPercent: number;
} {
  const ranges = source === 'fusion' ? QUALITY_RANGES_FUSION : QUALITY_RANGES;
  const [min, max] = ranges[rarity] || [0, 0];
  
  if (max === 0) {
    return { rollQuality: 'Low Roll', rollQualityPercent: 0 };
  }

  // Normaliza e clampeia entre 0 e 1
  let percent = (bonusRoll - min) / (max - min);
  percent = Math.max(0, Math.min(1, percent));

  // Classifica pelo percentual
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
