import { Marker, type Map as MapLibreMap } from 'maplibre-gl';
import { createArcGeometry, sampleArc } from '../domain/routeArcGeometry';
import type { ContentLayer } from '../domain/project';
import { isValidPosition, semanticRoutePointLabel } from '../domain/routeGeometry';
import { mapContentSourceId, routeMapFeatures } from './MapContentGeometry';
import { markMapContentSourceData } from './MapContentSourceState';
import {
  arcInsertionCoordinates,
  canonicalRouteCoordinates,
} from './RouteVertexCoordinates';
import {
  clearRouteVertexPreview,
  createRouteVertexPreviewState,
  isCurrentRouteVertexPreview,
  recordRouteVertexPreview,
  type RouteVertexPreviewState,
} from './RouteVertexPreviewState';

export type RouteVertexMarker = {
  addTo: (map: RouteVertexMap) => RouteVertexMarker;
  getElement: () => HTMLElement;
  getLngLat: () => { lng: number; lat: number };
  on: (event: 'drag' | 'dragend', handler: () => void) => RouteVertexMarker;
  remove: () => void;
  setLngLat: (coordinate: readonly [number, number]) => RouteVertexMarker;
};
type RouteVertexMap = Pick<MapLibreMap, 'getSource' | 'project' | 'unproject'>;
type MarkerFactory = (element: HTMLElement) => RouteVertexMarker;
type RouteVertexEditingOptions = {
  createMarker?: MarkerFactory;
  onInsert?: (segmentIndex: number) => void;
  onPreview?: (coordinates: [number, number][]) => boolean | void;
};
export type RouteVertexEditingSession = (() => void)
  & { focusVertex: (vertexIndex: number) => void; synchronizeLayer: (layer: ContentLayer) => boolean };
const createMapLibreMarker: MarkerFactory = (element) => (
  new Marker({ draggable: true, element }) as unknown as RouteVertexMarker
);

function normalizedMapCoordinate(longitude: number, latitude: number): [number, number] | null {
  if (!isValidPosition(longitude, latitude)) return null;
  return [Number(longitude.toFixed(6)), Number(latitude.toFixed(6))];
}

function didSetRouteSourceGeometry(
  map: RouteVertexMap,
  layer: ContentLayer,
  coordinates: readonly (readonly [number, number])[],
): boolean {
  try {
    const source = map.getSource(mapContentSourceId(layer.id)) as {
      setData?: (data: unknown) => void;
    } | undefined;
    if (typeof source?.setData !== 'function') return false;
    const geometry = layer.geometry?.type === 'Arc'
      ? createArcGeometry(coordinates, layer.geometry.curvatures)
      : {
          type: 'LineString' as const,
          coordinates: coordinates.map((coordinate) => [...coordinate] as [number, number]),
        };
    if (!geometry) return false;
    const previewLayer = { ...layer, geometry };
    const data = routeMapFeatures(previewLayer);
    if (!data) return false;
    source.setData(data);
    markMapContentSourceData(source, previewLayer);
    return true;
  } catch {
    return false;
  }
}

function displayCoordinates(layer: ContentLayer, coordinates: [number, number][]) {
  if (layer.geometry?.type !== 'Arc') return coordinates;
  const arc = createArcGeometry(coordinates, layer.geometry.curvatures);
  return arc ? sampleArc(arc) : null;
}

function didUpdateGuidance(
  onPreview: NonNullable<RouteVertexEditingOptions['onPreview']>,
  coordinates: [number, number][],
) {
  try {
    return onPreview(coordinates) !== false;
  } catch {
    return false;
  }
}

type EditableRouteLayer = ContentLayer & {
  geometry: Extract<NonNullable<ContentLayer['geometry']>, { type: 'Arc' | 'LineString' }>;
};
function isEditableRouteLayer(layer: ContentLayer): layer is EditableRouteLayer {
  return layer.type === 'route'
    && !layer.locked
    && layer.visible
    && (layer.geometry?.type === 'LineString' || layer.geometry?.type === 'Arc');
}
type RestorePreviewOptions = {
  canonicalCoordinates: [number, number][]; isArc: boolean; layer: ContentLayer;
  map: RouteVertexMap;
  onPreview: NonNullable<RouteVertexEditingOptions['onPreview']>;
};

