'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/lib/store';
import styles from './Navbar.module.css';

const NAV_LINKS = [
  { href: '/home', label: 'Open Pack' },
  { href: '/collection', label: 'Collection' },
  { href: '/packs', label: 'Packs' },
  { href: '/battle', label: 'Battle' },
  { href: '/fusion', label: '⚗ Fusion' },
];

/**
 * Navbar principal da area autenticada.
 * Exibe navegacao de features, saldo do usuario e atalho de logout/admin.
 */
export default function Navbar() {
  const { currentUser, logout, userPacks, allPacks } = useApp();
  const pathname = usePathname();

  const totalPacks = userPacks.reduce((sum, up) => sum + up.quantity, 0);

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        {/* Logo */}
        <Link href="/home" className={styles.logo}>
          <span className={styles.logoIcon}>⚔</span>
          <span className={styles.logoText}>
            Cards<span className={styles.logoAccent}>Epic</span>.gg
          </span>
        </Link>

        {/* Nav links */}
        <ul className={styles.links}>
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`${styles.link} ${pathname === link.href ? styles.active : ''}`}
              >
                {link.label}
                {link.href === '/home' && totalPacks > 0 && (
                  <span className={styles.badge}>{totalPacks}</span>
                )}
              </Link>
            </li>
          ))}
          {currentUser?.isAdmin && (
            <li>
              <Link
                href="/admin"
                className={`${styles.link} ${styles.adminLink} ${pathname === '/admin' ? styles.active : ''}`}
              >
                Admin
              </Link>
            </li>
          )}
        </ul>

        <div className={styles.rightArea}>
          {/* Currency Widget */}
          {currentUser && (
            <div className={styles.balanceWidget}>
              <span className={styles.balanceLabel}>BALANCE</span>
              <div className={styles.balanceItem}>
                <span className={styles.balanceIconGold}>🟡</span>
                <span className={styles.balanceValue}>{(currentUser.coins || 0).toLocaleString()}</span>
              </div>
              <div className={styles.balanceItem}>
                <span className={styles.balanceIconSilver}>⚪</span>
                <span className={styles.balanceValue}>{(currentUser.epicPoints || 0).toLocaleString()}</span>
              </div>
              <button className={styles.balanceAdd}>+</button>
            </div>
          )}

          {/* User area */}
          <div className={styles.user}>
            <span className={styles.userName}>{currentUser?.name}</span>
            <button onClick={logout} className={styles.logoutBtn} id="btn-logout">
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
