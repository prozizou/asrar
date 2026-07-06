# API ASRAR PRO (fonctions serverless Vercel)

`api/<nom>.js` → `POST /api/<nom>`. Toutes les routes exigent un `idToken` Firebase
valide dans le corps JSON ; l'identité est dérivée du jeton vérifié serveur
(`verifyUser`), jamais du corps. L'activation des abonnements/commandes se fait
**manuellement via WhatsApp** (plus de paiement en ligne).

## Contenu (paywall)
- `POST /api/list-content` `{ idToken, kind, cat? }` — aperçu (champs sensibles retirés). `kind` ∈ `secret|book|product|verset|asma`.
- `POST /api/get-content` `{ idToken, kind, cat?, key }` — contenu complet, réservé aux abonnés actifs (sauf sources `authOnly`).
- `POST /api/get-theme` `{ idToken }` — thème/config publique.

## Social & télémétrie
- `POST /api/book-social` `{ idToken, action, bookKey?, keys?, text? }` — likes & commentaires des livres (`counts|list|like|comment`).
- `POST /api/track` `{ idToken, type, page?, lat?, lng?, city? }` — visites & activité (renvoie toujours 200).

## Boutique / Marché
- `POST /api/shop` `{ idToken, action, ... }` — `me|save-shop|save-product|delete-product`.
- `POST /api/cloudinary-sign` `{ idToken, folder? }` — signature d'upload Cloudinary (secret côté serveur).

## WhatsApp
- `GET|POST /api/wa` — redirection 302 vers le numéro WhatsApp (`WHATSAPP_NUMBER`), message pré-rempli.

## Admin interne
- `POST /api/admin` `{ idToken, action, ... }` — actions d'administration (réservées au super-admin).

> Variables d'environnement requises : voir `.env.example`.
