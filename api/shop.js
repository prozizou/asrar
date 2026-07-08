// api/shop.js (Vercel) — Gestion de la BOUTIQUE vendeur (un seul endpoint multiplexé).
//
// Body (JSON) : { idToken, action, ... }
//   action="me"            → statut vendeur + fiche boutique + SES produits
//   action="save-shop"     → { shop:{ name, description, phone } }   (vendeur actif)
//   action="save-product"  → { product:{ key?, produit, Prix, devise, Image, description, number, chain } }
//   action="delete-product"→ { key }                                  (propriétaire)
//
// Les produits vivent dans det_produits/{key} (le nœud du Marché). Écriture
// réservée au serveur (Admin SDK) : on impose uid + vendeur + email côté serveur,
// jamais depuis le client. Seul un vendeur ACTIF (abonnement boutique en cours)
// peut écrire/supprimer, et uniquement SES propres produits.

const { verifyUser } = require("./_lib/access");
const { app } = require("./_lib/grant");
const { getSeller, isActiveSeller, getBoutiqueByEmail } = require("./_lib/sellers");
const { setCors, parseBody } = require("./_lib/http");

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Méthode non autorisée" });

  const { idToken, action } = parseBody(req);

  let user;
  try { user = await verifyUser(idToken); }
  catch (e) { return res.status(e.statusCode || 401).json({ error: e.message }); }

  const db = app().database();

  // Deux voies d'autorisation :
  //  (1) vendeur classique  → sellers/{uid} actif
  //  (2) propriétaire de boutique "profil" → profile_clients avec email == user.email
  const seller = await getSeller(user.uid);
  const activeSeller = !!(seller && seller.shopActive &&
    (seller.expiresAt === "lifetime" || (typeof seller.expiresAt === "number" && seller.expiresAt > Date.now())));
  const boutique = activeSeller ? null : await getBoutiqueByEmail(user.email);
  const canManage = activeSeller || !!boutique;

  try {
    if (action === "me") {
      const products = await myProducts(db, user.uid, boutique && boutique._id);
      if (activeSeller) {
        return res.status(200).json({ active: true, seller, products, mode: "seller" });
      }
      if (boutique) {
        // Lie l'uid à la boutique au 1er accès → détection durable ensuite.
        if (!boutique.uid) { try { await db.ref("profile_clients/" + boutique._id + "/uid").set(user.uid); } catch (_) {} }
        const synth = {
          shop: {
            name: boutique.profile_name || "Ma boutique",
            description: boutique.description || "",
            phone: boutique.number || "",
            logo: boutique.img || ""
          },
          expiresAt: "lifetime",
          viaBoutique: true,
          boutiqueId: boutique._id
        };
        return res.status(200).json({ active: true, seller: synth, products, mode: "boutique" });
      }
      return res.status(200).json({ active: false, seller: null, products });
    }

    // — Toutes les actions suivantes exigent un vendeur actif OU un propriétaire de boutique —
    if (!canManage) {
      return res.status(403).json({ error: "Abonnement boutique requis ou expiré." });
    }

    if (action === "save-shop") {
      const { shop, logoUrl } = parseBody(req);
      const clean = {
        name: str(shop && shop.name, 80),
        description: str(shop && shop.description, 600),
        phone: digits(shop && shop.phone, 20)
      };
      if (!clean.name) return res.status(400).json({ error: "Nom de boutique requis." });
      const logo = logoUrl ? str(logoUrl, 500) : "";
      if (activeSeller) {
        const upd = { ...clean };
        if (logo) upd.logo = logo;
        await db.ref("sellers/" + user.uid + "/shop").update(upd);
      } else {
        // Propriétaire de boutique profil : on met à jour profile_clients.
        const upd = { profile_name: clean.name, number: clean.phone, description: clean.description, uid: user.uid };
        if (logo) upd.img = logo;
        await db.ref("profile_clients/" + boutique._id).update(upd);
      }
      return res.status(200).json({ ok: true, shop: { ...clean, logo } });
    }

    if (action === "save-product") {
      const { product } = parseBody(req);
      if (!product) return res.status(400).json({ error: "Produit manquant." });

      const prix = parseInt(product.Prix, 10);
      if (!Number.isFinite(prix) || prix <= 0) return res.status(400).json({ error: "Prix invalide." });
      const nom = str(product.produit, 120);
      if (!nom) return res.status(400).json({ error: "Nom du produit requis." });

      const shopName = activeSeller
        ? ((seller && seller.shop && seller.shop.name) || "Ma boutique")
        : ((boutique && boutique.profile_name) || "Ma boutique");
      const shopLogo = activeSeller
        ? ((seller && seller.shop && seller.shop.logo) || "")
        : ((boutique && boutique.img) || "");

      // Clé existante (édition) si elle nous appartient, sinon nouvelle.
      let key = str(product.key, 64);
      if (key) {
        const cur = (await db.ref("det_produits/" + key).once("value")).val();
        if (!cur) return res.status(404).json({ error: "Produit introuvable." });
        // Accepte aussi les produits hérités (vendeurId) : sinon leur édition
        // était systématiquement refusée.
        if (!estProprietaire(cur, user.uid, boutique && boutique._id)) {
          return res.status(403).json({ error: "Ce produit ne vous appartient pas." });
        }
      } else {
        key = db.ref("det_produits").push().key;
      }

      const record = {
        produit: nom,
        Prix: prix,
        devise: str(product.devise, 8) || "FCFA",
        Image: str(product.Image, 500),
        description: str(product.description, 1000),
        number: digits(product.number, 20),
        chain: str(product.chain, 60),
        email: user.email,           // contact = email du vendeur (jeton vérifié)
        uid: user.uid,               // propriété
        vendeur: shopName,           // nom de la boutique
        vendeurAvatar: shopLogo,     // logo de la boutique (pour le Marché)
        updatedAt: Date.now()
      };
      await db.ref("det_produits/" + key).update(record);
      return res.status(200).json({ ok: true, key, product: { _key: key, ...record } });
    }

    if (action === "delete-product") {
      const { key } = parseBody(req);
      if (!key) return res.status(400).json({ error: "Clé produit requise." });
      const cur = (await db.ref("det_produits/" + key).once("value")).val();
      if (!cur) return res.status(404).json({ error: "Produit introuvable." });
      if (!estProprietaire(cur, user.uid, boutique && boutique._id)) {
        return res.status(403).json({ error: "Ce produit ne vous appartient pas." });
      }
      await db.ref("det_produits/" + key).remove();
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Action inconnue." });
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message });
  }
};

