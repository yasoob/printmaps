import { Check } from 'lucide-react';
import { useRef } from 'react';
import { MAP_STYLE_PRESETS, type MapStylePreset } from '../../domain/mapStylePresets';

type MapStyleGalleryProps = {
  selectedPreset: MapStylePreset;
  onSelect: (preset: MapStylePreset) => void;
};

export function MapStyleGallery({ selectedPreset, onSelect }: MapStyleGalleryProps) {
  const cardRefs = useRef(new Map<MapStylePreset, HTMLButtonElement>());
  const visiblePresets = MAP_STYLE_PRESETS;
  const tabStop = selectedPreset;

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
    </div>
  );
}
