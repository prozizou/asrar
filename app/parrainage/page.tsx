'use client';
// Module « Parrainage » — port de parrainage/parrainage.html.
// Points, lien/code de parrainage, statistiques et conversion des points en
// abonnement (via /api/referral). Rendu piloté par l'état React.
//
// TypeScript (batch 2/7, cf. tsconfig.json) : le type ReferralInfo reflète
// le format renvoyé par pages/api/referral.js (action "me") — lib/share.js
// reste en .js (imports non typés, cf. app/menu/page.tsx pour le même choix).
import './parrainage.css';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { me, share as shareApp, copy, post, toast } from '@/lib/share';
import { useAccess } from '@/components/AccessProvider';
import SpinnerUntyped from '@/components/Spinner';
import { Gift, Lock, Copy as CopyIcon, Share2, ChevronRight, PartyPopper } from 'lucide-react';

// Spinner.js reste en .js pour l'instant (composant partagé, hors scope de
// ce batch — cf. tsconfig.json) : sans JSDoc, TS infère depuis son
// destructuring un type de props trop strict (`style` sans valeur par
// défaut devient "requis"). Cast local en `any`, même esprit que l'« any
// implicite » documenté dans app/menu/page.tsx pour UserBar/PlanetHourWidget.
const Spinner = SpinnerUntyped as any;

interface ReferralInfo {
  code: string;
  link: string;
  points: number;
  clicks: number;
  invited: number;
  rewards: number;
  canRedeem: boolean;
  pointsPerInvite: number;
  pointsForReward: number;
  rewardDays: number;
}

