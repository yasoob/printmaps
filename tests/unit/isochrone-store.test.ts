import { createProjectStore } from '../../src/app/store';
import { createInitialProjectDocument, type IsochroneAreaInput } from '../../src/domain/project';

const geometry: IsochroneAreaInput['geometry'] = {
  type: 'Polygon' as const,
  coordinates: [[
    [16.35, 48.2], [16.4, 48.2], [16.4, 48.24], [16.35, 48.2],
  ]],
};

const input: IsochroneAreaInput = {
  center: [16.3725, 48.2084] as [number, number],
  geometry,
  label: '15 min walking area',
  minutes: 15,
  profile: 'walking' as const,
};

describe('isochrone project transaction', () => {
  it('creates one selected durable Area before the basemap and undoes it in one step', () => {
    const store = createProjectStore(createInitialProjectDocument());
    const epoch = store.getState().documentEpoch;

    const id = store.getState().createIsochroneArea(input, epoch);

    expect(id).toBe('isochrone-01');
    const state = store.getState();
    const layer = state.document.layers.find((candidate) => candidate.id === id);
    expect(state.selectedId).toBe(id);
    expect(state.document.layers.at(-1)?.type).toBe('basemap');
    expect(layer).toMatchObject({
      name: '15 min walking area',
      type: 'shape',
      appearance: { kind: 'shape', label: '15 min walking area' },
      geometry,
      provenance: {
        provider: 'mapbox',
        service: 'isochrone-v1',
        center: [16.3725, 48.2084],
        profile: 'walking',
        minutes: 15,
      },
    });
    expect(state.past).toHaveLength(1);
    expect(layer?.geometry).not.toBe(geometry);

    store.getState().undo();
    expect(store.getState().document.layers.some((candidate) => candidate.id === id)).toBe(false);
    store.getState().redo();
    expect(store.getState().document.layers.find((candidate) => candidate.id === id)).toMatchObject({ geometry });
  });

  it('does not commit a stale response into a replaced document', () => {
    const store = createProjectStore(createInitialProjectDocument());
    const staleEpoch = store.getState().documentEpoch;
    store.getState().openDocument(createInitialProjectDocument());

    expect(store.getState().createIsochroneArea(input, staleEpoch)).toBeNull();
    expect(store.getState().document.layers.some(({ id }) => id.startsWith('isochrone-'))).toBe(false);
    expect(store.getState().canUndo).toBe(false);
  });
});
