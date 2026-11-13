'use client';
// Écran d'une discussion (privée, groupe ou chaîne). Messages relus par
// l'API à chaque signal temps réel (lib/asrarChat/live.js) ou par sondage de
// secours ; pièces jointes privées servies par liens signés temporaires.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, MoreVertical, Send, Paperclip, Mic, Square, X, Reply, Copy, Forward, Pencil, Trash2, Flag, Smile,
  Check, CheckCheck, FileText, Download, Megaphone, Users, Ban, BellOff, Bell, Link2, LogOut, Info, PlusSquare,
  ShieldCheck, UserMinus, Loader2, Lock,
} from 'lucide-react';
import { ac } from '@/lib/asrarChat/client';
import { uploadAsset } from '@/lib/asrarChat/upload';
import { subscribeConv, subscribeTyping, sendTyping } from '@/lib/asrarChat/live';
import { startVisiblePolling } from '@/lib/visiblePolling';
import { REACTIONS, fcfa } from '@/lib/asrarChat/logic';
import { useAc } from './context';
import { Avatar, Loading, ErrorState, Sheet, Modal, timeShort, presence, bytes, PostCard, useNow } from './ui';
import ReportSheet from './ReportSheet';

const POLL_MS = 10000;

export default function ChatRoom({ cid, onClose }: { cid: string; onClose: () => void }) {
  const { me, notify, openProfile, openPost, publishIn } = useAc();
  const [conv, setConv] = useState<any>(null);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [authors, setAuthors] = useState<Record<string, any>>({});
  const [meta, setMeta] = useState<any>({});
  const [hasMore, setHasMore] = useState(false);
  const [typing, setTyping] = useState<string[]>([]);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<null | 'info' | 'members' | 'report'>(null);
  const [selected, setSelected] = useState<any>(null);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [forwarding, setForwarding] = useState<any>(null);
  const [reporting, setReporting] = useState<any>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastSeenId = useRef<string>('');
  const now = useNow(30000);

  const loadConv = useCallback(async () => {
    try { setConv((await ac('conv.get', { cid })).conv); setError(''); }
    catch (e: any) { setError(e.message); }
  }, [cid]);

  const loadMessages = useCallback(async () => {
    try {
      const r = await ac('msg.list', { cid });
      setMessages((prev) => {
        // Conserve les pages plus anciennes déjà chargées.
        const older = prev.filter((m) => r.messages.length && m.id < r.messages[0].id);
        return [...older, ...r.messages];
      });
      setAuthors((a) => ({ ...a, ...r.authors }));
      setMeta({ peerReadAt: r.peerReadAt || 0, readCount: r.readCount || {} });
      if (!messages.length) setHasMore(r.hasMore);
      const last = r.messages[r.messages.length - 1];
      if (last && last.id !== lastSeenId.current) {
        const fromOthers = last.uid !== me.uid;
        lastSeenId.current = last.id;
        if (fromOthers && document.visibilityState === 'visible') ac('msg.read', { cid }).catch(() => {});
      }
    } catch (e: any) { if (!messages.length) setError(e.message); }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `messages.length` lu au moment de l'appel
  }, [cid, me.uid]);

  useEffect(() => { loadConv(); }, [loadConv]);
  useEffect(() => startVisiblePolling(loadMessages, POLL_MS), [loadMessages]);
  useEffect(() => subscribeConv(cid, loadMessages), [cid, loadMessages]);
  useEffect(() => (conv?.role ? subscribeTyping(cid, me.uid, setTyping) : undefined), [cid, me.uid, conv?.role]);

  // Défile en bas à l'arrivée d'un nouveau message.
  const lastId = messages[messages.length - 1]?.id;
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId]);

  const loadOlder = async () => {
    if (!messages.length) return;
    try {
      const r = await ac('msg.list', { cid, before: messages[0].id });
      setMessages((prev) => [...r.messages, ...prev]);
      setAuthors((a) => ({ ...a, ...r.authors }));
      setHasMore(r.hasMore);
    } catch (e: any) { notify(e.message, 'error'); }
  };

  const join = async () => {
    try { await ac('conv.join', { cid }); await loadConv(); notify('Vous avez rejoint la discussion.', 'success'); }
    catch (e: any) { notify(e.message, 'error'); }
  };

  const act = async (action: string, body: any, okMsg?: string) => {
    try { await ac(action, { cid, ...body }); if (okMsg) notify(okMsg, 'success'); await loadMessages(); }
    catch (e: any) { notify(e.message, 'error'); }
  };

  const subtitle = useMemo(() => {
    if (!conv) return '';
    if (typing.length) {
      const names = typing.map((uid) => authors[uid]?.displayName || 'Quelqu’un');
      return names.length === 1 ? `${names[0]} écrit…` : `${names.length} personnes écrivent…`;
    }
    if (conv.type === 'dm') return conv.blockedMe ? '' : presence(conv.peer?.lastSeenAt || 0);
    return `${conv.membersCount} ${conv.type === 'channel' ? 'abonné' : 'membre'}${conv.membersCount > 1 ? 's' : ''}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `now` rafraîchit la présence
  }, [conv, typing, authors, now]);

  const copyInvite = async () => {
    const url = `${window.location.origin}/asrar-chat?join=${encodeURIComponent(conv.inviteCode)}`;
    try { await navigator.clipboard.writeText(url); notify('Lien d’invitation copié.', 'success'); }
    catch { window.prompt('Copiez le lien d’invitation :', url); }
  };

  const leave = async () => {
    if (!window.confirm(conv.type === 'dm' ? 'Masquer cette discussion ?' : `Quitter « ${conv.title} » ?`)) return;
    try { await ac('conv.leave', { cid }); onClose(); } catch (e: any) { notify(e.message, 'error'); }
  };

  const toggleBlock = async () => {
    const blocked = !conv.blocked;
    if (blocked && !window.confirm(`Bloquer ${conv.title} ? Il ne pourra plus vous écrire.`)) return;
    try { await ac('block.set', { uid: conv.peer.uid, blocked }); await loadConv(); notify(blocked ? 'Compte bloqué.' : 'Compte débloqué.', 'success'); }
    catch (e: any) { notify(e.message, 'error'); }
  };

  const toggleMute = async () => {
    try { await ac('conv.mute', { cid, muted: !conv.muted }); await loadConv(); } catch (e: any) { notify(e.message, 'error'); }
  };

  let lastDay = '';
  return (
    <div className="ac-room" role="dialog" aria-modal="true" aria-label={conv?.title || 'Discussion'}>
      <header className="ac-room-head">
        <button type="button" className="ac-icon-btn" aria-label="Retour aux discussions" onClick={onClose}><ArrowLeft size={22} /></button>
        {conv && (
          <button type="button" className="ac-room-id" onClick={() => (conv.type === 'dm' ? conv.peer && openProfile(conv.peer.uid) : setSheet('info'))}>
            <Avatar name={conv.title} photo={conv.photo} seed={conv.type === 'dm' ? conv.peer?.uid : cid} size={38} />
            <span className="ac-room-titles">
              <span className="ac-room-title">{conv.type === 'channel' && <Megaphone size={14} aria-hidden="true" />}{conv.title}</span>
              <span className={'ac-room-sub' + (typing.length ? ' typing' : '')}>{subtitle}</span>
            </span>
          </button>
        )}
        {conv && <button type="button" className="ac-icon-btn" aria-label="Options de la discussion" aria-expanded={menu} onClick={() => setMenu((v) => !v)}><MoreVertical size={22} /></button>}
        {menu && conv && (
          <div className="ac-popover" role="menu" onClick={() => setMenu(false)}>
            {conv.type !== 'dm' && <button role="menuitem" type="button" onClick={() => setSheet('info')}><Info size={18} /> Infos</button>}
            {conv.type !== 'dm' && (conv.type === 'group' || conv.canModerate) && conv.role && <button role="menuitem" type="button" onClick={() => setSheet('members')}><Users size={18} /> Membres</button>}
            {conv.canPost && <button role="menuitem" type="button" onClick={() => publishIn(cid)}><PlusSquare size={18} /> Publier un contenu</button>}
            {conv.canModerate && conv.inviteCode && <button role="menuitem" type="button" onClick={copyInvite}><Link2 size={18} /> Copier le lien d’invitation</button>}
            {conv.role && <button role="menuitem" type="button" onClick={toggleMute}>{conv.muted ? <Bell size={18} /> : <BellOff size={18} />} {conv.muted ? 'Activer les notifications' : 'Couper les notifications'}</button>}
            {conv.type === 'dm' && conv.peer && <button role="menuitem" type="button" onClick={toggleBlock}><Ban size={18} /> {conv.blocked ? 'Débloquer' : 'Bloquer'}</button>}
            <button role="menuitem" type="button" onClick={() => setReporting(conv.type === 'dm' ? { target: 'user', uid: conv.peer?.uid } : { target: 'conv', cid })}><Flag size={18} /> Signaler</button>
            {conv.role && <button role="menuitem" type="button" className="danger" onClick={leave}><LogOut size={18} /> {conv.type === 'dm' ? 'Masquer' : 'Quitter'}</button>}
          </div>
        )}
      </header>

      <div className="ac-room-list" ref={listRef}>
        {error && !conv ? <ErrorState error={error} onRetry={() => { loadConv(); loadMessages(); }} /> : !conv ? <Loading /> : (
          <>
            {hasMore && <button type="button" className="ac-btn text small ac-older" onClick={loadOlder}>Messages précédents</button>}
            {messages.length === 0 && <p className="ac-room-empty">{conv.type === 'channel' ? 'Aucune publication pour l’instant.' : 'Aucun message. Dites bonjour !'}</p>}
            {messages.map((m, i) => {
              const day = new Date(m.at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
              const sep = day !== lastDay ? <div className="ac-day" key={'d' + m.id}><span>{day}</span></div> : null;
              lastDay = day;
              const mine = m.uid === me.uid;
              const prev = messages[i - 1];
              const showAuthor = conv.type !== 'dm' && !mine && (!prev || prev.uid !== m.uid || prev.deleted);
              return [sep, (
                <Bubble key={m.id} m={m} mine={mine} author={authors[m.uid]} showAuthor={showAuthor} conv={conv}
                  readState={mine ? (conv.type === 'dm' ? (meta.peerReadAt >= m.at ? 'read' : 'sent') : meta.readCount?.[m.id] ? `Lu par ${meta.readCount[m.id]}` : 'sent') : null}
                  onMenu={() => setSelected(m)} onOpenPost={openPost} onView={setViewer} onAuthor={() => openProfile(m.uid)} />
              )];
            })}
          </>
        )}
      </div>

      {conv && !conv.role && conv.visibility === 'public' && (
        <div className="ac-join-bar"><button type="button" className="ac-btn filled" onClick={join}>Rejoindre {conv.type === 'channel' ? 'la chaîne' : 'le groupe'}</button></div>
      )}
      {conv && conv.role && !conv.canPost && <div className="ac-join-bar muted">Seuls les administrateurs publient dans cette chaîne.</div>}
      {conv && conv.role && conv.canPost && (conv.blocked || conv.blockedMe) && <div className="ac-join-bar muted">{conv.blocked ? 'Vous avez bloqué ce compte.' : 'Vous ne pouvez pas répondre à ce compte.'}</div>}
      {conv && conv.role && conv.canPost && !conv.blocked && !conv.blockedMe && (
        <Composer cid={cid} replyTo={replyTo} editing={editing} authors={authors}
          onCancelReply={() => setReplyTo(null)} onCancelEdit={() => setEditing(null)}
          onSent={async () => { setReplyTo(null); setEditing(null); await loadMessages(); }} />
      )}

      {selected && (
        <MessageActions m={selected} mine={selected.uid === me.uid} canModerate={!!conv?.canModerate} canPost={!!conv?.canPost}
          onClose={() => setSelected(null)}
          onReply={() => { setReplyTo(selected); setSelected(null); }}
          onReact={(emoji: string | null) => { act('msg.react', { mid: selected.id, emoji }); setSelected(null); }}
          onEdit={() => { setEditing(selected); setSelected(null); }}
          onDelete={() => { if (window.confirm('Supprimer ce message pour tout le monde ?')) act('msg.delete', { mid: selected.id }, 'Message supprimé.'); setSelected(null); }}
          onForward={() => { setForwarding(selected); setSelected(null); }}
          onReport={() => { setReporting({ target: 'message', cid, mid: selected.id }); setSelected(null); }}
          onCopy={async () => { try { await navigator.clipboard.writeText(selected.text || ''); notify('Texte copié.', 'success'); } catch {} setSelected(null); }} />
      )}
      {forwarding && <ForwardSheet cid={cid} m={forwarding} onClose={() => setForwarding(null)} />}
      {reporting && <ReportSheet target={reporting} onClose={() => setReporting(null)} />}
      {sheet === 'info' && conv && <InfoSheet conv={conv} onClose={() => setSheet(null)} onSaved={loadConv} onCopyInvite={copyInvite} />}
      {sheet === 'members' && conv && <MembersSheet conv={conv} onClose={() => setSheet(null)} onChanged={loadConv} />}
      {viewer && (
        <Modal className="ac-viewer" label="Image" onClose={() => setViewer(null)}>
          <button type="button" className="ac-icon-btn ac-viewer-close" aria-label="Fermer" onClick={() => setViewer(null)}><X size={22} /></button>
          {/* eslint-disable-next-line @next/next/no-img-element -- lien signé temporaire */}
          <img src={viewer} alt="" onContextMenu={(e) => e.preventDefault()} />
        </Modal>
      )}
    </div>
  );
}

function Media({ media, onView }: { media: any; onView: (url: string) => void }) {
  if (!media) return null;
  if (media.kind === 'image') {
    return (
      <button type="button" className="ac-media-img" onClick={() => onView(media.url)} aria-label="Agrandir l’image">
        {/* eslint-disable-next-line @next/next/no-img-element -- lien signé temporaire */}
        <img src={media.url} alt="" loading="lazy" style={media.w && media.h ? { aspectRatio: `${media.w} / ${media.h}` } : undefined} onContextMenu={(e) => e.preventDefault()} />
      </button>
    );
  }
  if (media.kind === 'video') return <video className="ac-media-video" src={media.url} controls preload="metadata" playsInline controlsList="nodownload" onContextMenu={(e) => e.preventDefault()} />;
  if (media.kind === 'audio') return <audio className="ac-media-audio" src={media.url} controls preload="none" controlsList="nodownload" />;
  return (
    <a className="ac-media-doc" href={media.url} target="_blank" rel="noopener noreferrer">
      <FileText size={26} aria-hidden="true" />
      <span><strong>{media.name || 'Document'}</strong><small>{[media.fmt?.toUpperCase(), bytes(media.bytes)].filter(Boolean).join(' · ')}</small></span>
      <Download size={18} aria-hidden="true" />
    </a>
  );
}

function Bubble({ m, mine, author, showAuthor, readState, onMenu, onOpenPost, onView, onAuthor }: any) {
  const reactions = Object.values(m.reactions || {}).filter(Boolean) as string[];
  const counts = reactions.reduce((acc: Record<string, number>, r) => ({ ...acc, [r]: (acc[r] || 0) + 1 }), {});
  if (m.deleted) {
    return <div className={'ac-msg' + (mine ? ' mine' : '')}><div className="ac-bubble deleted"><Trash2 size={13} aria-hidden="true" /> Message supprimé</div></div>;
  }
  return (
    <div className={'ac-msg' + (mine ? ' mine' : '') + (m.post ? ' has-post' : '')} onContextMenu={(e) => { e.preventDefault(); onMenu(); }}>
      {showAuthor && <button type="button" className="ac-msg-author" onClick={onAuthor}>{author?.displayName || 'Membre'}</button>}
      <div className="ac-bubble">
        {m.forwarded && <span className="ac-fwd"><Forward size={12} aria-hidden="true" /> Transféré</span>}
        {m.reply && (
          <span className="ac-quote">{m.reply.deleted ? 'Message supprimé' : <><strong>{m.reply.uid === author?.uid ? author?.displayName : 'Réponse'}</strong> {m.reply.text || { image: 'Photo', video: 'Vidéo', audio: 'Vocal', document: 'Document', post: 'Publication' }[m.reply.kind as string] || ''}</>}</span>
        )}
        <Media media={m.media} onView={onView} />
        {m.post && (
          <div className="ac-msg-post">
            <PostCard post={m.post} compact onOpen={() => onOpenPost(m.post.id)} />
            {m.post.price > 0 && !m.post.unlocked && !m.post.unavailable && (
              <button type="button" className="ac-btn filled small ac-unlock" onClick={() => onOpenPost(m.post.id)}><Lock size={14} aria-hidden="true" /> Déverrouiller pour {fcfa(m.post.price)}</button>
            )}
          </div>
        )}
        {m.text && <p className="ac-text" dir="auto">{m.text}</p>}
        <span className="ac-meta">
          {m.editedAt ? 'modifié · ' : ''}{timeShort(m.at)}
          {readState === 'read' && <CheckCheck size={14} className="read" aria-label="Lu" />}
          {readState === 'sent' && <Check size={14} aria-label="Envoyé" />}
          {readState && readState.startsWith?.('Lu par') && <span className="ac-readby"><CheckCheck size={14} className="read" aria-hidden="true" /> {readState.slice(7)}</span>}
        </span>
        <button type="button" className="ac-msg-more" aria-label="Actions sur le message" onClick={onMenu}><MoreVertical size={14} /></button>
      </div>
      {reactions.length > 0 && (
        <div className="ac-reactions" aria-label="Réactions">
          {Object.entries(counts).map(([emoji, n]) => <span key={emoji} className="ac-reaction">{emoji} {n > 1 ? n : ''}</span>)}
        </div>
      )}
    </div>
  );
}

function MessageActions({ m, mine, canModerate, canPost, onClose, onReply, onReact, onEdit, onDelete, onForward, onReport, onCopy }: any) {
  return (
    <Sheet title="Message" onClose={onClose} compact>
      <div className="ac-reaction-picker" role="group" aria-label="Réagir">
        {REACTIONS.map((r) => <button key={r} type="button" onClick={() => onReact(m.reactions?.[m.uid] === r ? null : r)} aria-label={`Réagir ${r}`}>{r}</button>)}
        <button type="button" onClick={() => onReact(null)} aria-label="Retirer ma réaction"><Smile size={18} /></button>
      </div>
      <div className="ac-menu-list">
        {canPost && <button type="button" onClick={onReply}><Reply size={18} aria-hidden="true" /> Répondre</button>}
        {m.text && <button type="button" onClick={onCopy}><Copy size={18} aria-hidden="true" /> Copier le texte</button>}
        <button type="button" onClick={onForward}><Forward size={18} aria-hidden="true" /> Transférer</button>
        {mine && !m.post && <button type="button" onClick={onEdit}><Pencil size={18} aria-hidden="true" /> Modifier</button>}
        {(mine || canModerate) && <button type="button" className="danger" onClick={onDelete}><Trash2 size={18} aria-hidden="true" /> Supprimer pour tous</button>}
        {!mine && <button type="button" onClick={onReport}><Flag size={18} aria-hidden="true" /> Signaler</button>}
      </div>
    </Sheet>
  );
}

function Composer({ cid, replyTo, editing, authors, onCancelReply, onCancelEdit, onSent }: any) {
  const { me, notify } = useAc();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [recording, setRecording] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (editing) { setText(editing.text || ''); areaRef.current?.focus(); } }, [editing]);
  useEffect(() => { if (replyTo) areaRef.current?.focus(); }, [replyTo]);

  const send = async (extra: any = {}) => {
    const value = text.trim();
    if (!value && !extra.asset) return;
    setBusy(true);
    try {
      if (editing) await ac('msg.edit', { cid, mid: editing.id, text: value });
      else await ac('msg.send', { cid, text: value, replyTo: replyTo?.id, ...extra });
      setText('');
      await onSent();
    } catch (e: any) { notify(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const attach = async (file: File | undefined) => {
    if (!file) return;
    setProgress(0);
    try {
      const asset = await uploadAsset(file, { visibility: 'private', onProgress: setProgress });
      await send({ asset });
    } catch (e: any) { notify(e.message, 'error'); }
    finally { setProgress(null); if (fileRef.current) fileRef.current.value = ''; }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find((t) => (window as any).MediaRecorder?.isTypeSupported?.(t)) || '';
      const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      const started = Date.now();
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const secs = Math.round((Date.now() - started) / 1000);
        if (secs < 1) return;
        const mime = recorder.mimeType || 'audio/webm';
        const ext = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'm4a' : 'webm';
        const file = new File(chunks, `vocal.${ext}`, { type: mime.split(';')[0] });
        setProgress(0);
        try {
          const asset = await uploadAsset(file, { visibility: 'private', rt: 'video', duration: secs, onProgress: setProgress });
          await ac('msg.send', { cid, asset: { ...asset, audio: true } });
          await onSent();
        } catch (e: any) { notify(e.message, 'error'); }
        finally { setProgress(null); }
      };
      recorder.start();
      setRecording(recorder);
    } catch {
      notify('Micro indisponible : autorisez l’accès au microphone.', 'error');
    }
  };
  const stopRecording = () => { recording?.stop(); setRecording(null); };

  const quoteName = replyTo ? (replyTo.uid === me.uid ? 'Vous' : authors[replyTo.uid]?.displayName || 'Membre') : '';
  return (
    <div className="ac-composer-wrap">
      {(replyTo || editing) && (
        <div className="ac-composer-ctx">
          {editing ? <Pencil size={16} aria-hidden="true" /> : <Reply size={16} aria-hidden="true" />}
          <span><strong>{editing ? 'Modifier le message' : `Réponse à ${quoteName}`}</strong>{replyTo && <small>{replyTo.text || 'Pièce jointe'}</small>}</span>
          <button type="button" className="ac-icon-btn" aria-label="Annuler" onClick={() => { if (editing) { setText(''); onCancelEdit(); } else onCancelReply(); }}><X size={18} /></button>
        </div>
      )}
      {progress !== null && <div className="ac-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Envoi du fichier"><span style={{ width: progress + '%' }} /></div>}
      <form className="ac-composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
        {!editing && (
          <>
            <input ref={fileRef} type="file" hidden accept="image/*,video/*,audio/*,.pdf,.epub,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" onChange={(e) => attach(e.target.files?.[0])} />
            <button type="button" className="ac-icon-btn" aria-label="Joindre un fichier" disabled={busy || progress !== null || !!recording} onClick={() => fileRef.current?.click()}><Paperclip size={21} /></button>
          </>
        )}
        {recording ? (
          <span className="ac-recording" role="status"><span className="ac-rec-dot" aria-hidden="true" /> Enregistrement… appuyez sur Stop pour envoyer</span>
        ) : (
          <textarea ref={areaRef} value={text} rows={1} placeholder="Message" aria-label="Message" maxLength={4000} dir="auto"
            onChange={(e) => { setText(e.target.value); if (e.target.value) sendTyping(cid, me.uid); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) { e.preventDefault(); send(); } }} />
        )}
        {text.trim() || editing ? (
          <button type="submit" className="ac-send" aria-label={editing ? 'Enregistrer' : 'Envoyer'} disabled={busy}>{busy ? <Loader2 size={20} className="ac-spin" /> : editing ? <Check size={20} /> : <Send size={20} />}</button>
        ) : recording ? (
          <button type="button" className="ac-send rec" aria-label="Arrêter et envoyer le vocal" onClick={stopRecording}><Square size={18} /></button>
        ) : (
          <button type="button" className="ac-send" aria-label="Enregistrer un message vocal" disabled={busy || progress !== null} onClick={startRecording}><Mic size={20} /></button>
        )}
      </form>
    </div>
  );
}

function ForwardSheet({ cid, m, onClose }: { cid: string; m: any; onClose: () => void }) {
  const { notify } = useAc();
  const [convs, setConvs] = useState<any[] | null>(null);
  useEffect(() => { ac('conv.list').then((r) => setConvs(r.convs.filter((c: any) => c.id !== cid && (c.type !== 'channel' || ['owner', 'admin'].includes(c.role))))).catch((e) => notify(e.message, 'error')); }, [cid, notify]);
  const forward = async (to: string) => {
    try { await ac('msg.forward', { cid, mid: m.id, to }); notify('Message transféré.', 'success'); onClose(); }
    catch (e: any) { notify(e.message, 'error'); }
  };
  return (
    <Sheet title="Transférer vers…" onClose={onClose} compact>
      {!convs ? <Loading /> : convs.length === 0 ? <p className="ac-hint">Aucune autre discussion.</p> : (
        <ul className="ac-list">
          {convs.map((c) => (
            <li key={c.id}><button type="button" className="ac-row" onClick={() => forward(c.id)}>
              <Avatar name={c.title} photo={c.photo} seed={c.id} size={38} />
              <span className="ac-row-main"><span className="ac-row-title">{c.title}</span></span>
            </button></li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function InfoSheet({ conv, onClose, onSaved, onCopyInvite }: any) {
  const { notify } = useAc();
  const [title, setTitle] = useState(conv.title);
  const [about, setAbout] = useState(conv.about);
  const [visibility, setVisibility] = useState(conv.visibility);
  const save = async (extra: any = {}) => {
    try { await ac('conv.update', { cid: conv.id, title, about, visibility, ...extra }); notify('Enregistré.', 'success'); await onSaved(); onClose(); }
    catch (e: any) { notify(e.message, 'error'); }
  };
  return (
    <Sheet title={conv.type === 'channel' ? 'Chaîne' : 'Groupe'} onClose={onClose}>
      <div className="ac-info-head">
        <Avatar name={conv.title} photo={conv.photo} seed={conv.id} size={72} />
        <strong>{conv.title}</strong>
        <span className="ac-hint">{conv.visibility === 'public' ? 'Public' : 'Privé'} · {conv.membersCount} membre{conv.membersCount > 1 ? 's' : ''}</span>
        {conv.owner && <span className="ac-hint">Créé par {conv.owner.displayName}</span>}
      </div>
      {conv.about && !conv.canModerate && <p className="ac-about">{conv.about}</p>}
      {conv.canModerate && (
        <form className="ac-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <label className="ac-field"><span>Nom</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} /></label>
          <label className="ac-field"><span>Description</span><textarea value={about} onChange={(e) => setAbout(e.target.value)} maxLength={300} rows={2} /></label>
          <label className="ac-field"><span>Visibilité</span>
            <select value={visibility} onChange={(e) => setVisibility(e.target.value)}><option value="public">Public (visible dans l’Explorer)</option><option value="private">Privé (sur invitation)</option></select>
          </label>
          <button type="submit" className="ac-btn filled">Enregistrer</button>
          <div className="ac-row-actions">
            <button type="button" className="ac-btn tonal" onClick={onCopyInvite}><Link2 size={16} aria-hidden="true" /> Copier le lien</button>
            <button type="button" className="ac-btn text" onClick={() => { if (window.confirm('Créer un nouveau lien ? L’ancien ne fonctionnera plus.')) save({ resetInvite: true }); }}>Nouveau lien</button>
          </div>
        </form>
      )}
    </Sheet>
  );
}

function MembersSheet({ conv, onClose, onChanged }: any) {
  const { me, notify, openProfile } = useAc();
  const [members, setMembers] = useState<any[] | null>(null);
  const load = useCallback(async () => {
    try { setMembers((await ac('conv.members', { cid: conv.id })).members); } catch (e: any) { notify(e.message, 'error'); onClose(); }
  }, [conv.id, notify, onClose]);
  useEffect(() => { load(); }, [load]);
  const run = async (action: string, body: any, msg: string) => {
    try { await ac(action, { cid: conv.id, ...body }); notify(msg, 'success'); await load(); await onChanged(); } catch (e: any) { notify(e.message, 'error'); }
  };
  const ROLE: Record<string, string> = { owner: 'Propriétaire', admin: 'Administrateur', member: '' };
  return (
    <Sheet title="Membres" onClose={onClose}>
      {!members ? <Loading /> : (
        <ul className="ac-list">
          {members.map((u) => (
            <li key={u.uid} className="ac-member">
              <button type="button" className="ac-row" onClick={() => openProfile(u.uid)}>
                <Avatar name={u.displayName} photo={u.photo} seed={u.uid} size={38} />
                <span className="ac-row-main"><span className="ac-row-title">{u.displayName}{u.uid === me.uid ? ' (vous)' : ''}</span><span className="ac-row-sub">@{u.handle}{ROLE[u.role] ? ' · ' + ROLE[u.role] : ''}</span></span>
              </button>
              {u.uid !== me.uid && u.role !== 'owner' && (
                <span className="ac-member-actions">
                  {conv.role === 'owner' && (u.role === 'admin'
                    ? <button type="button" className="ac-icon-btn" aria-label={`Retirer le rôle d’administrateur à ${u.displayName}`} onClick={() => run('conv.role', { uid: u.uid, role: 'member' }, 'Rôle retiré.')}><ShieldCheck size={18} className="on" /></button>
                    : <button type="button" className="ac-icon-btn" aria-label={`Nommer ${u.displayName} administrateur`} onClick={() => run('conv.role', { uid: u.uid, role: 'admin' }, 'Administrateur nommé.')}><ShieldCheck size={18} /></button>)}
                  {conv.canModerate && (conv.role === 'owner' || u.role === 'member') && (
                    <button type="button" className="ac-icon-btn" aria-label={`Retirer ${u.displayName}`} onClick={() => { if (window.confirm(`Retirer ${u.displayName} ? Il ne pourra plus revenir.`)) run('conv.remove', { uid: u.uid, ban: true }, 'Membre retiré.'); }}><UserMinus size={18} /></button>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

