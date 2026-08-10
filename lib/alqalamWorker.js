// Worker dédié à l'assemblage du document Word (.docx) — voir generateDocx()
// dans lib/alqalam.js, qui spawn ce worker et lui poste du texte déjà extrait
// du DOM (voir htmlToPlainText, qui elle DOIT rester sur le thread principal :
// un Worker n'a pas accès à `document`).
//
// Le document exporté est entièrement en noir (voir htmlToPlainText) : les
// couleurs de l'aperçu de l'app ne sont pas reportées ici. Conséquence utile :
// un bloc de texte sans changement de couleur tient dans un SEUL run Word par
// section (ouverture / bloc / fermeture), quel que soit le nombre de
// répétitions — un simple `texte.repeat(n)`, natif et très rapide — au lieu
// d'un run XML séparé par mot coloré × répétition (avant, jusqu'à plusieurs
// minutes sur les documents volumineux, cf. historique du fichier).
import { Document, Packer, Paragraph, AlignmentType, Footer, PageNumber, TextRun } from 'docx';

self.onmessage = async (e) => {
  const { ouvText, fermText, blocks, docName, fontPx } = e.data || {};
  try {
    const halfPoints = Math.max(16, Math.round((fontPx || 28) * 1.5));
    const runs = [];
    if (ouvText) runs.push(new TextRun({ text: ouvText, size: halfPoints, rightToLeft: true }));

    self.postMessage({ type: 'progress', pct: 30, text: 'Assemblage du texte…' });

    for (let i = 0; i < blocks.length; i++) {
      const { unitText, totalMultiplier } = blocks[i];
      runs.push(new TextRun({ text: unitText.repeat(totalMultiplier || 1), size: halfPoints, rightToLeft: true }));
      const pct = 30 + Math.round((40 * (i + 1)) / blocks.length);
      self.postMessage({ type: 'progress', pct, text: `Assemblage du texte… (${i + 1}/${blocks.length})` });
    }
    if (fermText) runs.push(new TextRun({ text: fermText, size: halfPoints, rightToLeft: true }));

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

    self.postMessage({ type: 'progress', pct: 90, text: 'Compression du fichier…' });
    const blob = await Packer.toBlob(doc);
    self.postMessage({ type: 'done', blob });
  } catch (err) {
    self.postMessage({ type: 'error', message: (err && err.message) || 'Erreur inconnue pendant la génération.' });
  }
};
