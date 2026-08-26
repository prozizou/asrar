// CosmicBackground — fond animé partagé (halo de nébuleuse + ciel étoilé).
// Monté une seule fois dans app/layout.js, derrière tout le reste de l'app
// (voir .cosmic-bg dans globals.css : position fixed, z-index négatif) afin
// que chaque page — connexion, marché, menu, secrets, etc. — en bénéficie
// sans rien changer à son propre rendu. Purement décoratif (aria-hidden),
// piloté par les tokens --accent/--accent-hover/--star-opacity déjà définis
// par thème dans globals.css : aucune couleur codée en dur ici.
//
// Direction ajoutée par la maquette Claude Design « Asrar Mystic » (voir
// project/Asrar Mystic.dc.html du bundle de handoff) — absente de l'app
// jusqu'ici, le reste (thème violet/magenta, glass-panel, micro-interactions
// des modules) existait déjà. Composant serveur : purement statique, pas de
// state ni d'effet, pas besoin de 'use client'.
export default function CosmicBackground() {
  return (
    <div className="cosmic-bg" aria-hidden="true">
      <div className="cosmic-blob cosmic-blob-a" />
      <div className="cosmic-blob cosmic-blob-b" />
      <div className="cosmic-stars" />
    </div>
  );
}
