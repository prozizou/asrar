'use client';
// Bandeau « Installer l'application » — proposé à TOUT visiteur qui ouvre
// l'app dans un navigateur sans l'avoir installée, quelle que soit l'URL
// d'entrée (racine partagée à la main, lien /s, deep link…).
//
// Pourquoi ici et pas seulement sur /s : la page de partage (pages/api/share.js)
// ne couvre que les liens produits par les boutons « Partager » de l'app. Le
// lien réellement distribué est le plus souvent la racine du site — qui, elle,
// est l'application et n'offrait aucun moyen visible de l'installer.
//
// Volontairement NON bloquant : components/PwaGate.js garde FORCE_INSTALL à
// false (l'app doit rester consultable dans le navigateur). C'est une
// invitation, pas un péage — d'où la croix de fermeture et la mise en veille.
//
// En flux normal (sticky, pas fixed), même choix que .expiry-banner : le
// bandeau pousse le contenu au lieu de recouvrir l'en-tête d'une page ou un
// bouton d'action situé juste dessous.
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { isStandalone, isIOS, getInstallState, subscribeInstallState, promptInstall } from '@/lib/installPrompt';

const HIDE_KEY = 'asrar_install_hidden';
// Mise en veille plutôt que refus définitif : un visiteur qui ferme le bandeau
// au premier passage peut vouloir installer la semaine suivante. Entre-temps,
// l'entrée « Installer l'application » du menu (components/AppDrawer.js) reste
// disponible à tout moment.
const SNOOZE = 7 * 24 * 60 * 60 * 1000;

export default function InstallBanner() {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState({ canInstall: false, installed: false });
  // Masqué par défaut : rien ne doit apparaître entre le rendu serveur et
  // l'hydratation, sous peine de faire sauter la mise en page au chargement.
  const [dismissed, setDismissed] = useState(true);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    setMounted(true);
    setState(getInstallState());

    let hidden = false;
    try {
      const at = Number(localStorage.getItem(HIDE_KEY) || 0);
      hidden = at > 0 && Date.now() - at < SNOOZE;
    } catch {
      /* stockage indisponible (navigation privée) → on propose quand même */
    }
    setDismissed(hidden);

    return subscribeInstallState(() => setState(getInstallState()));
  }, []);

  if (!mounted || dismissed || state.installed || isStandalone()) return null;

  // iOS/iPadOS n'expose pas `beforeinstallprompt` : seules des instructions
  // manuelles sont possibles (même repli que components/PwaGate.js).
  const ios = isIOS();
  // Ni invite native, ni iOS → navigateur qui ne sait pas installer
  // (Firefox, Safari macOS…) : afficher un bouton sans effet serait pire
  // que ne rien afficher.
  if (!state.canInstall && !ios) return null;

  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem(HIDE_KEY, String(Date.now()));
    } catch {}
  };

  const onInstall = () => {
    if (state.canInstall) promptInstall();
    else setShowSteps((v) => !v);
  };

  return (
    <div className="install-banner" role="complementary" aria-label="Installer l'application">
      <div className="install-banner-row">
        <Image
          className="install-banner-icon"
          src="/assets/icon-192.png"
          alt=""
          width={38}
          height={38}
        />
        <div className="install-banner-text">
          <div className="install-banner-title">ASRAR PRO</div>
          <div className="install-banner-sub">Accès direct depuis votre écran d&apos;accueil</div>
        </div>
        <button type="button" className="install-banner-cta" onClick={onInstall}>
          Installer
        </button>
        <button
          type="button"
          className="install-banner-close"
          onClick={close}
          aria-label="Masquer cette proposition"
        >
          ✕
        </button>
      </div>

      {showSteps && (
        <div className="install-banner-steps">
          <div className="install-step">
            <span className="install-step-num">1</span>
            <span>
              Appuyez sur <b>Partager</b> ⎋ en bas de Safari
            </span>
          </div>
          <div className="install-step">
            <span className="install-step-num">2</span>
            <span>
              Choisissez <b>« Sur l&apos;écran d&apos;accueil »</b> ➕
            </span>
          </div>
          <div className="install-step">
            <span className="install-step-num">3</span>
            <span>
              Ouvrez <b>ASRAR PRO</b> depuis votre écran d&apos;accueil
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
