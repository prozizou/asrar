'use client';
// Module « Al-Qalam » — logique portée de alqalam/app.js.
// Formatage (mode Rasm, intercalation), construction de l'aperçu, génération
// du document Word (.docx) et chargement des sourates / versets (RTDB via SDK
// modulaire). L'UI vit dans app/alqalam/page.js.
import { ref, get } from 'firebase/database';
import { db } from './firebase';
import DOMPurify from 'dompurify';

export const config = {
  MAX_PREVIEW: 500,
  CHUNK_SIZE: 10000,
  MAX_TOTAL_REPEAT: 30000,
  MAX_DOM_CHARS: 8000,
  DEBOUNCE_DELAY: 300,
};

export const formules = {
  ouverture:
    'كن بسم الله الرحمن الرحيم اللهم صل على سيدنا محمد و على ءاله و صحبه و سلم تسليما ',
  fermeture:
    ' اللهم صل على سيدنا محمد و على ءاله و صحبه و سلم تسليما فيكون ءامين يا رب العالمين و الحمد لله رب العالمين',
};

// Sanitisation sûre côté client (no-op côté serveur).
function purify(html) {
  if (typeof window === 'undefined') return html;
  const dp = typeof DOMPurify.sanitize === 'function' ? DOMPurify : DOMPurify(window);
  return dp.sanitize(html);
}

// ── Mode Rasm (écriture sans points) ────────────────────────────────────────
const mapRasm = {
  أ: 'ا', إ: 'ا', آ: 'ا', ؤ: 'و', ئ: 'ى', ء: '',
  ب: 'ٮ', ت: 'ٮ', ث: 'ٮ', ن: 'ں', ي: 'ى',
  ف: 'ڡ', ق: 'ٯ', ش: 'س', ض: 'ص', ظ: 'ط',
  غ: 'ع', خ: 'ح', ج: 'ح', ز: 'ر', ذ: 'د',
  ة: 'ه', ك: 'ک', پ: 'ٮ', چ: 'ح', ژ: 'ر', گ: 'ک',
};
const rasmRegex = new RegExp(`[${Object.keys(mapRasm).join('')}]`, 'g');

export function convertirEnRasm(texte) {
  if (!texte) return '';
  let rasm = texte
    .replace(/\u0627\u0644\u0644\u0647/g, '\u0627\u0644\u0644\u200D\u0647')
    .replace(/\u0644\u0644\u0647/g, '\u0644\u0644\u200D\u0647')
    .replace(/\uFDF2/g, '\u0627\u0644\u0644\u200D\u0647');
  rasm = rasm.replace(/[\u064B-\u065F\u0670]/g, '');
  return rasm.replace(rasmRegex, (char) => mapRasm[char] || char);
}

// Convertit en rasm si le mode Rasm est actif — fonctionnalité « écritures
// couleurs » (coloration automatique de mots-clés en rouge/vert/bleu)
// retirée. Le rasm reste une transformation du TEXTE (voir convertirEnRasm),
// distincte de la coloration : rien à en garder.
function appliquerRasmSiActif(texte, isRasmMode = false) {
  if (!texte) return '';
  return isRasmMode ? convertirEnRasm(texte) : texte;
}

export function formaterTexteIntercale(texte, phraseIntercalee) {
  if (!phraseIntercalee || !texte.includes(phraseIntercalee)) return texte;
  const parts = texte.split(phraseIntercalee);
  return parts.map((p) => `<span class="verset-brun">${p}</span>`).join(phraseIntercalee);
}

