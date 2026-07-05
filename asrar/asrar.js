// ==================== CONFIGURATION ====================
const CATS = [
  { id: 'deblocage', icon: '🔓', label: 'Déblocage', fbNode: 'db_sirr_deblocage' },
  { id: 'domptage', icon: '🌀', label: 'Domptage', fbNode: 'db_sirr_domptage' },
  { id: 'ilham', icon: '✨', label: 'Ilham', fbNode: 'db_sirr_ilham' },
  { id: 'protection', icon: '🛡️', label: 'Protection', fbNode: 'db_sirr_protection' },
  { id: 'ouverture', icon: '🚪', label: 'Ouverture', fbNode: 'db_sirr_ouverture' }
];

// État
let currentCat = CATS[0];
let secretsCache = {};
let currentSecret = null;
let userRating = 0;
let commentsListener = null;
let commentsRef = null;
let ratingsAvgRef = null;

// Fallbacks pour fonctions externes
if (typeof ensureAccess !== 'function') {
  window.ensureAccess = function(cb) { cb(); };
}
if (typeof showSubscriptionGate !== 'function') {
  window.showSubscriptionGate = function() {
    alert("Contenu réservé aux abonnés. Demandez l'accès à l'administration via WhatsApp.");
  };
}

// ==================== INITIALISATION ====================
requireAuth(async () => {
  buildRail();
  await loadSecrets(currentCat.id);
  renderList(currentCat.id);
});

function buildRail() {
  const rail = document.getElementById('catRail');
  rail.innerHTML = CATS.map(cat => `
    <div class="cat-item ${cat.id === currentCat.id ? 'active' : ''}" data-cat="${cat.id}">
      <span class="ic">${cat.icon}</span>
      <span class="lb">${cat.label}</span>
    </div>
  `).join('');
  document.querySelectorAll('.cat-item').forEach(el => {
    el.addEventListener('click', () => switchCat(el.dataset.cat, el));
  });
}

async function switchCat(catId, el) {
  currentCat = CATS.find(c => c.id === catId);
  document.querySelectorAll('.cat-item').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  backToList();
  await loadSecrets(catId);
  renderList(catId);
}

// ==================== CHARGEMENT DES LISTES ====================
async function loadSecrets(catId) {
  if (secretsCache[catId]) return;
  try {
    // Métadonnées seulement (faida, img) — le sirr n'est jamais renvoyé ici.
    const { items } = await apiPost('list-content', { kind: 'secret', cat: catId });
    secretsCache[catId] = (items || []).map(val => ({
      key: val._key,
      faida: val.faida || val.title || val.titre || 'Secret sans titre',
      img: val.img || val.image || null
    }));
  } catch (e) {
    console.error(e);
    secretsCache[catId] = [];
  }
}

function renderList(catId) {
  const list = secretsCache[catId] || [];
  const container = document.getElementById('secretsList');
  if (list.length === 0) {
    container.innerHTML = '<p style="color:#888; text-align:center; padding:2rem;">Aucun secret trouvé.</p>';
    return;
  }
  container.innerHTML = list.map(item => `
    <div class="secret-card${item.img ? ' has-cover' : ''}" data-key="${item.key}">
      <div class="secret-thumb">${item.img ? `<img src="${escapeHtml(item.img)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='📜'">` : '📜'}</div>
      <div class="secret-title">${escapeHtml(item.faida)}</div>
    </div>
  `).join('');
  document.querySelectorAll('.secret-card').forEach(card => {
    card.addEventListener('click', () => openSecret(card.dataset.key));
  });
}

// ==================== OUVERTURE D'UN SECRET ====================
function openSecret(key) {
  ensureAccess(() => {
    fetchAndShowDetail(key);
  });
}

