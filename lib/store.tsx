'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { User, Card, UserCard, Pack, UserPack, ToastMessage, Rarity, BattleEvent } from './types';
import { db } from './db';
import { rollCards } from './cardGenerator';
import ToastContainer from '@/components/Toast';
import { calcFinalChance, rollFusion, getRandomCardByRarity, FUSION_BY_SOURCE, AFP_FAILURE_REWARD } from './fusion';

interface AppContextValue {
  // Auth
  currentUser: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => { success: boolean; error?: string };
  register: (name: string, email: string, password: string) => { success: boolean; error?: string };
  logout: () => void;

  // Cards
  allCards: Card[];
  userCards: UserCard[];
  refreshUserCards: () => void;

  // Packs
  allPacks: Pack[];
  userPacks: UserPack[];
  refreshUserPacks: () => void;

  // Battle Events
  allBattleEvents: BattleEvent[];
  refreshBattleEvents: () => void;

  // Actions
  openPack: (packId: string) => { success: boolean; cards?: { card: Card; isNew: boolean }[]; error?: string };
  buyPack: (packId: string) => { success: boolean; error?: string };
  recordBattleResult: (eventId: string, isWin: boolean) => { success: boolean; error?: string };
  resetBattleParticipant: (eventId: string) => void;
  refreshAll: () => void;
  performFusion: (userCardIds: string[], sourceRarity: Rarity, afpSpent: number) => { success: boolean; resultCard?: Card; error?: string; afpEarned?: number };

