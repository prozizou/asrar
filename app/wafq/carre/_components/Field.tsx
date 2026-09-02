// Champ numérique label+input partagé par les 9 pages /wafq/carre/[taille]
// — factorisé une seule fois ici (chaque page Kanzou d'origine la
// redéfinissait localement à l'identique).
export default function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="kz-field">
      <span>{label}</span>
      <input type="number" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
