'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';
import styles from '../login/auth.module.css';

export default function RegisterPage() {
  const { register } = useApp();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = register(name.trim(), email.trim(), password);
    setLoading(false);
    if (result.success) {
      router.push('/home');
    } else {
      setError(result.error || 'Registration failed.');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.bg} />
      <div className={styles.bgOrb1} />
      <div className={styles.bgOrb2} />

      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>⚔</span>
          <span className={styles.logoText}>
            Cards<span className={styles.logoAccent}>Epic</span>.gg
          </span>
        </div>

        <h1 className={styles.title}>Begin Your Journey</h1>
        <p className={styles.subtitle}>Create your account and receive 3 free starter packs</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className="form-group">
            <label htmlFor="reg-name" className="form-label">Name</label>
            <input
              id="reg-name"
              type="text"
              className="form-input"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-email" className="form-label">Email</label>
            <input
              id="reg-email"
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
            <label htmlFor="reg-password" className="form-label">Password</label>
            <input
              id="reg-password"
              type="password"
              className="form-input"
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            id="btn-register"
            type="submit"
            className="btn btn-gold"
            disabled={loading}
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {loading ? 'Creating account...' : '✦ Create Account ✦'}
          </button>
        </form>

        <div className={styles.gift}>
          🎁 You will receive <strong>3 Void Starter Packs</strong> for free upon registration
        </div>

        <div className={styles.footer}>
          <span className="text-muted">Already have an account?</span>{' '}
          <Link href="/login" className={styles.link}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
