'use client';
// Module « Formation mystique » — ateliers/formations en direct, chacun avec
// un lien de visioconférence Google Meet. LIEN SIMPLE (choix de l'utilisateur
// lors de la mise en place) : l'admin colle un lien meet.google.com/... créé
// à la main pour chaque session, PAS d'intégration Google Calendar API (pas
// de compte de service Google Cloud à provisionner, mise en place immédiate).
//
// Modèle d'accès (revu — la visioconférence se paie désormais À LA MINUTE,
// INDÉPENDAMMENT de l'abonnement, décision explicite) :
//   • Titre, image, description, attentes, durée, prix par minute : TOUJOURS
//     visibles librement, sans aucune vérification — comme la Bibliothèque
//     (aperçu libre). Pas de gate ensureAccess() ici.
//   • Rejoindre la visioconférence exige un crédit de minutes accordé pour
//     CETTE formation (pages/api/formation-access.js "check"/"join",
//     formation_access/{clé}/{emailKey}) : l'utilisateur choisit ses minutes,
//     voit le prix calculé, réserve via WhatsApp (lib/whatsapp.js
//     openFormationBooking) pour payer, puis l'admin crédite manuellement
//     (admin-asrar-pro). Une fois créditée, "Rejoindre" consomme le crédit et
//     ouvre le lien Meet.
//   • Décompte après avoir rejoint : PUREMENT VISUEL/informatif — Google Meet
//     est un service externe que l'app ne peut pas couper à distance.
import './formation.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiPost } from '@/lib/api';
import { openFormationBooking } from '@/lib/whatsapp';
import { pricePerMinuteOf, formationMinutesPrice } from '@/lib/formation';
import { formatPrice } from '@/lib/market';
import { optimImg } from '@/lib/img';
import SmartImageUntyped from '@/components/SmartImage';
import { useHistoryClose } from '@/components/useHistoryClose';
import ReviewsSection from '@/components/ReviewsSection';

const SmartImage = SmartImageUntyped as any;

const MIN_MINUTES = 1;
const MAX_MINUTES = 180;
const DEFAULT_MINUTES = 10;

interface Formation {
  _key: string;
  titre: string;
  description?: string;
  attentes?: string;
  duree?: string;
  prix?: number;
  pricePerMinute?: number;
  img?: string;
  updatedAt?: number;
  [k: string]: any;
}

function fmtClock(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
}

