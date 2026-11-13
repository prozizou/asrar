'use client';
// Onglet « Publier » : article, photo, album, vidéo, audio, document ou
// prestation — gratuit ou payant (prix en FCFA, durée d'accès, conditions).
// Les fichiers vont dans l'espace PRIVÉ ; seul un aperçu (flouté si payant)
// est public. Option : publier aussi dans une discussion, groupe ou chaîne.
import { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, Lock, Gift, Info, Loader2, CheckCircle2 } from 'lucide-react';
import { ac } from '@/lib/asrarChat/client';
import { uploadAsset, resourceTypeOf } from '@/lib/asrarChat/upload';
import { blurredPreview } from '@/lib/asrarChat/blur';
import {
  POST_KINDS, POST_KIND_LABELS, CATEGORIES, normalizePostInput, POST_ERRORS, PRICE_MIN, PRICE_MAX, ASSETS_MAX, fcfa,
} from '@/lib/asrarChat/logic';
import { useAc } from './context';
import { KIND_ICONS, bytes } from './ui';

const ACCEPT: Record<string, string> = {
  image: 'image/*', album: 'image/*', video: 'video/*', audio: 'audio/*',
  document: '.pdf,.epub,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip', text: 'image/*,video/*,audio/*,.pdf', service: 'image/*,.pdf',
};
const ACCESS = [[0, 'Illimité'], [1, '24 heures'], [7, '7 jours'], [30, '30 jours'], [90, '3 mois'], [365, '1 an']];

