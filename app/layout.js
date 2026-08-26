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
import { normalizeSiteUrl } from '@/lib/site';
import Providers from '@/components/Providers';
import PwaGate from '@/components/PwaGate';
import CosmicBackground from '@/components/CosmicBackground';
import InstallBanner from '@/components/InstallBanner';

// Site public — sert de base aux URLs ABSOLUES des balises Open Graph
// ci-dessous (metadataBase) : sans ça, Next.js émettrait og:image en chemin
// relatif ("/assets/og-banner.jpg"), invisible pour WhatsApp/Facebook/X, qui
// ne résolvent jamais une image relative au domaine courant du crawler.
// Même variable, même repli que server/http.js (CORS) et pages/api/share.js.
const SITE_URL = normalizeSiteUrl(process.env.SITE_URL, 'https://www.asrarpro.com');

const TITLE = 'ASRAR PRO';
const DESCRIPTION =
  "Les noms d'Allah, numérologie abjad, heures planétaires, géomancie, Rouwhanes et bibliothèque mystique.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  manifest: '/manifest.json',
  applicationName: TITLE,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: TITLE,
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
  // Carte de partage (WhatsApp/Facebook/Telegram/LinkedIn/Discord…) pour le
  // lien RACINE de l'app — celui réellement distribué, par opposition aux
  // liens /s?k=…&i=… (secret/livre/produit précis), qui ont déjà leur propre
  // aperçu généré à la volée avec la vignette de l'élément (pages/api/share.js).
  // public/assets/og-banner.jpg : logo + nom + accroche + repère visuel
  // « Installer l'application » sur le fond cosmique de la charte actuelle —
  // un aperçu statique ne peut PAS porter de bouton cliquable (aucun réseau
  // social n'exécute de JS dans la vignette) ; le vrai bouton d'installation
  // apparaît une fois le lien ouvert (components/InstallBanner.js, monté sur
  // tout le site). 1200×630 : ratio 1.91:1 attendu par ces plateformes pour
  // un rendu « grande image », pas recadré en vignette carrée.
  openGraph: {
    type: 'website',
    siteName: TITLE,
    title: TITLE + ' — Sciences mystiques',
    description: DESCRIPTION,
    url: '/',
    locale: 'fr_FR',
    images: [{ url: '/assets/og-banner.jpg', width: 1200, height: 630, alt: TITLE + ' — Application mystique' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE + ' — Sciences mystiques',
    description: DESCRIPTION,
    images: ['/assets/og-banner.jpg'],
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
        <CosmicBackground />
        {/* Hors de PwaGate/Providers : la proposition d'installation doit
            aussi s'afficher AVANT connexion, pour un visiteur qui arrive
            sur un lien partagé et n'a pas encore de compte. */}
        <InstallBanner />
        <PwaGate>
          <Providers>{children}</Providers>
        </PwaGate>
      </body>
    </html>
  );
}
