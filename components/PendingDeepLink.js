'use client';
// Rejoue le deep link mémorisé avant une installation (« deferred deep link »).
//
// Le problème : un lien partagé /s?k=secret&i=… amène bien sur le bon élément
// TANT QU'ON RESTE dans le navigateur. Mais si le visiteur choisit d'installer
// l'app depuis cette page, l'installation la lance sur `start_url` ("/", cf.
// public/manifest.json) — sans nos paramètres. Le lien partagé se transformait
// donc en simple ouverture de l'accueil, et le destinataire ne voyait jamais
// le contenu pour lequel on lui avait envoyé le lien.
//
// La page /s (pages/api/share.js) mémorise la destination dans localStorage
// juste avant l'installation ; on la rejoue ici au premier lancement.
//
// Deux garde-fous volontaires :
//   • mode autonome UNIQUEMENT (app installée et lancée depuis l'écran
//     d'accueil) — dans un onglet de navigateur, l'utilisateur est déjà là où
//     il a choisi d'aller, l'y déplacer serait une surprise ;
//   • racine sans paramètres UNIQUEMENT — si l'URL porte déjà un deep link,
//     c'est lui qui fait foi.
// Monté dans components/Providers.js SOUS AuthProvider : la redirection n'a
// lieu qu'une fois l'utilisateur connecté, quand la page cible peut
// réellement charger l'élément.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { consumePendingLink } from '@/lib/share';
import { isStandalone } from '@/lib/installPrompt';

export default function PendingDeepLink() {
  const router = useRouter();

  useEffect(() => {
    if (!isStandalone()) return;
    if (window.location.pathname !== '/' || window.location.search) return;

    const path = consumePendingLink();
    if (path && path !== '/') router.replace(path);
  }, [router]);

  return null;
}
