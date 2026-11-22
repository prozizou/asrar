'use client';
// components/ReportProblem.js — Fenêtre « Signaler un problème » : l'utilisateur
// décrit ce qui ne marche pas ; le texte part à l'administration (onglet
// « Bugs ») avec, s'il l'accepte, quelques informations techniques (taille
// d'écran, derniers problèmes détectés automatiquement). Ouverte depuis le
// menu (AppDrawer) et depuis l'écran d'erreur (app/error.js).
import { useId, useState } from 'react';
import { Bug, Check, X } from 'lucide-react';
import Modal from './Modal';
import { sendUserReport } from '@/lib/bugReporter';

const MAX = 800;

export default function ReportProblem({ onClose, initialText = '' }) {
  const id = useId();
  const [text, setText] = useState(initialText);
  const [withContext, setWithContext] = useState(true);
  const [state, setState] = useState('idle'); // idle | sending | sent | error

  const submit = async (event) => {
    event.preventDefault();
    if (!text.trim() || state === 'sending') return;
    setState('sending');
    setState((await sendUserReport(text, { withContext })) ? 'sent' : 'error');
  };

  return (
    <Modal className="sg-overlay" onClose={onClose} labelledBy={id + '-title'}>
      <div className="sg-box report-box">
        <button type="button" className="sg-close" aria-label="Fermer" onClick={onClose}>
          <X size={20} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <div className="sg-hero-icon"><Bug size={36} strokeWidth={1.7} aria-hidden="true" /></div>
        <h2 id={id + '-title'}>Signaler un problème</h2>
        {state === 'sent' ? (
          <>
            <p className="sg-sub" role="status"><Check size={16} aria-hidden="true" /> Merci ! Votre signalement a été transmis à l’équipe ASRAR PRO.</p>
            <div className="report-actions"><button type="button" onClick={onClose}>Fermer</button></div>
          </>
        ) : (
          <form onSubmit={submit}>
            <p className="sg-sub">Un bug, un écran qui ne répond pas, une lenteur ? Décrivez ce que vous faisiez et ce qui s’est passé.</p>
            <label className="sr-only" htmlFor={id + '-text'}>Description du problème</label>
            <textarea id={id + '-text'} className="report-text" rows={5} maxLength={MAX} required value={text}
              placeholder="Ex. : dans Zikr collectif, le compteur reste bloqué après avoir appuyé sur Participer."
              onChange={(e) => setText(e.target.value)} />
            <div className="report-meta"><span>{text.length} / {MAX}</span></div>
            <label className="report-check">
              <input type="checkbox" checked={withContext} onChange={(e) => setWithContext(e.target.checked)} />
              <span>Joindre les informations techniques (page, appareil, version, derniers problèmes détectés)</span>
            </label>
            {state === 'error' && <p className="subscription-error" role="alert">L’envoi a échoué. Vérifiez votre connexion et réessayez.</p>}
            <div className="report-actions">
              <button type="submit" disabled={!text.trim() || state === 'sending'}>{state === 'sending' ? 'Envoi…' : 'Envoyer'}</button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