async function fetchAndShowDetail(key) {
  try {
    // Contenu complet (avec sirr) — l'API ne le renvoie qu'aux abonnés actifs.
    const { item } = await apiPost('get-content', { kind: 'secret', cat: currentCat.id, key });
    if (!item) throw new Error('Secret introuvable.');
    // Compat : nouvelles fiches (title/content/image) ↔ anciennes (faida/sirr/img).
    item.faida = item.faida || item.title || item.titre || '';
    item.sirr  = item.sirr  || item.content || '';
    item.img   = item.img   || item.image || null;
    currentSecret = { catId: currentCat.id, key, data: item };
    showDetailView(item);
  } catch (e) {
    if (e.status === 403) { showSubscriptionGate(); return; }
    alert("Impossible de charger le secret.");
  }
}

function showDetailView(data) {
  document.getElementById('listView').style.display = 'none';
  document.getElementById('detailView').style.display = 'block';
  document.getElementById('interactionBar').style.display = 'flex';

  const imgWrap = document.getElementById('detImgWrap');
  const img = document.getElementById('detImg');
  if (data.img) {
    img.src = data.img;
    img.style.display = 'block';
    img.onerror = () => { img.style.display = 'none'; };
  } else {
    img.style.display = 'none';
  }

  document.getElementById('detTitle').innerHTML = formatMixed(data.faida || '');
  document.getElementById('detSirr').innerHTML = formatMixed(data.sirr || '');

  // Carte en pleine largeur (on masque le rail des catégories en mode détail).
  const wrap = document.querySelector('.asrar-wrap');
  if (wrap) wrap.classList.add('detail-mode');

  // Alimente le lecteur plein écran et l'ouvre (lecture confortable, plein device).
  fillReader(data);
  applyFontScale();
  openReader();

  loadRatingAndComments();
  updateBookmarkIcon();
  window.scrollTo(0,0);
}

// ==================== LECTEUR PLEIN ÉCRAN ====================
function fillReader(data) {
  const img = document.getElementById('rdrImg');
  if (data && data.img) {
    img.src = data.img; img.style.display = 'block';
    img.onerror = () => { img.style.display = 'none'; };
  } else {
    img.style.display = 'none';
  }
  document.getElementById('rdrTitle').innerHTML = formatMixed((data && data.faida) || '');
  document.getElementById('rdrSirr').innerHTML = formatMixed((data && data.sirr) || '');
}
function openReader() {
  if (!currentSecret) return;
  document.getElementById('secretReader').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeReader() {
  document.getElementById('secretReader').classList.remove('open');
  document.body.style.overflow = '';
}
// Zoom du texte (A− / A+) : 0.8 → 2.2, mémorisé localement.
function readerFont(delta) {
  let scale = parseFloat(localStorage.getItem('asrar_font_scale') || '1') + delta * 0.12;
  scale = Math.max(0.8, Math.min(2.2, scale));
  localStorage.setItem('asrar_font_scale', scale.toFixed(2));
  applyFontScale();
}
function applyFontScale() {
  const scale = parseFloat(localStorage.getItem('asrar_font_scale') || '1');
  document.documentElement.style.setProperty('--asrar-scale', scale);
}

function backToList() {
  closeReader();
  const wrap = document.querySelector('.asrar-wrap');
  if (wrap) wrap.classList.remove('detail-mode');
  document.getElementById('detailView').style.display = 'none';
  document.getElementById('listView').style.display = 'block';
  document.getElementById('interactionBar').style.display = 'none';
  // Détache les écouteurs temps réel via les références mémorisées.
  if (commentsRef && commentsListener) {
    commentsRef.off('child_added', commentsListener);
  }
  if (ratingsAvgRef) ratingsAvgRef.off('value');
  commentsListener = null;
  commentsRef = null;
  ratingsAvgRef = null;
  currentSecret = null;
  closeCommentSheet();
}

// ==================== FORMATAGE MIXTE ====================
function formatMixed(text) {
  if (!text) return '';
  const AR = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  let segs = [], cur = null;
  for (const ch of text) {
    const isAr = AR.test(ch);
    const isFr = /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(ch);
    const s = isAr ? 'ar' : (isFr ? 'fr' : null);
    if (s === null) {
      if (cur) cur.text += ch; else cur = { script:'fr', text:ch };
    } else if (!cur || cur.script === null) {
      if (cur) { cur.script = s; cur.text += ch; } else cur = { script:s, text:ch };
    } else if (cur.script === s) {
      cur.text += ch;
    } else {
      segs.push(cur); cur = { script:s, text:ch };
    }
  }
  if (cur) segs.push(cur);
  return segs.map(seg => {
    const t = seg.text.trim();
    if (!t) return '';
    if (seg.script === 'ar') return `<div class="seg-ar">${escapeHtml(t)}</div>`;
    return `<div class="seg-fr">${escapeHtml(t)}</div>`;
  }).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ==================== NOTATION & COMMENTAIRES ====================
function loadRatingAndComments() {
  if (!currentSecret) return;
  const cat = currentSecret.catId, key = currentSecret.key;
  const uid = firebase.auth().currentUser?.uid;
  if (!uid) return;

  firebase.database().ref(`ratings/${cat}/${key}/${uid}`).once('value').then(snap => {
    userRating = snap.val() || 0;
    highlightStars(userRating);
  });

  if (ratingsAvgRef) ratingsAvgRef.off('value');
  ratingsAvgRef = firebase.database().ref(`ratings/${cat}/${key}`);
  ratingsAvgRef.on('value', snap => {
    const ratings = snap.val() || {};
    const vals = Object.values(ratings);
    const avg = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : '0.0';
    document.getElementById('avgRating').innerText = `⭐ ${avg} (${vals.length})`;
  });

  commentsRef = firebase.database().ref(`comments/${cat}/${key}`);
  if (commentsListener) commentsRef.off('child_added', commentsListener);
  document.getElementById('commentList').innerHTML = '';
  commentsListener = commentsRef.on('child_added', snap => {
    const c = snap.val();
    appendComment(c.pseudo, c.text);
  });

  commentsRef.once('value').then(snap => {
    const count = snap.numChildren();
    document.getElementById('commentCount').innerText = `💬 ${count}`;
  });
}

function highlightStars(val) {
  document.querySelectorAll('#ratingStars .star').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.val) <= val);
  });
}

