# Numéro WhatsApp → variable d'environnement Vercel

Le numéro WhatsApp n'est plus écrit dans le code. Il est lu **côté serveur** par la
fonction `api/wa.js` depuis la variable d'environnement **`WHATSAPP_NUMBER`**. Il
n'apparaît donc jamais dans les fichiers livrés au navigateur ni dans le dépôt git,
et ne peut pas être modifié côté client : c'est le serveur qui construit le lien.

> Remarque honnête : au moment où l'utilisateur clique, son navigateur arrive
> forcément sur `wa.me/VOTRE-NUMÉRO` (c'est le principe d'un lien de contact
> WhatsApp). Le numéro reste donc visible **à ce moment-là** — c'est normal et
> nécessaire pour vous écrire. Ce qui est protégé : il n'est plus dans votre code,
> ni dans git, et se change en un clic dans Vercel, sans toucher au code.

---

## Marche à suivre (à faire une seule fois)

### 1. Ouvrir les variables d'environnement du projet
1. Aller sur https://vercel.com → votre projet **ASRAR PRO HUB** (`asrar-hub`).
2. Onglet **Settings** → menu de gauche **Environment Variables**.

### 2. Ajouter la variable
- **Key (nom)** : `WHATSAPP_NUMBER`
- **Value (valeur)** : votre numéro au **format international, sans « + » ni espaces**.
  - Exemple Sénégal : `221771234567`
  - (Indicatif pays + numéro, collés. Ex. `+221 77 123 45 67` → `221771234567`.)
- **Environments** : cocher **Production**, **Preview** et **Development** (les trois).
- Cliquer **Save**.

### 3. Redéployer
La variable n'est prise en compte qu'après un nouveau déploiement :
- Onglet **Deployments** → dernier déploiement → menu **⋯** → **Redeploy**.
- (Ou faites un nouveau `git push` / une nouvelle mise en ligne.)

### 4. Tester
- Connectez-vous au site, ouvrez un contenu premium, cliquez sur une formule.
- Un onglet s'ouvre et bascule vers WhatsApp avec votre numéro et le message pré-rempli.
- Si vous voyez le message « Configuration manquante : définissez la variable
  WHATSAPP_NUMBER », c'est que l'étape 2 ou 3 n'est pas terminée.

---

## Changer de numéro plus tard
Modifier la **Value** de `WHATSAPP_NUMBER` dans Vercel (étape 2) puis **Redeploy**
(étape 3). Aucune modification de code n'est nécessaire.

## En local (facultatif)
Pour tester en local avec `vercel dev`, créez un fichier `.env` (NON versionné) :

```
WHATSAPP_NUMBER=221771234567
```

Ajoutez `.env` à votre `.gitignore` pour ne pas le publier.
