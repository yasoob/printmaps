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

function coordinateDraft(edit: Readonly<{ source: number; value: string }>, value: number) {
  if (edit.source === value) return edit.value;
  return String(value);
}

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
  const [edit, setEdit] = useState(() => ({ source: value, value: String(value) }));
  const draft = coordinateDraft(edit, value);
  const parsedValue = Number(draft);
  const isInvalid = draft.trim() === ''
    || !Number.isFinite(parsedValue)
    || parsedValue < minimum
    || parsedValue > maximum
    || (validate !== undefined && !validate(parsedValue));
  const commit = () => {
    if (isInvalid) {
      setEdit({ source: value, value: String(value) });
      return;
    }
    setEdit({ source: parsedValue, value: String(parsedValue) });
    onCommit(parsedValue);
  };

  return (
    <PropertyRow label={label}>
      <div className="coordinate-field">
        <label className="number-field">
          <input aria-label={ariaLabel} aria-describedby={isInvalid && validationMessage ? validationId : undefined} aria-invalid={isInvalid || undefined} disabled={disabled} value={draft} onChange={(event) => setEdit({ source: value, value: event.target.value })} onBlur={commit} />
          <small>°</small>
        </label>
        {isInvalid && validationMessage && <small id={validationId} className="coordinate-validation">{validationMessage}</small>}
      </div>
    </PropertyRow>
  );
}
