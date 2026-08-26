import { describe, expect, it, vi } from 'vitest';
import type { ContentLayer, ShapeGeometry } from '../../src/domain/project';
import {
  installShapeTransformEditing,
  type ShapeTransformMarker,
} from '../../src/map/ShapeTransformEditing';

class FakeMarker implements ShapeTransformMarker {
  coordinate = { lng: 0, lat: 0 };
  readonly element: HTMLElement;
  readonly handlers = new Map<string, () => void>();
  removed = false;

  constructor(element: HTMLElement) { this.element = element; }
  addTo() { return this; }
  getElement() { return this.element; }
  getLngLat() { return this.coordinate; }
  on(event: 'drag' | 'dragend', handler: () => void) { this.handlers.set(event, handler); return this; }
  remove() { this.removed = true; }
  setLngLat([lng, lat]: readonly [number, number]) { this.coordinate = { lng, lat }; return this; }
  trigger(event: 'drag' | 'dragend') { this.handlers.get(event)?.(); }
}

const shape = (overrides: Partial<ContentLayer> = {}): ContentLayer => ({
  id: 'shape', name: 'Shape', type: 'shape', visible: true, locked: false, opacity: 100,
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
  let projectionOffset = { x: 0, y: 0 };
  const createMarker = (element: HTMLElement) => {
    const marker = new FakeMarker(element);
    markers.push(marker);
    return marker;
  };
  const map = {
    getSource: () => ({ setData }),
    project: ([lng, lat]: readonly [number, number]) => ({
      x: lng + projectionOffset.x,
      y: lat + projectionOffset.y,
    }),
    unproject: ([x, y]: readonly [number, number]) => ({
      lng: x - projectionOffset.x,
      lat: y - projectionOffset.y,
    }),
  };
  return {
    createMarker,
    layer,
    map: map as unknown as Parameters<typeof installShapeTransformEditing>[0],
    markers,
    setProjectionOffset: (x: number, y: number) => { projectionOffset = { x, y }; },
    setData,
  };
}

function lastGeometry(setData: ReturnType<typeof vi.fn>): ShapeGeometry {
  return setData.mock.calls.at(-1)![0].geometry as ShapeGeometry;
}

describe('selected shape transform editing', () => {
  it('moves the complete polygon through one center handle and commits once', () => {
    const { createMarker, layer, map, markers, setData } = harness();
    const commit = vi.fn();
    const cleanup = installShapeTransformEditing(map, layer, commit, createMarker);

    expect(markers).toHaveLength(5);
    expect(markers[0].getElement()).toHaveAccessibleName('Move selected shape');
    expect(markers.slice(1).map((marker) => marker.getElement().getAttribute('aria-label'))).toEqual([
      'Resize selected shape from top left',
      'Resize selected shape from top right',
      'Resize selected shape from bottom right',
      'Resize selected shape from bottom left',
    ]);

    markers[0].coordinate = { lng: 7, lat: 8 };
    markers[0].trigger('drag');
    expect(lastGeometry(setData)).toEqual({
      type: 'Polygon', coordinates: [[[2, 3], [12, 3], [12, 13], [2, 13], [2, 3]]],
    });
    expect(markers.slice(1).map(({ coordinate }) => coordinate)).toEqual([
      { lng: 2, lat: 3 },
      { lng: 12, lat: 3 },
      { lng: 12, lat: 13 },
      { lng: 2, lat: 13 },
    ]);
    expect(commit).not.toHaveBeenCalled();
    markers[0].trigger('dragend');
    expect(commit).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledWith(lastGeometry(setData));

    cleanup();
    expect(markers.every(({ removed }) => removed)).toBe(true);
  });

  it('uses the current map projection when moving after the map pans', () => {
    const { createMarker, layer, map, markers, setData, setProjectionOffset } = harness();
    installShapeTransformEditing(map, layer, vi.fn(), createMarker);

    setProjectionOffset(100, 50);
    markers[0].coordinate = { lng: 7, lat: 8 };
    markers[0].trigger('drag');

    expect(lastGeometry(setData)).toEqual({
      type: 'Polygon', coordinates: [[[2, 3], [12, 3], [12, 13], [2, 13], [2, 3]]],
    });
  });

  it('resizes all polygon rings around the opposite corner and supports arrow keys', () => {
    const layer = shape({
      geometry: {
        type: 'Polygon',
        coordinates: [
          [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
          [[2, 2], [4, 2], [4, 4], [2, 4], [2, 2]],
        ],
      },
    });
    const { createMarker, map, markers, setData } = harness(layer);
    const commit = vi.fn();
    installShapeTransformEditing(map, layer, commit, createMarker);

    const bottomRight = markers[3];
    bottomRight.coordinate = { lng: 20, lat: 30 };
    bottomRight.trigger('dragend');
    expect(lastGeometry(setData)).toEqual({
      type: 'Polygon',
      coordinates: [
        [[0, 0], [20, 0], [20, 30], [0, 30], [0, 0]],
        [[4, 6], [8, 6], [8, 12], [4, 12], [4, 6]],
      ],
    });
    expect(commit).toHaveBeenCalledOnce();

    markers[0].getElement().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(commit).toHaveBeenCalledTimes(2);
  });

  it('restores a resize marker when a keyboard nudge is rejected', () => {
    const { createMarker, layer, map, markers, setData } = harness();
    const commit = vi.fn();
    installShapeTransformEditing(map, layer, commit, createMarker);

    const topLeft = markers[1];
    topLeft.getElement().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(topLeft.coordinate).toEqual({ lng: 0, lat: 0 });
    expect(setData).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it.each([
    { locked: true },
    { visible: false },
    { type: 'route' as const, geometry: { type: 'LineString' as const, coordinates: [[0, 0], [1, 1]] } },
  ])('does not install handles for an ineligible layer %#', (replacement) => {
    const { createMarker, layer, map, markers } = harness(shape(replacement as Partial<ContentLayer>));
    const cleanup = installShapeTransformEditing(map, layer, vi.fn(), createMarker);
    expect(markers).toHaveLength(0);
    cleanup();
  });
});
