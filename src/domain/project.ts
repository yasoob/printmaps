import type { ArcGeometry } from './routeArcGeometry';
import { createDefaultLayerAppearance, type LayerAppearance } from './layerAppearance';
import type { CustomMarkerAsset } from './customMarkerAssets';
import { MAP_STYLE_PRESET_LABELS, type MapStylePreset } from './mapStylePresets';
import type { PagePreset } from './pagePresets';

export type { ArcGeometry } from './routeArcGeometry';
export { createDefaultLayerAppearance } from './layerAppearance';
export type {
  LayerAppearance,
  PoiAppearance,
  RouteAppearance,
  ShapeAppearance,
} from './layerAppearance';

export const PROJECT_SCHEMA_VERSION = 23 as const;
export const MAX_MERCATOR_LATITUDE = 85.051129;
export const MAX_MAP_ZOOM = 22;

export function normalizeCameraPrecision(value: number): number {
  return Number(value.toFixed(6));
}

export type LayerType = 'route' | 'poi' | 'shape' | 'basemap';
export type PageOrientation = 'landscape' | 'portrait';
export type { PagePreset, StandardPagePreset } from './pagePresets';
export type { MapStylePreset } from './mapStylePresets';
export type MapLanguage = 'local' | 'en' | 'de' | 'fr' | 'it' | 'es' | 'zh';
export type MapFeatureVisibilityCategory = 'roads' | 'buildings' | 'labels' | 'water' | 'parks' | 'landuse' | 'transit';
export type MapFeatureVisibility = Record<MapFeatureVisibilityCategory, boolean>;

export type PageSettings = {
  preset: PagePreset;
  widthMm: number;
  heightMm: number;
  orientation: PageOrientation;
};

export type CameraSettings = {
  bearing: number;
  center: [number, number];
  locked: boolean;
  pitch: number;
  zoom: number;
};

export type MapStyleSettings = {
  preset: MapStylePreset;
  language: MapLanguage;
  textScalePercent: number;
  visibility: MapFeatureVisibility;
};

export type PolygonGeometry = { type: 'Polygon'; coordinates: [number, number][][] };
export type MultiPolygonGeometry = { type: 'MultiPolygon'; coordinates: [number, number][][][] };
export type ShapeGeometry = PolygonGeometry | MultiPolygonGeometry;

export type IsochroneProvenance = {
  provider: 'mapbox';
  service: 'isochrone-v1';
  center: [number, number];
  profile: 'driving' | 'cycling' | 'walking';
  minutes: number;
};

export type DirectionsProvenance = {
  provider: 'mapbox';
  service: 'directions-v5';
  waypoints: [number, number][];
  profile: 'driving' | 'cycling' | 'walking';
  distanceMeters: number;
  durationSeconds: number;
};

export type GeocodingProvenance = {
  provider: 'mapbox';
  service: 'geocoding-v6';
  providerFeatureId: string;
};

export type MapMatchingProvenance = {
  provider: 'mapbox';
  service: 'map-matching-v5';
  profile: 'driving' | 'cycling' | 'walking';
  confidence?: number;
  sourcePointCount: number;
};

export type ProviderProvenance = IsochroneProvenance | DirectionsProvenance | GeocodingProvenance | MapMatchingProvenance;

export type SearchPoiInput = {
  coordinate: [number, number];
  label: string;
  providerFeatureId: string;
};

export type DirectionsRouteInput = {
  geometry: [number, number][];
  waypoints: [number, number][];
  profile: DirectionsProvenance['profile'];
  distanceMeters: number;
  durationSeconds: number;
};

export type MapMatchingInput = {
  geometry: readonly (readonly [number, number])[];
  profile: MapMatchingProvenance['profile'];
  confidence?: number;
  sourcePointCount: number;
};

export type IsochroneAreaInput = {
  center: [number, number];
  geometry: ShapeGeometry;
  label: string;
  profile: IsochroneProvenance['profile'];
  minutes: number;
};

export type LayerGeometry =
  | ArcGeometry
  | ShapeGeometry
  | { type: 'Point'; coordinates: [number, number] }
  | { type: 'LineString'; coordinates: [number, number][] };

export type ContentLayer = {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;
  opacity: number;
  appearance?: LayerAppearance;
  geometry?: LayerGeometry;
  provenance?: ProviderProvenance;
};

export type ProjectDocument = {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  id: string;
  title: string;
  page: PageSettings;
  camera: CameraSettings;
  style: MapStyleSettings;
  assets: Record<string, CustomMarkerAsset>;
  layers: ContentLayer[];
};

const createDefaultPageSettings = (): PageSettings => ({
  preset: 'A4',
  widthMm: 297,
  heightMm: 210,
  orientation: 'landscape',
});

