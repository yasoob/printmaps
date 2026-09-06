import { useId } from "react";
import type { ContentLayer } from "../../domain/project";
import type { RoutePointInput } from "../hooks/useRoutePointInput";
import { PropertyRow } from "./PropertyControls";

type RoutePointInputsProps = Readonly<{
  disabled: boolean;
  pointInput: RoutePointInput;
  onAdd: (coordinate: readonly [number, number], label: string) => boolean;
  onSnapChange: (isEnabled: boolean) => void;
  pois: readonly ContentLayer[];
  snapEnabled: boolean;
}>;

export function RoutePointInputs({
  disabled,
  pointInput,
  onAdd,
  onSnapChange,
  pois,
  snapEnabled,
}: RoutePointInputsProps) {
  const id = useId();
  const selectedPoi = pois.find((layer) => layer.id === pointInput.poiId);

  return (
    <div className="route-point-inputs">
      <form className="route-coordinate-entry" aria-label="Route point coordinates" noValidate onSubmit={(event) => {
        event.preventDefault();
        if (pointInput.errors.some(Boolean)) return;
        const coordinate: [number, number] = pointInput.coordinates.map(Number) as [number, number];
        if (onAdd(coordinate, "typed coordinates")) pointInput.acknowledgeCoordinates();
      }}>
        {(["Longitude", "Latitude"] as const).map((label, index) => {
          const axis = index as 0 | 1;
          const error = pointInput.errors[axis];
          const errorId = `${id}-${axis}`;
          return (
            <PropertyRow key={label} label={label}>
              <div className="coordinate-field">
                <label className="number-field">
                  <input
                    aria-label={`New route point ${label.toLowerCase()}`}
                    aria-invalid={Boolean(error) || undefined}
                    aria-describedby={error ? errorId : undefined}
                    disabled={disabled}
                    inputMode="decimal"
                    value={pointInput.coordinates[axis]}
                    onChange={(event) => pointInput.onChange(axis, event.currentTarget.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
                  />
                  <small>°</small>
                </label>
                {error && <small id={errorId} className="coordinate-validation">{error}</small>}
              </div>
            </PropertyRow>
          );
        })}
        <button
          type="submit"
          disabled={disabled || pointInput.errors.some(Boolean)}
        >
          Add coordinates
        </button>
      </form>
      <label className="route-poi-entry">
        <span className="tool-control-label">Existing place</span>
        <select
          aria-label="Existing place for route point"
          disabled={disabled || pois.length === 0}
          value={pointInput.poiId}
          onChange={(event) => pointInput.onPoiChange(event.target.value)}
        >
          <option value="">
            {pois.length === 0 ? "No places available" : "Choose a place"}
          </option>
          {pois.map((poi) => {
            if (poi.geometry?.type !== "Point") return null;
            return (
              <option key={poi.id} value={poi.id}>
                {poi.name} ({poi.geometry.coordinates[0]},{" "}
                {poi.geometry.coordinates[1]})
              </option>
            );
          })}
        </select>
      </label>
      <button
        type="button"
        disabled={disabled || selectedPoi?.geometry?.type !== "Point"}
        onClick={() => {
          if (selectedPoi?.geometry?.type === "Point"
            && onAdd(selectedPoi.geometry.coordinates, selectedPoi.name)) {
            pointInput.onPoiChange("");
          }
        }}
      >
        Add place
      </button>
      <label className="route-snap-control">
        <input
          type="checkbox"
          checked={snapEnabled}
          disabled={disabled}
          onChange={(event) => onSnapChange(event.target.checked)}
        />
        <span>Snap map clicks to nearby places and route anchors</span>
      </label>
    </div>
  );
}