function highlightText(text, query) {
  if (!query) return { html: text, count: 0 };
  const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${safeQuery})`, 'g');
  const matches = text.match(regex);
  const count = matches ? matches.length : 0;
  const html = text.replace(regex, '<span class="highlight">$1</span>');
  return { html, count };
}

// ── Aperçu (port de updateUI) ───────────────────────────────────────────────
// Renvoie { html, searchCount } sanitisé, prêt pour dangerouslySetInnerHTML.
export function buildPreview({ baseText, totalMultiplier, intercalatedPhrase, isRasmMode, searchTerm }) {
  if (!totalMultiplier || totalMultiplier === 0) return { html: '', searchCount: null };

  let rawTextForPreview = baseText;
  let isTruncated = false;
  let previewReps = Math.min(totalMultiplier, config.MAX_PREVIEW);

  if (rawTextForPreview.length * previewReps > config.MAX_DOM_CHARS) {
    if (rawTextForPreview.length > config.MAX_DOM_CHARS) {
      rawTextForPreview = rawTextForPreview.substring(0, config.MAX_DOM_CHARS) + " ... ﴾Suite masquée dans l'aperçu﴿";
      previewReps = 1;
      isTruncated = true;
    } else {
      previewReps = Math.max(1, Math.floor(config.MAX_DOM_CHARS / rawTextForPreview.length));
      isTruncated = true;
    }
  }

  rawTextForPreview = formaterTexteIntercale(rawTextForPreview, intercalatedPhrase);
  rawTextForPreview = appliquerRasmSiActif(rawTextForPreview, isRasmMode) + ' ';
  let previewText = rawTextForPreview.repeat(previewReps).trim();

  let searchCount = null;
  const term = (searchTerm || '').trim();
  if (term) {
    const result = highlightText(previewText, term);
    previewText = result.html;
    const baseResult = highlightText(baseText, term);
    searchCount = baseResult.count * totalMultiplier;
  }

  let warningHTML = '';
  if (isTruncated) {
    warningHTML = `<div class="preview-warning">
      ⚠️ Aperçu limité pour protéger la mémoire de votre téléphone.<br>
      Le document final contiendra bien <b>l'intégralité du texte</b>.
    </div>`;
  }

  return { html: purify(previewText + warningHTML), searchCount };
}

// ── Génération Word (.docx) ─────────────────────────────────────────────────

// Réduit le HTML (sanitizé) en texte BRUT pour l'export Word. Le repérage des
// versets intercalés (voir formaterTexteIntercale, inchangé) reste en couleur
// dans l'aperçu de l'app mais n'est pas reporté dans le document exporté, qui
// reste entièrement en noir. Bonus : un texte sans changement de couleur
// tient dans un seul run par bloc (voir alqalamWorker.js) au lieu d'un run
// XML par mot coloré × répétition — bien plus rapide à assembler, quelle que
// soit la taille du document.
export function htmlToPlainText(html) {
  const container = document.createElement('div');
  container.innerHTML = purify(html);
  return container.textContent || '';
}

// Assemblage + compression du .docx dans un Worker dédié (lib/alqalamWorker.js).
// Le document exporté étant désormais monochrome (voir htmlToPlainText), un
// bloc entier tient dans un seul run — l'assemblage reste rapide même sur les
// plus gros documents. Le Worker garde son intérêt pour la compression finale
// (DEFLATE, interne à docx/JSZip, non paramétrable) sur les documents dont le
// texte total est volumineux : ça ne gèle plus l'onglet pendant ce temps. Le
// thread principal ne garde que l'extraction DOM (htmlToPlainText, qui a
// besoin de `document` — indisponible dans un Worker) et le téléchargement
// final.
function runInWorker(payload, onProgress) {
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL('./alqalamWorker.js', import.meta.url));
    } catch (e) {
      reject(e);
      return;
    }
    const cleanup = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      worker.terminate();
    };
    const onMessage = (e) => {
      const msg = e.data || {};
      if (msg.type === 'progress') onProgress(msg.pct, msg.text);
      else if (msg.type === 'done') {
        cleanup();
        resolve(msg.blob);
      } else if (msg.type === 'error') {
        cleanup();
        reject(new Error(msg.message || 'Erreur du worker.'));
      }
    };
    const onError = (err) => {
      cleanup();
      reject(err instanceof Error ? err : new Error((err && err.message) || 'Erreur du worker.'));
    };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    worker.postMessage(payload);
  });
}

// Génère et télécharge le .docx. onProgress(pct, text) pour l'UI.
export async function generateDocx({ useOuv, useFerm, blocks, docName, fontPx = 28, onProgress = () => {} }) {
  onProgress(5, 'Préparation du Word…');
  await new Promise((r) => setTimeout(r, 0));

  const firstRasm = blocks[0] ? blocks[0].isRasmMode : false;
  const lastRasm = blocks[blocks.length - 1] ? blocks[blocks.length - 1].isRasmMode : false;

  // Extraction DOM (sanitize + texte brut, sans couleurs) sur les SEULES
  // unités (petites), jamais sur le texte répété.
  const ouvText = useOuv ? htmlToPlainText(appliquerRasmSiActif(formules.ouverture, firstRasm)) : '';
  const fermText = useFerm ? htmlToPlainText(appliquerRasmSiActif(formules.fermeture, lastRasm)) : '';
  const blockPayload = blocks.map((block) => ({
    unitText: htmlToPlainText(appliquerRasmSiActif(block.texte, block.isRasmMode) + ' '),
    totalMultiplier: block.totalMultiplier || 1,
  }));

  onProgress(10, 'Assemblage du texte…');

  const blob = await runInWorker({ ouvText, fermText, blocks: blockPayload, docName, fontPx }, onProgress);

  onProgress(100, 'Téléchargement…');

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (docName || 'document') + '.docx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ── Génération PDF ───────────────────────────────────────────────────────────
// Police : « Calibri » est une police Microsoft sous licence, non redistribuable
// ni embarquable dans une page web ou un PDF généré. On utilise « Carlito »,
// son équivalent libre à métriques identiques (même largeur de caractères —
// c'est d'ailleurs le substitut standard de LibreOffice), en Bold via Google
// Fonts (déjà autorisé par la CSP : fonts.googleapis.com/fonts.gstatic.com).
// ATTENTION : Carlito, comme Calibri, ne couvre que le latin — le texte ARABE
// (l'essentiel du contenu ici) continuera de s'afficher avec la police arabe
// de repli du système, la police Calibri/Carlito ne s'applique concrètement
// qu'aux éventuels caractères latins du document.
//
// APPROCHE : impression navigateur, pas html2canvas/jsPDF. Un premier essai
// « screenshot » (html2canvas → image intégrée au PDF) posait deux problèmes
// structurels signalés par l'utilisateur : flou net au zoom (c'est une image
// bitmap, jamais aussi net qu'un vrai texte vectoriel) et coupures de lignes
// en plein milieu des lettres au changement de page (le découpage se fait au
// pixel près sur l'image, sans notion de ligne de texte). Le PDF étant à
// usage PROFESSIONNEL, ces deux défauts ne sont pas acceptables — la SEULE
// façon fiable d'obtenir du texte VECTORIEL avec un rendu RTL/justifié arabe
// correct (shaping des lettres liées, sans réimplémenter cette mécanique à la
// main) est de laisser le moteur du NAVIGATEUR l'écrire lui-même dans le PDF,
// via sa fonction d'impression native (« Enregistrer en PDF »). On construit
// une vue dédiée à l'impression (masque le reste de la page via @media
// print) puis on déclenche window.print().
//
// LIMITE CONNUE (assumée, discutée avec l'utilisateur) : la numérotation
// personnalisée « rouleau + numéro » par page n'est PAS réalisable par cette
// voie — CSS/JS n'ont aucun accès à « quelle page est en cours d'impression »
// dans un navigateur grand public (les marges @page avec contenu généré, qui
// permettraient ça, ne sont implémentées par aucun moteur de navigateur ;
// seul un moteur headless comme celui de Puppeteer expose ce niveau de
// contrôle, au prix d'une architecture serveur nettement plus lourde). Le
// navigateur propose sa propre option « En-têtes et pieds de page » (case à
// cocher dans sa boîte de dialogue d'impression), qui affiche un numéro de
// page non stylable — à activer manuellement si souhaité.
const PDF_PAGE_H_CM = 29.7; // A4 portrait
const PDF_PAGE_W_CM = 21;
const PDF_MARGIN_CM = 0.3; // haut/bas/gauche/droite, via @page
const PDF_CONTENT_H_CM = PDF_PAGE_H_CM - 2 * PDF_MARGIN_CM;
const PDF_CONTENT_W_CM = PDF_PAGE_W_CM - 2 * PDF_MARGIN_CM; // largeur imprimable réelle (≠ viewport de l'écran)
const PDF_FONT_CANDIDATES = [14, 13, 12, 11]; // pt, du plus grand au plus petit
// Mesurer les 300 000 caractères d'un document répété 30 000 fois, 4 fois de
// suite (une par taille candidate), rendait la génération interminable — un
// échantillon suffit à estimer fiablement le remplissage de la dernière page.
const PDF_SAMPLE_CHARS = 6000;
const PDF_PRINT_ROOT_ID = 'alqalam-print-root';
const PDF_PRINT_STYLE_ID = 'alqalam-print-style';

let carlitoLoadPromise = null;
function ensureCarlitoLoaded() {
  if (typeof document === 'undefined') return Promise.resolve();
  if (!carlitoLoadPromise) {
    carlitoLoadPromise = (async () => {
      if (!document.getElementById('carlito-font-link')) {
        const link = document.createElement('link');
        link.id = 'carlito-font-link';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Carlito:wght@700&display=swap';
        document.head.appendChild(link);
      }
      try {
        await document.fonts.load('700 16px Carlito');
        await document.fonts.ready;
      } catch {
        /* police indisponible (hors-ligne…) — repli navigateur silencieux */
      }
    })();
  }
  return carlitoLoadPromise;
}

// Conversion cm → px TELLE QUE LE NAVIGATEUR LA RÉSOUT RÉELLEMENT (au lieu
// d'un 96 DPI supposé) — fiabilise la correspondance avec les mesures DOM.
function cmToPx(cm) {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;width:1cm;';
  document.body.appendChild(probe);
  const pxPerCm = probe.getBoundingClientRect().width || 37.795;
  probe.remove();
  return cm * pxPerCm;
}

const pdfTextStyle = (fontSizePt) => `
  font-family: Carlito, Calibri, sans-serif;
  font-weight: 700;
  font-size: ${fontSizePt}pt;
  direction: rtl;
  text-align: justify;
  text-align-last: right;
  font-feature-settings: "isol" 1;
  line-height: 1.6;
  color: #000;
