// Police de l'app : Calibri. Absente d'Android/iOS/Linux, on embarque Carlito
// — clone libre MÉTRIQUEMENT COMPATIBLE (mêmes chasses et interlignage) : le
// rendu est identique partout, sans décalage de mise en page entre un poste
// Windows (vraie Calibri, servie en premier par la pile de --font-ui) et un
// téléphone (Carlito). Auto-hébergée via npm plutôt qu'un @import distant :
// Google Fonts ne propose pas Carlito, et une police locale évite une requête
// bloquante de plus au premier rendu. Sous-ensembles latin/latin-ext seuls
// (l'arabe garde ses propres polices — cf. --font-ar).
import '@fontsource/carlito/latin-400.css';
import '@fontsource/carlito/latin-700.css';
import '@fontsource/carlito/latin-ext-400.css';
import '@fontsource/carlito/latin-ext-700.css';
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
  // Next.js n'émet que <meta name="apple-mobile-web-app-capable"> via
  // appleWebApp — désormais dépréciée par Chrome au profit du nom standard
  // mobile-web-app-capable. On garde les deux (Safari lit encore l'ancienne).
  other: {
    'mobile-web-app-capable': 'yes',
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
