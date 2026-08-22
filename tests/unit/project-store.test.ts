import { createProjectStore } from '../../src/app/store';
import {
  createInitialProjectDocument,
  PROJECT_SCHEMA_VERSION,
  type LayerGeometry,
  type ProjectDocument,
  type ProjectDocumentV1,
  type ProjectDocumentV2,
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

describe('project store history', () => {
  it('migrates a version-1 document without page settings at the store boundary', () => {
    const versionOneDocument: ProjectDocumentV1 = {
      schemaVersion: 1,
      id: 'legacy-project',
      title: 'Legacy project',
      layers,
    };

    const store = createProjectStore(versionOneDocument);

    expect(store.getState().document).toMatchObject({
      schemaVersion: 3,
      page: { preset: 'A4', widthMm: 297, heightMm: 210, orientation: 'landscape' },
    });
  });

  it.each([
    {
      name: 'standard landscape dimensions',
      page: { widthMm: 297, heightMm: 210, orientation: 'landscape' as const },
      preset: 'A4',
    },
    {
      name: 'standard portrait dimensions',
      page: { widthMm: 210, heightMm: 297, orientation: 'portrait' as const },
      preset: 'A4',
    },
    {
      name: 'standard dimensions inconsistent with the declared orientation',
      page: { widthMm: 210, heightMm: 297, orientation: 'landscape' as const },
      preset: 'Custom',
    },
    {
      name: 'genuinely custom dimensions',
      page: { widthMm: 250, heightMm: 180, orientation: 'landscape' as const },
      preset: 'Custom',
    },
  ])('migrates version-2 $name without changing dimensions', ({ page, preset }) => {
    const versionTwoDocument: ProjectDocumentV2 = {
      schemaVersion: 2,
      id: 'legacy-project',
      title: 'Legacy project',
      page,
      layers,
    };

    const store = createProjectStore(versionTwoDocument);

    expect(store.getState().document.page).toEqual({ ...page, preset });
  });

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
