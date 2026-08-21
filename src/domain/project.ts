export const PROJECT_SCHEMA_VERSION = 2 as const;

export type LayerType = 'route' | 'poi' | 'shape' | 'basemap';
export type PageOrientation = 'landscape' | 'portrait';

export type PageSettings = {
  widthMm: number;
  heightMm: number;
  orientation: PageOrientation;
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
  geometry?: LayerGeometry;
};

export type ProjectDocument = {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  id: string;
  title: string;
  page: PageSettings;
  layers: ContentLayer[];
};

export type ProjectDocumentV1 = {
  schemaVersion: 1;
  id: string;
  title: string;
  layers: ContentLayer[];
};

export type StoredProjectDocument = ProjectDocumentV1 | ProjectDocument;

const createDefaultPageSettings = (): PageSettings => ({
  widthMm: 297,
  heightMm: 210,
  orientation: 'landscape',
});

export function migrateProjectDocument(document: StoredProjectDocument): ProjectDocument {
  if (document.schemaVersion === 1) {
    return {
      ...document,
      schemaVersion: PROJECT_SCHEMA_VERSION,
      page: createDefaultPageSettings(),
    };
  }
  return document;
}

export function cloneContentLayer(layer: ContentLayer): ContentLayer {
  if (!layer.geometry) return { ...layer };
  if (layer.geometry.type === 'Point') {
    return { ...layer, geometry: { ...layer.geometry, coordinates: [...layer.geometry.coordinates] } };
  }
  if (layer.geometry.type === 'LineString') {
    return {
      ...layer,
      geometry: {
        ...layer.geometry,
        coordinates: layer.geometry.coordinates.map((position) => (
          [position[0], position[1]] as [number, number]
        )),
      },
    };
  }
  return {
    ...layer,
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
    geometry: { type: 'Point', coordinates: [16.3725, 48.2084] },
  },
  {
    id: 'area-center',
    name: 'City center',
    type: 'shape',
    visible: true,
    locked: false,
    opacity: 28,
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
    layers: initialLayers.map(cloneContentLayer),
  };
}
