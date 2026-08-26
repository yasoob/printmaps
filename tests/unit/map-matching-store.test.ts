import { describe, expect, it } from 'vitest';
import { createProjectStore } from '../../src/app/store';

describe('canonical map-matched routes', () => {
  it('replaces one route as one undoable edit with compact map-matching provenance', () => {
    const store = createProjectStore();
    store.getState().selectLayer('route-01');
    const original = structuredClone(store.getState().document.layers.find(({ id }) => id === 'route-01'));
    const geometry = [[16.3261, 48.1941], [16.36, 48.21], [16.4291, 48.2261]] as const;

    const applied = store.getState().applyMapMatching('route-01', {
      geometry,
      profile: 'walking',
      confidence: 0.93,
      sourcePointCount: 4,
    }, 0);

    expect(applied).toBe(true);
    expect(store.getState().document.schemaVersion).toBe(21);
    expect(store.getState().document.layers.find(({ id }) => id === 'route-01')).toMatchObject({
      geometry: { type: 'LineString', coordinates: geometry },
      provenance: {
        provider: 'mapbox', service: 'map-matching-v5', profile: 'walking', confidence: 0.93, sourcePointCount: 4,
      },
    });
    expect(store.getState().past).toHaveLength(1);

    store.getState().undo();
    expect(store.getState().document.layers.find(({ id }) => id === 'route-01')).toEqual(original);
  });

  it('clears map-matching provenance after manual route geometry edits', () => {
    const store = createProjectStore();
    const apply = () => store.getState().applyMapMatching('route-01', {
      geometry: [[16.3261, 48.1941], [16.36, 48.21], [16.4291, 48.2261]],
      profile: 'walking', confidence: 0.93, sourcePointCount: 4,
    }, store.getState().documentEpoch);
    const provenance = () => store.getState().document.layers.find(({ id }) => id === 'route-01')?.provenance;

    expect(apply()).toBe(true);
    store.getState().setRouteVertex('route-01', 1, [16.361, 48.211]);
    expect(provenance()).toBeUndefined();

    expect(apply()).toBe(true);
    store.getState().insertRouteVertex('route-01', 0);
    expect(provenance()).toBeUndefined();

    expect(apply()).toBe(true);
    store.getState().removeRouteVertex('route-01', 1);
    expect(provenance()).toBeUndefined();
  });
});
