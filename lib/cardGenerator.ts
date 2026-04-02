import { Card, Rarity } from './types';
import { QUALITY_RANGES } from './quality';

const RARITY_WEIGHTS: Record<Rarity, number> = {
  Common: 60,
  Uncommon: 22,
  Rare: 10,
  Epic: 5,
  Legendary: 2,
  Mythic: 0.9,
  Hero: 0.1,
};

/**
 * Sorteia uma raridade com base na distribuicao percentual configurada em RARITY_WEIGHTS.
 * O algoritmo acumula pesos ate ultrapassar um valor aleatorio em [0, 100).
 */
function rollRarity(): Rarity {
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS) as [Rarity, number][]) {
    cumulative += weight;
    if (roll < cumulative) return rarity;
  }
  return 'Common';
}

/**
 * Seleciona uma carta da lista usando peso relativo de dropWeight.
 * Quanto maior o dropWeight, maior a chance da carta ser retornada.
 */
function pickWeightedCard(cards: Card[]): Card {
  const totalWeight = cards.reduce((sum, c) => sum + c.dropWeight, 0);
  let roll = Math.random() * totalWeight;
  for (const card of cards) {
    roll -= card.dropWeight;
    if (roll <= 0) return card;
  }
  return cards[cards.length - 1];
}

/**
 * Gera um conjunto de cartas para abertura de pack.
 * Etapas:
 * 1) filtra cartas ativas;
 * 2) sorteia raridade por peso global;
 * 3) escolhe carta por dropWeight dentro da raridade;
 * 4) se uma raridade nao tiver cartas, aplica fallback para outras raridades disponiveis.
 */
export function rollCards(allCards: Card[], count: number): Card[] {
  const activeCards = allCards.filter((c) => c.isActive);
  const result: Card[] = [];

  for (let i = 0; i < count; i++) {
    let rarity = rollRarity();
    let rarityCards = activeCards.filter((c) => c.rarity === rarity);

    // Fallback to other rarities if none available
    if (rarityCards.length === 0) {
      const fallbackOrder: Rarity[] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Hero'];
      for (const fallback of fallbackOrder) {
        const fb = activeCards.filter((c) => c.rarity === fallback);
        if (fb.length > 0) {
          rarityCards = fb;
          rarity = fallback;
          break;
        }
      }
    }

    if (rarityCards.length > 0) {
      result.push(pickWeightedCard(rarityCards));
    }
  }

  return result;
}

// ── Mint System ──────────────────────────────────────────────────────────────

/**
 * Gera um serial visual incremental (Mint ID) persistido no localStorage.
 * Formato: BETA-00001.
 */
export function generateMintId(): string {
  if (typeof window === 'undefined') return `BETA-00000`;
  const KEY = 'epicgg_mint_counter';
  let counter = parseInt(localStorage.getItem(KEY) || '0', 10);
  counter += 1;
  localStorage.setItem(KEY, counter.toString());
  return `BETA-${counter.toString().padStart(5, '0')}`;
}

// ── Quality Tier Roll System ─────────────────────────────────────────────────

type QualityTier = 'low' | 'good' | 'high' | 'perfect';

/**
 * Distribuição de probabilidade de cada tier de qualidade por origem da carta.
 * Pack: concentrado em Low/Good. Fusion: melhores chances de High/Perfect.
 */
const QUALITY_DISTRIBUTION: Record<'pack' | 'fusion', Record<QualityTier, number>> = {
  pack:   { low: 45, good: 30, high: 20, perfect: 5  },
  fusion: { low: 30, good: 30, high: 25, perfect: 15 },
};

/**
 * Faixa percentual (0–1) associada a cada tier de qualidade.
 * Sincronizada com os limites de classificacao em lib/quality.ts.
 */
const TIER_PERCENT_RANGES: Record<QualityTier, [number, number]> = {
  low:     [0.00, 0.24],
  good:    [0.25, 0.59],
  high:    [0.60, 0.89],
  perfect: [0.90, 1.00],
};

/**
 * Sorteia o tier de qualidade usando distribuicao ponderada por origem.
 */
function rollQualityTier(source: 'pack' | 'fusion'): QualityTier {
  const weights = QUALITY_DISTRIBUTION[source];
  const rand = Math.random() * 100;
  let cumulative = 0;
  for (const [tier, weight] of Object.entries(weights) as [QualityTier, number][]) {
    cumulative += weight;
    if (rand < cumulative) return tier;
  }
  return 'low';
}

/**
 * Calcula o bonusRoll da instancia com base em raridade e origem da carta.
 *
 * Fluxo de dois passos:
 * 1) Sorteia o tier de qualidade (Low/Good/High/Perfect) conforme distribuicao da origem.
 * 2) Gera um valor de bonus aleatorio dentro da faixa percentual daquele tier,
 *    normalizado pelo bonus maximo da raridade (QUALITY_RANGES).
 *
 * - admin/legacy: sempre retorna 0.
 * - Garante que a frequencia de cada tier respeita exatamente as probabilidades definidas.
 */
export function generateBonusRoll(rarity: Rarity, source: 'pack' | 'fusion' | 'admin' | 'legacy'): number {
  if (source === 'admin' || source === 'legacy') return 0;

  const maxBonus = QUALITY_RANGES[rarity][1];
  if (maxBonus === 0) return 0;

  // Step 1: Sorteio do tier de qualidade com pesos por origem
  const tier = rollQualityTier(source);

  // Step 2: Valor percentual aleatorio dentro da faixa do tier
  const [percentMin, percentMax] = TIER_PERCENT_RANGES[tier];
  const percent = percentMin + Math.random() * (percentMax - percentMin);

  // Step 3: Converte percentual em valor absoluto de bonus
  const roll = percent * maxBonus;
  return parseFloat(roll.toFixed(2));
}
