import { Card, Rarity } from './types';

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

// ── Mint System ─────────────────────────────────────────────────────────────

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
  // Base 5 digits prefix 
  return `BETA-${counter.toString().padStart(5, '0')}`;
}

/**
 * Calcula o bonusRoll da instancia com base em raridade e origem da carta.
 * - admin/legacy: sempre 0 (sem bonus aleatorio)
 * - pack/fusion: usa tabela min-max por raridade e origem
 * Retorna valor com 2 casas decimais.
 */
export function generateBonusRoll(rarity: Rarity, source: 'pack' | 'fusion' | 'admin' | 'legacy'): number {
  if (source === 'admin' || source === 'legacy') return 0;

  // Bonus Roll Table (Min, Max)
  const T = {
    pack: {
      Common: [0.00, 0.20],
      Uncommon: [0.00, 0.30],
      Rare: [0.00, 0.50],
      Epic: [0.00, 0.80],
      Legendary: [0.00, 1.00],
      Mythic: [0.00, 0.00], // Not obtainable via pack with bonus? Wait, table says "-"
      Hero: [0.00, 0.00],
    },
    fusion: {
      Common: [0.00, 0.00], // Not fusionable
      Uncommon: [0.10, 0.50],
      Rare: [0.20, 0.80],
      Epic: [0.40, 1.20],
      Legendary: [0.60, 1.80],
      Mythic: [0.80, 2.30],
      Hero: [1.00, 3.00],
    }
  };

  const [min, max] = T[source][rarity] || [0, 0];
  if (min === 0 && max === 0) return 0;

  let rand = Math.random();
  if (source === 'fusion') {
    // Reduce chance of Low Roll and increase High/Perfect by biasing random number
    rand = Math.pow(rand, 0.8);
  }
  
  const roll = min + rand * (max - min);
  return parseFloat(roll.toFixed(2));
}
