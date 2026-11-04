'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, MessageCircle, ShieldCheck, Wallet } from 'lucide-react';
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
  const [active, setActive] = useState(0);
  const track = useRef(null);
  const navigation = useRef(null);
  const carouselId = useId();
  useEffect(() => {
    const node = track.current;
    let frame;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!node.clientWidth) return;
        const center = node.getBoundingClientRect().left + node.clientWidth / 2;
        const distances = [...node.children].map((card) => {
          const bounds = card.getBoundingClientRect();
          return Math.abs(bounds.left + bounds.width / 2 - center);
        });
        setActive(distances.indexOf(Math.min(...distances)));
      });
    };
    node.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => { navigation.current?.(); node.removeEventListener('scroll', update); observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);
  const goTo = (index) => {
    const node = track.current, card = node?.children[index];
    if (!card) return;
    navigation.current?.();
    const left = node.scrollLeft + card.getBoundingClientRect().left - node.getBoundingClientRect().left - (node.clientWidth - card.offsetWidth) / 2;
    const target = Math.max(0, Math.min(left, node.scrollWidth - node.clientWidth));
    // Le snap d'un balayage peut sinon annuler la navigation demandée par un bouton.
    node.style.scrollSnapType = 'none';
    node.scrollTo({ left: node.scrollLeft, behavior: 'instant' });
    let frame;
    const deadline = performance.now() + 2000;
    const finish = () => {
      cancelAnimationFrame(frame);
      node.style.removeProperty('scroll-snap-type');
      node.removeEventListener('pointerdown', finish);
      navigation.current = null;
    };
    const settle = () => {
      if (Math.abs(node.scrollLeft - target) < 1 || performance.now() >= deadline) finish();
      else frame = requestAnimationFrame(settle);
    };
    navigation.current = finish;
    node.addEventListener('pointerdown', finish, { once: true });
    node.scrollTo({ left: target, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    frame = requestAnimationFrame(settle);
  };
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
    <div className="subscription-carousel-heading">
      <span>Choisissez votre formule</span>
      <span className="subscription-carousel-count" aria-live="polite" aria-atomic="true">{active + 1} / {SUB_PLANS.length} · {SUB_PLANS[active].dur}</span>
    </div>
    <div ref={track} id={carouselId} className="subscription-carousel" role="region" aria-roledescription="carrousel" aria-label="Formules d’abonnement" tabIndex={0}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        const index = { ArrowLeft: Math.max(0, active - 1), ArrowRight: Math.min(SUB_PLANS.length - 1, active + 1), Home: 0, End: SUB_PLANS.length - 1 }[event.key];
        if (index !== undefined) { event.preventDefault(); goTo(index); }
      }}>
      {SUB_PLANS.map((plan, index) => {
        const months = monthsByPlan[plan.id];
        const saving = SUB_PLANS[0].level * months / monthsByPlan[SUB_PLANS[0].id] - plan.level;
        const chosen = selected?.id === plan.id;
        return <section key={plan.id} className={'subscription-plan' + (plan.best ? ' best' : '') + (chosen ? ' is-selected' : '') + (active === index ? ' is-active' : '')} role="group" aria-roledescription="diapositive" aria-label={`Abonnement ${plan.dur}`}>
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
    <div className="subscription-carousel-controls">
      <button type="button" className="subscription-carousel-arrow" aria-label="Formule précédente" aria-controls={carouselId} disabled={active === 0} onClick={() => goTo(active - 1)}><ChevronLeft size={20} aria-hidden="true" /></button>
      <div className="subscription-carousel-dots" role="group" aria-label="Choisir une formule">
        {SUB_PLANS.map((plan, index) => <button key={plan.id} type="button" aria-label={`Voir la formule ${plan.dur}`} aria-controls={carouselId} aria-pressed={active === index} onClick={() => goTo(index)}><span /></button>)}
      </div>
      <button type="button" className="subscription-carousel-arrow" aria-label="Formule suivante" aria-controls={carouselId} disabled={active === SUB_PLANS.length - 1} onClick={() => goTo(active + 1)}><ChevronRight size={20} aria-hidden="true" /></button>
    </div>
    <p className="subscription-carousel-hint">Faites glisser pour comparer les formules</p>
    <div className="subscription-assurance"><ShieldCheck size={20} aria-hidden="true" /><p><strong>Activation après vérification</strong><span>L’administration vérifie votre paiement avant d’activer l’abonnement sans publicités.</span></p></div>
    <p className="subscription-footnote">Wave s’ouvre dans l’application ou votre navigateur. <span>* Économies calculées par rapport à la formule de 3 mois sur la même durée.</span></p>
    {error && <p className="subscription-error" role="alert">{error}</p>}
  </div>;
}
