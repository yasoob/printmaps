import { act, render, screen, waitFor } from '@testing-library/react';
import type { ContentLayer } from '../../src/domain/project';

const mocks = vi.hoisted(() => ({
  adapterSync: vi.fn(() => 'synced' as const),
  adapterSetExportVisibility: vi.fn(() => true),
  mapHandlers: {} as Record<string, Array<(event?: unknown) => void>>,
  setLayoutProperty: vi.fn(),
}));

vi.mock('../../src/map/MapContentAdapter', () => ({
  createMapLibreContentAdapter: () => ({
    destroy: vi.fn(),
    hitTest: vi.fn(() => null),
    setExportVisibility: mocks.adapterSetExportVisibility,
    sync: mocks.adapterSync,
  }),
}));

vi.mock('maplibre-gl', () => {
  class MockMap {
    addControl() {}
    fitBounds() {}
    getCanvas() { return document.createElement('canvas'); }
    getStyle() {
      return {
        layers: [{
          id: 'place-label',
          type: 'symbol',
          layout: { 'text-field': ['get', 'name'], 'text-size': 16 },
        }],
      };
    }
    jumpTo() {}
    off(event: string, callback: (event?: unknown) => void) {
      mocks.mapHandlers[event] = (mocks.mapHandlers[event] ?? []).filter((handler) => handler !== callback);
    }
    on(event: string, callback: (event?: unknown) => void) {
      (mocks.mapHandlers[event] ??= []).push(callback);
    }
    once(event: string, callback: (event?: unknown) => void) {
      (mocks.mapHandlers[event] ??= []).push(callback);
      if (event === 'load') queueMicrotask(callback);
    }
    remove() {}
    setLayoutProperty(...arguments_: unknown[]) { mocks.setLayoutProperty(...arguments_); }
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
  geometry: {
    type: 'LineString',
    coordinates: [[16.32, 48.2], [16.4, 48.22]],
  },
};

const emitMapEvent = (event: string) => {
  const handlers = mocks.mapHandlers[event] ?? [];
  for (const handler of handlers) handler();
};

beforeEach(() => {
  mocks.adapterSync.mockClear();
  mocks.adapterSetExportVisibility.mockReset().mockReturnValue(true);
  mocks.mapHandlers = {};
  mocks.setLayoutProperty.mockReset();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as RenderingContext);
});

afterEach(() => vi.restoreAllMocks());

it('keeps readiness invalid after a live label resize fails', async () => {
  const onExporterChange = vi.fn();
  const props = {
    layers: [route],
    previewedId: null,
    onLayerSelect: vi.fn(),
    onBackgroundClick: vi.fn(),
    onExporterChange,
  };
  const { rerender } = render(
    <MapCanvas {...props} selectedId={null} textScalePercent={100} />,
  );
  const canvas = screen.getByTestId('map-canvas');
  await waitFor(() => expect(mocks.adapterSync).toHaveBeenCalledOnce());
  act(() => emitMapEvent('idle'));
  await waitFor(() => expect(onExporterChange).toHaveBeenCalledWith(expect.any(Function)));
  expect(canvas).toHaveAttribute('data-map-ready', 'true');
  const publishedExporterCount = onExporterChange.mock.calls.filter(([value]) => typeof value === 'function').length;
  mocks.setLayoutProperty.mockImplementation(() => { throw new Error('layout update failed'); });

  rerender(<MapCanvas {...props} selectedId={null} textScalePercent={125} />);

  expect(await screen.findByRole('status')).toHaveTextContent(
    'Map labels could not be resized. Reload the page and retry.',
  );
  await waitFor(() => expect(onExporterChange).toHaveBeenLastCalledWith(null));

  rerender(<MapCanvas {...props} selectedId="route-01" textScalePercent={125} />);
  await waitFor(() => expect(mocks.adapterSync).toHaveBeenCalledTimes(2));
  act(() => emitMapEvent('idle'));

  expect(canvas).not.toHaveAttribute('data-map-ready');
  expect(onExporterChange).toHaveBeenLastCalledWith(null);
  expect(onExporterChange.mock.calls.filter(([value]) => typeof value === 'function')).toHaveLength(
    publishedExporterCount,
  );
  expect(screen.getByRole('status')).toHaveTextContent(
    'Map labels could not be resized. Reload the page and retry.',
  );
});

it('keeps readiness invalid after overlay restoration fails', async () => {
  const onExporterChange = vi.fn();
  const props = {
    layers: [route],
    previewedId: null,
    onLayerSelect: vi.fn(),
    onBackgroundClick: vi.fn(),
    onExporterChange,
  };
  const { rerender } = render(<MapCanvas {...props} selectedId={null} />);
  const canvas = screen.getByTestId('map-canvas');
  await waitFor(() => expect(mocks.adapterSync).toHaveBeenCalledOnce());
  act(() => emitMapEvent('idle'));
  await waitFor(() => expect(onExporterChange).toHaveBeenCalledWith(expect.any(Function)));
  const exporter = onExporterChange.mock.calls.find(([value]) => typeof value === 'function')?.[0];
  mocks.adapterSetExportVisibility.mockReturnValueOnce(true).mockReturnValueOnce(false);

  const capture = exporter({ content: 'basemap' });
  act(() => emitMapEvent('render'));
  await expect(capture).rejects.toThrow('could not be restored after layered SVG export');
  await waitFor(() => expect(onExporterChange).toHaveBeenLastCalledWith(null));
  expect(screen.getByRole('status')).toHaveTextContent('could not restore content after export');

  rerender(<MapCanvas {...props} selectedId="route-01" />);
  await waitFor(() => expect(mocks.adapterSync).toHaveBeenCalledTimes(2));
  act(() => emitMapEvent('idle'));

  expect(canvas).not.toHaveAttribute('data-map-ready');
  expect(onExporterChange).toHaveBeenLastCalledWith(null);
  expect(onExporterChange.mock.calls.filter(([value]) => typeof value === 'function')).toHaveLength(1);
  expect(screen.getByRole('status')).toHaveTextContent('Reload the page and retry');
});
