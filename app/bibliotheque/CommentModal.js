'use client';
// Modale commentaires d'un livre — port du bloc #commentModal + openComments/
// renderComments/submitComment de bibliotheque.html.
import { useEffect, useState } from 'react';

function fmtDate(t) {
  return t ? new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
}

export default function CommentModal({ book, comments, loading, error, onClose, onSubmit }) {
  const [text, setText] = useState('');

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSubmit(t);
    setText('');
  };

  return (
    <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <span className="modal-close" onClick={onClose}>
          ✕
        </span>
        <h3>Commentaires — {book.text}</h3>
        <div className="cm-list">
          {loading ? (
            <p className="cm-empty">Chargement…</p>
          ) : error ? (
            <p className="cm-empty">Erreur : {error}</p>
          ) : comments.length === 0 ? (
            <p className="cm-empty">Aucun commentaire. Soyez le premier !</p>
          ) : (
            comments.map((c, i) => (
              <div key={i} className="cm-item">
                <div className="cm-head">
                  <b>{c.name}</b> <span className="cm-date">{fmtDate(c.at)}</span>
                </div>
                <div className="cm-text">{c.text}</div>
              </div>
            ))
          )}
        </div>
        <div className="cm-form">
          <textarea
            maxLength={500}
            rows={2}
            placeholder="Écrire un commentaire…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="cm-send" onClick={send}>
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
