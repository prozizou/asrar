'use client';
import { useId, useState } from 'react';
import { SUB_PLANS, ADS_PAUSED } from '@/lib/plans';
import { subscriptionWaveUrl } from '@/lib/subscriptionPayments';
import { reserveExternalWindow } from '@/lib/externalWindow';
import { openAccess } from '@/lib/whatsapp';
import { useAuth } from './AuthProvider';

export default function SubscriptionPlans() {
  const { user } = useAuth();
  const selectId = useId();
  const [planId, setPlanId] = useState(SUB_PLANS[0].id);
  const [wavePlanId, setWavePlanId] = useState(null);
  const [error, setError] = useState('');
  const plan = SUB_PLANS.find((item) => item.id === planId);
  const fromWave = wavePlanId === planId;
  const wave = async () => {
    setError('');
    const destination = reserveExternalWindow();
    if (!destination) { setError('Autorisez l’ouverture de Wave dans votre navigateur, puis réessayez.'); return; }
    try {
      await destination.navigate(subscriptionWaveUrl(plan.id));
      setWavePlanId(plan.id);
    } catch { destination.close(); setError('Wave n’a pas pu être ouvert. Réessayez ou choisissez WhatsApp.'); }
  };
  return <div className="subscription-simple">
    <label htmlFor={selectId}>Durée et prix</label>
    <select id={selectId} value={planId} onChange={(event) => { setPlanId(event.target.value); setWavePlanId(null); setError(''); }}>
      {SUB_PLANS.map((item) => <option key={item.id} value={item.id}>{item.dur} — {item.price} FCFA</option>)}
    </select>
    <div className="subscription-payment-choices" role="group" aria-label="Wave ou WhatsApp">
      <button type="button" className="subscription-wave" onClick={wave}>Wave</button>
      <button type="button" className="subscription-whatsapp" onClick={() => openAccess({ planId: plan.id, email: user?.email, noAds: !ADS_PAUSED, paidVia: fromWave ? 'wave' : undefined })}>WhatsApp</button>
    </div>
    <p className="subscription-simple-note" role="status">{fromWave ? 'Après votre paiement Wave, envoyez la confirmation sur WhatsApp. Activation après vérification.' : 'L’abonnement sera activé après vérification du paiement.'}</p>
    {error && <p className="subscription-error" role="alert">{error}</p>}
  </div>;
}
