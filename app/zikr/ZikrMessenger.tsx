'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { ArrowDown, Camera, Check, Copy, Forward, ImagePlus, Info, MoreVertical, Reply, Send, Trash2, X, Pencil } from 'lucide-react';
import ModalUntyped from '@/components/Modal';
import EmojiPickerUntyped from '@/components/EmojiPicker';
import AudioMessageUntyped from '@/components/AudioMessage';
import { useVoiceRecorder } from '@/components/useVoiceRecorder';
import { startVisiblePolling } from '@/lib/visiblePolling';
import { playNotificationBeep } from '@/lib/notifSound';
import { chatDisplayName, CHAT_MESSAGE_MAX, CHAT_AUDIO_MAX_S } from '@/lib/zikrLogic';
import { checkZikrAudio, uploadZikrChatMedia } from '@/lib/cloudinary';
import { mergeChatMessages } from '@/lib/chatMessages';
import { chatWaveform } from '@/lib/chatWaveform';
import { subscribeZikrChat, subscribeZikrReads, getChatCache, putChatCache, clearChatCache } from '@/lib/zikrChatLive';
import { getMessages, sendMessage, deleteChatMessage, editChatMessage, forwardChatMessage, readChatMessages, getChatReaders, listGroups, reactChatMessage } from '@/lib/zikrCollectif';
import ChatImageEditor from './ChatImageEditor';
import VoiceComposer from './VoiceComposer';
const Modal = ModalUntyped as any; const EmojiPicker = EmojiPickerUntyped as any; const AudioMessage = AudioMessageUntyped as any;