document.getElementById('ratingStars').addEventListener('click', e => {
  if (!e.target.classList.contains('star')) return;
  if (!currentSecret) return;
  const uid = firebase.auth().currentUser?.uid;
  if (!uid) return;
  const val = parseInt(e.target.dataset.val);
  firebase.database().ref(`ratings/${currentSecret.catId}/${currentSecret.key}/${uid}`).set(val);
  userRating = val;
  highlightStars(val);
});

function openCommentSheet() {
  document.getElementById('commentSheet').classList.add('open');
  document.getElementById('overlay').classList.add('show');
  document.getElementById('commentInput').focus();
}

function closeCommentSheet() {
  document.getElementById('commentSheet').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

function postComment() {
  const input = document.getElementById('commentInput');
  const text = input.value.trim();
  if (!text || !currentSecret) return;
  const uid = firebase.auth().currentUser?.uid;
  if (!uid) return;
  const pseudo = '@Initié_' + uid.substring(0,4).toUpperCase();
  firebase.database().ref(`comments/${currentSecret.catId}/${currentSecret.key}`).push({
    uid,
    pseudo,
    text,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
  input.value = '';
}

function appendComment(pseudo, text) {
  const list = document.getElementById('commentList');
  const div = document.createElement('div');
  div.className = 'comment-item';
  div.innerHTML = `<div class="comment-pseudo">${escapeHtml(pseudo)}</div><div class="comment-text">${escapeHtml(text)}</div>`;
  list.appendChild(div);
  list.scrollTop = list.scrollHeight;
}

// ==================== BOOKMARK LOCAL ====================
function toggleBookmark() {
  if (!currentSecret) return;
  const key = `bookmark_${currentSecret.catId}_${currentSecret.key}`;
  if (localStorage.getItem(key)) {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, JSON.stringify(currentSecret.data));
  }
  updateBookmarkIcon();
}

function updateBookmarkIcon() {
  if (!currentSecret) return;
  const key = `bookmark_${currentSecret.catId}_${currentSecret.key}`;
  const icon = document.getElementById('bookmarkBtn');
  if (localStorage.getItem(key)) {
    icon.classList.add('saved');
    icon.innerHTML = '🔖';
  } else {
    icon.classList.remove('saved');
    icon.innerHTML = '🔖';
  }
}

// ==================== IMAGE PLEIN ÉCRAN ====================
function openImageFullscreen() {
  if (!currentSecret?.data?.img) return;
  const imgSrc = currentSecret.data.img;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:300;display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
  const img = document.createElement('img');
  img.src = imgSrc;
  img.style.maxWidth = '90%';
  img.style.maxHeight = '90%';
  img.style.objectFit = 'contain';
  overlay.appendChild(img);
  overlay.onclick = () => overlay.remove();
  document.body.appendChild(overlay);
}

// ── Téléchargement PDF du secret (design épuré, gaté au palier 45 000 FCFA) ──
const PDF_MIN_LEVEL = 45000;
const ASRAR_SITE_URL = 'https://asrar-hub.vercel.app';

function telechargerSecretPdf() {
  if (!currentSecret || !currentSecret.data) return;
  const level = (typeof getSubscriptionLevel === 'function') ? getSubscriptionLevel() : 0;
  if (level < PDF_MIN_LEVEL) {
    alert("📄 Le téléchargement en PDF est réservé à l'abonnement 45 000 FCFA.\n\nChoisissez ce palier pour changer d'abonnement via WhatsApp.");
    if (typeof showSubscriptionGate === 'function') showSubscriptionGate();
    return;
  }
  if (typeof html2pdf === 'undefined') { alert("Générateur PDF indisponible (connexion internet requise)."); return; }

  const d = currentSecret.data;
  const title = d.faida || d.title || 'Secret';
  const contentHtml = (typeof formatMixed === 'function')
    ? formatMixed(d.sirr || d.content || '')
    : escapeHtml(d.sirr || d.content || '');
  const cover = d.img || d.image || '';

  const el = document.createElement('div');
  el.style.cssText = 'width:794px;background:#fbf8f1;color:#2a241a;font-family:Georgia,"Noto Naskh Arabic",serif;';
  el.innerHTML =
    '<div style="padding:40px 48px 30px;">' +
      '<div style="display:flex;align-items:center;gap:14px;border-bottom:2px solid #c9a961;padding-bottom:16px;">' +
        '<img src="/assets/logo-mark.png" crossorigin="anonymous" style="width:54px;height:54px;object-fit:contain;">' +
        '<div>' +
          '<div style="font-size:22px;font-weight:700;letter-spacing:2px;color:#8a6d1b;">ASRAR PRO HUB</div>' +
          '<div style="font-size:12px;color:#9a8a63;letter-spacing:1px;">Sciences mystiques · Secret authentique</div>' +
        '</div>' +
      '</div>' +
      '<h1 style="text-align:center;font-size:26px;color:#6e5512;margin:28px 0 18px;font-weight:600;">' + escapeHtml(title) + '</h1>' +
      (cover ? '<div style="text-align:center;margin:0 0 22px;"><img src="' + escapeHtml(cover) + '" crossorigin="anonymous" style="max-width:52%;border-radius:10px;border:1px solid #e4dcc7;"></div>' : '') +
      '<div style="font-size:16px;line-height:1.9;text-align:justify;">' + contentHtml + '</div>' +
      '<div style="margin-top:36px;border-top:1px solid #e0d6bd;padding-top:12px;text-align:center;color:#9a8a63;font-size:12px;">🔗 ' + ASRAR_SITE_URL + '</div>' +
    '</div>';
  // Respect des retours à la ligne dans le PDF
  el.querySelectorAll('.seg-fr, .seg-ar').forEach(function (s) { s.style.whiteSpace = 'pre-wrap'; s.style.color = '#2a241a'; });

  let safeName = 'secret';
  try { safeName = (title.replace(/[^\p{L}\p{N}\s-]/gu, '').trim().slice(0, 40)) || 'secret'; } catch (e) {}

  html2pdf().set({
    margin: 0,
    filename: 'ASRAR - ' + safeName + '.pdf',
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#fbf8f1' },
    jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }
  }).from(el).save();
}
