import { createProjectStore } from '../../src/app/store';
import {
  createInitialProjectDocument,
  PROJECT_SCHEMA_VERSION,
  type ContentLayer,
  type LayerGeometry,
  type ProjectDocument,
} from '../../src/domain/project';

const layers = [
  { id: 'route-1', name: 'Route 1', type: 'route' as const, visible: true, locked: false, opacity: 100 },
  { id: 'poi-1', name: 'Coffee', type: 'poi' as const, visible: true, locked: false, opacity: 100 },
  { id: 'shape-1', name: 'Center', type: 'shape' as const, visible: true, locked: false, opacity: 30 },
];

function createDocument(): ProjectDocument {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: 'test-project',
    title: 'Test project',
    page: { preset: 'A4', widthMm: 297, heightMm: 210, orientation: 'landscape' },
    camera: { bearing: 0, pitch: 0 },
    style: { preset: 'liberty', textScalePercent: 100, visibility: { roads: true, buildings: true, labels: true } },
    layers,
  };
}

const layerState = (store: ReturnType<typeof createProjectStore>) => store.getState().document.layers;
type LineStringGeometry = Extract<LayerGeometry, { type: 'LineString' }>;

function lineStringGeometryAt(document: ProjectDocument, layerIndex: number): LineStringGeometry {
  const geometry = document.layers[layerIndex].geometry;
  if (geometry === undefined || geometry.type !== 'LineString') {
    throw new Error(`Expected layer ${layerIndex} to have LineString geometry.`);
  }
  return geometry;
}

describe('project store camera history', () => {
  it('commits a valid bearing as one undoable camera edit', () => {
    const store = createProjectStore(createDocument());

    store.getState().setCameraBearing(35);

    expect(store.getState().document.camera.bearing).toBe(35);
    store.getState().undo();
    expect(store.getState().document.camera.bearing).toBe(0);
    store.getState().redo();
    expect(store.getState().document.camera.bearing).toBe(35);
  });

  it('commits a valid pitch as one undoable camera edit', () => {
    const store = createProjectStore(createDocument());

    store.getState().setCameraPitch(40);

    expect(store.getState().document.camera.pitch).toBe(40);
    store.getState().undo();
    expect(store.getState().document.camera.pitch).toBe(0);
  });

  it.each([
    ['setCameraBearing', -181],
    ['setCameraBearing', 181],
    ['setCameraBearing', NaN],
    ['setCameraPitch', -1],
    ['setCameraPitch', 61],
    ['setCameraPitch', Infinity],
  ] as const)('rejects invalid camera value %s(%s) without changing history', (action, value) => {
    const store = createProjectStore(createDocument());

    store.getState()[action](value);

    expect(store.getState().document.camera).toEqual({ bearing: 0, pitch: 0 });
    expect(store.getState().canUndo).toBe(false);
  });
});

