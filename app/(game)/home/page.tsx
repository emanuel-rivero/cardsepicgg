'use client';

import { Suspense } from 'react';
import PackOpener from '@/components/PackOpener';

/**
 * Home autenticada focada na abertura de pacotes.
 * Usa Suspense para fallback visual durante carregamento do componente principal.
 */
export default function HomePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 44, height: 44,
          border: '3px solid var(--border-subtle)',
          borderTopColor: 'var(--purple-light)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <PackOpener />
    </Suspense>
  );
}
