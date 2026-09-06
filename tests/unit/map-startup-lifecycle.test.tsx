import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer } from '../../src/domain/project';

const mocks = vi.hoisted(() => ({
  adapterCreate: vi.fn(),
  adapterSync: vi.fn(),
  autoLoad: true,
  autoStyleLoad: true,
  emitInitialIdle: true,
  handlers: {} as Record<string, Array<(event?: unknown) => void>>,
  isAlreadyLoaded: false,
  createdMaps: [] as object[],
  repaintEmitsIdle: false,
  triggerRepaint: vi.fn(),
}));

vi.mock('../../src/map/MapContentAdapter', () => ({
  createMapLibreContentAdapter: () => {
    mocks.adapterCreate();
    return ({
    destroy: vi.fn(),
    hitTest: vi.fn(),
    setExportVisibility: vi.fn(),
    sync: mocks.adapterSync,
    });
  },
}));

vi.mock('maplibre-gl', () => {
  class MockMap {
    boxZoom = { disable: vi.fn(), enable: vi.fn() };
    doubleClickZoom = { disable: vi.fn(), enable: vi.fn() };
    dragPan = { disable: vi.fn(), enable: vi.fn() };
    dragRotate = { disable: vi.fn(), enable: vi.fn() };
    keyboard = { disable: vi.fn(), enable: vi.fn() };
    scrollZoom = { disable: vi.fn(), enable: vi.fn() };
    touchPitch = { disable: vi.fn(), enable: vi.fn() };
    touchZoomRotate = { disable: vi.fn(), enable: vi.fn() };
    constructor(private readonly options: { container: HTMLDivElement }) { mocks.createdMaps.push(this); }
    addControl(control: { onAdd?: (map: MockMap) => HTMLElement }) {
      const element = control.onAdd?.(this);
      if (element) this.options.container.append(element);
    }
    easeTo() {}
    fitBounds() {}
    getBearing() { return 0; }
    getCanvas() { return document.createElement('canvas'); }
    getCenter() { return { lat: 48.2084, lng: 16.3725 }; }
    getContainer() { return this.options.container; }
    getPitch() { return 0; }
    getStyle() { return { layers: [] }; }
    getZoom() { return 11.2; }
    isStyleLoaded() { return mocks.autoStyleLoad; }
    jumpTo() {}
    loaded() { return mocks.isAlreadyLoaded; }
    off(event: string, callback: (event?: unknown) => void) {
      mocks.handlers[event] = (mocks.handlers[event] ?? []).filter((handler) => handler !== callback);
    }
    on(event: string, callback: (event?: unknown) => void) {
      (mocks.handlers[event] ??= []).push(callback);
      if (event === 'idle' && mocks.emitInitialIdle) queueMicrotask(callback);
    }
    once(event: string, callback: (event?: unknown) => void) {
      (mocks.handlers[event] ??= []).push(callback);
      if (event === 'load' && mocks.autoLoad) queueMicrotask(() => { mocks.isAlreadyLoaded = true; callback(); });
      if (event === 'style.load' && mocks.autoStyleLoad) queueMicrotask(callback);
    }
    remove() { this.options.container.replaceChildren(); }
    setLayoutProperty() {}
    triggerRepaint() {
      mocks.triggerRepaint();
      if (mocks.repaintEmitsIdle) queueMicrotask(() => {
        const idleHandlers = mocks.handlers.idle ?? [];
        for (const handler of idleHandlers) handler();
      });
    }
  }
  class MockNavigationControl {
    onAdd() {
      const container = document.createElement('div');
      container.innerHTML = '<button class="maplibregl-ctrl-zoom-in" aria-label="Zoom in"></button><button class="maplibregl-ctrl-zoom-out" aria-label="Zoom out"></button>';
      return container;
    }
    onRemove() {}
  }
  return { AttributionControl: class {}, Map: MockMap, NavigationControl: MockNavigationControl };
});

import { MapCanvas } from '../../src/map/MapCanvas';
import { startMapLifecycle } from '../../src/map/MapCanvasLifecycle';

const route: ContentLayer = {
  id: 'route-01',
  name: 'Route 01',
  type: 'route',
  visible: true,
  locked: false,
  opacity: 100,
  geometry: { type: 'LineString', coordinates: [[16.32, 48.2], [16.4, 48.22]] },
};

const props = {
  assets: {},
  layers: [route],
  locationRequest: { request: 0 },
  onBackgroundClick: vi.fn(),
  onLayerSelect: vi.fn(),
  previewedId: null,
  selectedId: null,
};

function emit(event: string): void {
  if (event === 'load') mocks.isAlreadyLoaded = true;
  const handlers = mocks.handlers[event] ?? [];
  for (const handler of handlers) handler();
}

