'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';
import { db } from '@/lib/db';
import { uploadImageServerAction } from '@/app/actions/upload';
import { Card, Pack, User, Rarity, CardType, CardClass, BattleEvent } from '@/lib/types';
import styles from './admin.module.css';

type Tab = 'cards' | 'packs' | 'users' | 'battles';

const RARITIES: Rarity[] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Hero'];
const CARD_TYPES: CardType[] = ['Path of Arms', 'Path of Wisdom', 'Path of Subterfuge', 'Enemy', 'NPC', 'Gods', 'Quest'];
const CLASSES_BY_TYPE: Record<CardType, CardClass[]> = {
  'Path of Arms': ['Archer', 'Hunter', 'Fighter', 'Defender', 'Paladin', 'Barbarian', 'Mutant'],
  'Path of Wisdom': ['Necromant', 'Druid', 'Magus', 'Arcane Blade', 'Grenadier', 'Cleric'],
  'Path of Subterfuge': ['Arcane Trickster', 'Treasure Hunter', 'Assassin', 'Vivisectionist', 'Fencer', 'Thief', 'Bard', 'Shadow Dancer', 'Demon Hunter'],
  Enemy: ['None'],
  NPC: ['None'],
  Gods: ['None'],
  Quest: ['None']
};

const EMPTY_CARD = {
  name: '', subtitle: '', rarity: 'Common' as Rarity, image: '',
  type: 'Path of Arms' as CardType, cardClass: 'Fighter' as CardClass, shortLore: '', isActive: true,
  foilOptional: false, dropWeight: 60, characteristics: '',
};

const EMPTY_PACK = {
  name: '', description: '', image: '', cardsPerPack: 4, isActive: true,
};

const EMPTY_BATTLE_EVENT: Omit<BattleEvent, 'id'> = {
  name: '',
  image: '',
  lore: '',
  specialRule: 'Nenhuma.',
  reward: '500 Epic Points',
  enemyCards: [],
  revealedCount: 2,
  isActive: true,
};

