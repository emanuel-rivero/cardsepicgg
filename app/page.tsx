'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';

/**
 * Entry point da aplicacao.
 * Redireciona automaticamente para a area autenticada (/packs) ou publica (/login).
 */
export default function RootPage() {
  const { currentUser, isLoading } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (currentUser) {
        router.replace('/packs');
      } else {
        router.replace('/login');
      }
    }
  }, [currentUser, isLoading, router]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base)',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          border: '3px solid var(--border-subtle)',
          borderTopColor: 'var(--purple-light)',
          borderRadius: '50%',
          animation: 'spin-slow 0.8s linear infinite',
        }}
      />
    </div>
  );
}
