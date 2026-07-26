// Module « Géomancie (Tourab) » — logique pure portée de geomancie/tourab.html.
// Calcul de l'écu géomantique : 4 Mères → 16 Maisons (filles, petites-filles,
// témoins, juge, sentence), figures binaires (lignes à 1 ou 2 points), valeur
// بزدح, parité du juge et synthèse (vœu / repérage). Aucune dépendance UI ; les
// textes/titres viennent de Firebase et sont passés en argument.

// Signature binaire d'une figure → index (1..16) dans les données Firebase.
export const figureToJsonIndex = {
  1121: 1, // Youssouf
  1222: 2, // Adama
  2111: 3, // Mahdiou
  2212: 4, // Idrissa
  1111: 5, // Ibrahima
  1212: 6, // Issa
  2122: 7, // Oumar
  2221: 8, // Ayyoube
  1122: 9, // Allahou tall
  1221: 10, // Souleymane
  2112: 11, // Ali
  2211: 12, // Nouhou
  1112: 13, // Housseynou
  1211: 14, // Younouss
  2121: 15, // Ousmane
  2222: 16, // Moussa
};

export const restingFigures = [
  '1121', '1222', '2111', '2212', '1111', '1212', '2122', '2221',
  '1122', '1221', '2112', '2211', '1112', '1211', '2121', '2222',
];

export const houseNames = [
  "L'Âme", 'Les Biens', "L'Entourage", 'Le Foyer', 'Les Projets', "L'Épreuve",
  'Les Alliances', "L'Issue", 'Les Déplacements', 'Le Pouvoir', 'Les Espérances',
  'Les Écueils', 'Le Témoin Actif', 'Le Témoin Passif', 'Le Juge Suprême', 'La Sentence Finale',
];

// Valeur بزدح (ordre) d'une figure.
export function getBZDHValue(figArray) {
  let val = 0;
  if (figArray[0] === 1) val += 2;
  if (figArray[1] === 1) val += 7;
  if (figArray[2] === 1) val += 4;
  if (figArray[3] === 1) val += 8;
  return val;
}

// Addition géomantique de deux lignes / figures.
export function addLignes(a, b) {
  return (a + b) % 2 === 1 ? 1 : 2;
}
export function addFigures(figA, figB) {
  return figA.map((val, i) => addLignes(val, figB[i]));
}
export function figToKey(fig) {
  return fig.join('');
}
export function keyToFig(key) {
  return key.split('').map(Number);
}

function transposeMothers(mothersArr) {
  const daughters = [];
  for (let row = 0; row < 4; row++) {
    daughters.push([mothersArr[0][row], mothersArr[1][row], mothersArr[2][row], mothersArr[3][row]]);
  }
  return daughters;
}

// Génère les 16 Maisons à partir des 4 Mères.
export function generateAllHouses(mothersArr) {
  const h = [];
  for (let i = 0; i < 4; i++) h.push([...mothersArr[i]]);
  const daughters = transposeMothers(mothersArr);
  for (let i = 0; i < 4; i++) h.push([...daughters[i]]);
  h.push(addFigures(h[0], h[1]));
  h.push(addFigures(h[2], h[3]));
  h.push(addFigures(h[4], h[5]));
  h.push(addFigures(h[6], h[7]));
  h.push(addFigures(h[8], h[9]));
  h.push(addFigures(h[10], h[11]));
  h.push(addFigures(h[12], h[13]));
  h.push(addFigures(h[14], h[0]));
  return h;
}

export function checkJudgeParity(houses) {
  const judge = houses[14];
  const total = judge.reduce((a, b) => a + b, 0);
  return { even: total % 2 === 0, total };
}

// Titre depuis Firebase (index par la signature binaire).
export function getCleanName(key, fbData) {
  const idx = figureToJsonIndex[key];
  if (fbData && fbData[idx] && fbData[idx].titre) return fbData[idx].titre.split(' ')[0];
  return '?';
}
export function getFullTitle(key, fbData) {
  const idx = figureToJsonIndex[key];
  if (fbData && fbData[idx] && fbData[idx].titre) return fbData[idx].titre;
  return 'Figure ' + key;
}
export function figureData(key, fbData) {
  const idx = figureToJsonIndex[key];
  return fbData && fbData[idx] ? fbData[idx] : null;
}

// Synthèse : vœu (M8+M1+M3+M5) et figure de repérage (M2+M4+M7+M8).
export function synthesis(houses) {
  const voeuFig = addFigures(addFigures(houses[7], houses[0]), addFigures(houses[2], houses[4]));
  const repFig = addFigures(addFigures(houses[1], houses[3]), addFigures(houses[6], houses[7]));
  return { voeuFig, voeuKey: figToKey(voeuFig), repFig, repKey: figToKey(repFig) };
}

// Données structurées pour la modale d'une maison.
export function houseModalData(houseIndex, houses, fbData) {
  const houseFig = houses[houseIndex];
  const houseKey = figToKey(houseFig);
  const base = {
    houseIndex,
    houseName: houseNames[houseIndex],
    houseFig,
    houseKey,
    title: getFullTitle(houseKey, fbData),
    cleanName: getCleanName(houseKey, fbData),
    bzdh: getBZDHValue(houseFig),
  };

  if (houseIndex === 14) {
    return { ...base, kind: 'judge', data: figureData(houseKey, fbData) };
  }
  if (houseIndex === 15) {
    const m1 = houses[0];
    return {
      ...base,
      kind: 'sentence',
      judgeFig: houses[14],
      m1Fig: m1,
      m1Name: getCleanName(figToKey(m1), fbData),
      data: figureData(houseKey, fbData),
    };
  }

  const restingFig = keyToFig(restingFigures[houseIndex]);
  const judgeFig = houses[14];
  const step1 = addFigures(houseFig, restingFig);
  const step1Key = figToKey(step1);
  const step2 = addFigures(step1, judgeFig);
  const step2Key = figToKey(step2);
  return {
    ...base,
    kind: 'normal',
    step1,
    step1Title: getFullTitle(step1Key, fbData),
    step1Data: figureData(step1Key, fbData),
    step2,
    step2Title: getFullTitle(step2Key, fbData),
    step2Data: figureData(step2Key, fbData),
  };
}

// Mères aléatoires / neutres.
export function randomMothers() {
  const m = [];
  for (let i = 0; i < 4; i++) {
    const row = [];
    for (let r = 0; r < 4; r++) row.push(Math.random() < 0.5 ? 1 : 2);
    m.push(row);
  }
  return m;
}
export function neutralMothers() {
  return [[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]];
}