export default function ParrainagePage() {
  // useAccess() vient d'AccessProvider.js (.js, hors scope de ce batch) :
  // son contexte est créé via createContext(null), donc TS l'infère `null`
  // sans cast — la vraie forme documentée ici en local.
  const { invalidate } = useAccess() as unknown as { invalidate: () => void };
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [msg, setMsg] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState('');
  const [rulesOpen, setRulesOpen] = useState(false);

  const load = useCallback(async (force?: boolean) => {
    try {
      const d = await me(!!force);
      setInfo(d);
      setError('');
    } catch (e: any) {
      setError('Erreur de chargement : ' + (e.message || e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const partagerApp = () =>
    shareApp({
      title: 'ASRAR PRO',
      text: "Assalamou aleykoum 🌙 Découvre ASRAR PRO : secrets mystiques, bibliothèque Almaqtab, géomancie et noms d'Allah.",
    });

  const copierLien = () => info && copy(info.link);
  const copierCode = () => {
    if (!info) return;
    const code = info.code;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(code)
        .then(() => toast('Code copié : ' + code))
        .catch(() => prompt('Copiez le code :', code));
    } else {
      prompt('Copiez le code :', code);
    }
  };

  const convertir = async () => {
    if (!info) return;
    if (!window.confirm(`Convertir ${info.pointsForReward} points en ${info.rewardDays} jours d'abonnement ?`)) return;
    setRedeeming(true);
    setMsg('Activation en cours…');
    try {
      const r = await post('redeem');
      invalidate(); // équivalent de invalidateAccessCache()
      setMsg('✅ Abonnement activé jusqu\'au ' + new Date(r.expiresAt).toLocaleDateString('fr-FR') + '.');
      load(true);
    } catch (e: any) {
      setMsg('❌ ' + (e.message || e));
      setRedeeming(false);
    }
  };

  const d = info;
  const need = d ? d.pointsForReward : 1000;
  const pts = d ? d.points : 0;
  const reached = !!d && pts >= need;
  const pct = d ? Math.min(100, Math.round((pts / need) * 100)) : 0;
  const rewardMonths = d ? Math.round(d.rewardDays / 30) : 3;

  const subText = !d
    ? error || (
        <>
          <Spinner size={14} /> Chargement…
        </>
      )
    : reached
    ? (
        <>
          <PartyPopper size={15} strokeWidth={2} aria-hidden="true" /> {d.rewardDays} jours d'abonnement débloqués !
        </>
      )
    : `${(need - pts).toLocaleString('fr-FR')} points avant votre récompense (${Math.ceil(
        (need - pts) / d.pointsPerInvite
      )} inscription${Math.ceil((need - pts) / d.pointsPerInvite) > 1 ? 's' : ''})`;

  return (
    <div className="container" style={{ maxWidth: 620 }}>
      <Link href="/" className="back-btn">
        ← Retour
      </Link>

      <div className="glass-panel">
        <div className="pr-hero">
          <div className="pr-hero-icon">
            <Gift size={26} strokeWidth={2} aria-hidden="true" />
          </div>
          <h1>Parrainage</h1>
          <p>Invitez vos proches et gagnez jusqu'à 3 mois d'accès offerts.</p>
        </div>

        {/* Récompenses */}
        <div className="pr-card pr-reward-card">
          <div className="pr-reward-head">
            <h3>Vos récompenses</h3>
            {d && <span className="pr-pct">{pct}%</span>}
          </div>
          <div className="pr-reward-points">
            {d ? (
              <>
                {pts.toLocaleString('fr-FR')} <span className="pr-reward-total">/ {need.toLocaleString('fr-FR')} points</span>
              </>
            ) : (
              <Spinner size={18} />
            )}
          </div>
          <div className="pr-bar">
            <span style={{ width: (d ? pct : 0) + '%' }} />
          </div>
          <div className="pr-goal">{subText}</div>

          {d && reached ? (
            <button className="pr-btn main pr-cta-main" disabled={redeeming} onClick={convertir}>
              <Gift size={18} strokeWidth={2} aria-hidden="true" /> Activer {rewardMonths} mois d'abonnement
            </button>
          ) : (
            <div className="pr-locked-row">
              <Lock size={15} strokeWidth={2} aria-hidden="true" />
              <span>
                {rewardMonths} mois d'abonnement — disponible à {need.toLocaleString('fr-FR')} points
              </span>
            </div>
          )}
        </div>

        {/* Lien de parrainage */}
        <div className="pr-card">
          <h3>Votre lien de parrainage</h3>

          <div className="pr-field">
            <span className="pr-field-value">
              {d ? (
                d.link.replace(/^https?:\/\//, '')
              ) : (
                <>
                  <Spinner size={14} /> Chargement…
                </>
              )}
            </span>
            <button className="pr-copy-btn" onClick={copierLien} disabled={!d}>
              <CopyIcon size={14} strokeWidth={2} aria-hidden="true" /> Copier
            </button>
          </div>

          <div className="pr-field">
            <span className="pr-field-value">
              Code : <span className="pr-code">{d ? d.code : '—'}</span>
            </span>
            <button className="pr-copy-btn" onClick={copierCode} disabled={!d}>
              <CopyIcon size={14} strokeWidth={2} aria-hidden="true" /> Copier
            </button>
          </div>

          <button className="pr-btn main pr-share-btn" onClick={partagerApp}>
            <Share2 size={18} strokeWidth={2} aria-hidden="true" /> Partager mon invitation
          </button>
          <p className="pr-msg">{msg}</p>
        </div>

        {/* Statistiques */}
        <div className="pr-stats-row">
          <div className="pr-stat">
            <b>{d ? d.clicks : 0}</b>
            <small>Clics</small>
          </div>
          <div className="pr-stat">
            <b>{d ? d.invited : 0}</b>
            <small>Inscrits</small>
          </div>
          <div className="pr-stat">
            <b>{d ? d.rewards : 0}</b>
            <small>Récompenses</small>
          </div>
        </div>

        {/* Comment ça marche */}
        <div className="pr-card">
          <h3>Comment ça marche ?</h3>
          <div className="pr-steps">
            <div className="pr-step">
              <span className="pr-step-num">1</span>
              <div>
                <b>Partagez</b>
                <p>Envoyez votre lien à vos proches.</p>
              </div>
            </div>
            <div className="pr-step">
              <span className="pr-step-num">2</span>
              <div>
                <b>Gagnez {d ? d.pointsPerInvite : 10} points</b>
                <p>Lorsqu'une personne crée son compte avec votre lien.</p>
              </div>
            </div>
            <div className="pr-step">
              <span className="pr-step-num">3</span>
              <div>
                <b>Débloquez votre récompense</b>
                <p>
                  À {need.toLocaleString('fr-FR')} points, obtenez {rewardMonths} mois d'abonnement.
                </p>
              </div>
            </div>
          </div>

          <button className="pr-rules-toggle" onClick={() => setRulesOpen((o) => !o)}>
            Voir les conditions du parrainage
            <ChevronRight size={15} strokeWidth={2} className={rulesOpen ? 'pr-chevron open' : 'pr-chevron'} aria-hidden="true" />
          </button>
          {rulesOpen && (
            <ul className="pr-rules">
              <li>Le clic seul ne rapporte rien (il est seulement compté) : c'est l'inscription du filleul qui crédite les points.</li>
              <li>Un compte ne peut être parrainé qu'une seule fois. L'auto-parrainage n'est pas crédité.</li>
              <li>Tous les liens que vous partagez depuis l'app (secrets, livres, produits) contiennent déjà votre code.</li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
