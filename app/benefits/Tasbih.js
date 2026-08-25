'use client';
// Compteur de dhikr d'une carte de nom — enveloppe d'affichage autour du
// chapelet partagé (components/TasbihChapelet.js, également utilisé par le
// Zikr collectif). Ne garde ici que l'ouverture/fermeture repliable, pilotée
// par le bouton empreinte de la carte (NameCard.js) ; toute la logique métier
// vit dans useTasbih, et tout le rendu du chapelet dans TasbihChapelet.
//
// IMPORTANT : le chapelet n'est monté QUE si `open` est vrai. La page /benefits
// affiche les 99 noms d'un coup, sans virtualisation (app/benefits/page.js) —
// un <Tasbih> par carte. Le chapelet du ZIP est bien plus lourd que l'ancien
// arc à 9 grains : 100 grains DOM + un échantillonnage du tracé SVG (un point
// par pixel) au montage. Le monter pour LES 99 CARTES à la fois (avant, seule
// la visibilité CSS — display:none — masquait le contenu, déjà monté) a rendu
// la page injouable sur téléphone (gel/plantage) — corrigé en ne le montant
// que pour la carte réellement ouverte.
import TasbihChapelet from '@/components/TasbihChapelet';

export default function Tasbih({ id, t, open }) {
  return (
    <div className={'inline-tasbih' + (open ? ' active' : '')} id={`inline-tasbih-${id}`}>
      {open && <TasbihChapelet id={id} t={t} />}
    </div>
  );
}