// Récupère les produits du vendeur. Historiquement, l'appartenance a été stockée
// sous plusieurs champs selon l'origine du produit (`uid` pour ceux créés depuis
// « Ma boutique », `vendeurId` pour ceux créés depuis l'administration). On lit
// donc l'ensemble du nœud et on filtre sur tous les identifiants possibles,
// sinon les anciens produits n'apparaissent jamais dans « Mes produits ».
async function myProducts(db, uid, boutiqueId) {
  const snap = await db.ref("det_produits").once("value");
  const out = [];
  snap.forEach((c) => {
    const v = c.val() || {};
    if (estProprietaire(v, uid, boutiqueId)) out.push({ _key: c.key, ...v });
  });
  return out;
}

// Vrai si le produit appartient à l'utilisateur (uid direct, vendeurId hérité,
// ou rattachement à sa boutique profile_clients).
function estProprietaire(prod, uid, boutiqueId) {
  if (!prod) return false;
  if (prod.uid) return prod.uid === uid;
  if (prod.vendeurId) return prod.vendeurId === uid || (boutiqueId && prod.vendeurId === boutiqueId);
  return false;
}

function str(v, max) { return (v == null ? "" : String(v)).trim().slice(0, max || 200); }
function digits(v, max) { return (v == null ? "" : String(v)).replace(/[^\d+]/g, "").slice(0, max || 20); }
