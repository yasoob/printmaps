import { useId, useState } from 'react';
import { PropertyRow } from './PropertyControls';

type CoordinateFieldProps = {
  ariaLabel: string;
  disabled?: boolean;
  label: 'Latitude' | 'Longitude';
  maximum: number;
  minimum: number;
  onCommit: (value: number) => void;
  validationMessage?: string;
  validate?: (value: number) => boolean;
  value: number;
};

export function CoordinateField({
  ariaLabel,
  disabled = false,
  label,
  maximum,
  minimum,
  onCommit,
  validationMessage,
  validate,
  value,
}: CoordinateFieldProps) {
  const validationId = useId();
  const [draft, setDraft] = useState(String(value));
  const parsedValue = Number(draft);
  const isInvalid = draft.trim() === ''
    || !Number.isFinite(parsedValue)
    || parsedValue < minimum
    || parsedValue > maximum
    || (validate !== undefined && !validate(parsedValue));
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
      <div className="coordinate-field">
        <label className="number-field">
          <input aria-label={ariaLabel} aria-describedby={isInvalid && validationMessage ? validationId : undefined} aria-invalid={isInvalid || undefined} disabled={disabled} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} />
          <small>°</small>
        </label>
        {isInvalid && validationMessage && <small id={validationId} className="coordinate-validation">{validationMessage}</small>}
      </div>
    </PropertyRow>
  );
}
