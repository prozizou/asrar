'use client';
// lib/wafqExport.js — Export du carré magique (Wafq) en image PNG, dessinée
// sur un <canvas> — aucune librairie externe (html2canvas/jsPDF), cohérent
// avec le reste de l'app (aucune n'est installée). L'export « PDF » n'est en
// réalité rien d'autre qu'une impression navigateur de cette MÊME image
// (window.print(), « Enregistrer en PDF » comme destination) — technique
// identique à generatePdf() dans lib/alqalam.js, voir son en-tête pour le
// détail (limite connue sur la numérotation de page, non pertinente ici :
// une seule image, une seule page).

const W = 900;
const H = 1200; // portrait, proche d'une demi-page A4 imprimable
const MARGIN = 60;
const PRINT_ROOT_ID = 'wafq-print-root';
const PRINT_STYLE_ID = 'wafq-print-style';

async function ensureFontLoaded() {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load('700 52px "Noto Naskh Arabic"'),
      document.fonts.load('700 34px Georgia'),
    ]);
    await document.fonts.ready;
  } catch {
    // Police indisponible (hors-ligne, navigateur ancien) : le canvas retombe
    // sur le repli serif générique — jamais bloquant pour l'export.
  }
}

function easternDigits(v) {
  return String(v).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
}

/**
 * Dessine UNE face élémentaire du carré magique sur un nouveau canvas.
 * @param {{grid:Array<Array<{v:number|string,s:number|string}>>, name:string, icon:string}} square
 * @param {{typeName:string, arabicPhrase:string, translit?:string, target:number, eastern?:boolean}} opts
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderWafqCanvas(square, opts) {
  await ensureFontLoaded();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Fond parchemin + double cadre doré — pensé pour l'impression (fond clair,
  // peu d'encre), pas pour l'écran (contrairement au reste de l'app, sombre).
  ctx.fillStyle = '#faf6ec';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#b8860b';
  ctx.lineWidth = 6;
  ctx.strokeRect(MARGIN / 2, MARGIN / 2, W - MARGIN, H - MARGIN);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(MARGIN / 2 + 10, MARGIN / 2 + 10, W - MARGIN - 20, H - MARGIN - 20);

  ctx.fillStyle = '#1a1208';
  ctx.textAlign = 'center';

  // Phrase arabe (Nom d'Allah de l'intention, ou texte personnalisé).
  ctx.direction = 'rtl';
  ctx.font = '700 52px "Noto Naskh Arabic", serif';
  ctx.fillText(opts.arabicPhrase, W / 2, 150, W - MARGIN * 2);

  ctx.direction = 'ltr';
  if (opts.translit) {
    ctx.font = '400 22px Georgia, serif';
    ctx.fillStyle = '#5a4a2a';
    ctx.fillText(opts.translit, W / 2, 185);
  }

  ctx.font = '700 26px Georgia, serif';
  ctx.fillStyle = '#1a1208';
  ctx.fillText(`${square.icon || ''} Wafq ${opts.typeName} — ${square.name}`.trim(), W / 2, 240);
  ctx.font = '400 18px Georgia, serif';
  ctx.fillStyle = '#5a4a2a';
  const targetShown = opts.eastern ? easternDigits(opts.target) : String(opts.target);
  ctx.fillText(`Constante : ${targetShown}`, W / 2, 270);

  // Grille.
  const grid = square.grid;
  const n = grid.length;
  const gridSize = 620;
  const gx = (W - gridSize) / 2;
  const gy = 320;
  const cell = gridSize / n;

  ctx.strokeStyle = '#b8860b';
  ctx.lineWidth = 2;
  ctx.strokeRect(gx, gy, gridSize, gridSize);

  ctx.textBaseline = 'middle';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const x = gx + c * cell;
      const y = gy + r * cell;
      ctx.strokeStyle = 'rgba(184,134,11,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, cell, cell);

      const raw = grid[r][c];
      const isVide = raw.s === 'V';
      ctx.fillStyle = isVide ? '#8a6d1a' : '#1a1208';
      ctx.font = `700 ${isVide ? 20 : 34}px Georgia, serif`;
      const shown = isVide ? 'ˑ' : opts.eastern ? easternDigits(raw.v) : String(raw.v);
      ctx.fillText(shown, x + cell / 2, y + cell / 2 + 2);
    }
  }
  ctx.textBaseline = 'alphabetic';

  ctx.font = '400 14px Georgia, serif';
  ctx.fillStyle = '#9a8a5a';
  ctx.fillText('ASRAR PRO', W / 2, H - 40);

  return canvas;
}

/** Télécharge le canvas en PNG (Blob → lien synthétique, comme n'importe
 * quel export navigateur natif — aucune librairie). */
export function downloadCanvasPng(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.toLowerCase().endsWith('.png') ? filename : filename + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, 'image/png');
}

function ensurePrintStylesInjected() {
  if (document.getElementById(PRINT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PRINT_STYLE_ID;
  // position hors-écran + masquage du reste de l'app à l'impression — même
  // principe que lib/alqalam.js ensurePrintStylesInjected().
  style.textContent = `
    @media print {
      body > *:not(#${PRINT_ROOT_ID}) { display: none !important; }
      #${PRINT_ROOT_ID} { display: flex !important; align-items: center; justify-content: center; }
      #${PRINT_ROOT_ID} img { max-width: 100%; max-height: 100%; }
      @page { size: A4; margin: 0.5cm; }
    }
    @media screen {
      #${PRINT_ROOT_ID} { display: none !important; }
    }
  `;
  document.head.appendChild(style);
}

/** Ouvre la boîte de dialogue d'impression du navigateur sur l'image du
 * carré — « Enregistrer en PDF » y est une destination proposée nativement,
 * exactement comme pour lib/alqalam.js generatePdf() (aucune librairie PDF). */
export function printCanvas(canvas, docTitle) {
  ensurePrintStylesInjected();
  let root = document.getElementById(PRINT_ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = PRINT_ROOT_ID;
    document.body.appendChild(root);
  }
  root.innerHTML = '';
  const img = document.createElement('img');
  img.src = canvas.toDataURL('image/png');
  root.appendChild(img);

  const previousTitle = document.title;
  if (docTitle) document.title = docTitle; // nom de fichier suggéré par « Enregistrer en PDF »

  const cleanup = () => {
    document.title = previousTitle;
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  setTimeout(() => window.print(), 50);
}
