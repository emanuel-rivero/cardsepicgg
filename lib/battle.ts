import { Rarity, BattleEvent, DuelOutcome } from "./types";
import { Card } from "./types";

export const RARITY_POWER: Record<Rarity, number> = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  Epic: 4,
  Legendary: 5,
  Mythic: 6,
  Hero: 7,
};

export type BattleTier =
  | 'Heavy Loss'
  | 'Close Loss'
  | 'Narrow Win'
  | 'Solid Win'
  | 'Crushing Win';

export interface BattleResult {
  duels: DuelOutcome[];
  playerWins: number;
  enemyWins: number;
  draws: number;
  totalPlayerPower: number;
  totalEnemyPower: number;
  isWin: boolean;
  tier: BattleTier;
}

/**
 * Calcula o resultado completo de uma batalha em formato duel-by-duel.
 *
 * Regras tecnicas:
 * - Cada slot do jogador enfrenta o slot correspondente do inimigo.
 * - O numero de duelos e o maximo entre slots do jogador e deck inimigo.
 * - Slot vazio vale poder 0.
 * - Poder do jogador = poder por raridade + bonusRoll da instancia (quando houver).
 * - Regras especiais de evento podem incrementar poder por tipo/raridade.
 *
 * Saida:
 * - Lista de duelos com vencedor por slot.
 * - Score agregado (wins/losses/draws, poder total).
 * - Tier final de desempenho para feedback de UX/recompensa.
 */
export function calculateDuelResult(
  playerSlots: (string | null)[],   // UserCard IDs (Instâncias únicas)
  enemyCardIds: string[],            // card IDs
  allCards: Card[],
  eventId: string,
  userCards?: import('./types').UserCard[]
): BattleResult {
  const cardById = new Map(allCards.map(c => [c.id, c]));
  const numDuels = Math.max(playerSlots.length, enemyCardIds.length);
  const duels: DuelOutcome[] = [];

  let playerWins = 0;
  let enemyWins = 0;
  let draws = 0;
  let totalPlayerPower = 0;
  let totalEnemyPower = 0;

  for (let i = 0; i < numDuels; i++) {
    const playerUcId = playerSlots[i] ?? null;
    const enemyCardId = enemyCardIds[i] ?? null;

    const playerUc = userCards?.find(uc => uc.id === playerUcId);
    let playerCardIdBase = playerUcId;
    if (playerUc) playerCardIdBase = playerUc.cardId;
    
    // Tratamos o Fallback se o ID arrastado não achar a instância (Legacy/Testes)
    const playerCard = playerCardIdBase ? cardById.get(playerCardIdBase) : undefined;
    const enemyCard = enemyCardId ? cardById.get(enemyCardId) : undefined;

    let playerPower = playerCard ? (RARITY_POWER[playerCard.rarity] ?? 0) + (playerUc?.bonusRoll || 0) : 0;
    const enemyPower = enemyCard ? (RARITY_POWER[enemyCard.rarity] ?? 0) : 0;

    // Apply special rules
    let specialRuleApplied: string | undefined;
    if (playerCard) {
      if (eventId === 'event_1' && playerCard.rarity === 'Rare') {
        playerPower += 1;
        specialRuleApplied = '+1 por Rara';
      }
      if (eventId === 'event_2' && (playerCard.type === 'Path of Subterfuge' || playerCard.type === 'Path of Wisdom')) {
        playerPower += 1;
        specialRuleApplied = '+1 por Subterfuge/Wisdom';
      }
      if (eventId === 'event_3' && playerCard.rarity === 'Hero') {
        playerPower += 2;
        specialRuleApplied = '+2 por Herói';
      }
      // Sho'grath: mercenários experientes (Rara+) recebem bônus de caçada
      if (eventId === 'event_4') {
        const rarityOrder: Rarity[] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Hero'];
        const isExperienced = rarityOrder.indexOf(playerCard.rarity) >= rarityOrder.indexOf('Rare');
        if (isExperienced) {
          playerPower += 1;
          specialRuleApplied = '+1 Mercenário Experiente';
        }
        // Bônus de caminho: Arms (veteranos de guerra) e Subterfuge (assassinos) são ideais contra orcs
        if (playerCard.type === 'Path of Arms' || playerCard.type === 'Path of Subterfuge') {
          playerPower += 1;
          specialRuleApplied = (specialRuleApplied ? specialRuleApplied + ' +1' : '+1') + ' vs Orcs';
        }
      }
    }

    totalPlayerPower += playerPower;
    totalEnemyPower += enemyPower;

    let winner: DuelOutcome['winner'];
    if (playerPower > enemyPower) { winner = 'player'; playerWins++; }
    else if (enemyPower > playerPower) { winner = 'enemy'; enemyWins++; }
    else { winner = 'draw'; draws++; }

    duels.push({
      slotIndex: i,
      playerCardId: playerCardIdBase,
      enemyCardId,
      playerPower: Number(playerPower.toFixed(2)),
      enemyPower: Number(enemyPower.toFixed(2)),
      winner,
      specialRuleApplied,
    });
  }

  const isWin = playerWins > enemyWins;
  const diff = playerWins - enemyWins;

  let tier: BattleTier;
  if (diff <= -3) tier = 'Heavy Loss';
  else if (diff === -2 || diff === -1) tier = 'Close Loss';
  else if (diff === 0 || diff === 1) tier = 'Narrow Win';
  else if (diff === 2 || diff === 3) tier = 'Solid Win';
  else tier = 'Crushing Win';

  return { duels, playerWins, enemyWins, draws, totalPlayerPower, totalEnemyPower, isWin, tier };
}

