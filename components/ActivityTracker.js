'use client';
// components/ActivityTracker.js — Journal d'activité envoyé à l'administration.
//
// Pour chaque utilisateur connecté : chaque page ouverte (changement de route)
// et chaque action (bouton, lien, onglet touché) est mise en file, puis
// envoyée par lots à /api/track (type « actions ») — toutes les 10 s, dès
// 20 actions en attente, et quand l'application passe en arrière-plan. Le
// serveur y ajoute l'e-mail, le pays et l'heure (pages/api/track.js).
// La connexion elle-même (type « visit ») reste envoyée par AuthProvider.
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { useAuth } from './AuthProvider';

const FLUSH_MS = 10_000;
const BATCH_MAX = 20;
const QUEUE_MAX = 200;
const LABEL_MAX = 60;

const CLICKABLE = 'button, a, [role="button"], [role="tab"], [role="menuitem"], [role="link"], input[type="submit"], input[type="button"], input[type="checkbox"], input[type="radio"], select, summary, label';

/** Libellé lisible d'un élément touché — jamais la valeur d'un champ saisi. */
export function actionLabel(el) {
  if (!el) return '';
  const pick = (v) => String(v || '').replace(/\s+/g, ' ').trim();
  let text = pick(el.getAttribute?.('aria-label')) || pick(el.getAttribute?.('title'));
  if (!text && el.tagName === 'INPUT') {
    const type = (el.getAttribute('type') || '').toLowerCase();
    text = type === 'submit' || type === 'button' ? pick(el.value) : pick(el.labels?.[0]?.textContent) || pick(el.name);
  }
  if (!text && el.tagName === 'SELECT') text = pick(el.labels?.[0]?.textContent) || pick(el.name);
  if (!text) text = pick(el.textContent);
  if (!text && el.tagName === 'A') text = pick(el.getAttribute('href'));
  if (!text) text = pick(el.querySelector?.('img')?.getAttribute('alt'));
  return text.slice(0, LABEL_MAX);
}

export function currentPage() {
  if (typeof window === 'undefined') return '';
  return window.location.pathname.split('/').filter(Boolean).join('/') || 'accueil';
}

export default function ActivityTracker() {
  const { user } = useAuth() || {};
  const pathname = usePathname();
  const queue = useRef([]);
  const sending = useRef(false);

  // Envoi d'un lot. keepalive : la requête part même si la page se ferme.
  const flush = useRef(async () => {});
  flush.current = async () => {
    const u = auth.currentUser;
    if (!u || sending.current || !queue.current.length) return;
    sending.current = true;
    const events = queue.current.splice(0, BATCH_MAX);
    try {
      const idToken = await u.getIdToken();
      await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, type: 'actions', events, sentAt: Date.now() }),
        keepalive: true,
      });
    } catch {
      // Réseau coupé : on remet le lot en tête de file (borné) pour le prochain envoi.
      queue.current = events.concat(queue.current).slice(0, QUEUE_MAX);
    } finally {
      sending.current = false;
    }
    if (queue.current.length >= BATCH_MAX) flush.current();
  };

  const push = (event) => {
    queue.current.push({ ...event, at: Date.now() });
    if (queue.current.length > QUEUE_MAX) queue.current.splice(0, queue.current.length - QUEUE_MAX);
    if (queue.current.length >= BATCH_MAX) flush.current();
  };

  // Page ouverte (chaque changement de route).
  useEffect(() => {
    if (user) push({ type: 'page', page: currentPage() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, user]);

  useEffect(() => {
    if (!user) return undefined;
    const onClick = (e) => {
      const el = e.target?.closest?.(CLICKABLE);
      if (!el) return;
      push({ type: 'click', page: currentPage(), label: actionLabel(el) });
    };
    const onHide = () => { if (document.visibilityState === 'hidden') flush.current(); };
    const onPageHide = () => flush.current();
    const timer = setInterval(() => flush.current(), FLUSH_MS);
    document.addEventListener('click', onClick, true);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      clearInterval(timer);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      flush.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return null;
}
