import type { Map as MapLibreMap } from 'maplibre-gl';
import type { CustomMarkerAsset } from '../domain/customMarkerAssets';
import type { ContentLayer } from '../domain/project';
import { withoutStudioContentLayers } from './NativeMapStyle';

type Coordinate = readonly [number, number];
export type MapRenderSnapshot = Readonly<{
  style: ReturnType<MapLibreMap['getStyle']>;
  layers: readonly ContentLayer[];
  assets: Readonly<Record<string, CustomMarkerAsset>>;
  camera: Readonly<{ center: Coordinate; zoom: number; bearing: number; pitch: number; roll: number }>;
  printCamera: Readonly<{ center: Coordinate; zoom: number; bearing: number; pitch: number }>;
  viewport: Readonly<{ width: number; height: number }>;
  frame: Readonly<{ x: number; y: number; width: number; height: number }>;
  footprint: Readonly<{
    corners: readonly [Coordinate, Coordinate, Coordinate, Coordinate];
    widthPx: number;
    heightPx: number;
    bearing: number;
    pitch: number;
  }>;
  referenceLongitude: number;
}>;

export type MapRenderSnapshotOptions = Readonly<{
  content?: 'basemap' | 'composite';
}>;

function freezeSnapshot<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freezeSnapshot(child);
  }
  return value;
}

function requireSnapshotReadiness(map: MapLibreMap, isSourceReady: () => boolean): void {
  if (!isSourceReady() || !map.loaded() || !map.areTilesLoaded() || map.isMoving()) {
    throw new Error('The map is not ready for an export snapshot. Wait for tiles and camera movement to finish.');
  }
}

export function captureMapRenderSnapshot(
  map: MapLibreMap,
  source: Readonly<{
    isSourceReady: () => boolean;
    resolveStyle: (content: 'basemap' | 'composite') => ReturnType<MapLibreMap['getStyle']>;
    resolvePrintFrame: () => HTMLElement | null | undefined;
    resolveContent: () => Readonly<{ layers: ContentLayer[]; assets?: Record<string, CustomMarkerAsset> }>;
  }>,
  options: MapRenderSnapshotOptions = {},
): MapRenderSnapshot {
  requireSnapshotReadiness(map, source.isSourceReady);
  const content = source.resolveContent();
  const frameElement = source.resolvePrintFrame(), bounds = frameElement?.getBoundingClientRect();
  if (!bounds) throw new Error('The print frame is not ready for an export snapshot.');
  const canvas = map.getCanvas().getBoundingClientRect();
  const frame = { x: bounds.left - canvas.left, y: bounds.top - canvas.top, width: bounds.width, height: bounds.height };
  if ([frame.width, frame.height, canvas.width, canvas.height].some((value) => !(Number.isFinite(value) && value > 0))) {
    throw new Error('The map or print frame has invalid export dimensions.');
  }
  const coordinate = (x: number, y: number): Coordinate => {
    const point = map.unproject([x, y]);
    return [point.lng, point.lat];
  };
  const center = map.getCenter(), bearing = map.getBearing(), pitch = map.getPitch();
  const style = source.resolveStyle(options.content ?? 'composite');
  const snapshot: MapRenderSnapshot = {
    style: options.content === 'basemap' ? withoutStudioContentLayers(style) : structuredClone(style),
    layers: structuredClone(content.layers),
    assets: structuredClone(content.assets ?? {}),
    camera: { center: [center.lng, center.lat], zoom: map.getZoom(), bearing, pitch, roll: map.getRoll() },
    printCamera: { center: coordinate(frame.x + frame.width / 2, frame.y + frame.height / 2), zoom: map.getZoom(), bearing, pitch },
    viewport: { width: canvas.width, height: canvas.height },
    frame,
    footprint: {
      corners: [
        coordinate(frame.x, frame.y), coordinate(frame.x + frame.width, frame.y),
        coordinate(frame.x + frame.width, frame.y + frame.height), coordinate(frame.x, frame.y + frame.height),
      ],
      widthPx: frame.width, heightPx: frame.height, bearing, pitch,
    },
    referenceLongitude: center.lng,
  };
  if (!source.isSourceReady() || source.resolveContent() !== content) {
    throw new Error('The map changed during snapshot capture. Retry the export.');
  }
  return freezeSnapshot(snapshot);
}
