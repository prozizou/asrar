// ==================== MA BOUTIQUE — logique ====================
// Flux : (1) si pas vendeur actif → demande d'ouverture de boutique via WhatsApp.
//        (2) une fois active → édition de la boutique + CRUD produits via /api/shop.
// Toutes les écritures passent par le serveur (Admin SDK) : le client n'impose
// jamais l'uid/vendeur/email — ils viennent du jeton vérifié côté serveur.

let myProducts = [];
let shopLogoFile = null;      // logo boutique choisi (avant upload)
// Toast léger (remplace les alert() bloquants pour la validation du formulaire).
function toast(msg) {
  let t = document.getElementById('bqToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'bqToast';
    t.className = 'bq-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3200);
}

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
// ── Images du produit : 2 minimum, 5 maximum ──
const MAX_IMAGES = 5;
const MIN_IMAGES = 2;
// Chaque entrée : { file: File|null, url: string }
// `file` = nouvelle image à téléverser ; `url` = image déjà hébergée (édition).
let prodImages = [];

function ajouterImagesProduit(e) {
  const fichiers = Array.from(e.target.files || []);
  e.target.value = '';   // permet de re-sélectionner le même fichier
  if (!fichiers.length) return;

  const place = MAX_IMAGES - prodImages.length;
  if (place <= 0) { toast(`Maximum ${MAX_IMAGES} images.`); return; }
  if (fichiers.length > place) toast(`Seules ${place} image(s) ont été ajoutées (max ${MAX_IMAGES}).`);

  fichiers.slice(0, place).forEach(f => {
    prodImages.push({ file: f, url: URL.createObjectURL(f) });
  });
  renderProdImages();
}

function retirerImageProduit(i) {
  const img = prodImages[i];
  if (img && img.file && img.url) URL.revokeObjectURL(img.url);
  prodImages.splice(i, 1);
  renderProdImages();
}

function renderProdImages() {
  const wrap = document.getElementById('pImagesPreview');
  const cnt = document.getElementById('pImagesCount');
  if (cnt) {
    cnt.innerText = `${prodImages.length} / ${MAX_IMAGES} image(s)` +
      (prodImages.length < MIN_IMAGES ? ` — ${MIN_IMAGES} minimum` : '');
  }
  if (!wrap) return;
  if (!prodImages.length) {
    wrap.innerHTML = '<span class="bq-images-empty">Aucune image</span>';
    return;
  }
  wrap.innerHTML = prodImages.map((im, i) => `
    <div class="bq-image-item">
      <img src="${esc(im.url)}" alt="">
      <button type="button" onclick="retirerImageProduit(${i})" aria-label="Retirer">✕</button>
      ${i === 0 ? '<span class="bq-image-main">Principale</span>' : ''}
    </div>`).join('');
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
        ? `<img src="${esc(p.Image)}" loading="lazy" decoding="async" onerror="this.parentElement.innerHTML='🔮'">` : '🔮'}</div>
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
  document.getElementById('pChain').value = prod ? (prod.chain || '') : '';
  document.getElementById('pDesc').value = prod ? (prod.description || '') : '';

  // Galerie : `images` (nouveau) ou repli sur `Image` (ancien format).
  prodImages = [];
  if (prod) {
    const src = Array.isArray(prod.images) && prod.images.length
      ? prod.images
      : (prod.Image ? [prod.Image] : []);
    prodImages = src.filter(Boolean).slice(0, MAX_IMAGES).map(u => ({ file: null, url: u }));
  }
  renderProdImages();

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

// Vérifie chaque champ dans l'ordre du formulaire. Au premier manquant :
// toast explicite, focus + surlignage du champ concerné.
function validerFormProduit() {
  const champs = [
    { id: 'pName',   test: v => v.trim().length > 0,          msg: 'Indiquez le nom du produit.' },
    { id: 'pPrice',  test: v => parseInt(v, 10) > 0,          msg: 'Indiquez un prix valide (supérieur à 0).' },
    { id: 'pDevise', test: v => v.trim().length > 0,          msg: 'Indiquez la devise (ex : FCFA).' },
    { id: 'pChain',  test: v => v.trim().length > 0,          msg: 'Choisissez une catégorie.' },
    { id: 'pDesc',   test: v => v.trim().length > 0,          msg: 'Ajoutez une description du produit.' }
  ];

  document.querySelectorAll('.bq-field-error').forEach(el => el.classList.remove('bq-field-error'));

  for (const c of champs) {
    const el = document.getElementById(c.id);
    if (!el || c.test(el.value)) continue;
    toast(c.msg);
    el.classList.add('bq-field-error');
    el.focus();
    if (el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return false;
  }

  if (prodImages.length < MIN_IMAGES) {
    toast(`Ajoutez au moins ${MIN_IMAGES} images du produit (${prodImages.length} pour l'instant).`);
    const zone = document.getElementById('pImagesPreview');
    if (zone) { zone.classList.add('bq-field-error'); zone.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    return false;
  }
  return true;
}

async function enregistrerProduit() {
  if (!validerFormProduit()) return;

  try {
    // Téléverse uniquement les nouvelles images ; conserve les URL existantes.
    const urls = [];
    for (let i = 0; i < prodImages.length; i++) {
      const im = prodImages[i];
      if (im.file) {
        setNote(`Envoi de l'image ${i + 1}/${prodImages.length}…`);
        urls.push(await uploadImage(im.file, 'products'));
      } else {
        urls.push(im.url);
      }
    }
    setNote('Enregistrement…');

    const product = {
      key: document.getElementById('pKey').value || undefined,
      produit: document.getElementById('pName').value.trim(),
      Prix: document.getElementById('pPrice').value,
      devise: document.getElementById('pDevise').value.trim() || 'FCFA',
      chain: document.getElementById('pChain').value,
      images: urls,          // galerie complète (2 à 5)
      Image: urls[0] || '',  // compat : image principale pour l'ancien affichage
      description: document.getElementById('pDesc').value.trim()
      // `number` n'est plus envoyé : le serveur reprend le téléphone de la boutique.
    };
    await apiPost('shop', { action: 'save-product', product });
    toast('✅ Produit enregistré.');
    fermerFormProduit();
    await chargerStatut();
  } catch (e) {
    setNote('');
    toast('Erreur : ' + (e.message || e));
  }
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
