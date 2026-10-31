'use client';
import { reserveExternalWindow } from '@/lib/externalWindow';
// Module « Bibliothèque Almaqtab » — port de bibliotheque/bibliotheque.html.
// Grille de livres (via /api/list-content kind=book), social (likes +
// commentaires via /api/book-social), ouverture du PDF (paywall), partage,
// deep link.
//
// TypeScript (batch 3/7, cf. tsconfig.json) : Book/SocialStats/Comment sont
// des types locaux reflétant la forme réellement manipulée ici (réponses de
// /api/list-content et /api/book-social, cf. pages/api/book-social.js).
// CommentModal.js, useProgressiveList.js et SmartImage.js restent en .js
// (composants/hooks partagés, hors scope de ce batch) — mêmes principes que
// dans app/menu/page.tsx et app/commandes/page.tsx (#114, #116).
import './bibliotheque.css';
import ViewState from '@/components/ViewState';
import { useToast } from '@/components/useToast';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiPost } from '@/lib/api';
import { useAccess } from '@/components/AccessProvider';
import { useProgressiveList } from '@/components/useProgressiveList';
import { share as shareLink, deepLink, cleanUrl } from '@/lib/share';
import { driveDirectLink } from '@/lib/drive';
import { optimImg } from '@/lib/img';
import SmartImageUntyped from '@/components/SmartImage';
import CommentModal from './CommentModal';
import ModalUntyped from '@/components/Modal';
// Modal.js (non typé) : ses paramètres par défaut `undefined` seraient
// inférés comme seuls types admis.
const Modal = ModalUntyped as any;

const SmartImage = SmartImageUntyped as any;

interface Book {
  _key: string;
  text: string;
  img: string;
  author: string;
  description: string;
  pdf?: string;
  pdfUrl?: string;
  updatedAt?: number;
  [k: string]: any;
}

interface SocialStats {
  likes: number;
  liked: boolean;
  comments: number;
}

interface Comment {
  [k: string]: any;
}