describe('project store history', () => {
  it('canonicalizes inconsistent dimensions when reselecting the current orientation', () => {
    const document = createDocument();
    document.page = { preset: 'A4', widthMm: 210, heightMm: 297, orientation: 'landscape' };
    const store = createProjectStore(document);

    store.getState().setPageOrientation('landscape');

    expect(store.getState().document.page).toEqual({
      preset: 'A4',
      widthMm: 297,
      heightMm: 210,
      orientation: 'landscape',
    });
    expect(store.getState().canUndo).toBe(true);
  });

  it('isolates nested geometry across documents, history snapshots, and duplicates', () => {
    const first = createInitialProjectDocument();
    const second = createInitialProjectDocument();
    const firstRoute = lineStringGeometryAt(first, 0);
    const secondRoute = lineStringGeometryAt(second, 0);
    expect(firstRoute.type).toBe('LineString');
    expect(secondRoute.type).toBe('LineString');
    firstRoute.coordinates[0][0] = 0;
    expect(secondRoute.coordinates[0][0]).not.toBe(0);

    const store = createProjectStore(second);
    store.getState().duplicateLayer('route-01');
    const sourceGeometry = lineStringGeometryAt(store.getState().document, 0);
    const duplicateGeometry = lineStringGeometryAt(store.getState().document, 1);
    sourceGeometry.coordinates[0][0] = 1;
    expect(duplicateGeometry.coordinates[0][0]).not.toBe(1);

    store.getState().toggleLayerVisibility('route-01');
    const currentGeometry = lineStringGeometryAt(store.getState().document, 0);
    currentGeometry.coordinates[0][0] = 2;
    store.getState().undo();
    const restoredGeometry = lineStringGeometryAt(store.getState().document, 0);
    expect(restoredGeometry.coordinates[0][0]).not.toBe(2);
  });

  it('rejects a non-finite reorder index without changing history', () => {
    const store = createProjectStore(createDocument());

    store.getState().moveLayer('shape-1', NaN);

    expect(layerState(store).map((layer) => layer.id)).toEqual(['route-1', 'poi-1', 'shape-1']);
    expect(store.getState().canUndo).toBe(false);
  });

  it('clears redo history when a new edit follows undo', () => {
    const store = createProjectStore(createDocument());
    store.getState().toggleLayerVisibility('route-1');
    store.getState().undo();
    expect(store.getState().canRedo).toBe(true);

    store.getState().toggleLayerLock('poi-1');

    expect(store.getState().canRedo).toBe(false);
  });

  it('opens a project as a fresh history root with no selection', () => {
    const store = createProjectStore(createDocument());
    store.getState().selectLayer('route-1');
    store.getState().toggleLayerVisibility('route-1');
    store.getState().undo();
    expect(store.getState().canRedo).toBe(true);

    const openedDocument = createDocument();
    openedDocument.id = 'opened-project';
    openedDocument.title = 'Opened project';
    store.getState().openDocument(openedDocument);

    expect(store.getState().document).toEqual(openedDocument);
    expect(store.getState().selectedId).toBeNull();
    expect(store.getState().past).toEqual([]);
    expect(store.getState().future).toEqual([]);
    expect(store.getState().canUndo).toBe(false);
    expect(store.getState().canRedo).toBe(false);
  });

  it('clears selection when redo removes the selected layer again', () => {
    const store = createProjectStore(createDocument());
    store.getState().deleteLayer('poi-1');
    store.getState().undo();
    store.getState().selectLayer('poi-1');

    store.getState().redo();

    expect(store.getState().selectedId).toBeNull();
  });

  it('clamps opacity edits to the supported percentage range', () => {
    const store = createProjectStore(createDocument());

    store.getState().setLayerOpacity('shape-1', 140);

    expect(layerState(store)[2].opacity).toBe(100);
  });

  it('deletes the selected layer, clears selection, and restores the layer on undo', () => {
    const store = createProjectStore(createDocument());
    store.getState().selectLayer('poi-1');

    store.getState().deleteLayer('poi-1');
    expect(layerState(store).map((layer) => layer.id)).toEqual(['route-1', 'shape-1']);
    expect(store.getState().selectedId).toBeNull();

    store.getState().undo();
    expect(layerState(store).map((layer) => layer.id)).toEqual(['route-1', 'poi-1', 'shape-1']);
  });

  it('reorders layers and can undo the order change', () => {
    const store = createProjectStore(createDocument());

    store.getState().moveLayer('shape-1', 0);
    expect(layerState(store).map((layer) => layer.id)).toEqual(['shape-1', 'route-1', 'poi-1']);

    store.getState().undo();
    expect(layerState(store).map((layer) => layer.id)).toEqual(['route-1', 'poi-1', 'shape-1']);
  });

  it('renames a layer and records the edit in history', () => {
    const store = createProjectStore(createDocument());

    store.getState().renameLayer('route-1', 'Danube loop');

    expect(layerState(store)[0].name).toBe('Danube loop');
    expect(store.getState().canUndo).toBe(true);
  });

  it('toggles a layer lock without changing another layer', () => {
    const store = createProjectStore(createDocument());

    store.getState().toggleLayerLock('poi-1');

    expect(layerState(store).find((layer) => layer.id === 'poi-1')?.locked).toBe(true);
    expect(layerState(store).find((layer) => layer.id === 'route-1')?.locked).toBe(false);
  });

  it('undoes and redoes a visibility change', () => {
    const store = createProjectStore(createDocument());

    store.getState().toggleLayerVisibility('route-1');
    expect(layerState(store)[0].visible).toBe(false);
    expect(store.getState().canUndo).toBe(true);
    expect(store.getState().canRedo).toBe(false);

    store.getState().undo();
    expect(layerState(store)[0].visible).toBe(true);
    expect(store.getState().canUndo).toBe(false);
    expect(store.getState().canRedo).toBe(true);

    store.getState().redo();
    expect(layerState(store)[0].visible).toBe(false);
  });
});

