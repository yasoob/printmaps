import { Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { MAX_MERCATOR_LATITUDE } from "../../domain/project";
import { routePointRemovalError } from "../../domain/routePointConstraints";
import { CoordinateField } from "./CoordinateField";
import { PropertyRow } from "./PropertyControls";

type RouteVertexControlsProps = {
  coordinates: readonly (readonly [number, number])[];
  disabled?: boolean;
  onChange: (
    vertexIndex: number,
    coordinates: readonly [number, number],
  ) => import("../../domain/projectMutation").GeometryEditResult;
  onInsert: (vertexIndex: number) => import("../../domain/projectMutation").ProjectMutationResult;
  onRemove: (vertexIndex: number) => import("../../domain/projectMutation").GeometryEditResult;
  noun?: "Anchor" | "Vertex" | "Waypoint";
  allowInsert?: boolean;
  middleOnlyRemove?: boolean;
  isClosed?: boolean;
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

export function RouteVertexControls({
  coordinates,
  disabled = false,
  noun = "Vertex",
  allowInsert = true,
  middleOnlyRemove = false,
  isClosed,
  onChange,
  onInsert,
  onRemove,
}: RouteVertexControlsProps) {
  const removalHintId = useId();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const vertexIndex = Math.min(
    selectedIndex,
    Math.max(0, coordinates.length - 1),
  );
  const selectedCoordinates = coordinates[vertexIndex];
  if (!selectedCoordinates) return null;
  const options = routeVertexOptions(coordinates);
  const removalError = routePointRemovalError({
    pointCount: coordinates.length, pointIndex: vertexIndex, isClosed: isClosed === true, isMiddleOnly: middleOnlyRemove,
  });

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
              const result = onInsert(vertexIndex);
              if (result.ok) setSelectedIndex(vertexIndex + 1);
            }}
          >
            <Plus size={13} /> Insert after
          </button>
        )}
        <button
          type="button"
          aria-label={`Remove selected route ${noun.toLowerCase()}`}
          disabled={disabled || removalError !== null}
          aria-describedby={removalError ? removalHintId : undefined}
          onClick={() => {
            const result = onRemove(vertexIndex);
            if ('pending' in result || result.ok) setSelectedIndex(Math.min(vertexIndex, coordinates.length - 2));
          }}
        >
          <Trash2 size={13} /> Remove
        </button>
      </div>
      {removalError && <small id={removalHintId} className="route-vertex-hint route-removal-hint">{removalError}</small>}
      {!disabled && (
        <small className="route-vertex-hint">
          Drag the visible map handles or use the coordinate fields.
        </small>
      )}
    </>
  );
}
