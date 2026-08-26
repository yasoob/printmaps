import { createArcGeometry } from '../../domain/routeArcGeometry';
import type { ContentLayer } from '../../domain/project';
import { buildRouteCoordinates, type RouteAuthoringOptions } from '../../domain/routeProfiles';

export function countDistinctPoints(points: readonly (readonly [number, number])[]): number {
  return new Set(points.map(([longitude, latitude]) => `${longitude},${latitude}`)).size;
}

function uniqueLayerId(projectLayers: readonly ContentLayer[]) {
  const usedIds = new Set(projectLayers.map((layer) => layer.id));
  return (base: string) => {
    let id = base;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    return id;
  };
}

export function createIsochroneCenterLayer(
  center: readonly [number, number] | undefined,
  projectLayers: ContentLayer[],
): ContentLayer[] {
  if (!center) return [];
  const id = uniqueLayerId(projectLayers)('isochrone-center');
  return [{
    id,
    name: 'Travel-time center',
    type: 'poi',
    visible: true,
    locked: true,
    opacity: 100,
    appearance: {
      kind: 'poi', color: '#202124', size: 16, markerShape: 'circle', markerSymbol: 'information', label: '', customAssetId: null,
    },
    geometry: { type: 'Point', coordinates: [center[0], center[1]] },
  }];
}

export function createRouteDraftLayers(
  routePoints: [number, number][],
  projectLayers: ContentLayer[],
  options: RouteAuthoringOptions,
): ContentLayer[] {
  const uniqueId = uniqueLayerId(projectLayers);
  const pointLayers: ContentLayer[] = routePoints.map((coordinates, index) => ({
    id: uniqueId(`route-draft-point-${index + 1}`),
    name: `Route point ${index + 1}`,
    type: 'poi',
    visible: true,
    locked: true,
    opacity: 100,
    geometry: { type: 'Point', coordinates },
  }));
  if (routePoints.length < 2) return pointLayers;
  const coordinates = buildRouteCoordinates(routePoints, options.lineShape);
  if (coordinates.length < 2) return pointLayers;
  const geometry = options.lineShape === 'arc'
    ? createArcGeometry(coordinates)
    : { type: 'LineString' as const, coordinates };
  if (!geometry) return pointLayers;
  return [...pointLayers, {
    id: uniqueId('route-draft'),
    name: 'Route draft',
    type: 'route',
    visible: true,
    locked: true,
    opacity: 100,
    appearance: {
      kind: 'route',
      color: '#d9363e',
      width: 4,
      travelProfile: options.travelProfile,
      showTravelModeIcon: options.showTravelModeIcon,
    },
    geometry,
  }];
}

export function createShapeDraftLayers(
  shapePoints: [number, number][],
  projectLayers: ContentLayer[],
): ContentLayer[] {
  const uniqueId = uniqueLayerId(projectLayers);
  const pointLayers: ContentLayer[] = shapePoints.map((coordinates, index) => ({
    id: uniqueId(`shape-draft-point-${index + 1}`),
    name: `Shape vertex ${index + 1}`,
    type: 'poi',
    visible: true,
    locked: true,
    opacity: 100,
    geometry: { type: 'Point', coordinates },
  }));
  if (shapePoints.length < 2) return pointLayers;
  if (countDistinctPoints(shapePoints) < 3) return [...pointLayers, {
    id: uniqueId('shape-draft-outline'),
    name: 'Shape draft outline',
    type: 'route',
    visible: true,
    locked: true,
    opacity: 100,
    geometry: { type: 'LineString', coordinates: shapePoints },
  }];
  return [...pointLayers, {
    id: uniqueId('shape-draft'),
    name: 'Shape draft',
    type: 'shape',
    visible: true,
    locked: true,
    opacity: 28,
    geometry: { type: 'Polygon', coordinates: [[...shapePoints, shapePoints[0]]] },
  }];
}
