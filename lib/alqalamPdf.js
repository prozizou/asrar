// Module « Al-Qalam » — export PDF VECTORIEL de l'ornement.
//
// Chaque page est vectorisée (lib/alqalamVector.js) puis transcrite telle
// quelle en opérateurs PDF par svg2pdf.js : courbes, contours pleins et
// lignes du vœu réutilisées (objets « Form » PDF, stockés une fois par page).
// Aucune image, aucune capture d'écran : le PDF reste net à tout
// agrandissement et à l'impression.
import { vectorizePage, pageSvgMarkup } from './alqalamVector';
import { PHRASE_PIECE } from './alqalamOrne';

/**
 * @param {{
 *   pages: any[], shaper: any, docName: string, label?: string,
 *   cache?: Map<number, any>,
 *   onProgress?: (pct: number, text: string) => void,
 * }} opts
 */
export async function exportOrnementPdf({ pages, shaper, docName, label = '', cache, onProgress = () => {} }) {
  if (!pages.length) throw new Error('Aucune pièce à exporter.');
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  // Hors écran mais dans le document : svg2pdf lit les styles calculés.
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:210px;height:297px;overflow:hidden;';
  document.body.appendChild(host);
  try {
    for (let i = 0; i < pages.length; i += 1) {
      onProgress(Math.round((i / pages.length) * 100), `Page ${i + 1} / ${pages.length}…`);
      // Rend la main au navigateur entre deux pages (barre de progression).
      await new Promise((r) => setTimeout(r, 0));
      const v = cache?.get(i) || vectorizePage(pages[i], shaper, { idPrefix: `x${i}q` });
      host.innerHTML = pageSvgMarkup(v, { pageNumber: i + 1, pageCount: pages.length, label, margin: PHRASE_PIECE.MARGIN });
      const svg = host.firstElementChild;
      if (i > 0) pdf.addPage('a4', 'portrait');
      // viewBox mis à l'échelle exacte de la feuille, sans recadrage.
      await svg2pdf(svg, pdf, { x: 0, y: 0, width: 210, height: 297 });
    }
    onProgress(100, 'Enregistrement du PDF…');
    const filename = (String(docName || 'ornement').trim().replace(/[\/:*?"<>|]+/g, '-') || 'ornement') + '.pdf';
    pdf.save(filename);
  } finally {
    host.remove();
  }
}
