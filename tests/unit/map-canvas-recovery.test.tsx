import { StrictMode, useLayoutEffect, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ContentLayer } from '../../src/domain/project';

const mocks = vi.hoisted(() => ({
  adapterSync: vi.fn(),
  adapterDestroy: vi.fn(),
  adapterSetExportVisibility: vi.fn(),
  hitTest: vi.fn(),
  mapOff: vi.fn(),
  mapRemove: vi.fn(),
  mapJumpTo: vi.fn(), mapFitBounds: vi.fn(), mapEaseTo: vi.fn(),
  mapCenter: { lng: 16.3725, lat: 48.2084 },
  mapZoom: 11.2,
  mapCreateOptions: [] as unknown[],
  mapHandlers: [] as Array<Record<string, Array<(event?: unknown) => void>>>,
  activeAdapterIds: new Set<number>(),
  activeMapIds: new Set<number>(),
  failedAdapterDestroyIds: new Set<number>(),
  failedMapOffOperations: new Set<string>(),
  failedMapRemoveIds: new Set<number>(),
  adapterCount: 0,
  mapCount: 0,
  autoLoad: true,
  autoRender: true,
  synchronousLoad: false,
  throwOnFirstCleanup: false,
  styleErrorBeforeLoad: false,
}));

vi.mock('../../src/map/MapContentAdapter', () => ({
  createMapLibreContentAdapter: () => {
    const adapterIndex = mocks.adapterCount++;
    mocks.activeAdapterIds.add(adapterIndex);
    return {
      sync: mocks.adapterSync,
      hitTest: mocks.hitTest,
      setExportVisibility: mocks.adapterSetExportVisibility,
      destroy: () => {
        mocks.adapterDestroy();
        if (adapterIndex === 0 && mocks.throwOnFirstCleanup && !mocks.failedAdapterDestroyIds.has(adapterIndex)) {
          mocks.failedAdapterDestroyIds.add(adapterIndex);
          throw new Error('destroy failure');
        }
        mocks.activeAdapterIds.delete(adapterIndex);
      },
    };
  },
}));

vi.mock('maplibre-gl', () => {
  class MockMap {
    private readonly mapIndex: number; private readonly handlers: Record<string, Array<(event?: unknown) => void>>;
    boxZoom = { disable: vi.fn(), enable: vi.fn() }; doubleClickZoom = { disable: vi.fn(), enable: vi.fn() }; dragPan = { disable: vi.fn(), enable: vi.fn() }; dragRotate = { disable: vi.fn(), enable: vi.fn() };
    keyboard = { disable: vi.fn(), enable: vi.fn() }; scrollZoom = { disable: vi.fn(), enable: vi.fn() }; touchPitch = { disable: vi.fn(), enable: vi.fn() }; touchZoomRotate = { disable: vi.fn(), enable: vi.fn() };
    constructor(options: unknown) {
      this.mapIndex = mocks.mapCount++;
      mocks.mapCreateOptions.push(options);
      this.handlers = {};
      mocks.mapHandlers.push(this.handlers);
      mocks.activeMapIds.add(this.mapIndex);
    }
    addControl() {}
    on(event: string, callback: (event?: unknown) => void) {
      (this.handlers[event] ??= []).push(callback);
      if (event === 'idle') queueMicrotask(callback);
    }
    off(event: string, callback: (event?: unknown) => void) {
      mocks.mapOff(event, callback);
      const operation = `${this.mapIndex}:${event}`;
      if (mocks.throwOnFirstCleanup && this.mapIndex === 0 && !mocks.failedMapOffOperations.has(operation)) {
        mocks.failedMapOffOperations.add(operation);
        throw new Error('off failure');
      }
      this.handlers[event] = (this.handlers[event] ?? []).filter((handler) => handler !== callback);
    }
    remove() {
      mocks.mapRemove();
      if (mocks.throwOnFirstCleanup && this.mapIndex === 0 && !mocks.failedMapRemoveIds.has(this.mapIndex)) {
        mocks.failedMapRemoveIds.add(this.mapIndex);
        throw new Error('remove failure');
      }
      mocks.activeMapIds.delete(this.mapIndex);
    }
    getCanvas() { return document.createElement('canvas'); } getContainer() { return document.createElement('div'); }
    getStyle() { return { layers: [] }; }
    setLayoutProperty() {} triggerRepaint() {}
    fitBounds(...arguments_: unknown[]) { mocks.mapFitBounds(...arguments_); }
    easeTo(options: unknown) { mocks.mapEaseTo(options); }
    getCenter() { return mocks.mapCenter; }
    getZoom() { return mocks.mapZoom; }
    jumpTo(options: unknown) { mocks.mapJumpTo(options); }
    once(event: string, callback: (event?: unknown) => void) {
      (this.handlers[event] ??= []).push(callback);
      if (event === 'load' && mocks.autoLoad) {
        const load = () => {
          if (mocks.styleErrorBeforeLoad) {
            const errorHandlers = this.handlers.error ?? [];
            for (const handler of errorHandlers) handler();
          }
          callback();
        };
        if (mocks.synchronousLoad) load();
        else queueMicrotask(load);
      } else if (event === 'idle' || (event === 'render' && mocks.autoRender)) {
        queueMicrotask(callback);
      }
    }
  }

  return {
    Map: MockMap,
    NavigationControl: class {},
    AttributionControl: class {},
  };
});

