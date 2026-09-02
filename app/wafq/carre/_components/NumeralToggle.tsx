'use client';
// Porté depuis prozizou/Kanzou components/NumeralToggle.tsx.
import type { NumeralSystem } from '@/lib/kanzouNumerals';

export default function NumeralToggle({
  value,
  onChange,
}: {
  value: NumeralSystem;
  onChange: (v: NumeralSystem) => void;
}) {
  return (
    <div className="kz-numeral-toggle">
      <button type="button" className={value === 'latin' ? 'active' : ''} onClick={() => onChange('latin')}>
        123
      </button>
      <button type="button" className={value === 'eastern' ? 'active' : ''} onClick={() => onChange('eastern')}>
        ۱۲۳ (ourdou)
      </button>
    </div>
  );
}
