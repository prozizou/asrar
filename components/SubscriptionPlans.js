'use client';
import { useState } from 'react';
import { ArrowUpRight, Check, MessageCircle, ShieldCheck, Wallet } from 'lucide-react';
import { SUB_PLANS } from '@/lib/plans';
import { subscriptionWaveUrl } from '@/lib/subscriptionPayments';
import { reserveExternalWindow } from '@/lib/externalWindow';
import { openAccess } from '@/lib/whatsapp';
import { useAuth } from './AuthProvider';

const monthsByPlan = { sub_3m: 3, sub_6m: 6, sub_1y: 12 };
const amount = (value) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);

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
    <ol className="subscription-steps" aria-label="Les étapes de votre abonnement">
      <li><span>1</span> Choisir</li><li><span>2</span> Payer</li><li><span>3</span> Faire vérifier</li>
    </ol>
    <div className="subscription-grid">
      {SUB_PLANS.map((plan) => {
        const months = monthsByPlan[plan.id];
        const saving = SUB_PLANS[0].level * months / monthsByPlan[SUB_PLANS[0].id] - plan.level;
        const chosen = selected?.id === plan.id;
        return <section key={plan.id} className={'subscription-plan' + (plan.best ? ' best' : '') + (chosen ? ' is-selected' : '')} aria-label={`Abonnement ${plan.dur}`}>
          <div className="subscription-plan-heading">
            <h3>{plan.dur}</h3>
            {plan.best && <span className="subscription-badge">Meilleur tarif</span>}
          </div>
          <div className="subscription-pricing">
            <p className="subscription-price">{plan.price} <small>FCFA</small></p>
            <p className="subscription-period">Un paiement pour {months} mois</p>
          </div>
          <p className="subscription-saving">{saving > 0 ? <><Check size={15} aria-hidden="true" /> Économisez {amount(saving)} FCFA*</> : 'La formule pour commencer'}</p>
          <div className="subscription-actions">
            <button type="button" className="subscription-wave" onClick={() => wave(plan)} aria-label={`Payer ${plan.dur} avec Wave`}><Wallet size={18} aria-hidden="true" /><span>Payer avec Wave</span><ArrowUpRight size={17} aria-hidden="true" /></button>
            <button type="button" className="subscription-whatsapp" onClick={() => contact(plan)} aria-label={`Demander ${plan.dur} sur WhatsApp`}><MessageCircle size={17} aria-hidden="true" /> Échanger sur WhatsApp</button>
          </div>
          {chosen && <div className="subscription-confirmation" role="status">
            <strong>Formule choisie : {selected.dur}</strong>
            <p>Après votre paiement Wave, envoyez votre confirmation pour faire activer l’abonnement.</p>
            <button type="button" onClick={() => contact(selected, 'wave')} aria-label="Faire vérifier mon paiement sur WhatsApp"><MessageCircle size={17} aria-hidden="true" /> Faire vérifier mon paiement</button>
          </div>}
        </section>;
      })}
    </div>
    <div className="subscription-assurance"><ShieldCheck size={20} aria-hidden="true" /><p><strong>Activation après vérification</strong><span>L’administration vérifie votre paiement avant d’activer l’abonnement sans publicités.</span></p></div>
    <p className="subscription-footnote">Wave s’ouvre dans l’application ou votre navigateur. <span>* Économies calculées par rapport à la formule de 3 mois sur la même durée.</span></p>
    {error && <p className="subscription-error" role="alert">{error}</p>}
  </div>;
}
