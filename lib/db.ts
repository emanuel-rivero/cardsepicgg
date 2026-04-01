import { User, Card, Pack, UserCard, UserPack, BattleEvent } from './types';
import { SEED_BATTLE_EVENTS } from './battle';
import { generateMintId, generateBonusRoll } from './cardGenerator';

const KEYS = {
  users: 'epicgg_users',
  cards: 'epicgg_cards',
  userCards: 'epicgg_user_cards',
  packs: 'epicgg_packs',
  userPacks: 'epicgg_user_packs',
  currentUser: 'epicgg_current_user',
  seeded: 'epicgg_seeded',
  battleEvents: 'epicgg_battle_events',
};

function getAll<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

function setAll<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err: any) {
    if (err.name === 'QuotaExceededError') {
      alert('ERRO CRÍTICO: O limite de 5MB de memória do navegador foi atingido! O sistema não pode salvar mais dados. Você precisará deletar cartas/pacotes antigos ou limpar os dados do site.');
      console.error('Storage quota exceeded.');
    }
  }
}

function uid(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ── Initial seed data ──────────────────────────────────────────────────────

const RAW_CARDS: any[] = [
  // ── Common (5) ──
  { id: 'c1', name: 'Goblin Scout', subtitle: 'Green Menace', rarity: 'Common', image: '', type: 'Path of Arms', cardClass: 'Hunter', shortLore: 'Always watching from the bushes, waiting for the weak.', isActive: true, foilOptional: false, dropWeight: 100 },
  { id: 'c2', name: 'Skeletal Footman', subtitle: 'Raised from Dirt', rarity: 'Common', image: '', type: 'Path of Arms', cardClass: 'Fighter', shortLore: 'He marches without a cause, driven only by a dark master.', isActive: true, foilOptional: false, dropWeight: 100 },
  { id: 'c3', name: 'Ogre Brute', subtitle: 'Mindless Muscle', rarity: 'Common', image: '', type: 'Path of Arms', cardClass: 'Barbarian', shortLore: 'Smaps first, asks questions never. The simplest weapon.', isActive: true, foilOptional: false, dropWeight: 100 },
  { id: 'c4', name: 'Ember Imp', subtitle: 'Spark of Chaos', rarity: 'Common', image: '', type: 'Path of Wisdom', cardClass: 'Magus', shortLore: 'A tiny flame that can burn an entire forest to the ground.', isActive: true, foilOptional: false, dropWeight: 100 },
  { id: 'c5', name: 'Wind Sprite', subtitle: 'Breeze Dancer', rarity: 'Common', image: '', type: 'Path of Subterfuge', cardClass: 'Thief', shortLore: 'Playful spirit of the gust that brings the autumn chill.', isActive: true, foilOptional: false, dropWeight: 100 },
  
  // ── Uncommon (5) ──
  { id: 'u1', name: 'Elven Ranger', subtitle: 'Sharpshooter', rarity: 'Uncommon', image: '', type: 'Path of Arms', cardClass: 'Archer', shortLore: 'Her arrows guide the falling leaves to their targets.', isActive: true, foilOptional: true, dropWeight: 75 },
  { id: 'u2', name: 'Gargoyle Sentinel', subtitle: 'Stone Watcher', rarity: 'Uncommon', image: '', type: 'Path of Arms', cardClass: 'Defender', shortLore: 'Awakes only when blood is spilled upon its pedestal.', isActive: true, foilOptional: true, dropWeight: 75 },
  { id: 'u3', name: 'Ash Wraith', subtitle: 'Lingering Torment', rarity: 'Uncommon', image: '', type: 'Path of Wisdom', cardClass: 'Necromant', shortLore: 'Born from the ashes of betrayed kings and broken oaths.', isActive: true, foilOptional: true, dropWeight: 75 },
  { id: 'u4', name: 'Storm Caller', subtitle: 'Thunder Weaver', rarity: 'Uncommon', image: '', type: 'Path of Wisdom', cardClass: 'Magus', shortLore: 'He brings rain to the parched lands, or floods to his foes.', isActive: true, foilOptional: true, dropWeight: 75 },
  { id: 'u5', name: 'Lava Hound', subtitle: 'Beast of the Core', rarity: 'Uncommon', image: '', type: 'Path of Arms', cardClass: 'Mutant', shortLore: 'Its bite leaves a molten mark that burns eternally.', isActive: true, foilOptional: true, dropWeight: 75 },

  // ── Rare (5) ──
  { id: 'r1', name: 'Dark Sorceress', subtitle: 'Mistress of Arts', rarity: 'Rare', image: '', type: 'Path of Wisdom', cardClass: 'Necromant', shortLore: 'She traded her soul for arcane power.', isActive: true, foilOptional: true, dropWeight: 55 },
  { id: 'r2', name: 'Ancient Colossus', subtitle: 'Titan of Stone', rarity: 'Rare', image: '', type: 'Path of Arms', cardClass: 'Defender', shortLore: 'An unstoppable construct of the elder age.', isActive: true, foilOptional: true, dropWeight: 55 },
  { id: 'r3', name: 'Storm Eagle', subtitle: 'Herald of Thunder', rarity: 'Rare', image: '', type: 'Path of Arms', cardClass: 'Mutant', shortLore: 'A magnificent beast that brings lightning.', isActive: true, foilOptional: true, dropWeight: 55 },
  { id: 'r4', name: 'Flame Knight', subtitle: 'Blade of Fire', rarity: 'Rare', image: '', type: 'Path of Arms', cardClass: 'Paladin', shortLore: 'Forged in volcanic fire, this warrior burns for glory.', isActive: true, foilOptional: true, dropWeight: 55 },
  { id: 'r5', name: 'Forest Guardian', subtitle: 'Tree Sentinel', rarity: 'Rare', image: '', type: 'Path of Wisdom', cardClass: 'Druid', shortLore: 'A thousand-year-old treant who serves as judge.', isActive: true, foilOptional: true, dropWeight: 55 },

  // ── Epic (5) ──
  { id: 'e1', name: 'Void Assassin', subtitle: 'Dagger of the Rift', rarity: 'Epic', image: '', type: 'Path of Subterfuge', cardClass: 'Assassin', shortLore: 'This silent killer steps between worlds.', isActive: true, foilOptional: true, dropWeight: 28 },
  { id: 'e2', name: 'Thunder Titan', subtitle: 'Wrath of Heavens', rarity: 'Epic', image: '', type: 'Path of Arms', cardClass: 'Barbarian', shortLore: 'A divine being of pure electrical energy.', isActive: true, foilOptional: true, dropWeight: 28 },
  { id: 'e3', name: 'Lava Behemoth', subtitle: 'Deep Forge Fiend', rarity: 'Epic', image: '', type: 'Path of Arms', cardClass: 'Mutant', shortLore: 'It walks the surface of magma rivers.', isActive: true, foilOptional: true, dropWeight: 28 },
  { id: 'e4', name: 'Elder Treant', subtitle: 'Heart of the Forest', rarity: 'Epic', image: '', type: 'Path of Wisdom', cardClass: 'Druid', shortLore: 'The roots of the world speak through his ancient bark.', isActive: true, foilOptional: true, dropWeight: 28 },
  { id: 'e5', name: 'Runic Golem', subtitle: 'Arcane Defender', rarity: 'Epic', image: '', type: 'Path of Arms', cardClass: 'Defender', shortLore: 'Powered by crystals from the first age.', isActive: true, foilOptional: true, dropWeight: 28 },

  // ── Legendary (5) ──
  { id: 'l1', name: 'Shadow King', subtitle: 'Endless Night', rarity: 'Legendary', image: '', type: 'Path of Subterfuge', cardClass: 'Shadow Dancer', shortLore: 'He who extinguished the last sun.', isActive: true, foilOptional: true, dropWeight: 10 },
  { id: 'l2', name: 'Ancient Dragon', subtitle: 'First Flame', rarity: 'Legendary', image: '', type: 'Path of Arms', cardClass: 'Mutant', shortLore: 'The oldest living creature in the known world.', isActive: true, foilOptional: true, dropWeight: 10 },
  { id: 'l3', name: 'Archmage of Storms', subtitle: 'Master of Skies', rarity: 'Legendary', image: '', type: 'Path of Wisdom', cardClass: 'Magus', shortLore: 'He commands tornadoes with a mere gesture.', isActive: true, foilOptional: true, dropWeight: 10 },
  { id: 'l4', name: 'Demon Lord Baal', subtitle: 'Conqueror of Abyss', rarity: 'Legendary', image: '', type: 'Path of Subterfuge', cardClass: 'Demon Hunter', shortLore: 'Ruler of the seventh circle of fire.', isActive: true, foilOptional: true, dropWeight: 10 },
  { id: 'l5', name: 'Queen of Thorns', subtitle: 'Mother of Wilds', rarity: 'Legendary', image: '', type: 'Path of Wisdom', cardClass: 'Druid', shortLore: 'Her beauty is matched only by her lethal venoms.', isActive: true, foilOptional: true, dropWeight: 10 },

  // ── Mythic (5) ──
  { id: 'm1', name: 'The Void Leviathan', subtitle: 'Eater of Realms', rarity: 'Mythic', image: '', type: 'Path of Wisdom', cardClass: 'Necromant', shortLore: 'It feasts on the stars themselves.', isActive: true, foilOptional: true, dropWeight: 2 },
  { id: 'm2', name: 'Chronos', subtitle: 'Time Weaver', rarity: 'Mythic', image: '', type: 'Path of Wisdom', cardClass: 'Magus', shortLore: 'He sees every timeline, and masters them all.', isActive: true, foilOptional: true, dropWeight: 2 },
  { id: 'm3', name: 'Tempest Prime', subtitle: 'Original Storm', rarity: 'Mythic', image: '', type: 'Path of Wisdom', cardClass: 'Magus', shortLore: 'The sentient hurricane that never sleeps.', isActive: true, foilOptional: true, dropWeight: 2 },
  { id: 'm4', name: 'Ignis', subtitle: 'Soul of the Planet', rarity: 'Mythic', image: '', type: 'Path of Arms', cardClass: 'Mutant', shortLore: 'The literal heartbeat of the volcanic underworld.', isActive: true, foilOptional: true, dropWeight: 2 },
  { id: 'm5', name: 'Gaia', subtitle: 'The Creator', rarity: 'Mythic', image: '', type: 'Path of Wisdom', cardClass: 'Druid', shortLore: 'All life springs from her touch, or perishes by it.', isActive: true, foilOptional: true, dropWeight: 2 },

  // ── Hero (5) ──
  { id: 'h1', name: 'Arthur', subtitle: 'The Exiled King', rarity: 'Hero', image: '', type: 'Path of Arms', cardClass: 'Paladin', shortLore: 'He returned from the dead to save his lost people.', isActive: true, foilOptional: true, dropWeight: 1 },
  { id: 'h2', name: 'Sylvana', subtitle: 'Ranger General', rarity: 'Hero', image: '', type: 'Path of Arms', cardClass: 'Archer', shortLore: 'She leads the resistance against the Shadow.', isActive: true, foilOptional: true, dropWeight: 1 },
  { id: 'h3', name: 'Thorin', subtitle: 'Thunder Caller', rarity: 'Hero', image: '', type: 'Path of Arms', cardClass: 'Barbarian', shortLore: 'Mortal ascending to demigod through sheer rage.', isActive: true, foilOptional: true, dropWeight: 1 },
  { id: 'h4', name: 'Lilith', subtitle: 'The Redeemed', rarity: 'Hero', image: '', type: 'Path of Subterfuge', cardClass: 'Demon Hunter', shortLore: 'A demon who chose to defend humanity over hell.', isActive: true, foilOptional: true, dropWeight: 1 },
  { id: 'h5', name: 'Kael', subtitle: 'The Shadow Breaker', rarity: 'Hero', image: '', type: 'Path of Subterfuge', cardClass: 'Shadow Dancer', shortLore: 'He walks in darkness to bring the dawn.', isActive: true, foilOptional: true, dropWeight: 1 },
] as Card[];

export const INITIAL_CARDS: Card[] = RAW_CARDS.map(c => ({
  ...c,
  role: c.rarity === 'Legendary' || c.rarity === 'Hero' ? 'Líder' : (c.type === 'Path of Subterfuge' ? 'Assassino' : c.type === 'Path of Arms' ? 'Combatente' : 'Suporte'),
  characteristics: [c.type === 'Path of Subterfuge' ? 'Furtivo' : c.type === 'Path of Wisdom' ? 'Arcano' : 'Poderoso', c.rarity === 'Epic' || c.rarity === 'Rare' ? 'Veterano' : c.rarity === 'Legendary' || c.rarity === 'Hero' ? 'Mítico' : 'Soldado', 'Caótico'],
  fullLore: `A lenda de ${c.name} ecoa ao longo da eternidade. Segundo os contos, a verdadeira força de sua natureza está além das aparências conhecidas pela maioria dos mortais.\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi id nunc felis. Nulla luctus, risus feugiat feugiat mollis, dui quam aliquet massa, non tristique nisl ligula eu nisi. Curabitur sed ante at magna dapibus viverra ut ut eros. Integer elementum scelerisque finibus.`
}));

const INITIAL_PACKS: Pack[] = [
  {
    id: 'p0',
    name: 'Free Trial Pack',
    description: 'Um pacote gratuito garantido para você testar a mecânica de sorte.',
    image: '/pack-default.png',
    cardsPerPack: 3,
    isActive: true,
    priceEpicPoints: 0,
  },
  {
    id: 'p1',
    name: 'Void Starter Pack',
    description: 'Begin your journey into the shadows. Contains 3 to 4 random cards from all paths and rarities.',
    image: '/pack-default.png',
    cardsPerPack: 4,
    isActive: true,
    priceEpicPoints: 1000,
  },
  {
    id: 'p2',
    name: 'Shadow Deluxe Pack',
    description: 'Delve deeper into darkness. A premium pack with increased chances of Epic and Legendary cards.',
    image: '/pack-default.png',
    cardsPerPack: 4,
    isActive: true,
    priceEpicPoints: 2000,
  },
];

// ── Public DB API ──────────────────────────────────────────────────────────

export const db = {
  seed() {
    if (typeof window === 'undefined') return;
    
    if (localStorage.getItem(KEYS.seeded)) return;

    setAll(KEYS.cards, INITIAL_CARDS);
    setAll(KEYS.packs, INITIAL_PACKS);

    // Seed battle events
    const seededEvents: BattleEvent[] = SEED_BATTLE_EVENTS.map((e, i) => ({
      ...e,
      id: `event_${i + 1}`,
    }));
    setAll(KEYS.battleEvents, seededEvents);

    // Admin user
    const adminUser: User = {
      id: 'admin_001',
      name: 'Admin',
      email: 'admin@epicgg.com',
      password: 'admin123',
      isAdmin: true,
      createdAt: new Date().toISOString(),
      epicPoints: 0,
      coins: 0,
      afp: 0,
      packsOpenedAllTime: 0,
    };
    setAll(KEYS.users, [adminUser]);

    // Give admin some packs
    const adminPacks: UserPack[] = [
      { id: uid(), userId: 'admin_001', packId: 'p1', quantity: 5 },
      { id: uid(), userId: 'admin_001', packId: 'p2', quantity: 3 },
    ];
    setAll(KEYS.userPacks, adminPacks);

    localStorage.setItem(KEYS.seeded, '1');
  },

  users: {
    getAll: (): User[] => {
      const rawUsers = getAll<any>(KEYS.users);
      return rawUsers.map((u) => {
        if (typeof u.epicPoints !== 'number') u.epicPoints = 0;
        if (typeof u.coins !== 'number') u.coins = 0;
        if (typeof u.afp !== 'number') u.afp = 0;
        if (typeof u.packsOpenedAllTime !== 'number') u.packsOpenedAllTime = 0;
        return u as User;
      });
    },
    getByEmail: (email: string): User | undefined =>
      db.users.getAll().find((u) => u.email.toLowerCase() === email.toLowerCase()),
    getById: (id: string): User | undefined =>
      db.users.getAll().find((u) => u.id === id),
    create(data: Omit<User, 'id' | 'createdAt' | 'isAdmin' | 'epicPoints' | 'coins' | 'packsOpenedAllTime' | 'afp'>): User {
      const user: User = {
        epicPoints: 0,
        coins: 0,
        afp: 0,
        packsOpenedAllTime: 0,
        ...data,
        id: `user_${uid()}`,
        isAdmin: false,
        createdAt: new Date().toISOString(),
      };
      const users = getAll<User>(KEYS.users);
      users.push(user);
      setAll(KEYS.users, users);
      return user;
    },
    update(id: string, updates: Partial<User>) {
      const users = getAll<User>(KEYS.users).map((u) =>
        u.id === id ? { ...u, ...updates } : u
      );
      setAll(KEYS.users, users);
    },
  },

  cards: {
    getAll: (): Card[] => getAll<Card>(KEYS.cards),
    getActive: (): Card[] => getAll<Card>(KEYS.cards).filter((c) => c.isActive),
    getById: (id: string): Card | undefined =>
      getAll<Card>(KEYS.cards).find((c) => c.id === id),
    create(data: Omit<Card, 'id'>): Card {
      const card: Card = { ...data, id: `card_${uid()}` };
      const cards = getAll<Card>(KEYS.cards);
      cards.push(card);
      setAll(KEYS.cards, cards);
      return card;
    },
    update(id: string, updates: Partial<Card>) {
      const cards = getAll<Card>(KEYS.cards).map((c) =>
        c.id === id ? { ...c, ...updates } : c
      );
      setAll(KEYS.cards, cards);
    },
    delete(id: string) {
      setAll(KEYS.cards, getAll<Card>(KEYS.cards).filter((c) => c.id !== id));
    },
  },

  userCards: {
    getByUser: (userId: string): UserCard[] =>
      getAll<UserCard>(KEYS.userCards).filter((uc) => uc.userId === userId),
    addCard(userId: string, cardId: string, foil = false, source: 'pack' | 'fusion' | 'admin' | 'legacy' = 'pack') {
      const all = getAll<UserCard>(KEYS.userCards);
      
      const cardDef = db.cards.getById(cardId);
      const rarity = cardDef ? cardDef.rarity : 'Common';
      const bonusRoll = generateBonusRoll(rarity, source);
      const mintId = generateMintId();

      all.push({
        id: `uc_${uid()}`,
        mintId,
        userId,
        cardId,
        source,
        bonusRoll,
        foil,
        acquiredAt: new Date().toISOString(),
      });
      setAll(KEYS.userCards, all);
    },
    // Consume specific UserCard entries by their IDs (used in fusion)
    consumeCards(userId: string, userCardIds: string[]): boolean {
      let all = getAll<UserCard>(KEYS.userCards);
      
      // Ensure the user actually owns these specific instances
      const userOwned = all.filter(uc => uc.userId === userId && userCardIds.includes(uc.id));
      if (userOwned.length !== userCardIds.length) return false;

      // Filter out the consumed IDs
      all = all.filter(uc => !userCardIds.includes(uc.id));
      setAll(KEYS.userCards, all);
      return true;
    },
  },

  packs: {
    getAll: (): Pack[] => {
      const all = getAll<any>(KEYS.packs);
      return all.map(p => {
        if (typeof p.priceEpicPoints !== 'number') p.priceEpicPoints = 1000;
        return p as Pack;
      });
    },
    getActive: (): Pack[] => db.packs.getAll().filter((p) => p.isActive),
    getById: (id: string): Pack | undefined =>
      db.packs.getAll().find((p) => p.id === id),
    create(data: Omit<Pack, 'id' | 'priceEpicPoints'>): Pack {
      const pack: Pack = { ...data, id: `pack_${uid()}`, priceEpicPoints: 1000 };
      const packs = getAll<Pack>(KEYS.packs);
      packs.push(pack);
      setAll(KEYS.packs, packs);
      return pack;
    },
    update(id: string, updates: Partial<Pack>) {
      const packs = getAll<Pack>(KEYS.packs).map((p) =>
        p.id === id ? { ...p, ...updates } : p
      );
      setAll(KEYS.packs, packs);
    },
    delete(id: string) {
      setAll(KEYS.packs, getAll<Pack>(KEYS.packs).filter((p) => p.id !== id));
    },
  },

  userPacks: {
    getByUser: (userId: string): UserPack[] =>
      getAll<UserPack>(KEYS.userPacks).filter((up) => up.userId === userId),
    get: (userId: string, packId: string): UserPack | undefined =>
      getAll<UserPack>(KEYS.userPacks).find(
        (up) => up.userId === userId && up.packId === packId
      ),
    assign(userId: string, packId: string, quantity = 1) {
      const all = getAll<UserPack>(KEYS.userPacks);
      const existing = all.find((up) => up.userId === userId && up.packId === packId);
      if (existing) {
        const updated = all.map((up) =>
          up.userId === userId && up.packId === packId
            ? { ...up, quantity: up.quantity + quantity }
            : up
        );
        setAll(KEYS.userPacks, updated);
      } else {
        all.push({ id: `up_${uid()}`, userId, packId, quantity });
        setAll(KEYS.userPacks, all);
      }
    },
    consume(userId: string, packId: string): boolean {
      const all = getAll<UserPack>(KEYS.userPacks);
      const existing = all.find((up) => up.userId === userId && up.packId === packId);
      if (!existing || existing.quantity <= 0) return false;
      const updated = all.map((up) =>
        up.userId === userId && up.packId === packId
          ? { ...up, quantity: up.quantity - 1 }
          : up
      );
      setAll(KEYS.userPacks, updated);
      return true;
    },
  },

  battleEvents: {
    getAll: (): BattleEvent[] => getAll<BattleEvent>(KEYS.battleEvents),
    getActive: (): BattleEvent[] => getAll<BattleEvent>(KEYS.battleEvents).filter(e => e.isActive),
    getById: (id: string): BattleEvent | undefined =>
      getAll<BattleEvent>(KEYS.battleEvents).find(e => e.id === id),
    create(data: Omit<BattleEvent, 'id'>): BattleEvent {
      const event: BattleEvent = { ...data, id: `event_${uid()}` };
      const events = getAll<BattleEvent>(KEYS.battleEvents);
      events.push(event);
      setAll(KEYS.battleEvents, events);
      return event;
    },
    update(id: string, updates: Partial<BattleEvent>) {
      const events = getAll<BattleEvent>(KEYS.battleEvents).map(e =>
        e.id === id ? { ...e, ...updates } : e
      );
      setAll(KEYS.battleEvents, events);
    },
    delete(id: string) {
      setAll(KEYS.battleEvents, getAll<BattleEvent>(KEYS.battleEvents).filter(e => e.id !== id));
    },
    /** Emergency re-seed (if battle events table is missing / empty after schema change) */
    reseedIfEmpty() {
      if (typeof window === 'undefined') return;
      if (getAll<BattleEvent>(KEYS.battleEvents).length > 0) return;
      const seeded: BattleEvent[] = SEED_BATTLE_EVENTS.map((e, i) => ({ ...e, id: `event_${i + 1}` }));
      setAll(KEYS.battleEvents, seeded);
    },
    /** Sync seed events: update image/lore/specialRule/reward of existing seed events (preserves isActive flag) */
    syncSeedEvents() {
      if (typeof window === 'undefined') return;
      const stored = getAll<BattleEvent>(KEYS.battleEvents);
      if (stored.length === 0) return;
      const updated = stored.map(ev => {
        const seedIndex = SEED_BATTLE_EVENTS.findIndex((_, i) => `event_${i + 1}` === ev.id);
        if (seedIndex === -1) return ev;
        const seed = SEED_BATTLE_EVENTS[seedIndex];
        return { ...ev, image: seed.image, lore: seed.lore, specialRule: seed.specialRule, reward: seed.reward, enemyCards: seed.enemyCards, revealedCount: seed.revealedCount };
      });
      setAll(KEYS.battleEvents, updated);
    },
  },

  auth: {
    getCurrent(): User | null {
      if (typeof window === 'undefined') return null;
      const id = localStorage.getItem(KEYS.currentUser);
      if (!id) return null;
      return getAll<User>(KEYS.users).find((u) => u.id === id) || null;
    },
    setCurrent(userId: string | null) {
      if (typeof window === 'undefined') return;
      if (userId) {
        localStorage.setItem(KEYS.currentUser, userId);
      } else {
        localStorage.removeItem(KEYS.currentUser);
      }
    },
  },
};
