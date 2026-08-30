import type { Map as MapLibreMap } from 'maplibre-gl';

export const ROUTE_EDITOR_PREFIX = 'studio-route-editor';

export type TerraRouteHandleOrder = 'absent' | 'failed' | 'moved';

/**
 * Kept apart from the draw factory so the map controller can reorder editor
 * handles without pulling terra-draw into the initial bundle.
 */
export function bringTerraRouteHandlesToFront(
  map: Pick<MapLibreMap, 'getLayer' | 'moveLayer'>,
): TerraRouteHandleOrder {
  let didFail = false;
  let didMove = false;
  for (const id of [`${ROUTE_EDITOR_PREFIX}-point`, `${ROUTE_EDITOR_PREFIX}-point-marker`]) {
    try {
      if (!map.getLayer(id)) continue;
      map.moveLayer(id);
      didMove = true;
    } catch {
      didFail = true;
    }
  }
  if (didFail) return 'failed';
  return didMove ? 'moved' : 'absent';
}
