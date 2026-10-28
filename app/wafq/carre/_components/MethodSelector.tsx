'use client';

import { useId } from 'react';

export default function MethodSelector<T extends string>({ value, options, onChange, disabled = false }: {
  value: T;
  options: Record<T, { label: string; hint: string }>;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <fieldset className="kz-methods" aria-describedby={`${id}-hint`} disabled={disabled}>
      <legend>Méthode</legend>
      <div className="kz-method-chips">
        {(Object.keys(options) as T[]).map((key) => (
          <label key={key} className="kz-method-chip">
            <input type="radio" name={id} value={key} checked={value === key}
              onChange={() => onChange(key)} />
            <span>{options[key].label}</span>
          </label>
        ))}
      </div>
      <p className="kz-method-hint" id={`${id}-hint`}>{options[value].hint}</p>
    </fieldset>
  );
}
