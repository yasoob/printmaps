import { createDefaultLayerAppearance, type LayerAppearance } from './layerAppearance';

export { createDefaultLayerAppearance } from './layerAppearance';
export type {
  LayerAppearance,
  PoiAppearance,
  RouteAppearance,
  ShapeAppearance,
} from './layerAppearance';

export const PROJECT_SCHEMA_VERSION = 10 as const;

export type LayerType = 'route' | 'poi' | 'shape' | 'basemap';
export type PageOrientation = 'landscape' | 'portrait';
export type PagePreset = 'A4' | 'A3' | 'Letter' | 'Custom';
export type StandardPagePreset = Exclude<PagePreset, 'Custom'>;
export type MapStylePreset = 'liberty' | 'positron';
export type MapFeatureVisibilityCategory = 'roads' | 'buildings' | 'labels';
export type MapFeatureVisibility = Record<MapFeatureVisibilityCategory, boolean>;

export type PageSettings = {
  preset: PagePreset;
  widthMm: number;
  heightMm: number;
  orientation: PageOrientation;
};

export type CameraSettings = {
  bearing: number;
  pitch: number;
};

export type MapStyleSettings = {
  preset: MapStylePreset;
  textScalePercent: number;
  visibility: MapFeatureVisibility;
};

export type LayerGeometry =
  | { type: 'Point'; coordinates: [number, number] }
  | { type: 'LineString'; coordinates: [number, number][] }
  | { type: 'Polygon'; coordinates: [number, number][][] };

export type ContentLayer = {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;
  opacity: number;
  appearance?: LayerAppearance;
  geometry?: LayerGeometry;
};

export type ProjectDocument = {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  id: string;
  title: string;
  page: PageSettings;
  camera: CameraSettings;
  style: MapStyleSettings;
  layers: ContentLayer[];
};

const createDefaultPageSettings = (): PageSettings => ({
  preset: 'A4',
  widthMm: 297,
  heightMm: 210,
  orientation: 'landscape',
});

const createDefaultCameraSettings = (): CameraSettings => ({ bearing: 0, pitch: 0 });
const createDefaultMapFeatureVisibility = (): MapFeatureVisibility => ({
  roads: true,
  buildings: true,
  labels: true,
});
const createDefaultMapStyleSettings = (): MapStyleSettings => ({
  preset: 'liberty',
  textScalePercent: 100,
  visibility: createDefaultMapFeatureVisibility(),
});

export function mapStyleBasemapName(preset: MapStylePreset): string {
  return `${preset === 'liberty' ? 'Liberty' : 'Positron'} basemap`;
}

export function cloneContentLayer(layer: ContentLayer): ContentLayer {
  const appearance = layer.appearance ? { ...layer.appearance } : undefined;
  const base = { ...layer };
  delete base.appearance;
  const copy = appearance ? { ...base, appearance } : base;
  if (!layer.geometry) return copy;
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
  return {
    ...copy,
    geometry: {
      ...layer.geometry,
      coordinates: layer.geometry.coordinates.map((ring) => ring.map((position) => (
        [position[0], position[1]] as [number, number]
      ))),
    },
  };
}

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
  { id: 'basemap', name: 'Liberty basemap', type: 'basemap', visible: true, locked: true, opacity: 100 },
];

export function createInitialProjectDocument(): ProjectDocument {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: 'vienna-field-guide',
    title: 'Vienna field guide',
    page: createDefaultPageSettings(),
    camera: createDefaultCameraSettings(),
    style: createDefaultMapStyleSettings(),
    layers: initialLayers.map((layer) => cloneContentLayer(layer)),
  };
}
