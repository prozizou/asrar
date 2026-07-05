// ============================================================
//  ASRAR PRO — Configuration Firebase
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyBLzPKzbiNYitUz7sv9Ftqm0oF20rA32Zk",
  authDomain: "asrar-bc059.firebaseapp.com",
  databaseURL: "https://asrar-bc059.firebaseio.com",
  projectId: "asrar-bc059",
  storageBucket: "asrar-bc059.appspot.com",
  messagingSenderId: "199810893447"
};

firebase.initializeApp(firebaseConfig);
const db   = firebase.database();
const auth = firebase.auth();

// ── Utilitaire : email → clé Firebase (remplace '.' par ',') ──
function emailToKey(email) {
  return email ? email.replace(/\./g, ',') : null;
}

// ── Offres d'abonnement (affichage du portail de paiement) ────
const SUB_PLANS = [
  { id: 'sub_3m',   dur: '3 Mois',        price: '15 000' },
  { id: 'sub_6m',   dur: '6 Mois',        price: '25 000' },
  { id: 'sub_1y',   dur: '1 An',          price: '45 000',  best: true, badge: 'Populaire' }
];

// ── Vérifie si l'utilisateur a un accès actif ─────────────
// Accès si : admin OU vip OU achat valide (purchased_user/{key}.token présent)
// OU allowedUsers actif (compat : true / timestamp futur — grant manuel admin).
function checkAccess(user) {
  return new Promise((resolve) => {
    if (!user || !user.email) return resolve({ allowed: false, admin: false, vip: false });

    const key = emailToKey(user.email);
    const SUPER_ADMIN = 'prozizou298@gmail.com';

    Promise.all([
      db.ref('purchased_user/' + key).once('value'),
      db.ref('allowedUsers/' + key).once('value'),
      db.ref('admins/' + key).once('value'),
      db.ref('vip_users/' + user.uid).once('value')
    ]).then(([purSnap, allowedSnap, adminSnap, vipSnap]) => {
      const isAdmin = (user.email === SUPER_ADMIN) || adminSnap.val() === true;
      const isVip   = vipSnap.exists();

      // — Achat/activation : entrée existe, token présent ET non expiré —
      const pur = purSnap.val();
      const notExpired = !pur || pur.expiresAt === 'lifetime' || pur.expiresAt == null ||
                         (typeof pur.expiresAt === 'number' && pur.expiresAt > Date.now());
      const hasToken = !!(pur && pur.token) && notExpired;

      // — Compat allowedUsers (grant manuel admin) —
      const aVal = allowedSnap.val();
      const allowedLegacy = aVal === true || (typeof aVal === 'number' && aVal > Date.now());

      const isAllowed = isAdmin || isVip || hasToken || allowedLegacy;
      resolve({ allowed: isAllowed, admin: isAdmin, vip: isVip, purchase: pur || null });
    }).catch(() => resolve({ allowed: false, admin: false, vip: false }));
  });
}

// ── Auth guard simple (authentification uniquement) ────────
function requireAuth(callback) {
  auth.onAuthStateChanged(user => {
    if (user) {
      if (callback) callback(user);
    } else {
      window.location.href = getRoot() + 'index.html';
    }
  });
}

// ── Auth guard avec vérification d'abonnement ──────────────
// Si pas d'abonnement actif → affiche le portail de demande d'accès (WhatsApp).
function requireAccess(callback) {
  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = getRoot() + 'index.html';
      return;
    }
    checkAccess(user).then(status => {
      if (status.allowed) {
        if (callback) callback(user, status);
      } else {
        showSubscriptionGate();
      }
    });
  });
}

// ── Demande d'accès via WhatsApp pour l'offre choisie ──────
// (Plus de paiement en ligne : l'activation est faite manuellement par
//  l'administration après réception de la demande WhatsApp.)
function startSubscription(productId) {
  const user = auth.currentUser;
  if (!user) { window.location.href = getRoot() + 'index.html'; return; }

  if (!window.ASRAR_WA) {
    alert("Contactez l'administration pour activer votre accès.");
    return;
  }
  const note = document.getElementById('gate-note');
  if (note) note.innerText = 'Ouverture de WhatsApp…';
  window.ASRAR_WA.openAccess({ planId: productId, email: user.email });
}

// ── Vérifie l'accès À LA DEMANDE (ex: au clic sur un élément) ──
// Si abonné → exécute l'action ; sinon → ouvre le portail de paiement (overlay).
let _accessStatus = null; // cache pour la session de la page
// Force une nouvelle lecture de l'accès (ex: après un retour de paiement réussi).
function invalidateAccessCache() { _accessStatus = null; }

// Niveau d'abonnement (montant FCFA) de l'utilisateur, pour les fonctionnalités
// gatées par palier (ex. téléchargement PDF ≥ 45 000). Admin/VIP = accès total.
function getSubscriptionLevel() {
  if (!_accessStatus) return 0;
  if (_accessStatus.admin || _accessStatus.vip) return 999999;
  const p = _accessStatus.purchase;
  return (p && Number(p.level)) ? Number(p.level) : 0;
}
function ensureAccess(onGranted) {
  const user = auth.currentUser;
  if (!user) { window.location.href = getRoot() + 'index.html'; return; }

  const apply = (status) => {
    _accessStatus = status;
    if (status.allowed) { if (onGranted) onGranted(user, status); }
    else { showSubscriptionGate(); }
  };

  if (_accessStatus) return apply(_accessStatus); // évite de relire la base à chaque clic
  checkAccess(user).then(apply);
}

