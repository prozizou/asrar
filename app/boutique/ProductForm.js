'use client';
// Modale d'ajout / édition d'un produit — port d'ouvrirFormProduit(),
// validerFormProduit() et enregistrerProduit(). Galerie 2 à 5 images,
// validation champ par champ, upload Cloudinary des nouvelles images.
import { useEffect, useRef, useState } from 'react';
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
        <span className="bq-modal-close" onClick={onClose}>
          ✕
        </span>
        <h3>{isEdit ? 'Modifier le produit' : 'Ajouter un produit'}</h3>
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
          <div className="bq-row">
            <label>
              Prix *
              <input
                ref={refs.pPrice}
                type="number"
                min={1}
                placeholder="2000"
                className={cls('pPrice').trim()}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
            <label>
              Devise
              <input
                ref={refs.pDevise}
                type="text"
                maxLength={8}
                className={cls('pDevise').trim()}
                value={devise}
                onChange={(e) => setDevise(e.target.value)}
              />
            </label>
          </div>
          <label>
            Catégorie *
            <select ref={refs.pChain} className={cls('pChain').trim()} value={chain} onChange={(e) => setChain(e.target.value)}>
              <option value="">— Choisir une catégorie —</option>
              {CHAINS.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Images du produit * <small style={{ opacity: 0.7 }}>(2 minimum, 5 maximum)</small>
            <input type="file" accept="image/*" multiple onChange={addImages} />
            <div className={'bq-images-preview' + (imagesError ? ' bq-field-error' : '')}>
              {images.length === 0 ? (
                <span className="bq-images-empty">Aucune image</span>
              ) : (
                images.map((im, i) => (
                  <div key={i} className="bq-image-item">
                    <SmartImage src={optimImg(im.url, 200)} alt="" fill sizes="72px" style={{ objectFit: 'cover' }} />
                    <button type="button" onClick={() => removeImage(i)} aria-label="Retirer">
                      ✕
                    </button>
                    {i === 0 && <span className="bq-image-main">Principale</span>}
                  </div>
                ))
              )}
            </div>
            <small className="bq-note" style={{ margin: '4px 0 0' }}>
              {images.length} / {MAX_IMAGES} image(s)
              {images.length < MIN_IMAGES ? ` — ${MIN_IMAGES} minimum` : ''}
            </small>
          </label>
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
          <p className="bq-note" style={{ marginTop: 0 }}>
            📞 Le numéro WhatsApp de votre boutique sera automatiquement affiché aux acheteurs.
          </p>
          <button className="bq-btn" onClick={save} disabled={saving}>
            💾 Enregistrer le produit
          </button>
          <p className="bq-note">{note}</p>
        </div>
      </div>
    </div>
  );
}
