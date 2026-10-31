// Page 404 (convention app router) — appliquée automatiquement pour toute
// route inexistante, avec la même identité visuelle que le reste de l'app.
import Link from 'next/link';
import { SponsoredLink } from '@/components/AdsterraAds';
export default function NotFound() {
  return (
    <div className="container" style={{ maxWidth: 480 }}>
      <div className="glass-panel" style={{ textAlign: 'center' }}>
        <div className="header">
          <h1>404</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>Cette page n'existe pas ou plus.</p>
        </div>
        <Link href="/" className="back-btn">
          ← Accueil
        </Link>
        <SponsoredLink label="En attendant, découvrir une offre partenaire" />
      </div>
    </div>
  );
}
