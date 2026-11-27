import Link from 'next/link';
import type { Metadata } from 'next';
import PublicShell from './PublicShell';
import { MODULES, PLAY_STORE_URL } from '@/lib/publicPages';

export const metadata: Metadata = {
  title: 'Découvrir ASRAR PRO — spiritualité et sciences traditionnelles',
  description: 'ASRAR PRO réunit une bibliothèque mystique, des secrets et invocations, le Zikr collectif, la géomancie, les carrés numériques, le calcul abjad et les heures planétaires.',
  alternates: { canonical: '/decouvrir' },
};

export default function DecouvrirPage() {
  return (
    <PublicShell>
      <section className="pub-hero">
        <h1>ASRAR PRO</h1>
        <p className="pub-lead">
          L’application de la communauté pour la spiritualité et les sciences traditionnelles : lire, apprendre,
          réciter ensemble et calculer, au même endroit.
        </p>
        <p className="pub-actions">
          <a className="pub-button" href={PLAY_STORE_URL} rel="noopener">Télécharger sur Google Play</a>
          <Link className="pub-button pub-button-ghost" href="/">Se connecter</Link>
        </p>
      </section>

      <section className="pub-text">
        <h2>Pourquoi ASRAR PRO ?</h2>
        <p>
          Une grande partie du savoir spirituel et des sciences traditionnelles d’Afrique de l’Ouest se transmet
          encore oralement, dans des cahiers ou des manuscrits difficiles d’accès. ASRAR PRO rassemble ce patrimoine
          dans une application simple : une bibliothèque de livres et de manuscrits, un recueil classé de secrets et
          d’invocations, et des outils de calcul fidèles aux méthodes traditionnelles.
        </p>
        <p>
          L’application est aussi un lieu de communauté : groupes de Zikr collectif pour réciter ensemble, messagerie,
          réunions en ligne et un Marché où des vendeurs proposent ouvrages, formations et services.
        </p>
      </section>

      <section aria-labelledby="pub-modules-title">
        <h2 id="pub-modules-title">Les modules</h2>
        <ul className="pub-cards">
          {MODULES.map((module) => (
            <li key={module.slug}>
              <Link href={`/decouvrir/${module.slug}`} className="pub-card">
                <span className="pub-card-cat">{module.category}</span>
                <strong>{module.title}</strong>
                <span>{module.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="pub-text">
        <h2>Accès et abonnement</h2>
        <p>
          La connexion se fait avec un compte Google. L’abonnement donne un accès complet, sans publicité ; dans
          l’application Android, les membres non abonnés peuvent aussi débloquer des actions en regardant des vidéos
          récompensées. Sur Android, l’application se télécharge
          gratuitement sur Google Play ; sur iPhone, iPad et ordinateur, ASRAR PRO s’utilise directement depuis ce site.
        </p>
      </section>
    </PublicShell>
  );
}
