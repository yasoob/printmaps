import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { ContentLayer } from '../../src/domain/project';

const mocks = vi.hoisted(() => ({
  adapterSync: vi.fn(),
  adapterDestroy: vi.fn(),
  hitTest: vi.fn(),
  mapOff: vi.fn(),
  mapRemove: vi.fn(),
  mapHandlers: [] as Array<Record<string, Array<(event?: unknown) => void>>>,
  activeAdapterIds: new Set<number>(),
  activeMapIds: new Set<number>(),
  failedAdapterDestroyIds: new Set<number>(),
  failedMapOffOperations: new Set<string>(),
  failedMapRemoveIds: new Set<number>(),
  adapterCount: 0,
  mapCount: 0,
  autoLoad: true,
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
    private readonly mapIndex: number;
    private readonly handlers: Record<string, Array<(event?: unknown) => void>>;
    constructor() {
      this.mapIndex = mocks.mapCount++;
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
    fitBounds() {}
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
      } else if (event === 'idle') {
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
  layers: [route],
  previewedId: null,
  onLayerSelect: vi.fn(),
  onBackgroundClick: vi.fn(),
};

describe('MapCanvas content recovery', () => {
  beforeEach(() => {
    mocks.adapterSync.mockReset();
    mocks.adapterSync.mockReturnValue('synced');
    mocks.adapterDestroy.mockReset();
    mocks.hitTest.mockReset();
    mocks.hitTest.mockReturnValue(null);
    mocks.mapOff.mockReset();
    mocks.mapRemove.mockReset();
    mocks.mapHandlers = [];
    mocks.activeAdapterIds.clear();
    mocks.activeMapIds.clear();
    mocks.failedAdapterDestroyIds.clear();
    mocks.failedMapOffOperations.clear();
    mocks.failedMapRemoveIds.clear();
    mocks.adapterCount = 0;
    mocks.mapCount = 0;
    mocks.autoLoad = true;
    mocks.synchronousLoad = false;
    mocks.throwOnFirstCleanup = false;
    mocks.styleErrorBeforeLoad = false;
    baseProps.onLayerSelect.mockReset();
    baseProps.onBackgroundClick.mockReset();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as RenderingContext);
  });

  afterEach(() => {
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
    expect(mocks.mapOff).toHaveBeenCalledTimes(10);
    expect(mocks.mapOff.mock.calls.filter(([event]) => event === 'drag')).toHaveLength(2);
    expect(mocks.adapterDestroy).toHaveBeenCalledTimes(2);
    expect(mocks.mapRemove).toHaveBeenCalledTimes(2);

    expect(() => view?.unmount()).not.toThrow();
    expect(mocks.activeMapIds).toHaveLength(0);
    expect(mocks.activeAdapterIds).toHaveLength(0);
    expect(mocks.mapHandlers.every((handlersByEvent) => (
      Object.values(handlersByEvent).every((handlers) => handlers.length === 0)
    ))).toBe(true);
    expect(mocks.mapOff).toHaveBeenCalledTimes(15);
    expect(mocks.mapOff.mock.calls.filter(([event]) => event === 'drag')).toHaveLength(3);
    expect(mocks.adapterDestroy).toHaveBeenCalledTimes(3);
    expect(mocks.mapRemove).toHaveBeenCalledTimes(3);
  });
});
