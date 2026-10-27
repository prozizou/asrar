'use client';
// Mise à jour obligatoire des APK trop anciens, côté site.
//
// Les nouvelles versions natives se chargent elles-mêmes de forcer chaque
// mise à jour (MainActivity : écran Play + boîte de dialogue non annulable).
// Les APK déjà installés AVANT ce mécanisme ne le font pas : le site, chargé
// par tous les APK, les bloque ici avec un écran non fermable qui renvoie
// vers le Play Store.
//
// Désactivé tant que NEXT_PUBLIC_MIN_ANDROID_VERSION_CODE n'est pas défini
// (variable Vercel, prise en compte au déploiement suivant). À ne définir
// qu'une fois la version requise DISPONIBLE en production sur le Play Store :
// sinon, l'utilisateur serait renvoyé vers un Play Store sans mise à jour à
// lui proposer, et resterait bloqué.
import Modal from './Modal';
import { useEffect, useState } from 'react';
import { isAndroidVersionOutdated } from '@/lib/nativeVersion';

const MIN_VERSION_CODE = Number(process.env.NEXT_PUBLIC_MIN_ANDROID_VERSION_CODE) || 0;
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.Asrar';

export default function NativeUpdateGate() {
  const [outdated, setOutdated] = useState(false);

  useEffect(() => {
    if (!MIN_VERSION_CODE) return;
    let alive = true;
    (async () => {
      try {
        const { Capacitor, registerPlugin } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
        let versionCode = null;
        if (Capacitor.isPluginAvailable('AsrarNative')) {
          const info = await registerPlugin('AsrarNative').getInfo();
          versionCode = info && info.versionCode;
        }
        if (alive) setOutdated(isAndroidVersionOutdated(versionCode, MIN_VERSION_CODE));
      } catch {
        /* sans information fiable, on ne bloque pas */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!outdated) return null;

  return (
    <Modal className="nug-overlay" role="alertdialog" labelledBy="nug-title">
      <div className="nug-box">
        <div className="nug-icon" aria-hidden="true">⬆️</div>
        <h2 id="nug-title">Mise à jour requise</h2>
        <p>
          Une nouvelle version d&apos;ASRAR PRO est disponible. Mettez l&apos;application à jour depuis le Play Store
          pour continuer à l&apos;utiliser.
        </p>
        <a className="nug-btn" href={PLAY_STORE_URL}>
          Mettre à jour
        </a>
      </div>
    </Modal>
  );
}
