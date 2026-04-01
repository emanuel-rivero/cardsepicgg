'use client';

import { useState, useMemo } from 'react';
import { useApp } from '@/lib/store';
import CardComponent from '@/components/Card';
import CardModal from '@/components/CardModal';
import { Rarity, Card } from '@/lib/types';
import styles from './collection.module.css';

const RARITIES: ('all' | Rarity)[] = ['all', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Hero'];

const RARITY_ICON: Record<string, string> = {
  all: '✦',
  Common: '◆',
  Uncommon: '◈',
  Rare: '★',
  Epic: '✦',
  Legendary: '♛',
  Mythic: '♜',
  Hero: '🜲',
};

export default function CollectionPage() {
  const { userCards, allCards } = useApp();
  const [filter, setFilter] = useState<'all' | Rarity>('all');
  const [search, setSearch] = useState('');
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  const ownedCardMap = useMemo(() => {
    const map = new Map<string, number>();
    userCards.forEach((uc) => {
      const current = map.get(uc.cardId) || 0;
      map.set(uc.cardId, current + 1);
    });
    return map;
  }, [userCards]);

  const filteredCards = useMemo(() => {
    return allCards
      .filter((c) => c.isActive)
      .filter((c) => filter === 'all' || c.rarity === filter)
      .filter((c) =>
        search === '' ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.type.toLowerCase().includes(search.toLowerCase()) ||
        c.cardClass.toLowerCase().includes(search.toLowerCase())
      );
  }, [allCards, filter, search]);

  const totalOwned = userCards.length;
  const uniqueOwned = new Set(userCards.map(uc => uc.cardId)).size;

  return (
    <div className={styles.page}>
      <div className="container">
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>My Collection</h1>
            <p className={styles.subtitle}>Your dark fantasy archive</p>
          </div>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{uniqueOwned}</span>
              <span className={styles.statLabel}>Unique</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statValue}>{allCards.filter(c => c.isActive).length}</span>
              <span className={styles.statLabel}>Total Cards</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statValue}>{totalOwned}</span>
              <span className={styles.statLabel}>Owned</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className={styles.controls}>
          <div className={styles.filterRow}>
            {RARITIES.map((r) => (
              <button
                key={r}
                id={`filter-${r.toLowerCase()}`}
                onClick={() => setFilter(r)}
                className={`${styles.filterBtn} ${filter === r ? styles.filterActive : ''} ${r !== 'all' ? styles[`filter-${r.toLowerCase()}`] : ''}`}
              >
                {RARITY_ICON[r]} {r === 'all' ? 'All Cards' : r}
              </button>
            ))}
          </div>
          <input
            id="collection-search"
            type="text"
            placeholder="Search cards..."
            className={`form-input ${styles.searchInput}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Empty state */}
        {uniqueOwned === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📚</div>
            <h2 className={styles.emptyTitle}>Your collection is empty</h2>
            <p className={styles.emptyText}>Open packs on the home page to start collecting cards!</p>
          </div>
        ) : (
          <>
            <p className={styles.resultCount}>
              Showing {filteredCards.length} card{filteredCards.length !== 1 ? 's' : ''}
            </p>

            <div className={styles.grid}>
              {filteredCards.map((card) => {
                const qty = ownedCardMap.get(card.id) || 0;
                return (
                  <div
                    key={card.id}
                    className={`${styles.cardWrapper} ${qty === 0 ? styles.notOwned : ''}`}
                    onClick={() => {
                      if (qty > 0) setSelectedCard(card);
                    }}
                    style={{ cursor: qty > 0 ? 'pointer' : 'default' }}
                  >
                    <CardComponent
                      card={card}
                      quantity={qty}
                      showQuantity={qty > 0}
                      size="md"
                    />
                    {qty === 0 && (
                      <div className={styles.notOwnedOverlay}>
                        <span className={styles.notOwnedIcon}>?</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {selectedCard && (
        <CardModal 
          card={selectedCard} 
          ownedQuantity={ownedCardMap.get(selectedCard.id) || 0}
          userInstances={userCards.filter(uc => uc.cardId === selectedCard.id)}
          onClose={() => setSelectedCard(null)} 
        />
      )}
    </div>
  );
}