import { MapCanvas } from '../../src/map/MapCanvas';

const latestMapHandlers = () => mocks.mapHandlers.at(-1) ?? {};
const emitLatestMapEvent = (event: string, payload?: unknown) => {
  const handlers = latestMapHandlers()[event] ?? [];
  for (const handler of handlers) handler(payload);
};

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

const baseProps = {
  layers: [route], assets: {}, locationRequest: { request: 0 },
  previewedId: null, onLayerSelect: vi.fn(), onBackgroundClick: vi.fn(),
};

async function renderMapExporter() {
  const onExporterChange = vi.fn();
  render(<MapCanvas {...baseProps} selectedId={null} onExporterChange={onExporterChange} />);
  await waitFor(() => expect(onExporterChange).toHaveBeenCalledWith(expect.any(Function)));
  const exporter = onExporterChange.mock.calls.find(([value]) => typeof value === 'function')?.[0];
  return { exporter, onExporterChange };
}

async function verifyBasemapCaptureRestoration() {
  const { exporter } = await renderMapExporter();
  expect(exporter).toBeTypeOf('function');
  await expect(exporter({ content: 'basemap' })).rejects.toThrow('print frame is not ready');
  expect(mocks.adapterSetExportVisibility.mock.calls).toEqual([[false], [true]]);
}

async function verifyInitialIsolationFailure() {
  mocks.adapterSetExportVisibility.mockReturnValueOnce(false);
  const { exporter, onExporterChange } = await renderMapExporter();
  await expect(exporter({ content: 'basemap' })).rejects.toThrow('could not be isolated');
  await waitFor(() => expect(onExporterChange).toHaveBeenLastCalledWith(null));
  expect(screen.getByRole('status')).toHaveTextContent('could not restore content after export');
}

async function verifyPendingRenderAbort() {
  mocks.autoRender = false;
  const { exporter, onExporterChange } = await renderMapExporter();
  const controller = new AbortController();
  const capture = exporter({ content: 'basemap', signal: controller.signal });
  await waitFor(() => expect(mocks.adapterSetExportVisibility).toHaveBeenCalledWith(false));
  mocks.autoRender = true; controller.abort();
  await expect(Promise.race([
    capture,
    new Promise((_, reject) => setTimeout(() => reject(new Error('capture did not abort')), 50)),
  ])).rejects.toMatchObject({ name: 'AbortError' });
  expect(mocks.adapterSetExportVisibility.mock.calls).toEqual([[false], [true]]); expect(onExporterChange).toHaveBeenLastCalledWith(exporter); expect(latestMapHandlers().render ?? []).toHaveLength(0);
}

async function verifyRenderTimeout() {
  const { exporter, onExporterChange } = await renderMapExporter();
  mocks.autoRender = false; vi.useFakeTimers();
  const capture = exporter({ content: 'basemap' });
  const rejection = expect(capture).rejects.toThrow('could not finish restoring');
  await act(async () => vi.advanceTimersByTimeAsync(2500));
  await rejection;
  expect(mocks.adapterSetExportVisibility.mock.calls).toEqual([[false], [true]]); expect(onExporterChange).toHaveBeenLastCalledWith(null);
  expect(latestMapHandlers().render ?? []).toHaveLength(0); expect(latestMapHandlers().error ?? []).toHaveLength(1);
}

