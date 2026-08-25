// lib/objSubdivisions.js — Subdivision d'un objectif N en paires base×séries
// (ex. 100 → 50×2, 25×4, 20×5…), affichées en puces sous le champ « Objectif »
// du compteur de dhikr : « 50×2 » se lit « 50 grains, 2 séries » (comme la
// pratique traditionnelle « 33×3 »). Cliquer une puce règle directement le
// nombre de séries — d'où le retour d'objets (et non de simples chaînes) :
// le composant a besoin de `series` pour appliquer le réglage.
//
// Module isolé (plutôt que dans lib/benefits.js) : celui-ci importe Firebase
// pour charger les 99 Noms, alors que cette fonction est purement
// arithmétique et sert aussi au Zikr collectif — la garder à part évite de
// tirer Firebase dans ce module-là. Même découpage que le ZIP de référence.

/**
 * @param {number|string} n objectif à subdiviser
 * @returns {{base:number, series:number, label:string}[]} au plus 40 paires,
 *   des séries les plus courtes aux plus longues.
 */
export function objSubdivisions(n) {
  const value = typeof n === 'string' ? parseInt(n, 10) : n;
  if (!value || value <= 1) return [];
  const out = [];
  for (let a = value - 1; a >= 2 && out.length < 40; a--) {
    if (value % a === 0) {
      const series = value / a;
      out.push({ base: a, series, label: `${a}×${series}` });
    }
  }
  return out;
}
