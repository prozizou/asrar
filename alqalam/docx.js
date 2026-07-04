// docx.js — Export Word (.docx) EN PARALLÈLE du PDF, à partir des mêmes blocs.
// Utilise la bibliothèque UMD `docx` (window.docx) chargée dans index.html.
import { formules } from './config.js';
import { showToast } from './ui_tools.js';

// Retire le HTML de coloration manuscrite → texte brut (arabe) pour le Word.
function stripHtml(html) {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  return (d.textContent || d.innerText || '').trim();
}

export async function generateDocx(useOuv, useFerm, blocks, docName) {
  const popupMenu = document.getElementById('popup-menu');
  const progressOverlay = document.getElementById('progress-overlay');
  const progressBar = document.getElementById('progress-bar-fill');
  const progressText = document.getElementById('progress-text');
  const fontSizeSlider = document.getElementById('font-size-slider');
  if (popupMenu) popupMenu.style.display = 'none';

  if (typeof window.docx === 'undefined') {
    showToast('Module Word indisponible (connexion internet requise).', 'error');
    return;
  }
  const { Document, Packer, Paragraph, TextRun, AlignmentType } = window.docx;

  if (progressOverlay) progressOverlay.style.display = 'flex';
  if (progressBar) progressBar.style.width = '10%';
  if (progressText) progressText.innerText = 'Préparation du Word…';
  await new Promise(r => setTimeout(r, 0));

  const px = parseInt(fontSizeSlider ? fontSizeSlider.value : 28, 10) || 28;
  const halfPoints = Math.max(16, Math.round(px * 1.5)); // taille en demi-points (~px*0.75pt*2)

  const paras = [];
  const pushText = (txt) => {
    if (!txt) return;
    paras.push(new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      spacing: { line: 360 },
      children: [new TextRun({ text: txt, size: halfPoints, rightToLeft: true })]
    }));
  };

  try {
    if (useOuv) pushText(stripHtml(formules.ouverture));

    if (progressBar) progressBar.style.width = '45%';
    await new Promise(r => setTimeout(r, 0));

    for (const block of blocks) {
      const base = stripHtml(block.texte) + ' ';
      const n = block.totalMultiplier || 1;
      pushText(base.repeat(n).trim());
    }

    if (useFerm) pushText(stripHtml(formules.fermeture));

    if (progressBar) progressBar.style.width = '80%';
    if (progressText) progressText.innerText = 'Assemblage du fichier…';
    await new Promise(r => setTimeout(r, 0));

    const doc = new Document({
      sections: [{ properties: {}, children: paras.length ? paras : [new Paragraph('')] }]
    });

    const blob = await Packer.toBlob(doc);
    if (progressBar) progressBar.style.width = '100%';

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (docName || 'document') + '.docx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);

    if (progressOverlay) progressOverlay.style.display = 'none';
    showToast('Document Word généré.', 'success');
  } catch (e) {
    console.error('Erreur DOCX:', e);
    showToast('Échec de la génération Word.', 'error');
    if (progressOverlay) progressOverlay.style.display = 'none';
  }
}
