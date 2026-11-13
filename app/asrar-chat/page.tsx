'use client';
// Module « Asrar-chat » — messagerie sociale et commerciale : discussions
// privées, groupes et chaînes, publications gratuites ou payantes, achat par
// paiement DIRECT au vendeur (Wave, PI-SPI, WhatsApp), bibliothèque, ventes
// et administration. Architecture : ASRAR_CHAT.md ; API : pages/api/asrar-chat.js.
import './asrar-chat.css';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MessagesSquare, Compass, PlusSquare, ShoppingBag, UserRound, ShieldAlert } from 'lucide-react';
import { useToast } from '@/components/useToast';
import { ac } from '@/lib/asrarChat/client';
import { Loading, ErrorState } from './ui';
import { AcCtx, type AcContext, type Tab } from './context';
import Chats from './Chats';
import ChatRoom from './ChatRoom';
import Explore from './Explore';
import Publish from './Publish';
import Purchases from './Purchases';
import Profile, { ProfileForm } from './Profile';
import PostSheet from './PostSheet';
import OrderSheet from './OrderSheet';
import Storefront from './Storefront';

const TABS: { id: Tab; label: string; Icon: any }[] = [
  { id: 'chats', label: 'Discussions', Icon: MessagesSquare },
  { id: 'explore', label: 'Explorer', Icon: Compass },
  { id: 'publish', label: 'Publier', Icon: PlusSquare },
  { id: 'purchases', label: 'Achats', Icon: ShoppingBag },
  { id: 'profile', label: 'Profil', Icon: UserRound },
];

export default function AsrarChatPage() {
  const { notify, toast } = useToast();
  const [me, setMe] = useState<any>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('chats');
  const [chat, setChat] = useState<string | null>(null);
  const [post, setPost] = useState<{ pid: string; moderation: boolean } | null>(null);
  const [order, setOrder] = useState<string | null>(null);
  const [profile, setProfile] = useState<string | null>(null);
  const [publishCid, setPublishCid] = useState<string | null>(null);

  const reloadMe = useCallback(async () => {
    try { setMe(await ac('me')); setError(''); }
    catch (e: any) { setError(e.message || 'Connexion impossible.'); }
  }, []);
  useEffect(() => { reloadMe(); }, [reloadMe]);

  // Liens profonds : ?c= discussion, ?p= publication, ?o= commande,
  // ?u= pseudonyme, ?join= invitation.
  useEffect(() => {
    if (!me?.profile) return;
    const params = new URLSearchParams(window.location.search);
    const c = params.get('c'), p = params.get('p'), o = params.get('o'), u = params.get('u'), join = params.get('join');
    if (c || p || o || u || join) window.history.replaceState(null, '', '/asrar-chat');
    if (c) setChat(c);
    if (p) setPost({ pid: p, moderation: false });
    if (o) setOrder(o);
    if (u) ac('profile.get', { handle: u }).then((r) => setProfile(r.profile.uid)).catch((e) => notify(e.message, 'error'));
    if (join) ac('conv.join', { inviteCode: join }).then((r) => { setChat(r.id); notify('Vous avez rejoint la discussion.', 'success'); }).catch((e) => notify(e.message, 'error'));
  }, [me?.profile, notify]);

  const value: AcContext = {
    me, reloadMe, notify,
    openChat: (cid) => { setPost(null); setOrder(null); setProfile(null); setChat(cid); },
    openPost: (pid, moderation = false) => setPost({ pid, moderation }),
    openOrder: (oid) => setOrder(oid),
    openProfile: (uid) => setProfile(uid),
    publishIn: (cid) => { setPublishCid(cid); setChat(null); setTab('publish'); },
    setTab,
  };

  let body;
  if (error && !me) body = <ErrorState error={error} onRetry={reloadMe} />;
  else if (!me) body = <Loading />;
  else if (me.suspended) body = (
    <div className="ac-suspended" role="alert">
      <ShieldAlert size={32} aria-hidden="true" />
      <h2>Compte suspendu</h2>
      <p>Votre compte Asrar-chat a été suspendu à la suite d’un signalement. Contactez l’administration pour en savoir plus.</p>
    </div>
  );
  else if (!me.profile) body = (
    <div className="ac-onboarding">
      <h2>Bienvenue sur Asrar-chat</h2>
      <p>Discutez gratuitement, rejoignez des groupes et des chaînes, et vendez vos contenus et services. Choisissez d’abord votre pseudonyme.</p>
      <ProfileForm onSaved={reloadMe} />
    </div>
  );
  else body = (
    <>
      <main className="ac-main">
        {tab === 'chats' && <Chats />}
        {tab === 'explore' && <Explore />}
        {tab === 'publish' && <Publish initialCid={publishCid} onDone={() => { setPublishCid(null); setTab('profile'); }} />}
        {tab === 'purchases' && <Purchases />}
        {tab === 'profile' && <Profile />}
      </main>
      <nav className="ac-nav" aria-label="Asrar-chat">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} type="button" className={'ac-nav-item' + (tab === id ? ' active' : '')} aria-current={tab === id ? 'page' : undefined}
            onClick={() => { setTab(id); if (id !== 'publish') setPublishCid(null); }}>
            <span className="ac-nav-pill"><Icon size={22} strokeWidth={tab === id ? 2.4 : 1.9} aria-hidden="true" /></span>
            <span className="ac-nav-label">{label}</span>
          </button>
        ))}
      </nav>
      {chat && <ChatRoom cid={chat} onClose={() => setChat(null)} />}
      {profile && <Storefront uid={profile} onClose={() => setProfile(null)} />}
      {post && <PostSheet key={post.pid} pid={post.pid} moderation={post.moderation} onClose={() => setPost(null)} />}
      {order && <OrderSheet oid={order} onClose={() => setOrder(null)} />}
    </>
  );

  return (
    <AcCtx.Provider value={value}>
      <div className="ac-app">
        <header className="ac-top">
          <Link href="/menu" className="ac-icon-btn" aria-label="Retour au menu"><ArrowLeft size={20} /></Link>
          <h1>Asrar-chat</h1>
        </header>
        {body}
        {toast}
      </div>
    </AcCtx.Provider>
  );
}
