// docx.js — Export Word (.docx) EN PARALLÈLE du PDF, à partir des mêmes blocs.
// Compatible Microsoft Word ET WPS Office (format .docx standard).
// Utilise la bibliothèque UMD `docx` (window.docx) chargée dans index.html.
import { formules } from './config.js';
import { showToast } from './ui_tools.js';
import { appliquerCouleursManuscrit } from './formatter.js';

// Mêmes couleurs que l'aperçu à l'écran et le PDF (voir style.css : .mot-rouge, etc.)
const COLOR_MAP = {
  'mot-rouge': 'D11015',
  'mot-vert': '008A3B',
  'mot-bleu': '1B378C',
  'verset-brun': '8B0000'
};

// Convertit le HTML coloré (généré par appliquerCouleursManuscrit, identique à
// l'aperçu écran et au PDF) en une liste de TextRun Word, en conservant les
// couleurs — pour que le .docx corresponde exactement à ce que l'utilisateur
// a vu et écrit.
function htmlToRuns(html, size) {
  const { TextRun } = window.docx;
  const container = document.createElement('div');
  container.innerHTML = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(html) : html;

  const runs = [];
  const walk = (node, color) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent) {
        runs.push(new TextRun({ text: node.textContent, size, rightToLeft: true, color: color || undefined }));
      }
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const cls = node.className || '';
      let nextColor = color;
      for (const klass in COLOR_MAP) {
        if (cls.indexOf(klass) !== -1) { nextColor = COLOR_MAP[klass]; break; }
      }
      node.childNodes.forEach((child) => walk(child, nextColor));
    }
  };
  container.childNodes.forEach((n) => walk(n, null));

  return runs.length ? runs : [new TextRun({ text: container.textContent || '', size, rightToLeft: true })];
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
  const { Document, Packer, Paragraph, AlignmentType } = window.docx;

  if (progressOverlay) progressOverlay.style.display = 'flex';
  if (progressBar) progressBar.style.width = '10%';
  if (progressText) progressText.innerText = 'Préparation du Word…';
  await new Promise((r) => setTimeout(r, 0));

  const px = parseInt(fontSizeSlider ? fontSizeSlider.value : 28, 10) || 28;
  const halfPoints = Math.max(16, Math.round(px * 1.5)); // taille en demi-points (~px*0.75pt*2)

  const paras = [];
  const pushColored = (html) => {
    if (!html) return;
    paras.push(new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      spacing: { line: 360 },
      children: htmlToRuns(html, halfPoints)
    }));
  };

  try {
    const firstRasm = blocks[0] ? blocks[0].isRasmMode : false;
    const lastRasm = blocks[blocks.length - 1] ? blocks[blocks.length - 1].isRasmMode : false;

    if (useOuv) pushColored(appliquerCouleursManuscrit(formules.ouverture, firstRasm));

    if (progressBar) progressBar.style.width = '45%';
    await new Promise((r) => setTimeout(r, 0));

    for (const block of blocks) {
      const coloredBase = appliquerCouleursManuscrit(block.texte, block.isRasmMode) + ' ';
      const n = block.totalMultiplier || 1;
      pushColored(coloredBase.repeat(n).trim());
    }

    if (useFerm) pushColored(appliquerCouleursManuscrit(formules.fermeture, lastRasm));

    if (progressBar) progressBar.style.width = '80%';
    if (progressText) progressText.innerText = 'Assemblage du fichier…';
    await new Promise((r) => setTimeout(r, 0));

    const doc = new Document({
      creator: 'ASRAR PRO — Al-Qalam',
      title: docName || 'Document Al-Qalam',
      sections: [{
        properties: {
          // Marges façon A4 professionnel, cohérentes avec la mise en page du PDF.
          page: { margin: { top: 850, right: 850, bottom: 1134, left: 850 } }
        },
        children: paras.length ? paras : [new Paragraph('')]
      }]
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
    showToast('Document Word généré (compatible WPS Office).', 'success');
  } catch (e) {
    console.error('Erreur DOCX:', e);
    showToast('Échec de la génération Word.', 'error');
    if (progressOverlay) progressOverlay.style.display = 'none';
  }
}
