'use client';
import { useState } from 'react';
import { SUB_PLANS } from '@/lib/plans';
import { subscriptionWaveUrl } from '@/lib/subscriptionPayments';
import { reserveExternalWindow } from '@/lib/externalWindow';
import { openAccess } from '@/lib/whatsapp';
import { useAuth } from './AuthProvider';

export default function SubscriptionPlans() {
  const { user } = useAuth();
  const [selected, setSelected] = useState(null), [error, setError] = useState('');
  const wave = async (plan) => {
    setError('');
    const destination = reserveExternalWindow();
    if (!destination) { setError('Autorisez l’ouverture de Wave dans votre navigateur, puis réessayez.'); return; }
    try {
      await destination.navigate(subscriptionWaveUrl(plan.id));
      setSelected(plan);
    } catch { destination.close(); setError('Wave n’a pas pu être ouvert. Réessayez ou choisissez WhatsApp.'); }
  };
  const contact = (plan, paidVia) => openAccess({ planId: plan.id, email: user?.email, noAds: true, paidVia });
  return <div className="subscription-plans">
    <div className="sg-grid">
      {SUB_PLANS.map((plan) => <section key={plan.id} className={'sg-card subscription-plan' + (plan.best ? ' best' : '')} aria-label={`Abonnement ${plan.dur}`}>
        {plan.badge && <span className="sg-badge">{plan.badge}</span>}
        <h3 className="sg-dur">{plan.dur}</h3>
        <p className="sg-price">{plan.price} <small>FCFA</small></p>
        <button type="button" className="subscription-wave" onClick={() => wave(plan)} aria-label={`Payer ${plan.dur} avec Wave`}>Payer avec Wave</button>
        <button type="button" className="subscription-whatsapp" onClick={() => contact(plan)} aria-label={`Demander ${plan.dur} sur WhatsApp`}>WhatsApp</button>
      </section>)}
    </div>
    <p className="sg-note">Wave s’ouvre dans l’application si elle est disponible, sinon dans le navigateur. L’administration active l’abonnement après vérification du paiement.</p>
    {selected && <div className="subscription-confirmation" role="status">
      <p>Formule choisie : {selected.dur} — {selected.price} FCFA. Après votre paiement Wave, envoyez la confirmation avec votre compte ASRAR.</p>
      <button type="button" onClick={() => contact(selected, 'wave')}>Faire vérifier mon paiement sur WhatsApp</button>
    </div>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
