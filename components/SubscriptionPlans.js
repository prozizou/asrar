'use client';
import { useId, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, Landmark, LockKeyhole, MessageCircle, Wallet } from 'lucide-react';
import { SUB_PLANS, ADS_PAUSED } from '@/lib/plans';
import { PISPI_ALIAS, subscriptionWaveUrl } from '@/lib/subscriptionPayments';
import { reserveExternalWindow } from '@/lib/externalWindow';
import { openAccess } from '@/lib/whatsapp';
import { useAuth } from './AuthProvider';

export default function SubscriptionPlans() {
  const { user } = useAuth();
  const selectId = useId();
  const [planId, setPlanId] = useState(SUB_PLANS[0].id);
  const [paymentAttempt, setPaymentAttempt] = useState(null);
  const [method, setMethod] = useState('wave');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const opening = useRef(false);
  const aliasInput = useRef(null);
  const [error, setError] = useState('');
  const plan = SUB_PLANS.find((item) => item.id === planId);
  const paidVia = paymentAttempt?.planId === planId ? paymentAttempt.method : undefined;
  const isPiSpi = method === 'pispi';
  const wave = async () => {
    setError('');
    const destination = reserveExternalWindow();
    if (!destination) { setError('Autorisez l’ouverture de Wave dans votre navigateur, puis réessayez.'); return; }
    try {
      await destination.navigate(subscriptionWaveUrl(plan.id));
      setPaymentAttempt({ planId: plan.id, method: 'wave' });
    } catch { destination.close(); setError('Wave n’a pas pu être ouvert. Réessayez ou choisissez WhatsApp.'); }
  };
  const copyAlias = async () => {
    setCopied(false);
    try {
      await navigator.clipboard.writeText(PISPI_ALIAS);
    } catch {
      // Repli pour les WebView Android et navigateurs sans accès au presse-papiers.
      let fallbackCopied = false;
      try {
        aliasInput.current?.focus();
        aliasInput.current?.select();
        fallbackCopied = !!document.execCommand?.('copy');
      } catch {}
      if (!fallbackCopied) {
        setError('Copie indisponible : appuyez longuement sur l’alias pour le copier.');
        return;
      }
    }
    setCopied(true);
    setPaymentAttempt({ planId: plan.id, method: 'pispi' });
  };
  const proceed = async () => {
    if (opening.current) return;
    opening.current = true; setBusy(true); setError('');
    try {
      if (isPiSpi) await copyAlias();
      else if (method === 'wave') await wave();
      else openAccess({ planId: plan.id, email: user?.email, noAds: !ADS_PAUSED, paidVia });
    } catch { setError('Ce moyen de paiement n’a pas pu être ouvert. Réessayez.'); }
    finally { opening.current = false; setBusy(false); }
  };
  return <div className="subscription-simple">
    <label htmlFor={selectId}>Durée et prix</label>
    <div className="subscription-plan-picker">
      <select id={selectId} value={planId} disabled={busy} onChange={(event) => { setPlanId(event.target.value); setPaymentAttempt(null); setCopied(false); setError(''); }}>
        {SUB_PLANS.map((item) => <option key={item.id} value={item.id}>{item.dur} — {item.price} FCFA</option>)}
      </select>
      <ChevronDown size={18} aria-hidden="true" />
    </div>
    <div className="subscription-payment-choices" role="radiogroup" aria-label="Moyen de paiement">
      {[{ id: 'wave', name: 'Wave', Icon: Wallet }, { id: 'pispi', name: 'PI-SPI', Icon: Landmark }, { id: 'whatsapp', name: 'WhatsApp', Icon: MessageCircle }].map(({ id, name, Icon }) => <label key={id} className={`subscription-method subscription-method-${id}`}>
        <input type="radio" name={`${selectId}-method`} value={id} aria-label={name} checked={method === id} disabled={busy} onChange={() => { setMethod(id); setCopied(false); setError(''); }} />
        <span className="subscription-method-icon" aria-hidden="true"><Icon size={24} strokeWidth={1.8} /></span>
        <span className="subscription-method-name">{name}</span>
        {method === id && <span className="subscription-method-check" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>}
      </label>)}
    </div>
    {isPiSpi && <section className="subscription-pispi" aria-label="Paiement par PI-SPI">
      <p className="subscription-pispi-amount">Montant à envoyer <strong>{plan.price} FCFA</strong></p>
      <label htmlFor={`${selectId}-alias`}>Alias du bénéficiaire</label>
      <textarea ref={aliasInput} id={`${selectId}-alias`} value={PISPI_ALIAS} readOnly rows={2} spellCheck={false} autoCapitalize="none" dir="ltr" />
      <p>Dans votre application compatible PI-SPI, choisissez Envoyer, collez cet alias et indiquez le montant. Vérifiez le nom du bénéficiaire avant de confirmer.</p>
    </section>}
    <button type="button" className="subscription-continue" disabled={busy} onClick={proceed}>
      {isPiSpi && <Copy size={17} aria-hidden="true" />}
      {busy ? (isPiSpi ? 'Copie…' : 'Ouverture…') : isPiSpi ? 'Copier l’alias PI-SPI' : `Continuer avec ${method === 'wave' ? 'Wave' : 'WhatsApp'}`}
    </button>
    {isPiSpi && <button type="button" className="subscription-proof" disabled={busy} onClick={() => openAccess({ planId: plan.id, email: user?.email, noAds: !ADS_PAUSED, paidVia: 'pispi' })}>
      <MessageCircle size={17} aria-hidden="true" /> Envoyer le justificatif sur WhatsApp
    </button>}
    <p className="subscription-simple-note" role="status"><LockKeyhole size={13} aria-hidden="true" /><span>{isPiSpi
      ? `${copied ? 'Alias copié. ' : ''}Après le paiement, transmettez votre justificatif. Activation après vérification du paiement reçu.`
      : paidVia === 'wave' ? 'Après votre paiement Wave, choisissez WhatsApp pour envoyer votre reçu. Activation après vérification.'
      : 'Activation après vérification du paiement.'}</span></p>
    {error && <p className="subscription-error" role="alert">{error}</p>}
  </div>;
}
