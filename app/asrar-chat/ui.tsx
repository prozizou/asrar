'use client';
// Composants partagés d'Asrar-chat (Material 3 : surfaces tonales, coins
// arrondis, puces, boutons pleins/tonaux/texte). Icônes SVG (lucide).
import { useEffect, useState } from 'react';
import {
  Lock, Loader2, AlertCircle, RefreshCw, FileText, Image as ImageIcon, Video, Music, Briefcase, Newspaper, Images,
  Star, BadgeCheck, X,
} from 'lucide-react';
import ModalUntyped from '@/components/Modal';
import { fcfa, POST_KIND_LABELS } from '@/lib/asrarChat/logic';

export const Modal = ModalUntyped as any;
export type Notify = (msg: string, type?: 'success' | 'error' | 'info') => void;

export function colorFor(seed: string) {
  let h = 0;
  for (const ch of String(seed || '')) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 45%)`;
}

export function Avatar({ name, photo, seed, size = 44 }: { name?: string; photo?: string; seed?: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const initial = (String(name || '?').trim()[0] || '?').toUpperCase();
  if (photo && !broken) {
    // eslint-disable-next-line @next/next/no-img-element -- photo Cloudinary (URL dynamique)
    return <img className="ac-avatar" src={photo} alt="" width={size} height={size} style={{ width: size, height: size }} onError={() => setBroken(true)} loading="lazy" />;
  }
  return <span className="ac-avatar ac-avatar-fallback" aria-hidden="true" style={{ width: size, height: size, background: colorFor(seed || name || ''), fontSize: size * 0.42 }}>{initial}</span>;
}

export function DisplayName({ profile }: { profile: any }) {
  if (!profile) return <span>Compte supprimé</span>;
  return (
    <span className="ac-name">
      {profile.displayName || profile.handle}
      {profile.verified && <BadgeCheck size={14} className="ac-verified" aria-label="Vendeur vérifié" />}
    </span>
  );
}

export function timeShort(at: number) {
  if (!at) return '';
  const d = new Date(at), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const diff = (now.getTime() - at) / 86_400_000;
  if (diff < 7) return d.toLocaleDateString('fr-FR', { weekday: 'short' });
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
export function dateTime(at: number) {
  return at ? new Date(at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '';
}
export function presence(lastSeenAt: number) {
  if (!lastSeenAt) return '';
  const min = (Date.now() - lastSeenAt) / 60000;
  if (min < 2.5) return 'en ligne';
  if (min < 60) return `vu il y a ${Math.round(min)} min`;
  return 'vu ' + timeShort(lastSeenAt);
}
export function bytes(n: number) {
  if (!n) return '';
  if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + ' Ko';
  return (n / 1048576).toFixed(1).replace('.', ',') + ' Mo';
}
export function duration(s: number) {
  if (!s) return '';
  const m = Math.floor(s / 60), r = Math.round(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}
export { fcfa };

export const KIND_ICONS: Record<string, any> = {
  text: Newspaper, image: ImageIcon, album: Images, video: Video, audio: Music, document: FileText, service: Briefcase,
};

export function Loading({ label = 'Chargement…' }: { label?: string }) {
  return <div className="ac-state" role="status"><Loader2 size={22} className="ac-spin" aria-hidden="true" /> {label}</div>;
}

export function ErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="ac-state ac-state-error" role="alert">
      <AlertCircle size={20} aria-hidden="true" /> <span>{error}</span>
      {onRetry && <button type="button" className="ac-btn tonal small" onClick={onRetry}><RefreshCw size={14} aria-hidden="true" /> Réessayer</button>}
    </div>
  );
}

export function Empty({ icon: Icon, title, children }: { icon: any; title: string; children?: any }) {
  return (
    <div className="ac-empty">
      <span className="ac-empty-icon" aria-hidden="true"><Icon size={28} /></span>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}

export function Stars({ value, count }: { value: number; count?: number }) {
  if (!value) return null;
  return <span className="ac-stars"><Star size={13} aria-hidden="true" fill="currentColor" /> {String(value).replace('.', ',')}{count ? ` (${count})` : ''}</span>;
}

/** Carte d'une publication : aperçu (flouté si payant et verrouillé) + prix. */
export function PostCard({ post, onOpen, compact = false }: { post: any; onOpen: () => void; compact?: boolean }) {
  if (!post || post.unavailable) return <div className="ac-post ac-post-gone">Publication indisponible.</div>;
  const Icon = KIND_ICONS[post.kind] || Newspaper;
  const locked = post.price > 0 && !post.unlocked;
  return (
    <button type="button" className={'ac-post' + (compact ? ' compact' : '') + (locked ? ' locked' : '')} onClick={onOpen} aria-label={`${post.title}${locked ? `, verrouillé, ${fcfa(post.price)}` : ''}`}>
      <span className="ac-post-media">
        {post.previewImage
          // eslint-disable-next-line @next/next/no-img-element -- aperçu public (déjà flouté si payant)
          ? <img src={post.previewImage} alt="" loading="lazy" className={locked ? 'blurred' : ''} />
          : <span className="ac-post-placeholder" aria-hidden="true"><Icon size={30} /></span>}
        <span className="ac-post-kind"><Icon size={12} aria-hidden="true" /> {POST_KIND_LABELS[post.kind]}{post.media?.count > 1 ? ` · ${post.media.count}` : ''}{post.media?.duration ? ` · ${duration(post.media.duration)}` : ''}</span>
        {locked && <span className="ac-post-lock" aria-hidden="true"><Lock size={22} /></span>}
      </span>
      <span className="ac-post-body">
        <span className="ac-post-title">{post.title}</span>
        {!compact && (post.previewText || post.description) && <span className="ac-post-desc">{post.previewText || post.description}</span>}
        <span className="ac-post-meta">
          {post.seller && <span className="ac-post-seller">{post.seller.displayName || post.seller.handle}</span>}
          <Stars value={post.rating} />
        </span>
        <span className={'ac-price' + (post.price ? '' : ' free')}>
          {post.price ? (post.unlocked ? (post.owner ? fcfa(post.price) : 'Acheté') : fcfa(post.price)) : 'Gratuit'}
        </span>
      </span>
    </button>
  );
}

export function Sheet({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: any; wide?: boolean }) {
  return (
    <Modal className={'ac-sheet' + (wide ? ' wide' : '')} label={title} onClose={onClose}>
      <div className="ac-sheet-head">
        <h2>{title}</h2>
        <button type="button" className="ac-icon-btn" aria-label="Fermer" onClick={onClose}><X size={20} /></button>
      </div>
      <div className="ac-sheet-body">{children}</div>
    </Modal>
  );
}

/** Rafraîchit `now` régulièrement (badges « en ligne », délais). */
export function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}
