'use client';
// Coquille applicative partagée : auth + accès, montés une seule fois pour
// TOUTES les pages (là où l'ancien site rechargeait firebase, theme.js,
// share.js… dans le <head> de chacune des 17 pages). Le thème clair/sombre se
// pilote désormais depuis le drawer de l'accueil (components/AppDrawer.js).
import AuthProvider from './AuthProvider';
import AccessProvider from './AccessProvider';
import PendingDeepLink from './PendingDeepLink';
import AdsterraAds from './AdsterraAds';
import ActivityTracker from './ActivityTracker';
import AndroidBackHandler from './AndroidBackHandler';
import SupportProvider from './SupportProvider';

export default function Providers({ children }) {
  return (
    <>
    {/* Hors d'AuthProvider : le bouton retour Android agit aussi sur l'écran de connexion. */}
    <AndroidBackHandler />
    <AuthProvider>
      <ActivityTracker />
      <AccessProvider>
        <SupportProvider>
          <PendingDeepLink />
          {children}
          <AdsterraAds />
        </SupportProvider>
      </AccessProvider>
    </AuthProvider>
    </>
  );
}
