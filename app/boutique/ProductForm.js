'use client';
// Modale d'ajout / édition d'un produit — port d'ouvrirFormProduit(),
// validerFormProduit() et enregistrerProduit(). Galerie 2 à 5 images,
// validation champ par champ, upload Cloudinary des nouvelles images.
//
// Restructurée en fiche plein écran mobile (revue design) : l'ancienne
// modale centrée, à hauteur non bornée, ressemblait à un formulaire desktop
// plaqué dans une popup — long scroll interne, contenu derrière encore très
// lisible, sélecteur de fichiers natif du navigateur en rupture avec le
// reste de l'identité visuelle de l'app. Voir boutique.css pour le détail
// de chaque correctif (barre supérieure fixe, CTA fixe en bas, sélecteur
// d'images personnalisé, prix+devise regroupés, rythme vertical resserré).
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, X, Plus, Info } from 'lucide-react';
import { apiPost } from '@/lib/api';
import { uploadImage } from '@/lib/cloudinary';
import { optimImg } from '@/lib/img';
import { CHAINS } from '@/lib/market';
import SmartImage from '@/components/SmartImage';

const MAX_IMAGES = 5;
const MIN_IMAGES = 2;

export default function ProductForm({ product, onClose, onSaved, notify }) {
  const isEdit = !!product;
  const [name, setName] = useState(product?.produit || '');
  const [price, setPrice] = useState(product?.Prix || '');
  const [devise, setDevise] = useState(product?.devise || 'FCFA');
  const [chain, setChain] = useState(product?.chain || '');
  const [desc, setDesc] = useState(product?.description || '');
  const [note, setNote] = useState('');
  const [errorField, setErrorField] = useState('');
  const [imagesError, setImagesError] = useState(false);
  const [saving, setSaving] = useState(false);

  // Galerie : { file: File|null, url: string }. file = nouvelle image à
  // téléverser ; url seule = image déjà hébergée (édition).
  const [images, setImages] = useState(() => {
    if (!product) return [];
    const src =
      Array.isArray(product.images) && product.images.length ? product.images : product.Image ? [product.Image] : [];
    return src.filter(Boolean).slice(0, MAX_IMAGES).map((u) => ({ file: null, url: u }));
  });

  const refs = { pName: useRef(null), pPrice: useRef(null), pDevise: useRef(null), pChain: useRef(null), pDesc: useRef(null) };
  const fileInputRef = useRef(null);

  // Révoque les object URLs des images locales au démontage.
  useEffect(() => {
    return () => images.forEach((im) => im.file && im.url && URL.revokeObjectURL(im.url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addImages = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const place = MAX_IMAGES - images.length;
    if (place <= 0) {
      notify(`Maximum ${MAX_IMAGES} images.`);
      return;
    }
    if (files.length > place) notify(`Seules ${place} image(s) ont été ajoutées (max ${MAX_IMAGES}).`);
    const added = files.slice(0, place).map((f) => ({ file: f, url: URL.createObjectURL(f) }));
    setImages((prev) => [...prev, ...added]);
    setImagesError(false);
  };

  const removeImage = (i) => {
    setImages((prev) => {
      const im = prev[i];
      if (im && im.file && im.url) URL.revokeObjectURL(im.url);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  // Validation dans l'ordre du formulaire ; au premier champ manquant :
  // toast + focus + surlignage.
  const validate = () => {
    const checks = [
      { id: 'pName', ok: name.trim().length > 0, msg: 'Indiquez le nom du produit.' },
      { id: 'pPrice', ok: parseInt(price, 10) > 0, msg: 'Indiquez un prix valide (supérieur à 0).' },
      { id: 'pDevise', ok: devise.trim().length > 0, msg: 'Indiquez la devise (ex : FCFA).' },
      { id: 'pChain', ok: chain.trim().length > 0, msg: 'Choisissez une catégorie.' },
      { id: 'pDesc', ok: desc.trim().length > 0, msg: 'Ajoutez une description du produit.' },
    ];
    setErrorField('');
    setImagesError(false);
    for (const c of checks) {
      if (c.ok) continue;
      notify(c.msg);
      setErrorField(c.id);
      const el = refs[c.id].current;
      if (el) {
        el.focus();
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      return false;
    }
    if (images.length < MIN_IMAGES) {
      notify(`Ajoutez au moins ${MIN_IMAGES} images du produit (${images.length} pour l'instant).`);
      setImagesError(true);
      return false;
    }
    return true;
  };

  const save = async () => {
    if (saving || !validate()) return;
    setSaving(true);
    try {
      // Téléverse uniquement les nouvelles images ; conserve les URL existantes.
      const urls = [];
      for (let i = 0; i < images.length; i++) {
        const im = images[i];
        if (im.file) {
          setNote(`Envoi de l'image ${i + 1}/${images.length}…`);
          urls.push(await uploadImage(im.file, 'products'));
        } else {
          urls.push(im.url);
        }
      }
      setNote('Enregistrement…');
      const payload = {
        key: (isEdit && product._key) || undefined,
        produit: name.trim(),
        Prix: price,
        devise: devise.trim() || 'FCFA',
        chain,
        images: urls, // galerie complète (2 à 5)
        Image: urls[0] || '', // compat : image principale
        description: desc.trim(),
        // `number` n'est pas envoyé : le serveur reprend le téléphone de la boutique.
      };
      await apiPost('shop', { action: 'save-product', product: payload });
      notify('✅ Produit enregistré.');
      onSaved();
    } catch (e) {
      setNote('');
      notify('Erreur : ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const cls = (id) => (errorField === id ? ' bq-field-error' : '');

  return (
    <div className="bq-modal-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bq-modal">
        {/* Barre supérieure fixe (revue design, point 1) : remplace le petit
            ✕ flottant au-dessus d'un très long formulaire — flèche retour +
            titre + fermeture, toujours visibles, quelle que soit la position
            du scroll dans le formulaire. */}
        <div className="bq-modal-topbar">
          <button type="button" className="bq-modal-back" onClick={onClose} aria-label="Retour">
            <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
          </button>
          <h3>{isEdit ? 'Modifier le produit' : 'Ajouter un produit'}</h3>
          <button type="button" className="bq-modal-close" onClick={onClose} aria-label="Fermer">
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <div className="bq-form-scroll">
          <div className="bq-form">
            <label>
              Nom du produit *
              <input
                ref={refs.pName}
                type="text"
                maxLength={120}
                placeholder="Ex : Encens de protection"
                className={cls('pName').trim()}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            {/* Prix + devise regroupés dans un seul champ visuel (revue
                design) — deux blocs verticaux séparés pour deux informations
                qui se lisent naturellement ensemble prenaient deux fois plus
                de hauteur que nécessaire. */}
            <label>
              Prix *
              <div className={'bq-price-group' + (cls('pPrice') || cls('pDevise'))}>
                <input
                  ref={refs.pPrice}
                  type="number"
                  min={1}
                  placeholder="2 000"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
                <span className="bq-price-sep" aria-hidden="true" />
                <input
                  ref={refs.pDevise}
                  type="text"
                  maxLength={8}
                  className="bq-price-currency"
                  value={devise}
                  onChange={(e) => setDevise(e.target.value)}
                  aria-label="Devise"
                />
              </div>
            </label>

            <label>
              Catégorie *
              {/* appearance:none + chevron dessiné en CSS (revue design) — le
                  rendu natif du <select> tranchait avec le reste des champs. */}
              <div className="bq-select-wrap">
                <select ref={refs.pChain} className={cls('pChain').trim()} value={chain} onChange={(e) => setChain(e.target.value)}>
                  <option value="">— Choisir une catégorie —</option>
                  {CHAINS.map((c) => (
                    <option key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            {/* Sélecteur d'images personnalisé (revue design, point le plus
                cité) : remplace l'<input type="file"> nu + « Aucune image »
                + décompte brut, qui tranchaient avec le reste de
                l'identité visuelle. Grande zone tactile tant qu'aucune image
                n'est choisie ; petites tuiles + tuile "+" ensuite. */}
            <div>
              <span className="bq-field-label">
                Images du produit * <span className="bq-field-hint">{MIN_IMAGES} minimum · {MAX_IMAGES} maximum</span>
              </span>
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={addImages} style={{ display: 'none' }} />
              <div className={'bq-image-grid' + (imagesError ? ' bq-field-error' : '')}>
                {images.length === 0 ? (
                  <button type="button" className="bq-image-dropzone" onClick={() => fileInputRef.current?.click()}>
                    <Plus size={22} strokeWidth={2} aria-hidden="true" />
                    <strong>Ajouter des images</strong>
                    <small>JPG, PNG · max {MAX_IMAGES} images</small>
                  </button>
                ) : (
                  <>
                    {images.map((im, i) => (
                      <div key={i} className="bq-image-tile">
                        <SmartImage src={optimImg(im.url, 200)} alt="" fill sizes="80px" style={{ objectFit: 'cover' }} />
                        <button type="button" className="bq-image-remove" onClick={() => removeImage(i)} aria-label="Retirer">
                          <X size={12} strokeWidth={2.5} aria-hidden="true" />
                        </button>
                        {i === 0 && <span className="bq-image-main">Principale</span>}
                      </div>
                    ))}
                    {images.length < MAX_IMAGES && (
                      <button
                        type="button"
                        className="bq-image-add"
                        onClick={() => fileInputRef.current?.click()}
                        aria-label="Ajouter une image"
                      >
                        <Plus size={20} strokeWidth={2} aria-hidden="true" />
                      </button>
                    )}
                  </>
                )}
              </div>
              <small className="bq-note" style={{ margin: '6px 0 0', textAlign: 'left' }}>
                {images.length} / {MAX_IMAGES} images
                {images.length < MIN_IMAGES ? ` — ${MIN_IMAGES} minimum` : ''}
              </small>
            </div>

            <label>
              Description *
              <textarea
                ref={refs.pDesc}
                maxLength={1000}
                rows={3}
                placeholder="Détaillez le produit…"
                className={cls('pDesc').trim()}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
            </label>

            {/* Information secondaire présentée en encart discret (revue
                design) plutôt qu'en simple ligne de texte perdue en bas du
                formulaire. */}
            <div className="bq-info-box">
              <Info size={15} strokeWidth={2} aria-hidden="true" />
              <span>Le numéro WhatsApp de votre boutique sera affiché automatiquement aux acheteurs.</span>
            </div>
          </div>
        </div>

        {/* CTA fixe en bas (revue design, point 1) — toujours accessible
            sans avoir à scroller jusqu'au bout du formulaire. */}
        <div className="bq-modal-footer">
          {note && <p className="bq-note" style={{ margin: '0 0 8px' }}>{note}</p>}
          <button className="bq-btn" onClick={save} disabled={saving}>
            {saving ? (
              'Enregistrement…'
            ) : (
              <>
                <Plus size={16} strokeWidth={2.5} aria-hidden="true" /> {isEdit ? 'Enregistrer les modifications' : 'Ajouter le produit'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
