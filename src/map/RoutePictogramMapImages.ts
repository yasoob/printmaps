import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer } from '../domain/project';
import { deriveRenderedRoute } from '../domain/renderedRoute';
import {
  createRoutePictogramImage,
  routePictogramImageId,
} from '../domain/routePictograms';
import type { RouteTravelMarker } from '../domain/routeProfiles';

export type ReferencedRoutePictogram = Readonly<{
  color: string;
  id: string;
  pictogram: RouteTravelMarker;
}>;

export function referencedRoutePictograms(
  layers: readonly ContentLayer[],
): ReferencedRoutePictogram[] {
  const images = new Map<string, ReferencedRoutePictogram>();
  for (const layer of layers) {
    if (layer.appearance?.kind !== 'route' || !layer.appearance.marker) continue;
    const rendered = deriveRenderedRoute(layer);
    if (!rendered) continue;
    for (const marker of rendered.markers) {
      const pictogram = layer.appearance.marker.pictogram;
      const id = routePictogramImageId(pictogram, marker.style.color);
      images.set(id, { color: marker.style.color, id, pictogram });
    }
  }
  return [...images.values()];
}

export function registerRoutePictogramImages(
  map: MapLibreMap,
  layers: readonly ContentLayer[],
): Set<string> {
  const desired = new Set<string>();
  for (const image of referencedRoutePictograms(layers)) {
    desired.add(image.id);
    if (!map.hasImage(image.id)) {
      map.addImage(image.id, createRoutePictogramImage(image.pictogram, image.color), {
        pixelRatio: 2,
      });
    }
  }
  return desired;
}
