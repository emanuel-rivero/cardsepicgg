'use client';

import { useState, useMemo, useCallback } from 'react';
import { useApp } from '@/lib/store';
import { Rarity } from '@/lib/types';
import { FUSION_TIERS, RARITY_COLORS, RARITY_GLOWS, calcFinalChance, AFP_MAX_CHANCE } from '@/lib/fusion';
import styles from './fusion.module.css';

type FusionPhase = 'idle' | 'selecting' | 'ready' | 'fusing' | 'result';

interface FusionResult {
  success: boolean;
  resultCardId?: string;
  afpEarned?: number;
}

const RARITY_ICONS: Record<string, string> = {
  Common: '◆', Uncommon: '◈', Rare: '★', Epic: '✦', Legendary: '♛', Mythic: '♜', Hero: '🜲',
};

const TYPE_GRADIENTS: Record<string, string> = {
  'Path of Arms': 'linear-gradient(160deg, #1f0a0a, #4a1515)',
  'Path of Wisdom': 'linear-gradient(160deg, #0a1020, #15254a)',
  'Path of Subterfuge': 'linear-gradient(160deg, #12002d, #2d0a50)',
  Enemy: 'linear-gradient(160deg, #1f0000, #3a0000)',
  NPC: 'linear-gradient(160deg, #181510, #3a2f20)',
  Gods: 'linear-gradient(160deg, #2a200a, #4a3a10)',
  Quest: 'linear-gradient(160deg, #001f10, #003a20)',
};

/**
 * Arena de fusao.
 * Controla selecao de instancias, gasto de AFP, execucao de fusao e feedback visual do resultado.
 */
