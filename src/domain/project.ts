export const PROJECT_SCHEMA_VERSION = 1 as const;

export type LayerType = 'route' | 'poi' | 'shape' | 'basemap';

export type ContentLayer = {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;
  opacity: number;
};

export type ProjectDocument = {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  id: string;
  title: string;
  layers: ContentLayer[];
};

const initialLayers: ContentLayer[] = [
  { id: 'route-01', name: 'Route 01', type: 'route', visible: true, locked: false, opacity: 100 },
  { id: 'poi-cafe', name: 'Coffee stop', type: 'poi', visible: true, locked: false, opacity: 100 },
  { id: 'area-center', name: 'City center', type: 'shape', visible: true, locked: false, opacity: 28 },
  { id: 'basemap', name: 'Liberty basemap', type: 'basemap', visible: true, locked: true, opacity: 100 },
];

export function createInitialProjectDocument(): ProjectDocument {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: 'vienna-field-guide',
    title: 'Vienna field guide',
    layers: initialLayers.map((layer) => ({ ...layer })),
  };
}
