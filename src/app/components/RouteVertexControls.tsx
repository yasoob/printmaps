import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { CoordinateField } from './CoordinateField';
import { PropertyRow } from './PropertyControls';

type RouteVertexControlsProps = {
  coordinates: readonly (readonly [number, number])[];
  disabled?: boolean;
  onChange: (vertexIndex: number, coordinates: readonly [number, number]) => void;
  onInsert: (vertexIndex: number) => void;
  onRemove: (vertexIndex: number) => void;
};

export function RouteVertexControls({ coordinates, disabled = false, onChange, onInsert, onRemove }: RouteVertexControlsProps) {
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
        <select aria-label="Route vertex" disabled={disabled} value={vertexIndex} onChange={(event) => setSelectedIndex(Number(event.target.value))}>
          {options.map((option) => (
            <option key={option.key} value={option.value}>Vertex {option.value + 1}</option>
          ))}
        </select>
      </PropertyRow>
      <CoordinateField ariaLabel="Route vertex longitude" label="Longitude" minimum={-180} maximum={180} value={selectedCoordinates[0]} disabled={disabled} onCommit={(longitude) => onChange(vertexIndex, [longitude, selectedCoordinates[1]])} />
      <CoordinateField ariaLabel="Route vertex latitude" label="Latitude" minimum={-90} maximum={90} value={selectedCoordinates[1]} disabled={disabled} onCommit={(latitude) => onChange(vertexIndex, [selectedCoordinates[0], latitude])} />
      <div className="route-vertex-actions">
        <button type="button" aria-label="Insert route vertex after selected" disabled={disabled || vertexIndex >= coordinates.length - 1} onClick={() => { setSelectedIndex(vertexIndex + 1); onInsert(vertexIndex); }}><Plus size={13} /> Insert after</button>
        <button type="button" aria-label="Remove selected route vertex" disabled={disabled || coordinates.length <= 2} onClick={() => { setSelectedIndex(Math.min(vertexIndex, coordinates.length - 2)); onRemove(vertexIndex); }}><Trash2 size={13} /> Remove</button>
      </div>
      {!disabled && <small className="route-vertex-hint">Drag the visible map handles or use the coordinate fields.</small>}
    </>
  );
}
