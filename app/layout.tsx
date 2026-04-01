import type { Metadata } from 'next';
import { Cinzel, Inter } from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/lib/store';

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  display: 'swap',
  weight: ['400', '500', '600', '700', '900'],
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Cards Epic.gg — Dark Fantasy Collectibles',
  description:
    'Open packs, collect legendary cards, and build your ultimate dark fantasy deck. Cards Epic.gg — premium digital collectible card experience.',
  keywords: ['card game', 'collectible', 'dark fantasy', 'NFT cards', 'pack opening'],
};

/**
 * Layout raiz da aplicacao.
 * Injeta fontes globais, metadata e o AppProvider (estado global/contexto).
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${inter.variable}`}>
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
