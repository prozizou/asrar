'use client';
// Bottom-sheet des commentaires — port du bloc #commentSheet + postComment().
import { useEffect, useRef, useState } from 'react';
import Modal from '@/components/Modal';
import SmartImage from '@/components/SmartImage';

export default function CommentSheet({ open, comments, onClose, onPost }) {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll en bas à chaque nouveau message (façon fil de discussion).
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [comments]);

  useEffect(() => {
    if (open) {
      document.body.classList.add('comment-open');
      inputRef.current?.focus();
    } else {
      document.body.classList.remove('comment-open');
    }
    return () => document.body.classList.remove('comment-open');
  }, [open]);

  const submit = async () => {
    const t = value.trim();
    if (!t || sending) return;
    setSending(true); setError('');
    try {
      if (await onPost(t)) setValue('');
      else setError('Envoi impossible. Votre texte est conservé ; réessayez.');
    } finally { setSending(false); }
  };

  return (
    <Modal open={open} className="asrar-comment-dialog" onClose={sending ? undefined : onClose} label="Commentaires">
      <div className={'comment-sheet' + (open ? ' open' : '')}>
        <div className="comment-sheet-header">
          <strong>Commentaires</strong>
          <button aria-label="Fermer les commentaires" onClick={onClose} disabled={sending} className="close-sheet-btn">
            ✕
          </button>
        </div>
        <div className="comment-list" ref={listRef}>
          {comments.map((c) => (
            <div key={c.id} className="comment-item">
              <div className="comment-avatar">
                {c.photo ? (
                  <SmartImage src={c.photo} alt="" fill sizes="28px" style={{ objectFit: 'cover' }} referrerPolicy="no-referrer" />
                ) : (
                  (c.email || '?').charAt(0).toUpperCase()
                )}
              </div>
              <div className="comment-body">
                <div className="comment-pseudo">{c.email}</div>
                <div className="comment-text">{c.text}</div>
              </div>
            </div>
          ))}
        </div>
        {error && <p role="alert" className="view-feedback view-feedback-error">{error}</p>}
        <div className="comment-input">
          <input
            disabled={sending}
            aria-label="Votre commentaire"
            ref={inputRef}
            type="text"
            placeholder="Votre commentaire..."
            maxLength={500}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && submit()}
          />
          <button type="button" onClick={submit} disabled={sending || !value.trim()}>{sending ? "Envoi…" : "Envoyer"}</button>
        </div>
      </div>
    </Modal>
  );
}
