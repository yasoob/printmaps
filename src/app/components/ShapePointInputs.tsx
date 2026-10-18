import { useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { PropertyRow } from "./PropertyControls";

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
          <PropertyRow key={label} label={label}>
            <div className="coordinate-field">
              <label className="number-field">
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
              </label>
              {error && <small className="coordinate-validation" id={errorId}>{error}</small>}
            </div>
          </PropertyRow>
        );
      })}
      <Button type="submit" variant="secondary">Add area point</Button>
    </form>
  );
}
