'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';
import styles from './auth.module.css';

/**
 * Tela de autenticacao.
 * Controla submissao local de credenciais e redireciona para /home em caso de sucesso.
 */
export default function LoginPage() {
  const { login } = useApp();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /**
   * Handler do formulario de login com controle de loading e erro.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = login(email.trim(), password);
    setLoading(false);
    if (result.success) {
      router.push('/home');
    } else {
      setError(result.error || 'Login failed.');
    }
  };

  return (
    <div className={styles.page}>
      {/* Background */}
      <div className={styles.bg} />
      <div className={styles.bgOrb1} />
      <div className={styles.bgOrb2} />

      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logo}>
          <span className={styles.logoIcon}>⚔</span>
          <span className={styles.logoText}>
            Cards<span className={styles.logoAccent}>Epic</span>.gg
          </span>
        </div>

        <h1 className={styles.title}>Welcome Back</h1>
        <p className={styles.subtitle}>Sign in to your account to continue your journey</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className="form-group">
            <label htmlFor="login-email" className="form-label">Email</label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password" className="form-label">Password</label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            id="btn-login"
            type="submit"
            className="btn btn-gold"
            disabled={loading}
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {loading ? 'Signing in...' : '✦ Sign In ✦'}
          </button>
        </form>

        <div className={styles.hint}>
          <span className="text-muted">Admin demo: </span>
          <code style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>admin@epicgg.com / admin123</code>
        </div>

        <div className={styles.footer}>
          <span className="text-muted">New to Cards Epic.gg?</span>{' '}
          <Link href="/register" className={styles.link}>Create account</Link>
        </div>
      </div>
    </div>
  );
}
