// Géomancie — export PDF de l'écu (jsPDF, dessin vectoriel : aucun canvas ni
// capture d'écran). Même disposition et mêmes flèches que l'écran
// (lib/geomancieLayout.js), en mm sur une page A4 portrait, imprimable
// (fond blanc, encre violette).
import { SHIELD_LAYOUT, SHIELD_EDGES, edgePoints } from './geomancieLayout';

const INK = [34, 24, 66]; // texte principal
const MUTED = [110, 100, 140]; // texte secondaire
const ACCENT = [101, 72, 214]; // violet
const SOFT = [243, 240, 252]; // fond des cases
const LINE = [205, 196, 235]; // bordures

// jsPDF (polices standard) n'encode que le Latin-1 : on retire le reste plutôt
// que d'afficher des caractères parasites.
export function pdfText(s) {
  return String(s == null ? '' : s)
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function ecuFilename(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `ecu-geomantique-${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}.pdf`;
}

function figure(doc, fig, cx, top, r, gap) {
  doc.setFillColor(...ACCENT);
  fig.forEach((count, row) => {
    const y = top + row * gap;
    const w = (count - 1) * gap;
    for (let d = 0; d < count; d++) doc.circle(cx - w / 2 + d * gap, y, r, 'F');
  });
}

function arrow(doc, pts) {
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.3);
  for (let i = 0; i < pts.length - 1; i++) doc.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
  const [x0, y0] = pts[pts.length - 2];
  const [x1, y1] = pts[pts.length - 1];
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const ux = (x1 - x0) / len;
  const uy = (y1 - y0) / len;
  const s = 1.7;
  doc.setFillColor(...ACCENT);
  doc.triangle(
    x1, y1,
    x1 - ux * s - uy * s * 0.5, y1 - uy * s + ux * s * 0.5,
    x1 - ux * s + uy * s * 0.5, y1 - uy * s - ux * s * 0.5,
    'F'
  );
}

/**
 * data = {
 *   houses: number[][]   // 16 figures (4 lignes à 1 ou 2 points)
 *   names:  string[]     // nom de la figure de chaque maison
 *   parity: { even, total }
 *   voeu:   { fig, name }, rep: { fig, name }
 *   date?:  Date
 * }
 * → { doc, blob, filename }
 */
export async function buildEcuPdf(data) {
  const { jsPDF } = await import('jspdf');
  const date = data.date || new Date();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 14;
  doc.setProperties({ title: 'Écu géomantique — Asrar Pro' });

  // En-tête
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...ACCENT);
  doc.text('ASRAR PRO  ·  GÉOMANCIE', M, 16);
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text('Écu géomantique', M, 26);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(
    pdfText(date.toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })),
    W - M, 26, { align: 'right' }
  );
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(M, 30, W - M, 30);

  // Organigramme : grille de 16 colonnes, une maison = 2 colonnes.
  const gutter = 6; // couloir de la flèche M1 → M16
  const unit = (W - 2 * M - gutter) / 16;
  const cw = unit * 2 - 1.6;
  const ch = 33;
  const rowGap = 13;
  const top = 38;
  const boxes = {};
  for (const { idx, col, row } of SHIELD_LAYOUT) {
    const l = M + (col - 1) * unit + 0.8;
    const t = top + (row - 1) * (ch + rowGap);
    boxes[idx] = { l, r: l + cw, t, b: t + ch };
  }

  for (const [from, to] of SHIELD_EDGES) {
    const pts = edgePoints(from, to, boxes, gutter - 1);
    if (pts) arrow(doc, pts);
  }

  for (const { idx } of SHIELD_LAYOUT) {
    const b = boxes[idx];
    const strong = idx >= 14;
    doc.setFillColor(...SOFT);
    doc.setDrawColor(...(strong ? ACCENT : LINE));
    doc.setLineWidth(strong ? 0.5 : 0.3);
    doc.roundedRect(b.l, b.t, cw, ch, 2, 2, 'FD');
    const cx = b.l + cw / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`M${idx + 1}`, cx, b.t + 5.5, { align: 'center' });
    figure(doc, data.houses[idx], cx, b.t + 11, 0.95, 2.7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...INK);
    doc.text(pdfText(data.names[idx]) || '?', cx, b.t + ch - 3.5, { align: 'center', maxWidth: cw - 1 });
  }

  // Synthèse : parité, vœu, figure de repérage.
  let y = top + 4 * ch + 3 * rowGap + 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...(data.parity.even ? [30, 120, 70] : [176, 41, 27]));
  doc.text(
    data.parity.even
      ? `Parité du Juge : ${data.parity.total} points (paire)`
      : 'Anomalie de parité détectée',
    M, y
  );
  y += 6;
  const half = (W - 2 * M - 6) / 2;
  [['Le vœu', data.voeu], ['Figure de Repérage', data.rep]].forEach(([label, item], i) => {
    const x = M + i * (half + 6);
    doc.setFillColor(...SOFT);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, half, 24, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x + 5, y + 6);
    figure(doc, item.fig, x + 12, y + 11, 0.95, 2.7);
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(pdfText(item.name) || '?', x + 24, y + 14.5);
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text('Asrar Pro — asrarpro.com', W / 2, 288, { align: 'center' });

  return { doc, blob: doc.output('blob'), filename: ecuFilename(date) };
}

/** Résumé texte de l'écu (partage sans fichier). */
export function ecuShareText({ houses, names, parity, voeu, rep }) {
  const lines = [
    'Écu géomantique — Asrar Pro',
    `Mères : ${[0, 1, 2, 3].map((i) => pdfText(names[i]) || '?').join(' · ')}`,
    `Juge : ${pdfText(names[14]) || '?'} (${parity.even ? `parité paire, ${parity.total} points` : 'anomalie de parité'})`,
    `Sentence : ${pdfText(names[15]) || '?'}`,
    `Vœu : ${pdfText(voeu.name) || '?'}`,
    `Repérage : ${pdfText(rep.name) || '?'}`,
    'https://www.asrarpro.com',
  ];
  return lines.join('\n');
}
