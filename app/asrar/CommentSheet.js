'use client';
// Bottom-sheet des commentaires — port du bloc #commentSheet + postComment().
import { useEffect, useRef, useState } from 'react';

export default function CommentSheet({ open, comments, onClose, onPost }) {
  const [value, setValue] = useState('');
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

  const submit = () => {
    const t = value.trim();
    if (!t) return;
    onPost(t);
    setValue('');
  };

  return (
    <>
      <div className={'overlay' + (open ? ' show' : '')} onClick={onClose} />
      <div className={'comment-sheet' + (open ? ' open' : '')}>
        <div className="comment-sheet-header">
          <strong>Commentaires</strong>
          <button onClick={onClose} className="close-sheet-btn">
            ✕
          </button>
        </div>
        <div className="comment-list" ref={listRef}>
          {comments.map((c) => (
            <div key={c.id} className="comment-item">
              <div className="comment-pseudo">{c.pseudo}</div>
              <div className="comment-text">{c.text}</div>
            </div>
          ))}
        </div>
        <div className="comment-input">
          <input
            ref={inputRef}
            type="text"
            placeholder="Votre commentaire..."
            maxLength={500}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <button onClick={submit}>Envoyer</button>
        </div>
      </div>
    </>
  );
}