async function verifyRendererErrorRejection() {
  const { exporter, onExporterChange } = await renderMapExporter();
  mocks.autoRender = false;
  const capture = exporter({ content: 'basemap' });
  await waitFor(() => expect(mocks.adapterSetExportVisibility).toHaveBeenCalledWith(false));
  mocks.autoRender = true; act(() => emitLatestMapEvent('error', { error: new Error('renderer exploded') }));
  await expect(capture).rejects.toThrow('renderer exploded');
  expect(mocks.adapterSetExportVisibility.mock.calls).toEqual([[false], [true]]); expect(onExporterChange).toHaveBeenLastCalledWith(null);
  expect(latestMapHandlers().render ?? []).toHaveLength(0); expect(latestMapHandlers().error ?? []).toHaveLength(1);
}

async function verifyAuthoringClick() {
  const onMapClick = vi.fn();
  render(<MapCanvas {...baseProps} selectedId={null} onMapClick={onMapClick} />);
  await waitFor(() => expect(mocks.adapterSync).toHaveBeenCalledTimes(1));

  act(() => emitLatestMapEvent('click', { point: [12, 34], lngLat: { lng: 16.31, lat: 48.19 } }));
  expect(onMapClick).toHaveBeenCalledWith([16.31, 48.19]); expect(mocks.hitTest).not.toHaveBeenCalled();
  expect(baseProps.onBackgroundClick).not.toHaveBeenCalled(); expect(baseProps.onLayerSelect).not.toHaveBeenCalled();
}

function ActivationRaceHarness({ onMapClick }: { onMapClick: (coordinate: [number, number]) => void }) {
  const [active, setActive] = useState(false);
  useLayoutEffect(() => {
    if (active) emitLatestMapEvent('click', {
      point: [12, 34],
      lngLat: { lng: 16.31, lat: 48.19 },
    });
  }, [active]);
  return (
    <>
      <button type="button" onClick={() => setActive(true)}>Activate route</button>
      <MapCanvas {...baseProps} selectedId={null} onMapClick={active ? onMapClick : undefined} />
    </>
  );
}

function resetHarness() {
  mocks.adapterSync.mockReset();
  mocks.adapterSync.mockReturnValue('synced');
  mocks.adapterDestroy.mockReset();
  mocks.adapterSetExportVisibility.mockReset();
  mocks.adapterSetExportVisibility.mockReturnValue(true);
  mocks.hitTest.mockReset();
  mocks.hitTest.mockReturnValue(null);
  mocks.mapOff.mockReset();
  mocks.mapRemove.mockReset();
  mocks.mapJumpTo.mockReset();
  mocks.mapFitBounds.mockReset();
  mocks.mapCenter = { lng: 16.3725, lat: 48.2084 };
  mocks.mapZoom = 11.2;
  mocks.mapCreateOptions = [];

  mocks.mapHandlers = []; mocks.activeAdapterIds.clear(); mocks.activeMapIds.clear();
  mocks.failedAdapterDestroyIds.clear(); mocks.failedMapOffOperations.clear(); mocks.failedMapRemoveIds.clear();
  mocks.adapterCount = 0; mocks.mapCount = 0;
  mocks.autoLoad = true; mocks.autoRender = true; mocks.synchronousLoad = false;
  mocks.throwOnFirstCleanup = false; mocks.styleErrorBeforeLoad = false;
  baseProps.onLayerSelect.mockReset(); baseProps.onBackgroundClick.mockReset();
}

