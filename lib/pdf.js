'use client';
// Téléchargement PDF d'un secret — port de telechargerSecretPdf() (asrar.js).
// html2pdf est chargé à la demande (import dynamique) : rien dans le bundle
// initial. Gaté au palier 45 000 FCFA côté appelant.
import { escapeHtml, segmentsToHtml } from './format';
import { ASRAR_CONFIG } from './firebase';

export const PDF_MIN_LEVEL = 45000;

export async function downloadSecretPdf(data) {
  if (!data) return;
  const siteUrl = ASRAR_CONFIG.siteUrl;
  const title = data.faida || data.title || 'Secret';
  const contentHtml = segmentsToHtml(data.sirr || data.content || '');
  const cover = data.img || data.image || '';

  const el = document.createElement('div');
  el.style.cssText = 'width:794px;background:#fbf8f1;color:#2a241a;font-family:Georgia,"Noto Naskh Arabic",serif;';
  el.innerHTML =
    '<div style="padding:40px 48px 30px;">' +
    '<div style="display:flex;align-items:center;gap:14px;border-bottom:2px solid #c9a961;padding-bottom:16px;">' +
    '<div>' +
    '<div style="font-size:22px;font-weight:700;letter-spacing:2px;color:#8a6d1b;">ASRAR PRO HUB</div>' +
    '<div style="font-size:12px;color:#9a8a63;letter-spacing:1px;">Sciences mystiques · Secret authentique</div>' +
    '</div>' +
    '</div>' +
    '<h1 style="text-align:center;font-size:26px;color:#6e5512;margin:28px 0 18px;font-weight:600;">' +
    escapeHtml(title) +
    '</h1>' +
    (cover
      ? '<div style="text-align:center;margin:0 0 22px;"><img src="' +
        escapeHtml(cover) +
        '" crossorigin="anonymous" style="max-width:52%;border-radius:10px;border:1px solid #e4dcc7;"></div>'
      : '') +
    '<div style="font-size:16px;line-height:1.9;text-align:justify;">' +
    contentHtml +
    '</div>' +
    '<div style="margin-top:36px;border-top:1px solid #e0d6bd;padding-top:12px;text-align:center;color:#9a8a63;font-size:12px;">🔗 ' +
    escapeHtml(siteUrl) +
    '</div>' +
    '</div>';
  // querySelectorAll() type Element (générique) : .style n'existe que sur HTMLElement.
  el.querySelectorAll('.seg-fr, .seg-ar').forEach((s) => {
    const el2 = /** @type {HTMLElement} */ (s);
    el2.style.whiteSpace = 'pre-wrap';
    el2.style.color = '#2a241a';
  });

  let safeName = 'secret';
  try {
    safeName = title.replace(/[^\p{L}\p{N}\s-]/gu, '').trim().slice(0, 40) || 'secret';
  } catch {}

  const html2pdf = (await import('html2pdf.js')).default;
  await html2pdf()
    .set({
      margin: 0,
      filename: 'ASRAR - ' + safeName + '.pdf',
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#fbf8f1' },
      jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
    })
    .from(el)
    .save();
}