`;

// Mesure la hauteur d'un ÉCHANTILLON du texte à chaque taille candidate (DOM
// caché) et extrapole au texte complet, pour choisir la taille qui remplit le
// mieux la dernière page (impression réelle : hauteur de page moins les
// marges @page), et éviter un grand blanc final.
//
// Deux bugs corrigés ici :
//  1) Mesurer le texte COMPLET (jusqu'à des centaines de milliers de
//     caractères pour un document très répété) 4 fois de suite — un reflow
//     RTL/justifié coûteux à chaque fois — rendait la génération interminable
//     (« prend une éternité »). Un échantillon (PDF_SAMPLE_CHARS) suffit :
//     le rythme de remplissage des lignes est le même sur un extrait que sur
//     l'ensemble (texte répété/homogène), donc l'extrapolation reste fiable.
//  2) Le div de mesure utilisait `width:100%`, qui — étant en position:fixed
//     hors de tout contexte d'impression — se résolvait contre le VIEWPORT de
//     l'écran (ex. ~400px mobile, ~1200px desktop) et non contre la largeur
//     imprimable réelle de la page (~20,4cm). Le retour à la ligne mesuré ne
//     correspondait donc pas à celui de l'impression réelle. Corrigé en fixant
//     explicitement la largeur du div de mesure à PDF_CONTENT_W_CM.
function pickBestFontSize(text) {
  const pageContentHeightPx = cmToPx(PDF_CONTENT_H_CM);
  const sample = text.length > PDF_SAMPLE_CHARS ? text.slice(0, PDF_SAMPLE_CHARS) : text;
  const extrapolationFactor = text.length / sample.length;

  let best = PDF_FONT_CANDIDATES[0];
  let bestFill = -1;
  for (const size of PDF_FONT_CANDIDATES) {
    const el = document.createElement('div');
    el.style.cssText =
      `position:fixed;left:-99999px;top:0;visibility:hidden;width:${PDF_CONTENT_W_CM}cm;` + pdfTextStyle(size);
    el.textContent = sample;
    document.body.appendChild(el);
    const sampleH = el.scrollHeight;
    el.remove();

    const h = sampleH * extrapolationFactor;
    const pages = Math.max(1, Math.ceil(h / pageContentHeightPx));
    const lastPageContent = h - (pages - 1) * pageContentHeightPx;
    const fill = lastPageContent / pageContentHeightPx;
    // Préfère un remplissage plus complet ; à égalité proche, garde la police
    // la plus grande (déjà testée en premier — meilleure lisibilité).
    if (fill > bestFill + 0.02) {
      bestFill = fill;
      best = size;
    }
  }
  return best;
}

function ensurePrintStylesInjected() {
  if (document.getElementById(PDF_PRINT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PDF_PRINT_STYLE_ID;
  // position:fixed masque le reste de l'app (drawer, boutons…) uniquement à
  // l'impression ; @page pose les marges 0,3 cm demandées.
  style.textContent = `
    @media print {
      body > *:not(#${PDF_PRINT_ROOT_ID}) { display: none !important; }
      #${PDF_PRINT_ROOT_ID} { display: block !important; }
      @page { size: A4; margin: ${PDF_MARGIN_CM}cm; }
    }
    @media screen {
      #${PDF_PRINT_ROOT_ID} { display: none !important; }
    }
  `;
  document.head.appendChild(style);
}

// Ouvre la boîte de dialogue d'impression du navigateur sur le document
// assemblé (ouverture/fermeture/blocs/mode Rasm — mêmes réglages que
// generateDocx). L'utilisateur choisit « Enregistrer en PDF » comme
// destination. onProgress(pct, text) pour l'UI.
export async function generatePdf({ useOuv, useFerm, blocks, docName, onProgress = () => {} }) {
  onProgress(10, 'Préparation du PDF…');
  await new Promise((r) => setTimeout(r, 0));

  const firstRasm = blocks[0] ? blocks[0].isRasmMode : false;
  const lastRasm = blocks[blocks.length - 1] ? blocks[blocks.length - 1].isRasmMode : false;
  const ouvText = useOuv ? htmlToPlainText(appliquerRasmSiActif(formules.ouverture, firstRasm)) : '';
  const fermText = useFerm ? htmlToPlainText(appliquerRasmSiActif(formules.fermeture, lastRasm)) : '';

  const parts = [ouvText];
  blocks.forEach((block) => {
    parts.push(htmlToPlainText(appliquerRasmSiActif(block.texte, block.isRasmMode) + ' ').repeat(block.totalMultiplier || 1));
  });
  parts.push(fermText);
  const fullText = parts.join('').trim();
  if (!fullText) throw new Error('Aucun texte à exporter.');

  onProgress(30, 'Chargement de la police…');
  await ensureCarlitoLoaded();

  onProgress(50, 'Calibration de la mise en page…');
  await new Promise((r) => setTimeout(r, 0));
  const fontSizePt = pickBestFontSize(fullText);

  onProgress(70, 'Ouverture de l’impression…');
  ensurePrintStylesInjected();

  let root = document.getElementById(PDF_PRINT_ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = PDF_PRINT_ROOT_ID;
    document.body.appendChild(root);
  }
  root.style.cssText = 'width:100%;' + pdfTextStyle(fontSizePt);
  root.textContent = fullText;

  const previousTitle = document.title;
  if (docName) document.title = docName; // nom de fichier suggéré par « Enregistrer en PDF »

  const cleanup = () => {
    root.remove();
    document.title = previousTitle;
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  // Repli : si l'événement afterprint ne se déclenche pas (certains
  // navigateurs mobiles ne l'émettent pas de façon fiable), nettoyage différé.
  setTimeout(cleanup, 5 * 60 * 1000);

  onProgress(100, 'Boîte de dialogue d’impression ouverte.');
  // Laisse le navigateur peindre le nouveau contenu avant d'ouvrir l'impression.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  window.print();
}

// ── Chargement des données (RTDB) ───────────────────────────────────────────
export async function loadSourates() {
  try {
    const snap = await get(ref(db, 'sourate'));
    if (snap.exists()) {
      const list = [];
      const content = {};
      snap.forEach((child) => {
        const data = child.val();
        content[child.key] = data.contenu;
        list.push({ key: child.key, name: data.sourate });
      });
      try {
        const cache = {};
        snap.forEach((child) => {
          cache[child.key] = child.val();
        });
        localStorage.setItem('cali_sourates_cache', JSON.stringify(cache));
      } catch {}
      return { list, content, offline: false };
    }
  } catch {
    try {
      const cached = JSON.parse(localStorage.getItem('cali_sourates_cache') || 'null');
      if (cached) {
        const list = [];
        const content = {};
        for (const key in cached) {
          content[key] = cached[key].contenu;
          list.push({ key, name: cached[key].sourate });
        }
        return { list, content, offline: true };
      }
    } catch {}
  }
  return { list: [], content: {}, offline: false };
}

export async function loadVersets() {
  try {
    const snap = await get(ref(db, 'versetRef'));
    if (snap.exists()) {
      const arr = [];
      snap.forEach((child) => {
        const data = child.val();
        if (data && data.verset) arr.push(data.verset);
      });
      try {
        localStorage.setItem('cali_versets_cache', JSON.stringify(arr));
      } catch {}
      return arr;
    }
  } catch {
    try {
      const cached = JSON.parse(localStorage.getItem('cali_versets_cache') || 'null');
      if (Array.isArray(cached)) return cached;
    } catch {}
  }
  return [];
}

// ── Texte coranique intégral (graphie Uthmani, avec voyelles/symboles) ─────
// Source publique reconnue (alquran.cloud, édition « quran-uthmani », texte
// Uthmani standard avec tashkeel complet) — utilisée pour proposer, en plus
// de la version sans voyelles déjà en base (sourate/{clé}.contenu), une
// version « avec voyelles et symboles » en intercalation. Aucun texte
// coranique n'est saisi à la main ici : uniquement récupéré depuis cette API.
const QURAN_UTHMANI_URL = 'https://api.alquran.cloud/v1/quran/quran-uthmani';
const QURAN_CACHE_KEY = 'cali_quran_uthmani_cache';
let quranUthmaniPromise = null;

// Récupère les 114 sourates (une seule fois, mise en cache mémoire +
// localStorage pour réutilisation hors-ligne). Renvoie null si l'API et le
// cache sont tous deux indisponibles — jamais d'exception qui casserait l'UI.
export function loadQuranUthmani() {
  if (quranUthmaniPromise) return quranUthmaniPromise;
  quranUthmaniPromise = (async () => {
    try {
      const res = await fetch(QURAN_UTHMANI_URL);
      const json = await res.json();
      const surahs = json && json.data && json.data.surahs;
      if (!Array.isArray(surahs) || surahs.length !== 114) throw new Error('Réponse API Coran invalide.');
      try {
        localStorage.setItem(QURAN_CACHE_KEY, JSON.stringify(surahs));
      } catch {}
      return surahs;
    } catch {
      try {
        const cached = JSON.parse(localStorage.getItem(QURAN_CACHE_KEY) || 'null');
        if (Array.isArray(cached) && cached.length === 114) return cached;
      } catch {}
      quranUthmaniPromise = null; // permet de réessayer au prochain appel
      return null;
    }
  })();
  return quranUthmaniPromise;
}

function normalizeArabicName(s) {
  return String(s || '')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '') // tashkeel/marques de récitation
    .replace(/[\u0623\u0625\u0622\u0627\u0671]/g, '\u0627') // أ/إ/آ/ا/ٱ(wasla) -> ا
    .replace(/\u0629/g, '\u0647') // ة -> ه
    .replace(/\u0649/g, '\u064A') // ى -> ي
    .replace(/^\u0633\u0648\u0631\u0647\s*/, '') // préfixe "سورة", en ه (après le remplacement ة->ه ci-dessus)
    .replace(/\s+/g, '')
    .trim();
}
function normalizeLoose(s) {
  return String(s || '').toLowerCase().replace(/[^a-z\u0600-\u06FF0-9]/g, '');
}

// Associe une sourate de la base (nom stocké, convention inconnue — arabe,
// translittéré, numéroté…) à son entrée dans le texte Uthmani complet.
// Plusieurs stratégies de correspondance, best-effort (pas de garantie que la
// base utilise l'une de ces conventions).
export function matchUthmaniSourate(surahs, sourateName) {
  if (!Array.isArray(surahs) || !sourateName) return null;
  const arabicTarget = normalizeArabicName(sourateName);
  const looseTarget = normalizeLoose(sourateName);
  const numMatch = String(sourateName).match(/^\D*(\d{1,3})\D/);
  const num = numMatch ? parseInt(numMatch[1], 10) : null;

  const found =
    (arabicTarget && surahs.find((s) => normalizeArabicName(s.name) === arabicTarget)) ||
    (looseTarget &&
      surahs.find((s) => normalizeLoose(s.englishName) === looseTarget || normalizeLoose(s.englishNameTranslation) === looseTarget)) ||
    (num != null && surahs.find((s) => s.number === num)) ||
    null;

  if (!found || !Array.isArray(found.ayahs)) return null;
  // Un marqueur '﴾' entre chaque verset, comme dans le contenu « sans
  // voyelles » existant (buildIntercalatedText s'appuie dessus pour insérer
  // la phrase entre chaque verset). ﻿ : BOM présent en tête de certains
  // versets renvoyés par l'API — invisible mais à retirer proprement.
  return found.ayahs.map((a) => String(a.text || '').replace(/\uFEFF/g, '')).join(' \uFD3E ');
}

// Construit le texte combiné (intercalation) d'une sourate avec une expression.
export function buildIntercalatedText(sourateContent, phrase, rep) {
  const bloc = Array(Math.max(1, rep)).fill(phrase).join(' ');
  let result = sourateContent;
  if (result.includes('﴾')) result = result.split('﴾').join(' ' + bloc + ' ');
  if (result.includes('(')) result = result.split('(').join(' ' + bloc + ' ');
  result = result.replace(/[0-9]/g, '').split('ك').join('ک').replace(/\s+/g, ' ').trim();
  return result;
}
