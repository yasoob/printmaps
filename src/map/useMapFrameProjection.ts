import { useEffect, type RefObject } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { observeMapFrameProjection, type MapFrameProjection } from './MapFrameProjection';

export function useMapFrameProjection(
  map: MapLibreMap | null,
  container: RefObject<HTMLDivElement | null>,
  onChange: ((projection: MapFrameProjection | null) => void) | undefined,
) {
  useEffect(() => {
    if (!onChange) return;
    if (!map) {
      onChange(null);
      return;
    }
    return observeMapFrameProjection(
      map,
      () => container.current?.parentElement?.querySelector<HTMLElement>('.print-frame'),
      onChange,
    );
  }, [container, map, onChange]);
}
