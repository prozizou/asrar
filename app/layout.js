import './globals.css';
import Providers from '@/components/Providers';

export const metadata = {
  title: 'ASRAR PRO',
  description: "Les noms d'Allah & géométrie mystique — pilote Next.js",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
