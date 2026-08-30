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
  appearance: { kind: 'route', color: '#d9363e', width: 4, travelMarker: null },
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
  it('previews Arc drag and keyboard edits on the canonical sampled source', () => {
    const { createMarker, map, markers, setData } = routeHarness();
    const arc = {
      ...route,
      geometry: { type: 'Arc' as const, anchors: [[0, 0], [2, 0]] as [[number, number], [number, number]], curvatures: [0.35] as [number] },
    };
    const commit = vi.fn();
    installRouteVertexEditing(map, arc, commit, { createMarker });

    markers[1].coordinate = { lng: 3, lat: 0 };
    markers[1].trigger('drag');
    const preview = setData.mock.calls.at(-1)?.[0].geometry.coordinates;
    expect(preview).toBeDefined();
    if (!preview) throw new Error('Arc preview was not written.');
    expect(preview).toHaveLength(25);
    expect(Math.abs(preview[12][1])).toBeGreaterThan(0.1);
    markers[1].trigger('dragend');
    expect(commit).toHaveBeenCalledWith(1, [3, 0]);

    markers[0].element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(commit).toHaveBeenLastCalledWith(0, [8, 0]);
  });

  it('adds accessible insertion handles for every Arc segment', () => {
    const { createMarker, map, markers } = routeHarness();
    const arc = {
      ...route,
      geometry: {
        type: 'Arc' as const,
        anchors: [[0, 0], [1, 0], [2, 0]] as [[number, number], [number, number], [number, number]],
        curvatures: [0.35, -0.35] as [number, number],
      },
    };
    const onInsert = vi.fn();
    installRouteVertexEditing(map, arc, vi.fn(), { createMarker, onInsert });

    expect(markers).toHaveLength(5);
    expect(markers[3].element).toHaveAttribute('aria-label', 'Add route vertex between 1 and 2');
    markers[3].element.click();
    expect(onInsert).toHaveBeenCalledWith(0);
  });

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
