// ==================== MA BOUTIQUE — logique ====================
// Flux : (1) si pas vendeur actif → demande d'ouverture de boutique via WhatsApp.
//        (2) une fois active → édition de la boutique + CRUD produits via /api/shop.
// Toutes les écritures passent par le serveur (Admin SDK) : le client n'impose
// jamais l'uid/vendeur/email — ils viennent du jeton vérifié côté serveur.

let myProducts = [];
let shopLogoFile = null;      // logo boutique choisi (avant upload)
let prodImageFile = null;     // image produit choisie (avant upload)
let currentProdImage = '';    // image existante en édition

// Upload d'une image (téléphone → Cloudinary) via signature serveur.
async function uploadImage(file, folder) {
  const sign = await apiPost('cloudinary-sign', { folder });
  const fd = new FormData();
  fd.append('file', file);
  fd.append('api_key', sign.apiKey);
  fd.append('timestamp', sign.timestamp);
  fd.append('signature', sign.signature);
  fd.append('folder', sign.folder);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`, { method: 'POST', body: fd });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data.error && data.error.message) || "Échec de l'envoi de l'image.");
  return data.secure_url;
}

function previewShopLogo(e) {
  const f = e.target.files[0]; if (!f) return;
  shopLogoFile = f;
  const img = document.getElementById('shopLogoImg'), empty = document.getElementById('shopLogoEmpty');
  img.src = URL.createObjectURL(f); img.style.display = ''; empty.style.display = 'none';
}
function previewProdImage(e) {
  const f = e.target.files[0]; if (!f) return;
  prodImageFile = f;
  const img = document.getElementById('pImageImg'), empty = document.getElementById('pImageEmpty');
  img.src = URL.createObjectURL(f); img.style.display = ''; empty.style.display = 'none';
}

requireAuth(() => { boot(); });

async function boot() {
  nettoyerAncienRetour();   // compat : nettoie d'anciens ?token=… d'URL
  await chargerStatut();
}

// ---- Compat : nettoyage d'anciens paramètres d'URL (plus de paiement en ligne) ----
function nettoyerAncienRetour() {
  const params = new URLSearchParams(location.search);
  if (params.has('token') || params.has('canceled')) {
    history.replaceState({}, document.title, location.pathname);
  }
}

// ---- Statut vendeur ----
async function chargerStatut() {
  show('loadingView');
  try {
    const data = await apiPost('shop', { action: 'me' });
    if (data.active) {
      renderShop(data.seller, data.products || []);
    } else {
      show('gateView');
    }
  } catch (e) {
    document.getElementById('loadingView').innerHTML =
      '<p class="bq-error">Erreur : ' + (e.message || e) + '</p>';
  }
}

// ---- Demande d'ouverture / prolongation de boutique (via WhatsApp) ----
// L'administration active ensuite la boutique manuellement (sellers/{uid}).
function souscrireBoutique(planId) {
  const note = document.getElementById('gateNote');
  const user = firebase.auth().currentUser;
  if (!user) { window.location.href = '../index.html'; return; }
  if (!window.ASRAR_WA) {
    if (note) note.innerText = "Contactez l'administration pour activer votre boutique.";
    return;
  }
  if (note) note.innerText = 'Ouverture de WhatsApp…';
  window.ASRAR_WA.openAccess({ planId, email: user.email, section: 'Boutique vendeur (Marché)' });
}

// ---- Rendu boutique ----
function renderShop(seller, products) {
  myProducts = products;
  const shop = (seller && seller.shop) || {};
  document.getElementById('shopName').value = shop.name || '';
  document.getElementById('shopDesc').value = shop.description || '';
  document.getElementById('shopPhone').value = shop.phone || '';
  // Logo existant
  shopLogoFile = null;
  const logo = shop.logo || '';
  const lImg = document.getElementById('shopLogoImg'), lEmpty = document.getElementById('shopLogoEmpty');
  if (logo) { lImg.src = logo; lImg.style.display = ''; lEmpty.style.display = 'none'; }
  else { lImg.src = ''; lImg.style.display = 'none'; lEmpty.style.display = ''; }

  const exp = seller && seller.expiresAt;
  let statut = 'Boutique active';
  if (typeof exp === 'number') {
    statut += ' · expire le ' + new Date(exp).toLocaleDateString('fr-FR',
      { day: '2-digit', month: 'long', year: 'numeric' });
  }
  document.getElementById('bqStatus').innerHTML =
    '<span class="bq-dot"></span> ' + statut +
    ' <a class="bq-renew" onclick="show(\'gateView\')">Prolonger</a>';

  renderProducts();
  show('shopView');
}

function renderProducts() {
  document.getElementById('prodCount').innerText = myProducts.length;
  const wrap = document.getElementById('bqProducts');
  if (myProducts.length === 0) {
    wrap.innerHTML = '<p class="bq-empty">Aucun produit. Cliquez sur « Ajouter un produit ».</p>';
    return;
  }
  wrap.innerHTML = myProducts.map(p => `
    <div class="bq-prod">
      <div class="bq-prod-img">${p.Image
        ? `<img src="${esc(p.Image)}" onerror="this.parentElement.innerHTML='🔮'">` : '🔮'}</div>
      <div class="bq-prod-body">
        <div class="bq-prod-name">${esc(p.produit || 'Produit')}</div>
        <div class="bq-prod-price">${Number(p.Prix||0).toLocaleString('fr-FR')} ${esc(p.devise||'FCFA')}</div>
        <div class="bq-prod-chain">${esc(p.chain || '')}</div>
      </div>
      <div class="bq-prod-actions">
        <button onclick="editerProduit('${p._key}')">✏️</button>
        <button onclick="supprimerProduit('${p._key}')">🗑️</button>
      </div>
    </div>`).join('');
}

// ---- Enregistrer la fiche boutique ----
async function enregistrerBoutique() {
  const shop = {
    name: document.getElementById('shopName').value.trim(),
    description: document.getElementById('shopDesc').value.trim(),
    phone: document.getElementById('shopPhone').value.trim()
  };
  if (!shop.name) { alert('Le nom de la boutique est requis.'); return; }
  try {
    let logoUrl;
    if (shopLogoFile) logoUrl = await uploadImage(shopLogoFile, 'shop_logos');
    await apiPost('shop', { action: 'save-shop', shop, logoUrl });
    alert('✅ Boutique enregistrée.');
    await chargerStatut();
  } catch (e) { alert('Erreur : ' + (e.message || e)); }
}

// ---- Formulaire produit ----
function ouvrirFormProduit(prod) {
  document.getElementById('prodFormTitle').innerText = prod ? 'Modifier le produit' : 'Ajouter un produit';
  document.getElementById('pKey').value = prod ? prod._key : '';
  document.getElementById('pName').value = prod ? (prod.produit || '') : '';
  document.getElementById('pPrice').value = prod ? (prod.Prix || '') : '';
  document.getElementById('pDevise').value = prod ? (prod.devise || 'FCFA') : 'FCFA';
  document.getElementById('pChain').value = prod ? (prod.chain || 'autres') : 'Secret';
  document.getElementById('pNumber').value = prod ? (prod.number || '') : '';
  document.getElementById('pDesc').value = prod ? (prod.description || '') : '';
  // Image : aperçu de l'existante, réinitialise le fichier choisi
  prodImageFile = null;
  currentProdImage = prod ? (prod.Image || '') : '';
  const pImg = document.getElementById('pImageImg'), pEmpty = document.getElementById('pImageEmpty');
  if (currentProdImage) { pImg.src = currentProdImage; pImg.style.display = ''; pEmpty.style.display = 'none'; }
  else { pImg.src = ''; pImg.style.display = 'none'; pEmpty.style.display = ''; }
  const pf = document.getElementById('pImageFile'); if (pf) pf.value = '';
  document.getElementById('prodFormNote').innerText = '';
  document.getElementById('prodFormOverlay').classList.add('open');
}
function fermerFormProduit() {
  document.getElementById('prodFormOverlay').classList.remove('open');
}
function editerProduit(key) {
  const p = myProducts.find(x => x._key === key);
  if (p) ouvrirFormProduit(p);
}

async function enregistrerProduit() {
  const nom = document.getElementById('pName').value.trim();
  const prix = document.getElementById('pPrice').value;
  if (!nom) { setNote('Le nom du produit est requis.'); return; }
  if (!(parseInt(prix, 10) > 0)) { setNote('Prix invalide.'); return; }
  try {
    let imageUrl = currentProdImage;
    if (prodImageFile) { setNote('Envoi de l\'image…'); imageUrl = await uploadImage(prodImageFile, 'products'); }
    const product = {
      key: document.getElementById('pKey').value || undefined,
      produit: nom,
      Prix: prix,
      devise: document.getElementById('pDevise').value.trim() || 'FCFA',
      chain: document.getElementById('pChain').value,
      Image: imageUrl,
      number: document.getElementById('pNumber').value.trim(),
      description: document.getElementById('pDesc').value.trim()
    };
    await apiPost('shop', { action: 'save-product', product });
    fermerFormProduit();
    await chargerStatut();
  } catch (e) { setNote('Erreur : ' + (e.message || e)); }
}

async function supprimerProduit(key) {
  if (!confirm('Supprimer ce produit ?')) return;
  try {
    await apiPost('shop', { action: 'delete-product', key });
    await chargerStatut();
  } catch (e) { alert('Erreur : ' + (e.message || e)); }
}

// ---- Utilitaires ----
function show(id) {
  ['loadingView', 'gateView', 'shopView'].forEach(v => {
    document.getElementById(v).style.display = (v === id) ? '' : 'none';
  });
}
function setNote(msg) { document.getElementById('prodFormNote').innerText = msg; }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
