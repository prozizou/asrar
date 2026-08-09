// Worker dédié à l'assemblage du document Word (.docx) — voir generateDocx()
// dans lib/alqalam.js, qui spawn ce worker et lui poste des segments déjà
// extraits du DOM (voir htmlToColorSegments, qui elle DOIT rester sur le
// thread principal : un Worker n'a pas accès à `document`).
//
// Pourquoi un Worker : sur les documents volumineux (répétitions cumulées de
// plusieurs centaines de milliers de mots colorés), la construction du XML
// .docx et sa compression (Packer.toBlob, librairie `docx` + JSZip) peuvent
// prendre plusieurs minutes — c'est une limite de ces librairies, pas de notre
// code (voir le commentaire de repeatSegments plus bas pour la partie qu'on
// contrôle). Sans Worker, ce temps gèle complètement l'onglet/le téléphone ;
// avec, l'app reste utilisable et la barre de progression continue d'avancer.
import { Document, Packer, Paragraph, AlignmentType, Footer, PageNumber, TextRun } from 'docx';

function segmentsToRuns(segments, size) {
  return segments.map((seg) => new TextRun({ text: seg.text, size, rightToLeft: true, color: seg.color || undefined }));
}

// `target.push(...items)` fait planter le moteur JS ("Maximum call stack size
// exceeded") au-delà d'environ 65 536 éléments passés en arguments — atteint
// dès quelques milliers de répétitions. Fusion en boucle, sans limite.
function pushAll(target, items) {
  for (let i = 0; i < items.length; i++) target.push(items[i]);
}

// Duplique une petite unité de segments `n` fois SANS repasser par le DOM :
// simple concaténation de texte (deux segments consécutifs de même couleur —
// dont la jonction entre deux répétitions — fusionnent en un seul run, ce qui
// limite aussi le nombre de runs dans le .docx final). Reste toutefois O(n) :
// si le texte de base contient lui-même des mots colorés, le document final a
// structurellement besoin d'un run par occurrence de mot coloré — c'est une
// contrainte du format .docx (un changement de couleur = un nouveau <w:r>),
// pas quelque chose qu'on peut compresser davantage ici.
function repeatSegments(segments, n) {
  if (n <= 0 || !segments.length) return [];
  const merged = [{ ...segments[0] }];
  for (let i = 1; i < segments.length; i++) merged.push({ ...segments[i] });
  for (let rep = 1; rep < n; rep++) {
    for (const seg of segments) {
      const last = merged[merged.length - 1];
      if (last.color === seg.color) last.text += seg.text;
      else merged.push({ ...seg });
    }
  }
  return merged;
}

self.onmessage = async (e) => {
  const { ouvSegments, fermSegments, blocks, docName, fontPx } = e.data || {};
  try {
    const halfPoints = Math.max(16, Math.round((fontPx || 28) * 1.5));
    const runs = [];
    if (ouvSegments) pushAll(runs, segmentsToRuns(ouvSegments, halfPoints));

    self.postMessage({ type: 'progress', pct: 20, text: 'Assemblage du texte…' });

    for (let i = 0; i < blocks.length; i++) {
      const { unitSegments, totalMultiplier } = blocks[i];
      pushAll(runs, segmentsToRuns(repeatSegments(unitSegments, totalMultiplier || 1), halfPoints));
      const pct = 20 + Math.round((50 * (i + 1)) / blocks.length);
      self.postMessage({ type: 'progress', pct, text: `Assemblage du texte… (${i + 1}/${blocks.length})` });
    }
    if (fermSegments) pushAll(runs, segmentsToRuns(fermSegments, halfPoints));

    self.postMessage({ type: 'progress', pct: 75, text: 'Assemblage du fichier…' });

    const paras = [];
    if (runs.length) {
      paras.push(
        new Paragraph({ bidirectional: true, alignment: AlignmentType.JUSTIFIED, spacing: { line: 360 }, children: runs })
      );
    }

    const footer = new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ children: ['[ ', PageNumber.CURRENT, ' ]'], size: 20 })],
        }),
      ],
    });

    const doc = new Document({
      creator: 'ASRAR PRO — Al-Qalam',
      title: docName || 'Document Al-Qalam',
      sections: [
        {
          properties: { page: { margin: { top: 432, right: 432, bottom: 432, left: 432 } } },
          footers: { default: footer },
          children: paras.length ? paras : [new Paragraph('')],
        },
      ],
    });

    // Étape la plus longue sur les gros documents (XML + compression DEFLATE,
    // interne à la librairie docx — non paramétrable) : c'est PRÉCISÉMENT
    // pour ne pas geler l'app pendant cette étape que tout tourne ici, hors
    // du thread principal.
    self.postMessage({ type: 'progress', pct: 90, text: 'Compression du fichier…' });
    const blob = await Packer.toBlob(doc);
    self.postMessage({ type: 'done', blob });
  } catch (err) {
    self.postMessage({ type: 'error', message: (err && err.message) || 'Erreur inconnue pendant la génération.' });
  }
};
