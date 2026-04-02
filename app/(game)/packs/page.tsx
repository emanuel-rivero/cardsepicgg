'use client';

import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';
import styles from './packs.module.css';

/**
 * Loja de pacotes.
 * Exibe estoque do usuario, permite compra por Epic Points e abertura via redirecionamento.
 */
export default function PacksPage() {
  const { allPacks, userPacks, currentUser, buyPack, addToast } = useApp();
  const router = useRouter();

  /** Executa compra de pacote e publica feedback via toast. */
  const handleBuy = (packId: string) => {
    const res = buyPack(packId);
    if (!res.success) {
      addToast('Erro', res.error || 'Erro na compra', 'error');
    } else {
      addToast('Sucesso!', 'Pacote adquirido e adicionado ao seu inventário.', 'success');
    }
  };

  /** Retorna quantidade atual de um pack no inventario do usuario. */
  const getQuantity = (packId: string): number => {
    return userPacks.find((up) => up.packId === packId)?.quantity || 0;
  };

  /**
   * Navega para /home com query param packId para iniciar a experiencia de abertura.
   */
  const handleOpen = (packId: string) => {
    router.push(`/home?packId=${packId}`);
  };

  const activePacks = allPacks.filter((p) => p.isActive);

  return (
    <div className={styles.page}>
      <div className="container">
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>Card Packs</h1>
          <p className={styles.subtitle}>Every pack holds the possibility of legend</p>
        </div>

        {/* Packs grid */}
        <div className={styles.grid}>
          {activePacks.map((pack) => {
            const qty = getQuantity(pack.id);
            const hasQty = qty > 0;

            return (
              <div key={pack.id} className={`${styles.packCard} ${!hasQty ? styles.locked : ''}`}>
                {/* Pack visual */}
                <div className={styles.packVisual}>
                  {pack.image && pack.image !== '' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pack.image} alt={pack.name} className={styles.packImg} />
                  ) : (
                    <div className={styles.packPlaceholder}>
                      <span className={styles.packIcon}>⚔</span>
                    </div>
                  )}
                  {/* Shimmer */}
                  <div className={styles.packShimmer} />
                  {/* Quantity badge */}
                  <div className={`${styles.qtyBadge} ${hasQty ? styles.qtyHas : styles.qtyEmpty}`}>
                    {qty}×
                  </div>
                </div>

                {/* Pack info */}
                <div className={styles.packInfo}>
                  <h2 className={styles.packName}>{pack.name}</h2>
                  <p className={styles.packDesc}>{pack.description}</p>

                  <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      Price: <strong style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>⚪ {pack.priceEpicPoints ?? 1000}</strong>
                    </div>
                    {currentUser ? (
                      <button
                        className="btn btn-outline"
                        disabled={(currentUser.epicPoints || 0) < (pack.priceEpicPoints ?? 1000)}
                        onClick={() => handleBuy(pack.id)}
                        style={{
                          padding: '0.4rem 1rem',
                          fontSize: '0.85rem',
                          width: 'fit-content',
                        }}
                      >
                        Buy Pack
                      </button>
                    ) : (
                      <p style={{ color: 'var(--gold)', fontSize: '0.85rem' }}>Log in to unlock purchase</p>
                    )}
                  </div>

                  <div className={styles.packMeta}>
                    <span className={styles.packMetaItem}>
                      🃏 {pack.cardsPerPack - 1}–{pack.cardsPerPack} cards per pack
                    </span>
                  </div>
                </div>

                {/* Action */}
                <div className={styles.packAction}>
                  {hasQty ? (
                    <button
                      id={`btn-open-pack-${pack.id}`}
                      className="btn btn-gold"
                      onClick={() => handleOpen(pack.id)}
                      style={{ width: '100%' }}
                    >
                      ✦ Open Pack ✦
                    </button>
                  ) : (
                    <div className={styles.noPacks}>
                      <span>No packs available</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {activePacks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '5rem 2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.4 }}>📦</div>
            <h2 style={{ fontFamily: 'Cinzel, serif', marginBottom: '0.5rem' }}>No packs available</h2>
            <p style={{ color: 'var(--text-muted)' }}>Check back later for new card packs.</p>
          </div>
        )}
      </div>
    </div>
  );
}
