import { createProjectStore } from '../../src/app/store';
import { createInitialProjectDocument } from '../../src/domain/project';

describe('basemap layer structure', () => {
  it('keeps exactly one basemap fixed below all reorderable content', () => {
    const store = createProjectStore(createInitialProjectDocument());
    const layerIds = () => store.getState().document.layers.map(({ id }) => id);
    const initialOrder = layerIds();

    store.getState().moveLayer('basemap', 0);
    store.getState().deleteLayer('basemap');
    store.getState().duplicateLayer('basemap');
    expect(layerIds()).toEqual(initialOrder);
    expect(store.getState().canUndo).toBe(false);

    store.getState().moveLayer('route-01', Infinity);
    expect(layerIds()).toEqual(initialOrder);

    store.getState().moveLayer('route-01', 999);
    expect(layerIds()).toEqual([
      'poi-cafe',
      'area-center',
      'route-01',
      'basemap',
    ]);
  });

  it('rejects opening a document without one final basemap', () => {
    const store = createProjectStore(createInitialProjectDocument());
    const invalid = createInitialProjectDocument();
    invalid.layers = invalid.layers.filter(({ type }) => type !== 'basemap');

    expect(() => store.getState().openDocument(invalid)).toThrow(
      'Opened projects must contain exactly one basemap as the final layer.',
    );
  });
});
