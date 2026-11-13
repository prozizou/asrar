'use client';
// Signalement d'un compte, d'une publication, d'un message ou d'une
// discussion. Seul l'élément signalé est transmis à l'administration.
import { useState } from 'react';
import { ac } from '@/lib/asrarChat/client';
import { REPORT_REASONS } from '@/lib/asrarChat/logic';
import { useAc } from './context';
import { Sheet } from './ui';

export default function ReportSheet({ target, onClose }: { target: any; onClose: () => void }) {
  const { notify } = useAc();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: any) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await ac('report', { ...target, reason, note });
      notify(r.duplicate ? 'Vous avez déjà signalé cet élément.' : 'Signalement envoyé. L’administration va l’examiner.', 'success');
      onClose();
    } catch (err: any) { notify(err.message, 'error'); }
    finally { setBusy(false); }
  };
  return (
    <Sheet title="Signaler" onClose={onClose}>
      <form className="ac-form" onSubmit={submit}>
        <p className="ac-hint">Seul l’élément signalé est transmis à l’administration, jamais le reste de la discussion.</p>
        <fieldset className="ac-radios">
          <legend>Motif</legend>
          {REPORT_REASONS.map((r) => (
            <label key={r.id}><input type="radio" name="reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} /> {r.label}</label>
          ))}
        </fieldset>
        <label className="ac-field"><span>Précisions (facultatif)</span><textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} /></label>
        <button type="submit" className="ac-btn filled danger" disabled={!reason || busy}>{busy ? 'Envoi…' : 'Envoyer le signalement'}</button>
      </form>
    </Sheet>
  );
}
