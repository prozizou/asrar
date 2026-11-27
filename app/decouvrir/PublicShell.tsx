// Gabarit des pages publiques (app/decouvrir) : rendu serveur, sans connexion
// ni publicité. Voir lib/publicPages.js.
import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { PLAY_STORE_URL } from '@/lib/publicPages';
import './decouvrir.css';

export default function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="pub-page">
      <header className="pub-header">
        <Link href="/decouvrir" className="pub-brand">
          <Image src="/assets/logo-mark.png" alt="" width={36} height={36} />
          <span>ASRAR PRO</span>
        </Link>
        <nav aria-label="Pages publiques" className="pub-nav">
          <Link href="/decouvrir">Découvrir</Link>
          <Link href="/decouvrir/a-propos">À propos</Link>
          <Link href="/decouvrir/contact">Contact</Link>
        </nav>
      </header>
      <main className="pub-main">{children}</main>
      <footer className="pub-footer">
        <p>
          <a href={PLAY_STORE_URL} rel="noopener">Application Android sur Google Play</a>
          {' · '}<Link href="/">Se connecter</Link>
          {' · '}<a href="/confidentialite.html">Politique de confidentialité</a>
          {' · '}<Link href="/decouvrir/contact">Contact</Link>
        </p>
        <p>© ASRAR PRO — Sénégal</p>
      </footer>
    </div>
  );
}
