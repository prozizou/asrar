import './globals.css';
import Providers from '@/components/Providers';
import PwaGate from '@/components/PwaGate';

export const metadata = {
  title: 'ASRAR PRO',
  description: "Les noms d'Allah, numérologie abjad, heures planétaires, géomancie, Rouwhanes et bibliothèque mystique.",
  manifest: '/manifest.json',
  applicationName: 'ASRAR PRO',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ASRAR PRO',
  },
  icons: {
    icon: '/assets/favicon.png',
    apple: '/assets/apple-touch-icon.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1a1712',
};

// Anti-FOUC : pose data-theme sur <html> AVANT le premier rendu (comme le
// faisait theme.js en tête de chaque page).
const themeInit = `(function(){try{var t=localStorage.getItem('asrar_theme')||'dark';document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');document.documentElement.style.colorScheme=t==='light'?'light':'dark';}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <PwaGate>
          <Providers>{children}</Providers>
        </PwaGate>
      </body>
    </html>
  );
}
