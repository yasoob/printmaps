import { useState } from 'react';
import { PropertyRow } from './PropertyControls';

type CoordinateFieldProps = {
  ariaLabel: string;
  label: 'Latitude' | 'Longitude';
  maximum: number;
  minimum: number;
  onCommit: (value: number) => void;
  value: number;
};

export function CoordinateField({
  ariaLabel,
  label,
  maximum,
  minimum,
  onCommit,
  value,
}: CoordinateFieldProps) {
  const [draft, setDraft] = useState(String(value));
  const parsedValue = Number(draft);
  const isInvalid = draft.trim() === ''
    || !Number.isFinite(parsedValue)
    || parsedValue < minimum
    || parsedValue > maximum;
  const commit = () => {
    if (isInvalid) {
      setDraft(String(value));
      return;
    }
    setDraft(String(parsedValue));
    onCommit(parsedValue);
  };

  return (
    <PropertyRow label={label}>
      <label className="number-field">
        <input aria-label={ariaLabel} aria-invalid={isInvalid || undefined} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} />
        <small>°</small>
      </label>
    </PropertyRow>
  );
}
