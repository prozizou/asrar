// Symboles astronomiques des sept planètes chaldéennes en SVG (trait,
// couleur = currentColor). Remplace les caractères ♄ ♃ ♂ ☉ ♀ ☿ ☽, que
// beaucoup de téléphones Android affichent en emoji couleur (taille et
// style imprévisibles). Même tracé que les icônes lucide : viewBox 24,
// trait 2, extrémités arrondies.
const PATHS = {
  Soleil: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  Lune: <path d="M15.5 3.5a8.5 8.5 0 1 0 0 17 7 7 0 0 1 0-17z" />,
  Mercure: (
    <>
      <path d="M8 2.5a4 4 0 0 0 8 0" />
      <circle cx="12" cy="10" r="4.5" />
      <path d="M12 14.5V22M8.5 18.5h7" />
    </>
  ),
  Vénus: (
    <>
      <circle cx="12" cy="8.5" r="5.5" />
      <path d="M12 14v8M8.5 18.5h7" />
    </>
  ),
  Mars: (
    <>
      <circle cx="10" cy="14" r="6" />
      <path d="M14.3 9.7 20.5 3.5M15 3.5h5.5V9" />
    </>
  ),
  Jupiter: <path d="M5 8.5a4 4 0 1 1 6.5 3.2L5 16.5h14M15.5 4v17" />,
  Saturne: <path d="M7 4.5h6M10 2v11a4 4 0 0 1 7.2 2.4c0 2.4-2.6 3.4-2.6 5.6" />,
};

/**
 * @param {{ planet: string, size?: string | number, className?: string, title?: string }} props
 */
export default function PlanetGlyph({ planet, size = '1em', className = '', title }) {
  const shape = PATHS[planet];
  if (!shape) return null;
  return (
    <svg
      className={'planet-glyph' + (className ? ' ' + className : '')}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      style={{ verticalAlign: '-0.125em', flexShrink: 0 }}
    >
      {shape}
    </svg>
  );
}
