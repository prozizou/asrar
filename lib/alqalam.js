'use client';
// Module « Al-Qalam » — logique portée de alqalam/app.js.
// Formatage (mode Rasm, couleurs manuscrites, intercalation), construction de
// l'aperçu, génération du document Word (.docx) et chargement des sourates /
// versets (RTDB via SDK modulaire). L'UI vit dans app/alqalam/page.js.
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

// ── Couleurs manuscrites (mots-clés) ────────────────────────────────────────
const dictionnaireStandard = [
  { mot: 'لعبدك وخليلك وحبيبك وخديم رسولك', classe: 'mot-bleu' },
  { mot: 'ورضيته', classe: 'mot-rouge' },
  { mot: 'الرحمن', classe: 'mot-rouge' },
  { mot: 'الرحيم', classe: 'mot-rouge' },
  { mot: 'اللهم', classe: 'mot-rouge' },
  { mot: 'الله', classe: 'mot-rouge' },
  { mot: 'محمدا', classe: 'mot-vert' },
  { mot: 'محمد', classe: 'mot-vert' },
  { mot: 'رب', classe: 'mot-rouge' },
];

let dictionnaireRasmCache = null;

export function appliquerCouleursManuscrit(texte, isRasmMode = false) {
  if (!texte) return '';
  const texteTraite = isRasmMode ? convertirEnRasm(texte) : texte;
  let dictionnaireActif = dictionnaireStandard;
  if (isRasmMode) {
    if (!dictionnaireRasmCache) {
      dictionnaireRasmCache = dictionnaireStandard.map((item) => ({
        mot: convertirEnRasm(item.mot),
        classe: item.classe,
      }));
    }
    dictionnaireActif = dictionnaireRasmCache;
  }

  let textProtege = texteTraite;
  dictionnaireActif.forEach((item, index) => {
    const regex = new RegExp(item.mot, 'g');
    textProtege = textProtege.replace(regex, `__MOT${index}__`);
  });
  dictionnaireActif.forEach((item, index) => {
    const regex = new RegExp(`__MOT${index}__`, 'g');
    textProtege = textProtege.replace(regex, `<span class="${item.classe}">${item.mot}</span>`);
  });
  return textProtege;
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
  rawTextForPreview = appliquerCouleursManuscrit(rawTextForPreview, isRasmMode) + ' ';
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
const COLOR_MAP = { 'mot-rouge': 'D11015', 'mot-vert': '008A3B', 'mot-bleu': '1B378C', 'verset-brun': '8B0000' };

// Parse le HTML (sanitize + DOM) et le réduit en segments {text, color} — PAS
// encore des TextRun. Coûteux (DOMPurify + innerHTML + parcours DOM) : ne
// jamais appeler sur un texte déjà répété (voir repeatSegments plus bas), qui
// multiplierait ce coût par le nombre de répétitions (jusqu'à 30 000).
function htmlToColorSegments(html) {
  const container = document.createElement('div');
  container.innerHTML = purify(html);
  const segments = [];
  const walk = (node, color) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent) segments.push({ text: node.textContent, color: color || null });
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const cls = node.className || '';
      let nextColor = color;
      for (const klass in COLOR_MAP) {
        if (cls.indexOf(klass) !== -1) {
          nextColor = COLOR_MAP[klass];
          break;
        }
      }
      node.childNodes.forEach((child) => walk(child, nextColor));
    }
  };
  container.childNodes.forEach((n) => walk(n, null));
  return segments.length ? segments : [{ text: container.textContent || '', color: null }];
}

// Assemblage + compression du .docx dans un Worker dédié (lib/alqalamWorker.js) :
// sur les documents volumineux (répétitions cumulées de centaines de milliers
// de mots colorés), cette étape peut prendre plusieurs minutes — une limite de
// la librairie docx/JSZip elle-même (XML + compression DEFLATE non
// paramétrable), pas de notre code. Un Worker évite que ce temps ne gèle
// l'onglet ; le thread principal reste seulement chargé de l'extraction DOM
// (htmlToColorSegments, qui a besoin de `document` — indisponible dans un
// Worker) et du téléchargement final.
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

  // Extraction DOM (sanitize + parcours) sur les SEULES unités (petites),
  // jamais sur le texte répété — c'est ce qui évitait déjà le temps
  // d'assemblage très long constaté sur les gros documents.
  const ouvSegments = useOuv ? htmlToColorSegments(appliquerCouleursManuscrit(formules.ouverture, firstRasm)) : null;
  const fermSegments = useFerm ? htmlToColorSegments(appliquerCouleursManuscrit(formules.fermeture, lastRasm)) : null;
  const blockPayload = blocks.map((block) => ({
    unitSegments: htmlToColorSegments(appliquerCouleursManuscrit(block.texte, block.isRasmMode) + ' '),
    totalMultiplier: block.totalMultiplier || 1,
  }));

  onProgress(10, 'Assemblage du texte…');

  const blob = await runInWorker({ ouvSegments, fermSegments, blocks: blockPayload, docName, fontPx }, onProgress);

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

// Construit le texte combiné (intercalation) d'une sourate avec une expression.
export function buildIntercalatedText(sourateContent, phrase, rep) {
  const bloc = Array(Math.max(1, rep)).fill(phrase).join(' ');
  let result = sourateContent;
  if (result.includes('﴾')) result = result.split('﴾').join(' ' + bloc + ' ');
  if (result.includes('(')) result = result.split('(').join(' ' + bloc + ' ');
  result = result.replace(/[0-9]/g, '').split('ك').join('ک').replace(/\s+/g, ' ').trim();
  return result;
}
