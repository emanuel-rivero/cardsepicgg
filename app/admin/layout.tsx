'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';
import Navbar from '@/components/Navbar';

/**
 * Layout da area administrativa.
 * Restringe acesso a usuarios admin e compartilha a Navbar do jogo.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, isLoading } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!currentUser) router.replace('/login');
      else if (!currentUser.isAdmin) router.replace('/home');
    }
  }, [currentUser, isLoading, router]);

  if (isLoading || !currentUser?.isAdmin) return null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <main style={{ flex: 1 }}>{children}</main>
    </div>
  );
}
