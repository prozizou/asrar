'use client';
// Module « Parrainage » — port de parrainage/parrainage.html.
// Points, lien/code de parrainage, statistiques et conversion des points en
// abonnement (via /api/referral). Rendu piloté par l'état React.
import './parrainage.css';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { me, share as shareApp, copy, post } from '@/lib/share';
import { useAccess } from '@/components/AccessProvider';
import Spinner from '@/components/Spinner';

export default function ParrainagePage() {
  const { invalidate } = useAccess();
  const [info, setInfo] = useState(null);
  const [msg, setMsg] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (force) => {
    try {
      const d = await me(!!force);
      setInfo(d);
      setError('');
    } catch (e) {
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
    } catch (e) {
      setMsg('❌ ' + (e.message || e));
      setRedeeming(false);
    }
  };

  const d = info;
  const need = d ? d.pointsForReward : 0;
  const pts = d ? d.points : 0;
  const goalText = !d
    ? error || (
        <>
          <Spinner /> Chargement…
        </>
      )
    : pts >= need
    ? `🎉 Objectif atteint — activez vos ${d.rewardDays} jours !`
    : `${(need - pts).toLocaleString('fr-FR')} points restants sur ${need.toLocaleString('fr-FR')} (soit ${Math.ceil(
        (need - pts) / d.pointsPerInvite
      )} filleul(s))`;

  return (
    <div className="container" style={{ maxWidth: 620 }}>
      <Link href="/" className="back-btn">
        ← Retour
      </Link>

      <div className="glass-panel">
        <div className="pr-hero">
          <div style={{ fontSize: '2.6rem' }}>🎁</div>
          <h1>Parrainage</h1>
          <p>Pas les moyens de vous abonner ? Partagez ASRAR PRO et gagnez votre accès.</p>
        </div>

        {/* Progression */}
        <div className="pr-card">
          <h3>MES POINTS</h3>
          <div className="pr-points">{d ? pts.toLocaleString('fr-FR') : <Spinner size={18} />}</div>
          <div className="pr-bar">
            <span style={{ width: d ? Math.min(100, (pts / need) * 100) + '%' : 0 }} />
          </div>
          <div className="pr-goal">{goalText}</div>
          <button
            className="pr-btn main"
            style={{ marginTop: 14, width: '100%', flex: 'none' }}
            disabled={!d || !d.canRedeem || redeeming}
            onClick={convertir}
          >
            🔓 Activer {d ? d.rewardDays / 30 : 3} mois d'abonnement
          </button>
        </div>

        {/* Lien de parrainage */}
        <div className="pr-card">
          <h3>MON LIEN DE PARRAINAGE</h3>
          <div className="pr-link-row">
            <div className="pr-link">
              {d ? (
                d.link
              ) : (
                <>
                  <Spinner /> Chargement…
                </>
              )}
            </div>
          </div>
          <div style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: '.82rem' }}>
            Mon code : <span className="pr-code">{d ? d.code : '—'}</span>
          </div>
          <div className="pr-actions">
            <button className="pr-btn main" onClick={partagerApp}>
              📤 Partager
            </button>
            <button className="pr-btn" onClick={copierLien}>
              🔗 Copier le lien
            </button>
          </div>
          <p className="pr-msg">{msg}</p>
        </div>

        {/* Statistiques */}
        <div className="pr-card">
          <h3>STATISTIQUES</h3>
          <div className="pr-stats">
            <div className="pr-stat">
              <b>{d ? d.clicks : 0}</b>
              <small>Clics sur mon lien</small>
            </div>
            <div className="pr-stat">
              <b>{d ? d.invited : 0}</b>
              <small>Filleuls inscrits</small>
            </div>
            <div className="pr-stat">
              <b>{d ? d.rewards : 0}</b>
              <small>Abonnements gagnés</small>
            </div>
          </div>
        </div>

        {/* Règles */}
        <div className="pr-card">
          <h3>COMMENT ÇA MARCHE</h3>
          <ul className="pr-rules">
            <li>Partagez votre lien sur WhatsApp, Facebook, TikTok…</li>
            <li>
              <b>{d ? d.pointsPerInvite : 10}</b> points quand une personne <b>crée un compte</b> ASRAR PRO depuis
              votre lien.
            </li>
            <li>
              À <b>{d ? need : 1000}</b> points, activez <b>3 mois d'abonnement</b> gratuit en un clic.
            </li>
            <li>
              Le clic seul ne rapporte rien (il est seulement compté) : c'est l'inscription du filleul qui crédite les
              points.
            </li>
            <li>Un compte ne peut être parrainé qu'une seule fois. L'auto-parrainage n'est pas crédité.</li>
            <li>Tous les liens que vous partagez depuis l'app (secrets, livres, produits) contiennent déjà votre code.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
