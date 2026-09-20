import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import { captureMapRenderSnapshot } from '../../src/map/MapRenderSnapshot';

function harness() {
  const style: StyleSpecification = {
    version: 8, sources: {}, layers: [
      { id: 'land', type: 'background', paint: { 'background-color': '#ffffff' } },
      { id: 'studio-layer-route', type: 'background' },
    ],
  };
  const frame = document.createElement('div'), canvas = document.createElement('canvas');
  frame.getBoundingClientRect = () => new DOMRect(50, 40, 200, 100);
  canvas.getBoundingClientRect = () => new DOMRect(10, 20, 400, 300);
  const map = {
    loaded: vi.fn(() => true), areTilesLoaded: vi.fn(() => true), isMoving: vi.fn(() => false),
    getCanvas: () => canvas, getCenter: () => ({ lng: 11, lat: 22 }),
    getZoom: () => 8, getBearing: () => 12, getPitch: () => 0, getRoll: () => 0,
    unproject: ([x, y]: number[]) => ({ lng: x / 10, lat: y / 10 }),
  };
  const content = { layers: [], assets: {} };
  const source = {
    isSourceReady: vi.fn(() => true), resolveStyle: () => style,
    resolvePrintFrame: () => frame, resolveContent: () => content,
  };
  const capture = () => captureMapRenderSnapshot(map as unknown as MapLibreMap, source, { content: 'basemap' });
  return { capture, map, style, source };
}

it('captures exact public frame coordinates and immutable detached style/camera/content', () => {
  const test = harness(), snapshot = test.capture();
  expect(snapshot.frame).toEqual({ x: 40, y: 20, width: 200, height: 100 });
  expect(snapshot.footprint.corners).toEqual([[4, 2], [24, 2], [24, 12], [4, 12]]);
  expect(snapshot.printCamera.center).toEqual([14, 7]);
  expect(snapshot.referenceLongitude).toBe(11);
  expect(snapshot.style.layers.map((layer) => layer.id)).toEqual(['land']);
  expect(Object.isFrozen(snapshot.style.layers[0].paint)).toBe(true);
  expect(Object.isFrozen(snapshot.footprint.corners[0])).toBe(true);
  test.style.layers.length = 0;
  expect(snapshot.style.layers).toHaveLength(1);
});

it.each(['loaded', 'areTilesLoaded'] as const)('rejects incomplete %s rather than returning stale data', (method) => {
  const test = harness();
  test.map[method].mockReturnValue(false);
  expect(test.capture).toThrow('not ready');
});

it('rejects changing cameras and invalidated lifecycle sources', () => {
  const test = harness();
  test.map.isMoving.mockReturnValue(true);
  expect(test.capture).toThrow('camera movement');
  test.map.isMoving.mockReturnValue(false);
  test.source.isSourceReady.mockReturnValueOnce(true).mockReturnValue(false);
  expect(test.capture).toThrow('changed during snapshot');
});
