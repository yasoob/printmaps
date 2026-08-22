export const PROJECT_SCHEMA_VERSION = 7 as const;

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

export type ProjectDocumentV1 = {
  schemaVersion: 1;
  id: string;
  title: string;
  layers: ContentLayer[];
};

export type ProjectDocumentV2 = {
  schemaVersion: 2;
  id: string;
  title: string;
  page: Omit<PageSettings, 'preset'>;
  layers: ContentLayer[];
};

export type ProjectDocumentV3 = {
  schemaVersion: 3;
  id: string;
  title: string;
  page: PageSettings;
  layers: ContentLayer[];
};

export type ProjectDocumentV4 = {
  schemaVersion: 4;
  id: string;
  title: string;
  page: PageSettings;
  camera: CameraSettings;
  layers: ContentLayer[];
};

export type ProjectDocumentV5 = {
  schemaVersion: 5;
  id: string;
  title: string;
  page: PageSettings;
  camera: CameraSettings;
  style: Pick<MapStyleSettings, 'preset'>;
  layers: ContentLayer[];
};

export type ProjectDocumentV6 = {
  schemaVersion: 6;
  id: string;
  title: string;
  page: PageSettings;
  camera: CameraSettings;
  style: Omit<MapStyleSettings, 'visibility'>;
  layers: ContentLayer[];
};

export type StoredProjectDocument = ProjectDocumentV1 | ProjectDocumentV2 | ProjectDocumentV3 | ProjectDocumentV4 | ProjectDocumentV5 | ProjectDocumentV6 | ProjectDocument;

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

export function migrateProjectDocument(document: StoredProjectDocument): ProjectDocument {
  if (document.schemaVersion === 1) {
    return {
      ...document,
      schemaVersion: PROJECT_SCHEMA_VERSION,
      page: createDefaultPageSettings(),
      camera: createDefaultCameraSettings(),
      style: createDefaultMapStyleSettings(),
    };
  }
  if (document.schemaVersion === 2) {
    return {
      ...document,
      schemaVersion: PROJECT_SCHEMA_VERSION,
      page: {
        ...document.page,
        preset: inferPagePreset(
          document.page.widthMm,
          document.page.heightMm,
          document.page.orientation,
        ),
      },
      camera: createDefaultCameraSettings(),
      style: createDefaultMapStyleSettings(),
    };
  }
  if (document.schemaVersion === 3) {
    return {
      ...document,
      schemaVersion: PROJECT_SCHEMA_VERSION,
      camera: createDefaultCameraSettings(),
      style: createDefaultMapStyleSettings(),
    };
  }
  if (document.schemaVersion === 4) {
    return {
      ...document,
      schemaVersion: PROJECT_SCHEMA_VERSION,
      style: createDefaultMapStyleSettings(),
    };
  }
  if (document.schemaVersion === 5) {
    return {
      ...document,
      schemaVersion: PROJECT_SCHEMA_VERSION,
      style: {
        ...document.style,
        textScalePercent: 100,
        visibility: createDefaultMapFeatureVisibility(),
      },
    };
  }
  if (document.schemaVersion === 6) {
    return {
      ...document,
      schemaVersion: PROJECT_SCHEMA_VERSION,
      style: { ...document.style, visibility: createDefaultMapFeatureVisibility() },
    };
  }
  return document;
}

function inferPagePreset(
  widthMm: number,
  heightMm: number,
  orientation: PageOrientation,
): PagePreset {
  const isDimensionsMatchOrientation = orientation === 'landscape'
    ? widthMm >= heightMm
    : heightMm >= widthMm;
  if (!isDimensionsMatchOrientation) return 'Custom';

  const shortEdge = Math.min(widthMm, heightMm);
  const longEdge = Math.max(widthMm, heightMm);
  if (shortEdge === 210 && longEdge === 297) return 'A4';
  if (shortEdge === 297 && longEdge === 420) return 'A3';
  if (shortEdge === 215.9 && longEdge === 279.4) return 'Letter';
  return 'Custom';
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
    camera: createDefaultCameraSettings(),
    style: createDefaultMapStyleSettings(),
    layers: initialLayers.map((layer) => cloneContentLayer(layer)),
  };
}
