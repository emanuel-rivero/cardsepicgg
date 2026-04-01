export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic' | 'Hero';
export type CardType = 'Path of Arms' | 'Path of Wisdom' | 'Path of Subterfuge' | 'Enemy' | 'NPC' | 'Gods' | 'Quest';
export type CardClass = 
  | 'Archer' | 'Hunter' | 'Fighter' | 'Defender' | 'Paladin' | 'Barbarian' | 'Mutant' // Arms
  | 'Necromant' | 'Druid' | 'Magus' | 'Arcane Blade' | 'Grenadier' | 'Cleric' // Wisdom
  | 'Arcane Trickster' | 'Treasure Hunter' | 'Assassin' | 'Vivisectionist' | 'Fencer' | 'Thief' | 'Bard' | 'Shadow Dancer' | 'Demon Hunter' // Subterfuge
  | 'None';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  isAdmin: boolean;
  createdAt: string;
  epicPoints: number;
  coins: number;
  afp: number;
  lastLoginDate?: string;
  packsOpenedAllTime: number;
  hasClaimed5PacksBonus?: boolean;
  hasClaimed10PacksBonus?: boolean;
  lastBattleParticipatedDate?: string;
  battleHistory?: string[];
}

export interface Card {
  id: string;
  name: string;
  subtitle: string;
  rarity: Rarity;
  image: string;
  type: CardType;
  cardClass: CardClass;
  shortLore: string;
  fullLore?: string;
  role?: string;
  characteristics?: string[];
  isActive: boolean;
  foilOptional: boolean;
  dropWeight: number;
}

export interface UserCard {
  id: string; // The instance unique ID (e.g. uc_123)
  mintId: string; // Visual serial (e.g. EP-00012)
  userId: string;
  cardId: string;
  source: 'pack' | 'fusion' | 'admin' | 'legacy';
  bonusRoll: number;
  foil: boolean;
  acquiredAt: string;
}

export interface Pack {
  id: string;
  name: string;
  description: string;
  image: string;
  cardsPerPack: number;
  isActive: boolean;
  priceEpicPoints?: number;
}

export interface UserPack {
  id: string;
  userId: string;
  packId: string;
  quantity: number;
}

export interface OpenPackResult {
  cards: Card[];
  packId: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'error';
}

// ── Battle System ──────────────────────────────────────────────────────────

export interface BattleEvent {
  id: string;
  name: string;
  image: string;
  lore: string;
  specialRule: string;
  reward: string;
  /** Card IDs from the global card pool that form the enemy deck */
  enemyCards: string[];
  /** How many enemy cards are pre-revealed before battle starts */
  revealedCount: number;
  isActive: boolean;
}

export type DuelWinner = 'player' | 'enemy' | 'draw';

export interface DuelOutcome {
  slotIndex: number;
  playerCardId: string | null;
  enemyCardId: string | null;
  playerPower: number;
  enemyPower: number;
  winner: DuelWinner;
  /** If a special rule boosted the player card, show the label */
  specialRuleApplied?: string;
}

