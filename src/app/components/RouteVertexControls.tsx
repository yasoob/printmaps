import { useState } from 'react';
import { CoordinateField } from './CoordinateField';
import { PropertyRow } from './PropertyControls';

type RouteVertexControlsProps = {
  coordinates: readonly (readonly [number, number])[];
  onChange: (vertexIndex: number, coordinates: readonly [number, number]) => void;
};

export function RouteVertexControls({ coordinates, onChange }: RouteVertexControlsProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const vertexIndex = Math.min(selectedIndex, Math.max(0, coordinates.length - 1));
  const selectedCoordinates = coordinates[vertexIndex];
  if (!selectedCoordinates) return null;
  const coordinateOccurrences = new Map<string, number>();
  const options = [];
  for (const coordinate of coordinates) {
    const location = `${coordinate[0]},${coordinate[1]}`;
    const occurrence = (coordinateOccurrences.get(location) ?? 0) + 1;
    coordinateOccurrences.set(location, occurrence);
    options.push({ key: `${location}:${occurrence}`, value: options.length });
  }

  return (
    <>
      <PropertyRow label="Vertex">
        <select aria-label="Route vertex" value={vertexIndex} onChange={(event) => setSelectedIndex(Number(event.target.value))}>
          {options.map((option) => (
            <option key={option.key} value={option.value}>Vertex {option.value + 1}</option>
          ))}
        </select>
      </PropertyRow>
      <CoordinateField key={`route-longitude-${vertexIndex}-${selectedCoordinates[0]}`} ariaLabel="Route vertex longitude" label="Longitude" minimum={-180} maximum={180} value={selectedCoordinates[0]} onCommit={(longitude) => onChange(vertexIndex, [longitude, selectedCoordinates[1]])} />
      <CoordinateField key={`route-latitude-${vertexIndex}-${selectedCoordinates[1]}`} ariaLabel="Route vertex latitude" label="Latitude" minimum={-90} maximum={90} value={selectedCoordinates[1]} onCommit={(latitude) => onChange(vertexIndex, [selectedCoordinates[0], latitude])} />
    </>
  );
}
