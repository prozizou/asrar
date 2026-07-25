'use client';
// Coquille applicative partagée : auth + accès + bouton de thème, montés une
// seule fois pour TOUTES les pages (là où l'ancien site rechargeait firebase,
// theme.js, share.js… dans le <head> de chacune des 17 pages).
import AuthProvider from './AuthProvider';
import AccessProvider from './AccessProvider';
import ThemeToggle from './ThemeToggle';

export default function Providers({ children }) {
  return (
    <>
      <AuthProvider>
        <AccessProvider>{children}</AccessProvider>
      </AuthProvider>
      <ThemeToggle />
    </>
  );
}
