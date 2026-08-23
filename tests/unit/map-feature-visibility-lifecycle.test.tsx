import { act, render, screen, waitFor } from '@testing-library/react';
import type { ContentLayer, MapFeatureVisibility } from '../../src/domain/project';

const mocks = vi.hoisted(() => ({
  mapCount: 0,
  mapHandlers: [] as Array<Record<string, Array<(event?: unknown) => void>>>,
  visibilityUpdates: [] as Array<[number, string, unknown]>,
}));

vi.mock('../../src/map/MapContentAdapter', () => ({
  createMapLibreContentAdapter: () => ({
    destroy: vi.fn(),
    hitTest: vi.fn(() => null),
    setExportVisibility: vi.fn(() => true),
    sync: vi.fn(() => 'synced'),
  }),
}));

vi.mock('maplibre-gl', () => {
  class MockMap {
    private readonly mapIndex = mocks.mapCount++;
    private readonly handlers: Record<string, Array<(event?: unknown) => void>> = {};
    constructor() { mocks.mapHandlers.push(this.handlers); }
    addControl() {}
    fitBounds() {}
    getCanvas() { return document.createElement('canvas'); }
    getStyle() {
      return {
        layers: [
          { id: 'road-primary', type: 'line', 'source-layer': 'transportation' },
          { id: 'building', type: 'fill', 'source-layer': 'building' },
          { id: 'city-label', type: 'symbol', 'source-layer': 'place', layout: { 'text-field': ['get', 'name'], 'text-size': 14 } },
        ],
      };
    }
    jumpTo() {}
    off(event: string, callback: (event?: unknown) => void) {
      this.handlers[event] = (this.handlers[event] ?? []).filter((handler) => handler !== callback);
    }
    on(event: string, callback: (event?: unknown) => void) {
      (this.handlers[event] ??= []).push(callback);
      if (event === 'idle') queueMicrotask(callback);
    }
    once(event: string, callback: (event?: unknown) => void) {
      (this.handlers[event] ??= []).push(callback);
      if (event === 'load') queueMicrotask(callback);
    }
    remove() {}
    setLayoutProperty(layerId: string, property: string, value: unknown) {
      if (property === 'visibility') mocks.visibilityUpdates.push([this.mapIndex, layerId, value]);
    }
    triggerRepaint() {}
  }

  return {
    AttributionControl: class {},
    Map: MockMap,
    NavigationControl: class {},
  };
});

import { MapCanvas } from '../../src/map/MapCanvas';

const route: ContentLayer = {
  id: 'route-01',
  name: 'Route 01',
  type: 'route',
  visible: true,
  locked: false,
  opacity: 100,
  geometry: { type: 'LineString', coordinates: [[16.32, 48.2], [16.4, 48.22]] },
};

const allVisible: MapFeatureVisibility = { roads: true, buildings: true, labels: true, water: true, parks: true, landuse: true, transit: true };
const roadsHidden: MapFeatureVisibility = { ...allVisible, roads: false };

beforeEach(() => {
  mocks.mapCount = 0;
  mocks.mapHandlers = [];
  mocks.visibilityUpdates = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as RenderingContext);
});

afterEach(() => vi.restoreAllMocks());

const emitLatestMapEvent = (event: string) => {
  const handlers = mocks.mapHandlers.at(-1)?.[event] ?? [];
  for (const handler of handlers) handler();
};

it('applies canonical feature visibility live and again after a style switch', async () => {
  const props = {
    layers: [route],
    assets: {},
    previewedId: null,
    selectedId: null,
    onLayerSelect: vi.fn(),
    onBackgroundClick: vi.fn(),
  };
  const { rerender } = render(<MapCanvas {...props} featureVisibility={allVisible} />);

  await waitFor(() => expect(mocks.visibilityUpdates).toContainEqual([0, 'road-primary', 'visible']));
  rerender(<MapCanvas {...props} featureVisibility={roadsHidden} />);
  await waitFor(() => expect(mocks.visibilityUpdates).toContainEqual([0, 'road-primary', 'none']));
  expect(screen.getByTestId('map-canvas')).toHaveAttribute(
    'data-map-feature-visibility',
    'roads:false,buildings:true,labels:true,water:true,parks:true,landuse:true,transit:true',
  );

  rerender(<MapCanvas {...props} featureVisibility={roadsHidden} stylePreset="positron" />);
  await waitFor(() => expect(mocks.visibilityUpdates).toContainEqual([1, 'road-primary', 'none']));
});

it('withdraws readiness and export until a live visibility change reaches idle', async () => {
  const onExporterChange = vi.fn();
  const props = {
    layers: [route],
    assets: {},
    previewedId: null,
    selectedId: null,
    onLayerSelect: vi.fn(),
    onBackgroundClick: vi.fn(),
    onExporterChange,
  };
  const { rerender } = render(<MapCanvas {...props} featureVisibility={allVisible} />);
  const canvas = screen.getByTestId('map-canvas');
  await waitFor(() => expect(canvas).toHaveAttribute('data-map-ready', 'true'));
  await waitFor(() => expect(onExporterChange).toHaveBeenCalledWith(expect.any(Function)));
  const initialExporterPublications = onExporterChange.mock.calls.filter(([value]) => typeof value === 'function').length;

  rerender(<MapCanvas {...props} featureVisibility={roadsHidden} />);

  await waitFor(() => expect(canvas).not.toHaveAttribute('data-map-ready'));
  expect(onExporterChange).toHaveBeenLastCalledWith(null);
  act(() => emitLatestMapEvent('idle'));
  await waitFor(() => expect(canvas).toHaveAttribute('data-map-ready', 'true'));
  expect(onExporterChange.mock.calls.filter(([value]) => typeof value === 'function')).toHaveLength(
    initialExporterPublications + 1,
  );
});
