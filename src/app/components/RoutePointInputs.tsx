import { useId, useMemo } from "react";
import { Button } from "@/components/ui/button";
import type { ContentLayer } from "../../domain/project";
import type { RoutePointInput } from "../hooks/useRoutePointInput";
import { PropertyRow } from "./PropertyControls";
import { Switch } from "./UiControls";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { SimpleSelect, type SimpleSelectOption } from "@/components/ui/select";

type RoutePointInputsProps = Readonly<{
  disabled: boolean;
  pointInput: RoutePointInput;
  onAdd: (coordinate: readonly [number, number], label: string) => boolean;
  onSnapChange: (isEnabled: boolean) => void;
  pois: readonly ContentLayer[];
  snapEnabled: boolean;
}>;

function existingPlaceOptions(pois: readonly ContentLayer[]): SimpleSelectOption<string>[] {
  const places = pois.flatMap((poi) => poi.geometry?.type === "Point"
    ? [{ value: poi.id, label: `${poi.name} (${poi.geometry.coordinates[0]}, ${poi.geometry.coordinates[1]})` }]
    : []);
  return [{ value: "", label: places.length === 0 ? "No places available" : "Choose a place", disabled: true }, ...places];
}

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
  const placeOptions = useMemo(() => existingPlaceOptions(pois), [pois]);

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
                <InputGroup>
                  <InputGroupInput
                    aria-label={`New route point ${label.toLowerCase()}`}
                    aria-invalid={Boolean(error) || undefined}
                    aria-describedby={error ? errorId : undefined}
                    disabled={disabled}
                    inputMode="decimal"
                    value={pointInput.coordinates[axis]}
                    onChange={(event) => pointInput.onChange(axis, event.currentTarget.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
                  />
                  <InputGroupAddon align="inline-end">°</InputGroupAddon>
                </InputGroup>
                {error && <small id={errorId} className="coordinate-validation">{error}</small>}
              </div>
            </PropertyRow>
          );
        })}
        <Button
          type="submit"
          variant="secondary"
          disabled={disabled || pointInput.errors.some(Boolean)}
        >
          Add coordinates
        </Button>
      </form>
      <div className="route-poi-entry">
        <PropertyRow label="Existing place">
          <SimpleSelect
            label="Existing place for route point"
            disabled={disabled || pois.length === 0}
            value={pointInput.poiId}
            options={placeOptions}
            onValueChange={pointInput.onPoiChange}
          />
        </PropertyRow>
        <Button
          variant="secondary"
          disabled={disabled || selectedPoi?.geometry?.type !== "Point"}
          onClick={() => {
            if (selectedPoi?.geometry?.type === "Point"
              && onAdd(selectedPoi.geometry.coordinates, selectedPoi.name)) {
              pointInput.onPoiChange("");
            }
          }}
        >
          Add place
        </Button>
      </div>
      <Switch
        className="route-snap-control"
        isChecked={snapEnabled}
        disabled={disabled}
        label="Snap map clicks to nearby places and route anchors"
        onCheckedChange={onSnapChange}
      />
    </div>
  );
}
