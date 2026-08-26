'use client';
// Partage (deep links) & parrainage — port de js/share.js.
// Liens courts /s?k=…&c=…&i=…&r=<code parrain>, capture du code de parrainage,
// et transmission au serveur (/api/referral) à la connexion.
import { auth } from './firebase';

const REF_KEY = 'asrar_ref';
const CLAIM_KEY = 'asrar_ref_claimed';
const REF_TTL = 30 * 24 * 60 * 60 * 1000; // 30 jours
const ENDPOINT = '/api/referral';

// Deep link DIFFÉRÉ (« deferred deep link ») — clé écrite par la page de
// partage /s (pages/api/share.js) et relue ici. Les deux fichiers doivent
// garder le MÊME nom de clé et le même format { path, at }.
//
// Pourquoi : quand un visiteur arrive sur un lien partagé puis INSTALLE
// l'app, l'installation la lance sur `start_url` ("/", cf. manifest.json) —
// nos paramètres ?item=/?cat= sont perdus, et le lien partagé retombait donc
// bêtement sur l'accueil. /s mémorise la destination avant l'installation ;
// components/PendingDeepLink.js la rejoue au premier lancement.
const PENDING_KEY = 'asrar_pending_link';
// Courte : ne couvre que l'enchaînement « je clique, j'installe, j'ouvre ».
// Au-delà, rejouer un ancien lien serait une surprise, pas un service.
const PENDING_TTL = 2 * 60 * 60 * 1000; // 2 heures

// product → '/' : le Marché Mystique est désormais la page d'accueil.
const TARGETS = {
  secret: '/asrar',
  book: '/bibliotheque',
  product: '/',
};

let _me = null;
let _mePromise = null;

function qs(name) {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}
function lsGet(k) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function lsSet(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch {}
}
function lsDel(k) {
  try {
    localStorage.removeItem(k);
  } catch {}
}
function cleanCode(c) {
  return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

export async function post(action, extra) {
  const u = auth.currentUser;
  if (!u) throw new Error('Non connecté.');
  const t = await u.getIdToken();
  const body = { idToken: t, action, ...(extra || {}) };
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'Erreur serveur.'), { status: r.status });
  return d;
}

export function me(force) {
  if (force) {
    _me = null;
    _mePromise = null;
  }
  if (_me) return Promise.resolve(_me);
  if (_mePromise) return _mePromise;
  _mePromise = post('me')
    .then((d) => {
      _me = d;
      _mePromise = null;
      return d;
    })
    .catch((e) => {
      _mePromise = null;
      throw e;
    });
  return _mePromise;
}

export function buildUrl(opts, code) {
  opts = opts || {};
  const p = [];
  if (opts.kind && TARGETS[opts.kind]) {
    p.push('k=' + encodeURIComponent(opts.kind));
    if (opts.cat) p.push('c=' + encodeURIComponent(opts.cat));
    if (opts.key) p.push('i=' + encodeURIComponent(opts.key));
  }
  if (code) p.push('r=' + encodeURIComponent(code));
  return window.location.origin + '/s' + (p.length ? '?' + p.join('&') : '');
}

export function link(opts) {
  return me()
    .then((m) => buildUrl(opts, m && m.code))
    .catch(() => buildUrl(opts, null));
}

export function toast(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText =
    'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:99999;' +
    'max-width:88vw;background:rgba(15,32,39,.96);color:#fff;border:1px solid rgba(201,169,97,.5);' +
    'border-radius:12px;padding:12px 18px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.4);' +
    'word-break:break-all;text-align:center;';
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .4s';
    el.style.opacity = '0';
  }, 2600);
  setTimeout(() => el.remove(), 3100);
}

export function copy(url) {
  const done = () => toast('🔗 Lien copié : ' + url);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(url).then(done).catch(() => prompt('Copiez le lien :', url));
  }
  const ta = document.createElement('textarea');
  ta.value = url;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    done();
  } catch {
    prompt('Copiez le lien :', url);
  }
  ta.remove();
  return Promise.resolve();
}

export function share(opts) {
  opts = opts || {};
  return link(opts)
    .then((url) => {
      const title = opts.title || 'ASRAR PRO';
      const text = (opts.text || title) + '\n';
      if (navigator.share) {
        return navigator.share({ title, text, url }).catch((e) => {
          if (e && e.name !== 'AbortError') copy(url);
        });
      }
      return copy(url);
    })
    .catch(() => toast('Partage indisponible.'));
}

// Deep link : la page cible /asrar lit ?item=…&cat=… (ou k/c/i selon la route /s).
export function deepLink() {
  const key = qs('item') || qs('i');
  if (!key) return null;
  return { key, cat: qs('cat') || qs('c') || null };
}

// Récupère (UNE SEULE FOIS) la destination mémorisée par /s avant une
// installation. Consommée de façon atomique : la clé est effacée dès la
// lecture, même si la valeur est périmée ou invalide — un deep link ne se
// rejoue jamais deux fois.
export function consumePendingLink() {
  const raw = lsGet(PENDING_KEY);
  if (!raw) return null;
  lsDel(PENDING_KEY);
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v.path !== 'string') return null;
    if (Date.now() - (v.at || 0) > PENDING_TTL) return null;
    // Chemin INTERNE uniquement. localStorage est modifiable par n'importe
    // quel script de l'origine : sans ce garde-fou, une valeur trafiquée
    // ("https://…", "//evil.tld") transformerait ce rejeu en redirection
    // ouverte vers un site tiers.
    if (v.path[0] !== '/' || v.path[1] === '/') return null;
    return v.path;
  } catch {
    return null;
  }
}

export function cleanUrl() {
  try {
    const u = new URL(window.location.href);
    ['item', 'cat', 'r', 'k', 'c', 'i'].forEach((p) => u.searchParams.delete(p));
    window.history.replaceState({}, document.title, u.pathname + (u.search || '') + u.hash);
  } catch {}
}

// Capture du code de parrainage à l'arrivée (appelé au montage de l'app).
export function captureRef() {
  const r = cleanCode(qs('r'));
  if (!r) return;
  if (lsGet(CLAIM_KEY)) return;
  lsSet(REF_KEY, JSON.stringify({ code: r, at: Date.now() }));
}

function storedRef() {
  try {
    const v = JSON.parse(lsGet(REF_KEY) || 'null');
    if (!v || !v.code) return null;
    if (Date.now() - (v.at || 0) > REF_TTL) {
      lsDel(REF_KEY);
      return null;
    }
    return v.code;
  } catch {
    return null;
  }
}

// Transmission au serveur à la connexion (une seule fois).
let _claiming = false;
export function claimRef() {
  if (_claiming || lsGet(CLAIM_KEY)) return;
  const code = storedRef();
  if (!code) return;
  _claiming = true;
  post('claim', { code })
    .then(() => {
      lsSet(CLAIM_KEY, code);
      lsDel(REF_KEY);
    })
    .catch(() => {})
    .then(() => {
      _claiming = false;
    });
}
