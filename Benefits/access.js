// access.js — Contrôle d'abonnement pour « Noms d'Allah » (Benefits).
//
// Réplique la logique du hub (js/firebase-config.js → checkAccess) mais en SDK
// modulaire, avec sa propre app partagée (firebase-init.js).
//
// Accès si : super-admin OU admin OU vip OU achat valide (token + non expiré)
//            OU grant manuel (allowedUsers : true / timestamp futur).
//
// Sans abonnement : les cartes n'affichent QUE le nom, et la modale est verrouillée
// (nom seul + invitation à s'abonner). La demande d'accès passe par WhatsApp
// (activation manuelle par l'administration après réception de la demande).

import { auth, db, ref, get, authReady } from './firebase-init.js';

const SUPER_ADMIN = 'prozizou298@gmail.com';
const CACHE_KEY   = 'asrar_access';
const CACHE_TTL   = 6 * 3_600_000; // 6 h — permet aux abonnés hors-ligne de garder l'accès

const emailToKey = (e) => (e ? e.replace(/\./g, ',') : null);

// Offres « contenu » (identiques au catalogue serveur plans.js).
const SUB_PLANS = [
  { id: 'sub_3m',   dur: '3 Mois',        price: '15 000' },
  { id: 'sub_6m',   dur: '6 Mois',        price: '25 000' },
  { id: 'sub_1y',   dur: '1 An',          price: '45 000',  best: true, badge: 'Populaire' }
];

// ── Cache local (accès hors-ligne pour les abonnés) ───────────
export function getCachedAccess() {
  try {
    const v = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (v && (Date.now() - v.t) < CACHE_TTL) return v.ok === true;
  } catch (e) {}
  return null;
}
function cacheAccess(ok) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ok: !!ok, t: Date.now() })); } catch (e) {}
}

// Lecture tolérante : une règle qui refuse un nœud ne casse pas les autres signaux.
async function safeVal(path) {
  try { const s = await get(ref(db, path)); return s.exists() ? s.val() : null; }
  catch (e) { return undefined; } // undefined = lecture refusée / indéterminée
}

// ── Résolution de l'accès (source de vérité : Firebase) ───────
export async function resolveAccess() {
  const user = auth.currentUser || await authReady();
  if (!user || !user.email) { cacheAccess(false); return { ok: false, user: null }; }
  if (user.email === SUPER_ADMIN) { cacheAccess(true); return { ok: true, user }; }

  const key = emailToKey(user.email);
  const [pur, allowed, admin, vip] = await Promise.all([
    safeVal('purchased_user/' + key),
    safeVal('allowedUsers/'  + key),
    safeVal('admins/'        + key),
    safeVal('vip_users/'     + user.uid)
  ]);

  const isAdmin = admin === true;
  const isVip   = vip !== null && vip !== undefined;

  const notExpired = !pur || pur.expiresAt === 'lifetime' || pur.expiresAt == null ||
                     (typeof pur.expiresAt === 'number' && pur.expiresAt > Date.now());
  const hasToken = !!(pur && pur.token) && notExpired;

  const legacy = allowed === true || (typeof allowed === 'number' && allowed > Date.now());

  const ok = isAdmin || isVip || hasToken || legacy;
  cacheAccess(ok);
  return { ok, user };
}

// ── Chemin racine du hub (pour rediriger vers la connexion) ───
function hubLoginURL() { return '../index.html'; }

// ── Demande d'accès via WhatsApp (activation manuelle par l'admin) ──
function startSubscription(productId, noteEl, section) {
  const user = auth.currentUser;
  if (!user) { window.location.href = hubLoginURL(); return; } // pas connecté → login hub

  if (!window.ASRAR_WA) {
    if (noteEl) noteEl.textContent = "Contactez l'administration pour activer votre accès.";
    return;
  }
  if (noteEl) noteEl.textContent = 'Ouverture de WhatsApp…';
  window.ASRAR_WA.openAccess({
    planId: productId,
    email: user.email,
    section: section || "Noms d'Allah"
  });
}

