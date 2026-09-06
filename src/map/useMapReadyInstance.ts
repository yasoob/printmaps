import { useCallback, useLayoutEffect, useRef, useState, type SetStateAction } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';

export function useMapReadyInstance(scope: string) {
  const [stored, setStored] = useState<{ scope: string; map: MapLibreMap | null }>({ scope, map: null });
  const activeScope = useRef(scope);
  useLayoutEffect(() => { activeScope.current = scope; }, [scope]);
  const setMap = useCallback((update: SetStateAction<MapLibreMap | null>) => {
    if (activeScope.current !== scope) return;
    setStored((current) => {
      const previous = current.scope === scope ? current.map : null;
      const map = typeof update === 'function' ? update(previous) : update;
      return previous === map && current.scope === scope ? current : { scope, map };
    });
  }, [scope]);
  return { map: stored.scope === scope ? stored.map : null, setMap };
}
