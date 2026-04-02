import { Card, Rarity } from './types';
import { QUALITY_RANGES } from './quality';

// ── Pack Tier System ─────────────────────────────────────────────────────────

export type PackTier = 'starter' | 'epic' | 'mythic' | 'default';

/**
 * Distribuicao de raridade por tier de pacote.
 * Cada pacote so pode gerar as raridades explicitamente listadas.
 * Probabilidades somam 100% por tier.
 */
const PACK_RARITY_WEIGHTS: Record<PackTier, Partial<Record<Rarity, number>>> = {
  starter: {
    Common:   60,
    Uncommon: 28,
    Rare:     12,
  },
  epic: {
    Common:    45,
    Uncommon:  30,
    Rare:      18,
    Epic:       5,
    Legendary:  2,
  },
  mythic: {
    Common:    30,
    Uncommon:  30,
    Rare:      22,
    Epic:      12,
    Legendary:  4.5,
    Mythic:     1,
    Hero:       0.5,
  },
  default: {
    Common:    60,
    Uncommon:  22,
    Rare:      10,
    Epic:       5,
    Legendary:  2,
    Mythic:     0.9,
    Hero:       0.1,
  },
};

/**
 * Detecta o tier do pacote a partir do nome, para selecionar a tabela correta.
 * Ordem de verificacao e importante: 'mythic' antes de 'epic'.
 */
export function detectPackTier(packName: string): PackTier {
  const lower = packName.toLowerCase();
  if (lower.includes('starter')) return 'starter';
  if (lower.includes('mythic')) return 'mythic';
  if (lower.includes('epic')) return 'epic';
  return 'default';
}

/**
 * Sorteia uma raridade usando pesos proporcionais do tier.
 * So raridades com peso > 0 sao elegiveis.
 */
function rollRarityForTier(tier: PackTier): Rarity {
  const weights = PACK_RARITY_WEIGHTS[tier];
  const entries = (Object.entries(weights) as [Rarity, number][]).filter(([, w]) => w > 0);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  const roll = Math.random() * total;
  let cumulative = 0;
  for (const [rarity, weight] of entries) {
    cumulative += weight;
    if (roll < cumulative) return rarity;
  }
  return entries[0][0];
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
 *
 * Fluxo:
 * 1) Determina o numero real de cartas (Mythic tem 20% de chance de 5a carta bonus).
 * 2) Para cada slot, sorteia raridade conforme a tabela do tier.
 * 3) Escolhe carta por dropWeight dentro da raridade sorteada.
 * 4) Fallback automatico se nao houver cartas disponiveis na raridade.
 *
 * - packTier: controla quais raridades podem aparecer e com qual frequencia.
 * - Nao afeta bonusRoll, fusion, combat ou mintId.
 */
export function rollCards(allCards: Card[], count: number, packTier: PackTier = 'default'): Card[] {
  const activeCards = allCards.filter(c => c.isActive);
  const result: Card[] = [];

  // Mythic Pack: 5a carta bonus — roll independente apos gerar as 4 base
  const actualCount = (packTier === 'mythic' && Math.random() < 0.20) ? count + 1 : count;

  // Raridades disponiveis no tier (para fallback ordenado)
  const tierRarities = Object.keys(PACK_RARITY_WEIGHTS[packTier]) as Rarity[];

  for (let i = 0; i < actualCount; i++) {
    let rarity = rollRarityForTier(packTier);
    let rarityCards = activeCards.filter(c => c.rarity === rarity);

    // Fallback 1: tenta outra raridade permitida pelo tier
    if (rarityCards.length === 0) {
      for (const fallback of tierRarities) {
        const fb = activeCards.filter(c => c.rarity === fallback);
        if (fb.length > 0) { rarityCards = fb; rarity = fallback; break; }
      }
    }

    // Fallback 2: qualquer carta ativa (se o inventario do admin estiver vazio)
    if (rarityCards.length === 0 && activeCards.length > 0) {
      rarityCards = activeCards;
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