// ── Portail « abonnement requis » (overlay) + demande via WhatsApp ──
function showSubscriptionGate() {
  if (document.getElementById('sg-overlay')) return; // déjà ouvert

  const cards = SUB_PLANS.map(p => `
    <div class="sg-card ${p.best ? 'best' : ''}" onclick="startSubscription('${p.id}')">
      ${p.badge ? `<span class="sg-badge">${p.badge}</span>` : ''}
      <div class="sg-dur">${p.dur}</div>
      <div class="sg-price">${p.price} <small>FCFA</small></div>
    </div>`).join('');

  const ov = document.createElement('div');
  ov.id = 'sg-overlay';
  ov.innerHTML = `
    <style>
      #sg-overlay { position:fixed; inset:0; z-index:9999; display:flex;
        align-items:center; justify-content:center; padding:20px;
        background:rgba(0,0,0,.75); backdrop-filter:blur(4px); }
      .sg-box { background:#0f2027; border:1px solid rgba(255,255,255,.2);
        border-radius:20px; padding:30px 24px; text-align:center; max-width:560px;
        width:100%; position:relative; font-family:Poppins,sans-serif; color:#fff; }
      .sg-close { position:absolute; top:14px; right:16px; cursor:pointer;
        font-size:1.4rem; color:#cfd8dc; line-height:1; }
      .sg-close:hover { color:#fff; }
      .sg-box h2 { margin:6px 0; font-weight:600; letter-spacing:1px; }
      .sg-box .sg-sub { color:#cfd8dc; margin-bottom:20px; font-size:.95rem; }
      .sg-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:14px; }
      .sg-card { background:rgba(0,0,0,.25); border:1px solid rgba(255,255,255,.2);
        border-radius:16px; padding:20px 14px; cursor:pointer; position:relative;
        transition:transform .25s, box-shadow .25s, border-color .25s; }
      .sg-card:hover { transform:translateY(-4px); border-color:#4facfe;
        box-shadow:0 8px 22px rgba(79,172,254,.35); }
      .sg-card.best { border-color:#00f2fe; }
      .sg-dur { font-size:1.1rem; font-weight:600; }
      .sg-price { margin-top:8px; font-size:1.3rem; font-weight:700;
        background:-webkit-linear-gradient(45deg,#4facfe,#00f2fe);
        -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
      .sg-price small { font-size:.7rem; color:#cfd8dc; -webkit-text-fill-color:#cfd8dc; }
      .sg-badge { position:absolute; top:-10px; left:50%; transform:translateX(-50%);
        background:linear-gradient(45deg,#4facfe,#00f2fe); color:#fff; font-size:.62rem;
        font-weight:600; padding:3px 10px; border-radius:20px; white-space:nowrap; }
      #gate-note { margin-top:18px; font-size:.82rem; color:#cfd8dc; min-height:18px; }
    </style>
    <div class="sg-box">
      <span class="sg-close" onclick="closeSubscriptionGate()">✕</span>
      <div style="font-size:2.4rem;">🔒</div>
      <h2>Abonnement requis</h2>
      <p class="sg-sub">Choisissez une formule, puis validez votre demande sur WhatsApp. L'accès est activé par l'administration.</p>
      <div class="sg-grid">${cards}</div>
      <p id="gate-note">💬 Cliquez sur une formule pour envoyer votre demande via WhatsApp.</p>
    </div>`;

  document.body.appendChild(ov);
  ov.addEventListener('click', (e) => { if (e.target === ov) closeSubscriptionGate(); });
}

function closeSubscriptionGate() {
  const g = document.getElementById('sg-overlay');
  if (g) g.remove();
}

// ── Chemin relatif vers la racine ──────────────────────────
function getRoot() {
  const depth = window.location.pathname.split('/').filter(Boolean).length - 1;
  return depth > 0 ? '../'.repeat(depth) : './';
}

// ── Déconnexion ────────────────────────────────────────────
function signOut() {
  auth.signOut().then(() => {
    window.location.href = getRoot() + 'index.html';
  });
}

// ── Journalisation légère des visites (alimente le tableau de bord admin) ──
let _visitTracked = false;
// La page de connexion (racine index.html) ne doit PAS être journalisée : elle
// redirige aussitôt vers l'accueil, et l'appel /api/track y est inutile.
function isRootLogin() {
  const segs = window.location.pathname.split('/').filter(Boolean);
  const last = segs[segs.length - 1] || '';
  return segs.length === 0 || (segs.length === 1 && (last === '' || last === 'index.html'));
}
function trackVisit() {
  if (_visitTracked || !auth.currentUser || isRootLogin()) return;
  _visitTracked = true;
  const page = window.location.pathname.split('/').filter(Boolean).pop() || 'accueil';
  auth.currentUser.getIdToken().then(idToken =>
    fetch('/api/track', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, type: 'visit', page })
    })
  ).catch(() => {}); // télémétrie : ne jamais remonter d'erreur à l'utilisateur
}
auth.onAuthStateChanged(u => { if (u) trackVisit(); });
