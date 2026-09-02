'use client';
// Porté depuis prozizou/Kanzou components/TextScaleSlider.tsx.
const MIN_SCALE = 0.5;
const MAX_SCALE = 2;
const STEP = 0.1;

export default function TextScaleSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="kz-scale-slider">
      <span>A⁻</span>
      <input
        type="range" min={MIN_SCALE} max={MAX_SCALE} step={STEP} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Taille du texte des cases"
      />
      <span>A⁺</span>
      <span className="kz-scale-val">{Math.round(value * 100)}%</span>
    </label>
  );
}
