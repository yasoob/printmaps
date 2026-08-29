import { describe, expect, it, vi } from 'vitest';
import type { ContentLayer } from '../../src/domain/project';
import {
  installRouteVertexEditing,
  type RouteVertexMarker,
} from '../../src/map/RouteVertexEditing';

class FakeMarker implements RouteVertexMarker {
  coordinate = { lng: 0, lat: 0 };
  readonly handlers = new Map<string, () => void>();

  constructor(readonly element: HTMLElement) {}
  addTo() { return this; }
  getElement() { return this.element; }
  getLngLat() { return this.coordinate; }
  on(event: 'drag' | 'dragend', handler: () => void) { this.handlers.set(event, handler); return this; }
  remove() {}
  setLngLat([lng, lat]: readonly [number, number]) { this.coordinate = { lng, lat }; return this; }
  trigger(event: 'drag' | 'dragend') { this.handlers.get(event)?.(); }
}

const route: ContentLayer = {
  id: 'route-project-id', name: 'Route', type: 'route', visible: true, locked: false, opacity: 100,
  appearance: { kind: 'route', color: '#d9363e', width: 4, travelProfile: 'car', showTravelModeIcon: false },
  geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1], [2, 0]] },
};

function routeHarness() {
  const markers: FakeMarker[] = [];
  let sourceCoordinates: readonly (readonly [number, number])[] = [[0, 0], [1, 1], [2, 0]];
  const setData = vi.fn((data: { geometry: { coordinates: [number, number][] } }) => {
    sourceCoordinates = data.geometry.coordinates;
  });
  const createMarker = (element: HTMLElement) => {
    const marker = new FakeMarker(element);
    markers.push(marker);
    return marker;
  };
  const map = {
    getSource: () => ({ setData }),
    project: ([lng, lat]: readonly [number, number]) => ({ x: lng, y: lat }),
    unproject: ({ x, y }: { x: number; y: number }) => ({ lng: x, lat: y }),
  };
  return {
    createMarker,
    map: map as unknown as Parameters<typeof installRouteVertexEditing>[0],
    markers,
    setData,
    sourceCoordinates: () => sourceCoordinates,
  };
}

describe('route vertex map editing', () => {
  it('restores Terra guidance when canonical MapLibre source restoration fails', () => {
    const { createMarker, map, markers, setData, sourceCoordinates } = routeHarness();
    const onPreview = vi.fn();
    const commit = vi.fn();
    installRouteVertexEditing(map, route, commit, { createMarker, onPreview });
    markers[1].coordinate = { lng: 3, lat: 2 };
    markers[1].trigger('drag');
    setData.mockImplementationOnce(() => { throw new Error('source unavailable'); });
    markers[1].coordinate = { lng: 181, lat: 2 };

    expect(() => markers[1].trigger('dragend')).not.toThrow();

    expect(onPreview).toHaveBeenLastCalledWith([[0, 0], [1, 1], [2, 0]]);
    expect(sourceCoordinates()).toEqual([[0, 0], [1, 1], [2, 0]]);
    expect(commit).not.toHaveBeenCalled();
  });

  it('rolls a cancelled preview back to one canonical source and Terra geometry', () => {
    const { createMarker, map, markers, setData } = routeHarness();
    const onPreview = vi.fn();
    const commit = vi.fn();
    const cleanup = installRouteVertexEditing(map, route, commit, { createMarker, onPreview });
    markers[1].coordinate = { lng: 3, lat: 2 };
    markers[1].trigger('drag');

    cleanup();

    expect(setData).toHaveBeenLastCalledWith(expect.objectContaining({
      geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1], [2, 0]] },
    }));
    expect(onPreview).toHaveBeenLastCalledWith([[0, 0], [1, 1], [2, 0]]);
    expect(commit).not.toHaveBeenCalled();
  });

  it('restores both surfaces when Terra rejects a live preview', () => {
    const { createMarker, map, markers, setData } = routeHarness();
    const onPreview = vi.fn((coordinates: [number, number][]) => coordinates[1][0] === 1);
    installRouteVertexEditing(map, route, vi.fn(), { createMarker, onPreview });
    markers[1].coordinate = { lng: 3, lat: 2 };

    markers[1].trigger('drag');

    expect(setData).toHaveBeenLastCalledWith(expect.objectContaining({
      geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1], [2, 0]] },
    }));
    expect(onPreview).toHaveBeenLastCalledWith([[0, 0], [1, 1], [2, 0]]);
    expect(markers[1].coordinate).toEqual({ lng: 1, lat: 1 });
  });

  it('restores the canonical MapLibre source when Terra guidance restoration fails', () => {
    const { createMarker, map, markers, setData } = routeHarness();
    const onPreview = vi.fn((coordinates: [number, number][]) => {
      if (coordinates[1][0] === 1) throw new Error('Terra unavailable');
    });
    installRouteVertexEditing(map, route, vi.fn(), { createMarker, onPreview });
    markers[1].coordinate = { lng: 3, lat: 2 };
    markers[1].trigger('drag');
    markers[1].coordinate = { lng: 181, lat: 2 };

    expect(() => markers[1].trigger('dragend')).not.toThrow();

    expect(setData).toHaveBeenLastCalledWith(expect.objectContaining({
      geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1], [2, 0]] },
    }));
  });
});
