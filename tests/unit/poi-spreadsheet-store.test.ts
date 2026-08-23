import { createProjectStore } from '../../src/app/store';
import { createInitialProjectDocument } from '../../src/domain/project';

const layerState = (store: ReturnType<typeof createProjectStore>) => store.getState().document.layers;

describe('project store POI spreadsheet batches', () => {
  it('creates a named POI spreadsheet batch as one selected undoable edit', () => {
    const store = createProjectStore(createInitialProjectDocument());

    store.getState().createPoiBatch([
      { name: 'Café Central', coordinates: [16.3725, 48.2084] },
      { name: 'Museum Quarter', coordinates: [16.3599, 48.2034] },
    ]);

    expect(layerState(store).slice(-3).map((layer) => layer.id)).toEqual(['poi-01', 'poi-02', 'basemap']);
    expect(layerState(store).find((layer) => layer.id === 'poi-01')).toMatchObject({
      name: 'Café Central',
      appearance: { kind: 'poi', label: 'Café Central' },
      geometry: { type: 'Point', coordinates: [16.3725, 48.2084] },
    });
    expect(store.getState().selectedId).toBe('poi-01');

    store.getState().undo();
    expect(layerState(store).some((layer) => layer.id === 'poi-01' || layer.id === 'poi-02')).toBe(false);
    expect(store.getState().canRedo).toBe(true);
  });

  it('rejects an invalid POI spreadsheet batch without a partial edit', () => {
    const store = createProjectStore(createInitialProjectDocument());

    store.getState().createPoiBatch([
      { name: 'Valid POI', coordinates: [16.37, 48.21] },
      { name: 'Invalid POI', coordinates: [181, 48.21] },
    ]);

    expect(layerState(store).some((layer) => layer.id === 'poi-01')).toBe(false);
    expect(store.getState().canUndo).toBe(false);
    expect(store.getState().selectedId).toBeNull();
  });

  it('rejects a POI spreadsheet batch over the 300-row cap', () => {
    const store = createProjectStore(createInitialProjectDocument());
    const entries = Array.from({ length: 301 }, (_, index) => ({
      name: `POI ${index + 1}`,
      coordinates: [16.37, 48.21] as [number, number],
    }));

    store.getState().createPoiBatch(entries);

    expect(layerState(store).some((layer) => layer.id === 'poi-01')).toBe(false);
    expect(store.getState().canUndo).toBe(false);
  });
});