describe('MapCanvas camera synchronization', () => {
  beforeEach(() => { resetHarness(); vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as RenderingContext); });

  afterEach(() => vi.restoreAllMocks());

  it('applies canonical bearing and pitch updates to the live map', async () => {
    const initialCamera = { bearing: 0, center: [16.3725, 48.2084] as [number, number], locked: false, pitch: 0, zoom: 11.2 };
    const updatedCamera = { ...initialCamera, bearing: 35, pitch: 40 }; const { rerender } = render(<MapCanvas {...baseProps} selectedId={null} camera={initialCamera} />);
    await waitFor(() => expect(mocks.adapterSync).toHaveBeenCalledTimes(1));
    rerender(<MapCanvas {...baseProps} selectedId={null} camera={updatedCamera} />);
    const updatedJump = { bearing: 35, center: updatedCamera.center, pitch: 40, zoom: 11.2 };
    await waitFor(() => expect(mocks.mapJumpTo).toHaveBeenLastCalledWith(updatedJump)); const cameraSyncCalls = mocks.mapJumpTo.mock.calls.length;
    rerender(<MapCanvas {...baseProps} selectedId={null} camera={updatedCamera} stylePreset="night-ink" />);
    await waitFor(() => expect(mocks.adapterSync).toHaveBeenCalledTimes(2));
    expect(mocks.mapJumpTo).toHaveBeenCalledTimes(cameraSyncCalls + 1); expect(mocks.mapJumpTo).toHaveBeenLastCalledWith(updatedJump);
    rerender(<MapCanvas {...baseProps} selectedId={null} camera={updatedCamera} fitRequest={1} />);
    expect(mocks.mapFitBounds).toHaveBeenLastCalledWith([[16.28, 48.14], [16.48, 48.26]], { bearing: 35, duration: 0, padding: 64, pitch: 40 });
    rerender(<MapCanvas {...baseProps} selectedId={null} camera={{ ...updatedCamera, bearing: 45 }} fitRequest={1} />);
    expect(mocks.mapJumpTo).toHaveBeenLastCalledWith({ ...updatedJump, bearing: 45 }); expect(mocks.mapFitBounds).toHaveBeenCalledOnce();
  });

  it('publishes one canonical viewport update when map movement finishes', async () => {
    const onCameraViewportChange = vi.fn(); render(<MapCanvas {...baseProps} selectedId={null} onCameraViewportChange={onCameraViewportChange} />);
    await waitFor(() => expect(mocks.adapterSync).toHaveBeenCalledTimes(1));
    mocks.mapCenter = { lng: 16.41, lat: 48.23 }; mocks.mapZoom = 13.5;
    act(() => emitLatestMapEvent('moveend'));
    expect(onCameraViewportChange).toHaveBeenCalledOnce(); expect(onCameraViewportChange).toHaveBeenCalledWith([16.41, 48.23], 13.5, 'history');
  });

  it('normalizes a wrapped world longitude before publishing the viewport', async () => {
    const onCameraViewportChange = vi.fn(); render(<MapCanvas {...baseProps} selectedId={null} onCameraViewportChange={onCameraViewportChange} />);
    await waitFor(() => expect(mocks.adapterSync).toHaveBeenCalledTimes(1)); mocks.mapCenter = { lng: 190, lat: 48.23 }; act(() => emitLatestMapEvent('moveend'));
    expect(onCameraViewportChange).toHaveBeenCalledWith([-170, 48.23], 11.2, 'history');
  });

  it('creates every style lifecycle at the canonical viewport', async () => {
    const camera = { bearing: 35, center: [11.34, 47.31] as [number, number], locked: false, pitch: 40, zoom: 13.5 }; const { rerender } = render(<MapCanvas {...baseProps} selectedId={null} camera={camera} />);
    await waitFor(() => expect(mocks.adapterSync).toHaveBeenCalledTimes(1));
    rerender(<MapCanvas {...baseProps} selectedId={null} camera={camera} stylePreset="night-ink" />);
    await waitFor(() => expect(mocks.adapterSync).toHaveBeenCalledTimes(2));
    expect(mocks.mapCreateOptions).toHaveLength(2); expect(mocks.mapCreateOptions).toEqual([
      expect.objectContaining({ bearing: 35, center: [11.34, 47.31], pitch: 40, zoom: 13.5 }),
      expect.objectContaining({ bearing: 35, center: [11.34, 47.31], pitch: 40, zoom: 13.5 }),
    ]);
  });
});