// ── Seed data for BATTLE_EVENTS ────────────────────────────────────────────
// This is used by db.ts to seed localStorage on first run.
// After seeding, admin manages events via localStorage CRUD.

export const SEED_BATTLE_EVENTS: Omit<BattleEvent, 'id'>[] = [
  {
    name: 'Guerra nas Ruínas de Aiglana',
    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=2068&auto=format&fit=crop',
    lore: 'Facções entram em conflito por território. Apenas os mais estratégicos dominarão as antigas pedras.',
    specialRule: '+1 poder por cada carta Rara utilizada.',
    reward: '1x Pacote Épico & 1000 Epic Points',
    enemyCards: ['u1', 'r2', 'u3', 'r4', 'e5'],
    revealedCount: 2,
    isActive: true,
  },
  {
    name: 'A Ameaça da Floresta dos Mortos',
    image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=2070&auto=format&fit=crop',
    lore: 'Criaturas nefastas vagam pelas sombras do bosque apodrecido. Sobreviva ao nevoeiro.',
    specialRule: '+1 poder para cartas de Facção Shadow ou Nature.',
    reward: '1x Pacote Legendário',
    enemyCards: ['c2', 'u3', 'r1', 'e1'],
    revealedCount: 1,
    isActive: true,
  },
  {
    name: 'Exploração na Caverna de Prata',
    image: 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?q=80&w=2076&auto=format&fit=crop',
    lore: 'O brilho das rochas preciosas cega aventureiros desavisados e atrai monstruosidades de cristal.',
    specialRule: '+2 poder por uso de carta Herói.',
    reward: '500 Epic Points',
    enemyCards: ['c1', 'u2', 'r3'],
    revealedCount: 2,
    isActive: true,
  },
  {
    name: "Caçada a Sho'grath, o Maldito",
    // Arte gerada para o servidor UO RP — boss orc bandit
    image: '/shograth-banner.png',
    lore: "[Aviso na Taverna do Canto Torto — Servidor Colhesol, Ultima Online RP]\n\nPor ordem do Conselho de Colhesol e apoio da Guilda dos Comerciantes do Oeste. RECOMPENSA EM OURO! Sho'grath, o Maldito, lidera saqueadores nas estradas do norte. Viajantes têm sido encontrados sem cabeça, empalados como aviso cruel ao longo da trilha entre Pedra-Funda e o Vale do Salgueiro. Orc de grande porte, pele acinzentada, olhos vermelhos. Carrega clava com crânios. Não se recomenda a solitários. Registrem-se com o Velho Galdor, todas as noites após o pôr do sol.",
    specialRule: '+1 poder por carta Rara ou superior (Mercenário Experiente). +1 adicional para facções Ancient ou Shadow (veteranos anti-orc). Bônus máximo cumulativo por carta.',
    reward: '500 Moedas de Ouro (Epic Points) + 1× Pacote Épico. Bônus se o bando for desmantelado (Vitória Esmagadora)!',
    // Deck do bando: bandidos primeiro, Sho'grath (boss Lendário) por último — quase todo oculto
    // c3=Ogre Brute, c2=Skeletal Footman, u3=Ash Wraith (xamã do clã), r1=Dark Sorceress (feiticeira aliada), l4=Demon Lord Baal [representa Sho'grath]
    enemyCards: ['c3', 'c2', 'u3', 'r1', 'l4'],
    revealedCount: 1, // Apenas o primeiro bandido é visível — Sho'grath e o resto ficam ocultos
    isActive: true,
  },
];

/**
 * Injeta eventos seed ausentes em uma lista ja persistida.
 *
 * Caracteristicas:
 * - Operacao idempotente para bootstrap/upgrade de dados.
 * - Apenas adiciona eventos faltantes; nao remove nem sobrescreve existentes.
 * - Mapeia seed por indice para id canonico no formato event_{n}.
 */
export function ensureNewSeedEvents(storedEvents: BattleEvent[]): BattleEvent[] {
  const toAdd: BattleEvent[] = [];
  SEED_BATTLE_EVENTS.forEach((seed, i) => {
    const expectedId = `event_${i + 1}`;
    if (!storedEvents.find(e => e.id === expectedId)) {
      toAdd.push({ ...seed, id: expectedId });
    }
  });
  return toAdd;
}

