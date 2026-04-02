/**
 * Pity Timer System — Garantia de raridade por falta de sorte.
 *
 * Funcionamento:
 * - Cada pack tier rastreia contadores por raridade no registro do usuario.
 * - Apos cada abertura de pack, contadores de raridades NAO obtidas sao incrementados.
 * - Se um contador atingir o threshold, o proximo pack garante aquela raridade silenciosamente.
 * - Pity e invisivel ao jogador — sem UI, sem indicador.
 *
 * Nao modifica: drop rates, bonusRoll, fusion, combat, mintId.
 */

import { Rarity, Card } from './types';
import { PackTier } from './cardGenerator';

// ── Thresholds ────────────────────────────────────────────────────────────────

/**
 * Numero de packs consecutivos sem obter aquela raridade
 * que aciona a garantia automatica.
 */
export const PITY_THRESHOLDS: Partial<Record<PackTier, Partial<Record<Rarity, number>>>> = {
  starter: {
    Rare: 10,
  },
  epic: {
    Epic:      20,
    Legendary: 40,
  },
  mythic: {
    Legendary: 15,
    Mythic:    30,
  },
};

/**
 * Chave no registro do usuario para cada contador de pity.
 * Mantidos como campos opcionais no User para persistencia via localStorage.
 */
export const PITY_KEYS: Partial<Record<PackTier, Partial<Record<Rarity, string>>>> = {
  starter: { Rare:      'pity_starter_rare'      },
  epic:    { Epic:      'pity_epic_epic',
             Legendary: 'pity_epic_legendary'     },
  mythic:  { Legendary: 'pity_mythic_legendary',
             Mythic:    'pity_mythic_mythic'      },
};

// ── Rarity ordering ───────────────────────────────────────────────────────────

const RARITY_ORDER: Rarity[] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Hero'];

export function rarityIndex(r: Rarity): number {
  return RARITY_ORDER.indexOf(r);
}

/**
 * Retorna true se a carta satisfaz (ou supera) a raridade alvo do pity counter.
 * Ex: uma Legendary satisfaz o pity de Rare, Epic e Legendary.
 */
export function satisfiesPityRarity(card: Card, targetRarity: Rarity): boolean {
  return rarityIndex(card.rarity) >= rarityIndex(targetRarity);
}

// ── Pity state helpers ────────────────────────────────────────────────────────

export type UserPityData = Record<string, number>;

/**
 * Extrai os contadores de pity relevantes do registro do usuario.
 */
export function extractPityData(user: Record<string, unknown>): UserPityData {
  const keys = [
    'pity_starter_rare',
    'pity_epic_epic',
    'pity_epic_legendary',
    'pity_mythic_legendary',
    'pity_mythic_mythic',
  ];
  const data: UserPityData = {};
  for (const key of keys) {
    data[key] = typeof user[key] === 'number' ? (user[key] as number) : 0;
  }
  return data;
}

/**
 * Retorna as raridades cujo pity counter atingiu o threshold para este pack tier.
 * Ordenadas do mais raro para o menos raro (Mythic > Legendary > ...) para garantir
 * que pities de maior raridade sao aplicados primeiro quando multiplos disparam.
 */
export function getTriggeredPities(pityData: UserPityData, packTier: PackTier): Rarity[] {
  const thresholds = PITY_THRESHOLDS[packTier];
  const keys = PITY_KEYS[packTier];
  if (!thresholds || !keys) return [];

  const triggered: Rarity[] = [];
  for (const [rarity, threshold] of Object.entries(thresholds) as [Rarity, number][]) {
    const key = keys[rarity];
    if (key && (pityData[key] || 0) >= threshold) {
      triggered.push(rarity);
    }
  }

  // Sort highest rarity first so the most valuable pity slot is guaranteed first
  return triggered.sort((a, b) => rarityIndex(b) - rarityIndex(a));
}

/**
 * Calcula os novos valores dos contadores apos uma abertura de pack.
 *
 * - Se alguma carta obtida satisfaz o pity de uma raridade: reseta o contador para 0.
 * - Se nenhuma carta satisfaz: incrementa o contador em +1.
 *
 * Retorna um objeto parcial com apenas as chaves alteradas para uso em db.users.update().
 */
export function calculateUpdatedPityCounters(
  pityData: UserPityData,
  packTier: PackTier,
  droppedCards: Card[],
): Partial<UserPityData> {
  const thresholds = PITY_THRESHOLDS[packTier];
  const keys = PITY_KEYS[packTier];
  if (!thresholds || !keys) return {};

  const updates: Partial<UserPityData> = {};

  for (const [rarity] of Object.entries(thresholds) as [Rarity, number][]) {
    const key = keys[rarity];
    if (!key) continue;

    const satisfied = droppedCards.some(c => satisfiesPityRarity(c, rarity));
    updates[key] = satisfied ? 0 : (pityData[key] || 0) + 1;
  }

  return updates;
}

/**
 * Pega uma carta aleatoria da lista de cartas ativas com a raridade exata solicitada.
 * Usa dropWeight para selecao ponderada, assim como o sistema normal de geracao.
 * Retorna null se nenhuma carta daquela raridade estiver disponivel.
 */
export function forcePityCard(activeCards: Card[], targetRarity: Rarity): Card | null {
  const pool = activeCards.filter(c => c.rarity === targetRarity && c.isActive);
  if (pool.length === 0) return null;

  const totalWeight = pool.reduce((sum, c) => sum + c.dropWeight, 0);
  let roll = Math.random() * totalWeight;
  for (const card of pool) {
    roll -= card.dropWeight;
    if (roll <= 0) return card;
  }
  return pool[pool.length - 1];
}