// ── Portail « abonnement requis » (affiche le nom concerné) ───
export function showBenefitsGate(item) {
  if (document.getElementById('bg-overlay')) return;

  // Échappement (les champs viennent de Firebase → jamais de HTML brut).
  const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const nameHtml = item
    ? `<div class="bg-name">${esc(item.name)}</div>
       <div class="bg-translit">${esc(item.translit)}</div>`
    : '';

  const cards = SUB_PLANS.map(p => `
    <div class="bg-card ${p.best ? 'best' : ''}" data-plan="${p.id}">
      ${p.badge ? `<span class="bg-badge">${p.badge}</span>` : ''}
      <div class="bg-dur">${p.dur}</div>
      <div class="bg-price">${p.price} <small>FCFA</small></div>
    </div>`).join('');

  const ov = document.createElement('div');
  ov.id = 'bg-overlay';
  ov.innerHTML = `
    <style>
      #bg-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;
        justify-content:center;padding:20px;background:rgba(0,0,0,.78);backdrop-filter:blur(5px);}
      .bg-box{background:#0f2027;border:1px solid rgba(255,255,255,.2);border-radius:20px;
        padding:26px 22px;text-align:center;max-width:560px;width:100%;position:relative;
        color:#fff;font-family:'Inter',system-ui,sans-serif;}
      .bg-close{position:absolute;top:12px;right:16px;cursor:pointer;font-size:1.5rem;
        color:#cfd8dc;line-height:1;} .bg-close:hover{color:#fff;}
      .bg-name{font-size:2.4rem;font-weight:700;margin-top:6px;
        font-family:'Traditional Arabic','Amiri',serif;}
      .bg-translit{color:#9fb3c8;margin:2px 0 4px;font-size:.95rem;}
      .bg-box h2{margin:10px 0 2px;font-weight:600;letter-spacing:.5px;}
      .bg-sub{color:#cfd8dc;margin-bottom:18px;font-size:.92rem;}
      .bg-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;}
      .bg-card{background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.2);
        border-radius:16px;padding:18px 12px;cursor:pointer;position:relative;
        transition:transform .2s,border-color .2s,box-shadow .2s;}
      .bg-card:hover{transform:translateY(-4px);border-color:#4facfe;
        box-shadow:0 8px 22px rgba(79,172,254,.35);}
      .bg-card.best{border-color:#00f2fe;}
      .bg-dur{font-size:1.05rem;font-weight:600;}
      .bg-price{margin-top:6px;font-size:1.25rem;font-weight:700;
        background:linear-gradient(45deg,#4facfe,#00f2fe);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent;}
      .bg-price small{font-size:.68rem;color:#cfd8dc;-webkit-text-fill-color:#cfd8dc;}
      .bg-badge{position:absolute;top:-10px;left:50%;transform:translateX(-50%);
        background:linear-gradient(45deg,#4facfe,#00f2fe);color:#fff;font-size:.6rem;
        font-weight:600;padding:3px 10px;border-radius:20px;white-space:nowrap;}
      #bg-note{margin-top:16px;font-size:.8rem;color:#cfd8dc;min-height:16px;}
    </style>
    <div class="bg-box">
      <span class="bg-close" aria-label="Fermer">✕</span>
      <div style="font-size:2rem;">🔒</div>
      ${nameHtml}
      <h2>Abonnement requis</h2>
      <p class="bg-sub">Abonnez-vous pour débloquer le sens, le secret et les carrés magiques de tous les noms.</p>
      <div class="bg-grid">${cards}</div>
      <p id="bg-note">💬 Cliquez sur une formule pour envoyer votre demande via WhatsApp.</p>
    </div>`;

  const note = () => ov.querySelector('#bg-note');
  ov.querySelector('.bg-close').addEventListener('click', () => ov.remove());
  ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
  const section = item && item.name ? String(item.name) : "Noms d'Allah";
  ov.querySelectorAll('.bg-card').forEach(c =>
    c.addEventListener('click', () => startSubscription(c.dataset.plan, note(), section))
  );
  document.body.appendChild(ov);
}

export function closeBenefitsGate() {
  document.getElementById('bg-overlay')?.remove();
}

// ── Compat : nettoie d'anciens paramètres ?token=... d'URL (plus de paiement en ligne) ──
export async function confirmReturn() {
  const url = new URL(location.href);
  if (!url.searchParams.has('token') && !url.searchParams.has('canceled')) return false;
  url.searchParams.delete('token');
  url.searchParams.delete('canceled');
  history.replaceState({}, '', url.pathname + url.search + url.hash);
  return true;
}