export default function AdminPage() {
  const { currentUser, refreshAll, refreshBattleEvents } = useApp();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('cards');

  // Data
  const [cards, setCards] = useState<Card[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [battleEvents, setBattleEvents] = useState<BattleEvent[]>([]);

  // Card form
  const [cardForm, setCardForm] = useState({ ...EMPTY_CARD });
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardMsg, setCardMsg] = useState('');

  // Pack form
  const [packForm, setPackForm] = useState({ ...EMPTY_PACK });
  const [editingPackId, setEditingPackId] = useState<string | null>(null);
  const [packMsg, setPackMsg] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Battle event form
  const [battleForm, setBattleForm] = useState<Omit<BattleEvent, 'id'>>({ ...EMPTY_BATTLE_EVENT });
  const [editingBattleId, setEditingBattleId] = useState<string | null>(null);
  const [battleMsg, setBattleMsg] = useState('');

  // Assign pack form
  const [assignUserId, setAssignUserId] = useState('');
  const [assignPackId, setAssignPackId] = useState('');
  const [assignQty, setAssignQty] = useState(1);
  const [assignMsg, setAssignMsg] = useState('');

  const refresh = useCallback(() => {
    setCards(db.cards.getAll());
    setPacks(db.packs.getAll());
    setUsers(db.users.getAll());
    db.battleEvents.reseedIfEmpty();
    setBattleEvents(db.battleEvents.getAll());
  }, []);

  useEffect(() => {
    if (!currentUser?.isAdmin) {
      router.replace('/home');
      return;
    }
    refresh();
  }, [currentUser, router, refresh]);

  if (!currentUser?.isAdmin) return null;

  // ── Card handlers ──────────────────────────────────────────────────────

  const handleCardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cardToSave = {
      ...cardForm,
      characteristics: cardForm.characteristics.split(',').map(s => s.trim()).filter(s => s !== '')
    };

    if (editingCardId) {
      db.cards.update(editingCardId, cardToSave);
      setCardMsg('Card updated successfully.');
    } else {
      db.cards.create(cardToSave);
      setCardMsg('Card created successfully.');
    }
    setCardForm({ ...EMPTY_CARD });
    setEditingCardId(null);
    refresh();
    refreshAll();
    setTimeout(() => setCardMsg(''), 3000);
  };

  const handleCardEdit = (card: Card) => {
    setCardForm({
      name: card.name, subtitle: card.subtitle, rarity: card.rarity,
      image: card.image, type: card.type, cardClass: card.cardClass, shortLore: card.shortLore,
      isActive: card.isActive, foilOptional: card.foilOptional, dropWeight: card.dropWeight,
      characteristics: card.characteristics?.join(', ') || '',
    });
    setEditingCardId(card.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCardDelete = (id: string) => {
    if (confirm('Delete this card?')) {
      db.cards.delete(id);
      refresh();
    }
  };

  const compressImage = (file: File, callback: (base64: string) => void) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400; // Small max width drastically reduces file size
        const scale = Math.min(MAX_WIDTH / img.width, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) return callback(e.target?.result as string);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressedBase64 = canvas.toDataURL('image/webp', 0.6); // Compress to webp (40% compression)
        callback(compressedBase64);
      };
      img.onerror = () => {
        alert("Erro ao ler o arquivo de imagem. Certifique-se de que é uma imagem válida.");
        setIsUploading(false);
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      alert("Erro ao ler o arquivo.");
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    compressImage(file, async (base64) => {
      try {
        const url = await uploadImageServerAction(base64, 'cards');
        setCardForm((f) => ({ ...f, image: url }));
      } catch (err) {
        alert('Server Error: Falha ao arquivar a imagem base fisicamente. Tente novamente.');
      } finally {
        setIsUploading(false);
      }
    });
  };

  const handlePackImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    compressImage(file, async (base64) => {
      try {
        const url = await uploadImageServerAction(base64, 'packs');
        setPackForm((f) => ({ ...f, image: url }));
      } catch (err) {
        alert('Server Error: Falha ao arquivar a imagem base fisicamente. Tente novamente.');
      } finally {
        setIsUploading(false);
      }
    });
  };

  // ── Pack handlers ──────────────────────────────────────────────────────

  const handlePackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPackId) {
      db.packs.update(editingPackId, packForm);
      setPackMsg('Pack updated.');
    } else {
      db.packs.create(packForm);
      setPackMsg('Pack created.');
    }
    setPackForm({ ...EMPTY_PACK });
    setEditingPackId(null);
    refresh();
    refreshAll();
    setTimeout(() => setPackMsg(''), 3000);
  };

  // ── Assign handler ─────────────────────────────────────────────────────

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignUserId || !assignPackId) return;
    db.userPacks.assign(assignUserId, assignPackId, assignQty);
    setAssignMsg(`Assigned ${assignQty}× pack to user.`);
    setTimeout(() => setAssignMsg(''), 3000);
  };

  // ── Battle Event handlers ──────────────────────────────────────────────

  const handleBattleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBattleId) {
      db.battleEvents.update(editingBattleId, battleForm);
      setBattleMsg('Evento atualizado!');
    } else {
      db.battleEvents.create(battleForm);
      setBattleMsg('Evento criado!');
    }
    setBattleForm({ ...EMPTY_BATTLE_EVENT });
    setEditingBattleId(null);
    refresh();
    refreshBattleEvents();
    setTimeout(() => setBattleMsg(''), 3000);
  };

  const handleBattleEdit = (ev: BattleEvent) => {
    setBattleForm({
      name: ev.name, image: ev.image, lore: ev.lore,
      specialRule: ev.specialRule, reward: ev.reward,
      enemyCards: [...ev.enemyCards],
      revealedCount: ev.revealedCount,
      isActive: ev.isActive,
    });
    setEditingBattleId(ev.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.title}>Admin Panel</h1>
          <p className={styles.subtitle}>Manage cards, packs, and users</p>
          <button 
            className="btn" 
            style={{ marginTop: '1rem', padding: '0.5rem 1rem', fontSize: '0.9rem', maxWidth: '350px', background: 'var(--gold)', color: 'var(--bg-base)' }}
            onClick={() => {
              if (confirm('Isso vai migrar sua base de dados antiga sem perder as imagens e conteúdos salves. O processo vai expandir cartas com `quantity` para instâncias únicas de `Mint ID`. Continuar?')) {
                const oldCards = JSON.parse(localStorage.getItem('epicgg_cards') || '[]');
                const newCards = oldCards.map((c: any) => {
                  if (c.path && !c.type) {
                    let newType = c.path;
                    if (c.path === 'Arms') newType = 'Path of Arms';
                    if (c.path === 'Wisdom') newType = 'Path of Wisdom';
                    if (c.path === 'Subterfuge') newType = 'Path of Subterfuge';
                    c.type = newType;
                    delete c.path;
                  }
                  return c;
                });
                localStorage.setItem('epicgg_cards', JSON.stringify(newCards));

                // Explode legacy 'quantity' into unique UserCards
                const oldUserCards = JSON.parse(localStorage.getItem('epicgg_user_cards') || '[]');
                const newUserCards: any[] = [];
                let mintIdx = 10000;
                oldUserCards.forEach((uc: any) => {
                  if (uc.quantity !== undefined) {
                    for(let i=0; i<uc.quantity; i++) {
                      newUserCards.push({
                        id: `uc_mig_${Date.now()}_${Math.random().toString(36).substring(2,8)}`,
                        mintId: `BETA-LEG${(mintIdx++).toString().padStart(4,'0')}`,
                        cardId: uc.cardId,
                        userId: uc.userId,
                        source: 'legacy',
                        bonusRoll: 0,
                        foil: uc.foil || false,
                        acquiredAt: uc.acquiredAt || new Date().toISOString()
                      });
                    }
                  } else {
                    newUserCards.push(uc);
                  }
                });
                localStorage.setItem('epicgg_user_cards', JSON.stringify(newUserCards));
                alert('Cartas migradas (Imagens e customizações Mantidas)! Recarregando banco...');
                window.location.reload();
              }
            }}
          >
            ⚙️ Atualizar/Migrar Cartas Em Cache
          </button>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {(['cards', 'packs', 'users', 'battles'] as Tab[]).map((t) => (
            <button
              key={t}
              id={`admin-tab-${t}`}
              onClick={() => setTab(t)}
              className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            >
              {t === 'battles' ? '⚔ Batalhas' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* ── CARDS TAB ── */}
        {tab === 'cards' && (
          <div className={styles.tabContent}>
            <div className={styles.twoCol}>
              {/* Form */}
              <div className={styles.panel}>
                <h2 className={styles.panelTitle}>
                  {editingCardId ? 'Edit Card' : 'Create Card'}
                </h2>
                <form onSubmit={handleCardSubmit} className={styles.form}>
                  <div className={styles.formGrid}>
                    <div className="form-group">
                      <label className="form-label">Name *</label>
                      <input required className="form-input" value={cardForm.name}
                        onChange={(e) => setCardForm((f) => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Subtitle</label>
                      <input className="form-input" value={cardForm.subtitle}
                        onChange={(e) => setCardForm((f) => ({ ...f, subtitle: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Rarity</label>
                      <select className="form-input" value={cardForm.rarity}
                        onChange={(e) => setCardForm((f) => ({ ...f, rarity: e.target.value as Rarity }))}>
                        {RARITIES.map((r) => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Type</label>
                      <select className="form-input" value={cardForm.type}
                        onChange={(e) => {
                          const newType = e.target.value as CardType;
                          setCardForm((f) => ({ ...f, type: newType, cardClass: CLASSES_BY_TYPE[newType][0] }));
                        }}>
                        {CARD_TYPES.map((p) => <option key={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Class</label>
                      <select className="form-input" value={cardForm.cardClass}
                        onChange={(e) => setCardForm((f) => ({ ...f, cardClass: e.target.value as CardClass }))}>
                        {CLASSES_BY_TYPE[cardForm.type as CardType]?.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Drop Weight</label>
                      <input type="number" min={1} max={200} className="form-input" value={cardForm.dropWeight}
                        onChange={(e) => setCardForm((f) => ({ ...f, dropWeight: +e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Image File</label>
                      <input type="file" accept="image/*" className="form-input" onChange={handleImageUpload}
                        style={{ padding: '0.5rem' }} />
                    </div>
                    <div className="form-group" style={{ marginTop: '0.5rem' }}>
                      <label className="form-label">Características (separadas por vírgula)</label>
                      <input className="form-input" placeholder="Ex: Místico, Sombrio, Valente" value={cardForm.characteristics}
                        onChange={(e) => setCardForm((f) => ({ ...f, characteristics: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: '0.5rem' }}>
                    <label className="form-label">Short Lore</label>
                    <textarea className="form-input" rows={3} value={cardForm.shortLore}
                      onChange={(e) => setCardForm((f) => ({ ...f, shortLore: e.target.value }))}
                      style={{ resize: 'vertical' }} />
                  </div>
                  <div className={styles.checkboxRow}>
                    <label className={styles.checkbox}>
                      <input type="checkbox" checked={cardForm.isActive}
                        onChange={(e) => setCardForm((f) => ({ ...f, isActive: e.target.checked }))} />
                      Active
                    </label>
                    <label className={styles.checkbox}>
                      <input type="checkbox" checked={cardForm.foilOptional}
                        onChange={(e) => setCardForm((f) => ({ ...f, foilOptional: e.target.checked }))} />
                      Foil Optional
                    </label>
                  </div>
                  {cardForm.image && (
                    <div className={styles.imgPreview}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={cardForm.image} alt="preview" />
                    </div>
                  )}
                  {cardMsg && <p className={styles.successMsg}>{cardMsg}</p>}
                  <div className={styles.formActions}>
                    <button id="btn-save-card" type="submit" className="btn btn-primary" disabled={isUploading}>
                      {isUploading ? 'Salvando Imagem...' : (editingCardId ? 'Update Card' : 'Create Card')}
                    </button>
                    {editingCardId && (
                      <button type="button" className="btn btn-ghost"
                        onClick={() => { setEditingCardId(null); setCardForm({ ...EMPTY_CARD }); }}>
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Card list */}
              <div className={styles.panel}>
                <h2 className={styles.panelTitle}>All Cards ({cards.length})</h2>
                <div className={styles.list}>
                  {cards.map((card) => (
                    <div key={card.id} className={styles.listItem}>
                      <div className={styles.listItemInfo}>
                        <div className={styles.listItemName}>{card.name}</div>
                        <div className={styles.listItemMeta}>
                          <span className={`${styles.miniRarity} ${styles[`rarity-${card.rarity.toLowerCase()}`]}`}>
                            {card.rarity}
                          </span>
                          <span className={styles.listItemFaction}>{card.type} • {card.cardClass}</span>
                          {!card.isActive && <span className={styles.inactiveBadge}>Inactive</span>}
                        </div>
                      </div>
                      <div className={styles.listItemActions}>
                        <button className="btn btn-ghost" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                          onClick={() => handleCardEdit(card)}>Edit</button>
                        <button className="btn btn-danger" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                          onClick={() => handleCardDelete(card.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                  {cards.length === 0 && <p className={styles.emptyList}>No cards yet.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PACKS TAB ── */}
        {tab === 'packs' && (
          <div className={styles.tabContent}>
            <div className={styles.twoCol}>
              {/* Pack form */}
              <div className={styles.panel}>
                <h2 className={styles.panelTitle}>
                  {editingPackId ? 'Edit Pack' : 'Create Pack'}
                </h2>
                <form onSubmit={handlePackSubmit} className={styles.form}>
                  <div className="form-group">
                    <label className="form-label">Pack Name *</label>
                    <input required className="form-input" value={packForm.name}
                      onChange={(e) => setPackForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea className="form-input" rows={3} value={packForm.description}
                      onChange={(e) => setPackForm((f) => ({ ...f, description: e.target.value }))}
                      style={{ resize: 'vertical' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cards Per Pack</label>
                    <input type="number" min={1} max={10} className="form-input" value={packForm.cardsPerPack}
                      onChange={(e) => setPackForm((f) => ({ ...f, cardsPerPack: +e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Pack Image</label>
                    <input type="file" accept="image/*" className="form-input" onChange={handlePackImageUpload}
                      style={{ padding: '0.5rem' }} />
                  </div>
                  {packForm.image && (
                    <div className={styles.imgPreview}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={packForm.image} alt="pack preview" />
                    </div>
                  )}
                  <label className={styles.checkbox}>
                    <input type="checkbox" checked={packForm.isActive}
                      onChange={(e) => setPackForm((f) => ({ ...f, isActive: e.target.checked }))} />
                    Active
                  </label>
                  {packMsg && <p className={styles.successMsg}>{packMsg}</p>}
                  <div className={styles.formActions}>
                    <button id="btn-save-pack" type="submit" className="btn btn-primary" disabled={isUploading}>
                      {isUploading ? 'Salvando Imagem...' : (editingPackId ? 'Update Pack' : 'Create Pack')}
                    </button>
                    {editingPackId && (
                      <button type="button" className="btn btn-ghost"
                        onClick={() => { setEditingPackId(null); setPackForm({ ...EMPTY_PACK }); }}>
                        Cancel
                      </button>
                    )}
                  </div>
                </form>

                {/* Assign pack section */}
                <div className={styles.divider} />
                <h2 className={styles.panelTitle}>Assign Packs to User</h2>
                <form onSubmit={handleAssign} className={styles.form}>
                  <div className="form-group">
                    <label className="form-label">User</label>
                    <select className="form-input" value={assignUserId}
                      onChange={(e) => setAssignUserId(e.target.value)} required>
                      <option value="">Select user...</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Pack</label>
                    <select className="form-input" value={assignPackId}
                      onChange={(e) => setAssignPackId(e.target.value)} required>
                      <option value="">Select pack...</option>
                      {packs.filter(p => p.isActive).map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Quantity</label>
                    <input type="number" min={1} max={100} className="form-input" value={assignQty}
                      onChange={(e) => setAssignQty(+e.target.value)} />
                  </div>
                  {assignMsg && <p className={styles.successMsg}>{assignMsg}</p>}
                  <button id="btn-assign-pack" type="submit" className="btn btn-gold">
                    Assign Packs
                  </button>
                </form>
              </div>

              {/* Pack list */}
              <div className={styles.panel}>
                <h2 className={styles.panelTitle}>All Packs ({packs.length})</h2>
                <div className={styles.list}>
                  {packs.map((pack) => (
                    <div key={pack.id} className={styles.listItem}>
                      <div className={styles.listItemInfo}>
                        <div className={styles.listItemName}>{pack.name}</div>
                        <div className={styles.listItemMeta}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {pack.cardsPerPack - 1}–{pack.cardsPerPack} cards
                          </span>
                          {!pack.isActive && <span className={styles.inactiveBadge}>Inactive</span>}
                        </div>
                      </div>
                      <div className={styles.listItemActions}>
                        <button className="btn btn-ghost" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                          onClick={() => {
                            setPackForm({ name: pack.name, description: pack.description, image: pack.image, cardsPerPack: pack.cardsPerPack, isActive: pack.isActive });
                            setEditingPackId(pack.id);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}>Edit</button>
                        <button className="btn btn-danger" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                          onClick={() => { if (confirm('Delete?')) { db.packs.delete(pack.id); refresh(); } }}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── USERS TAB ── */}
        {tab === 'users' && (
          <div className={styles.tabContent}>
            <div className={styles.panel}>
              <h2 className={styles.panelTitle}>All Users ({users.length})</h2>
              <div className={styles.list}>
                {users.map((user) => {
                  const userPacksList = db.userPacks.getByUser(user.id);
                  const totalPacks = userPacksList.reduce((s, up) => s + up.quantity, 0);
                  const userCardsList = db.userCards.getByUser(user.id);
                  const totalCards = userCardsList.length;
                  return (
                    <div key={user.id} className={styles.listItem}>
                      <div className={styles.listItemInfo}>
                        <div className={styles.listItemName}>
                          {user.name}
                          {user.isAdmin && <span className={styles.adminTag}>Admin</span>}
                        </div>
                        <div className={styles.listItemMeta}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{user.email}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>📦 {totalPacks} packs · 🃏 {totalCards} cards</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {/* ── BATTLES TAB ── */}
        {tab === 'battles' && (
          <div className={styles.tabContent}>
            <div className={styles.twoCol}>
              {/* Battle Event Form */}
              <div className={styles.panel}>
                <h2 className={styles.panelTitle}>
                  {editingBattleId ? 'Editar Evento' : 'Criar Evento de Batalha'}
                </h2>
                <form onSubmit={handleBattleSubmit} className={styles.form}>
                  <div className={styles.formGrid}>
                    <div className="form-group">
                      <label className="form-label">Nome do Evento *</label>
                      <input required className="form-input" value={battleForm.name}
                        onChange={(e) => setBattleForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Cartas Reveladas (pré-batalha)</label>
                      <input type="number" min={0} max={battleForm.enemyCards.length} className="form-input"
                        value={battleForm.revealedCount}
                        onChange={(e) => setBattleForm(f => ({ ...f, revealedCount: +e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Imagem (URL ou upload)</label>
                      <input className="form-input" placeholder="https://..." value={battleForm.image}
                        onChange={(e) => setBattleForm(f => ({ ...f, image: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Upload de Imagem</label>
                      <input type="file" accept="image/*" className="form-input"
                        style={{ padding: '0.5rem' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setIsUploading(true);
                          const reader = new FileReader();
                          reader.onload = async (ev) => {
                            try {
                              const url = await uploadImageServerAction(ev.target?.result as string, 'battles');
                              setBattleForm(f => ({ ...f, image: url }));
                            } finally { setIsUploading(false); }
                          };
                          reader.readAsDataURL(file);
                        }} />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: '0.5rem' }}>
                    <label className="form-label">Lore / Descrição</label>
                    <textarea className="form-input" rows={3} value={battleForm.lore}
                      onChange={(e) => setBattleForm(f => ({ ...f, lore: e.target.value }))}
                      style={{ resize: 'vertical' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Regra Especial</label>
                    <input className="form-input" value={battleForm.specialRule}
                      onChange={(e) => setBattleForm(f => ({ ...f, specialRule: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Recompensa (vitória)</label>
                    <input className="form-input" value={battleForm.reward}
                      onChange={(e) => setBattleForm(f => ({ ...f, reward: e.target.value }))} />
                  </div>

                  {/* Enemy deck builder */}
                  <div className="form-group" style={{ marginTop: '0.5rem' }}>
                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Deck Inimigo ({battleForm.enemyCards.length} cartas)</span>
                      <button type="button" className="btn btn-ghost"
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
                        onClick={() => setBattleForm(f => ({ ...f, enemyCards: [...f.enemyCards, ''] }))}>
                        + Adicionar
                      </button>
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {battleForm.enemyCards.map((cardId, idx) => {
                        const card = db.cards.getById(cardId);
                        return (
                          <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                              list="card-ids-list"
                              className="form-input"
                              style={{ flex: 1, fontSize: '0.85rem' }}
                              placeholder="ID da carta (ex: c1, r2, l3...)"
                              value={cardId}
                              onChange={(e) => {
                                const updated = [...battleForm.enemyCards];
                                updated[idx] = e.target.value;
                                setBattleForm(f => ({ ...f, enemyCards: updated }));
                              }}
                            />
                            <span style={{ fontSize: '0.75rem', color: card ? 'var(--gold)' : 'var(--text-muted)', minWidth: '80px' }}>
                              {card ? card.name : 'Não encontrado'}
                            </span>
                            <button type="button" onClick={() => {
                              const updated = battleForm.enemyCards.filter((_, j) => j !== idx);
                              setBattleForm(f => ({ ...f, enemyCards: updated }));
                            }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1.1rem', flexShrink: 0 }}>✖</button>
                          </div>
                        );
                      })}
                    </div>
                    {/* Datalist for card ID hints */}
                    <datalist id="card-ids-list">
                      {cards.map(c => <option key={c.id} value={c.id}>{c.name} ({c.rarity})</option>)}
                    </datalist>
                    {battleForm.enemyCards.length > 0 && (
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                        Reveladas antes da batalha: {Math.min(battleForm.revealedCount, battleForm.enemyCards.length)} de {battleForm.enemyCards.length}
                      </p>
                    )}
                  </div>

                  <div className={styles.checkboxRow}>
                    <label className={styles.checkbox}>
                      <input type="checkbox" checked={battleForm.isActive}
                        onChange={(e) => setBattleForm(f => ({ ...f, isActive: e.target.checked }))} />
                      Ativo
                    </label>
                  </div>

                  {battleMsg && <p className={styles.successMsg}>{battleMsg}</p>}
                  <div className={styles.formActions}>
                    <button type="submit" className="btn btn-primary" disabled={isUploading}>
                      {editingBattleId ? 'Atualizar Evento' : 'Criar Evento'}
                    </button>
                    {editingBattleId && (
                      <button type="button" className="btn btn-ghost"
                        onClick={() => { setEditingBattleId(null); setBattleForm({ ...EMPTY_BATTLE_EVENT }); }}>
                        Cancelar
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Battle Event list */}
              <div className={styles.panel}>
                <h2 className={styles.panelTitle}>Eventos ({battleEvents.length})</h2>
                <div className={styles.list}>
                  {battleEvents.map(ev => (
                    <div key={ev.id} className={styles.listItem}>
                      <div className={styles.listItemInfo}>
                        <div className={styles.listItemName}>{ev.name}</div>
                        <div className={styles.listItemMeta}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {ev.enemyCards.length} inimigos · {ev.revealedCount} revelados
                          </span>
                          {!ev.isActive && <span className={styles.inactiveBadge}>Inativo</span>}
                        </div>
                      </div>
                      <div className={styles.listItemActions}>
                        <button className="btn btn-ghost" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                          onClick={() => handleBattleEdit(ev)}>Editar</button>
                        <button className="btn btn-danger" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                          onClick={() => { if (confirm('Deletar evento?')) { db.battleEvents.delete(ev.id); refresh(); refreshBattleEvents(); } }}>
                          Deletar
                        </button>
                      </div>
                    </div>
                  ))}
                  {battleEvents.length === 0 && <p className={styles.emptyList}>Nenhum evento ainda.</p>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
