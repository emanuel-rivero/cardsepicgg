'use client';

import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';
import { useMemo } from 'react';

/**
 * Lobby de batalhas semanais.
 * Exibe eventos ativos, status de participacao e entrada para a arena por eventId.
 */
export default function BattleLobbyPage() {
  const router = useRouter();
  const { currentUser, allBattleEvents } = useApp();

  const now = new Date();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const weekId = weekStart.toISOString().split('T')[0];

  const participatedEvents = useMemo(() => {
    if (!currentUser?.battleHistory) return [];
    return currentUser.battleHistory
      .filter(h => h.endsWith(`_${weekId}`))
      .map(h => h.replace(`_${weekId}`, ''));
  }, [currentUser, weekId]);

  const activeEvents = allBattleEvents.filter(e => e.isActive);

  /**
   * Classifica dificuldade de um evento com base na quantidade de cartas ocultas.
   */
  const difficultyLabel = (revealedCount: number, totalCards: number) => {
    const hidden = totalCards - revealedCount;
    if (hidden === 0) return { label: 'Fácil', color: '#4ade80' };
    if (hidden <= 2) return { label: 'Médio', color: 'var(--gold)' };
    return { label: 'Difícil', color: '#ff4757' };
  };

  return (
    <main style={{ minHeight: '100vh', padding: '4rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <header style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <h1 style={{
          fontFamily: 'Cinzel, serif',
          fontSize: '3rem',
          background: 'linear-gradient(to right, var(--gold-light), var(--gold), var(--gold-dark))',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          marginBottom: '1rem',
        }}>
          Taverna das Missões
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
          Aventureiros buscam riquezas e glória. Escolha seu destino e monte seu esquadrão perfeito para enfrentá-lo.
        </p>
      </header>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '2.5rem',
        width: '100%',
        maxWidth: '1200px'
      }}>
        {activeEvents.map(event => {
          const isCompleted = participatedEvents.includes(event.id);
          const diff = difficultyLabel(event.revealedCount, event.enemyCards.length);
          const isShograth = event.id === 'event_4';
          const isGiant = event.id === 'event_5';

          return (
            <div
              key={event.id}
              onClick={() => router.push(`/battle/${event.id}`)}
              style={{
                borderRadius: '16px',
                overflow: 'hidden',
                background: isGiant
                  ? 'linear-gradient(160deg, #001020 0%, #000510 100%)'
                  : isShograth
                  ? 'linear-gradient(160deg, #1a0500 0%, #0d0200 100%)'
                  : 'rgba(255, 255, 255, 0.03)',
                border: isCompleted
                  ? '1px solid rgba(80, 255, 80, 0.3)'
                  : isGiant
                    ? '2px solid rgba(128, 202, 255, 0.6)'
                    : isShograth
                    ? '2px solid rgba(200, 30, 30, 0.6)'
                    : '1px solid var(--border-subtle)',
                boxShadow: isCompleted
                  ? '0 0 20px rgba(80, 255, 80, 0.1)'
                  : isGiant
                    ? '0 10px 50px rgba(128,202,255,0.25), inset 0 0 40px rgba(0,0,0,0.5)'
                    : isShograth
                    ? '0 10px 50px rgba(200,30,30,0.25), inset 0 0 40px rgba(0,0,0,0.5)'
                    : '0 10px 30px rgba(0,0,0,0.5)',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)';
                if (!isCompleted) {
                  e.currentTarget.style.boxShadow = isGiant
                    ? '0 20px 60px rgba(128,202,255,0.4)'
                    : isShograth
                    ? '0 20px 60px rgba(200,30,30,0.4)'
                    : '0 15px 40px rgba(212,175,55,0.15)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = isCompleted
                  ? '0 0 20px rgba(80, 255, 80, 0.1)'
                  : isGiant
                    ? '0 10px 50px rgba(128,202,255,0.25)'
                    : isShograth
                    ? '0 10px 50px rgba(200,30,30,0.25)'
                    : '0 10px 30px rgba(0,0,0,0.5)';
              }}
            >
              {/* Sho'grath: PROCURA-SE ribbon at top */}
              {isShograth && !isCompleted && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, zIndex: 12,
                  background: 'linear-gradient(135deg, #7a0000, #b52000)',
                  color: '#ffd700', textAlign: 'center',
                  padding: '0.35rem 0.5rem',
                  fontFamily: 'Cinzel, serif',
                  fontSize: '0.65rem', fontWeight: 'bold', letterSpacing: '0.25em',
                  borderBottom: '1px solid rgba(255,200,0,0.4)',
                  textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                }}>
                  ⚔ PROCURA-SE · VIVO OU MORTO ⚔
                </div>
              )}

              {/* Sho'grath: parchment line texture */}
              {isShograth && (
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
                  backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(150,0,0,0.04) 20px, rgba(150,0,0,0.04) 21px)',
                }} />
              )}

              {isCompleted && (
                <div style={{
                  position: 'absolute', top: 15, right: 15, zIndex: 10,
                  background: 'rgba(20, 100, 20, 0.9)', color: '#4ade80',
                  padding: '0.4rem 1rem', borderRadius: '30px', fontWeight: 'bold', border: '1px solid #4ade80',
                  fontSize: '0.8rem', letterSpacing: '0.1em'
                }}>
                  COMPLETO ✓
                </div>
              )}

              <div style={{ height: '200px', width: '100%', position: 'relative', marginTop: isShograth && !isCompleted ? '28px' : '0' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={event.image} alt={event.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: isGiant
                  ? 'linear-gradient(transparent 30%, rgba(0,20,40,0.8) 80%, #001020)'
                  : isShograth
                  ? 'linear-gradient(transparent 30%, rgba(26,5,0,0.8) 80%, #1a0500)'
                  : 'linear-gradient(transparent, #0a0a0c)' }} />

                {/* Sho'grath: skull badge overlay */}
                {isShograth && (
                  <div style={{
                    position: 'absolute', top: 8, right: 8, zIndex: 5,
                    fontSize: '1.4rem', filter: 'drop-shadow(0 0 8px rgba(255,50,50,0.8))',
                    animation: 'pulse 2s ease-in-out infinite',
                  }}>💀</div>
                )}
              </div>

              <div style={{ padding: '1.5rem', paddingTop: isShograth ? '0.75rem' : '1.5rem', flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 2 }}>
                <h3 style={{
                  fontFamily: 'Cinzel, serif',
                  fontSize: '1.4rem',
                  color: isCompleted ? '#aaa' : isGiant ? '#80caff' : isShograth ? '#ff6060' : 'var(--text-primary)',
                  marginBottom: '0.5rem',
                  textShadow: isGiant && !isCompleted ? '0 0 15px rgba(128,202,255,0.4)' : isShograth && !isCompleted ? '0 0 15px rgba(255,50,50,0.4)' : 'none',
                }}>
                  {event.name}
                </h3>

                {/* Sho'grath: short bounty summary instead of full lore */}
                {isShograth ? (
                  <div style={{ marginBottom: '1.5rem', flex: 1 }}>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(200,150,50,0.9)', lineHeight: 1.5, fontStyle: 'italic', marginBottom: '0.75rem' }}>
                      Orc infame que lidera saqueadores nas estradas do norte. Viajantes encontrados sem cabeça ao longo da trilha.
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.75rem' }}>
                      <div style={{ color: 'rgba(200,180,100,0.8)' }}>→ <strong style={{ color: '#f0c040' }}>500 moedas</strong> capturado vivo</div>
                      <div style={{ color: 'rgba(200,180,100,0.8)' }}>→ <strong style={{ color: '#4ade80' }}>Bônus</strong> por desmantelar o bando</div>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.5rem', flex: 1 }}>
                    {event.lore}
                  </p>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '1rem', borderTop: `1px solid ${isGiant ? 'rgba(128,202,255,0.2)' : isShograth ? 'rgba(200,30,30,0.2)' : 'rgba(255,255,255,0.05)'}` }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Inimigos: <strong style={{ color: isGiant ? '#80caff' : isShograth ? '#ff6060' : 'var(--text-primary)' }}>{event.enemyCards.length} cartas</strong>
                    </div>
                    <div style={{ fontSize: '0.8rem' }}>
                      Dificuldade: <strong style={{ color: diff.color }}>{diff.label}</strong>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: isGiant ? '#80caff' : isShograth ? '#ff6060' : 'var(--purple)' }}>
                    {isCompleted ? 'Volte semana que vem' : isShograth ? 'Aceitar Contrato ➔' : 'Entrar na Arena ➔'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {activeEvents.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)', padding: '4rem' }}>
            Nenhuma missão ativa no momento. Volte em breve!
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; transform: scale(1); } 50% { opacity:0.7; transform: scale(1.1); } }
      `}</style>
    </main>
  );
}
