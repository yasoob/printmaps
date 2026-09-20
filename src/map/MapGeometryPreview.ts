import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer, LayerGeometry } from '../domain/project';
import { mapContentDataForLayer, mapContentSourceId, mapGeometryForLayer } from './MapContentGeometry';
import { hasMapContentSourceData, markMapContentSourceData } from './MapContentSourceState';

export function didPreviewMapGeometry(
  map: Pick<MapLibreMap, 'getSource'>,
  layer: ContentLayer,
  geometry: Exclude<LayerGeometry, { type: 'Arc' }>,
): boolean {
  const previewLayer = { ...layer, geometry };
  const write = (role: string | undefined, data: ReturnType<typeof mapContentDataForLayer>) => {
    const source = map.getSource(mapContentSourceId(layer.id, role));
    if (!source || !('setData' in source) || typeof source.setData !== 'function') return false;
    if (!hasMapContentSourceData(source, previewLayer)) {
      source.setData(data);
      markMapContentSourceData(source, previewLayer);
    }
    return true;
  };
  if (!write(undefined, mapContentDataForLayer(previewLayer, mapGeometryForLayer(previewLayer)))) return false;
  return layer.appearance?.kind !== 'shape' || !layer.appearance.invert
    || write('outline', mapContentDataForLayer(previewLayer, geometry));
}