  toasts: ToastMessage[];
  addToast: (title: string, message: string, type?: 'success' | 'info' | 'error') => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [userCards, setUserCards] = useState<UserCard[]>([]);
  const [allPacks, setAllPacks] = useState<Pack[]>([]);
  const [userPacks, setUserPacks] = useState<UserPack[]>([]);
  const [allBattleEvents, setAllBattleEvents] = useState<BattleEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((title: string, message: string, type: 'success' | 'info' | 'error' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const refreshUserCards = useCallback(() => {
    const user = db.auth.getCurrent();
    if (user) setUserCards(db.userCards.getByUser(user.id));
  }, []);

  const refreshUserPacks = useCallback(() => {
    const user = db.auth.getCurrent();
    if (user) setUserPacks(db.userPacks.getByUser(user.id));
  }, []);

  const refreshBattleEvents = useCallback(() => {
    db.battleEvents.reseedIfEmpty();
    setAllBattleEvents(db.battleEvents.getAll());
  }, []);

  const checkDailyLogin = useCallback((user: User): User => {
    const today = new Date().toISOString().split('T')[0];
    if (user.lastLoginDate !== today) {
      const newPoints = user.epicPoints + 500;
      db.users.update(user.id, { epicPoints: newPoints, lastLoginDate: today });
      
      setTimeout(() => {
        addToast('Login Diário', 'Você ganhou +500 Epic! Points por logar hoje.', 'success');
      }, 500);

      return { ...user, epicPoints: newPoints, lastLoginDate: today };
    }
    return user;
  }, [addToast]);

  const refreshAll = useCallback(() => {
    let user = db.auth.getCurrent();
    if (user) {
      user = checkDailyLogin(user);
    }
    setCurrentUser(user);
    setAllCards(db.cards.getAll());
    setAllPacks(db.packs.getAll());
    db.battleEvents.reseedIfEmpty();
    db.battleEvents.syncSeedEvents(); // patch existing events with latest seed data (image, lore, rules)
    setAllBattleEvents(db.battleEvents.getAll());
    if (user) {
      setUserCards(db.userCards.getByUser(user.id));
      setUserPacks(db.userPacks.getByUser(user.id));
    } else {
      setUserCards([]);
      setUserPacks([]);
    }
  }, []);

  useEffect(() => {
    db.seed();
    setIsLoading(false);
    refreshAll();
  }, [refreshAll]);

  const login = useCallback(
    (email: string, password: string): { success: boolean; error?: string } => {
      let user = db.users.getByEmail(email);
      if (!user) return { success: false, error: 'Email not found.' };
      if (user.password !== password) return { success: false, error: 'Wrong password.' };
      
      user = checkDailyLogin(user);
      
      db.auth.setCurrent(user.id);
      setCurrentUser(user);
      setUserCards(db.userCards.getByUser(user.id));
      setUserPacks(db.userPacks.getByUser(user.id));
      return { success: true };
    },
    []
  );

  const register = useCallback(
    (name: string, email: string, password: string): { success: boolean; error?: string } => {
      if (db.users.getByEmail(email)) return { success: false, error: 'Email already in use.' };
      if (password.length < 6) return { success: false, error: 'Password must be at least 6 characters.' };
      const user = db.users.create({ name, email, password });
      // Give new users 3 starter packs
      db.userPacks.assign(user.id, 'p1', 3);
      db.auth.setCurrent(user.id);
      setCurrentUser(user);
      setUserCards([]);
      setUserPacks(db.userPacks.getByUser(user.id));
      return { success: true };
    },
    []
  );

  const logout = useCallback(() => {
    db.auth.setCurrent(null);
    setCurrentUser(null);
    setUserCards([]);
    setUserPacks([]);
  }, []);

  const openPack = useCallback(
    (packId: string): { success: boolean; cards?: { card: Card; isNew: boolean }[]; error?: string } => {
      const user = db.auth.getCurrent();
      if (!user) return { success: false, error: 'Not logged in.' };

      const pack = db.packs.getById(packId);
      if (!pack) return { success: false, error: 'Pack not found.' };

      const consumed = db.userPacks.consume(user.id, packId);
      if (!consumed) return { success: false, error: 'No packs available.' };

      // Roll cards
      const count = Math.random() < 0.5
        ? pack.cardsPerPack
        : Math.max(3, pack.cardsPerPack - 1);
      const cards: Card[] = rollCards(db.cards.getActive(), count);

      const existingCards = db.userCards.getByUser(user.id);
      const existingCardIds = new Set(existingCards.map(uc => uc.cardId));

      const cardsWithNewFlag = cards.map(c => {
        const isNew = !existingCardIds.has(c.id);
        if (isNew) {
          existingCardIds.add(c.id);
        }
        return { card: c, isNew };
      });

      // Save to user collection
      cards.forEach((card) => db.userCards.addCard(user.id, card.id));

      const currentUserData = db.users.getById(user.id);
      if (currentUserData) {
        let newPacksOpened = currentUserData.packsOpenedAllTime + 1;
        let newPoints = currentUserData.epicPoints;
        let p5 = currentUserData.hasClaimed5PacksBonus || false;
        let p10 = currentUserData.hasClaimed10PacksBonus || false;
        
        if (newPacksOpened === 5 && !p5) {
          newPoints += 1000;
          p5 = true;
          addToast('Conquista', 'Você abriu 5 pacotes e ganhou +1000 Epic! Points!', 'success');
        }
        if (newPacksOpened === 10 && !p10) {
          newPoints += 2000;
          p10 = true;
          addToast('Conquista', 'Você abriu 10 pacotes e ganhou +2000 Epic! Points!', 'success');
        }
        
        db.users.update(user.id, {
          packsOpenedAllTime: newPacksOpened,
          epicPoints: newPoints,
          hasClaimed5PacksBonus: p5,
          hasClaimed10PacksBonus: p10
        });
      }

      // Refresh state
      setUserCards(db.userCards.getByUser(user.id));
      setUserPacks(db.userPacks.getByUser(user.id));
      setCurrentUser(db.users.getById(user.id) || null);

      return { success: true, cards: cardsWithNewFlag };
    },
    []
  );

  const recordBattleResult = useCallback((eventId: string, isWin: boolean): { success: boolean; error?: string } => {
    const user = db.auth.getCurrent();
    if (!user) return { success: false, error: 'Not logged in.' };

    const now = new Date();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const weekId = weekStart.toISOString().split('T')[0];
    const eventKey = `${eventId}_${weekId}`;

    const history = user.battleHistory || [];
    if (history.includes(eventKey)) {
      return { success: false, error: 'JÁ PARTICIPOU NESTE EVENTO ESTA SEMANA.' };
    }

    const newHistory = [...history, eventKey];

    if (isWin) {
      let newPoints = user.epicPoints || 0;
      if (eventId === 'event_1') {
        // Guerra nas Ruínas de Aiglana
        newPoints += 1000;
        db.userPacks.assign(user.id, 'p2', 1);
        addToast('Vitória!', '+1000 Epic Points + 1× Pacote Épico conquistados!', 'success');
      } else if (eventId === 'event_2') {
        // Ameaça da Floresta dos Mortos
        newPoints += 1500;
        db.userPacks.assign(user.id, 'p1', 1);
        addToast('Vitória!', '+1500 Epic Points + 1× Pacote Lendário conquistados!', 'success');
      } else if (eventId === 'event_3') {
        // Caverna de Prata
        newPoints += 500;
        addToast('Vitória!', '+500 Epic Points conquistados!', 'success');
      } else if (eventId === 'event_4') {
        // Caçada a Sho'grath, o Maldito
        newPoints += 500;
        db.userPacks.assign(user.id, 'p2', 1);
        addToast("Sho'grath Derrotado! ⚔️", "+500 Moedas de Ouro + 1× Pacote Épico! A caçada foi um sucesso!", 'success');
      } else {
        newPoints += 1000;
      }
      db.users.update(user.id, { epicPoints: newPoints, battleHistory: newHistory });
    } else {
      db.users.update(user.id, { battleHistory: newHistory });
    }

    setCurrentUser(db.users.getById(user.id) || null);
    setUserPacks(db.userPacks.getByUser(user.id));
    
    return { success: true };
  }, [addToast]);

  const resetBattleParticipant = useCallback((eventId: string) => {
    const user = db.auth.getCurrent();
    if (!user || (!user.isAdmin && user.email !== 'admin@epicgg.com')) return;
    
    const now = new Date();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const weekId = weekStart.toISOString().split('T')[0];
    const eventKey = `${eventId}_${weekId}`;

    if (user.battleHistory) {
      const filtered = user.battleHistory.filter(h => h !== eventKey);
      db.users.update(user.id, { battleHistory: filtered, lastBattleParticipatedDate: undefined });
      setCurrentUser(db.users.getById(user.id) || null);
    }
  }, []);

  const buyPack = useCallback((packId: string): { success: boolean; error?: string } => {
    const user = db.auth.getCurrent();
    if (!user) return { success: false, error: 'Not logged in.' };

    const pack = db.packs.getById(packId);
    if (!pack) return { success: false, error: 'Pack not found.' };

    const price = pack.priceEpicPoints ?? 1000;
    if ((user.epicPoints || 0) < price) {
      return { success: false, error: 'Not enough Epic! Points.' };
    }

    db.users.update(user.id, { epicPoints: (user.epicPoints || 0) - price });
    db.userPacks.assign(user.id, packId, 1);
    
    setCurrentUser(db.users.getById(user.id) || null);
    setUserPacks(db.userPacks.getByUser(user.id));

    return { success: true };
  }, []);

  const performFusion = useCallback(
    (userCardIds: string[], sourceRarity: Rarity, afpSpent: number): { success: boolean; resultCard?: Card; error?: string; afpEarned?: number } => {
      const user = db.auth.getCurrent();
      if (!user) return { success: false, error: 'Not logged in.' };

      const tier = FUSION_BY_SOURCE[sourceRarity];
      if (!tier) return { success: false, error: 'Invalid fusion tier.' };
      if (userCardIds.length !== tier.requiredCount) return { success: false, error: 'Wrong number of cards.' };

      const currentAfp = user.afp ?? 0;
      if (afpSpent > currentAfp) return { success: false, error: 'Not enough AFP.' };

      // Consume input cards
      const consumed = db.userCards.consumeCards(user.id, userCardIds);
      if (!consumed) return { success: false, error: 'Failed to consume cards.' };

      // Deduct AFP spent
      db.users.update(user.id, { afp: currentAfp - afpSpent });

      // Roll
      const finalChance = calcFinalChance(tier.baseChance, afpSpent);
      const didSucceed = rollFusion(finalChance);

      if (didSucceed) {
        const resultCard = getRandomCardByRarity(allCards, tier.targetRarity);
        if (!resultCard) {
          // No cards of that rarity exist — refund cards and abort
          return { success: false, error: `No ${tier.targetRarity} cards exist yet.` };
        }
        db.userCards.addCard(user.id, resultCard.id, false, 'fusion');
        const newAfp = currentAfp - afpSpent + tier.afpReward;
        db.users.update(user.id, { afp: newAfp });
        setCurrentUser(db.users.getById(user.id) || null);
        setUserCards(db.userCards.getByUser(user.id));
        addToast('Fusão Bem-sucedida! ✨', `Você criou uma carta ${tier.targetRarity}! +${tier.afpReward} AFP`, 'success');
        return { success: true, resultCard, afpEarned: tier.afpReward };
      } else {
        // Failure — grant AFP bonus
        const newAfp = currentAfp - afpSpent + AFP_FAILURE_REWARD;
        db.users.update(user.id, { afp: newAfp });
        setCurrentUser(db.users.getById(user.id) || null);
        setUserCards(db.userCards.getByUser(user.id));
        addToast('Fusão Falhou', `As cartas foram consumidas. +${AFP_FAILURE_REWARD} AFP de consolação.`, 'error');
        return { success: false, afpEarned: AFP_FAILURE_REWARD, error: 'fusion_failed' };
      }
    },
    [allCards, addToast]
  );

  return (
    <AppContext.Provider
      value={{
        currentUser,
        isLoading,
        login,
        register,
        logout,
        allCards,
        userCards,
        refreshUserCards,
        allPacks,
        userPacks,
        refreshUserPacks,
        allBattleEvents,
        refreshBattleEvents,
        openPack,
        recordBattleResult,
        resetBattleParticipant,
        buyPack,
        refreshAll,
        performFusion,
        toasts,
        addToast,
      }}
    >
      {children}
      <ToastContainer />
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