export default function Publish({ initialCid, onDone }: { initialCid: string | null; onDone: () => void }) {
  const { me, notify, setTab, openChat } = useAc();
  const [kind, setKind] = useState('video');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('formations');
  const [paid, setPaid] = useState(true);
  const [price, setPrice] = useState('1500');
  const [accessDays, setAccessDays] = useState(0);
  const [conditions, setConditions] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [contentText, setContentText] = useState('');
  const [files, setFiles] = useState<{ file: File; asset?: any; progress: number; error?: string }[]>([]);
  const [convs, setConvs] = useState<any[]>([]);
  const [cid, setCid] = useState(initialCid || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const isSeller = !!me.profile?.seller;

  useEffect(() => {
    ac('conv.list').then((r) => setConvs(r.convs.filter((c: any) => c.type !== 'channel' || ['owner', 'admin'].includes(c.role)))).catch(() => {});
  }, []);
  useEffect(() => { if (!isSeller) setPaid(false); }, [isSeller]);

  const addFiles = async (list: FileList | null) => {
    const picked = Array.from(list || []).slice(0, ASSETS_MAX - files.length);
    if (!picked.length) return;
    const start = files.length;
    setFiles((f) => [...f, ...picked.map((file) => ({ file, progress: 0 }))]);
    await Promise.all(picked.map(async (file, i) => {
      const index = start + i;
      try {
        const duration = await mediaDuration(file);
        const asset: any = await uploadAsset(file, {
          visibility: 'private', duration,
          onProgress: (p) => setFiles((f) => f.map((x, j) => (j === index ? { ...x, progress: p } : x))),
        });
        if (file.type.startsWith('audio/')) asset.audio = true;
        setFiles((f) => f.map((x, j) => (j === index ? { ...x, asset, progress: 100 } : x)));
      } catch (e: any) {
        setFiles((f) => f.map((x, j) => (j === index ? { ...x, error: e.message } : x)));
      }
    }));
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = async (e: any) => {
    e.preventDefault();
    setError('');
    if (files.some((f) => !f.asset && !f.error)) { setError('Patientez : envoi des fichiers en cours.'); return; }
    const assets = files.filter((f) => f.asset).map((f) => f.asset);
    const input: any = {
      kind, title, description, category, price: paid ? Number(price) : 0, accessDays: paid ? accessDays : 0,
      conditions: paid ? conditions : '', previewText, contentText, assets,
    };
    const check = normalizePostInput(input, me.uid);
    if (check.error) { setError(POST_ERRORS[check.error]); return; }
    setBusy(true);
    try {
      // Aperçu public : flouté pour un contenu payant (calculé ici, avant envoi).
      const visual = files.find((f) => f.asset && ['image', 'video'].includes(resourceTypeOf(f.file)) && !f.file.type.startsWith('audio/'));
      if (visual) {
        try {
          const preview = await blurredPreview(visual.file, { blur: input.price > 0 });
          input.previewImage = await uploadAsset(preview, { visibility: 'public', rt: 'image' });
        } catch { /* aperçu facultatif */ }
      }
      const { pid } = await ac('post.save', input);
      if (cid) {
        try { await ac('msg.send', { cid, postId: pid }); }
        catch (err: any) { notify('Publié, mais pas dans la discussion : ' + err.message, 'error'); }
      }
      notify(input.price > 0 ? `Publié : ${fcfa(input.price)}.` : 'Publication en ligne.', 'success');
      if (cid) openChat(cid); else onDone();
    } catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };

  const needsFiles = !['text', 'service'].includes(kind);
  const Icon = KIND_ICONS[kind];
  return (
    <section className="ac-tab" aria-label="Publier">
      <h2 className="ac-h2">Nouvelle publication</h2>
      <form className="ac-form" onSubmit={submit} noValidate>
        <div className="ac-kind-picker" role="radiogroup" aria-label="Type de publication">
          {POST_KINDS.map((k) => {
            const KIcon = KIND_ICONS[k];
            return (
              <button key={k} type="button" role="radio" aria-checked={kind === k} className={'ac-kind' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>
                <KIcon size={20} aria-hidden="true" /> {POST_KIND_LABELS[k]}
              </button>
            );
          })}
        </div>
        <label className="ac-field"><span>Titre</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="ex. Formation Python en PDF" required /></label>
        <label className="ac-field"><span>Description</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={3} placeholder="Ce que l’acheteur va obtenir" /></label>
        <label className="ac-field"><span>Catégorie</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
        </label>

        <div className="ac-segmented" role="radiogroup" aria-label="Accès">
          <button type="button" role="radio" aria-checked={!paid} className={!paid ? 'on' : ''} onClick={() => setPaid(false)}><Gift size={16} aria-hidden="true" /> Gratuit</button>
          <button type="button" role="radio" aria-checked={paid} className={paid ? 'on' : ''} disabled={!isSeller} onClick={() => setPaid(true)}><Lock size={16} aria-hidden="true" /> Payant</button>
        </div>
        {!isSeller && (
          <p className="ac-note"><Info size={15} aria-hidden="true" /> <span>Pour vendre, renseignez d’abord vos moyens de paiement (Wave, PI-SPI). <button type="button" className="ac-link" onClick={() => setTab('profile')}>Activer la vente</button></span></p>
        )}
        {paid && (
          <>
            <div className="ac-row2">
              <label className="ac-field"><span>Prix (FCFA)</span><input type="number" inputMode="numeric" min={PRICE_MIN} max={PRICE_MAX} step={50} value={price} onChange={(e) => setPrice(e.target.value)} /></label>
              <label className="ac-field"><span>Durée d’accès</span>
                <select value={accessDays} onChange={(e) => setAccessDays(Number(e.target.value))}>{ACCESS.map(([d, l]) => <option key={d} value={d}>{l}</option>)}</select>
              </label>
            </div>
            <label className="ac-field"><span>Aperçu visible avant paiement</span><textarea value={previewText} onChange={(e) => setPreviewText(e.target.value)} maxLength={400} rows={2} placeholder="Un extrait, le sommaire…" /></label>
            <label className="ac-field"><span>Conditions de consultation <em>facultatif</em></span><textarea value={conditions} onChange={(e) => setConditions(e.target.value)} maxLength={500} rows={2} placeholder="ex. Usage personnel, pas de partage" /></label>
          </>
        )}

        <label className="ac-field"><span>{kind === 'service' ? 'Détails de la prestation (après paiement)' : kind === 'text' ? 'Texte de l’article' : 'Texte d’accompagnement'} {needsFiles && <em>facultatif</em>}</span>
          <textarea value={contentText} onChange={(e) => setContentText(e.target.value)} maxLength={20000} rows={kind === 'text' ? 8 : 3}
            placeholder={kind === 'service' ? 'Comment se déroule la prestation, délais, contact…' : ''} />
        </label>

        <div className="ac-files">
          <input ref={fileRef} type="file" hidden multiple={kind === 'album' || kind === 'text'} accept={ACCEPT[kind]} onChange={(e) => addFiles(e.target.files)} />
          <button type="button" className="ac-btn tonal" onClick={() => fileRef.current?.click()} disabled={files.length >= ASSETS_MAX}>
            <Upload size={17} aria-hidden="true" /> {kind === 'album' ? 'Ajouter des photos' : `Ajouter ${needsFiles ? 'le fichier' : 'un fichier (facultatif)'}`}
          </button>
          <ul className="ac-file-list">
            {files.map((f, i) => (
              <li key={i} className={f.error ? 'error' : ''}>
                <Icon size={18} aria-hidden="true" />
                <span className="ac-file-name">{f.file.name}<small>{f.error || (f.asset ? bytes(f.file.size) : `${f.progress} %`)}</small></span>
                {f.asset ? <CheckCircle2 size={18} className="ok" aria-label="Envoyé" /> : !f.error && <Loader2 size={18} className="ac-spin" aria-label="Envoi en cours" />}
                <button type="button" className="ac-icon-btn" aria-label={`Retirer ${f.file.name}`} onClick={() => setFiles((list) => list.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
          <p className="ac-hint"><Lock size={13} aria-hidden="true" /> Les fichiers sont stockés dans un espace privé. {paid ? 'Les acheteurs ne voient qu’un aperçu flouté avant paiement.' : ''}</p>
        </div>

        <label className="ac-field"><span>Publier aussi dans <em>facultatif</em></span>
          <select value={cid} onChange={(e) => setCid(e.target.value)}>
            <option value="">Explorer et ma vitrine uniquement</option>
            {convs.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>

        {error && <p className="ac-error" role="alert">{error}</p>}
        <button type="submit" className="ac-btn filled" disabled={busy}>{busy ? 'Publication…' : paid ? `Publier à ${fcfa(Number(price) || 0)}` : 'Publier gratuitement'}</button>
        <p className="ac-hint">En publiant, vous attestez détenir les droits sur ce contenu. Les contenus illicites sont retirés et le compte suspendu.</p>
      </form>
    </section>
  );
}

async function mediaDuration(file: File): Promise<number | undefined> {
  if (!/^(video|audio)\//.test(file.type)) return undefined;
  return new Promise((resolve) => {
    const el = document.createElement(file.type.startsWith('audio/') ? 'audio' : 'video');
    const url = URL.createObjectURL(file);
    el.preload = 'metadata';
    el.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Number.isFinite(el.duration) ? Math.round(el.duration) : undefined); };
    el.onerror = () => { URL.revokeObjectURL(url); resolve(undefined); };
    el.src = url;
  });
}
