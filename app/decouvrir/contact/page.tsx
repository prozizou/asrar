import type { Metadata } from 'next';
import PublicShell from '../PublicShell';
import { CONTACT } from '@/lib/publicPages';

export const metadata: Metadata = {
  title: 'Contact — ASRAR PRO',
  description: 'Contacter l’équipe ASRAR PRO : questions, abonnement, données personnelles.',
  alternates: { canonical: '/decouvrir/contact' },
};

export default function ContactPage() {
  const phone = CONTACT.phone.replace(/\s/g, '');
  return (
    <PublicShell>
      <article className="pub-text">
        <h1>Nous contacter</h1>
        <p className="pub-lead">Une question sur l’application, un abonnement ou vos données ? Écrivez-nous.</p>
        <ul className="pub-contact">
          <li>E-mail : <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></li>
          <li>Téléphone et WhatsApp : <a href={`tel:${phone}`}>{CONTACT.phone}</a></li>
          <li>Pays : Sénégal</li>
        </ul>
        <p>
          Les membres connectés peuvent aussi joindre le support depuis le menu de l’application. Pour une demande
          concernant vos données personnelles (export, correction, suppression), consultez notre{' '}
          <a href="/confidentialite.html">politique de confidentialité</a>.
        </p>
      </article>
    </PublicShell>
  );
}
