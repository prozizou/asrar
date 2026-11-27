import type { Metadata } from 'next';
import PublicShell from '../PublicShell';

export const metadata: Metadata = {
  title: 'À propos — ASRAR PRO',
  description: 'Qui nous sommes, notre démarche et la façon dont ASRAR PRO est financé.',
  alternates: { canonical: '/decouvrir/a-propos' },
};

export default function AProposPage() {
  return (
    <PublicShell>
      <article className="pub-text">
        <h1>À propos d’ASRAR PRO</h1>
        <p className="pub-lead">Une application née au Sénégal pour préserver et partager un patrimoine spirituel et savant.</p>
        <h2>Notre démarche</h2>
        <p>
          ASRAR PRO est développé au Sénégal. L’idée de départ est simple : rendre accessibles, sur un téléphone, des
          connaissances qui circulaient surtout de maître à élève, dans des cahiers personnels ou des manuscrits
          rares. Nous les organisons, les numérisons et les présentons de façon claire, dans le respect de la tradition.
        </p>
        <p>
          Les outils de calcul (abjad, carrés numériques, géomancie, heures planétaires) appliquent les méthodes
          traditionnelles telles qu’elles sont enseignées. Ils sont proposés comme des supports d’étude : l’application
          ne promet aucun résultat et ne remplace ni un maître ni un avis professionnel.
        </p>
        <h2>Comment l’application est financée</h2>
        <p>
          ASRAR PRO est gratuit au téléchargement. Il est financé par des abonnements, qui donnent accès au contenu
          détaillé et retirent les publicités, et par des publicités affichées aux comptes non abonnés.
        </p>
        <h2>Vos données</h2>
        <p>
          La façon dont nous traitons vos données est décrite dans notre{' '}
          <a href="/confidentialite.html">politique de confidentialité</a>.
        </p>
      </article>
    </PublicShell>
  );
}
