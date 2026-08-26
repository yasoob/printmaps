import { createProjectStore } from '../../src/app/store';
import { createInitialProjectDocument } from '../../src/domain/project';

describe('searched POI project transaction', () => {
  it('creates one named POI with compact Mapbox geocoding provenance', () => {
    const store = createProjectStore(createInitialProjectDocument());
    const epoch = store.getState().documentEpoch;

    const id = store.getState().createSearchPoi({
      coordinate: [16.365, 48.2105],
      label: 'Café Central, Herrengasse 14, Vienna',
      providerFeatureId: 'address.cafe-central',
    }, epoch);

    expect(id).toBe('poi-01');
    expect(store.getState().document.layers.find((layer) => layer.id === id)).toMatchObject({
      name: 'Café Central, Herrengasse 14, Vienna',
      type: 'poi',
      geometry: { type: 'Point', coordinates: [16.365, 48.2105] },
      appearance: { kind: 'poi', label: 'Café Central, Herrengasse 14, Vienna' },
      provenance: {
        provider: 'mapbox',
        service: 'geocoding-v6',
        providerFeatureId: 'address.cafe-central',
      },
    });
    expect(store.getState().past).toHaveLength(1);

    store.getState().undo();
    expect(store.getState().document.layers.some((layer) => layer.id === id)).toBe(false);
  });

  it('drops geocoding provenance after a manual coordinate edit', () => {
    const store = createProjectStore(createInitialProjectDocument());
    const epoch = store.getState().documentEpoch;
    const id = store.getState().createSearchPoi({
      coordinate: [16.365, 48.2105], label: 'Café Central', providerFeatureId: 'address.cafe-central',
    }, epoch);
    if (!id) throw new Error('Expected searched POI creation.');

    store.getState().setPoiCoordinates(id, [16.4, 48.25]);

    const layer = store.getState().document.layers.find((candidate) => candidate.id === id);
    expect(layer).toMatchObject({ geometry: { type: 'Point', coordinates: [16.4, 48.25] } });
    expect(layer?.provenance).toBeUndefined();
  });
});