export default function BibliothequePage() {
  const { notify, toast } = useToast();
  // useAccess() vient d'AccessProvider.js (.js, hors scope de ce batch) :
  // son contexte est créé via createContext(null), donc TS l'infère `null`
  // sans cast — la vraie forme documentée ici en local.
  const { ensureAccess, openGate, adFree } = useAccess() as unknown as {
    ensureAccess: (minLevel?: number) => Promise<boolean>;
    openGate: (reason?: string | null) => void;
    adFree: boolean | null;
  };
  // Visiteur avec publicités : le clic ouvre déjà la pub dans un nouvel
  // onglet (ensureAccess → lib/actionAd.ts), et le navigateur n'autorise
  // qu'UN onglet par clic. Le document est donc proposé ensuite via ce
  // bouton « Ouvrir le document » (un second clic, un second onglet).
  const [readyBook, setReadyBook] = useState<{ title: string; link: string } | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [social, setSocial] = useState<Record<string, SocialStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({}); // { [bookKey]: true } — couverture indisponible → repli 📖
  const markImgError = useCallback((key: string) => setImgErrors((prev) => (prev[key] ? prev : { ...prev, [key]: true })), []);

  const [commentBook, setCommentBook] = useState<Book | null>(null); // objet livre ou null
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState('');

  const bootRef = useRef(false);

  const loadSocialCounts = useCallback(async (list: Book[]) => {
    try {
      const keys = list.map((b) => b._key);
      const { stats } = await apiPost('book-social', { action: 'counts', keys });
      setSocial(stats || {});
    } catch {
      /* silencieux */
    }
  }, []);

  const openBook = useCallback(
    async (key: string) => {
      if (adFree === false) {
        const ok = await ensureAccess();
        if (!ok) return;
        try {
          const { item } = await apiPost('get-content', { kind: 'book', key });
          const link = driveDirectLink(item.pdf || item.pdfUrl || '');
          if (!link) { notify('Lien du document indisponible.'); return; }
          setReadyBook({ title: item.text || item.title || item.titre || 'Document', link });
        } catch (e: any) {
          if (e.status === 403) openGate();
          else notify('Erreur : ' + e.message);
        }
        return;
      }
      const destination = reserveExternalWindow();
      if (!destination) {
        notify("Autorisez l'ouverture d'une nouvelle fenêtre, puis réessayez.");
        return;
      }
      try {
        const ok = await ensureAccess();
        if (!ok) { destination.close(); return; }
        const { item } = await apiPost('get-content', { kind: 'book', key });
        const link = driveDirectLink(item.pdf || item.pdfUrl || '');
        if (!link) {
          destination.close();
          notify('Lien du document indisponible.');
          return;
        }
        destination.navigate(link);
      } catch (e: any) {
        destination.close();
        if (e.status === 403) openGate();
        else notify('Erreur : ' + e.message);
      }
    },
    [adFree, ensureAccess, openGate, notify]
  );

  const loadBooks = useCallback(async () => {
    setLoading(true); setError('');
      try {
        const { items } = await apiPost('list-content', { kind: 'book' });
        const list: Book[] = (items || [])
          .map((b: any) => ({
            ...b,
            text: b.text || b.title || b.titre || 'Sans titre',
            img: b.img || b.image || '',
            author: b.author || b.auteur || '',
            description: b.description || b.faida || b.content || '',
          }))
          // Les plus récents en premier (au lieu de l'ordre par défaut de
          // Firebase, chronologique croissant — donc les plus ANCIENS en tête).
          // updatedAt n'existe que pour les livres déjà modifiés via le panneau
          // admin (save-book) : la plupart des ouvrages importés directement
          // dans Firebase n'en ont pas, donc Number(undefined||0) vaut 0 pour
          // TOUS → égalité générale → le tri ne changeait rien en pratique.
          // Repli sur _key (identifiant push Firebase, naturellement
          // chronologique) pour départager, comme déjà fait pour les secrets
          // mystiques (app/asrar/page.tsx).
          .sort((a: Book, b: Book) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0) || (a._key < b._key ? 1 : a._key > b._key ? -1 : 0));
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
          } else notify("Cet ouvrage n'est plus disponible.");
        }
      } catch (e: any) {
        setLoading(false);
        setError(e.message || 'Erreur de chargement.');
      }
  }, [loadSocialCounts, openBook, notify]);
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    void loadBooks();
  }, [loadBooks]);

  const toggleLike = async (key: string) => {
    try {
      const r = await apiPost('book-social', { action: 'like', bookKey: key });
      setSocial((prev) => ({ ...prev, [key]: { ...prev[key], likes: r.likes, liked: r.liked } }));
    } catch (e: any) {
      notify('Erreur : ' + e.message);
    }
  };

  const share = (key: string) => {
    const b = books.find((x) => x._key === key) || ({} as Book);
    const titre = b.text || 'Ouvrage';
    shareLink({ kind: 'book', key, title: titre, text: '📚 ' + titre + ' — Bibliothèque Almaqtab sur ASRAR PRO' });
  };

  const openComments = async (book: Book) => {
    setCommentBook(book);
    setComments([]);
    setCommentsError('');
    setCommentsLoading(true);
    try {
      const r = await apiPost('book-social', { action: 'list', bookKey: book._key });
      setSocial((prev) => ({ ...prev, [book._key]: { ...prev[book._key], likes: r.likes, liked: r.liked, comments: r.comments.length } }));
      setComments(r.comments || []);
    } catch (e: any) {
      setCommentsError(e.message);
    } finally {
      setCommentsLoading(false);
    }
  };

  const submitComment = async (text: string) => {
    if (!commentBook) return false;
    const key = commentBook._key;
    try {
      await apiPost('book-social', { action: 'comment', bookKey: key, text });
    } catch {
      setCommentsError('Le commentaire n’a pas été envoyé. Votre texte est conservé ; réessayez.');
      return false;
    }
    // L’écriture confirmée ne doit pas être répétée si seule la relecture échoue.
    try {
      const r = await apiPost('book-social', { action: 'list', bookKey: key });
      setSocial((prev) => ({ ...prev, [key]: { ...prev[key], comments: r.comments.length } }));
      setComments(r.comments || []);
      setCommentsError('');
    } catch {
      setCommentsError('Commentaire envoyé. Fermez puis rouvrez les commentaires pour actualiser la liste.');
    }
    return true;
  };

  // Rendu progressif : la grille ne monte plus toutes les couvertures d'un bloc.
  const { visible: visibleBooks, sentinelRef, hasMore } = useProgressiveList(books);

  return (
    <div className="container library-page">
      <Link href="/" className="back-btn">
        ← Retour
      </Link>

      <div className="glass-panel">
        <h1 className="module-title">📚 Bibliothèque Almaqtab</h1>
        <p className="subtitle">Manuscrits, traités et ouvrages mystiques.</p>
        <div id="bookCount">{!loading && !error ? `${books.length} livre(s)` : ''}</div>
      </div>

      <div className="book-grid">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" />)
        ) : error ? (
          <ViewState kind="error" title="Bibliothèque indisponible" description="Les ouvrages n’ont pas pu être chargés. Réessayez dans un instant."
            action={<button type="button" className="view-button" onClick={loadBooks}>Réessayer</button>} />
        ) : books.length === 0 ? (
          <ViewState title="Aucun ouvrage disponible" description="Les prochaines publications apparaîtront ici." />
        ) : (
          <>
          {visibleBooks.map((book) => {
            const s = social[book._key] || { likes: 0, liked: false, comments: 0 };
            return (
              <div key={book._key} className={'book-card' + (highlightKey === book._key ? ' book-highlight' : '')} id={'book-' + book._key}>
                <button type="button" className="book-cover" aria-label={"Ouvrir « " + book.text + " »"} onClick={() => openBook(book._key)}>
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
                </button>
                <div className="book-info">
                  <h2 className="sr-only">{book.text}</h2>
                  {book.author && <p className="book-author">{book.author}</p>}
                  <div className="book-social">
                    <button type="button" aria-label={(s.liked ? 'Retirer des favoris : ' : 'Aimer : ') + book.text} aria-pressed={!!s.liked} className={'bs-btn' + (s.liked ? ' liked' : '')} onClick={() => toggleLike(book._key)}>
                      ❤ <span>{s.likes}</span>
                    </button>
                    <button type="button" className="bs-btn" aria-label={"Commentaires de « " + book.text + " »"} onClick={() => openComments(book)}>
                      💬 <span>{s.comments}</span>
                    </button>
                    <button type="button" className="bs-btn" aria-label={"Partager « " + book.text + " »"} title="Partager" onClick={() => share(book._key)}>
                      📤
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {hasMore && <div ref={sentinelRef} className="load-sentinel" aria-hidden />}
          </>
        )}
      </div>

      {toast}
      {readyBook && (
        <Modal className="sg-overlay" onClose={() => setReadyBook(null)} label="Document prêt">
          <div className="sg-box">
            <button type="button" aria-label="Fermer la fenêtre" className="sg-close" onClick={() => setReadyBook(null)}>
              ✕
            </button>
            <div style={{ fontSize: '2.4rem' }}>📖</div>
            <h2>Votre document est prêt</h2>
            <p className="sg-sub" dir="auto">{readyBook.title}</p>
            <a
              className="sg-card best"
              style={{ display: 'block', width: '100%', marginTop: 8, textDecoration: 'none' }}
              href={readyBook.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setReadyBook(null)}
            >
              Ouvrir le document
            </a>
          </div>
        </Modal>
      )}
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
