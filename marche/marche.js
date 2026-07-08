// ==================== MARCHÉ MYSTIQUE - LOGIQUE FIREBASE ====================

// État global
let allProducts = [];
let allVendors = [];
let activeFilter = '';
let currentCart = JSON.parse(localStorage.getItem('mysticCart') || '[]');
let currentModalProduct = null;

// Réf. temps réel likes/commentaires du produit affiché (détachées à la fermeture).
let mLikesRef = null, mCommentsRef = null, mCommentsListener = null;

// Fallbacks pour les fonctions externes (main.js)
if (typeof ensureAccess !== 'function') {
  window.ensureAccess = function(cb) { cb(); };
}
if (typeof showSubscriptionGate !== 'function') {
  window.showSubscriptionGate = function() {
    alert("🔒 Contenu réservé aux abonnés. Demandez l'accès à l'administration via WhatsApp.");
  };
}

// ==================== INITIALISATION ====================
requireAuth(() => {
  loadMarketData();
  verifierRetourCommande();
});

async function loadMarketData() {
  try {
    // Métadonnées produits (sans description / number / email vendeur, qui sont payants).
    const { items } = await apiPost('list-content', { kind: 'product' });
    allProducts = (items || []).map(value => ({ _key: value._key, ...value }));
    extractVendors();
    buildVendorSection();
    buildFilters();
    renderProducts(allProducts);
    updateCartCount();
  } catch (e) {
    document.getElementById('prodGrid').innerHTML =
      '<p style="color:#888;grid-column:1/-1;text-align:center;padding:40px;">Erreur de chargement des produits.<br><small>' + e.message + '</small></p>';
  }
}

// ==================== EXTRACTION DES VENDEURS ====================
function extractVendors() {
  const vendorMap = new Map();
  allProducts.forEach(p => {
    const id = p.uid || p.vendeurId || 'inconnu';   // utilise uid ou vendeurId
    if (!vendorMap.has(id)) {
      vendorMap.set(id, {
        id: id,
        name: p.vendeur || 'Vendeur inconnu',
        avatar: p.vendeurAvatar || '',
        location: p.vendeurLocation || '',
        verified: p.vendeurVerifie === true || p.vendeurVerifie === 'true',
        rating: p.vendeurNote || '0.0',
        specialty: p.vendeurSpecialty || 'Produits mystiques',
        bio: p.vendeurBio || ''
      });
    }
  });
  allVendors = Array.from(vendorMap.values());
}

// ==================== SECTION VENDEURS (SCROLL HORIZONTAL) ====================
function buildVendorSection() {
  const scroll = document.getElementById('vendorsScroll');
  if (allVendors.length === 0) {
    document.getElementById('vendorsSection').style.display = 'none';
    return;
  }
  scroll.innerHTML = allVendors.map(v => `
    <div class="vendor-card" onclick="openVendorShop('${v.id}')">
      <div class="vendor-avatar">
        ${v.avatar ? `<img src="${escapeHtml(v.avatar)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.innerHTML='🔮'">` : '🔮'}
      </div>
      <div class="vendor-name">${escapeHtml(v.name)}</div>
      <div class="vendor-specialty">${escapeHtml(v.specialty)}</div>
      <div class="vendor-rating">⭐ ${v.rating}</div>
    </div>
  `).join('');
}

// ==================== FILTRES ====================
function buildFilters() {
  const chains = [...new Set(allProducts.map(p => p.chain).filter(Boolean))].sort();
  const bar = document.getElementById('filtersBar');
  bar.innerHTML = '<div class="filter-tag active" onclick="setFilter(\'\',this)">Tous</div>';
  chains.forEach(chain => {
    const d = document.createElement('div');
    d.className = 'filter-tag';
    d.textContent = chain;
    d.onclick = () => setFilter(chain, d);
    bar.appendChild(d);
  });
}

function setFilter(chain, el) {
  activeFilter = chain;
  document.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  filterProducts();
}

function filterProducts() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  let filtered = allProducts;
  if (activeFilter) filtered = filtered.filter(p => p.chain === activeFilter);
  filtered = filtered.filter(p =>
    (p.produit || '').toLowerCase().includes(q) ||
    (p.chain || '').toLowerCase().includes(q) ||
    (p.description || '').toLowerCase().includes(q) ||
    (p.vendeur || '').toLowerCase().includes(q)
  );
  renderProducts(filtered);
}