export default function FormationPage() {
  const [items, setItems] = useState<Formation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState<Formation | null>(null);

  // Crédit de minutes de la formation ouverte : null = vérification en cours,
  // 0 = aucun crédit (afficher le réservateur), >0 = "Rejoindre" disponible.
  const [grantMinutes, setGrantMinutes] = useState<number | null>(null);
  const [minutesWanted, setMinutesWanted] = useState(DEFAULT_MINUTES);
  const [joining, setJoining] = useState(false);

  // Session active après avoir rejoint : décompte visuel uniquement.
  const [session, setSession] = useState<{ total: number; secondsLeft: number } | null>(null);
  const alertedRef = useRef(false);

  const bootRef = useRef(false);
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    (async () => {
      try {
        const { items } = await apiPost('list-content', { kind: 'formation' });
        const list: Formation[] = (items || []).slice().sort(
          (a: Formation, b: Formation) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)
        );
        setItems(list);
      } catch (e: any) {
        setError(e.message || 'Erreur de chargement.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const inDetail = !!current;
  const closeDetail = useCallback(() => setCurrent(null), []);
  // Backpress Android : ferme le détail (pas de vraie navigation de page ici).
  const goBackFromDetail = useHistoryClose(inDetail, closeDetail);

  // À l'ouverture d'une formation : vérifie si un crédit de minutes est déjà
  // accordé pour CET utilisateur sur CETTE formation (lecture seule).
  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    setGrantMinutes(null);
    setMinutesWanted(DEFAULT_MINUTES);
    setSession(null);
    alertedRef.current = false;
    (async () => {
      try {
        const { minutes } = await apiPost('formation-access', { action: 'check', key: current._key });
        if (!cancelled) setGrantMinutes(minutes || 0);
      } catch {
        if (!cancelled) setGrantMinutes(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [current]);

  // Décompte visuel de la session en cours — purement informatif : Google
  // Meet est un service externe, rien ici ne peut réellement couper l'appel.
  useEffect(() => {
    if (!session || session.secondsLeft <= 0) return;
    const t = setInterval(() => {
      setSession((s) => {
        if (!s) return s;
        const secondsLeft = s.secondsLeft - 1;
        return { ...s, secondsLeft: Math.max(0, secondsLeft) };
      });
    }, 1000);
    return () => clearInterval(t);
  }, [session]);

  useEffect(() => {
    if (session && session.secondsLeft === 0 && !alertedRef.current) {
      alertedRef.current = true;
      alert('⏰ Temps écoulé pour votre session « ' + (current?.titre || 'Formation mystique') + ' ». Merci de clôturer la visioconférence.');
    }
  }, [session, current]);

  const joinMeet = async () => {
    if (!current || joining) return;
    setJoining(true);
    try {
      const { meetLink, minutes } = await apiPost('formation-access', { action: 'join', key: current._key });
      const w = window.open(meetLink, '_blank', 'noopener');
      if (!w) window.location.href = meetLink;
      setGrantMinutes(0);
      alertedRef.current = false;
      setSession({ total: minutes, secondsLeft: minutes * 60 });
    } catch (e: any) {
      alert('Erreur : ' + e.message);
      // Le crédit a peut-être déjà été consommé ailleurs (double-clic, autre
      // onglet) : on rafraîchit l'état réel plutôt que de rester bloqué.
      try {
        const { minutes } = await apiPost('formation-access', { action: 'check', key: current._key });
        setGrantMinutes(minutes || 0);
      } catch {}
    } finally {
      setJoining(false);
    }
  };

  const reserveViaWhatsApp = () => {
    if (!current) return;
    const price = formationMinutesPrice(current, minutesWanted);
    openFormationBooking({ formation: current.titre, minutes: minutesWanted, price });
  };

  const stepMinutes = (delta: number) => {
    setMinutesWanted((m) => Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, m + delta)));
  };

  return (
    <div className="container">
      {inDetail ? (
        <>
          <button type="button" className="back-btn fm-back-btn" onClick={goBackFromDetail}>
            ← Retour
          </button>
          <div className="glass-panel fm-detail">
            {current!.img && (
              <div className="fm-detail-cover">
                <SmartImage
                  src={optimImg(current!.img, 700)}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, 600px"
                  style={{ objectFit: 'cover' }}
                />
              </div>
            )}
            <h2>{current!.titre}</h2>
            {(current!.duree || Number(current!.prix) > 0) && (
              <div className="fm-detail-meta">
                {current!.duree && <span>⏱️ {current!.duree}</span>}
                {Number(current!.prix) > 0 && <span>💳 {formatPrice(current!.prix, 'FCFA')}</span>}
              </div>
            )}
            {current!.description && <p className="fm-detail-text">{current!.description}</p>}
            {current!.attentes && (
              <>
                <h3>Ce que ça vous apporte</h3>
                <p className="fm-detail-text">{current!.attentes}</p>
              </>
            )}

            <ReviewsSection cat="formation" itemKey={current!._key} title="Avis sur cette formation" />

            <h3>🎥 Visioconférence</h3>
            {grantMinutes === null ? (
              <p className="fm-detail-text">Vérification de votre accès…</p>
            ) : grantMinutes > 0 ? (
              <div className="fm-join-block">
                <p className="fm-detail-text">
                  Vous avez <b>{grantMinutes} min</b> créditées pour cette formation.
                </p>
                <button type="button" className="fm-join-btn" onClick={joinMeet} disabled={joining}>
                  {joining ? 'Ouverture…' : '🎥 Rejoindre la visioconférence'}
                </button>
              </div>
            ) : (
              <div className="fm-book-block">
                <p className="fm-detail-text">
                  La visioconférence se paie à la minute ({formatPrice(pricePerMinuteOf(current!), 'FCFA')}/min),
                  indépendamment de l'abonnement. Choisissez votre durée, puis réservez via WhatsApp pour activer
                  votre crédit.
                </p>
                <div className="fm-minute-picker">
                  <button type="button" onClick={() => stepMinutes(-1)} aria-label="Moins de minutes">−</button>
                  <input
                    type="number"
                    min={MIN_MINUTES}
                    max={MAX_MINUTES}
                    value={minutesWanted}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setMinutesWanted(Number.isFinite(v) ? Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, v)) : DEFAULT_MINUTES);
                    }}
                  />
                  <button type="button" onClick={() => stepMinutes(1)} aria-label="Plus de minutes">+</button>
                  <span className="fm-minute-unit">min</span>
                </div>
                <div className="fm-book-price">
                  Total : <b>{formatPrice(formationMinutesPrice(current!, minutesWanted), 'FCFA')}</b>
                </div>
                <button type="button" className="fm-join-btn fm-book-btn" onClick={reserveViaWhatsApp}>
                  📲 Réserver via WhatsApp
                </button>
              </div>
            )}

            {session && (
              <div className={'fm-timer' + (session.secondsLeft === 0 ? ' fm-timer-done' : session.secondsLeft <= 60 ? ' fm-timer-warn' : '')}>
                {session.secondsLeft === 0 ? (
                  <span>⏰ Temps écoulé — merci de clôturer votre visioconférence.</span>
                ) : (
                  <span>⏳ Temps restant (indicatif) : {fmtClock(session.secondsLeft)}</span>
                )}
                <button type="button" className="fm-timer-close" onClick={() => setSession(null)} aria-label="Fermer">
                  ✕
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <Link href="/menu" className="back-btn">
            ← Retour
          </Link>
          <div className="glass-panel">
            <h2>🎓 Formation mystique</h2>
            <p className="fm-subtitle">Ateliers et formations en direct, par visioconférence — payée à la minute.</p>
          </div>
          <div className="fm-grid">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="fm-skeleton" />)
            ) : error ? (
              <p className="fm-empty">
                Erreur de chargement.
                <br />
                <small>{error}</small>
              </p>
            ) : items.length === 0 ? (
              <p className="fm-empty">Aucune formation programmée pour l’instant.</p>
            ) : (
              items.map((f) => (
                <div key={f._key} className="fm-card" onClick={() => setCurrent(f)}>
                  <div className="fm-cover">
                    {f.img ? (
                      <SmartImage
                        src={optimImg(f.img, 400)}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 45vw, 260px"
                        style={{ objectFit: 'cover' }}
                      />
                    ) : (
                      '🎓'
                    )}
                  </div>
                  <div className="fm-body">
                    <div className="fm-title">{f.titre}</div>
                    <div className="fm-meta">
                      {f.duree && <span>⏱️ {f.duree}</span>}
                      {Number(f.prix) > 0 && <span>💳 {formatPrice(f.prix, 'FCFA')}</span>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
