'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';
import { calculateDuelResult, BattleResult, RARITY_POWER } from '@/lib/battle';
import { DuelOutcome } from '@/lib/types';
import Card from '@/components/Card';
import styles from '../battle.module.css';

// ── Types ─────────────────────────────────────────────────────────────────

type AnimPhase = 'idle' | 'animating' | 'done';

interface SlotAnimState {
  flipping: boolean;
  flashed: boolean;
  showFloat: boolean;
  showSpecial: boolean;
  outcome: DuelOutcome | null;
}

const DEFAULT_SLOT_ANIM: SlotAnimState = {
  flipping: false,
  flashed: false,
  showFloat: false,
  showSpecial: false,
  outcome: null,
};

// ── Component ─────────────────────────────────────────────────────────────

/**
 * Arena de batalha por evento.
 * Gerencia montagem de slots, simulacao de duelos e playback de animacao por rodada.
 */
export default function BattleEventPage() {
  const params = useParams();
  const eventId = params?.eventId as string;
  const router = useRouter();
  const { userCards, allCards, currentUser, allBattleEvents, recordBattleResult, resetBattleParticipant } = useApp();

  // Slots for the player's chosen cards (up to 5)
  const [slots, setSlots] = useState<(string | null)[]>([null, null, null, null, null]);

  // Battle result (pre-calculated before animation)
  const [result, setResult] = useState<BattleResult | null>(null);

  // Which enemy cards have been "revealed" by the animation
  const [revealedEnemySlots, setRevealedEnemySlots] = useState<Set<number>>(new Set());

  // Current duel being animated (index into result.duels)
  const [currentDuel, setCurrentDuel] = useState<number>(-1);

  // Per-slot animation state: key = slot index, separate for player and enemy rows
  const [playerAnim, setPlayerAnim] = useState<Record<number, SlotAnimState>>({});
  const [enemyAnim, setEnemyAnim] = useState<Record<number, SlotAnimState>>({});

  // Animation phase
  const [animPhase, setAnimPhase] = useState<AnimPhase>('idle');

  // Live scoreboard during animation
  const [livePlayerPower, setLivePlayerPower] = useState(0);
  const [liveEnemyPower, setLiveEnemyPower] = useState(0);
  const [livePlayerWins, setLivePlayerWins] = useState(0);
  const [liveEnemyWins, setLiveEnemyWins] = useState(0);

  const animTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const eventDef = allBattleEvents.find(e => e.id === eventId);

  const now = new Date();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const weekId = weekStart.toISOString().split('T')[0];
  const hasParticipated = currentUser?.battleHistory?.includes(`${eventId}_${weekId}`);

  // Initialise the set of pre-revealed enemy cards
  useEffect(() => {
    if (!eventDef) return;
    const preRevealed = new Set<number>();
    for (let i = 0; i < eventDef.revealedCount; i++) {
      preRevealed.add(i);
    }
    setRevealedEnemySlots(preRevealed);
  }, [eventDef?.id]);

  // Card inventory helpers (Grouped by base Card)
  const cardInventory = useMemo(() => {
    const map = new Map<string, number>();
    for (const uc of userCards) {
      map.set(uc.cardId, (map.get(uc.cardId) || 0) + 1);
    }
    return map;
  }, [userCards]);

  const availableCards = useMemo(() => {
    return allCards
      .filter(c => cardInventory.has(c.id) && cardInventory.get(c.id)! > 0)
      .sort((a, b) => RARITY_POWER[b.rarity] - RARITY_POWER[a.rarity]);
  }, [cardInventory, allCards]);

  // Total player power preview (pre battle)
  const totalPower = useMemo(() => {
    if (!eventDef) return 0;
    const rarityOrder = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Hero'];
    return slots.reduce((sum, ucId) => {
      if (!ucId) return sum;
      const uc = userCards.find(u => u.id === ucId);
      const card = uc ? allCards.find(c => c.id === uc.cardId) : null;
      if (!card || !uc) return sum;

      let p = (RARITY_POWER[card.rarity] || 0) + (uc.bonusRoll || 0);
      
      if (eventDef.id === 'event_1' && card.rarity === 'Rare') p += 1;
      if (eventDef.id === 'event_2' && (card.type === 'Path of Subterfuge' || card.type === 'Path of Wisdom')) p += 1;
      if (eventDef.id === 'event_3' && card.rarity === 'Hero') p += 2;
      if (eventDef.id === 'event_4') {
        const isExperienced = rarityOrder.indexOf(card.rarity) >= rarityOrder.indexOf('Rare');
        if (isExperienced) p += 1;
        if (card.type === 'Path of Arms' || card.type === 'Path of Subterfuge') p += 1;
      }
      return sum + p;
    }, 0);
  }, [slots, allCards, userCards, eventDef]);

  // ── Drag & Drop ───────────────────────────────────────────────────────────

  /** Inicia drag source com cardId e indice de origem para suporte a swap de slots. */
  const handleDragStart = (e: React.DragEvent, cardId: string, sourceSlotIndex: number = -1) => {
    e.dataTransfer.setData('cardId', cardId);
    e.dataTransfer.setData('sourceSlot', sourceSlotIndex.toString());
  };

  /** Permite drop no alvo e aplica estado visual temporario de hover. */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  /** Remove highlight visual quando item arrastado sai da area de drop. */
  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('drag-over');
  };

  /**
   * Processa drop de carta em slot de batalha.
   * Suporta troca entre slots e auto-selecao da melhor instancia disponivel por bonusRoll.
   */
  const handleDropSlot = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    if (result || hasParticipated) return;

    const draggedData = e.dataTransfer.getData('cardId'); 
    const sourceSlotIndex = parseInt(e.dataTransfer.getData('sourceSlot'), 10);
    if (!draggedData) return;

    setSlots(prev => {
      const next = [...prev];
      // Switch positions in board
      if (sourceSlotIndex >= 0 && sourceSlotIndex !== targetIndex) {
        const temp = next[targetIndex];
        next[targetIndex] = next[sourceSlotIndex];
        next[sourceSlotIndex] = temp;
        return next;
      }
      
      // Auto-pick the best available UserCard instance
      const usedUcIds = new Set(prev.filter(Boolean));
      const bestUc = userCards
         .filter(uc => uc.cardId === draggedData && !usedUcIds.has(uc.id))
         .sort((a,b) => b.bonusRoll - a.bonusRoll)[0];

      if (bestUc) {
        next[targetIndex] = bestUc.id;
      }
      return next;
    });
  };

  /** Remove carta de um slot quando a batalha ainda nao foi concluida/travada. */
  const handleRemoveFromSlot = (index: number) => {
    if (result || hasParticipated) return;
    setSlots(prev => { const n = [...prev]; n[index] = null; return n; });
  };

  // ── Animation engine ──────────────────────────────────────────────────────

  /** Cancela todos os timeouts ativos da engine de animacao. */
  const clearAllTimeouts = useCallback(() => {
    animTimeouts.current.forEach(clearTimeout);
    animTimeouts.current = [];
  }, []);

  /** Agenda callback temporal e rastreia ID para cleanup seguro. */
  const push = useCallback((fn: () => void, delay: number) => {
    animTimeouts.current.push(setTimeout(fn, delay));
  }, []);

  /**
   * Executa a animacao de um duelo individual e encadeia o proximo duelo ao final.
   * Atualiza reveal de inimigos, score ao vivo e estado visual de vitoria/derrota por slot.
   */
  const animateDuel = useCallback((
    duelIndex: number,
    duels: DuelOutcome[],
    finishCallback: () => void,
  ) => {
    if (duelIndex >= duels.length) {
      finishCallback();
      return;
    }

    const duel = duels[duelIndex];
    const i = duel.slotIndex;
    const DUEL_DURATION = 1500 + Math.random() * 500; // 1.5–2s

    setCurrentDuel(duelIndex);

    // 0ms — highlight active duel pair
    push(() => {
      setPlayerAnim(prev => ({ ...prev, [i]: { ...DEFAULT_SLOT_ANIM } }));
      setEnemyAnim(prev => ({ ...prev, [i]: { ...DEFAULT_SLOT_ANIM } }));
    }, 0);

    // 100ms — if enemy was hidden, flip it
    push(() => {
      if (!revealedEnemySlots.has(i) && duel.enemyCardId) {
        setEnemyAnim(prev => ({ ...prev, [i]: { ...(prev[i] || DEFAULT_SLOT_ANIM), flipping: true } }));
        setRevealedEnemySlots(prev => new Set([...prev, i]));
      }
    }, 100);

    // 500ms — impact flash + floating numbers + special rule popup
    push(() => {
      setPlayerAnim(prev => ({ ...prev, [i]: { ...(prev[i] || DEFAULT_SLOT_ANIM), flashed: true, showFloat: true, showSpecial: !!duel.specialRuleApplied } }));
      setEnemyAnim(prev => ({ ...prev, [i]: { ...(prev[i] || DEFAULT_SLOT_ANIM), flashed: true, showFloat: true } }));
    }, 500);

    // 900ms — update live scoreboard
    push(() => {
      setLivePlayerPower(prev => prev + duel.playerPower);
      setLiveEnemyPower(prev => prev + duel.enemyPower);
      if (duel.winner === 'player') setLivePlayerWins(prev => prev + 1);
      if (duel.winner === 'enemy') setLiveEnemyWins(prev => prev + 1);

      // Mark winner/loser
      setPlayerAnim(prev => ({ ...prev, [i]: { ...(prev[i] || DEFAULT_SLOT_ANIM), outcome: duel, flashed: false, showFloat: false, showSpecial: false } }));
      setEnemyAnim(prev => ({ ...prev, [i]: { ...(prev[i] || DEFAULT_SLOT_ANIM), outcome: duel, flashed: false, showFloat: false } }));
    }, 900);

    // DUEL_DURATION — move to next
    push(() => {
      setCurrentDuel(-1);
      animateDuel(duelIndex + 1, duels, finishCallback);
    }, DUEL_DURATION);
  }, [revealedEnemySlots, push]);

  /**
   * Dispara a batalha completa:
   * 1) calcula resultado,
   * 2) registra participacao/recompensa,
   * 3) inicia sequencia animada dos duelos.
   */
  const handleFight = useCallback(() => {
    if (!eventDef || hasParticipated || animPhase !== 'idle') return;
    const filledCount = slots.filter(Boolean).length;
    if (filledCount === 0) return;

    // Pre-calculate all duels
    const battleResult = calculateDuelResult(slots, eventDef.enemyCards, allCards, eventDef.id, userCards);
    setResult(battleResult);
    setAnimPhase('animating');
    setLivePlayerPower(0);
    setLiveEnemyPower(0);
    setLivePlayerWins(0);
    setLiveEnemyWins(0);

    // Record result immediately (before animation)
    recordBattleResult(eventId, battleResult.isWin);

    // Start animation chain
    clearAllTimeouts();
    animateDuel(0, battleResult.duels, () => {
      setAnimPhase('done');
      setCurrentDuel(-1);
    });
  }, [eventDef, hasParticipated, animPhase, slots, allCards, eventId, recordBattleResult, clearAllTimeouts, animateDuel]);

  // Cleanup timeouts on unmount
  useEffect(() => () => clearAllTimeouts(), [clearAllTimeouts]);

  if (!eventDef) {
    return (
      <div style={{ color: 'white', padding: '4rem', textAlign: 'center' }}>
        Evento não encontrado.{' '}
        <button className="btn btn-ghost" onClick={() => router.push('/battle')}>Voltar</button>
      </div>
    );
  }

  const isLocked = !!result || !!hasParticipated;
  const enemyDeck = eventDef.enemyCards;
  const numDuels = result ? result.duels.length : Math.max(slots.length, enemyDeck.length);

  // ── Render helpers ────────────────────────────────────────────────────────

  /** Resolve classes visuais do slot inimigo apos duelo finalizado. */
  const getEnemySlotClass = (i: number): string => {
    const anim = enemyAnim[i];
    if (!anim?.outcome) return '';
    if (currentDuel === i) return '';
    if (anim.outcome.winner === 'enemy') return styles.cardVictory;
    if (anim.outcome.winner === 'player') return styles.cardDefeated;
    return '';
  };

  /** Resolve classes visuais do slot do jogador apos duelo finalizado. */
  const getPlayerSlotClass = (i: number): string => {
    const anim = playerAnim[i];
    if (!anim?.outcome) return '';
    if (currentDuel === i) return '';
    if (anim.outcome.winner === 'player') return styles.cardVictory;
    if (anim.outcome.winner === 'enemy') return styles.cardDefeated;
    return '';
  };

  /** Indica se slot inimigo ja foi revelado no fluxo atual. */
  const isEnemyRevealed = (i: number) => revealedEnemySlots.has(i);

  /** Mapeia tier tecnico para rotulo UX final. */
  const tierLabel = (tier: BattleResult['tier']) => {
    switch (tier) {
      case 'Crushing Win': return 'Vitória Esmagadora! ⚡';
      case 'Solid Win':    return 'Vitória Sólida! 🏆';
      case 'Narrow Win':   return 'Vitória Apertada! 🎯';
      case 'Close Loss':   return 'Derrota Leve...';
      case 'Heavy Loss':   return 'Derrota Pesada...';
    }
  };

  /** Mapeia tier tecnico para cor de destaque da tela de resultado. */
  const tierColor = (tier: BattleResult['tier']) => {
    if (tier.includes('Win')) {
      if (tier === 'Crushing Win') return '#00d2d3';
      if (tier === 'Solid Win')    return '#4ade80';
      return 'var(--gold)';
    }
    if (tier === 'Close Loss') return '#ff9f43';
    return '#ff4757';
  };

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ height: 'calc(100vh - 70px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, opacity: 0.12, pointerEvents: 'none' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={eventDef.image} alt="bg" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #000, transparent)' }} />
      </div>

      {/* Header */}
      <header style={{
        padding: '0.8rem 2rem',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        zIndex: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        flexShrink: 0,
      }}>
        <button className="btn btn-ghost" onClick={() => router.push('/battle')}>⟵ Missões</button>

        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          {/* Live scoreboard */}
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', fontFamily: 'Cinzel, serif', fontSize: '0.9rem' }}>
            <span style={{ color: '#4a9eff' }}>
              Você: <strong style={{ fontSize: '1.1rem' }}>{(animPhase !== 'idle' ? livePlayerPower : totalPower).toFixed(2)}</strong>
            </span>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '1.4rem' }}>VS</span>
            <span style={{ color: '#ff4757' }}>
              Inimigo: <strong style={{ fontSize: '1.1rem' }}>{liveEnemyPower.toFixed(2)}</strong>
            </span>
          </div>

          {animPhase !== 'idle' && (
            <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.85rem' }}>
              <span style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', padding: '0.2rem 0.7rem', borderRadius: '999px', border: '1px solid rgba(74,222,128,0.3)' }}>
                ✓ {livePlayerWins}
              </span>
              <span style={{ background: 'rgba(255,71,87,0.15)', color: '#ff4757', padding: '0.2rem 0.7rem', borderRadius: '999px', border: '1px solid rgba(255,71,87,0.3)' }}>
                ✗ {liveEnemyWins}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {currentUser?.isAdmin && hasParticipated && (
            <button
              onClick={() => { resetBattleParticipant(eventId); setResult(null); setAnimPhase('idle'); clearAllTimeouts(); }}
              className="btn btn-outline"
              style={{ borderColor: '#ff4757', color: '#ff4757', fontSize: '0.75rem', padding: '0.3rem 0.8rem' }}
            >
              [Admin] Reset
            </button>
          )}
        </div>
      </header>

      {/* Main arena area */}
      <div style={{ display: 'flex', flex: 1, gap: '1rem', padding: '1rem', zIndex: 10, minHeight: 0, overflow: 'hidden' }}>

        {/* ── LEFT: Lore & Rules ── */}
        {eventDef.id === 'event_4' ? (
          // ── Sho'grath: Wanted Poster Panel ──────────────────────────────
          <aside style={{
            width: '240px',
            flexShrink: 0,
            background: 'linear-gradient(165deg, #1a0f00 0%, #0d0800 100%)',
            backdropFilter: 'blur(10px)',
            borderRadius: '12px',
            border: '2px solid rgba(180, 120, 20, 0.5)',
            boxShadow: '0 0 30px rgba(180,120,20,0.1), inset 0 0 40px rgba(0,0,0,0.4)',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
            overflowY: 'auto',
            position: 'relative',
          }}>
            {/* Parchment texture overlay */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: '10px', opacity: 0.04,
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(180,120,20,0.3) 20px, rgba(180,120,20,0.3) 21px)',
              pointerEvents: 'none' }} />

            {/* Header */}
            <div style={{ textAlign: 'center', borderBottom: '1px solid rgba(180,120,20,0.4)', paddingBottom: '0.5rem', position: 'relative' }}>
              <div style={{ fontSize: '0.55rem', color: '#b4780a', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '0.2rem' }}>⚔ Aviso Público ⚔</div>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.75rem', color: '#d4a020', fontWeight: 'bold', lineHeight: 1.2 }}>Taverna do Canto Torto</div>
              <div style={{ fontSize: '0.55rem', color: 'rgba(180,120,20,0.7)', marginTop: '0.2rem', fontStyle: 'italic' }}>Servidor Colhesol · Ultima Online RP</div>
            </div>

            {/* Reward headline */}
            <div style={{ textAlign: 'center', background: 'rgba(180,120,20,0.15)', border: '1px solid rgba(180,120,20,0.4)', borderRadius: '6px', padding: '0.5rem' }}>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', color: '#d4a020', textTransform: 'uppercase', letterSpacing: '0.1em' }}>⭐ Recompensa em Ouro! ⭐</div>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: '#f0c040', fontWeight: 'bold', marginTop: '0.2rem' }}>PROCURA-SE</div>
            </div>

            {/* Villain name */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: '#ff4757', fontWeight: 'bold', textShadow: '0 0 10px rgba(255,71,87,0.5)', lineHeight: 1.2 }}>Sho&apos;grath</div>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: '#cc3344', fontStyle: 'italic' }}>o Maldito</div>
              <div style={{ fontSize: '0.6rem', color: '#ff4757', background: 'rgba(255,71,87,0.15)', border: '1px solid rgba(255,71,87,0.4)', borderRadius: '4px', padding: '0.2rem 0.5rem', marginTop: '0.3rem', display: 'inline-block' }}>VIVO OU MORTO</div>
            </div>

            {/* Boss image */}
            <div style={{ borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(180,120,20,0.3)', flexShrink: 0, maxHeight: '90px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={eventDef.image} style={{ width: '100%', height: '90px', objectFit: 'cover', objectPosition: 'center top' }} alt="Sho'grath" />
            </div>

            {/* Description */}
            <div style={{ fontSize: '0.65rem', color: 'rgba(200,170,80,0.85)', lineHeight: 1.5 }}>
              <strong style={{ color: '#d4a020' }}>ORC Líder de Bandidos</strong><br/>
              Pele acinzentada · Olhos vermelhos como brasas · Carrega clava com crânios presos.
            </div>

            {/* Bounties */}
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '0.5rem', fontSize: '0.65rem', lineHeight: 1.8 }}>
              <div style={{ color: '#d4a020', fontWeight: 'bold', marginBottom: '0.2rem', fontSize: '0.6rem', textTransform: 'uppercase' }}>Recompensa:</div>
              <div style={{ color: 'rgba(200,180,100,0.9)' }}>→ <strong style={{color:'#f0c040'}}>300 moedas</strong> pelo cadáver</div>
              <div style={{ color: 'rgba(200,180,100,0.9)' }}>→ <strong style={{color:'#f0c040'}}>500 moedas</strong> se capturado vivo</div>
              <div style={{ color: 'rgba(200,180,100,0.9)' }}>→ <strong style={{color:'#4ade80'}}>Bônus</strong> por destruir o bando!</div>
            </div>

            {/* Special Rule */}
            <div style={{ background: 'rgba(74, 158, 255, 0.08)', borderLeft: '2px solid #4a9eff', padding: '0.5rem', borderRadius: '4px', fontSize: '0.65rem' }}>
              <div style={{ color: '#4a9eff', fontWeight: 'bold', marginBottom: '0.2rem', textTransform: 'uppercase', fontSize: '0.55rem' }}>Regra de Caçada</div>
              <div style={{ color: 'rgba(180,210,255,0.85)' }}>Mercenários Rara+ ganham +1. Facções Ancient/Shadow ganham +1 adicional.</div>
            </div>

            {/* Warning */}
            <div style={{ marginTop: 'auto', textAlign: 'center', borderTop: '1px solid rgba(180,120,20,0.3)', paddingTop: '0.5rem' }}>
              <div style={{ fontSize: '0.6rem', color: 'rgba(255,100,100,0.8)', fontStyle: 'italic', lineHeight: 1.4 }}>⚠ Perigoso e Impiedoso!<br/>Não se arrisque sem apoio!</div>
              <div style={{ fontSize: '0.55rem', color: 'rgba(180,120,20,0.6)', marginTop: '0.3rem', fontStyle: 'italic' }}>Inscrevam-se com o Velho Galdor após o pôr do sol.</div>
            </div>
          </aside>
        ) : (
          // ── Default Lore Panel ──────────────────────────────────────────
          <aside style={{
            width: '240px',
            flexShrink: 0,
            background: 'rgba(20, 20, 25, 0.65)',
            backdropFilter: 'blur(10px)',
            borderRadius: '12px',
            border: '1px solid rgba(212,175,55,0.2)',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            overflowY: 'auto',
          }}>
            <div style={{ borderRadius: '8px', overflow: 'hidden', height: '110px', flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={eventDef.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="event" />
            </div>
            <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>{eventDef.name}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.5, fontStyle: 'italic' }}>{eventDef.lore}</p>

            <div style={{ background: 'rgba(74, 158, 255, 0.1)', borderLeft: '3px solid #4a9eff', padding: '0.75rem', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.7rem', color: '#4a9eff', marginBottom: '0.3rem', textTransform: 'uppercase', fontWeight: 'bold' }}>Regra Especial</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{eventDef.specialRule}</div>
            </div>

            <div style={{ background: 'rgba(212,175,55,0.1)', borderLeft: '3px solid var(--gold)', padding: '0.75rem', borderRadius: '6px', marginTop: 'auto' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--gold)', marginBottom: '0.3rem', textTransform: 'uppercase', fontWeight: 'bold' }}>Recompensa</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{eventDef.reward}</div>
            </div>
          </aside>
        )}

        {/* ── CENTER: Battle field ── */}
        <section style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', minWidth: 0 }}>

          {/* Enemy row */}
          <div style={{ width: '100%', marginTop: '1.5rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '0.8rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#ff4757', textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: 'Cinzel, serif' }}>
                ⚔ Inimigo
              </span>
            </div>
            <div style={{ display: 'flex', gap: '1.2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              {Array.from({ length: numDuels }).map((_, i) => {
                const enemyCardId = enemyDeck[i] ?? null;
                const enemyCard = enemyCardId ? allCards.find(c => c.id === enemyCardId) : null;
                const revealed = isEnemyRevealed(i);
                const isActive = currentDuel === i;
                const anim = enemyAnim[i];

                return (
                  <div
                    key={`enemy-${i}`}
                    style={{ width: '115px', height: '175px', position: 'relative', flexShrink: 0 }}
                  >
                    {/* Active duel highlight */}
                    {isActive && (
                      <div className={styles.activeDuel} style={{ position: 'absolute', inset: -4, borderRadius: '14px', zIndex: 2, pointerEvents: 'none' }} />
                    )}

                    {/* Floating power number */}
                    {anim?.showFloat && enemyCardId && (
                      <div className={styles.floatingNumber} style={{ color: '#ff4757' }}>
                        {anim.outcome ? `${anim.outcome.enemyPower.toFixed(2)}` : '?'}
                      </div>
                    )}

                    <div
                      className={`${anim?.flashed ? styles.impactFlash : ''} ${getEnemySlotClass(i)}`}
                      style={{ width: '100%', height: '100%', borderRadius: '10px', overflow: 'hidden', position: 'relative' }}
                    >
                      {revealed && enemyCard ? (
                        <div className={anim?.flipping ? styles.cardFlipInner + ' flipping' : ''} style={{ width: '100%', height: '100%' }}>
                          <div style={{ position: 'absolute', inset: 0, transform: 'scale(0.95)', transformOrigin: 'top left', width: '105.3%', height: '105.3%' }}>
                            <Card card={enemyCard} size="sm" animateIn={false} />
                          </div>
                        </div>
                      ) : (
                        <div className={styles.hiddenCard}>
                          <div className={styles.hiddenCardQuestion}>？</div>
                          <div className={styles.hiddenCardText}>Revelado<br/>no combate</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* VS divider / fight button / result banner */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', width: '100%' }}>
              <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, rgba(255,71,87,0.4))' }} />
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.5rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.3em' }}>VS</div>
              <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to left, transparent, rgba(74,158,255,0.4))' }} />
            </div>

            {/* State machine for center action */}
            {animPhase === 'done' && result ? (
              <div className={styles.resultBanner} style={{
                padding: '1.5rem 2.5rem',
                background: result.isWin ? 'rgba(0,20,10,0.95)' : 'rgba(20,5,5,0.95)',
                borderRadius: '16px',
                border: `1px solid ${result.isWin ? 'rgba(74,222,128,0.4)' : 'rgba(255,71,87,0.4)'}`,
                boxShadow: result.isWin ? '0 0 40px rgba(74,222,128,0.1)' : '0 0 40px rgba(255,71,87,0.1)',
                textAlign: 'center',
              }}>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '2rem', color: tierColor(result.tier), marginBottom: '0.5rem' }}>
                  {tierLabel(result.tier)}
                </div>
                <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  <span>Poder: <strong style={{ color: 'var(--text-primary)' }}>{result.totalPlayerPower.toFixed(2)}</strong></span>
                  <span>Duelos: <strong style={{ color: 'var(--text-primary)' }}>{result.playerWins}/{result.duels.length}</strong></span>
                </div>
                {result.isWin && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--gold)', padding: '0.5rem 1rem', background: 'rgba(212,175,55,0.1)', borderRadius: '8px', border: '1px solid rgba(212,175,55,0.2)' }}>
                    🏆 {eventDef.reward}
                  </div>
                )}
              </div>
            ) : animPhase === 'animating' ? (
              <div style={{ color: 'var(--gold)', fontFamily: 'Cinzel, serif', fontSize: '1rem', letterSpacing: '0.2em', animation: 'pulse 1s infinite' }}>
                ⚔ Em Combate...
              </div>
            ) : hasParticipated ? (
              <div style={{ color: '#4ade80', fontFamily: 'Cinzel, serif', fontSize: '1.2rem' }}>Evento Finalizado ✓</div>
            ) : (
              <button
                className="btn btn-primary"
                onClick={handleFight}
                disabled={slots.filter(Boolean).length === 0}
                style={{ padding: '0.85rem 3rem', fontSize: '1.1rem', letterSpacing: '0.2em' }}
              >
                LUTAR
              </button>
            )}
          </div>

          {/* Player row */}
          <div style={{ width: '100%', marginBottom: '1.5rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '0.8rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#4a9eff', textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: 'Cinzel, serif' }}>
                🛡 Seu Esquadrão
              </span>
            </div>
            <div style={{ display: 'flex', gap: '1.2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              {slots.map((slotUcId, i) => {
                const userInstance = slotUcId ? userCards.find(u => u.id === slotUcId) : null;
                const cardData = userInstance ? allCards.find(c => c.id === userInstance.cardId) : null;
                const isActive = currentDuel === i;
                const anim = playerAnim[i];

                return (
                  <div
                    key={`player-slot-${i}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDropSlot(e, i)}
                    className="drag-target-slot"
                    style={{
                      width: '115px',
                      height: '175px',
                      borderRadius: '10px',
                      border: cardData ? 'none' : '2px dashed rgba(255,255,255,0.15)',
                      background: cardData ? 'transparent' : 'rgba(0,0,0,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                      position: 'relative',
                      flexShrink: 0,
                    }}
                  >
                    {/* Active duel highlight */}
                    {isActive && (
                      <div className={styles.activeDuel} style={{ position: 'absolute', inset: -4, borderRadius: '14px', zIndex: 2, pointerEvents: 'none' }} />
                    )}

                    {/* Floating power number */}
                    {anim?.showFloat && slotUcId && (
                      <div className={styles.floatingNumber} style={{ color: '#4a9eff' }}>
                        {anim.outcome ? `${anim.outcome.playerPower.toFixed(2)}` : '?'}
                      </div>
                    )}

                    {/* Special rule popup */}
                    {anim?.showSpecial && anim.outcome?.specialRuleApplied && (
                      <div className={styles.specialRulePopup}>{anim.outcome.specialRuleApplied}</div>
                    )}

                    {cardData ? (
                      <div
                        className={`${anim?.flashed ? styles.impactFlash : ''} ${getPlayerSlotClass(i)}`}
                        draggable={!isLocked}
                        onDragStart={(e) => handleDragStart(e, cardData.id, i)}
                        onClick={() => handleRemoveFromSlot(i)}
                        style={{ width: '100%', height: '100%', cursor: isLocked ? 'default' : 'grab', position: 'relative', borderRadius: '10px', overflow: 'hidden' }}
                      >
                        <div style={{ position: 'absolute', inset: 0, transform: 'scale(0.95)', transformOrigin: 'top left', width: '105.3%', height: '105.3%' }}>
                          <Card card={cardData} size="sm" animateIn={false} />
                        </div>
                        {userInstance && userInstance.bonusRoll > 0 && (
                          <div style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,210,211,0.9)', color: '#fff', fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 'bold', zIndex: 11, border: '1px solid #fff' }}>
                            +{userInstance.bonusRoll.toFixed(2)}
                          </div>
                        )}
                        {!isLocked && (
                          <div style={{ position: 'absolute', top: -8, right: -8, background: 'var(--error)', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px', zIndex: 10, boxShadow: '0 2px 5px rgba(0,0,0,0.5)' }}>
                            ✖
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Vazio</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── RIGHT: Inventory ── */}
        <aside style={{
          width: '280px',
          flexShrink: 0,
          background: 'rgba(10, 10, 15, 0.85)',
          backdropFilter: 'blur(5px)',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.05)',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}>
          <h3 style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.3rem', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
            Seu Deck
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '0.75rem' }}>
            Arraste as cartas para os slots
          </p>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', paddingRight: '0.3rem', minHeight: 0, paddingBottom: '1rem' }} className="custom-scroll">
            {availableCards.map(c => {
              const ownedInstances = userCards.filter(uc => uc.cardId === c.id);
              const ownedCount = ownedInstances.length;
              const usedInstances = new Set(slots.filter(Boolean));
              const availableCount = ownedInstances.filter(uc => !usedInstances.has(uc.id)).length;

              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', opacity: availableCount > 0 ? 1 : 0.4, padding: '0.6rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div
                    draggable={availableCount > 0 && !isLocked}
                    onDragStart={(e) => handleDragStart(e, c.id)}
                    style={{ width: '70px', height: '105px', flexShrink: 0, position: 'relative', cursor: availableCount > 0 && !isLocked ? 'grab' : 'default' }}
                  >
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '120px', height: '170px', transform: 'scale(0.583)', transformOrigin: 'top left' }}>
                      <Card card={c} size="sm" animateIn={false} />
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }} title={c.name}>{c.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{c.rarity} · {c.type}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      Poder: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{RARITY_POWER[c.rarity]}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: availableCount > 0 ? 'var(--gold)' : 'var(--error)', marginTop: '0.3rem', fontWeight: 'bold' }}>
                      {availableCount}/{ownedCount} disponíveis
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      <style>{`
        .drag-target-slot.drag-over {
          border-color: #4a9eff !important;
          background: rgba(74, 158, 255, 0.15) !important;
          transform: scale(1.05);
        }
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); border-radius: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
      `}</style>
    </div>
  );
}