beforeEach(() => {
  mocks.adapterCreate.mockReset();
  mocks.adapterSync.mockReset();
  mocks.adapterSync.mockReturnValue('synced');
  mocks.autoLoad = true;
  mocks.autoStyleLoad = true;
  mocks.emitInitialIdle = true;
  mocks.handlers = {};
  mocks.isAlreadyLoaded = false;
  mocks.createdMaps = [];
  mocks.repaintEmitsIdle = false;
  mocks.triggerRepaint.mockReset();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as RenderingContext);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('publishes the installed native camera before any movement or resource readiness', async () => {
  mocks.autoLoad = false;
  render(<MapCanvas {...props} />);
  const canvas = screen.getByTestId('map-canvas');
  await act(async () => {});
  expect(canvas).not.toHaveAttribute('data-map-ready');
  expect(canvas).toHaveAttribute('data-map-center', '16.3725,48.2084');
  expect(canvas).toHaveAttribute('data-map-zoom', '11.2');
  expect(canvas).toHaveAttribute('data-map-bearing', '0');
  expect(canvas).toHaveAttribute('data-map-pitch', '0');
});

it('requests a post-sync frame when the initial idle event precedes map load', async () => {
  mocks.autoLoad = false;
  mocks.repaintEmitsIdle = true;
  render(<MapCanvas {...props} />);
  const canvas = screen.getByTestId('map-canvas');

  await act(async () => {});
  expect(canvas).not.toHaveAttribute('data-map-ready');
  act(() => emit('load'));

  await waitFor(() => expect(canvas).toHaveAttribute('data-map-ready', 'true'));
  expect(mocks.triggerRepaint).toHaveBeenCalledOnce();
});

it('initializes content when the map loaded before its lifecycle listener attached', async () => {
  mocks.autoLoad = false;
  mocks.isAlreadyLoaded = true;
  mocks.repaintEmitsIdle = true;
  render(<MapCanvas {...props} />);

  await waitFor(() => expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true'));
  expect(mocks.adapterSync).toHaveBeenCalledOnce();
});

it('waits for deferred content sources to load before publishing exporter readiness', async () => {
  mocks.repaintEmitsIdle = true;
  mocks.adapterSync.mockReturnValueOnce('deferred').mockImplementation(() => {
    mocks.isAlreadyLoaded = false;
    return 'synced';
  });
  const onExporterChange = vi.fn();
  render(<MapCanvas {...props} onExporterChange={onExporterChange} />);
  await act(async () => {});
  expect(mocks.adapterSync).toHaveBeenCalledTimes(2);
  expect(screen.getByTestId('map-canvas')).not.toHaveAttribute('data-map-ready');
  expect(onExporterChange).not.toHaveBeenCalledWith(expect.any(Function));
  mocks.isAlreadyLoaded = true;
  act(() => emit('idle'));
  expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true');
  expect(onExporterChange).toHaveBeenLastCalledWith(expect.any(Function));
});

it('hides the page boundary without removing its layout frame', async () => {
  const view = render(<MapCanvas {...props} pageBoundaryVisible />);
  await act(async () => {});
  const frame = view.container.querySelector('.print-frame');

  expect(frame).not.toHaveClass('is-boundary-hidden');
  view.rerender(<MapCanvas {...props} pageBoundaryVisible={false} />);

  expect(frame).toHaveClass('is-boundary-hidden');
  expect(frame).not.toHaveAttribute('hidden');
});

it('does not publish an already-loaded map after its queued load is cleaned up', async () => {
  mocks.autoLoad = false;
  mocks.emitInitialIdle = false;
  mocks.isAlreadyLoaded = true;
  const exporterChange = vi.fn();
  const container = document.createElement('div');
  const references = {
    availableExporter: { current: null },
    backgroundClick: { current: vi.fn() },
    cameraViewportChange: { current: undefined },
    cameraViewportChangeMode: { current: 'history' as const },
    container: { current: container },
    contentAdapter: { current: null },
    contentReady: { current: false },
    contentState: { current: { assets: {}, layers: [route], previewedId: null, selectedId: null } },
    contentSyncDeferred: { current: false },
    exporterChange: { current: exporterChange },
    fitPage: { current: vi.fn() },
    ignoreNextMapClick: { current: false },
    layerSelect: { current: vi.fn() },
    map: { current: null },
    mapClick: { current: undefined },
    mapFailed: { current: false },
    resolveExportStyle: (map: MapLibreMap) => map.getStyle(),
    setBasemapExportVisibility: () => true,
    synchronizeFeatureVisibility: { current: () => true },
    synchronizeMapLanguage: { current: () => true },
    synchronizeStyleCustomization: { current: () => true },
    synchronizeTextScale: { current: () => true },
  };
  const cleanup = startMapLifecycle({
    handleContentSyncResult: (result) => { references.contentReady.current = result === 'synced'; },
    initialCamera: { center: [16.37, 48.21], zoom: 11, bearing: 0, pitch: 0, locked: false },
    references,
    setContentError: vi.fn(),
    setMapError: vi.fn(),
    styleUrl: '/style.json',
  });

  cleanup?.();
  await Promise.resolve();

  expect(mocks.adapterCreate).not.toHaveBeenCalled();
  expect(mocks.adapterSync).not.toHaveBeenCalled();
  expect(mocks.triggerRepaint).not.toHaveBeenCalled();
  expect(exporterChange).not.toHaveBeenCalled();
  expect(references.contentAdapter.current).toBeNull();
  expect(references.contentReady.current).toBe(false);
  expect(references.map.current).toBeNull();
  expect(container).not.toHaveAttribute('data-map-ready');
});

it('shows an actionable fallback when map startup never loads or errors', async () => {
  mocks.autoLoad = false;
  mocks.autoStyleLoad = false;
  vi.useFakeTimers();
  render(<MapCanvas {...props} />);

  await act(async () => vi.advanceTimersByTimeAsync(12_000));

  expect(screen.getByRole('status')).toHaveTextContent('timed out while loading');
  expect(screen.getByRole('status')).toHaveTextContent('Check your connection and retry');
});

it('keeps failed renderer creation retryable and recovers when WebGL becomes available', async () => {
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
  const onExporterChange = vi.fn();
  render(<MapCanvas {...props} onExporterChange={onExporterChange} />);
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('WebGL 2 is unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Retry map' }));
  await act(async () => {});
  expect(screen.getByRole('button', { name: 'Retry map' })).toBeEnabled();
  expect(screen.getByTestId('map-canvas')).not.toHaveAttribute('data-map-ready');
  expect(mocks.adapterCreate).not.toHaveBeenCalled();
  expect(onExporterChange).not.toHaveBeenCalledWith(expect.any(Function));
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue({} as RenderingContext);
  fireEvent.click(screen.getByRole('button', { name: 'Retry map' }));
  await waitFor(() => expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true'));
  expect(mocks.adapterCreate).toHaveBeenCalledOnce();
  expect(screen.queryByRole('button', { name: 'Retry map' })).not.toBeInTheDocument();
});

it('locks each renderer and its newly installed navigation before style or content readiness', async () => {
  mocks.autoLoad = false;
  mocks.autoStyleLoad = false;
  mocks.emitInitialIdle = false;
  const camera = { center: [16.37, 48.21] as [number, number], zoom: 11, bearing: 0, pitch: 0, locked: true };
  const view = render(<MapCanvas {...props} camera={camera} />);
  const handlers = ['boxZoom', 'doubleClickZoom', 'dragPan', 'dragRotate', 'keyboard', 'scrollZoom', 'touchPitch', 'touchZoomRotate'] as const;
  const initial = mocks.createdMaps[0] as MapLibreMap;
  for (const handler of handlers) expect(initial[handler].disable).toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Fit page' })).toBeDisabled();
  act(() => emit('webglcontextlost'));
  fireEvent.click(screen.getByRole('button', { name: 'Retry map' }));
  await act(async () => {});
  expect(mocks.createdMaps).toHaveLength(2);
  expect(mocks.adapterCreate).not.toHaveBeenCalled();
  expect(screen.getByTestId('map-canvas')).not.toHaveAttribute('data-map-ready');
  const replacement = mocks.createdMaps[1] as MapLibreMap;
  for (const handler of handlers) {
    expect(replacement[handler].disable).toHaveBeenCalled();
    expect(replacement[handler].enable).not.toHaveBeenCalled();
  }
  for (const name of ['Fit page', 'Zoom in', 'Zoom out']) expect(screen.getByRole('button', { name })).toBeDisabled();
  view.rerender(<MapCanvas {...props} camera={{ ...camera, locked: false }} />);
  for (const handler of handlers) expect(replacement[handler].enable).toHaveBeenCalledOnce();
  for (const name of ['Fit page', 'Zoom in', 'Zoom out']) expect(screen.getByRole('button', { name })).toBeEnabled();
});

it('shows an actionable fallback when a loaded style never becomes ready', async () => {
  mocks.autoLoad = false;
  mocks.emitInitialIdle = false;
  vi.useFakeTimers();
  render(<MapCanvas {...props} />);

  await act(async () => {});
  await act(async () => vi.advanceTimersByTimeAsync(30_000));

  expect(screen.getByRole('status')).toHaveTextContent('timed out while preparing');
  expect(screen.getByRole('status')).toHaveTextContent('Retry the map without reloading your project');
});

it('allows a loaded style to become ready after the startup deadline', async () => {
  mocks.autoLoad = false;
  mocks.autoStyleLoad = false;
  mocks.emitInitialIdle = false;
  vi.useFakeTimers();
  render(<MapCanvas {...props} />);

  await act(async () => emit('style.load'));
  expect(mocks.adapterSync).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTimeAsync(12_000));

  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  await act(async () => {
    emit('load');
    await Promise.resolve();
  });
  expect(mocks.adapterSync).toHaveBeenCalledOnce();
  await act(async () => {
    emit('idle');
    await Promise.resolve();
  });
  expect(screen.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true');
});
