'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/lib/store';
import { playPackOpeningMusic, playHornOfGondor, playPerfectRollFanfare } from '@/lib/audio';
import CardModal from '@/components/CardModal';

// Phases: idle → shaking → tearing → burst → revealing → done
type Phase = 'idle' | 'shaking' | 'tearing' | 'burst' | 'revealing' | 'done';

// Jagged tear path points (percentage-based, y at ~50%)
const TEAR_TOP = `polygon(
  0% 0%, 100% 0%, 100% 46%,
  92% 52%, 83% 45%, 74% 53%, 65% 47%,
  56% 54%, 47% 46%, 38% 53%, 29% 46%,
  20% 52%, 11% 46%, 0% 51%
)`;
const TEAR_BOTTOM = `polygon(
  0% 51%, 11% 46%, 20% 52%, 29% 46%,
  38% 53%, 47% 46%, 56% 54%, 65% 47%,
  74% 53%, 83% 45%, 92% 52%, 100% 46%,
  100% 100%, 0% 100%
)`;

/**
 * Orquestra a experiencia de abertura de pacotes.
 * Controla fases de animacao, efeitos sonoros, sorteio de cartas e revelacao progressiva.
 */
export default function PackOpener() {
  const { userPacks, allPacks, openPack, userCards, allCards } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlPackId = searchParams.get('packId');

  const [phase, setPhase] = useState<Phase>('idle');
  const [revealedCards, setRevealedCards] = useState<ReturnType<typeof openPack>['cards']>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [modalCardId, setModalCardId] = useState<string | null>(null);
  const [luckyMoment, setLuckyMoment] = useState<{ card: { id: string; name: string; image?: string; rarity: string } } | null>(null);
  const luckyDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Pick the pack from URL param, or fall back to first available
  useEffect(() => {
    if (urlPackId) {
      const fromUrl = userPacks.find((up) => up.packId === urlPackId && up.quantity > 0);
      if (fromUrl) { setSelectedPackId(fromUrl.packId); return; }
    }
    setSelectedPackId(null);
  }, [userPacks, urlPackId]);

  /** Limpa todos os timers ativos para evitar race conditions entre fases. */
  const clearTimers = () => {
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];
  };

  /** Registra timeout para posterior cleanup centralizado. */
  const push = (t: ReturnType<typeof setTimeout>) => timerRefs.current.push(t);

  /**
   * Faz flip da carta revelada na primeira interacao.
   * Nas interacoes seguintes (carta ja virada), abre o CardModal de detalhes.
   * Se a carta for Perfect Roll, aciona o Lucky Pack Moment.
   */
  const handleCardClick = (index: number, isNew: boolean, cardId: string) => {
    if (!flippedCards[index]) {
      setFlippedCards((prev) => ({ ...prev, [index]: true }));

      // Check if this is a Perfect Roll — Lucky Pack Moment!
      const instances = userCards.filter(uc => uc.cardId === cardId);
      const freshInstance = instances.sort((a, b) =>
        new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime()
      )[0];

      if (freshInstance?.rollQuality === 'Perfect Roll') {
        // Small delay so the card flip starts first
        setTimeout(() => {
          const cardDef = allCards.find(c => c.id === cardId);
          if (cardDef) {
            playPerfectRollFanfare(audioCtxRef);
            setLuckyMoment({ card: cardDef });
            // Auto-dismiss after 6s
            if (luckyDismissRef.current) clearTimeout(luckyDismissRef.current);
            luckyDismissRef.current = setTimeout(() => setLuckyMoment(null), 6000);
          }
        }, 400);
      } else if (isNew) {
        playHornOfGondor(audioCtxRef);
      }
    } else {
      // Card already flipped — open detail modal
      setModalCardId(cardId);
    }
  };

  const dismissLuckyMoment = () => {
    if (luckyDismissRef.current) clearTimeout(luckyDismissRef.current);
    setLuckyMoment(null);
  };

  /**
   * Inicia pipeline de abertura do pack:
   * shaking -> tearing -> burst -> openPack(store) -> reveal sequencial.
   */
  const handleOpen = (forcePackId?: string) => {
    const targetId = forcePackId || selectedPackId;
    if (!targetId || phase !== 'idle') return;
    setError('');

    if (forcePackId) {
      setSelectedPackId(forcePackId);
    }

    // 1. Shake
    setPhase('shaking');
    push(setTimeout(() => {
      // 2. Tear
      setPhase('tearing');
      playPackOpeningMusic(audioCtxRef);
      push(setTimeout(() => {
        // 3. Burst flash
        setPhase('burst');
        push(setTimeout(() => {
          // 4. Roll cards
          const result = openPack(targetId);
          if (!result.success || !result.cards) {
            setError(result.error || 'Failed to open pack.');
            setPhase('idle');
            return;
          }
          setRevealedCards(result.cards);
          setVisibleCount(0);
          setFlippedCards({});
          setPhase('revealing');

          result.cards.forEach((_, i) => {
            push(setTimeout(() => setVisibleCount(i + 1), i * 350));
          });
          push(setTimeout(() => setPhase('done'), result.cards.length * 350 + 500));
        }, 350));
      }, 700));
    }, 650));
  };

  /** Reseta estado visual para nova abertura manual. */
  const handleReset = () => {
    clearTimers();
    setPhase('idle');
    setRevealedCards([]);
    setVisibleCount(0);
    setFlippedCards({});
    setFlippedCards({});
    setSelectedPackId(null);
  };

  /** Revela todas as cartas atualmente visiveis e dispara audio de destaque quando aplicavel. */
  const handleRevealAll = () => {
    if (phase !== 'revealing' && phase !== 'done') return;
    const newFlips: Record<number, boolean> = { ...flippedCards };
    let hasNew = false;
    
    if (!revealedCards) return;
    revealedCards.forEach((rc, index) => {
      if (index < visibleCount && !flippedCards[index]) {
        newFlips[index] = true;
        if (rc.isNew) hasNew = true;
      }
    });

    setFlippedCards(newFlips);
    if (hasNew) {
      playHornOfGondor(audioCtxRef);
    }
  };

  useEffect(() => () => clearTimers(), []);

  const pack = selectedPackId ? allPacks.find((p) => p.id === selectedPackId) : null;
  const totalPacks = userPacks.reduce((sum, up) => sum + up.quantity, 0);

  const RARITY_GLOW: Record<string, string> = {
    Common: 'rgba(138,151,171,0.3)',
    Uncommon: 'rgba(46,204,113,0.35)',
    Rare: 'rgba(74,158,255,0.45)',
    Epic: 'rgba(192,98,240,0.6)',
    Legendary: 'rgba(240,180,48,0.75)',
    Mythic: 'rgba(255,71,87,0.85)',
    Hero: 'rgba(0,210,211,0.95)',
  };

  const TAG_BG: Record<string, string> = { Common: 'rgba(138,151,171,0.15)', Uncommon: 'rgba(46,204,113,0.15)', Rare: 'rgba(74,158,255,0.15)', Epic: 'rgba(192,98,240,0.15)', Legendary: 'rgba(240,180,48,0.15)', Mythic: 'rgba(255,71,87,0.15)', Hero: 'rgba(0,210,211,0.15)' };
  const TAG_COLOR: Record<string, string> = { Common: 'var(--rarity-common)', Uncommon: 'var(--rarity-uncommon)', Rare: 'var(--rarity-rare)', Epic: 'var(--rarity-epic)', Legendary: 'var(--rarity-legendary)', Mythic: 'var(--rarity-mythic)', Hero: 'var(--rarity-hero)' };
  const TAG_BORDER: Record<string, string> = { Common: 'rgba(138,151,171,0.3)', Uncommon: 'rgba(46,204,113,0.35)', Rare: 'rgba(74,158,255,0.35)', Epic: 'rgba(192,98,240,0.35)', Legendary: 'rgba(240,180,48,0.35)', Mythic: 'rgba(255,71,87,0.35)', Hero: 'rgba(0,210,211,0.35)' };
  const CARD_BORDER: Record<string, string> = { Common: 'var(--border-default)', Uncommon: 'rgba(46,204,113,0.5)', Rare: 'rgba(74,158,255,0.5)', Epic: 'rgba(192,98,240,0.7)', Legendary: 'var(--gold)', Mythic: 'rgba(255,71,87,0.8)', Hero: 'rgba(0,210,211,0.8)' };

  const TYPE_GRADIENT: Record<string, string> = {
    'Path of Arms': 'linear-gradient(160deg, #1f0a0a, #4a1515, #100505)',
    'Path of Wisdom': 'linear-gradient(160deg, #0a1020, #15254a, #050810)',
    'Path of Subterfuge': 'linear-gradient(160deg, #12002d, #2d0a50, #080015)',
    Enemy: 'linear-gradient(160deg, #1f0000, #3a0000, #050000)',
    NPC: 'linear-gradient(160deg, #181510, #3a2f20, #100a05)',
    Gods: 'linear-gradient(160deg, #2a200a, #4a3a10, #1a1005)',
    Quest: 'linear-gradient(160deg, #001f10, #003a20, #001005)',
  };
  const TYPE_ICON: Record<string, string> = {
    'Path of Arms': '⚔', 'Path of Wisdom': '📖', 'Path of Subterfuge': '☽', Enemy: '💀', NPC: '🗣', Gods: '✧', Quest: '📜',
  };
  const RARITY_ICON: Record<string, string> = {
    Common: '◆', Uncommon: '◈', Rare: '★', Epic: '✦', Legendary: '♛', Mythic: '♜', Hero: '🜲',
  };

  /** Render helper para badge de raridade na face frontal da carta revelada. */
  const renderRarityStars = (rarity: string) => {
    if (rarity === 'Mythic' || rarity === 'Hero') {
      return <>{RARITY_ICON[rarity]} {rarity}</>;
    }
    const starCount = { Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Legendary: 5 }[rarity as string] || 1;
    return <>{Array(starCount).fill('★').join('')}</>;
  };

  // Pack visual (shared between top/bottom halves)
  const packImage = pack?.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={pack.image} alt={pack.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
  ) : (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(160deg, #0a0020, #1e0050, #080015)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem',
    }}>
      <div style={{ fontSize: '4rem', opacity: 0.8, filter: 'drop-shadow(0 0 20px rgba(168,85,247,0.8))' }}>⚔</div>
      <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.75rem', color: 'rgba(212,175,55,0.8)', textAlign: 'center', letterSpacing: '0.1em', padding: '0 1rem' }}>
        {pack?.name}
      </div>
      <div style={{ position: 'absolute', inset: 10, border: '1px solid rgba(212,175,55,0.2)', borderRadius: 10, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', fontSize: '1.5rem', opacity: 0.3, letterSpacing: '0.5rem' }}>✦ ✦ ✦</div>
    </div>
  );

  const isTearing = phase === 'tearing';
  const isBurst = phase === 'burst';
  const showPack = phase === 'idle' || phase === 'shaking' || phase === 'tearing' || phase === 'burst';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', position: 'relative', overflow: 'hidden' }}>

      {/* Ambient background glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 70% 70% at 50% 50%, rgba(124,58,237,0.07) 0%, transparent 70%)',
      }} />

      {/* ── Burst flash overlay ── */}
      {isBurst && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 80% 80% at 50% 50%, rgba(255,220,120,0.55) 0%, rgba(168,85,247,0.35) 40%, transparent 75%)',
          animation: 'burstFlash 0.35s ease-out forwards',
        }} />
      )}

      {/* ── PHASE: idle / shaking / tearing / burst ── */}
      {showPack && (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>

          {totalPacks === 0 ? (
            <div style={{ textAlign: 'center', maxWidth: 400 }}>
              <div style={{ fontSize: '4rem', marginBottom: '1.5rem', opacity: 0.4 }}>📦</div>
              <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                No Packs Available
              </h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                You have no packs to open. Check the Packs page to learn more.
              </p>
              <button className="btn btn-ghost" onClick={() => router.push('/packs')}>View Packs</button>
            </div>
          ) : !selectedPackId && phase === 'idle' ? (
            <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
              <div style={{ textAlign: 'center' }}>
                <h1 style={{
                  fontFamily: 'Cinzel, serif', fontSize: 'clamp(1.4rem, 3.5vw, 2.2rem)', letterSpacing: '0.08em',
                  background: 'linear-gradient(135deg, var(--gold-dark), var(--gold-light), var(--gold-dark))',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>
                  SEUS PACOTES DISPONÍVEIS
                </h1>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.4rem', fontSize: '1rem' }}>
                  Escolha qual pacote deseja abrir
                </p>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'center' }}>
                {userPacks.filter(up => up.quantity > 0)
                  .map(up => ({ up, pack: allPacks.find(x => x.id === up.packId) }))
                  .filter(({ pack }) => !!pack)
                  .sort((a, b) => (a.pack!.priceEpicPoints || 0) - (b.pack!.priceEpicPoints || 0))
                  .map(({ up, pack: p }) => {
                  if (!p) return null;
                  return (
                    <div key={up.packId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        onClick={() => handleOpen(up.packId)}
                        style={{
                          position: 'relative', width: 170, height: 240, cursor: 'pointer',
                          borderRadius: 12, border: '1px solid rgba(212,175,55,0.4)',
                          overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                          transition: 'transform 0.2s', display: 'flex', flexDirection: 'column',
                          background: 'linear-gradient(160deg, #0a0020, #1e0050, #080015)',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-8px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                      >
                        {p.image ? (
                          <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '1rem' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '3rem' }}>⚔</span>
                          </div>
                        )}
                        <div style={{
                          position: 'absolute', top: 5, right: 5,
                          background: 'var(--purple)', color: '#fff',
                          fontWeight: 'bold', padding: '0.2rem 0.6rem',
                          borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)'
                        }}>
                          {up.quantity}x
                        </div>
                      </div>
                      <div style={{
                        fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: 'var(--gold)',
                        textAlign: 'center', maxWidth: 170, letterSpacing: '0.03em'
                      }}>
                        {p.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              <div style={{ textAlign: 'center' }}>
                <h1 style={{
                  fontFamily: 'Cinzel, serif', fontSize: 'clamp(1.4rem, 3.5vw, 2.2rem)', letterSpacing: '0.08em',
                  background: 'linear-gradient(135deg, var(--gold-dark), var(--gold-light), var(--gold-dark))',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>
                  {pack?.name || 'Card Pack'}
                </h1>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.4rem', fontSize: '0.88rem' }}>
                  You have <strong style={{ color: 'var(--text-secondary)' }}>{totalPacks}</strong> pack{totalPacks !== 1 ? 's' : ''} available
                </p>
              </div>

              {/* ── Pack with tear animation ── */}
              <div
                id="pack-open-btn"
                onClick={() => handleOpen()}
                style={{
                  position: 'relative',
                  width: 200, height: 280,
                  cursor: phase === 'idle' ? 'pointer' : 'default',
                  animation: phase === 'idle' ? 'packIdle 3s ease-in-out infinite' :
                              phase === 'shaking' ? 'packShake 0.65s ease' : 'none',
                }}
              >
                {/* Glow ring behind the pack */}
                {!isTearing && !isBurst && (
                  <div style={{
                    position: 'absolute', inset: -40, borderRadius: '50%',
                    background: 'radial-gradient(ellipse at 50% 50%, rgba(124,58,237,0.3) 0%, transparent 65%)',
                    animation: phase === 'idle' ? 'glowPulse 2.5s ease-in-out infinite' : 'none',
                    pointerEvents: 'none',
                  }} />
                )}

                {/* The pack — normal when idle/shaking */}
                {!isTearing && !isBurst && (
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: 16, overflow: 'hidden',
                    border: '2px solid rgba(212,175,55,0.4)',
                    boxShadow: '0 0 40px rgba(124,58,237,0.4), 0 20px 60px rgba(0,0,0,0.6)',
                  }}>
                    {packImage}
                    {/* Shimmer */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.07) 50%, transparent 60%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 3s linear infinite',
                      pointerEvents: 'none',
                    }} />
                  </div>
                )}

                {/* TEAR: top half flies up-left */}
                {(isTearing || isBurst) && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    clipPath: TEAR_TOP,
                    borderRadius: 16,
                    overflow: 'hidden',
                    transformOrigin: 'center bottom',
                    animation: 'tearTop 0.7s cubic-bezier(0.55,0,0.7,1) forwards',
                    filter: 'drop-shadow(-6px -10px 20px rgba(212,175,55,0.6))',
                    zIndex: 2,
                  }}>
                    {packImage}
                  </div>
                )}

                {/* TEAR: bottom half flies down-right */}
                {(isTearing || isBurst) && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    clipPath: TEAR_BOTTOM,
                    borderRadius: 16,
                    overflow: 'hidden',
                    transformOrigin: 'center top',
                    animation: 'tearBottom 0.7s cubic-bezier(0.55,0,0.7,1) forwards',
                    filter: 'drop-shadow(6px 10px 20px rgba(124,58,237,0.6))',
                    zIndex: 2,
                  }}>
                    {packImage}
                  </div>
                )}

                {/* Tear glow burst from the middle */}
                {(isTearing || isBurst) && (
                  <div style={{
                    position: 'absolute', top: '44%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 200, height: 60,
                    background: 'radial-gradient(ellipse at 50% 50%, rgba(255,220,100,0.9) 0%, rgba(168,85,247,0.6) 40%, transparent 75%)',
                    filter: 'blur(8px)',
                    animation: 'tearGlow 0.7s ease-out forwards',
                    zIndex: 1,
                    pointerEvents: 'none',
                  }} />
                )}

                {/* Particle sparks */}
                {(isTearing || isBurst) && [
                  { dx: -70, dy: -60, delay: 0 },
                  { dx: 80, dy: -80, delay: 0.05 },
                  { dx: -50, dy: 70, delay: 0.08 },
                  { dx: 60, dy: 50, delay: 0.03 },
                  { dx: -100, dy: 10, delay: 0.1 },
                  { dx: 110, dy: -10, delay: 0.06 },
                  { dx: 20, dy: -100, delay: 0.04 },
                  { dx: -30, dy: 90, delay: 0.09 },
                ].map((p, i) => (
                  <div key={i} style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    width: 8, height: 8,
                    borderRadius: '50%',
                    background: i % 3 === 0 ? 'var(--gold)' : i % 3 === 1 ? 'rgba(168,85,247,0.9)' : '#fff',
                    boxShadow: i % 3 === 0 ? '0 0 8px var(--gold)' : '0 0 8px rgba(168,85,247,0.8)',
                    animation: `spark${i % 4} 0.7s ${p.delay}s ease-out forwards`,
                    opacity: 0,
                    zIndex: 5,
                    '--dx': `${p.dx}px`,
                    '--dy': `${p.dy}px`,
                  } as React.CSSProperties} />
                ))}
              </div>

              {/* Open button (only when idle) */}
              {phase === 'idle' && (
                <div style={{ textAlign: 'center', animation: 'fadeInUp 0.5s ease' }}>
                  <button
                    id="btn-open-pack"
                    className="btn btn-primary"
                    style={{ marginTop: '2rem', padding: '1rem 3rem', fontSize: '1rem', letterSpacing: '0.1em' }}
                    onClick={() => handleOpen()}
                  >
                    ✦ Open Pack ✦
                  </button>
                  <p style={{ marginTop: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Click the pack or the button to open
                  </p>
                </div>
              )}

              {/* Tearing hint text */}
              {phase === 'shaking' && (
                <p style={{ color: 'var(--gold)', fontSize: '0.9rem', fontFamily: 'Cinzel, serif', letterSpacing: '0.05em', animation: 'fadeIn 0.3s ease' }}>
                  Tearing open...
                </p>
              )}

              {error && <p style={{ color: '#ff8080', fontSize: '0.9rem' }}>{error}</p>}
            </>
          )}
        </div>
      )}

      {/* ── PHASE: revealing / done ── */}
      {(phase === 'revealing' || phase === 'done') && (
        <div style={{ width: '100%', maxWidth: 1100, textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
          <h2 style={{
            fontFamily: 'Cinzel, serif', fontSize: 'clamp(1.2rem, 3vw, 1.8rem)',
            letterSpacing: '0.08em', marginBottom: '0.5rem',
            background: 'linear-gradient(135deg, var(--gold-dark), var(--gold-light))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            Cards Revealed!
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem', fontSize: '0.9rem' }}>
            {revealedCards?.length} cards added to your collection
          </p>

          {/* Cards row */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '1.5rem', flexWrap: 'wrap' }}>
            {revealedCards?.map((item, i) => {
              const { card, isNew } = item;
              const isFlipped = flippedCards[i];
              return (
              <div
                key={`${card.id}-${i}`}
                style={{
                  opacity: i < visibleCount ? 1 : 0,
                  transform: i < visibleCount ? 'none' : 'translateY(-30px) scale(0.8)',
                  transition: 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.34,1.56,0.64,1)',
                  transitionDelay: `${i * 0.05}s`,
                  perspective: '1000px',
                }}
              >
                <div style={{
                  animation: i < visibleCount ? 'cardReveal 0.6s cubic-bezier(0.34,1.56,0.64,1) both' : 'none',
                  transformStyle: 'preserve-3d',
                }}>
                  <div 
                    onClick={() => handleCardClick(i, isNew, card.id)}
                    style={{
                      width: 'clamp(150px, 20vw, 210px)',
                      height: 'clamp(210px, 28vw, 294px)',
                      position: 'relative',
                      transformStyle: 'preserve-3d',
                      transition: 'transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                      transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                      cursor: isFlipped ? 'zoom-in' : 'pointer',
                    }}
                  >
                  {/* FRONT (Face Down) */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    backfaceVisibility: 'hidden',
                    borderRadius: 14,
                    background: 'linear-gradient(160deg, #18181b, #27272a, #09090b)',
                    border: '2px solid rgba(212,175,55,0.7)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{ fontSize: '3.5rem', opacity: 1, filter: 'drop-shadow(0 0 15px rgba(212,175,55,0.6))' }}>⚔</div>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: 'rgba(212,175,55,0.9)', marginTop: '0.8rem', letterSpacing: '0.15em', fontWeight: 700 }}>
                      EPIC.GG
                    </div>
                  </div>

                  {/* BACK (Face Up) */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    borderRadius: 14, overflow: 'hidden',
                    background: 'var(--bg-card)',
                    border: `2px solid ${CARD_BORDER[card.rarity] || 'var(--border-default)'}`,
                    boxShadow: `0 8px 40px ${RARITY_GLOW[card.rarity]}, 0 4px 20px rgba(0,0,0,0.5)`,
                    display: 'flex', flexDirection: 'column',
                  }}>
                    {/* Art area */}
                    <div style={{ flex: 1, background: TYPE_GRADIENT[card.type], display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                      {card.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={card.image} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', opacity: 0.65, filter: `drop-shadow(0 0 15px ${RARITY_GLOW[card.rarity]})` }}>
                          {TYPE_ICON[card.type]}
                        </span>
                      )}
                      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 100%, ${RARITY_GLOW[card.rarity]} 0%, transparent 70%)`, pointerEvents: 'none' }} />
                      {card.rarity === 'Legendary' && (
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(105deg, transparent 40%, rgba(255,220,100,0.15) 50%, transparent 60%)', backgroundSize: '200% 100%', animation: 'shimmer 2s linear infinite', pointerEvents: 'none' }} />
                      )}
                      {card.rarity === 'Mythic' && (
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(105deg, transparent 40%, rgba(255,71,87,0.25) 50%, transparent 60%)', backgroundSize: '200% 100%', animation: 'shimmer 2s linear infinite', pointerEvents: 'none' }} />
                      )}
                      {card.rarity === 'Hero' && (
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(105deg, transparent 40%, rgba(0,210,211,0.25) 50%, transparent 60%)', backgroundSize: '200% 100%', animation: 'shimmer 2s linear infinite', pointerEvents: 'none' }} />
                      )}
                    </div>
                    {/* Info */}
                    <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{card.cardClass}</span>
                        <span style={{
                          fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                          padding: '0.15rem 0.5rem', borderRadius: 999,
                          background: TAG_BG[card.rarity] || TAG_BG.Common,
                          color: TAG_COLOR[card.rarity] || TAG_COLOR.Common,
                          border: `1px solid ${TAG_BORDER[card.rarity] || TAG_BORDER.Common}`,
                        }}>
                          {renderRarityStars(card.rarity)}
                        </span>
                      </div>
                      <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{card.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{card.subtitle}</div>
                    </div>
                  </div>
                </div>
                </div>
                {isFlipped && isNew && (
                  <div style={{ marginTop: '0.5rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.8, animation: 'fadeIn 0.4s ease' }}>
                    ✦ NEW ✦
                  </div>
                )}
                {isFlipped && !isNew && (
                  <div style={{ marginTop: '0.5rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.6, animation: 'fadeIn 0.4s ease' }}>
                    Duplicate
                  </div>
                )}
                {isFlipped && (
                  <div style={{ marginTop: '0.3rem', textAlign: 'center', fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em', animation: 'fadeIn 0.6s ease 0.2s both' }}>
                    🔍 clique para detalhes
                  </div>
                )}
              </div>
            )})}
          </div>

          {/* Reveal All Button */}
          {(phase === 'done' || visibleCount === (revealedCards?.length ?? 0)) && Object.keys(flippedCards).length < (revealedCards?.length ?? 0) && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem', animation: 'fadeInUp 0.4s ease' }}>
              <button 
                id="btn-reveal-all"
                className="btn btn-outline" 
                onClick={handleRevealAll}
              >
                ✦ Reveal All ✦
              </button>
            </div>
          )}

          {/* Actions */}
          {phase === 'done' && (
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2.5rem', animation: 'fadeInUp 0.4s ease' }}>
              <button
                id="btn-open-another"
                className="btn btn-gold"
                onClick={handleReset}
                style={{ opacity: userPacks.find(up => up.quantity > 0) ? 1 : 0.4 }}
                disabled={!userPacks.find(up => up.quantity > 0)}
              >
                Open Another
              </button>
              <button id="btn-view-collection" className="btn btn-ghost" onClick={() => router.push('/collection')}>
                View Collection
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Lucky Pack Moment Overlay ── */}
      {luckyMoment && (
        <div
          onClick={dismissLuckyMoment}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(20,12,0,0.92) 0%, rgba(0,0,0,0.97) 100%)',
            animation: 'luckyFadeIn 0.5s ease',
          }}
        >
          {/* Cinematic black bars */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '8vh', background: '#000', zIndex: 2 }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '8vh', background: '#000', zIndex: 2 }} />

          {/* God rays — radiating golden beams */}
          {[...Array(12)].map((_, i) => (
            <div key={i} style={{
              position: 'absolute',
              top: '50%', left: '50%',
              width: '3px',
              height: '55vh',
              transformOrigin: '50% 0%',
              transform: `rotate(${i * 30}deg)`,
              background: `linear-gradient(to bottom, rgba(255,215,0,${0.15 + (i % 3) * 0.05}), transparent)`,
              animation: `godRaySpin ${8 + (i % 3) * 2}s linear infinite`,
              filter: 'blur(4px)',
              pointerEvents: 'none',
            }} />
          ))}

          {/* Radial core glow */}
          <div style={{
            position: 'absolute',
            width: '40vw', height: '40vw', maxWidth: 500, maxHeight: 500,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at 50% 50%, rgba(255,200,50,0.18) 0%, rgba(255,140,0,0.08) 40%, transparent 70%)',
            animation: 'luckyCorePulse 1.5s ease-in-out infinite',
            pointerEvents: 'none',
          }} />

          {/* Floating gold particles */}
          {[...Array(30)].map((_, i) => {
            const left = 5 + (i * 37 % 90);
            const size = 3 + (i * 13 % 6);
            const delay = (i * 0.17) % 2.5;
            const dur = 2.5 + (i * 0.3 % 2);
            return (
              <div key={i} style={{
                position: 'absolute',
                bottom: `${8 + (i * 11 % 30)}vh`,
                left: `${left}%`,
                width: size, height: size,
                borderRadius: '50%',
                background: i % 4 === 0 ? '#fff' : i % 3 === 0 ? '#ffd700' : i % 2 === 0 ? '#ffaa00' : '#ffe066',
                boxShadow: `0 0 ${size * 2}px ${i % 2 === 0 ? '#ffd700' : '#fff'}`,
                animation: `luckyParticle ${dur}s ${delay}s ease-in infinite`,
                pointerEvents: 'none',
              }} />
            );
          })}

          {/* Card art featured */}
          <div style={{
            position: 'relative', zIndex: 5,
            marginBottom: '2rem',
            animation: 'luckyCardZoom 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both',
          }}>
            {/* Golden halo ring */}
            <div style={{
              position: 'absolute', inset: -20,
              borderRadius: 20,
              border: '2px solid rgba(255,215,0,0.6)',
              boxShadow: '0 0 40px rgba(255,200,0,0.5), 0 0 80px rgba(255,160,0,0.3), inset 0 0 30px rgba(255,215,0,0.1)',
              animation: 'luckyHaloFlicker 1.2s ease-in-out infinite',
              pointerEvents: 'none',
            }} />
            <div style={{
              width: 'clamp(160px, 18vw, 220px)',
              height: 'clamp(224px, 25.2vw, 308px)',
              borderRadius: 14, overflow: 'hidden',
              border: '3px solid #ffd700',
              boxShadow: '0 0 60px rgba(255,215,0,0.7), 0 0 120px rgba(255,160,0,0.3)',
            }}>
              {luckyMoment.card.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={luckyMoment.card.image} alt={luckyMoment.card.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #2a1500, #5a3200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '4rem' }}>⚔</div>
              )}
            </div>
          </div>

          {/* Text block */}
          <div style={{ position: 'relative', zIndex: 5, textAlign: 'center', animation: 'luckyTextRise 0.6s 0.3s ease both' }}>
            <div style={{
              fontFamily: 'Cinzel, serif',
              fontSize: 'clamp(0.65rem, 1.5vw, 0.85rem)',
              letterSpacing: '0.4em',
              color: 'rgba(255,215,0,0.7)',
              textTransform: 'uppercase',
              marginBottom: '0.4rem',
            }}>
              ✦ Lucky Pack Moment ✦
            </div>
            <div style={{
              fontFamily: 'Cinzel, serif',
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              fontWeight: 900,
              letterSpacing: '0.12em',
              background: 'linear-gradient(135deg, #ffe566, #ffd700, #ff9900, #ffd700, #ffe566)',
              backgroundSize: '300% 100%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: 'luckyGoldShimmer 2s linear infinite',
              textShadow: 'none',
              filter: 'drop-shadow(0 0 20px rgba(255,200,0,0.5))',
            }}>
              PERFECT ROLL
            </div>
            <div style={{
              fontFamily: 'Cinzel, serif',
              fontSize: 'clamp(0.9rem, 2vw, 1.2rem)',
              color: 'rgba(255,255,255,0.85)',
              marginTop: '0.5rem',
              letterSpacing: '0.05em',
            }}>
              {luckyMoment.card.name}
            </div>
            <div style={{
              marginTop: '2rem',
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.3)',
              letterSpacing: '0.1em',
              animation: 'fadeIn 1s 2s both',
            }}>
              Clique em qualquer lugar para continuar
            </div>
          </div>
        </div>
      )}

      {/* ── Card Detail Modal ── */}
      {modalCardId && (() => {
        const card = allCards.find(c => c.id === modalCardId);
        if (!card) return null;
        const instances = userCards.filter(uc => uc.cardId === modalCardId);
        return (
          <CardModal
            card={card}
            ownedQuantity={instances.length}
            userInstances={instances}
            onClose={() => setModalCardId(null)}
          />
        );
      })()}

      {/* ── All keyframes ── */}
      <style>{`
        @keyframes packIdle {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          25%       { transform: translateY(-12px) rotate(-1.5deg); }
          75%       { transform: translateY(-6px) rotate(1deg); }
        }
        @keyframes packShake {
          0%, 100% { transform: rotate(0deg) scale(1); }
          15%  { transform: rotate(-8deg) scale(1.06); }
          30%  { transform: rotate(8deg) scale(1.1); }
          45%  { transform: rotate(-6deg) scale(1.08); }
          60%  { transform: rotate(6deg) scale(1.05); }
          80%  { transform: rotate(-3deg) scale(1.03); }
        }

        /* Top half tears upward-left and rotates */
        @keyframes tearTop {
          0%   { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          40%  { transform: translate(-30px, -20px) rotate(-8deg); opacity: 1; }
          100% { transform: translate(-160px, -220px) rotate(-30deg); opacity: 0; }
        }
        /* Bottom half tears downward-right and rotates */
        @keyframes tearBottom {
          0%   { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          40%  { transform: translate(30px, 20px) rotate(8deg); opacity: 1; }
          100% { transform: translate(160px, 220px) rotate(30deg); opacity: 0; }
        }
        /* Glow at the tear line */
        @keyframes tearGlow {
          0%   { opacity: 0; transform: translate(-50%, -50%) scaleX(0.3); }
          30%  { opacity: 1; transform: translate(-50%, -50%) scaleX(1.2); }
          100% { opacity: 0; transform: translate(-50%, -50%) scaleX(2) scaleY(3); }
        }
        /* Burst flash overlay */
        @keyframes burstFlash {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }

        /* Spark particles — different angles */
        @keyframes spark0 {
          0%   { opacity: 1; transform: translate(-50%,-50%) scale(1); }
          100% { opacity: 0; transform: translate(calc(-50% - 90px), calc(-50% - 70px)) scale(0.3); }
        }
        @keyframes spark1 {
          0%   { opacity: 1; transform: translate(-50%,-50%) scale(1); }
          100% { opacity: 0; transform: translate(calc(-50% + 80px), calc(-50% - 90px)) scale(0.3); }
        }
        @keyframes spark2 {
          0%   { opacity: 1; transform: translate(-50%,-50%) scale(1); }
          100% { opacity: 0; transform: translate(calc(-50% - 60px), calc(-50% + 80px)) scale(0.3); }
        }
        @keyframes spark3 {
          0%   { opacity: 1; transform: translate(-50%,-50%) scale(1); }
          100% { opacity: 0; transform: translate(calc(-50% + 110px), calc(-50% + 40px)) scale(0.3); }
        }

        /* Card reveal */
        @keyframes cardReveal {
          0%   { transform: translateY(-40px) scale(0.75) rotateY(90deg); opacity: 0; }
          60%  { transform: translateY(5px) scale(1.03) rotateY(-2deg); opacity: 1; }
          100% { transform: translateY(0) scale(1) rotateY(0deg); opacity: 1; }
        }

        /* Utility */
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1; }
        }
        @keyframes fadeIn    { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp  { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        /* ── Lucky Pack Moment ── */
        @keyframes luckyFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes luckyCardZoom {
          0%   { opacity: 0; transform: scale(0.4) rotateY(-20deg); }
          60%  { transform: scale(1.08) rotateY(4deg); opacity: 1; }
          100% { transform: scale(1) rotateY(0deg); opacity: 1; }
        }
        @keyframes luckyTextRise {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes luckyGoldShimmer {
          0%   { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }
        @keyframes luckyCorePulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50%       { transform: scale(1.15); opacity: 1; }
        }
        @keyframes luckyHaloFlicker {
          0%, 100% { box-shadow: 0 0 40px rgba(255,200,0,0.5), 0 0 80px rgba(255,160,0,0.3); opacity: 0.9; }
          50%       { box-shadow: 0 0 70px rgba(255,215,0,0.8), 0 0 140px rgba(255,180,0,0.5); opacity: 1; }
        }
        @keyframes luckyParticle {
          0%   { transform: translateY(0) scale(1); opacity: 1; }
          80%  { opacity: 0.7; }
          100% { transform: translateY(-60vh) scale(0.3); opacity: 0; }
        }
        @keyframes godRaySpin {
          from { transform: rotate(var(--start-deg, 0deg)); }
          to   { transform: rotate(calc(var(--start-deg, 0deg) + 360deg)); }
        }
      `}</style>
    </div>
  );
}
