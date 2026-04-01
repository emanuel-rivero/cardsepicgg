'use client';

import { Card, Rarity, CardType } from '@/lib/types';
import styles from './Card.module.css';

interface CardProps {
  card: Card;
  quantity?: number;
  showQuantity?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  animateIn?: boolean;
  animationDelay?: number;
  onClick?: () => void;
  hideLore?: boolean;
}

const RARITY_ICON: Record<Rarity, string> = {
  Common: '◆',
  Uncommon: '◈',
  Rare: '★',
  Epic: '✦',
  Legendary: '♛',
  Mythic: '♜',
  Hero: '🜲',
};

const TYPE_SYMBOL: Record<CardType, string> = {
  'Path of Arms': '⚔',
  'Path of Wisdom': '📖',
  'Path of Subterfuge': '☽',
  Enemy: '💀',
  NPC: '🗣',
  Gods: '✧',
  Quest: '📜',
};

const TYPE_CLASS: Record<CardType, string> = {
  'Path of Arms': 'type-path-of-arms',
  'Path of Wisdom': 'type-path-of-wisdom',
  'Path of Subterfuge': 'type-path-of-subterfuge',
  Enemy: 'type-enemy',
  NPC: 'type-npc',
  Gods: 'type-gods',
  Quest: 'type-quest',
};

export default function CardComponent({
  card,
  quantity,
  showQuantity = false,
  size = 'md',
  animateIn = false,
  animationDelay = 0,
  hideLore = false,
  onClick,
}: CardProps) {
  const rarityLower = card.rarity.toLowerCase() as Lowercase<Rarity>;

  const renderRarityStars = (rarity: Rarity) => {
    if (rarity === 'Mythic' || rarity === 'Hero') {
      return <>{RARITY_ICON[rarity]} {rarity}</>;
    }
    const starCount = { Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Legendary: 5 }[rarity];
    return <>{Array(starCount).fill('★').join('')}</>;
  };

  return (
    <div
      className={`${styles.wrapper} ${styles[size]} ${animateIn ? styles.animateIn : ''}`}
      style={animateIn ? { animationDelay: `${animationDelay}ms` } : undefined}
      onClick={onClick}
    >
      <div className={`${styles.card} ${styles[`rarity-${rarityLower}`]}`}>
        <div className={`${styles.cardArt} ${styles[TYPE_CLASS[card.type]] || ''}`}>
          {card.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.image} alt={card.name} className={styles.artImg} />
          ) : (
            <div className={styles.artPlaceholder}>
              <span className={styles.pathSymbol}>
                {TYPE_SYMBOL[card.type]}
              </span>
              <div className={styles.artLines}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className={styles.artLine} />
                ))}
              </div>
            </div>
          )}

          {/* Rarity glow overlay */}
          <div className={`${styles.rarityGlow} ${styles[`glow-${rarityLower}`]}`} />

          {/* Rarity shimmer */}
          {['Legendary', 'Mythic', 'Hero'].includes(card.rarity) && (
            <div className={styles[`${rarityLower}Shimmer` as keyof typeof styles]} />
          )}
        </div>

        {/* Card info */}
        <div className={styles.cardInfo}>
          <div className={styles.cardHeader}>
            <div className={styles.pathLabel}>
              <span className={styles.pathIcon}>{TYPE_SYMBOL[card.type]}</span>
              <span className={styles.pathName}>{card.cardClass === 'None' ? card.type : card.cardClass}</span>
            </div>
            <span className={`${styles.rarityBadge} ${styles[`badge-${rarityLower}`]}`}>
              {renderRarityStars(card.rarity)}
            </span>
          </div>

          <div className={styles.cardName}>{card.name}</div>
          {!hideLore && card.subtitle && (
            <div className={styles.cardSubtitle}>{card.subtitle}</div>
          )}

          {!hideLore && size !== 'sm' && card.shortLore && (
            <p className={styles.cardLore}>{card.shortLore}</p>
          )}
        </div>

        {/* Quantity badge */}
        {showQuantity && quantity && quantity > 0 && (
          <div className={styles.quantityBadge}>×{quantity}</div>
        )}

        {/* Animation border */}
        {['Legendary', 'Mythic', 'Hero'].includes(card.rarity) && (
          <div className={styles[`${rarityLower}Border` as keyof typeof styles]} />
        )}
      </div>
    </div>
  );
}
