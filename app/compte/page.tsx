'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import ViewState from '@/components/ViewState';
import { useAuth } from '@/components/AuthProvider';
import { apiPost } from '@/lib/api';
import { SUB_PLANS, FREE_FOR_ALL } from '@/lib/plans';
import ModalUntyped from '@/components/Modal';
import './compte.css';
const Modal = ModalUntyped as any;
const subscriptionContact = '/api/wa?text=Je%20souhaite%20v%C3%A9rifier%20ou%20renouveler%20mon%20abonnement%20ASRAR%20PRO.';
const REQUEST_LABELS: Record<string, string> = { pending: 'En attente', processing: 'En cours', completed: 'Traitement clôturé', rejected: 'Demande refusée' };
const date = (value: number | string) => new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export default function ComptePage() {
  const { user, signOut } = useAuth() as any;
  const [data, setData] = useState<any>(null), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false), [reauth, setReauth] = useState(false), [confirm, setConfirm] = useState(false);
  const [email, setEmail] = useState(''), [name, setName] = useState('');
  const [requests, setRequests] = useState<any[]>([]), [responses, setResponses] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    try { const value = await apiPost('account'); setData(value); setName(value.account.name); setError(''); }
    catch (e: any) { setError(e.message); setReauth(e.status === 401); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const loadRequests = useCallback(async () => {
    try { setRequests((await apiPost('account', { action: 'privacy-list' })).items); }
    catch (e: any) { setError(e.message); }
  }, []);
  useEffect(() => { if (data?.subscription.admin) void loadRequests(); }, [data?.subscription.admin, loadRequests]);
  const act = async (work: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('');
    try { await work(); }
    catch (e: any) { setError(e.message || 'Action indisponible. Réessayez.'); setReauth(e.status === 401); if (e.status === 401) setConfirm(false); }
    finally { setBusy(false); }
  };
  const saveSettings = (analytics: boolean, pushEnabled: boolean) => act(async () => {
    await apiPost('account', { action: 'settings', analytics, pushEnabled });
    await load(); setMessage('Vos préférences sont enregistrées.');
  });
  const exportData = () => act(async () => {
    const value = await apiPost('account', { action: 'export' });
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'asrar-mes-donnees.json';
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(value.truncated ? 'Export partiel téléchargé. Demandez un export complet pour obtenir les historiques complémentaires.' : 'Vos données disponibles ont été téléchargées.');
  });
  const privacy = (kind: string) => act(async () => {
    const result = await apiPost('account', { action: 'request-privacy', kind });
    setConfirm(false); setEmail(''); await load();
    setMessage(result.request.kind === kind ? 'Votre demande est enregistrée et sera examinée par l’administration.' : 'Une autre demande est déjà en cours.');
  });
  const subscription = data?.subscription;
  const plan = SUB_PLANS.find((p) => p.level === subscription?.level);
  const pending = data?.privacyRequest && ['pending', 'processing'].includes(data.privacyRequest.status);
  return <main className="account-page container page-shell">
    <PageHeader eyebrow="Votre espace personnel" title="Mon compte" description="Votre accès, vos préférences et vos données au même endroit." />
    {error && <ViewState kind="error" compact title={data ? "Action non confirmée" : "Compte indisponible"} description={error} action={<button className="view-button" onClick={load} disabled={busy}>Réessayer</button>} />}
    {message && <p role="status" className="account-success">{message}</p>}
    {reauth && <button className="view-button" onClick={signOut}>Se reconnecter pour confirmer mon identité</button>}
    {!data && !error && <ViewState kind="loading" title="Chargement de votre compte" description="Nous récupérons votre accès et vos préférences." />}
    {data && <div className="account-grid">
      <section className="account-card" aria-labelledby="account-identity"><h2 id="account-identity">Identité</h2><p>{data.account.email}</p>
        <form onSubmit={(e) => { e.preventDefault(); void act(async () => { await apiPost('account', { action: 'profile', name }); await user?.reload(); await load(); setMessage('Votre nom a été mis à jour.'); }); }}>
          <label htmlFor="account-name">Nom affiché</label><input id="account-name" disabled={busy} value={name} maxLength={80} required onChange={(e) => setName(e.target.value)} />
          <button disabled={busy}>Enregistrer mon nom</button>
        </form><p className="account-muted">Compte créé le {data.account.createdAt ? date(data.account.createdAt) : 'date indisponible'}.</p>
        <button className="account-secondary" onClick={signOut}>Me déconnecter</button>
      </section>
      <section className="account-card" aria-labelledby="account-subscription"><h2 id="account-subscription">Mon abonnement</h2>
        <strong className="account-plan">{subscription.admin ? 'Administrateur' : subscription.vip ? 'Accès VIP' : subscription.allowed ? plan ? 'Forfait ' + plan.dur : 'Accès activé' : subscription.lastExpiresAt ? 'Abonnement expiré' : 'Aucun abonnement actif'}</strong>
        {subscription.expiresAt ? <p>Échéance : <time dateTime={new Date(subscription.expiresAt).toISOString()}>{date(subscription.expiresAt)}</time></p> : subscription.allowed ? <p>Accès sans échéance enregistrée.</p> : subscription.lastExpiresAt ? <p>Dernière échéance : {date(subscription.lastExpiresAt)}</p> : null}
        <p>{FREE_FOR_ALL ? 'L’application est gratuite : l’abonnement retire les publicités tant qu’il est valable. ' : ''}Les achats du Marché sont indépendants de cet abonnement.</p>
        <Link className="account-button" href="/commandes">Mes demandes et commandes</Link>
        {!subscription.admin && !subscription.vip && <a className="account-button account-secondary" href={subscriptionContact}>Contacter l’assistance pour mon abonnement</a>}
      </section>
      <section className="account-card" aria-labelledby="account-preferences"><h2 id="account-preferences">Mes préférences</h2>
        <label className="account-toggle"><input type="checkbox" checked={data.settings.analytics} disabled={busy} onChange={(e) => void saveSettings(e.target.checked, data.settings.pushEnabled)} /> Autoriser la mesure des visites et vues de produits</label>
        <p className="account-muted">Facultatif. Le suivi de connexion nécessaire au fonctionnement du compte reste conservé.</p>
        <label className="account-toggle"><input type="checkbox" checked={data.settings.pushEnabled} disabled={busy} onChange={(e) => void saveSettings(data.settings.analytics, e.target.checked)} /> Autoriser les notifications sur mes appareils</label>
        <p className="account-muted">Désactiver retire vos appareils enregistrés. Après réactivation, reconnectez l’appareil pour le réabonner. L’historique reste disponible dans l’application.</p>
      </section>
      <section className="account-card" aria-labelledby="account-data"><h2 id="account-data">Mes données personnelles</h2>
        <p>Téléchargez les informations disponibles sur votre compte, votre abonnement, vos commandes, vos préférences et vos notifications.</p>
        <button disabled={busy} onClick={exportData}>Télécharger mes données disponibles</button>
        <button className="account-secondary" disabled={busy || pending} onClick={() => void privacy('export')}>Demander un export complet</button>
        <p className="account-muted">Les contenus partagés et historiques complémentaires sont examinés par l’administration sur demande.</p>
        <button className="account-danger" disabled={busy || pending} onClick={() => setConfirm(true)}>Demander la suppression de mon compte</button>
        <p>Une demande de suppression n’efface pas immédiatement votre compte. Il reste actif pendant son examen.</p>
        {data.privacyRequest && <div className="account-request"><strong>{data.privacyRequest.kind === 'delete' ? 'Suppression du compte' : 'Export complet'} : {REQUEST_LABELS[data.privacyRequest.status] || data.privacyRequest.status}</strong><p>Demande du {date(data.privacyRequest.requestedAt)}.</p>{data.privacyRequest.response && <p>Réponse : {data.privacyRequest.response}</p>}</div>}
      </section>
      {subscription.admin && <section className="account-card account-wide" aria-labelledby="privacy-admin"><h2 id="privacy-admin">Demandes de données à traiter</h2><Link href="/commandes?vue=administration">Suivi des commandes</Link><button disabled={busy} onClick={loadRequests}>Actualiser les demandes</button>
        <p>Vérifiez et effectuez le traitement avant de le clôturer. Ce formulaire enregistre votre réponse ; il ne supprime pas les données à votre place.</p>
        {requests.length === 0 && <p>Aucune demande en attente.</p>}
        {requests.map((request) => <article key={request.uid} className="account-request"><strong>{request.email} — {request.kind === 'delete' ? 'Suppression' : 'Export complet'}</strong><p>{REQUEST_LABELS[request.status]} · {date(request.requestedAt)}</p>
          <label htmlFor={'reply-' + request.uid}>Réponse à la personne</label><textarea id={'reply-' + request.uid} value={responses[request.uid] || ''} maxLength={1000} onChange={(e) => setResponses({ ...responses, [request.uid]: e.target.value })} />
          {['processing', 'completed', 'rejected'].map((status) => <button key={status} disabled={busy || (responses[request.uid] || '').trim().length < 3} onClick={() => void act(async () => { await apiPost('account', { action: 'privacy-update', uid: request.uid, status, note: responses[request.uid] }); await loadRequests(); })}>{status === 'processing' ? 'Prendre en charge' : status === 'completed' ? 'Clôturer le traitement' : 'Refuser avec explication'}</button>)}
        </article>)}
      </section>}
    </div>}
    {confirm && <Modal className="account-modal" label="Demander la suppression du compte" onClose={() => { if (!busy) setConfirm(false); }}><section className="account-card"><h2>Demander la suppression du compte</h2><p>Cette action enregistre une demande auprès de l’administration. Votre compte n’est pas effacé immédiatement.</p><label htmlFor="confirm-account-email">Saisissez votre adresse e-mail pour confirmer</label><input id="confirm-account-email" disabled={busy} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
      <button className="account-danger" disabled={busy || email.trim().toLowerCase() !== data.account.email.toLowerCase()} onClick={() => void privacy('delete')}>Envoyer ma demande de suppression</button><button className="account-secondary" disabled={busy} onClick={() => setConfirm(false)}>Annuler</button>{error && <p role="alert" className="account-modal-error">{error}</p>}</section></Modal>}
  </main>;
}
