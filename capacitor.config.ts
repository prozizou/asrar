import type { CapacitorConfig } from '@capacitor/cli';

// capacitor.config.ts — Coquille native Android autour d'ASRAR PRO.
//
// PAS de build statique embarqué : server.url pointe vers l'app Next.js déjà
// déployée sur Vercel (SSR + routes /api/* — un export statique casserait
// ces routes). La WebView Capacitor charge donc le site en direct, comme un
// navigateur dédié : chaque mise à jour du site déployé se reflète sans
// nouvelle publication sur le Play Store. Seul ce qui a besoin d'API natives
// (notifications push, canaux Android) passe par du code Capacitor — voir
// lib/fcmNative.js, chargé UNIQUEMENT quand Capacitor.isNativePlatform() est
// vrai (donc jamais exécuté sur le site web normal).
const config: CapacitorConfig = {
  appId: 'com.asrarpro.app',
  appName: 'ASRAR PRO',
  webDir: 'public', // non utilisé pour charger l'app (voir server.url), mais requis par le schéma Capacitor.
  server: {
    url: 'https://www.asrarpro.com',
    // Autorise la connexion en clair UNIQUEMENT en dev local (npx cap run
    // android --livereload) — production reste https strict.
    cleartext: false,
  },
  android: {
    // Couleur de la barre de statut/écran de démarrage — reprend
    // --theme-color de public/manifest.json (identité déjà en place pour la
    // PWA), pour que le lancement natif ne détonne pas visuellement.
    backgroundColor: '#1a1712',
  },
  plugins: {
    PushNotifications: {
      // Les icônes/canaux réels sont créés en JS (lib/fcmNative.js,
      // PushNotifications.createChannel) plutôt qu'ici : on veut pouvoir en
      // ajouter/ajuster sans reconstruire l'app native.
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
