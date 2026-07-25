'use client';
// Accueil du pilote — un menu minimal qui pointe vers le module migré.
// (L'accueil complet des 17 rubriques reste sur le site statique existant.)
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

export default function Home() {
  const { user, signOut } = useAuth();

  return (
    <div className="container">
      <div className="header">
        <h1>ASRAR PRO</h1>
        <p style={{ color: 'var(--text-muted)' }}>Pilote Next.js — coquille partagée + module Secrets</p>
      </div>

      <div className="glass-panel">
        <p style={{ marginBottom: 16, color: 'var(--text-muted)' }}>
          Connecté en tant que <b>{user?.email}</b>
        </p>
        <div className="grid-menu">
          <Link href="/asrar" className="menu-item">
            <div style={{ fontSize: '2rem' }}>📜</div>
            <h3>Secrets Mystiques</h3>
          </Link>
          <Link href="/marche" className="menu-item">
            <div style={{ fontSize: '2rem' }}>🛒</div>
            <h3>Marché Mystique</h3>
          </Link>
        </div>
        <button onClick={signOut} style={{ marginTop: 24 }}>
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
