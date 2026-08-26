import { describe, expect, it, vi } from 'vitest';
import type { ContentLayer, ShapeGeometry } from '../../src/domain/project';
import {
  installShapeVertexEditing,
  type ShapeVertexMarker,
} from '../../src/map/ShapeVertexEditing';

class FakeMarker implements ShapeVertexMarker {
  coordinate = { lng: 0, lat: 0 };
  readonly handlers = new Map<string, () => void>();
  removed = false;

  constructor(readonly element: HTMLElement) {}
  addTo() { return this; }
  getElement() { return this.element; }
  getLngLat() { return this.coordinate; }
  on(event: 'drag' | 'dragend', handler: () => void) { this.handlers.set(event, handler); return this; }
  remove() { this.removed = true; }
  setLngLat([lng, lat]: readonly [number, number]) { this.coordinate = { lng, lat }; return this; }
  trigger(event: 'drag' | 'dragend') { this.handlers.get(event)?.(); }
}

const shape = (overrides: Partial<ContentLayer> = {}): ContentLayer => ({
  id: 'shape-01', name: 'Shape 01', type: 'shape', visible: true, locked: false, opacity: 100,
  appearance: { kind: 'shape', fillColor: '#abcdef', strokeColor: '#123456', strokeWidth: 2, invert: false },
  geometry: {
    type: 'Polygon',
    coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
  },
  ...overrides,
});

function harness(layer = shape()) {
  const markers: FakeMarker[] = [];
  const setData = vi.fn();
  const createMarker = (element: HTMLElement) => {
    const marker = new FakeMarker(element);
    markers.push(marker);
    return marker;
  };
  const map = {
    getSource: () => ({ setData }),
    project: ([lng, lat]: readonly [number, number]) => ({ x: lng * 10, y: lat * -10 }),
    unproject: ({ x, y }: { x: number; y: number }) => ({ lng: x / 10, lat: y / -10 }),
  };
  return {
    createMarker,
    layer,
    map: map as unknown as Parameters<typeof installShapeVertexEditing>[0],
    markers,
    setData,
  };
}

function lastGeometry(setData: ReturnType<typeof vi.fn>): ShapeGeometry {
  return setData.mock.calls.at(-1)![0].geometry as ShapeGeometry;
}

describe('shape point map editing', () => {
  it('installs direct vertex and midpoint handles for a simple polygon', () => {
    const { createMarker, layer, map, markers } = harness();

    const cleanup = installShapeVertexEditing(map, layer, vi.fn(), createMarker);

    expect(markers).toHaveLength(8);
    expect(markers.slice(0, 4).map(({ element }) => element.getAttribute('aria-label'))).toEqual([
      'Drag area point 1', 'Drag area point 2', 'Drag area point 3', 'Drag area point 4',
    ]);
    expect(markers.slice(4).map(({ element }) => element.getAttribute('aria-label'))).toEqual([
      'Add area point between 1 and 2',
      'Add area point between 2 and 3',
      'Add area point between 3 and 4',
      'Add area point between 4 and 1',
    ]);
    cleanup();
    expect(markers.every(({ removed }) => removed)).toBe(true);
  });

  it('previews a dragged point and commits a closed polygon only at drag end', () => {
    const { createMarker, layer, map, markers, setData } = harness();
    const commit = vi.fn();
    installShapeVertexEditing(map, layer, commit, createMarker);

    markers[0].coordinate = { lng: 2, lat: 3 };
    markers[0].trigger('drag');

    expect(lastGeometry(setData)).toEqual({
      type: 'Polygon',
      coordinates: [[[2, 3], [10, 0], [10, 10], [0, 10], [2, 3]]],
    });
    expect(commit).not.toHaveBeenCalled();

    markers[0].trigger('dragend');
    expect(commit).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledWith(lastGeometry(setData));
  });

  it('inserts a midpoint as one committed polygon edit', () => {
    const { createMarker, layer, map, markers } = harness();
    const commit = vi.fn();
    installShapeVertexEditing(map, layer, commit, createMarker);

    const backgroundClick = vi.fn();
    const mapBackground = document.createElement('div');
    mapBackground.addEventListener('click', backgroundClick);
    mapBackground.append(markers[4].getElement());
    markers[4].getElement().click();

    expect(backgroundClick).not.toHaveBeenCalled();
    expect(commit).toHaveBeenCalledWith({
      type: 'Polygon',
      coordinates: [[[0, 0], [5, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
    });
  });

  it('inserts a dateline-crossing midpoint on the short side of the edge', () => {
    const crossing = shape({
      geometry: {
        type: 'Polygon',
        coordinates: [[[179, 0], [-179, 0], [-179, 10], [179, 10], [179, 0]]],
      },
    });
    const { createMarker, map, markers } = harness(crossing);
    const commit = vi.fn();
    installShapeVertexEditing(map, crossing, commit, createMarker);

    expect(markers[4].coordinate).toEqual({ lng: 180, lat: 0 });
    markers[4].getElement().click();
    expect(commit).toHaveBeenCalledWith({
      type: 'Polygon',
      coordinates: [[[179, 0], [180, 0], [-179, 0], [-179, 10], [179, 10], [179, 0]]],
    });
  });

  it('does not install point handles for multi-part, locked, or oversized shapes', () => {
    const oversized = Array.from({ length: 82 }, (_, index) => [index, 0] as [number, number]);
    oversized.push(oversized[0]);
    const candidates: ContentLayer[] = [
      shape({ locked: true }),
      shape({
        geometry: {
          type: 'MultiPolygon',
          coordinates: [[[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]]],
        },
      }),
      shape({ geometry: { type: 'Polygon', coordinates: [oversized] } }),
    ];

    for (const layer of candidates) {
      const { createMarker, map, markers } = harness(layer);
      installShapeVertexEditing(map, layer, vi.fn(), createMarker);
      expect(markers).toHaveLength(0);
    }
  });
});