describe('MapCanvas content recovery', () => {
  beforeEach(() => {
    resetHarness();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as RenderingContext);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows a real adapter failure and removes only its content fallback after retry succeeds', async () => {
    mocks.adapterSync.mockReturnValueOnce('failed').mockReturnValue('synced');
    const { rerender } = render(<MapCanvas {...baseProps} selectedId={null} />);

    expect(await screen.findByRole('status')).toHaveTextContent('map content could not be rendered');

    rerender(<MapCanvas {...baseProps} selectedId="route-01" />);

    await waitFor(() => expect(mocks.adapterSync).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  it('preserves a style failure when a later content retry succeeds', async () => {
    mocks.styleErrorBeforeLoad = true;
    mocks.adapterSync.mockReturnValueOnce('failed').mockReturnValue('synced');
    const { rerender } = render(<MapCanvas {...baseProps} selectedId={null} />);

    await waitFor(() => expect(mocks.adapterSync).toHaveBeenCalledTimes(1));
    rerender(<MapCanvas {...baseProps} selectedId="route-01" />);

    await waitFor(() => expect(mocks.adapterSync).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('status')).toHaveTextContent('map style could not be loaded');
  });

  it('surfaces a post-load map error as an actionable renderer fallback', async () => {
    render(<MapCanvas {...baseProps} selectedId={null} />);
    await waitFor(() => expect(mocks.adapterSync).toHaveBeenCalledTimes(1));

    act(() => {
      emitLatestMapEvent('error', new Error('WebGL context lost'));
    });

    const fallback = await screen.findByRole('status');
    expect(fallback).toHaveTextContent('map renderer encountered an error');
    expect(fallback).toHaveTextContent('Reload the page and retry');
  });

  it('invalidates export readiness when map content synchronization fails', async () => {
    const onExporterChange = vi.fn();
    const { rerender } = render(<MapCanvas {...baseProps} selectedId={null} onExporterChange={onExporterChange} />);
    await waitFor(() => expect(onExporterChange).toHaveBeenCalledWith(expect.any(Function)));
    mocks.adapterSync.mockReturnValue('failed');

    rerender(<MapCanvas {...baseProps} selectedId="route-01" onExporterChange={onExporterChange} />);

    await waitFor(() => expect(onExporterChange).toHaveBeenLastCalledWith(null));
    expect(await screen.findByRole('status')).toHaveTextContent('map content could not be rendered');
  });

  it('restores vector content when a basemap-only capture fails', verifyBasemapCaptureRestoration);

  it('invalidates export readiness when initial overlay isolation fails', verifyInitialIsolationFailure);

  it('aborts a pending basemap render wait and restores overlays without invalidating readiness', verifyPendingRenderAbort);

  it('times out bounded render waits and invalidates readiness when restoration cannot render', verifyRenderTimeout);

  it('rejects a render wait on renderer error and removes its temporary handlers', verifyRendererErrorRejection);

  it('does not publish export readiness when initial content synchronization fails', async () => {
    mocks.adapterSync.mockReturnValue('failed');
    const onExporterChange = vi.fn();
    render(<MapCanvas {...baseProps} selectedId={null} onExporterChange={onExporterChange} />);

    expect(await screen.findByRole('status')).toHaveTextContent('map content could not be rendered');
    expect(onExporterChange).not.toHaveBeenCalledWith(expect.any(Function));
  });

  it('invalidates an available exporter after a post-load renderer error', async () => {
    const onExporterChange = vi.fn();
    render(<MapCanvas {...baseProps} selectedId={null} onExporterChange={onExporterChange} />);
    await waitFor(() => expect(onExporterChange).toHaveBeenCalledWith(expect.any(Function)));

    act(() => {
      emitLatestMapEvent('error', new Error('WebGL context lost'));
    });

    await waitFor(() => expect(onExporterChange).toHaveBeenLastCalledWith(null));
    expect(await screen.findByRole('status')).toHaveTextContent('map renderer encountered an error');
  });

  it('does not publish an exporter after a style error before readiness', async () => {
    mocks.styleErrorBeforeLoad = true;
    const onExporterChange = vi.fn();
    render(<MapCanvas {...baseProps} selectedId={null} onExporterChange={onExporterChange} />);

    expect(await screen.findByRole('status')).toHaveTextContent('map style could not be loaded');
    await waitFor(() => expect(onExporterChange).not.toHaveBeenCalledWith(expect.any(Function)));
  });

  it('hands an already-ready exporter to a callback supplied later', async () => {
    const { rerender } = render(<MapCanvas {...baseProps} selectedId={null} />);
    await waitFor(() => expect(mocks.adapterSync).toHaveBeenCalledTimes(1));
    const onExporterChange = vi.fn();

    rerender(<MapCanvas {...baseProps} selectedId={null} onExporterChange={onExporterChange} />);

    await waitFor(() => expect(onExporterChange).toHaveBeenCalledWith(expect.any(Function)));
  });

  it('retries the current content state on idle after sync is deferred', async () => {
    mocks.adapterSync.mockReturnValueOnce('deferred').mockReturnValue('synced');

    render(<MapCanvas {...baseProps} selectedId="route-01" />);

    await waitFor(() => expect(mocks.adapterSync).toHaveBeenCalledTimes(2));
    expect(mocks.adapterSync).toHaveBeenLastCalledWith(expect.objectContaining({ selectedId: 'route-01' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('surfaces a hit-test exception as content fallback without treating it as a background click', async () => {
    mocks.hitTest.mockReturnValue(undefined);
    render(<MapCanvas {...baseProps} selectedId={null} />);
    await waitFor(() => expect(mocks.adapterSync).toHaveBeenCalledTimes(1));

    act(() => {
      emitLatestMapEvent('click', { point: [0, 0] });
    });

    expect(await screen.findByRole('status')).toHaveTextContent('map content could not be rendered');
    expect(baseProps.onBackgroundClick).not.toHaveBeenCalled();
  });

  it('clears a hit-test fallback after a later hit succeeds', async () => {
    mocks.hitTest.mockReturnValueOnce(undefined).mockReturnValue(route.id);
    render(<MapCanvas {...baseProps} selectedId={null} />);
    await waitFor(() => expect(mocks.adapterSync).toHaveBeenCalledTimes(1));

    act(() => {
      emitLatestMapEvent('click', { point: [0, 0] });
    });
    expect(await screen.findByRole('status')).toHaveTextContent('map content could not be rendered');

    act(() => {
      emitLatestMapEvent('click', { point: [1, 1] });
    });

    expect(baseProps.onLayerSelect).toHaveBeenCalledWith(route.id);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  it('routes click coordinates to the active authoring tool before hit testing', verifyAuthoringClick);

  it('updates authoring click routing before parent layout work can dispatch a click', async () => {
    const onMapClick = vi.fn();
    render(<ActivationRaceHarness onMapClick={onMapClick} />);
    await waitFor(() => expect(mocks.adapterSync).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Activate route' }));

    expect(onMapClick).toHaveBeenCalledWith([16.31, 48.19]);
    expect(mocks.hitTest).not.toHaveBeenCalled();
  });

  it('does not clear a sync fallback when a failed hit later succeeds', async () => {
    mocks.adapterSync.mockReturnValue('failed');
    mocks.hitTest.mockReturnValueOnce(undefined).mockReturnValue(route.id);
    render(<MapCanvas {...baseProps} selectedId={null} />);
    expect(await screen.findByRole('status')).toHaveTextContent('map content could not be rendered');

    act(() => {
      emitLatestMapEvent('click', { point: [0, 0] });
      emitLatestMapEvent('click', { point: [1, 1] });
    });

    expect(baseProps.onLayerSelect).toHaveBeenCalledWith(route.id);
    expect(screen.getByRole('status')).toHaveTextContent('map content could not be rendered');
  });

  it('treats a click before adapter creation as an empty-canvas click', () => {
    mocks.autoLoad = false;
    render(<MapCanvas {...baseProps} selectedId={null} />);

    act(() => {
      emitLatestMapEvent('click', { point: [0, 0] });
    });

    expect(baseProps.onBackgroundClick).toHaveBeenCalledOnce();
    expect(mocks.hitTest).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('contains cleanup exceptions and mounts a fresh map after StrictMode teardown', async () => {
    mocks.synchronousLoad = true;
    mocks.throwOnFirstCleanup = true;

    let view: ReturnType<typeof render> | undefined;
    expect(() => {
      view = render(
        <StrictMode>
          <MapCanvas {...baseProps} selectedId={null} />
        </StrictMode>,
      );
    }).not.toThrow();

    await waitFor(() => expect(mocks.mapCount).toBe(2));
    await waitFor(() => expect(mocks.adapterSync).toHaveBeenCalledTimes(2));
    expect([...mocks.activeMapIds]).toEqual([1]);
    expect([...mocks.activeAdapterIds]).toEqual([1]);
    expect(Object.values(mocks.mapHandlers[0]).every((handlers) => handlers.length === 0)).toBe(true);
    expect(mocks.mapOff).toHaveBeenCalledTimes(12);
    expect(mocks.mapOff.mock.calls.filter(([event]) => event === 'drag')).toHaveLength(2);
    expect(mocks.mapOff.mock.calls.filter(([event]) => event === 'moveend')).toHaveLength(2);
    expect(mocks.adapterDestroy).toHaveBeenCalledTimes(2);
    expect(mocks.mapRemove).toHaveBeenCalledTimes(2);

    expect(() => view?.unmount()).not.toThrow();
    expect(mocks.activeMapIds).toHaveLength(0);
    expect(mocks.activeAdapterIds).toHaveLength(0);
    expect(mocks.mapHandlers.every((handlersByEvent) => (
      Object.values(handlersByEvent).every((handlers) => handlers.length === 0)
    ))).toBe(true);
    expect(mocks.mapOff).toHaveBeenCalledTimes(18);
    expect(mocks.mapOff.mock.calls.filter(([event]) => event === 'drag')).toHaveLength(3);
    expect(mocks.mapOff.mock.calls.filter(([event]) => event === 'moveend')).toHaveLength(3);
    expect(mocks.adapterDestroy).toHaveBeenCalledTimes(3);
    expect(mocks.mapRemove).toHaveBeenCalledTimes(3);
  });
});