export default function FusionPage() {
  const { currentUser, allCards, userCards, performFusion } = useApp();

  // Page state
  const [selectedTierIndex, setSelectedTierIndex] = useState(0);
  const [filterRarity, setFilterRarity] = useState<Rarity | 'All'>('All');
  const [selectedUserCardIds, setSelectedUserCardIds] = useState<string[]>([]);
  const [afpSpend, setAfpSpend] = useState(0);
  const [phase, setPhase] = useState<FusionPhase>('idle');
  const [fusionResult, setFusionResult] = useState<FusionResult | null>(null);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; color: string }[]>([]);

  const tier = FUSION_TIERS[selectedTierIndex];
  const afp = currentUser?.afp ?? 0;

  // ── Collection data ────────────────────────────────────────────────
  const ownedCards = useMemo(() => {
    return userCards
      .filter(uc => !!uc.cardId)
      .map(uc => {
        const card = allCards.find(c => c.id === uc.cardId);
        return card ? { userCard: uc, card } : null;
      })
      .filter(Boolean) as { userCard: typeof userCards[0]; card: typeof allCards[0] }[];
  }, [userCards, allCards]);

  const filteredCards = useMemo(() => {
    const rarity = tier.sourceRarity;
    return ownedCards.filter(({ card }) =>
      card.rarity === rarity &&
      (filterRarity === 'All' || card.rarity === filterRarity)
    );
  }, [ownedCards, tier.sourceRarity, filterRarity]);

  // ── Chance calculations ────────────────────────────────────────────
  const baseChance = tier.baseChance;
  const afpBonus = afpSpend * 0.02;
  const finalChance = calcFinalChance(baseChance, afpSpend);
  const isGuaranteed = tier.isGuaranteed;

  // ── Result card info ───────────────────────────────────────────────
  const resultCardPreview = useMemo(() => {
    const pool = allCards.filter(c => c.isActive && c.rarity === tier.targetRarity);
    return pool.length > 0 ? pool[0] : null;
  }, [allCards, tier.targetRarity]);

  const fusionResultCard = useMemo(() => {
    if (!fusionResult?.resultCardId) return null;
    return allCards.find(c => c.id === fusionResult.resultCardId) ?? null;
  }, [fusionResult, allCards]);

  // ── Handlers ───────────────────────────────────────────────────────
  /** Troca tier de fusao e reseta estado transiente da sessao atual. */
  const handleTierSelect = useCallback((index: number) => {
    setSelectedTierIndex(index);
    setSelectedUserCardIds([]);
    setAfpSpend(0);
    setPhase('idle');
    setFusionResult(null);
    setFilterRarity('All');
  }, []);

  /** Adiciona instancia selecionada aos slots de fusao respeitando limite do tier. */
  const handleAddCard = useCallback((ucId: string) => {
    setSelectedUserCardIds(prev => {
      const isAlreadySelected = prev.includes(ucId);
      if (isAlreadySelected) return prev;
      if (prev.length >= tier.requiredCount) return prev;

      const next = [...prev, ucId];
      if (next.length === tier.requiredCount) setPhase('ready');
      else setPhase('selecting');
      return next;
    });
  }, [tier.requiredCount]);

  /** Remove carta de um slot especifico e recalcula fase da interface. */
  const handleRemoveSlot = useCallback((indexToRemove: number) => {
    setSelectedUserCardIds(prev => {
      const next = prev.filter((_, i) => i !== indexToRemove);
      setPhase(next.length === 0 ? 'idle' : 'selecting');
      return next;
    });
  }, []);

  /** Gera particulas temporarias para reforcar sucesso/falha da fusao. */
  const spawnParticles = useCallback((success: boolean) => {
    const colors = success
      ? ['#d4af37', '#ffe680', '#b060ff', '#fff']
      : ['#dc3232', '#ff6060', '#800080', '#444'];
    const newParticles = Array.from({ length: 20 }, (_, i) => ({
      id: Date.now() + i,
      x: 50 + (Math.random() - 0.5) * 40,
      y: 50 + (Math.random() - 0.5) * 40,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 1600);
  }, []);

  /**
   * Executa a fusao com pequena pausa dramatica de animacao.
   * Encaminha a chamada para performFusion da store e projeta resultado na UI.
   */
  const handleFuse = useCallback(async () => {
    if (selectedUserCardIds.length !== tier.requiredCount) return;
    setPhase('fusing');

    // Brief animation delay for dramatic effect
    await new Promise(r => setTimeout(r, 1000));

    const result = performFusion(selectedUserCardIds, tier.sourceRarity, afpSpend);
    spawnParticles(result.success);

    setFusionResult({
      success: result.success,
      resultCardId: result.resultCard?.id,
      afpEarned: result.afpEarned,
    });
    setPhase('result');
  }, [selectedUserCardIds, tier, afpSpend, performFusion, spawnParticles]);

  /** Reinicia a sessao visual da fusao para nova tentativa. */
  const handleReset = useCallback(() => {
    setSelectedUserCardIds([]);
    setAfpSpend(0);
    setPhase('idle');
    setFusionResult(null);
  }, []);

  const isFusing = phase === 'fusing';
  const canFuse = phase === 'ready' && !isFusing;

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* Particles */}
      {particles.length > 0 && (
        <div className={styles.particlesContainer}>
          {particles.map(p => (
            <div
              key={p.id}
              className={styles.particle}
              style={{
                left: `${p.x}vw`,
                top: `${p.y}vh`,
                background: p.color,
                boxShadow: `0 0 6px ${p.color}`,
                '--tx': `${(Math.random() - 0.5) * 300}px`,
                '--ty': `${(Math.random() - 0.5) * 300}px`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}

      {/* Result Overlay */}
      {phase === 'result' && fusionResult && (
        <div className={styles.resultOverlay}>
          <div className={`${styles.resultModal} ${fusionResult.success ? styles.resultModalSuccess : styles.resultModalFailure}`}>
            <span className={styles.resultIcon}>
              {fusionResult.success ? '✨' : '💀'}
            </span>
            <h2 className={`${styles.resultTitle} ${fusionResult.success ? styles.resultTitleSuccess : styles.resultTitleFailure}`}>
              {fusionResult.success ? 'Fusão Arcana!' : 'Ritual Falhou'}
            </h2>
            <p className={styles.resultDesc}>
              {fusionResult.success
                ? `Uma carta ${tier.targetRarity} emergiu das chamas!`
                : 'As cartas foram consumidas pelas sombras...'}
            </p>

            {fusionResult.success && fusionResultCard && (
              <div className={styles.resultCardPreview}
                style={{ background: TYPE_GRADIENTS[fusionResultCard.type] ?? '#0a0020' }}>
                {fusionResultCard.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fusionResultCard.image} alt={fusionResultCard.name} className={styles.resultCardPreviewImg} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '2rem' }}>{RARITY_ICONS[fusionResultCard.rarity]}</span>
                    <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', color: RARITY_COLORS[fusionResultCard.rarity], textAlign: 'center', padding: '0 0.5rem' }}>{fusionResultCard.name}</span>
                  </div>
                )}
              </div>
            )}

            {fusionResult.afpEarned && (
              <div className={styles.resultAfpGain}>
                ✦ +{fusionResult.afpEarned} AFP {fusionResult.success ? 'de recompensa' : 'de consolação'}
              </div>
            )}

            <div className={styles.resultActions}>
              <button className="btn btn-primary" onClick={handleReset}>
                Nova Fusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LEFT: Collection ── */}
      <aside className={styles.leftPanel}>
        <div className={styles.panelHeader}>
          <p className={styles.panelTitle}>Cartas — {tier.sourceRarity}</p>
          <div className={styles.rarityFilters}>
            <button
              className={`${styles.rarityBtn} ${filterRarity === 'All' ? styles.rarityBtnActive : ''}`}
              style={{ ['--rarity-color' as string]: 'rgba(180,130,255,0.8)' }}
              onClick={() => setFilterRarity('All')}
            >Todas</button>
          </div>
        </div>

        <div className={styles.collectionScroll}>
          {filteredCards.length === 0 ? (
            <div className={styles.emptyState}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.4 }}>🔮</div>
              <p>Sem cartas {tier.sourceRarity} na coleção</p>
              <p style={{ fontSize: '0.72rem', marginTop: '0.3rem', opacity: 0.6 }}>Abra pacotes para conseguir mais cartas</p>
            </div>
          ) : (
            <div className={styles.collectionGrid}>
              {filteredCards.map(({ userCard, card }) => {
                const isSelected = selectedUserCardIds.includes(userCard.id);
                const isSlotsFull = selectedUserCardIds.length >= tier.requiredCount;
                const isDisabled = (isSelected) || (!isSelected && isSlotsFull);
                
                const cardColor = RARITY_COLORS[card.rarity];
                return (
                  <div
                    key={userCard.id}
                    className={`${styles.cardThumb} ${isSelected ? styles.cardThumbSelected : ''} ${isDisabled ? styles.cardThumbDisabled : ''}`}
                    style={{
                      background: TYPE_GRADIENTS[card.type] ?? '#0a0018',
                      borderColor: isSelected ? 'rgba(212,175,55,0.9)' : `${cardColor}33`,
                      position: 'relative'
                    }}
                    onClick={() => !isDisabled && handleAddCard(userCard.id)}
                    title={`${card.name}\nMint: ${userCard.mintId}\nBônus: +${userCard.bonusRoll.toFixed(2)}`}
                  >
                    {card.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={card.image} alt={card.name} className={styles.cardThumbImg} />
                    ) : (
                      <div className={styles.cardThumbPlaceholder} style={{ color: cardColor }}>
                        {RARITY_ICONS[card.rarity]}
                      </div>
                    )}
                    {userCard.bonusRoll > 0 && (
                      <span style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', background: '#00d2d3', color: '#000', fontSize: '0.6rem', padding: '0.1rem 0.3rem', borderRadius: '4px', fontWeight: 'bold', zIndex: 10 }}>
                        +{userCard.bonusRoll.toFixed(2)}
                      </span>
                    )}
                    {isSelected && (
                      <span className={styles.cardThumbCheckmark}>✓</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* ── CENTER: Fusion Arena ── */}
      <main className={styles.centerPanel}>
        <div className={styles.fusionHeader}>
          <h1 className={styles.fusionTitle}>⚗ Arcane Fusion</h1>
          <p className={styles.fusionSubtitle}>Fuse your cards to ascend their power.<br />Combine lower rarity cards to create something greater.</p>
        </div>

        {/* Tier selector */}
        <div className={styles.tierSelector}>
          {FUSION_TIERS.map((t, i) => (
            <button
              key={i}
              className={`${styles.tierBtn} ${selectedTierIndex === i ? styles.tierBtnActive : ''}`}
              onClick={() => handleTierSelect(i)}
              style={selectedTierIndex === i ? { ['--tier-color' as string]: RARITY_COLORS[t.sourceRarity] } : {}}
            >
              <span style={{ color: RARITY_COLORS[t.sourceRarity] }}>{RARITY_ICONS[t.sourceRarity]}</span>
              <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 2px' }}>→</span>
              <span style={{ color: RARITY_COLORS[t.targetRarity] }}>{RARITY_ICONS[t.targetRarity]}</span>
            </button>
          ))}
        </div>

        {/* Slots */}
        <div className={styles.ritualArea}>
          <div className={styles.slotsContainer}>
            {Array.from({ length: tier.requiredCount }).map((_, i) => {
              const ucId = selectedUserCardIds[i];
              const entry = ucId ? filteredCards.find(fc => fc.userCard.id === ucId) : null;
              const card = entry?.card;
              return (
                <div
                  key={i}
                  className={`${styles.slot} ${card ? styles.slotFilled : styles.slotEmpty}`}
                  style={card ? {
                    boxShadow: `0 0 12px ${RARITY_GLOWS[card.rarity]}, inset 0 0 8px ${RARITY_GLOWS[card.rarity]}55`,
                  } : {}}
                >
                  {card ? (
                    <div className={styles.slotCard}
                      style={{ background: TYPE_GRADIENTS[card.type] ?? '#0a0018' }}>
                      {card.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={card.image} alt={card.name} className={styles.slotCardImg} />
                      ) : (
                        <div className={styles.slotCardPlaceholder} style={{ color: RARITY_COLORS[card.rarity] }}>
                          {RARITY_ICONS[card.rarity]}
                        </div>
                      )}
                      <button
                        className={styles.slotRemoveBtn}
                        onClick={() => handleRemoveSlot(i)}
                        title="Remover"
                      >✕</button>
                    </div>
                  ) : (
                    <>
                      <span className={styles.slotEmptyIcon} style={{ color: RARITY_COLORS[tier.sourceRarity] }}>
                        {isFusing ? <span className={styles.fusingSpin}>🔮</span> : RARITY_ICONS[tier.sourceRarity]}
                      </span>
                      <span className={styles.slotEmptyLabel}>Slot {i + 1}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress */}
        <div className={styles.selectionProgress}>
          <p className={styles.progressLabel}>
            {selectedUserCardIds.length === tier.requiredCount
              ? `✦ ${tier.requiredCount} cartas selecionadas — Pronto!`
              : `Selecione ${tier.requiredCount - selectedUserCardIds.length} carta${tier.requiredCount - selectedUserCardIds.length !== 1 ? 's' : ''} mais`}
          </p>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${(selectedUserCardIds.length / tier.requiredCount) * 100}%` }}
            />
          </div>
        </div>

        {/* Arrow */}
        <div className={styles.fusionArrow}>▼</div>

        {/* Result preview */}
        <div style={{ textAlign: 'center' }}>
          <div
            className={styles.resultCard}
            style={{ borderColor: `${RARITY_COLORS[tier.targetRarity]}80`, background: 'rgba(20,0,40,0.6)' }}
          >
            {resultCardPreview ? (
              resultCardPreview.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resultCardPreview.image}
                  alt={resultCardPreview.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7, filter: `drop-shadow(0 0 8px ${RARITY_GLOWS[tier.targetRarity]})` }}
                />
              ) : (
                <span style={{ fontSize: '2.5rem', color: RARITY_COLORS[tier.targetRarity], filter: `drop-shadow(0 0 10px ${RARITY_GLOWS[tier.targetRarity]})` }}>
                  {RARITY_ICONS[tier.targetRarity]}
                </span>
              )
            ) : (
              <span className={styles.resultQuestion}>?</span>
            )}
          </div>
          <p className={styles.resultCardLabel} style={{ color: RARITY_COLORS[tier.targetRarity] }}>
            {tier.targetRarity} {RARITY_ICONS[tier.targetRarity]}
          </p>
        </div>

        {/* Fuse button */}
        <button
          className={`${styles.fuseBtn} ${canFuse ? styles.fuseBtnGlow : ''}`}
          onClick={handleFuse}
          disabled={!canFuse}
        >
          {isFusing ? '⚗ Ritualizando...' : '✦ Executar Fusão ✦'}
        </button>
      </main>

      {/* ── RIGHT: Details ── */}
      <aside className={styles.rightPanel}>

        {/* AFP Balance */}
        <div className={styles.detailCard}>
          <p className={styles.detailCardTitle}>⚗ Arcane Fusion Points</p>
          <div className={styles.afpBalance}>
            <span className={styles.afpIcon}>🔮</span>
            <div>
              <div className={styles.afpValue}>{afp}</div>
              <div className={styles.afpLabel}>AFP DISPONÍVEL</div>
            </div>
          </div>
          {!isGuaranteed && (
            <>
              <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginBottom: '0.5rem' }}>
                Gastar AFP (+2% por AFP, máx. 95%)
              </p>
              <div className={styles.afpSliderRow}>
                <input
                  type="range"
                  min={0}
                  max={Math.min(afp, Math.floor((AFP_MAX_CHANCE - baseChance) / 0.02))}
                  value={afpSpend}
                  onChange={e => setAfpSpend(Number(e.target.value))}
                  className={styles.afpSlider}
                />
                <span className={styles.afpSpendValue}>{afpSpend}</span>
              </div>
            </>
          )}
          {isGuaranteed && (
            <p style={{ fontSize: '0.72rem', color: 'rgba(46,204,113,0.7)' }}>
              Esta fusão não gasta AFP — sucesso garantido!
            </p>
          )}
        </div>

        {/* Chance Breakdown */}
        <div className={styles.detailCard}>
          <p className={styles.detailCardTitle}>🎲 Chance de Sucesso</p>
          {isGuaranteed ? (
            <span className={styles.guaranteedBadge}>✓ Garantida 100%</span>
          ) : (
            <>
              <div className={styles.chanceRow}>
                <span className={styles.chanceLabel}>Base</span>
                <span className={`${styles.chanceValue} ${styles.chanceBase}`}>{Math.round(baseChance * 100)}%</span>
              </div>
              {afpSpend > 0 && (
                <div className={styles.chanceRow}>
                  <span className={styles.chanceLabel}>Bônus AFP ({afpSpend}×)</span>
                  <span className={`${styles.chanceValue} ${styles.chanceBonus}`}>+{Math.round(afpBonus * 100)}%</span>
                </div>
              )}
              <hr className={styles.chanceDivider} />
              <div className={styles.chanceRow}>
                <span className={styles.chanceLabel}>Final</span>
                <span className={`${styles.chanceValue} ${styles.chanceFinal}`}>{Math.round(finalChance * 100)}%</span>
              </div>
            </>
          )}
        </div>

        {/* Fusion Summary */}
        <div className={styles.detailCard}>
          <p className={styles.detailCardTitle}>📋 Detalhes da Fusão</p>
          <div className={styles.tierSummaryRow}>
            <span className={styles.tierSummaryLabel}>Origem</span>
            <span className={styles.tierSummaryValue} style={{ color: RARITY_COLORS[tier.sourceRarity] }}>
              {RARITY_ICONS[tier.sourceRarity]} {tier.sourceRarity}
            </span>
          </div>
          <div className={styles.tierSummaryRow}>
            <span className={styles.tierSummaryLabel}>Necessário</span>
            <span className={styles.tierSummaryValue}>{tier.requiredCount} cartas</span>
          </div>
          <div className={styles.tierSummaryRow}>
            <span className={styles.tierSummaryLabel}>Resultado</span>
            <span className={styles.tierSummaryValue} style={{ color: RARITY_COLORS[tier.targetRarity] }}>
              {RARITY_ICONS[tier.targetRarity]} {tier.targetRarity}
            </span>
          </div>
          <div className={styles.tierSummaryRow}>
            <span className={styles.tierSummaryLabel}>Selecionadas</span>
            <span className={styles.tierSummaryValue}>{selectedUserCardIds.length} / {tier.requiredCount}</span>
          </div>
          <div className={styles.afpRewardPreview}>
            ✦ Sucesso → +{tier.afpReward} AFP
          </div>
          {!isGuaranteed && (
            <div className={styles.afpRewardPreview} style={{ borderColor: 'rgba(220,80,80,0.3)', color: 'rgba(220,120,120,0.8)', background: 'rgba(220,50,50,0.06)', marginTop: '0.4rem' }}>
              💀 Falha → +5 AFP de consolação
            </div>
          )}
        </div>

      </aside>
    </div>
  );
}