// ==================== AFFICHAGE DES PRODUITS ====================
function renderProducts(products) {
  const grid = document.getElementById('prodGrid');
  if (products.length === 0) {
    grid.innerHTML = '<p style="color:#888;grid-column:1/-1;text-align:center;padding:40px;">Aucun produit trouvé.</p>';
    return;
  }
  grid.innerHTML = products.map(p => {
    const vendor = allVendors.find(v => v.id === (p.uid || p.vendeurId));
    return `
      <div class="prod-card" onclick="gatedOpenProduct('${p._key}')">
        ${p.Image ? `<img class="prod-img" src="${escapeHtml(p.Image)}" alt="${escapeHtml(p.produit || '')}" loading="lazy" onerror="this.outerHTML='<div class=prod-img-placeholder>🔮</div>'">` : '<div class="prod-img-placeholder">🔮</div>'}
        <div class="prod-body">
          <div class="prod-name">${escapeHtml(p.produit || 'Produit')}</div>
          <div class="prod-price">${formatPrice(p.Prix, p.devise)}</div>
          <div class="prod-chain">${escapeHtml(p.chain || '')}</div>
          ${vendor ? `
          <div class="prod-vendor-line">
            <img class="prod-vendor-avatar" src="${escapeHtml(vendor.avatar) || '🔮'}" onerror="this.style.display='none'">
            <span>${escapeHtml(vendor.name)} ${vendor.verified ? '<span class="verified-badge">✔ Vérifié</span>' : ''}</span>
          </div>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ==================== BOUTIQUE VENDEUR ====================
function openVendorShop(vendorId) {
  const vendor = allVendors.find(v => v.id === vendorId);
  if (!vendor) return;
  document.getElementById('mainMarketView').style.display = 'none';
  const shopView = document.getElementById('vendorShopView');
  shopView.style.display = 'block';
  const products = allProducts.filter(p => (p.uid || p.vendeurId) === vendorId);
  document.getElementById('vendorShopContent').innerHTML = `
    <div style="margin-bottom:1.5rem; display:flex; gap:1rem; align-items:center;">
      <div style="width:80px;height:80px;border-radius:50%;background:#0A0A0D;display:flex;align-items:center;justify-content:center;font-size:2.5rem;">
        ${vendor.avatar ? `<img src="${escapeHtml(vendor.avatar)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.innerHTML='🔮'">` : '🔮'}
      </div>
      <div>
        <h2 style="margin:0;">${escapeHtml(vendor.name)} ${vendor.verified ? ' <span style="color:#4CAF50;font-size:1rem;">✔ Vérifié</span>' : ''}</h2>
        <p style="color:#888;margin:4px 0;">📍 ${escapeHtml(vendor.location)}</p>
        <p style="color:#C9A961;">⭐ ${vendor.rating} • ${vendor.bio ? escapeHtml(vendor.bio) : 'Spécialiste ésotérique'}</p>
      </div>
    </div>
    <div class="prod-grid">
      ${products.map(p => `
        <div class="prod-card" onclick="gatedOpenProduct('${p._key}')">
          ${p.Image ? `<img class="prod-img" src="${escapeHtml(p.Image)}" alt="${escapeHtml(p.produit || '')}" loading="lazy" onerror="this.outerHTML='<div class=prod-img-placeholder>🔮</div>'">` : '<div class="prod-img-placeholder">🔮</div>'}
          <div class="prod-body">
            <div class="prod-name">${escapeHtml(p.produit || 'Produit')}</div>
            <div class="prod-price">${formatPrice(p.Prix, p.devise)}</div>
          </div>
        </div>`).join('')}
    </div>`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showMainMarket() {
  document.getElementById('vendorShopView').style.display = 'none';
  document.getElementById('mainMarketView').style.display = 'block';
  renderProducts(allProducts);
}

// ==================== DÉTAIL PRODUIT (PAS D'ABONNEMENT — achat = prix produit) ====================
async function gatedOpenProduct(key) {
  const meta = allProducts.find(p => p._key === key);
  if (!meta) return;
  try {
    // Fiche complète (description + contacts vendeur). Auth seule, pas d'abonnement.
    const { item } = await apiPost('get-content', { kind: 'product', key });
    currentModalProduct = { _key: key, ...meta, ...item };
    openModal(currentModalProduct);
  } catch (e) {
    alert('Erreur : ' + (e.message || e));
  }
}

function openModal(product) {
  document.getElementById('m-img').src = product.Image || '';
  document.getElementById('m-img').style.display = product.Image ? '' : 'none';
  document.getElementById('m-name').innerText = product.produit || 'Produit';
  document.getElementById('m-price').innerText = formatPrice(product.Prix, product.devise);
  document.getElementById('m-desc').innerText = product.description || '';

  const vendor = allVendors.find(v => v.id === (product.uid || product.vendeurId));
  const vendorBlock = document.getElementById('m-vendor-block');
  if (vendor) {
    vendorBlock.innerHTML = `
      <img class="vendor-block-avatar" src="${escapeHtml(vendor.avatar) || '🔮'}" onerror="this.style.display='none'">
      <div class="vendor-block-info">
        <div class="vendor-block-name">${escapeHtml(vendor.name)} ${vendor.verified ? '<span class="verified-badge">✔ Vérifié</span>' : ''}</div>
        <div class="vendor-block-loc">📍 ${escapeHtml(vendor.location)}</div>
        <div class="vendor-block-meta">⭐ ${vendor.rating}</div>
      </div>
      <button class="visit-shop-btn" onclick="openVendorShop('${vendor.id}');closeModal();">🏪 Visiter la boutique</button>`;
    vendorBlock.style.display = 'flex';
  } else {
    vendorBlock.style.display = 'none';
  }

  let contactHTML = '';
  if (product.number) {
    const clean = product.number.replace(/\D/g, '');
    contactHTML += `<a href="https://wa.me/${clean}" target="_blank" class="whatsapp-btn">💬 WhatsApp</a>`;
  }
  if (product.email) {
    contactHTML += `<a href="mailto:${product.email}" class="email-btn">📧 Email</a>`;
  }
  document.getElementById('m-contact').innerHTML = contactHTML || '<p style="color:#888;">Aucun contact disponible.</p>';

  loadProductSocial(product._key);

  document.getElementById('prodModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  detachProductSocial();
  document.getElementById('prodModal').classList.remove('open');
  document.body.style.overflow = '';
}

// ==================== LIKES & COMMENTAIRES PRODUIT ====================
// Réutilise les nœuds partagés `ratings/product/{key}` (like = présence de l'uid)
// et `comments/product/{key}` (mêmes règles Firebase que les Secrets Mystiques).

function detachProductSocial() {
  if (mLikesRef) { mLikesRef.off('value'); mLikesRef = null; }
  if (mCommentsRef && mCommentsListener) mCommentsRef.off('child_added', mCommentsListener);
  mCommentsRef = null; mCommentsListener = null;
  const panel = document.getElementById('m-comments-panel');
  if (panel) panel.classList.remove('open');
}

function loadProductSocial(key) {
  detachProductSocial();
  if (!key) return;
  const uid = firebase.auth().currentUser?.uid;
  const list = document.getElementById('m-comment-list');
  if (list) list.innerHTML = '';

  // — Likes (temps réel) —
  mLikesRef = firebase.database().ref(`ratings/product/${key}`);
  mLikesRef.on('value', snap => {
    const likes = snap.val() || {};
    const count = Object.keys(likes).length;
    const liked = uid && likes[uid];
    const icon = document.getElementById('m-like-icon');
    const cnt = document.getElementById('m-like-count');
    const btn = document.getElementById('m-like-btn');
    if (icon) icon.textContent = liked ? '❤️' : '🤍';
    if (cnt) cnt.textContent = count;
    if (btn) btn.classList.toggle('liked', !!liked);
  });

  // — Commentaires (temps réel) —
  mCommentsRef = firebase.database().ref(`comments/product/${key}`);
  mCommentsListener = mCommentsRef.on('child_added', snap => {
    const c = snap.val() || {};
    appendProductComment(c.pseudo, c.text);
  });
  mCommentsRef.once('value').then(snap => {
    const el = document.getElementById('m-comment-count');
    if (el) el.textContent = snap.numChildren();
  });
}

function toggleProductLike() {
  const key = currentModalProduct && currentModalProduct._key;
  const uid = firebase.auth().currentUser?.uid;
  if (!key || !uid) return;
  const ref = firebase.database().ref(`ratings/product/${key}/${uid}`);
  ref.once('value').then(snap => {
    // like = valeur 5 (compatible règle 1–5) ; unlike = suppression.
    if (snap.exists()) ref.remove();
    else ref.set(5);
  });
}

function toggleCommentsPanel() {
  const panel = document.getElementById('m-comments-panel');
  if (panel) panel.classList.toggle('open');
}

function postProductComment() {
  const key = currentModalProduct && currentModalProduct._key;
  const input = document.getElementById('m-comment-input');
  const text = input ? input.value.trim() : '';
  const uid = firebase.auth().currentUser?.uid;
  if (!key || !text || !uid) return;
  const pseudo = '@Client_' + uid.substring(0, 4).toUpperCase();
  firebase.database().ref(`comments/product/${key}`).push({
    uid, pseudo, text,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
  input.value = '';
}

function appendProductComment(pseudo, text) {
  const list = document.getElementById('m-comment-list');
  if (!list) return;
  const div = document.createElement('div');
  div.className = 'm-comment-item';
  div.innerHTML = `<div class="m-comment-pseudo">${escapeHtml(pseudo || '@Client')}</div><div class="m-comment-text">${escapeHtml(text || '')}</div>`;
  list.appendChild(div);
  list.scrollTop = list.scrollHeight;
}

document.getElementById('prodModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ==================== PANIER ====================
function addToCartFromModal() {
  if (!currentModalProduct) return;
  addToCart(currentModalProduct);
  closeModal();
}

function addToCart(product) {
  const item = {
    key: product._key,
    name: product.produit,
    price: parseInt(product.Prix, 10) || 0,
    devise: product.devise || 'FCFA',
    vendorId: product.uid || product.vendeurId,
    vendorName: product.vendeur || 'Vendeur',
    image: product.Image
  };
  const existing = currentCart.find(i => i.key === item.key);
  if (existing) {
    existing.quantity = (existing.quantity || 1) + 1;
  } else {
    item.quantity = 1;
    currentCart.push(item);
  }
  saveCart();
  updateCartCount();
}

function removeFromCart(key) {
  currentCart = currentCart.filter(i => i.key !== key);
  saveCart();
  renderCart();
  updateCartCount();
}

function changeQuantity(key, delta) {
  const item = currentCart.find(i => i.key === key);
  if (!item) return;
  item.quantity = (item.quantity || 1) + delta;
  if (item.quantity <= 0) {
    currentCart = currentCart.filter(i => i.key !== key);
  }
  saveCart();
  renderCart();
  updateCartCount();
}

function saveCart() {
  localStorage.setItem('mysticCart', JSON.stringify(currentCart));
}

function updateCartCount() {
  const el = document.getElementById('cartCount');
  if (!el) return;
  const total = currentCart.reduce((sum, i) => sum + i.quantity, 0);
  el.innerText = total;
}

function openCart() {
  document.getElementById('cartPanel').classList.add('open');
  document.getElementById('cartOverlay').classList.add('show');
  renderCart();
}

function closeCart() {
  document.getElementById('cartPanel').classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('show');
}

function renderCart() {
  const body = document.getElementById('cartBody');
  const totals = document.getElementById('cartTotals');
  if (currentCart.length === 0) {
    body.innerHTML = '<p style="color:#888;text-align:center;">Votre panier est vide.</p>';
    totals.innerHTML = '';
    return;
  }

  const grouped = {};
  currentCart.forEach(item => {
    if (!grouped[item.vendorId]) {
      grouped[item.vendorId] = {
        vendorName: item.vendorName,
        items: [],
        shipping: 0   // livraison désactivée (était fictive) — à réactiver si réelle
      };
    }
    grouped[item.vendorId].items.push(item);
  });

  let bodyHTML = '';
  let grandTotal = 0;
  let totalShipping = 0;

  Object.keys(grouped).forEach(vendorId => {
    const group = grouped[vendorId];
    let subtotal = 0;
    bodyHTML += `<div class="vendor-cart-group">
      <div class="vendor-cart-title">📦 ${escapeHtml(group.vendorName)}</div>`;
    group.items.forEach(item => {
      const itemTotal = item.price * item.quantity;
      subtotal += itemTotal;
      bodyHTML += `<div class="cart-item">
        <span>${escapeHtml(item.name)}</span>
        <div class="cart-item-controls">
          <button onclick="changeQuantity('${item.key}', -1)">−</button>
          <span>${item.quantity}</span>
          <button onclick="changeQuantity('${item.key}', 1)">+</button>
          <span>${itemTotal.toLocaleString()} ${item.devise}</span>
          <button onclick="removeFromCart('${item.key}')" style="background:transparent;">🗑️</button>
        </div>
      </div>`;
    });
    const shipping = 0;   // livraison désactivée (était fictive) — à réactiver si réelle
    bodyHTML += `<div style="font-size:0.8rem;color:#888;">Livraison: ${shipping.toLocaleString()} FCFA</div>`;
    const vendorTotal = subtotal + shipping;
    bodyHTML += `<div style="font-weight:bold;margin-top:4px;">Sous-total: ${vendorTotal.toLocaleString()} FCFA</div></div>`;
    grandTotal += vendorTotal;
    totalShipping += shipping;
  });

  body.innerHTML = bodyHTML;

  totals.innerHTML = `
    <div class="cart-total-row"><span>Total produits</span><span>${(grandTotal - totalShipping).toLocaleString()} FCFA</span></div>
    <div class="cart-total-row"><span>Total livraison</span><span>${totalShipping.toLocaleString()} FCFA</span></div>
    <div class="cart-total-row grand-total"><span>Grand total</span><span>${grandTotal.toLocaleString()} FCFA</span></div>
    <button class="pay-btn" onclick="commanderWhatsApp()">💬 Commander via WhatsApp</button>
  `;
}

// Commande d'un produit : message personnalisé envoyé DIRECTEMENT au propriétaire
// de la boutique (son numéro WhatsApp), pré-rempli avec le modèle demandé.
function commanderProduit() {
  const p = currentModalProduct;
  if (!p) return;
  const number = (p.number || '').replace(/\D/g, '');
  if (!number) { alert("Le numéro WhatsApp de la boutique n'est pas disponible."); return; }
  let email = '';
  try { email = (auth.currentUser && auth.currentUser.email) || ''; } catch (e) {}
  const boutique = p.vendeur || 'la boutique';
  const article = p.produit || 'Article';
  const total = formatPrice(p.Prix, p.devise) || ((p.Prix || '') + ' FCFA');
  const msg =
`Assalamou aleykoum 🌙
Je souhaite passer une commande sur le Marché (${boutique}).

• Compte (e-mail) : ${email}
• Articles :
   - ${article}
• Total : ${total}

Merci de me confirmer la disponibilité et les modalités de paiement.`;
  window.open('https://wa.me/' + number + '?text=' + encodeURIComponent(msg), '_blank');
}

// Envoie la commande (détails du panier) à l'administration via WhatsApp.
// Le règlement et la livraison sont ensuite convenus directement avec l'administration.
function commanderWhatsApp() {
  if (currentCart.length === 0) return;
  if (!window.ASRAR_WA) {
    alert("Contactez l'administration pour finaliser votre commande.");
    return;
  }

  let total = 0;
  const devise = (currentCart[0] && currentCart[0].devise) || 'FCFA';
  const items = currentCart.map(i => {
    const qty = i.quantity || 1;
    total += (Number(i.price) || 0) * qty;
    return { name: i.name, quantity: qty, price: Number(i.price) || 0 };
  });

  let email = '';
  try { email = (auth.currentUser && auth.currentUser.email) || ''; } catch (e) {}

  window.ASRAR_WA.openOrder({ email, items, total, devise });
}

// Compat : nettoie d'anciens paramètres ?token=... d'URL (plus de paiement en ligne).
async function verifierRetourCommande() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('token') || params.has('canceled')) {
    history.replaceState({}, document.title, window.location.pathname);
  }
}

// ==================== UTILITAIRES ====================
function formatPrice(prix, devise) {
  if (!prix) return '';
  const num = parseInt(prix, 10);
  if (isNaN(num)) return prix + ' ' + (devise || '');
  return num.toLocaleString('fr-FR') + ' ' + (devise || 'FCFA');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
