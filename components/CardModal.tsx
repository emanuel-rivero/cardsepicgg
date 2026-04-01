'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, UserCard } from '@/lib/types';
import { RARITY_POWER } from '@/lib/battle';
import CardComponent from '@/components/Card';
import styles from './CardModal.module.css';

interface CardModalProps {
  card: Card;
  ownedQuantity: number;
  userInstances?: UserCard[];
  onClose: () => void;
}

/**
 * Modal de detalhes da carta.
 * Exibe estatisticas de instancia (mint, bonus, origem), lore e metadados de gameplay.
 */
export default function CardModal({ card, ownedQuantity, userInstances, onClose }: CardModalProps) {
  const sortedInstances = userInstances ? [...userInstances].sort((a, b) => b.bonusRoll - a.bonusRoll) : [];
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(sortedInstances.length > 0 ? sortedInstances[0].id : null);
  const selectedInstance = sortedInstances.find(i => i.id === selectedInstanceId);
  
  const basePower = RARITY_POWER[card.rarity];
  const bonus = selectedInstance?.bonusRoll || 0;
  const totalPower = basePower + bonus;

  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent scroll on body while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  /** Fecha modal ao clicar no backdrop (fora da caixa de conteudo). */
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Safe fallbacks for older local storage cards
  const role = card.role || (card.rarity === 'Hero' || card.rarity === 'Legendary' ? 'Líder' : 'Combatente');
  const traits = card.characteristics || [];
  const fullLore = card.fullLore || `A lenda de ${card.name} ainda está sendo escrita nas cinzas e pedras do nosso mundo.\n\nEnquanto ele se ergue perante seus desafios, as sombras sussurram seu nome, mas apenas o tempo dirá se o seu legado será de glória ou destruição absoluta.`;

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal} ref={modalRef}>
        <button className={styles.closeBtn} onClick={onClose}>✖</button>

        <div className={styles.container}>
          {/* Lado Esquerdo: Arte e Display de Status Principal */}
          <div className={styles.leftCol}>
            <div className={styles.cardWrapper}>
              <CardComponent card={card} size="lg" animateIn={true} hideLore={true} />
            </div>
            
            <div className={styles.infoGrid}>
              <div className={styles.infoCard}>
                <span className={styles.infoTitle}>NÚMERO DO MINT</span>
                <span className={styles.infoValue} style={{ color: '#4ade80' }}>
                  {selectedInstance?.mintId || '---'}
                </span>
              </div>
              <div className={styles.infoCard}>
                <span className={styles.infoTitle}>CÓPIAS POSSUÍDAS</span>
                <span className={styles.infoValue}>{ownedQuantity}</span>
              </div>
              <div className={styles.infoCard}>
                <span className={styles.infoTitle}>RARIDADE</span>
                <span className={styles.infoValue} style={{ color: `var(--rarity-${card.rarity.toLowerCase()})` }}>
                  {card.rarity}
                </span>
              </div>
              <div className={styles.infoCard}>
                <span className={styles.infoTitle}>TIPO</span>
                <span className={styles.infoValue}>{card.type || '---'}</span>
              </div>
              <div className={styles.infoCard}>
                <span className={styles.infoTitle}>CLASSE</span>
                <span className={styles.infoValue}>{card.cardClass}</span>
              </div>
              <div className={styles.infoCard}>
                <span className={styles.infoTitle}>{selectedInstance?.bonusRoll ? 'BÔNUS DE PODER' : 'PODER DE BATALHA'}</span>
                <span className={styles.infoValue} style={{ color: '#00d2d3' }}>
                  {selectedInstance?.bonusRoll ? `+${selectedInstance.bonusRoll.toFixed(2)}` : RARITY_POWER[card.rarity]}
                </span>
              </div>
              <div className={styles.infoCard} style={{ gridColumn: '1 / -1' }}>
                <span className={styles.infoTitle}>ADQUIRIDO DE</span>
                <span className={styles.infoValue} style={{ textTransform: 'uppercase', fontSize: '0.8rem', padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', display: 'inline-block', alignSelf: 'flex-start' }}>
                  {selectedInstance?.source || 'DESCONHECIDO'}
                </span>
              </div>
            </div>
          </div>

          {/* Lado Direito: História e Detalhes Narrativos */}
          <div className={styles.rightCol}>
            <header className={styles.header}>
              <div className={styles.badgesRow}>
                {/* Bonus Badge foi removido a pedido do usuário */}
                <div 
                  className={styles.badgeItem} 
                  style={{ color: `var(--rarity-${card.rarity.toLowerCase()})`, borderColor: `var(--rarity-${card.rarity.toLowerCase()})` }}
                >
                  {card.rarity}
                </div>
                {(card.type || (card as any).path) && (
                  <div className={styles.badgeItem}>{card.type || (card as any).path}</div>
                )}
                {card.cardClass && card.cardClass !== 'None' && (
                  <div className={styles.badgeItem}>{card.cardClass}</div>
                )}
              </div>
              <h2 className={styles.title}>{card.name}</h2>
              <h3 className={styles.subtitle}>{card.subtitle}</h3>
            </header>

            {sortedInstances.length > 1 && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <h4 style={{ color: 'var(--gold)', marginBottom: '0.8rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Suas Unidades Registradas ({sortedInstances.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  {sortedInstances.map((inst, idx) => (
                    <div 
                      key={inst.id}
                      onClick={() => setSelectedInstanceId(inst.id)}
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        padding: '0.6rem 1rem', 
                        background: inst.id === selectedInstanceId ? 'rgba(212,175,55,0.15)' : 'rgba(0,0,0,0.3)',
                        border: inst.id === selectedInstanceId ? '1px solid var(--gold)' : '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        color: inst.id === selectedInstanceId ? 'var(--gold)' : 'var(--text-secondary)'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <span>#{idx + 1}</span>
                        <span style={{ fontWeight: 'bold' }}>{inst.mintId || 'Cópia Legacy'}</span>
                        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(255,255,255,0.1)' }}>
                          {inst.source}
                        </span>
                      </div>
                      <span style={{ color: inst.bonusRoll > 0 ? '#00d2d3' : 'inherit' }}>
                        +{inst.bonusRoll.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.tagsContainer}>
              {traits.map(t => (
                <span key={t} className={styles.tag}>{t}</span>
              ))}
            </div>

            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Conhecimento Oculto</h4>
              <p className={styles.shortLore}>"{card.shortLore}"</p>
            </div>

            <div className={styles.section} style={{ flex: 1 }}>
              <h4 className={styles.sectionTitle}>Lore Ancestral</h4>
             <div className={styles.scrollLore}>
              {fullLore.split('\n').map((paragraph, i) => (
                <p key={i} className={styles.paragraph}>{paragraph}</p>
              ))}
             </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