function restoreRoutePreview(options: RestorePreviewOptions) {
  const didRestoreSource = didSetRouteSourceGeometry(
    options.map,
    options.layer,
    options.canonicalCoordinates,
  ) || didSetRouteSourceGeometry(options.map, options.layer, options.canonicalCoordinates);
  const didRestoreGuidance = options.isArc
    || didUpdateGuidance(options.onPreview, options.canonicalCoordinates)
    || didUpdateGuidance(options.onPreview, options.canonicalCoordinates);
  return didRestoreSource && didRestoreGuidance;
}

type VertexMarkerOptions = {
  canonicalCoordinates: [number, number][];
  createMarker: MarkerFactory;
  map: RouteVertexMap;
  markers: RouteVertexMarker[];
  onCommit: (vertexIndex: number, coordinate: readonly [number, number]) => void;
  preview: (vertexIndex: number, coordinate: readonly [number, number]) => boolean;
  previewState: RouteVertexPreviewState;
  restoreCanonicalPreview: () => boolean;
  layer: ContentLayer;
};

function addVertexMarkers(options: VertexMarkerOptions) {
  for (const [vertexIndex, coordinate] of options.canonicalCoordinates.entries()) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'route-vertex-marker';
    element.dataset.routeVertexIndex = String(vertexIndex);
    const pointLabel = semanticRoutePointLabel(options.layer, vertexIndex);
    element.setAttribute('aria-label', `Drag route ${pointLabel.toLowerCase()}`);
    element.title = `Drag route ${pointLabel.toLowerCase()} · Arrow keys nudge`;
    const marker = options.createMarker(element).setLngLat(coordinate).addTo(options.map);
    marker.on('drag', () => {
      const { lng, lat } = marker.getLngLat();
      const nextCoordinate = normalizedMapCoordinate(lng, lat);
      if (nextCoordinate && !options.preview(vertexIndex, nextCoordinate)) {
        marker.setLngLat(options.canonicalCoordinates[vertexIndex]);
      }
    });
    marker.on('dragend', () => {
      const { lng, lat } = marker.getLngLat();
      const nextCoordinate = normalizedMapCoordinate(lng, lat);
      if (!nextCoordinate) {
        marker.setLngLat(coordinate);
        options.restoreCanonicalPreview();
        return;
      }
      const isAlreadyPreviewed = isCurrentRouteVertexPreview(
        options.previewState,
        vertexIndex,
        nextCoordinate,
      );
      if (!isAlreadyPreviewed && !options.preview(vertexIndex, nextCoordinate)) {
        marker.setLngLat(coordinate);
        return;
      }
      clearRouteVertexPreview(options.previewState);
      options.onCommit(vertexIndex, nextCoordinate);
    });
    element.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      const currentCoordinate = marker.getLngLat();
      const point = options.map.project([currentCoordinate.lng, currentCoordinate.lat]);
      const step = event.shiftKey ? 1 : 8;
      switch (event.key) {
        case 'ArrowLeft': { point.x -= step; break; }
        case 'ArrowRight': { point.x += step; break; }
        case 'ArrowUp': { point.y -= step; break; }
        case 'ArrowDown': { point.y += step; break; }
      }
      const next = options.map.unproject(point);
      const nextCoordinate = normalizedMapCoordinate(next.lng, next.lat);
      if (!nextCoordinate || !options.preview(vertexIndex, nextCoordinate)) return;
      marker.setLngLat(nextCoordinate);
      clearRouteVertexPreview(options.previewState);
      options.onCommit(vertexIndex, nextCoordinate);
    });
    options.markers.push(marker);
  }
}

function addArcInsertionMarkers(
  map: RouteVertexMap,
  geometry: Extract<NonNullable<ContentLayer['geometry']>, { type: 'Arc' }>,
  options: Required<Pick<RouteVertexEditingOptions, 'onInsert'>> & Pick<RouteVertexEditingOptions, 'createMarker'>,
  markers: RouteVertexMarker[],
) {
  const createMarker = options.createMarker ?? createMapLibreMarker;
  for (const [segmentIndex, coordinate] of arcInsertionCoordinates(geometry).entries()) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'route-midpoint-marker';
    element.dataset.routeSegmentIndex = String(segmentIndex);
    element.setAttribute('aria-label', `Add route vertex between ${segmentIndex + 1} and ${segmentIndex + 2}`);
    element.title = `Add route vertex between ${segmentIndex + 1} and ${segmentIndex + 2}`;
    element.addEventListener('click', (event) => {
      event.stopPropagation();
      options.onInsert(segmentIndex);
    });
    markers.push(createMarker(element).setLngLat(coordinate).addTo(map));
  }
}

