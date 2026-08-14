'use client';
// Remplaçant sûr de <img> basé sur next/image.
//
// L'app affiche des images de provenances très hétérogènes (cf. lib/img.js) :
// Cloudinary (photos boutique/marché/secrets), avatar Google (auth), URL
// externe saisie librement par l'admin (books/secrets legacy, non restreinte
// à Cloudinary — voir safeUrl() dans server/http.js) et aperçus locaux
// blob:/data: (fichier choisi mais pas encore envoyé). next/image EXIGE que
// l'hôte distant soit déclaré dans next.config.mjs (sinon il lève une erreur
// qui casse le rendu) et ne sait pas du tout afficher blob:/data:.
//
// SmartImage route donc chaque source vers la bonne stratégie :
//   - blob:/data: (aperçu local avant upload)      → <img> natif, inchangé.
//   - hôte optimisable (Cloudinary, Google, local)  → <Image> optimisé.
//   - toute autre URL externe (legacy, non prévue)  → <Image unoptimized>
//     (mêmes bénéfices DOM/allocation d'espace, sans exiger que l'hôte soit
//     dans la liste blanche : évite un crash pour une vieille URL non-Cloudinary).
//
// Usage : mêmes props qu'un <img> (src, alt, className, style, onError), plus
// `fill` (le parent DOIT être `position: relative` + une taille définie) OU
// `width`/`height` explicites (image en flux normal).
import Image from 'next/image';

const OPTIMIZABLE_HOST = /^https:\/\/(res\.cloudinary\.com|[^/]+\.googleusercontent\.com)\//;

function isOptimizable(src) {
  return typeof src === 'string' && (src.startsWith('/') || OPTIMIZABLE_HOST.test(src));
}

export default function SmartImage({ src, alt, fill, width, height, sizes, className, style, onError, priority, ...rest }) {
  if (!src) return null;

  if (src.startsWith('blob:') || src.startsWith('data:')) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- blob:/data: non supportés par next/image.
      <img src={src} alt={alt || ''} className={className} style={style} onError={onError} {...rest} />
    );
  }

  return (
    <Image
      src={src}
      alt={alt || ''}
      className={className}
      style={style}
      onError={onError}
      priority={priority}
      unoptimized={!isOptimizable(src)}
      {...(fill ? { fill: true, sizes: sizes || '100vw' } : { width, height })}
      {...rest}
    />
  );
}
