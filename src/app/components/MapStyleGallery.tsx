import { Check } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import {
  MAP_STYLE_PRESETS,
  type MapStyleFamily,
  type MapStylePreset,
} from '../../domain/mapStylePresets';

const MAP_STYLE_FAMILIES: readonly { id: 'all' | MapStyleFamily; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'dark', label: 'Dark' },
  { id: 'soft', label: 'Soft' },
  { id: 'natural', label: 'Natural' },
  { id: 'playful', label: 'Playful' },
];

type MapStyleGalleryProps = {
  selectedPreset: MapStylePreset;
  onSelect: (preset: MapStylePreset) => void;
};

export function MapStyleGallery({ selectedPreset, onSelect }: MapStyleGalleryProps) {
  const [family, setFamily] = useState<'all' | MapStyleFamily>('all');
  const cardRefs = useRef(new Map<MapStylePreset, HTMLButtonElement>());
  const visiblePresets = useMemo(() => (
    family === 'all' ? MAP_STYLE_PRESETS : MAP_STYLE_PRESETS.filter((preset) => preset.family === family)
  ), [family]);
  const tabStop = visiblePresets.some(({ id }) => id === selectedPreset)
    ? selectedPreset
    : visiblePresets[0]?.id;

  const moveFocus = (currentIndex: number, direction: 'first' | 'last' | number) => {
    let nextIndex: number;
    if (direction === 'first') nextIndex = 0;
    else if (direction === 'last') nextIndex = visiblePresets.length - 1;
    else nextIndex = Math.min(visiblePresets.length - 1, Math.max(0, currentIndex + direction));
    const preset = visiblePresets[nextIndex];
    if (preset) cardRefs.current.get(preset.id)?.focus();
  };

  return (
    <div className="map-style-picker">
      <div aria-label="Map style theme families" className="map-style-filters" role="toolbar">
        {MAP_STYLE_FAMILIES.map((option) => (
          <button
            key={option.id}
            aria-label={`${option.label} theme${option.id === 'all' ? 's' : ''}`}
            aria-pressed={family === option.id}
            type="button"
            onClick={() => setFamily(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div aria-label="Map style presets" className="map-style-gallery" role="radiogroup">
        {visiblePresets.map((preset, index) => (
          <button
            key={preset.id}
            ref={(element) => {
              if (element) cardRefs.current.set(preset.id, element);
              else cardRefs.current.delete(preset.id);
            }}
            aria-checked={preset.id === selectedPreset}
            aria-label={`${preset.label}: ${preset.description}`}
            className="map-style-card"
            role="radio"
            tabIndex={preset.id === tabStop ? 0 : -1}
            type="button"
            onClick={() => onSelect(preset.id)}
            onKeyDown={(event) => {
              const columns = globalThis.matchMedia?.('(max-width: 899px)').matches ? 2 : 3;
              switch (event.key) {
                case 'ArrowLeft': { event.preventDefault(); moveFocus(index, -1); break; }
                case 'ArrowRight': { event.preventDefault(); moveFocus(index, 1); break; }
                case 'ArrowUp': { event.preventDefault(); moveFocus(index, -columns); break; }
                case 'ArrowDown': { event.preventDefault(); moveFocus(index, columns); break; }
                case 'Home': { event.preventDefault(); moveFocus(index, 'first'); break; }
                case 'End': { event.preventDefault(); moveFocus(index, 'last'); break; }
              }
            }}
          >
            <span className="map-style-card-preview">
              <img alt="" height="72" src={preset.thumbnailUrl} width="108" />
              <span className="map-style-card-check"><Check aria-hidden="true" size={12} strokeWidth={2.25} /></span>
            </span>
            <span className="map-style-card-label">{preset.label}</span>
          </button>
        ))}
      </div>
      <p className="map-style-attribution">Preview data © OpenStreetMap contributors · OpenFreeMap</p>
    </div>
  );
}