const createDefaultCameraSettings = (): CameraSettings => ({
  bearing: 0,
  center: [16.3725, 48.2084],
  locked: false,
  pitch: 0,
  zoom: 11.2,
});
const createDefaultMapFeatureVisibility = (): MapFeatureVisibility => ({
  roads: true,
  buildings: true,
  labels: true,
  water: true,
  parks: true,
  landuse: true,
  transit: true,
});
const createDefaultMapStyleSettings = (): MapStyleSettings => ({
  preset: 'paper',
  language: 'local',
  textScalePercent: 100,
  visibility: createDefaultMapFeatureVisibility(),
});

export function mapStyleBasemapName(preset: MapStylePreset): string {
  return `${MAP_STYLE_PRESET_LABELS[preset]} basemap`;
}

function cloneProviderProvenance(provenance: ProviderProvenance | undefined): ProviderProvenance | undefined {
  if (provenance?.service === 'isochrone-v1') {
    return { ...provenance, center: [...provenance.center] as [number, number] };
  }
  if (provenance?.service === 'directions-v5') {
    return {
      ...provenance,
      waypoints: provenance.waypoints.map((position) => [...position] as [number, number]),
    };
  }
  if (provenance?.service === 'geocoding-v6') return { ...provenance };
  if (provenance?.service === 'map-matching-v5') return { ...provenance };
}

export function cloneContentLayer(layer: ContentLayer): ContentLayer {
  const appearance = layer.appearance ? { ...layer.appearance } : undefined;
  const provenance = cloneProviderProvenance(layer.provenance);
  const base = { ...layer };
  delete base.appearance;
  delete base.provenance;
  const copy = { ...base, ...(appearance && { appearance }), ...(provenance && { provenance }) };
  if (!layer.geometry) return copy;
  if (layer.geometry.type === 'Arc') {
    return {
      ...copy,
      geometry: {
        type: 'Arc',
        anchors: layer.geometry.anchors.map((position) => [...position]) as ArcGeometry['anchors'],
        curvatures: [...layer.geometry.curvatures] as ArcGeometry['curvatures'],
      },
    };
  }
  if (layer.geometry.type === 'Point') {
    return { ...copy, geometry: { ...layer.geometry, coordinates: [...layer.geometry.coordinates] } };
  }
  if (layer.geometry.type === 'LineString') {
    return {
      ...copy,
      geometry: {
        ...layer.geometry,
        coordinates: layer.geometry.coordinates.map((position) => (
          [position[0], position[1]] as [number, number]
        )),
      },
    };
  }
  if (layer.geometry.type === 'Polygon') return {
    ...copy,
    geometry: {
      ...layer.geometry,
      coordinates: layer.geometry.coordinates.map((ring) => ring.map((position) => (
        [position[0], position[1]] as [number, number]
      ))),
    },
  };
  return {
    ...copy,
    geometry: {
      ...layer.geometry,
      coordinates: layer.geometry.coordinates.map((polygon) => polygon.map((ring) => ring.map((position) => (
        [position[0], position[1]] as [number, number]
      )))),
    },
  };
}

const baseMapLayer: ContentLayer = {
  id: 'basemap',
  name: 'Paper basemap',
  type: 'basemap',
  visible: true,
  locked: true,
  opacity: 100,
};

const initialLayers: ContentLayer[] = [
  {
    id: 'route-01',
    name: 'Route 01',
    type: 'route',
    visible: true,
    locked: false,
    opacity: 100,
    appearance: createDefaultLayerAppearance('route'),
    geometry: {
      type: 'LineString',
      coordinates: [[16.326, 48.194], [16.353, 48.205], [16.391, 48.215], [16.429, 48.226]],
    },
  },
  {
    id: 'poi-cafe',
    name: 'Coffee stop',
    type: 'poi',
    visible: true,
    locked: false,
    opacity: 100,
    appearance: createDefaultLayerAppearance('poi'),
    geometry: { type: 'Point', coordinates: [16.3725, 48.2084] },
  },
  {
    id: 'area-center',
    name: 'City center',
    type: 'shape',
    visible: true,
    locked: false,
    opacity: 28,
    appearance: createDefaultLayerAppearance('shape'),
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [16.354, 48.198], [16.395, 48.198], [16.395, 48.22], [16.354, 48.22], [16.354, 48.198],
      ]],
    },
  },
  baseMapLayer,
];

export function createNewProjectDocument(): ProjectDocument {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: 'untitled-map',
    title: 'Untitled map',
    page: createDefaultPageSettings(),
    camera: createDefaultCameraSettings(),
    style: createDefaultMapStyleSettings(),
    assets: {},
    layers: [cloneContentLayer(baseMapLayer)],
  };
}

/**
 * Example content used by component, store, and browser tests.
 */
export function createInitialProjectDocument(): ProjectDocument {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: 'vienna-field-guide',
    title: 'Vienna field guide',
    page: createDefaultPageSettings(),
    camera: createDefaultCameraSettings(),
    style: createDefaultMapStyleSettings(),
    assets: {},
    layers: initialLayers.map((layer) => cloneContentLayer(layer)),
  };
}
