import { useId, useState } from 'react';
import { InputGroup, InputGroupAddon, InputNumber } from './InputGroup';
import type { ProjectMutationResult } from '../../domain/projectMutation';

type ValidatedNumberFieldProps = {
  label: string;
  value: number;
  minimum: number;
  maximum?: number;
  step: number;
  unit: string;
  prefix?: string;
  resetKey: string | number;
  onCommit: (value: number) => ProjectMutationResult;
};

type NumberEdit = {
  source: number;
  resetKey: string | number;
  draft: string;
  dirty: boolean;
  error: string | null;
};

function initialEdit(value: number, resetKey: string | number): NumberEdit {
  return { source: value, resetKey, draft: String(value), dirty: false, error: null };
}

function isInvalidNumber(draft: string, minimum: number, maximum = Infinity) {
  const value = Number(draft);
  return draft.trim() === '' || !Number.isFinite(value) || value < minimum || value > maximum;
}

export function ValidatedNumberField({
  label, value, minimum, maximum, step, unit, prefix, resetKey, onCommit,
}: ValidatedNumberFieldProps) {
  const errorId = useId();
  const [storedEdit, setEdit] = useState(() => initialEdit(value, resetKey));
  let edit = storedEdit;
  if (edit.source !== value || edit.resetKey !== resetKey) {
    edit = initialEdit(value, resetKey);
    setEdit(edit);
  }
  const parsed = Number(edit.draft);
  const isInvalid = isInvalidNumber(edit.draft, minimum, maximum);
  const constraint = maximum === undefined
    ? `${label} must be at least ${minimum} ${unit}.`
    : `${label} must be between ${minimum} and ${maximum} ${unit}.`;
  const error = isInvalid ? constraint : edit.error;
  const commit = () => {
    if (!edit.dirty) return;
    if (isInvalid) {
      setEdit({ ...initialEdit(value, resetKey), error: `${constraint} Previous value kept.` });
      return;
    }
    if (parsed === value) {
      setEdit(initialEdit(value, resetKey));
      return;
    }
    const result = onCommit(parsed);
    setEdit(result.ok ? initialEdit(parsed, resetKey) : { ...edit, error: result.error });
  };

  return (
    <div className="validated-number-field">
      <InputGroup>
        {prefix && <InputGroupAddon enableScrubbing sensitivity={0.4}>{prefix}</InputGroupAddon>}
        <InputNumber
          aria-label={label}
          aria-invalid={isInvalid || !!edit.error}
          aria-describedby={error ? errorId : undefined}
          min={minimum}
          max={maximum}
          step={step}
          value={edit.draft}
          onChange={(event) => {
            setEdit({ source: value, resetKey, draft: event.currentTarget.value, dirty: true, error: null });
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              setEdit(initialEdit(value, resetKey));
            }
          }}
        />
        <InputGroupAddon align="inline-end" enableScrubbing={!prefix} sensitivity={4}>{unit}</InputGroupAddon>
      </InputGroup>
      {error && <small id={errorId} className="coordinate-validation" role="alert">{error}</small>}
    </div>
  );
}
