import { useId, useState } from "react";
import { PropertyRow } from "./PropertyControls";

type CoordinateFieldProps = {
  ariaLabel: string;
  disabled?: boolean;
  label: "Latitude" | "Longitude";
  maximum: number;
  minimum: number;
  onCommit: (value: number) => void;
  validationMessage?: string;
  validate?: (value: number) => boolean;
  value: number;
};

function coordinateDraft(
  edit: Readonly<{ source: number; value: string }>,
  value: number,
) {
  if (edit.source === value) return edit.value;
  return String(value);
}

function isCoordinateInvalid(
  draft: string,
  minimum: number,
  maximum: number,
  validate: CoordinateFieldProps["validate"],
) {
  const parsedValue = Number(draft);
  return (
    draft.trim() === "" ||
    !Number.isFinite(parsedValue) ||
    parsedValue < minimum ||
    parsedValue > maximum ||
    validate?.(parsedValue) === false
  );
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
  const [edit, setEdit] = useState(() => ({
    source: value,
    value: String(value),
  }));
  const [commitError, setCommitError] = useState<string | null>(null);
  const draft = coordinateDraft(edit, value);
  const parsedValue = Number(draft);
  const isInvalid = isCoordinateInvalid(draft, minimum, maximum, validate);
  const commit = () => {
    if (isInvalid) {
      setEdit({ source: value, value: String(value) });
      setCommitError(
        validationMessage ??
          `${label} must be between ${minimum} and ${maximum}.`,
      );
      return;
    }
    setEdit({ source: parsedValue, value: String(parsedValue) });
    setCommitError(null);
    onCommit(parsedValue);
  };

  return (
    <PropertyRow label={label}>
      <div className="coordinate-field">
        <label className="number-field">
          <input
            aria-label={ariaLabel}
            aria-describedby={
              isInvalid || commitError ? validationId : undefined
            }
            aria-invalid={isInvalid || undefined}
            disabled={disabled}
            value={draft}
            onChange={(event) => {
              setCommitError(null);
              setEdit({ source: value, value: event.target.value });
            }}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }

              event.preventDefault();
              commit();
            }}
          />
          <small>°</small>
        </label>
        {isInvalid && validationMessage && (
          <small id={validationId} className="coordinate-validation">
            {validationMessage}
          </small>
        )}
        {!isInvalid && commitError && (
          <small
            id={validationId}
            className="coordinate-validation"
            role="alert"
          >
            {commitError}
          </small>
        )}
      </div>
    </PropertyRow>
  );
}
