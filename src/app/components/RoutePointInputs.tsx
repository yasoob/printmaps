import { useState } from "react";
import { MAX_MERCATOR_LATITUDE, type ContentLayer } from "../../domain/project";
import { CoordinateField } from "./CoordinateField";

type RoutePointInputsProps = Readonly<{
  disabled: boolean;
  initialCoordinate: readonly [number, number];
  onAdd: (coordinate: readonly [number, number], label: string) => void;
  onSnapChange: (isEnabled: boolean) => void;
  pois: readonly ContentLayer[];
  snapEnabled: boolean;
}>;

export function RoutePointInputs({
  disabled,
  initialCoordinate,
  onAdd,
  onSnapChange,
  pois,
  snapEnabled,
}: RoutePointInputsProps) {
  const [coordinate, setCoordinate] = useState<[number, number]>([
    initialCoordinate[0],
    initialCoordinate[1],
  ]);
  const [poiId, setPoiId] = useState("");
  const selectedPoi = pois.find((layer) => layer.id === poiId);

  return (
    <div className="route-point-inputs">
      <div className="route-coordinate-entry">
        <CoordinateField
          ariaLabel="New route point longitude"
          disabled={disabled}
          label="Longitude"
          minimum={-180}
          maximum={180}
          value={coordinate[0]}
          onCommit={(longitude) => setCoordinate([longitude, coordinate[1]])}
        />
        <CoordinateField
          ariaLabel="New route point latitude"
          disabled={disabled}
          label="Latitude"
          minimum={-MAX_MERCATOR_LATITUDE}
          maximum={MAX_MERCATOR_LATITUDE}
          value={coordinate[1]}
          onCommit={(latitude) => setCoordinate([coordinate[0], latitude])}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAdd(coordinate, "typed coordinates")}
        >
          Add coordinates
        </button>
      </div>
      <label className="route-poi-entry">
        <span className="tool-control-label">Existing place</span>
        <select
          aria-label="Existing place for route point"
          disabled={disabled || pois.length === 0}
          value={poiId}
          onChange={(event) => setPoiId(event.target.value)}
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
          if (selectedPoi?.geometry?.type === "Point")
            onAdd(selectedPoi.geometry.coordinates, selectedPoi.name);
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