export function installRouteVertexEditing(
  map: RouteVertexMap,
  layer: ContentLayer,
  onCommit: (vertexIndex: number, coordinate: readonly [number, number]) => void,
  options: RouteVertexEditingOptions = {},
): RouteVertexEditingSession {
  if (!isEditableRouteLayer(layer)) {
    const emptySession = (() => {}) as RouteVertexEditingSession;
    emptySession.focusVertex = () => {};
    return emptySession;
  }

  const createMarker = options.createMarker ?? createMapLibreMarker;
  const onPreview = options.onPreview ?? (() => true);
  let currentLayer = layer;
  const canonicalCoordinates = canonicalRouteCoordinates(layer);
  let isDirectionsRoute = layer.provenance?.service === 'directions-v5';
  const canonicalDisplayCoordinates = isDirectionsRoute
    ? (layer.geometry.type === 'LineString' ? layer.geometry.coordinates.map((coordinate) => [...coordinate] as [number, number]) : null)
    : displayCoordinates(layer, canonicalCoordinates);
  if (!canonicalDisplayCoordinates) throw new Error('The selected route cannot be previewed.');
  const markers: RouteVertexMarker[] = [];
  const previewState = createRouteVertexPreviewState();
  const restoreCanonicalPreview = () => {
    const didRestore = restoreRoutePreview({
      canonicalCoordinates,
      isArc: currentLayer.geometry?.type === 'Arc',
      layer: currentLayer,
      map,
      onPreview,
    });
    clearRouteVertexPreview(previewState, !didRestore);
    return !previewState.hasUncommitted;
  };
  const preview = (vertexIndex: number, coordinate: readonly [number, number]) => {
    if (isDirectionsRoute) return true;
    const coordinates = canonicalCoordinates.map((candidate, index) => (
      index === vertexIndex ? [coordinate[0], coordinate[1]] as [number, number] : candidate
    ));
    if (
      currentLayer.route?.closed
      && coordinates.length > 1
      && (vertexIndex === 0 || vertexIndex === coordinates.length - 1)
    ) {
      coordinates[0] = [coordinate[0], coordinate[1]];
      coordinates[coordinates.length - 1] = [coordinate[0], coordinate[1]];
    }
    const nextDisplayCoordinates = displayCoordinates(currentLayer, coordinates);
    if (!nextDisplayCoordinates) return false;
    const didUpdateSource = didSetRouteSourceGeometry(map, currentLayer, coordinates);
    const didUpdateTerraGuidance = currentLayer.geometry?.type === 'Arc' || didUpdateGuidance(onPreview, coordinates);
    if (!didUpdateSource || !didUpdateTerraGuidance) {
      restoreCanonicalPreview();
      return false;
    }
    recordRouteVertexPreview(previewState, vertexIndex, coordinate);
    return true;
  };
  addVertexMarkers({
    canonicalCoordinates, createMarker, layer, map, markers, onCommit, preview, previewState, restoreCanonicalPreview,
  });
  if (layer.geometry.type === 'Arc' && options.onInsert) {
    addArcInsertionMarkers(map, layer.geometry, {
      createMarker: options.createMarker,
      onInsert: options.onInsert,
    }, markers);
  }

  const cleanup = (() => {
    if (previewState.hasUncommitted) restoreCanonicalPreview();
    for (const marker of markers) marker.remove();
  }) as RouteVertexEditingSession;
  cleanup.focusVertex = (vertexIndex) => markers[vertexIndex]?.getElement().focus();
  cleanup.synchronizeLayer = (nextLayer) => {
    if (
      !isEditableRouteLayer(nextLayer)
      || nextLayer.id !== currentLayer.id
      || nextLayer.geometry.type !== currentLayer.geometry.type
    ) {
      return false;
    }
    const nextCoordinates = canonicalRouteCoordinates(nextLayer);
    const arcMidpoints = nextLayer.geometry.type === 'Arc'
      ? arcInsertionCoordinates(nextLayer.geometry)
      : [];
    if (markers.length !== nextCoordinates.length + arcMidpoints.length) {
      return false;
    }
    currentLayer = nextLayer;
    isDirectionsRoute = nextLayer.provenance?.service === 'directions-v5';
    canonicalCoordinates.splice(0, canonicalCoordinates.length, ...nextCoordinates);
    for (const [index, coordinate] of [
      ...nextCoordinates,
      ...arcMidpoints,
    ].entries()) {
      markers[index].setLngLat(coordinate);
    }
    clearRouteVertexPreview(previewState);
    return true;
  };
  return cleanup;
}
