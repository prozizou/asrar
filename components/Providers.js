'use client';
// Coquille applicative partagée : auth + accès, montés une seule fois pour
// TOUTES les pages (là où l'ancien site rechargeait firebase, theme.js,
// share.js… dans le <head> de chacune des 17 pages). Le thème clair/sombre se
// pilote désormais depuis le drawer de l'accueil (components/AppDrawer.js).
import AuthProvider from './AuthProvider';
import AccessProvider from './AccessProvider';
import PushForeground from './PushForeground';

export default function Providers({ children }) {
  return (
    <>
      <AuthProvider>
        <AccessProvider>{children}</AccessProvider>
      </AuthProvider>
      <PushForeground />
    </>
  );
}
