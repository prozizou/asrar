'use client';
import { useState } from 'react';
import ModalUntyped from '@/components/Modal';
const Modal = ModalUntyped as any;
import { warnMember } from '@/lib/zikrCollectif';
import { zikrWarningMessage, ZIKR_WARNING_MAX } from '@/lib/zikrWarning';

type Participant = { uid: string; name?: string; email: string; phone?: string; fait: number };
type WarningGroup = { name: string; arabic: string; transliteration: string; target: number; total: number };

export default function ParticipantWarning({ groupId, group, member, onClose, onSaved }: {
  groupId: string; group: WarningGroup; member: Participant; onClose: () => void; onSaved: () => void;
}) {
  const [text, setText] = useState(() => zikrWarningMessage(group, member));
  const [saved, setSaved] = useState('');
  const [deadline, setDeadline] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const close = () => { if (!busy) onClose(); };
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (busy || !text.trim()) return;
    setBusy(true); setError('');
    try {
      const result = await warnMember(groupId, member.uid, text);
      setSaved(text); setDeadline(result.warning.deadline); onSaved();
    } catch (cause: any) { setError(cause.message || 'Avertissement indisponible. Réessayez.'); }
    finally { setBusy(false); }
  }
  const whatsapp = member.phone && saved === text && saved.trim()
    ? 'https://wa.me/' + member.phone.replace(/\D/g, '') + '?text=' + encodeURIComponent(saved) : '';
  return <Modal className="zk-warning-dialog" label="Message et avertissement" onClose={close}>
    <form className="zk-warning-editor" onSubmit={save}>
      <header><h2>Message et avertissement</h2><button type="button" className="zk-icon-btn" aria-label="Fermer" disabled={busy} onClick={close}>×</button></header>
      <p>{member.name || member.email}</p>
      <label htmlFor="zk-personal-warning">Message personnalisé</label>
      <textarea id="zk-personal-warning" value={text} onChange={(event) => setText(event.target.value)} maxLength={ZIKR_WARNING_MAX} rows={12} />
      <p className="zk-muted">L’avertissement sera visible dans l’application. Sans nouvelle récitation enregistrée sous 7 jours, le membre sera retiré de ce groupe. Un avertissement répété ne repousse pas l’échéance.</p>
      {error && <p role="alert" className="view-feedback view-feedback-error">{error}</p>}
      {saved && <p role="status">Avertissement enregistré. Échéance : {new Date(deadline).toLocaleString('fr-FR')}. Le message reste à envoyer dans WhatsApp.</p>}
      <div className="zk-warning-actions">
        <button type="submit" className="view-button" disabled={busy || !text.trim()}>{busy ? 'Enregistrement…' : 'Enregistrer l’avertissement'}</button>
        {whatsapp && <a className="view-button view-button-secondary" href={whatsapp} target="_blank" rel="noopener noreferrer">Ouvrir WhatsApp</a>}
      </div>
      {!member.phone && <p className="zk-muted">Pas de numéro WhatsApp enregistré : le membre recevra l’avertissement dans l’application.</p>}
    </form>
  </Modal>;
}
