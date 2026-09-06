import { useId, useRef } from "react";

export type ShapePointInputsProps = {
  coordinates: readonly [string, string];
  errors: readonly [string | null, string | null];
  onChange: (axis: 0 | 1, value: string) => void;
  onAdd: () => void;
};

export function ShapePointInputs({
  coordinates,
  errors,
  onChange,
  onAdd,
}: ShapePointInputsProps) {
  const id = useId();
  const longitudeRef = useRef<HTMLInputElement>(null);
  const latitudeRef = useRef<HTMLInputElement>(null);
  return (
    <form
      className="shape-coordinate-entry"
      aria-label="Area point coordinates"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onAdd();
        const input = errors[1] && !errors[0] ? latitudeRef.current : longitudeRef.current;
        input?.focus();
        input?.select();
      }}
    >
      {(["Longitude", "Latitude"] as const).map((label, index) => {
        const axis = index as 0 | 1;
        const error = errors[axis];
        const errorId = `${id}-${axis}-error`;
        return (
          <label className="coordinate-field" key={label}>
            <span>{label}</span>
            <span className="number-field">
              <input
                ref={axis === 0 ? longitudeRef : latitudeRef}
                aria-label={`New area point ${label.toLowerCase()}`}
                aria-invalid={Boolean(error) || undefined}
                aria-describedby={error ? errorId : undefined}
                inputMode="decimal"
                value={coordinates[axis]}
                onChange={(event) => onChange(axis, event.currentTarget.value)}
              />
              <small>°</small>
            </span>
            {error && <small className="coordinate-validation" id={errorId}>{error}</small>}
          </label>
        );
      })}
      <button type="submit">Add area point</button>
    </form>
  );
}
