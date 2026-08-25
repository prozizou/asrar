'use client';
// Compteur de dhikr d'une carte de nom — enveloppe d'affichage autour du
// chapelet partagé (components/TasbihChapelet.js, également utilisé par le
// Zikr collectif). Ne garde ici que l'ouverture/fermeture repliable, pilotée
// par le bouton empreinte de la carte (NameCard.js) ; toute la logique métier
// vit dans useTasbih, et tout le rendu du chapelet dans TasbihChapelet.
import TasbihChapelet from '@/components/TasbihChapelet';

export default function Tasbih({ id, t, open }) {
  return (
    <div className={'inline-tasbih' + (open ? ' active' : '')} id={`inline-tasbih-${id}`}>
      <TasbihChapelet id={id} t={t} />
    </div>
  );
}
