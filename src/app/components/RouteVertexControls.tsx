import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { MAX_MERCATOR_LATITUDE } from "../../domain/project";
import { CoordinateField } from "./CoordinateField";
import { PropertyRow } from "./PropertyControls";

type RouteVertexControlsProps = {
  coordinates: readonly (readonly [number, number])[];
  disabled?: boolean;
  onChange: (
    vertexIndex: number,
    coordinates: readonly [number, number],
  ) => void;
  onInsert: (vertexIndex: number) => void;
  onRemove: (vertexIndex: number) => void;
  noun?: "Anchor" | "Vertex" | "Waypoint";
  allowInsert?: boolean;
  middleOnlyRemove?: boolean;
};

function routeVertexOptions(
  coordinates: readonly (readonly [number, number])[],
) {
  const occurrences = new Map<string, number>();
  return coordinates.map((coordinate, value) => {
    const location = `${coordinate[0]},${coordinate[1]}`;
    const occurrence = (occurrences.get(location) ?? 0) + 1;
    occurrences.set(location, occurrence);
    return { key: `${location}:${occurrence}`, value };
  });
}

function canRemoveRouteVertex(
  vertexIndex: number,
  count: number,
  isMiddleOnly: boolean,
) {
  if (count <= 2) return false;
  return !isMiddleOnly || (vertexIndex > 0 && vertexIndex < count - 1);
}

export function RouteVertexControls({
  coordinates,
  disabled = false,
  noun = "Vertex",
  allowInsert = true,
  middleOnlyRemove = false,
  onChange,
  onInsert,
  onRemove,
}: RouteVertexControlsProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const vertexIndex = Math.min(
    selectedIndex,
    Math.max(0, coordinates.length - 1),
  );
  const selectedCoordinates = coordinates[vertexIndex];
  if (!selectedCoordinates) return null;
  const options = routeVertexOptions(coordinates);

  return (
    <>
      <PropertyRow label={noun}>
        <select
          aria-label={`Route ${noun.toLowerCase()}`}
          disabled={disabled}
          value={vertexIndex}
          onChange={(event) => setSelectedIndex(Number(event.target.value))}
        >
          {options.map((option) => (
            <option key={option.key} value={option.value}>
              {noun} {option.value + 1}: {coordinates[option.value]?.[0]},{" "}
              {coordinates[option.value]?.[1]}
            </option>
          ))}
        </select>
      </PropertyRow>
      <CoordinateField
        ariaLabel={`Route ${noun.toLowerCase()} longitude`}
        label="Longitude"
        minimum={-180}
        maximum={180}
        value={selectedCoordinates[0]}
        disabled={disabled}
        onCommit={(longitude) =>
          onChange(vertexIndex, [longitude, selectedCoordinates[1]])
        }
      />
      <CoordinateField
        ariaLabel={`Route ${noun.toLowerCase()} latitude`}
        label="Latitude"
        minimum={-MAX_MERCATOR_LATITUDE}
        maximum={MAX_MERCATOR_LATITUDE}
        value={selectedCoordinates[1]}
        disabled={disabled}
        onCommit={(latitude) =>
          onChange(vertexIndex, [selectedCoordinates[0], latitude])
        }
      />
      <div className="route-vertex-actions">
        {allowInsert && (
          <button
            type="button"
            aria-label={`Insert route ${noun.toLowerCase()} after selected`}
            disabled={disabled || vertexIndex >= coordinates.length - 1}
            onClick={() => {
              setSelectedIndex(vertexIndex + 1);
              onInsert(vertexIndex);
            }}
          >
            <Plus size={13} /> Insert after
          </button>
        )}
        <button
          type="button"
          aria-label={`Remove selected route ${noun.toLowerCase()}`}
          disabled={
            disabled ||
            !canRemoveRouteVertex(
              vertexIndex,
              coordinates.length,
              middleOnlyRemove,
            )
          }
          onClick={() => {
            setSelectedIndex(Math.min(vertexIndex, coordinates.length - 2));
            onRemove(vertexIndex);
          }}
        >
          <Trash2 size={13} /> Remove
        </button>
      </div>
      {!disabled && (
        <small className="route-vertex-hint">
          Drag the visible map handles or use the coordinate fields.
        </small>
      )}
    </>
  );
}