type Message = { id: string; uid: string; email?: string; name?: string; picture?: string; at: number; text: string; version?: number; reactions?: Record<string, string>; deleted?: boolean; editedAt?: number; forwarded?: boolean; replyTo?: string; reply?: any; mediaType?: 'image' | 'audio'; mediaUrl?: string; mediaDuration?: number; mediaWaveform?: number[] };
type Props = { groupId: string; uid: string; active: boolean; onUnread: Dispatch<SetStateAction<number>>; notify: (message: string) => void };
const time = (value: number) => new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const preview = (message: any) => message?.deleted ? 'Message supprimé' : message?.text || (message?.mediaType === 'image' ? 'Photo' : message?.mediaType === 'audio' ? 'Message vocal' : 'Message');
const merge = mergeChatMessages as (previous: Message[], incoming: Message[]) => Message[];
export default function ZikrMessenger({ groupId, uid, active, onUnread, notify }: Props) {
  const [messages, setMessages] = useState<Message[]>(() => getChatCache(uid, groupId));
  const [quoteUpdates, setQuoteUpdates] = useState<Record<string, Message>>({});
  const [text, setText] = useState(''); const [reply, setReply] = useState<Message | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [hasOlder, setHasOlder] = useState(false); const [loadingOlder, setLoadingOlder] = useState(false);
  const [newBelow, setNewBelow] = useState(0);
  const [menu, setMenu] = useState<Message | null>(null); const [copyText, setCopyText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null); const [editText, setEditText] = useState('');
  const [image, setImage] = useState<{ file: File; message?: Message } | null>(null);
  const [zoomed, setZoomed] = useState<Message | null>(null); const [zoom, setZoom] = useState(1);
  const [forwarding, setForwarding] = useState<Message | null>(null); const [destinations, setDestinations] = useState<any[]>([]); const [destination, setDestination] = useState('');
  const [info, setInfo] = useState<Message | null>(null); const [readers, setReaders] = useState<any[]>([]); const [infoLoading, setInfoLoading] = useState(false);
  const infoRequest = useRef(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [unsent, setUnsent] = useState<Blob | null>(null); const [unsentDuration, setUnsentDuration] = useState(0); const [unsentReply, setUnsentReply] = useState<string | null>(null); const [unsentUrl, setUnsentUrl] = useState('');
  const [voiceChecking, setVoiceChecking] = useState(false); const voiceStarting = useRef(false);
  const listRef = useRef<HTMLDivElement>(null); const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null); const cameraRef = useRef<HTMLInputElement>(null);
  const nearBottom = useRef(true); const forceBottom = useRef(false); const entered = useRef(false);
  const anchor = useRef<{ top: number; height: number } | null>(null);
  const cursor = useRef({ after: null as string | null, changeAfter: null as string | null, fullAt: 0, sequence: 0, initialized: false });
  const activeRef = useRef(active); activeRef.current = active;
  const alive = useRef(true); useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const overlayOpen = !!(menu || confirmDelete || editing || image || zoomed || forwarding || info || copyText);
  const seen = useRef(new Set<string>());
  const gesture = useRef<{ x: number; y: number; timer?: ReturnType<typeof setTimeout>; swiped: boolean } | null>(null);
  useEffect(() => () => { if (gesture.current) clearTimeout(gesture.current.timer); }, []);
  const replied = useRef(reply); replied.current = reply;
  const load = useCallback(async () => {
    const state = cursor.current; const sequence = ++state.sequence;
    const full = Date.now() - state.fullAt >= 60000;
    try {
      const data = await getMessages(groupId, full ? undefined : state.after || undefined, { limit: 50, withChanges: true, ...(state.changeAfter ? { changeAfter: state.changeAfter } : {}) });
      if (!alive.current || sequence !== state.sequence) return;
      const incoming: Message[] = data.messages || [];
      const additions = state.initialized ? incoming.filter((message) => (!state.after || message.id > state.after) && message.uid !== uid) : [];
      if (additions.length) {
        playNotificationBeep();
        if (!activeRef.current) onUnread((value) => value + additions.length);
        else if (!nearBottom.current) setNewBelow((value) => value + additions.length);
      }
      if (!state.initialized) setHasOlder(!!data.hasOlder);
      state.initialized = true;
      const last = incoming.at(-1); if (last && (!state.after || last.id > state.after)) state.after = last.id;
      if (full) state.fullAt = Date.now();
      if (data.changeCursor) state.changeAfter = data.changeCursor;
      const changes: Message[] = data.changes || [];
      setMessages((previous) => merge(merge(previous, incoming), changes.filter((change) => previous.some((item) => item.id === change.id) || incoming.some((item) => item.id === change.id))));
      setQuoteUpdates((previous) => Object.fromEntries(merge(Object.values(previous), changes).map((message) => [message.id, message])));
      setError('');
    } catch (failure: any) {
      if (!alive.current) return;
      setError(failure.message || 'Impossible de charger la discussion.');
      if (failure.status === 403) { clearChatCache(uid, groupId); state.after = null; state.fullAt = 0; state.initialized = false; setMessages([]); setQuoteUpdates({}); }
    }
  }, [groupId, uid, onUnread]);
  useEffect(() => startVisiblePolling(load, 12000, { push: true }), [load]);
  useEffect(() => subscribeZikrChat(groupId, load), [groupId, load]);
  useEffect(() => subscribeZikrReads(groupId, uid, (current) => setCounts((previous) => ({ ...previous, ...current }))), [groupId, uid]);
  useEffect(() => { if (messages.length) putChatCache(uid, groupId, messages); }, [messages, groupId, uid]);
  useEffect(() => { if (active) onUnread(0); }, [active, onUnread]);
  useLayoutEffect(() => {
    const list = listRef.current; if (!list || !active) return;
    if (anchor.current) {
      list.scrollTop = anchor.current.top + list.scrollHeight - anchor.current.height; anchor.current = null;
    } else if (!entered.current || forceBottom.current || nearBottom.current) {
      list.scrollTop = list.scrollHeight; nearBottom.current = true; setNewBelow(0);
    }
    entered.current = true; forceBottom.current = false;
  }, [messages, active]);
  useEffect(() => {
    const list = listRef.current; if (!list || !active || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => { if (nearBottom.current && !anchor.current) list.scrollTop = list.scrollHeight; });
    observer.observe(list); return () => observer.disconnect();
  }, [active]);
  useEffect(() => {
    const input = inputRef.current; if (!input) return;
    input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }, [text, active]);
  useEffect(() => {
    if (!unsent) { setUnsentUrl(''); return; }
    const url = URL.createObjectURL(unsent); setUnsentUrl(url); return () => URL.revokeObjectURL(url);
  }, [unsent]);

  // Only actual visible bubbles qualify. Polling another tab or jumping to
  // the bottom never marks off-screen history as read.
  useEffect(() => {
    const root = listRef.current; if (!active || overlayOpen || !root || typeof IntersectionObserver === 'undefined') return;
    let stopped = false; let batch: ReturnType<typeof setTimeout> | undefined;
    const timers = new Map<string, ReturnType<typeof setTimeout>>(); const pending = new Set<string>();
    const flush = async () => {
      const ids = [...pending].slice(0, 50); pending.clear(); if (!ids.length) return;
      try { await readChatMessages(groupId, ids); if (!stopped) ids.forEach((id) => seen.current.add(id)); }
      catch { /* A later visible-poll reconciliation retries unsent receipts. */ }
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.chatId!;
        const visible = entry.isIntersecting && entry.intersectionRect.height >= Math.min(40, entry.boundingClientRect.height * .6);
        if (!visible) { clearTimeout(timers.get(id)); timers.delete(id); continue; }
        if (seen.current.has(id) || timers.has(id)) continue;
        timers.set(id, setTimeout(() => {
          timers.delete(id);
          if (stopped || document.visibilityState === 'hidden' || !document.hasFocus() || document.querySelector('dialog[open]')) return;
          pending.add(id); clearTimeout(batch); batch = setTimeout(flush, 250);
        }, 700));
      }
    }, { root, threshold: [0, .1, .6, 1] });
    const observe = () => {
      observer.disconnect(); timers.forEach(clearTimeout); timers.clear(); pending.clear(); clearTimeout(batch);
      if (document.visibilityState === 'hidden' || !document.hasFocus()) return;
      root.querySelectorAll('[data-chat-id]').forEach((element) => {
        const message = messages.find((m) => m.id === (element as HTMLElement).dataset.chatId);
        if (message && message.uid !== uid && !message.deleted && !seen.current.has(message.id)) observer.observe(element);
      });
    };
    observe(); document.addEventListener('visibilitychange', observe); window.addEventListener('focus', observe); window.addEventListener('blur', observe);
    return () => { stopped = true; observer.disconnect(); timers.forEach(clearTimeout); clearTimeout(batch); document.removeEventListener('visibilitychange', observe); window.removeEventListener('focus', observe); window.removeEventListener('blur', observe); };
  }, [active, messages, groupId, uid, overlayOpen]);

  const older = async () => {
    if (loadingOlder || !messages.length) return; setLoadingOlder(true);
    try {
      const data = await getMessages(groupId, undefined, { before: messages[0].id, limit: 50 });
      const list = listRef.current; if (list) anchor.current = { top: list.scrollTop, height: list.scrollHeight };
      setMessages((previous) => merge(previous, data.messages || [])); setHasOlder(!!data.hasOlder);
    } catch (failure: any) { setError(failure.message); }
    finally { setLoadingOlder(false); }
  };
  const sendText = async () => {
    if (!text.trim() || busy) return; setBusy(true); setError('');
    const submitted = text, replyId = reply?.id;
    try { await sendMessage(groupId, submitted.trim(), undefined, replyId); setText((current) => current === submitted ? '' : current); setReply((current) => current?.id === replyId ? null : current); forceBottom.current = true; await load(); }
    catch (failure: any) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const sendVoice = useCallback(async (blob: Blob, duration: number, overrideReply?: string | null) => {
    const replyId = overrideReply !== undefined ? overrideReply : replied.current?.id;
    setBusy(true); setError('');
    try {
      const [url, waveform] = await Promise.all([uploadZikrChatMedia(blob, groupId, 'video'), chatWaveform(blob)]);
      await sendMessage(groupId, '', { type: 'audio', url, duration, waveform }, replyId || undefined);
      setReply((current) => current?.id === replyId ? null : current); setUnsent(null); forceBottom.current = true; await load();
    } catch (failure: any) { setUnsent(blob); setUnsentDuration(duration); setUnsentReply(replyId || null); setError(failure.message || 'Votre vocal n’a pas pu être envoyé.'); }
    finally { setBusy(false); }
  }, [groupId, load]);
  const interruptedVoice = useCallback((blob: Blob, duration: number) => {
    setUnsent(blob); setUnsentDuration(duration); setUnsentReply(replied.current?.id || null);
    setError('Enregistrement interrompu en quittant la discussion. Votre vocal est conservé dans cette page.');
  }, []);
  const voice = useVoiceRecorder(sendVoice, interruptedVoice);
  const startVoice = async () => {
    if (voiceStarting.current || busy || unsent) return;
    voiceStarting.current = true; setVoiceChecking(true); setError('');
    try { await checkZikrAudio(groupId); await voice.start(); }
    catch (failure: any) { setError(failure.message || 'Microphone indisponible. Vérifiez son autorisation.'); }
    finally { voiceStarting.current = false; setVoiceChecking(false); }
  };
  const saveImage = async (file: File, caption: string) => {
    setBusy(true);
    try {
      const url = await uploadZikrChatMedia(file, groupId, 'image');
      if (image?.message) {
        const data = await editChatMessage(groupId, image.message.id, caption, { type: 'image', url });
        setMessages((previous) => merge(previous, [data.message]));
      } else {
        await sendMessage(groupId, caption, { type: 'image', url }, reply?.id);
        setReply(null); forceBottom.current = true;
      }
      setImage(null); await load();
    } finally { setBusy(false); }
  };
  const chooseImage = (file?: File) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { setError('Cette image est trop volumineuse (25 Mo maximum avant préparation).'); return; }
    setImage({ file });
  };
  const modifyImage = async (message: Message) => {
    setMenu(null); setBusy(true); setError('');
    try {
      const response = await fetch(message.mediaUrl!, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error('Cette image ne peut pas être chargée.');
      const blob = await response.blob(); if (blob.size > 25 * 1024 * 1024) throw new Error('Image trop volumineuse.');
      setImage({ file: new File([blob], 'image.jpg', { type: blob.type || 'image/jpeg' }), message });
    } catch { setError('Impossible de charger l’image à modifier. Vérifiez votre connexion.'); }
    finally { setBusy(false); }
  };
  const openForward = async (message: Message) => {
    setMenu(null); setBusy(true); setError('');
    try { const data = await listGroups(); setDestinations((data.groups || []).filter((g: any) => ['owner', 'member'].includes(g.status))); setDestination(''); setForwarding(message); }
    catch (failure: any) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const openInfo = async (message: Message) => {
    const request = ++infoRequest.current;
    setMenu(null); setInfo(message); setReaders([]); setInfoLoading(true);
    try { const data = await getChatReaders(groupId, message.id); if (request !== infoRequest.current) return; setReaders(data.readers || []); setCounts((previous) => ({ ...previous, [message.id]: data.readers?.length || 0 })); }
    catch (failure: any) { if (request === infoRequest.current) { setError(failure.message); setInfo(null); } }
    finally { if (request === infoRequest.current) setInfoLoading(false); }
  };
  const jump = async (id: string) => {
    let element = document.getElementById('zk-message-' + id);
    if (!element) { setError('Ce message est plus ancien. Chargez les messages précédents pour le retrouver.'); return; }
    element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    element.classList.add('zk-message-highlight'); setTimeout(() => element?.classList.remove('zk-message-highlight'), 1800);
  };
  const perform = async (operation: () => Promise<any>) => {
    if (busy) return; setBusy(true); setError('');
    try { await operation(); await load(); }
    catch (failure: any) { setError(failure.message || 'Cette action n’a pas pu être effectuée.'); }
    finally { setBusy(false); }
  };

  return <section className="zk-chat-panel zk-messenger" aria-label="Discussion du Zikr collectif" style={!active ? { display: 'none' } : undefined}>
    <div className="zk-chat-list" ref={listRef} tabIndex={0} role="log" aria-live={entered.current ? 'polite' : 'off'} aria-label="Messages de la discussion" onScroll={() => {
      const list = listRef.current; if (!list) return;
      nearBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
      if (nearBottom.current) setNewBelow(0);
    }}>
      {hasOlder && <button type="button" className="zk-history-button" onClick={older} disabled={loadingOlder}>{loadingOlder ? 'Chargement…' : 'Charger les messages précédents'}</button>}
      {!messages.length && <p className="zk-muted">Aucun message pour l’instant — lancez la discussion !</p>}
      {messages.map((message, index) => {
        const mine = message.uid === uid;
        const previous = messages[index - 1];
        const first = !previous || previous.uid !== message.uid || message.at - previous.at > 300000;
        const date = new Date(message.at).toLocaleDateString('fr-FR');
        const showDate = !previous || new Date(previous.at).toLocaleDateString('fr-FR') !== date;
        const candidates = message.replyTo ? [message.reply, messages.find((m) => m.id === message.replyTo), quoteUpdates[message.replyTo]].filter(Boolean) : [];
        const quote = candidates.find((candidate) => candidate.deleted) || candidates.sort((a, b) => (b.version || 0) - (a.version || 0))[0];
        return <div key={message.id}>
          {showDate && <p className="zk-chat-date">{date}</p>}
          <article id={'zk-message-' + message.id} data-chat-id={message.id} className={'zk-chat-group' + (mine ? ' me' : '') + (!first && !showDate ? ' zk-message-continuation' : '')} onContextMenu={(event) => { if (!message.deleted) { event.preventDefault(); setMenu(message); } }}
            onPointerDown={(event) => {
              if (message.deleted || (event.target as HTMLElement).closest('button,input,a,textarea,audio')) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              const state = { x: event.clientX, y: event.clientY, swiped: false, timer: undefined as ReturnType<typeof setTimeout> | undefined };
              state.timer = setTimeout(() => { setMenu(message); state.timer = undefined; }, 550); gesture.current = state;
            }} onPointerMove={(event) => {
              const state = gesture.current; if (!state) return;
              const dx = event.clientX - state.x, dy = event.clientY - state.y;
              if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearTimeout(state.timer);
              state.swiped = dx > 64 && Math.abs(dy) < 30;
              if (dx > 12 && Math.abs(dy) < 20) event.currentTarget.style.transform = `translateX(${Math.min(64, dx)}px)`;
            }} onPointerUp={(event) => {
              const state = gesture.current; if (!state) return;
              clearTimeout(state.timer); gesture.current = null; event.currentTarget.style.transform = '';
              if (state.swiped) { setReply(message); inputRef.current?.focus(); }
            }} onPointerCancel={(event) => { if (gesture.current) clearTimeout(gesture.current.timer); gesture.current = null; event.currentTarget.style.transform = ''; }}>
            {!mine && first && (message.picture ?
              /* eslint-disable-next-line @next/next/no-img-element -- Existing group profile avatar. */
              <img className="zk-chat-avatar" src={message.picture} alt="" loading="lazy" /> : <span className="zk-chat-avatar zk-chat-avatar-fallback">{chatDisplayName(message.email, message.name).slice(0, 1).toUpperCase()}</span>)}
            <div className="zk-chat-bubbles">
              {!mine && first && <span className="zk-chat-author">{chatDisplayName(message.email, message.name)}</span>}
              <div className={'zk-chat-msg' + (message.deleted ? ' deleted' : '')}>
                {message.deleted ? <p className="zk-chat-text">Message supprimé</p> : <>
                  {message.forwarded && <small className="zk-forwarded"><Forward size={12} aria-hidden="true" /> Transféré</small>}
                  {quote && <button type="button" className="zk-reply-preview" onClick={() => jump(message.replyTo!)}>
                    <strong>{quote.deleted ? '' : chatDisplayName(quote.email, quote.name)}</strong><span>{preview(quote)}</span>
                  </button>}
                  {message.mediaType === 'image' && message.mediaUrl && <button type="button" className="zk-photo-open" onClick={() => { setZoom(1); setZoomed(message); }} aria-label="Agrandir la photo">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Public Cloudinary image. */}
                    <img className="zk-chat-media-img" src={message.mediaUrl} alt={message.text || 'Photo partagée dans le groupe'} loading="lazy" />
                  </button>}
                  {message.mediaType === 'audio' && message.mediaUrl && <AudioMessage src={message.mediaUrl} duration={message.mediaDuration} waveform={message.mediaWaveform} onListened={() => {
                    if (!mine && activeRef.current && document.visibilityState !== 'hidden') readChatMessages(groupId, [message.id], 'played').catch(() => {});
                  }} />}
                  {message.text && <p className="zk-chat-text" dir="auto">{message.text}</p>}
                  <button type="button" className="zk-message-menu" aria-label={`Actions du message de ${mine ? 'vous' : chatDisplayName(message.email, message.name)}`} onClick={() => setMenu(message)}><MoreVertical size={17} aria-hidden="true" /></button>
                </>}
                {!message.deleted && message.reactions && <div className="zk-message-reactions">{Object.entries(Object.values(message.reactions).reduce((values: Record<string, number>, emoji) => ({ ...values, [emoji]: (values[emoji] || 0) + 1 }), {})).map(([emoji, count]) =>
                  <button type="button" key={emoji} aria-label={`Réaction ${emoji} : ${count}`} aria-pressed={message.reactions?.[uid] === emoji} onClick={() => perform(async () => { const data = await reactChatMessage(groupId, message.id, emoji); setMessages((previous) => merge(previous, [data.message])); })}>{emoji} {count}</button>)}</div>}
                <div className="zk-message-meta"><span>{message.editedAt ? 'Modifié · ' : ''}{time(message.at)}</span>
                  {mine && !message.deleted && <button type="button" onClick={() => openInfo(message)} aria-label="Informations de lecture"><Check size={13} aria-hidden="true" />{counts[message.id] ? `Vu par ${counts[message.id]}` : 'Envoyé'}</button>}
                </div>
              </div>
            </div>
          </article>
        </div>;
      })}
    </div>
    {newBelow > 0 && <button className="zk-new-messages" type="button" onClick={() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; nearBottom.current = true; setNewBelow(0); }}><ArrowDown size={16} /> {newBelow} nouveau{newBelow > 1 ? 'x' : ''} message{newBelow > 1 ? 's' : ''}</button>}
    {error && !menu && !confirmDelete && !editing && !forwarding && !info && <p role="alert" className="zk-chat-feedback">{error}</p>}
    {reply && <div className="zk-compose-reply"><div><strong>Répondre à {chatDisplayName(reply.email, reply.name)}</strong><p>{preview(reply)}</p></div><button type="button" aria-label="Annuler la réponse" onClick={() => setReply(null)}><X size={18} /></button></div>}
    {voiceChecking && <p role="status" className="zk-muted">Vérification de l’envoi de vocaux…</p>}
    {unsent && <div className="zk-unsent-voice"><p>Votre vocal est conservé dans cette page. Enregistrez-le avant de la quitter.</p>
      {unsentUrl && <a className="zk-btn ghost" href={unsentUrl} download={'asrar-vocal.' + (unsent.type.includes('mp4') ? 'm4a' : unsent.type.includes('ogg') ? 'ogg' : 'webm')}>Enregistrer mon vocal</a>}
      <button type="button" className="zk-btn ghost" disabled={busy} onClick={() => sendVoice(unsent, unsentDuration, unsentReply)}>Réessayer l’envoi du vocal</button>
      <button type="button" className="zk-btn ghost" onClick={() => { setUnsent(null); setError(''); }}>Supprimer le vocal non envoyé</button>
    </div>}
    <div className="zk-chat-input-row zk-chat-composer">
      <div className="zk-composer-body" style={{ display: voice.recording ? 'none' : 'contents' }}>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => { chooseImage(event.target.files?.[0]); event.target.value = ''; }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(event) => { chooseImage(event.target.files?.[0]); event.target.value = ''; }} />
      <details className="zk-attach-menu"><summary className="zk-chat-tool" aria-label="Joindre une image"><ImagePlus size={18} /></summary><div className="zk-attach-popover">
        <button type="button" disabled={busy} onClick={(event) => { event.currentTarget.closest('details')!.open = false; fileRef.current?.click(); }}>Choisir une photo</button>
        <button type="button" disabled={busy} onClick={(event) => { event.currentTarget.closest('details')!.open = false; cameraRef.current?.click(); }}><Camera size={16} /> Prendre une photo</button>
      </div></details>
      <div className="zk-chat-field"><EmojiPicker onPick={(emoji: string) => setText((value) => (value + emoji).slice(0, CHAT_MESSAGE_MAX))} />
        <textarea dir="auto" ref={inputRef} aria-label="Écrire un message" rows={1} maxLength={CHAT_MESSAGE_MAX} value={text} placeholder="Écrire un message…" onChange={(event) => setText(event.target.value)} onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void sendText(); }
        }} /></div>
      <button type="button" style={{ display: text.trim() ? undefined : 'none' }} className="zk-chat-send" onClick={sendText} disabled={busy || !text.trim()} aria-label="Envoyer"><Send size={18} /></button>
      </div>
      <VoiceComposer voice={voice} show={voice.recording || !text.trim()} disabled={busy || voiceChecking || !!unsent} active={active} onStart={startVoice} maxSeconds={CHAT_AUDIO_MAX_S} />
    </div>
    {copyText && <Modal className="zk-messenger-overlay" label="Copier le message" onClose={() => setCopyText('')}><div className="zk-media-dialog"><h2>Copier le message</h2><textarea aria-label="Texte à copier" value={copyText} readOnly onFocus={(event) => event.currentTarget.select()} /><button type="button" onClick={() => setCopyText('')}>Fermer</button></div></Modal>}
    {menu && <Modal className="zk-messenger-overlay" label="Actions du message" onClose={() => setMenu(null)}><div className="zk-media-dialog zk-message-actions">{error && <p role="alert" className="zk-error">{error}</p>}
      <div className="zk-reaction-picker">{['❤️', '👍', '🤲', '😂', '😮', '😢'].map((emoji) => <button type="button" key={emoji} aria-label={`Réagir avec ${emoji}`} onClick={() => perform(async () => { const data = await reactChatMessage(groupId, menu.id, emoji); setMessages((previous) => merge(previous, [data.message])); setMenu(null); })}>{emoji}</button>)}</div>
      <button type="button" onClick={() => { setReply(menu); setMenu(null); inputRef.current?.focus(); }}><Reply size={18} /> Répondre</button>
      {menu.text && <button type="button" onClick={async () => { const value = menu.text; setMenu(null); try { await navigator.clipboard.writeText(value); notify('Texte copié.'); } catch { setCopyText(value); } }}><Copy size={18} /> Copier le texte</button>}
      <button type="button" onClick={() => openForward(menu)} disabled={busy}><Forward size={18} /> Transférer</button>
      {menu.uid === uid && <>
        <button type="button" onClick={() => openInfo(menu)}><Info size={18} /> Informations de lecture</button>
        {menu.mediaType !== 'audio' && <button type="button" onClick={() => {
          if (menu.mediaType === 'image') void modifyImage(menu);
          else { setEditing(menu); setEditText(menu.text); setMenu(null); }
        }}><Pencil size={18} /> {menu.mediaType === 'image' ? 'Modifier l’image' : 'Modifier le texte'}</button>}
        <button type="button" className="zk-danger" onClick={() => { setConfirmDelete(menu); setMenu(null); }}><Trash2 size={18} /> Supprimer pour le groupe</button>
      </>}
      <button type="button" onClick={() => setMenu(null)}>Fermer</button>
    </div></Modal>}
    {confirmDelete && <Modal className="zk-messenger-overlay" label="Supprimer le message" onClose={() => { if (!busy) setConfirmDelete(null); }}><div className="zk-media-dialog">
      {error && <p role="alert" className="zk-error">{error}</p>}<h2>Supprimer ce message ?</h2><p>Il sera retiré de cette discussion pour tous les participants. Les copies déjà transférées restent dans leurs discussions.</p>
      <div className="zk-editor-tools"><button type="button" disabled={busy} onClick={() => setConfirmDelete(null)}>Annuler</button><button type="button" className="zk-btn main" disabled={busy} onClick={() => perform(async () => {
        const data = await deleteChatMessage(groupId, confirmDelete.id); setMessages((previous) => merge(previous, [data.message])); setQuoteUpdates((previous) => ({ ...previous, [data.message.id]: data.message })); if (reply?.id === confirmDelete.id) setReply(null); setConfirmDelete(null);
      })}>Supprimer</button></div>
    </div></Modal>}
    {editing && <Modal className="zk-messenger-overlay" label="Modifier le message" onClose={() => { if (!busy) setEditing(null); }}><div className="zk-media-dialog">
      {error && <p role="alert" className="zk-error">{error}</p>}<h2>Modifier le message</h2><textarea aria-label="Texte du message modifié" maxLength={CHAT_MESSAGE_MAX} value={editText} onChange={(event) => setEditText(event.target.value)} />
      <div className="zk-editor-tools"><button type="button" disabled={busy} onClick={() => setEditing(null)}>Annuler</button><button type="button" className="zk-btn main" disabled={busy || !editText.trim()} onClick={() => perform(async () => {
        const data = await editChatMessage(groupId, editing.id, editText.trim()); setMessages((previous) => merge(previous, [data.message])); setEditing(null);
      })}>Enregistrer</button></div>
    </div></Modal>}
    {image && <ChatImageEditor key={image.file.name + image.file.lastModified} file={image.file} caption={image.message?.text || ''} onClose={() => setImage(null)} onSave={saveImage} />}
    {zoomed && <Modal className="zk-messenger-overlay" label="Photo agrandie" onClose={() => setZoomed(null)}><div className="zk-media-dialog zk-image-viewer">
      <div className="zk-editor-tools"><label>Zoom<input type="range" min="1" max="4" step=".25" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label><button type="button" onClick={() => setZoomed(null)}>Fermer</button></div>
      <div className="zk-zoom-scroll">
        {/* eslint-disable-next-line @next/next/no-img-element -- Same Cloudinary image, locally zoomed. */}
        <img src={zoomed.mediaUrl} alt={zoomed.text || 'Photo du groupe'} style={{ width: zoom * 100 + '%', maxWidth: 'none' }} onDoubleClick={() => setZoom((value) => value > 1 ? 1 : 2)} />
      </div>
      {zoomed.text && <p>{zoomed.text}</p>}
    </div></Modal>}
    {forwarding && <Modal className="zk-messenger-overlay" label="Transférer le message" onClose={() => { if (!busy) setForwarding(null); }}><div className="zk-media-dialog">
      {error && <p role="alert" className="zk-error">{error}</p>}<h2>Transférer vers un Zikr</h2><p>{preview(forwarding)}</p><label>Discussion de destination<select value={destination} onChange={(event) => setDestination(event.target.value)}><option value="">Choisir un groupe</option>{destinations.map((group) => <option key={group.id} value={group.id}>{group.name}{group.id === groupId ? ' (ce groupe)' : ''}</option>)}</select></label>
      <div className="zk-editor-tools"><button type="button" disabled={busy} onClick={() => setForwarding(null)}>Annuler</button><button type="button" className="zk-btn main" disabled={!destination || busy} onClick={() => perform(async () => { await forwardChatMessage(groupId, forwarding.id, destination); setForwarding(null); notify('Message transféré.'); })}>Transférer</button></div>
    </div></Modal>}
    {info && <Modal className="zk-messenger-overlay" label="Informations de lecture" onClose={() => { infoRequest.current++; setInfo(null); }}><div className="zk-media-dialog">
      <h2>{infoLoading ? 'Informations de lecture' : `Vu par ${readers.length} participant${readers.length > 1 ? 's' : ''}`}</h2>
      {infoLoading ? <p role="status">Chargement…</p> : readers.length ? <ul className="zk-readers">{readers.map((reader) => <li key={reader.uid}><strong>{reader.name}</strong><span>Vu le {new Date(reader.at).toLocaleString('fr-FR')}</span>{reader.playedAt && <span>Lecture du vocal terminée le {new Date(reader.playedAt).toLocaleString('fr-FR')}</span>}</li>)}</ul> : <p>Aucune lecture confirmée pour le moment.</p>}
      <div className="zk-editor-tools"><button type="button" disabled={infoLoading} onClick={() => openInfo(info)}>Actualiser</button><button type="button" onClick={() => { infoRequest.current++; setInfo(null); }}>Fermer</button></div>
    </div></Modal>}
  </section>;
}
