import { describe, expect, it, vi } from 'vitest';
import { installRouteVertexEditing, type RouteVertexMarker } from '../../src/map/RouteVertexEditing';
import { createInitialProjectDocument } from '../../src/domain/project';

class FakeMarker implements RouteVertexMarker {
  readonly handlers = new Map<string, () => void>();
  removed = false;
  coordinate: [number, number] = [0, 0];

  constructor(readonly element: HTMLElement) {}

  addTo() { return this; }
  getElement() { return this.element; }
  getLngLat() { return { lng: this.coordinate[0], lat: this.coordinate[1] }; }
  on(event: 'drag' | 'dragend', handler: () => void) { this.handlers.set(event, handler); return this; }
  remove() { this.removed = true; }
  setLngLat(coordinate: readonly [number, number]) { this.coordinate = [coordinate[0], coordinate[1]]; return this; }
  trigger(event: 'drag' | 'dragend') { this.handlers.get(event)?.(); }
}

function createHarness() {
  const setData = vi.fn();
  const map = {
    getSource: vi.fn(() => ({ setData })),
    project: vi.fn(([longitude, latitude]: readonly [number, number]) => ({ x: longitude * 10, y: latitude * -10 })),
    unproject: vi.fn(({ x, y }: { x: number; y: number }) => ({ lng: x / 10, lat: y / -10 })),
  };
  const markers: FakeMarker[] = [];
  const createMarker = (element: HTMLElement) => {
    const marker = new FakeMarker(element);
    markers.push(marker);
    return marker;
  };
  const route = createInitialProjectDocument().layers.find((layer) => layer.id === 'route-01')!;
  return {
    createMarker,
    map: map as unknown as Parameters<typeof installRouteVertexEditing>[0],
    markers,
    route,
    setData,
  };
}

describe('route vertex map editing', () => {
  it('previews a dragged line and commits only at drag end', () => {
    const { createMarker, map, markers, route, setData } = createHarness();
    const commit = vi.fn();

    const cleanup = installRouteVertexEditing(map, route, commit, createMarker);

    expect(markers).toHaveLength(4);
    expect(markers[1].getElement()).toHaveAccessibleName('Drag route vertex 2');
    markers[1].coordinate = [16.4000001234, 48.2500009876];
    markers[1].trigger('drag');
    expect(setData).toHaveBeenLastCalledWith(expect.objectContaining({
      geometry: { type: 'LineString', coordinates: [[16.326, 48.194], [16.4, 48.250001], [16.391, 48.215], [16.429, 48.226]] },
    }));
    expect(commit).not.toHaveBeenCalled();

    markers[1].trigger('dragend');
    expect(commit).toHaveBeenCalledWith(1, [16.4, 48.250001]);
    cleanup();
    expect(markers.every((marker) => marker.removed)).toBe(true);
  });

  it('restores canonical geometry when an unfinished drag is cleaned up', () => {
    const { createMarker, map, markers, route, setData } = createHarness();
    const cleanup = installRouteVertexEditing(map, route, vi.fn(), createMarker);
    markers[0].coordinate = [16.5, 48.3];
    markers[0].trigger('drag');

    cleanup();

    expect(setData).toHaveBeenLastCalledWith(expect.objectContaining({ geometry: route.geometry }));
  });

  it('offers arrow-key movement as an accessible equivalent to pointer dragging', () => {
    const { createMarker, map, markers, route } = createHarness();
    const commit = vi.fn();
    installRouteVertexEditing(map, route, commit, createMarker);

    markers[0].getElement().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    markers[0].getElement().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(commit).toHaveBeenCalledTimes(2);
    expect(commit.mock.calls[1][0]).toBe(0);
    expect(commit.mock.calls[1][1][0]).toBeCloseTo(17.926, 6);
    expect(commit.mock.calls[1][1][1]).toBeCloseTo(48.194, 6);
  });

  it('does not install handles for a locked, hidden, or non-route layer', () => {
    for (const replacement of [
      { locked: true },
      { visible: false },
      { type: 'shape' as const },
    ]) {
      const { createMarker, map, markers, route } = createHarness();
      const cleanup = installRouteVertexEditing(map, { ...route, ...replacement }, vi.fn(), createMarker);
      expect(markers).toHaveLength(0);
      cleanup();
    }
  });
});
