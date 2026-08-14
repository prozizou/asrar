'use client';
// Module « Bibliothèque Almaqtab » — port de bibliotheque/bibliotheque.html.
// Grille de livres (via /api/list-content kind=book), social (likes +
// commentaires via /api/book-social), ouverture du PDF (paywall), partage,
// deep link.
import './bibliotheque.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiPost } from '@/lib/api';
import { useAccess } from '@/components/AccessProvider';
import { share as shareLink, deepLink, cleanUrl } from '@/lib/share';
import { optimImg } from '@/lib/img';
import SmartImage from '@/components/SmartImage';
import CommentModal from './CommentModal';

export default function BibliothequePage() {
  const { ensureAccess, openGate } = useAccess();
  const [books, setBooks] = useState([]);
  const [social, setSocial] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [highlightKey, setHighlightKey] = useState(null);
  const [imgErrors, setImgErrors] = useState({}); // { [bookKey]: true } — couverture indisponible → repli 📖
  const markImgError = useCallback((key) => setImgErrors((prev) => (prev[key] ? prev : { ...prev, [key]: true })), []);

  const [commentBook, setCommentBook] = useState(null); // objet livre ou null
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState('');

  const bootRef = useRef(false);

  const loadSocialCounts = useCallback(async (list) => {
    try {
      const keys = list.map((b) => b._key);
      const { stats } = await apiPost('book-social', { action: 'counts', keys });
      setSocial(stats || {});
    } catch {
      /* silencieux */
    }
  }, []);

  const openBook = useCallback(
    async (key) => {
      const ok = await ensureAccess();
      if (!ok) return;
      try {
        const { item } = await apiPost('get-content', { kind: 'book', key });
        const link = item.pdf || item.pdfUrl || '';
        if (!link) {
          alert('Lien du document indisponible.');
          return;
        }
        const w = window.open(link, '_blank', 'noopener');
        if (!w) window.location.href = link;
      } catch (e) {
        if (e.status === 403) openGate();
        else alert('Erreur : ' + e.message);
      }
    },
    [ensureAccess, openGate]
  );

  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    (async () => {
      try {
        const { items } = await apiPost('list-content', { kind: 'book' });
        const list = (items || []).map((b) => ({
          ...b,
          text: b.text || b.title || b.titre || 'Sans titre',
          img: b.img || b.image || '',
          author: b.author || b.auteur || '',
          description: b.description || b.faida || b.content || '',
        }));
        setBooks(list);
        setLoading(false);
        loadSocialCounts(list);

        const deep = deepLink();
        if (deep && deep.key) {
          cleanUrl();
          if (list.some((b) => b._key === deep.key)) {
            setHighlightKey(deep.key);
            setTimeout(() => {
              document.getElementById('book-' + deep.key)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
            openBook(deep.key);
          } else alert("Cet ouvrage n'est plus disponible.");
        }
      } catch (e) {
        setLoading(false);
        setError(e.message || 'Erreur de chargement.');
      }
    })();
  }, [loadSocialCounts, openBook]);

  const toggleLike = async (key) => {
    try {
      const r = await apiPost('book-social', { action: 'like', bookKey: key });
      setSocial((prev) => ({ ...prev, [key]: { ...prev[key], likes: r.likes, liked: r.liked } }));
    } catch (e) {
      alert('Erreur : ' + e.message);
    }
  };

  const share = (key) => {
    const b = books.find((x) => x._key === key) || {};
    const titre = b.text || 'Ouvrage';
    shareLink({ kind: 'book', key, title: titre, text: '📚 ' + titre + ' — Bibliothèque Almaqtab sur ASRAR PRO' });
  };

  const openComments = async (book) => {
    setCommentBook(book);
    setComments([]);
    setCommentsError('');
    setCommentsLoading(true);
    try {
      const r = await apiPost('book-social', { action: 'list', bookKey: book._key });
      setSocial((prev) => ({ ...prev, [book._key]: { ...prev[book._key], likes: r.likes, liked: r.liked, comments: r.comments.length } }));
      setComments(r.comments || []);
    } catch (e) {
      setCommentsError(e.message);
    } finally {
      setCommentsLoading(false);
    }
  };

  const submitComment = async (text) => {
    if (!commentBook) return;
    const key = commentBook._key;
    try {
      await apiPost('book-social', { action: 'comment', bookKey: key, text });
      const r = await apiPost('book-social', { action: 'list', bookKey: key });
      setSocial((prev) => ({ ...prev, [key]: { ...prev[key], comments: r.comments.length } }));
      setComments(r.comments || []);
    } catch (e) {
      alert('Erreur : ' + e.message);
    }
  };

  return (
    <div className="container">
      <Link href="/" className="back-btn">
        ← Retour
      </Link>

      <div className="glass-panel">
        <h2>📚 Bibliothèque Almaqtab</h2>
        <p className="subtitle">Manuscrits, traités et ouvrages mystiques.</p>
        <div id="bookCount">{!loading && !error ? `${books.length} livre(s)` : ''}</div>
      </div>

      <div className="book-grid">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" />)
        ) : error ? (
          <p className="empty-msg">
            Erreur de chargement.
            <br />
            <small>{error}</small>
          </p>
        ) : books.length === 0 ? (
          <p className="empty-msg">Aucun ouvrage disponible.</p>
        ) : (
          books.map((book) => {
            const s = social[book._key] || { likes: 0, liked: false, comments: 0 };
            return (
              <div key={book._key} className={'book-card' + (highlightKey === book._key ? ' book-highlight' : '')} id={'book-' + book._key}>
                <div className="book-cover" onClick={() => openBook(book._key)}>
                  {book.img && !imgErrors[book._key] ? (
                    <SmartImage
                      src={optimImg(book.img, 300)}
                      alt={book.text}
                      fill
                      sizes="(max-width: 640px) 45vw, 220px"
                      style={{ objectFit: 'cover' }}
                      onError={() => markImgError(book._key)}
                    />
                  ) : (
                    '📖'
                  )}
                </div>
                <div className="book-info">
                  <div className="book-title" onClick={() => openBook(book._key)}>
                    {book.text}
                  </div>
                  {book.author && <div className="book-meta">✍️ {book.author}</div>}
                  <div className="book-social">
                    <button className={'bs-btn' + (s.liked ? ' liked' : '')} onClick={() => toggleLike(book._key)}>
                      ❤ <span>{s.likes}</span>
                    </button>
                    <button className="bs-btn" onClick={() => openComments(book)}>
                      💬 <span>{s.comments}</span>
                    </button>
                    <button className="bs-btn" title="Partager" onClick={() => share(book._key)}>
                      📤
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {commentBook && (
        <CommentModal
          book={commentBook}
          comments={comments}
          loading={commentsLoading}
          error={commentsError}
          onClose={() => setCommentBook(null)}
          onSubmit={submitComment}
        />
      )}
    </div>
  );
}
