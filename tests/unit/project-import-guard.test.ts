import { createProjectStore, type ProjectState } from '../../src/app/store';
import { createInitialProjectDocument, type ContentLayer } from '../../src/domain/project';
import type { StoreApi } from 'zustand/vanilla';

/**
 * Imports are staged against a snapshot taken when the file is first read, and
 * rejected if the project moved on before the batch could be applied. Camera
 * writes are excluded: panning is not an edit, and a drag would otherwise
 * discard any import still being read or reviewed.
 */

const importedLayer: ContentLayer = {
  id: 'imported-route',
  name: 'Imported route',
  type: 'route',
  visible: true,
  locked: false,
  opacity: 100,
  geometry: { type: 'LineString', coordinates: [[16.36, 48.2], [16.38, 48.22]] },
};

type ProjectStore = StoreApi<ProjectState>;

function stage() {
  const store = createProjectStore(createInitialProjectDocument());
  return { store, sourceDocument: store.getState().document, documentEpoch: store.getState().documentEpoch };
}

function commitImport({ store, sourceDocument, documentEpoch }: ReturnType<typeof stage>) {
  return store.getState().importLayers([importedLayer], documentEpoch, sourceDocument);
}

const hasImportedLayer = (store: ProjectStore) =>
  store.getState().document.layers.some((layer) => layer.id === 'imported-route');

describe('import staleness guard', () => {
  it.each([
    ['a pointer-rate pan', 'amend' as const],
    ['a settled pan', 'history' as const],
  ])('applies a batch staged before %s', (_label, mode) => {
    const staged = stage();
    staged.store.getState().setCameraViewport([16.4, 48.2], 12, mode);

    expect(commitImport(staged)).toBe(true);
    expect(hasImportedLayer(staged.store)).toBe(true);
  });

  it.each([
    ['the project is renamed', (store: ProjectStore) => store.getState().setProjectTitle('Renamed mid-read')],
    ['a layer is deleted', (store: ProjectStore) => store.getState().deleteLayer('poi-cafe')],
    ['the page changes', (store: ProjectStore) => store.getState().setPageOrientation('portrait')],
    ['the edit is undone', (store: ProjectStore) => {
      store.getState().setProjectTitle('Renamed mid-read');
      store.getState().undo();
    }],
  ])('rejects a batch staged before %s', (_label, mutate) => {
    const staged = stage();
    mutate(staged.store);

    expect(commitImport(staged)).toBe(false);
    expect(hasImportedLayer(staged.store)).toBe(false);
  });

  it('rejects a batch staged against a replaced document', () => {
    const staged = stage();
    staged.store.getState().openDocument(createInitialProjectDocument());

    expect(commitImport(staged)).toBe(false);
    expect(hasImportedLayer(staged.store)).toBe(false);
  });

  it('rejects imported basemap layers', () => {
    const staged = stage();
    const basemap = createInitialProjectDocument().layers.at(-1);
    if (!basemap) throw new Error('Expected basemap fixture.');

    const imported = staged.store.getState().importLayers(
      [{ ...basemap, id: 'imported-basemap' }],
      staged.documentEpoch,
      staged.sourceDocument,
    );

    expect(imported).toBe(false);
    expect(staged.store.getState().document.layers.filter(({ type }) => type === 'basemap')).toHaveLength(1);
  });
});
