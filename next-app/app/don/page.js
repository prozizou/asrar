'use client';
// Module « Don de secret » — port de don/don.html.
// Formulaire de proposition d'un secret (catégorie / titre / contenu) envoyé à
// /api/don pour vérification par l'administration. Piloté par l'état React,
// plus de manipulation manuelle du DOM.
import './don.css';
import { useState } from 'react';
import Link from 'next/link';
import { apiPost } from '@/lib/api';

const CATS = [
  { value: 'deblocage', label: '🔓 Déblocage' },
  { value: 'domptage', label: '🌀 Domptage' },
  { value: 'ilham', label: '✨ Ilham' },
  { value: 'protection', label: '🛡️ Protection' },
  { value: 'ouverture', label: '🚪 Ouverture' },
];

export default function DonPage() {
  const [cat, setCat] = useState('deblocage');
  const [faida, setFaida] = useState('');
  const [sirr, setSirr] = useState('');
  const [msg, setMsg] = useState({ text: '', kind: '' });
  const [sending, setSending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const t = faida.trim();
    const s = sirr.trim();
    if (t.length < 3) return setMsg({ text: 'Le titre est trop court.', kind: 'err' });
    if (s.length < 10) return setMsg({ text: 'Le contenu est trop court.', kind: 'err' });

    setMsg({ text: '', kind: '' });
    setSending(true);
    try {
      await apiPost('don', { cat, faida: t, sirr: s });
      setFaida('');
      setSirr('');
      setCat('deblocage');
      setMsg({
        text: "✅ Merci ! Votre secret a été envoyé pour vérification par l'administration.",
        kind: 'ok',
      });
    } catch (err) {
      setMsg({ text: '⚠️ ' + (err.message || 'Envoi impossible. Réessayez.'), kind: 'err' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="don-wrap">
      <Link className="back-btn" href="/">
        ← Retour à l'accueil
      </Link>

      <div className="don-head">
        <div className="ic">🤲</div>
        <h1>Don de secret</h1>
        <p>Partagez une connaissance (un secret) avec la communauté ASRAR PRO.</p>
      </div>

      <div className="don-note">
        🔎 Votre proposition est <b>d'abord vérifiée par l'administration</b> avant d'être publiée.
        Elle n'apparaît donc pas immédiatement. Merci pour votre contribution 🌙
      </div>

      <form onSubmit={submit}>
        <div className="don-field">
          <label htmlFor="donCat">Catégorie</label>
          <select id="donCat" value={cat} onChange={(e) => setCat(e.target.value)} required>
            {CATS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="don-field">
          <label htmlFor="donTitre">Titre du secret</label>
          <input
            id="donTitre"
            type="text"
            maxLength={200}
            required
            placeholder="Ex. : Secret pour l'ouverture du cœur"
            value={faida}
            onChange={(e) => setFaida(e.target.value)}
          />
        </div>

        <div className="don-field">
          <label htmlFor="donContenu">Contenu du secret</label>
          <textarea
            id="donContenu"
            maxLength={8000}
            required
            placeholder="Décrivez le secret, la méthode, les versets ou invocations…"
            value={sirr}
            onChange={(e) => setSirr(e.target.value)}
          />
          <div className="hint">Vous pouvez écrire en français et en arabe. Maximum 8000 caractères.</div>
        </div>

        <button type="submit" className="don-submit" disabled={sending}>
          {sending ? 'Envoi…' : '🤲 Proposer ce secret'}
        </button>
        <div className={'don-msg ' + msg.kind}>{msg.text}</div>
      </form>
    </div>
  );
}
