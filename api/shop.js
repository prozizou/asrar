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
const { setCors, parseBody, safeUrl } = require("./_lib/http");

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
      const products = await myProducts(db, user.uid, user.email);
      if (activeSeller) {
        return res.status(200).json({ active: true, seller, products, mode: "seller" });
      }
      if (boutique) {
        // Lie/resynchronise l'uid de la fiche boutique avec le compte réellement
        // connecté (identifié par email). Un uid périmé (compte recréé) laissait
        // la boutique visible mais empêchait de retrouver ses produits.
        if (boutique.uid !== user.uid) {
          try { await db.ref("profile_clients/" + boutique._id + "/uid").set(user.uid); } catch (_) {}
        }
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
      const logo = logoUrl ? safeUrl(logoUrl, 500) : "";
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
      // Le numéro affiché aux acheteurs vient TOUJOURS de la fiche boutique :
      // le vendeur n'a plus à le ressaisir à chaque produit.
      const shopPhone = activeSeller
        ? ((seller && seller.shop && seller.shop.phone) || "")
        : ((boutique && boutique.number) || "");

      // Galerie : 2 images minimum, 5 maximum (contrôle aussi côté serveur).
      // safeUrl() rejette toute URL piégée (quotes, chevrons, javascript:, …) :
      // impossible d'injecter du code via une URL d'image.
      const images = Array.isArray(product.images)
        ? product.images.map((u) => safeUrl(u, 500)).filter(Boolean).slice(0, 5)
        : [];
      if (images.length < 2) {
        return res.status(400).json({ error: "Ajoutez au moins 2 images valides (https) du produit." });
      }
      if (!str(product.description, 1000)) {
        return res.status(400).json({ error: "La description est requise." });
      }
      if (!str(product.chain, 60)) {
        return res.status(400).json({ error: "La catégorie est requise." });
      }

      // Clé existante (édition) si elle nous appartient, sinon nouvelle.
      let key = str(product.key, 64);
      if (key) {
        const cur = (await db.ref("det_produits/" + key).once("value")).val();
        if (!cur) return res.status(404).json({ error: "Produit introuvable." });
        // Accepte aussi les produits hérités (vendeurId) : sinon leur édition
        // était systématiquement refusée.
        if (!estProprietaire(cur, user.uid, user.email)) {
          return res.status(403).json({ error: "Ce produit ne vous appartient pas." });
        }
      } else {
        key = db.ref("det_produits").push().key;
      }

      const record = {
        produit: nom,
        Prix: prix,
        devise: str(product.devise, 8) || "FCFA",
        images: images,              // galerie (2 à 5)
        Image: images[0],            // compat : image principale
        description: str(product.description, 1000),
        number: digits(shopPhone, 20),   // téléphone repris de la fiche boutique
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
      if (!estProprietaire(cur, user.uid, user.email)) {
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

// Récupère les produits du vendeur.
// On ne peut pas se fier au seul `uid` : le `uid` enregistré dans la fiche
// boutique (profile_clients) peut différer de celui porté par les produits
// (comptes recréés, migrations). L'email, lui, est stable et provient du jeton
// Firebase vérifié côté serveur — c'est donc le critère principal.
async function myProducts(db, uid, email) {
  const snap = await db.ref("det_produits").once("value");
  const out = [];
  snap.forEach((c) => {
    const v = c.val() || {};
    if (estProprietaire(v, uid, email)) out.push({ _key: c.key, ...v });
  });
  return out;
}

// Vrai si le produit appartient à l'utilisateur : correspondance sur l'uid
// courant OU sur l'email vérifié (identifiant stable dans le temps).
function estProprietaire(prod, uid, email) {
  if (!prod) return false;
  const mailProd = typeof prod.email === "string" ? prod.email.toLowerCase() : "";
  const mailUser = typeof email === "string" ? email.toLowerCase() : "";
  if (mailProd && mailUser && mailProd === mailUser) return true;
  if (prod.uid && uid && prod.uid === uid) return true;
  if (prod.vendeurId && uid && prod.vendeurId === uid) return true;   // ancien format
  return false;
}

function str(v, max) { return (v == null ? "" : String(v)).trim().slice(0, max || 200); }
function digits(v, max) { return (v == null ? "" : String(v)).replace(/[^\d+]/g, "").slice(0, max || 20); }
