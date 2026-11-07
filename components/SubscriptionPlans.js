'use client';
import { useId, useRef, useState } from 'react';
import { Check, ChevronDown, LockKeyhole, MessageCircle, Wallet } from 'lucide-react';
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
  const [method, setMethod] = useState('wave');
  const [busy, setBusy] = useState(false);
  const opening = useRef(false);
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
  const proceed = async () => {
    if (opening.current) return;
    opening.current = true; setBusy(true); setError('');
    try {
      if (method === 'wave') await wave();
      else openAccess({ planId: plan.id, email: user?.email, noAds: !ADS_PAUSED, paidVia: fromWave ? 'wave' : undefined });
    } catch { setError('Ce moyen de paiement n’a pas pu être ouvert. Réessayez.'); }
    finally { opening.current = false; setBusy(false); }
  };
  return <div className="subscription-simple">
    <label htmlFor={selectId}>Durée et prix</label>
    <div className="subscription-plan-picker">
      <select id={selectId} value={planId} disabled={busy} onChange={(event) => { setPlanId(event.target.value); setWavePlanId(null); setError(''); }}>
        {SUB_PLANS.map((item) => <option key={item.id} value={item.id}>{item.dur} — {item.price} FCFA</option>)}
      </select>
      <ChevronDown size={18} aria-hidden="true" />
    </div>
    <div className="subscription-payment-choices" role="radiogroup" aria-label="Wave ou WhatsApp">
      {[{ id: 'wave', name: 'Wave', Icon: Wallet }, { id: 'whatsapp', name: 'WhatsApp', Icon: MessageCircle }].map(({ id, name, Icon }) => <label key={id} className={`subscription-method subscription-method-${id}`}>
        <input type="radio" name={`${selectId}-method`} value={id} aria-label={name} checked={method === id} disabled={busy} onChange={() => { setMethod(id); setError(''); }} />
        <span className="subscription-method-icon" aria-hidden="true"><Icon size={24} strokeWidth={1.8} /></span>
        <span className="subscription-method-name">{name}</span>
        {method === id && <span className="subscription-method-check" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>}
      </label>)}
    </div>
    <button type="button" className="subscription-continue" disabled={busy} onClick={proceed}>
      {busy ? 'Ouverture…' : `Continuer avec ${method === 'wave' ? 'Wave' : 'WhatsApp'}`}
    </button>
    <p className="subscription-simple-note" role="status"><LockKeyhole size={13} aria-hidden="true" /><span>{fromWave ? 'Après votre paiement Wave, choisissez WhatsApp pour envoyer votre reçu. Activation après vérification.' : 'Activation après vérification du paiement.'}</span></p>
    {error && <p className="subscription-error" role="alert">{error}</p>}
  </div>;
}
