// Page 404 (convention app router) — appliquée automatiquement pour toute
// route inexistante, avec la même identité visuelle que le reste de l'app.
export default function NotFound() {
  return (
    <div className="container" style={{ maxWidth: 480 }}>
      <div className="glass-panel" style={{ textAlign: 'center' }}>
        <div className="header">
          <h1>404</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>Cette page n'existe pas ou plus.</p>
        </div>
        <a href="/" className="back-btn">
          ← Accueil
        </a>
      </div>
    </div>
  );
}