describe('project store layer imports', () => {
  it.each([
    { label: 'non-finite longitude', coordinates: [NaN, 48.21] },
    { label: 'out-of-range longitude', coordinates: [181, 48.21] },
    { label: 'out-of-range latitude', coordinates: [16.37, -91] },
  ])('rejects a $label POI without changing history', ({ coordinates }) => {
    const store = createProjectStore(createInitialProjectDocument());

    store.getState().createPoi(coordinates as [number, number]);

    expect(layerState(store).some((layer) => layer.id === 'poi-01')).toBe(false);
    expect(store.getState().canUndo).toBe(false);
    expect(store.getState().selectedId).toBeNull();
  });

  it('uses the lowest available canonical POI number', () => {
    const document = createInitialProjectDocument();
    document.layers.splice(1, 0, {
      id: 'poi-01',
      name: 'POI 01',
      type: 'poi',
      visible: true,
      locked: false,
      opacity: 100,
      geometry: { type: 'Point', coordinates: [16.35, 48.2] },
    });
    const store = createProjectStore(document);

    store.getState().createPoi([16.37, 48.21]);

    expect(store.getState().selectedId).toBe('poi-02');
    expect(layerState(store).find((layer) => layer.id === 'poi-02')).toMatchObject({
      name: 'POI 02',
      type: 'poi',
      geometry: { type: 'Point', coordinates: [16.37, 48.21] },
    });
  });

  it('creates a straight route as one selected undoable layer', () => {
    const store = createProjectStore(createInitialProjectDocument());
    const coordinates = [[16.31, 48.19], [16.4, 48.24]] as const;

    store.getState().createRoute(coordinates);

    const created = layerState(store).find((layer) => layer.id === 'route-02');
    expect(created).toMatchObject({
      id: 'route-02',
      name: 'Route 02',
      type: 'route',
      geometry: { type: 'LineString', coordinates },
    });
    expect(layerState(store).at(-1)?.type).toBe('basemap');
    expect(store.getState().selectedId).toBe('route-02');
    expect(store.getState().canUndo).toBe(true);

    store.getState().undo();
    expect(layerState(store).some((layer) => layer.id === 'route-02')).toBe(false);
    expect(store.getState().selectedId).toBeNull();
    expect(store.getState().canRedo).toBe(true);

    store.getState().redo();
    expect(layerState(store).some((layer) => layer.id === 'route-02')).toBe(true);
  });

  it('uses the lowest available canonical route number', () => {
    const document = createInitialProjectDocument();
    document.layers = document.layers.filter((layer) => layer.type !== 'route');
    const store = createProjectStore(document);

    store.getState().createRoute([[16.31, 48.19], [16.4, 48.24]]);

    expect(store.getState().selectedId).toBe('route-01');
    expect(layerState(store).find((layer) => layer.id === 'route-01')?.name).toBe('Route 01');
  });

  it.each([
    { label: 'one point', coordinates: [[16.31, 48.19]] },
    { label: 'non-finite longitude', coordinates: [[16.31, 48.19], [NaN, 48.24]] },
    { label: 'out-of-range latitude', coordinates: [[16.31, 48.19], [16.4, 91]] },
  ])('rejects $label route geometry without changing history', ({ coordinates }) => {
    const store = createProjectStore(createInitialProjectDocument());

    store.getState().createRoute(coordinates as [number, number][]);

    expect(layerState(store).some((layer) => layer.id === 'route-02')).toBe(false);
    expect(store.getState().canUndo).toBe(false);
    expect(store.getState().selectedId).toBeNull();
  });

  it('creates a closed shape as one selected undoable layer', () => {
    const store = createProjectStore(createInitialProjectDocument());
    const vertices = [[16.31, 48.19], [16.4, 48.19], [16.36, 48.24]] as const;

    store.getState().createShape(vertices);

    const created = layerState(store).find((layer) => layer.id === 'shape-01');
    expect(created).toMatchObject({
      id: 'shape-01',
      name: 'Shape 01',
      type: 'shape',
      geometry: { type: 'Polygon', coordinates: [[...vertices, vertices[0]]] },
    });
    expect(layerState(store).at(-1)?.type).toBe('basemap');
    expect(store.getState().selectedId).toBe('shape-01');
    expect(store.getState().canUndo).toBe(true);

    store.getState().undo();
    expect(layerState(store).some((layer) => layer.id === 'shape-01')).toBe(false);
    expect(store.getState().selectedId).toBeNull();
    expect(store.getState().canRedo).toBe(true);

    store.getState().redo();
    expect(layerState(store).some((layer) => layer.id === 'shape-01')).toBe(true);
  });

  it('canonicalizes an already-closed shape ring to one terminal vertex', () => {
    const store = createProjectStore(createInitialProjectDocument());
    const closedVertices = [[16.31, 48.19], [16.4, 48.19], [16.36, 48.24], [16.31, 48.19]] as const;

    store.getState().createShape(closedVertices);

    expect(layerState(store).find((layer) => layer.id === 'shape-01')?.geometry).toEqual({
      type: 'Polygon',
      coordinates: [closedVertices],
    });
  });

  it.each([
    { label: 'two vertices', coordinates: [[16.31, 48.19], [16.4, 48.19]] },
    { label: 'fewer than three distinct vertices', coordinates: [[16.31, 48.19], [16.4, 48.19], [16.31, 48.19]] },
    { label: 'non-finite longitude', coordinates: [[16.31, 48.19], [NaN, 48.2], [16.36, 48.24]] },
    { label: 'out-of-range latitude', coordinates: [[16.31, 48.19], [16.4, 91], [16.36, 48.24]] },
  ])('rejects $label shape geometry without changing history', ({ coordinates }) => {
    const store = createProjectStore(createInitialProjectDocument());

    store.getState().createShape(coordinates as [number, number][]);

    expect(layerState(store).some((layer) => layer.id === 'shape-01')).toBe(false);
    expect(store.getState().canUndo).toBe(false);
    expect(store.getState().selectedId).toBeNull();
  });

  it('imports a layer batch before the basemap as one undoable edit', () => {
    const store = createProjectStore(createInitialProjectDocument());
    const importedLayers: ContentLayer[] = [
      {
        id: 'geojson-cafe',
        name: 'Imported café',
        type: 'poi',
        visible: true,
        locked: false,
        opacity: 100,
        geometry: { type: 'Point', coordinates: [16.37, 48.21] },
      },
      {
        id: 'geojson-walk',
        name: 'Imported walk',
        type: 'route',
        visible: true,
        locked: false,
        opacity: 100,
        geometry: { type: 'LineString', coordinates: [[16.36, 48.2], [16.38, 48.22]] },
      },
    ];

    store.getState().importLayers(importedLayers, store.getState().documentEpoch);

    expect(layerState(store).map((layer) => layer.id)).toEqual([
      'route-01',
      'poi-cafe',
      'area-center',
      'geojson-cafe',
      'geojson-walk',
      'basemap',
    ]);
    expect(store.getState().selectedId).toBe('geojson-cafe');
    expect(store.getState().canUndo).toBe(true);

    store.getState().undo();
    expect(layerState(store).map((layer) => layer.id)).toEqual([
      'route-01',
      'poi-cafe',
      'area-center',
      'basemap',
    ]);
    expect(store.getState().selectedId).toBeNull();
    expect(store.getState().canRedo).toBe(true);
  });

  it('keeps layer IDs unique when an imported batch collides with current state', () => {
    const store = createProjectStore(createInitialProjectDocument());
    const importedLayer: ContentLayer = {
      id: 'route-01',
      name: 'Imported route',
      type: 'route',
      visible: true,
      locked: false,
      opacity: 100,
      geometry: { type: 'LineString', coordinates: [[16.36, 48.2], [16.38, 48.22]] },
    };

    store.getState().importLayers([importedLayer, importedLayer], store.getState().documentEpoch);

    expect(layerState(store).map((layer) => layer.id)).toEqual([
      'route-01',
      'poi-cafe',
      'area-center',
      'route-01-2',
      'route-01-3',
      'basemap',
    ]);
    expect(store.getState().selectedId).toBe('route-01-2');
  });
});
