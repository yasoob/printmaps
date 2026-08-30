import { useState } from 'react';
import { MAX_MERCATOR_LATITUDE } from '../../domain/project';
import { isEditableShapeRing } from '../../domain/shapeGeometry';
import { CoordinateField } from './CoordinateField';
import { PropertyRow } from './PropertyControls';

type ShapeVertexControlsProps = {
  coordinates: readonly (readonly (readonly [number, number])[])[];
  disabled?: boolean;
  onChange: (
    ringIndex: number,
    vertexIndex: number,
    coordinates: readonly [number, number],
  ) => void;
};

function optionKeys<T>(items: readonly T[], serialize: (item: T) => string) {
  const occurrences = new Map<string, number>();
  return items.map((item, value) => {
    const serialized = serialize(item);
    const occurrence = (occurrences.get(serialized) ?? 0) + 1;
    occurrences.set(serialized, occurrence);
    return { key: `${serialized}:${occurrence}`, value };
  });
}

export function ShapeVertexControls({ coordinates, disabled = false, onChange }: ShapeVertexControlsProps) {
  const [ringSelection, setRingSelection] = useState(0);
  const [vertexSelection, setVertexSelection] = useState(0);
  const ringIndex = Math.min(ringSelection, Math.max(0, coordinates.length - 1));
  const ring = coordinates[ringIndex];
  if (!ring) return null;
  const ringOptions = optionKeys(coordinates, (candidate) => JSON.stringify(candidate));
  const ringSelector = (
    <PropertyRow label="Ring">
      <select
        aria-label="Shape ring"
        disabled={disabled}
        value={ringIndex}
        onChange={(event) => {
          setRingSelection(Number(event.target.value));
          setVertexSelection(0);
        }}
      >
        {ringOptions.map((option) => (
          <option key={option.key} value={option.value}>
            {option.value === 0 ? 'Outer ring' : `Hole ${option.value}`}
          </option>
        ))}
      </select>
    </PropertyRow>
  );
  if (!isEditableShapeRing(ring)) {
    return (
      <>
        {ringSelector}
        <PropertyRow label="Status">
          <small className="coordinate-validation">Close this ring with at least three vertices before editing it.</small>
        </PropertyRow>
      </>
    );
  }
  const editableCoordinates = ring.slice(0, -1);
  const vertexIndex = Math.min(vertexSelection, Math.max(0, editableCoordinates.length - 1));
  const selectedCoordinates = editableCoordinates[vertexIndex];
  if (!selectedCoordinates) return null;
  const vertexOptions = optionKeys(editableCoordinates, (coordinate) => `${coordinate[0]},${coordinate[1]}`);
  const preservesDistinctVertices = (candidate: readonly [number, number]) => {
    const moved = editableCoordinates.map((coordinate, index) => (
      index === vertexIndex ? candidate : coordinate
    ));
    return new Set(moved.map((coordinate) => `${coordinate[0]},${coordinate[1]}`)).size >= 3;
  };
  const distinctVertexMessage = 'Keep at least three distinct vertices in this ring.';

  return (
    <>
      {ringSelector}
      <PropertyRow label="Vertex">
        <select aria-label="Shape vertex" disabled={disabled} value={vertexIndex} onChange={(event) => setVertexSelection(Number(event.target.value))}>
          {vertexOptions.map((option) => (
            <option key={option.key} value={option.value}>Vertex {option.value + 1}</option>
          ))}
        </select>
      </PropertyRow>
      <CoordinateField key={`shape-longitude-${ringIndex}-${vertexIndex}-${selectedCoordinates[0]}`} ariaLabel="Shape vertex longitude" label="Longitude" minimum={-180} maximum={180} value={selectedCoordinates[0]} disabled={disabled} validate={(longitude) => preservesDistinctVertices([longitude, selectedCoordinates[1]])} validationMessage={distinctVertexMessage} onCommit={(longitude) => onChange(ringIndex, vertexIndex, [longitude, selectedCoordinates[1]])} />
      <CoordinateField key={`shape-latitude-${ringIndex}-${vertexIndex}-${selectedCoordinates[1]}`} ariaLabel="Shape vertex latitude" label="Latitude" minimum={-MAX_MERCATOR_LATITUDE} maximum={MAX_MERCATOR_LATITUDE} value={selectedCoordinates[1]} disabled={disabled} validate={(latitude) => preservesDistinctVertices([selectedCoordinates[0], latitude])} validationMessage={distinctVertexMessage} onCommit={(latitude) => onChange(ringIndex, vertexIndex, [selectedCoordinates[0], latitude])} />
    </>
  );
}
