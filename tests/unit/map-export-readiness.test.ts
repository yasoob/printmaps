import type { Map as MapLibreMap } from 'maplibre-gl';
import type { MapContentAdapter } from '../../src/map/MapContentAdapter';
import { createLifecycleExportPreview, type LifecycleExportReferences } from '../../src/map/MapLifecycleExport';
import { MAP_READY_TIMEOUT_MS } from '../../src/map/MapLifecycleDeadline';
import type { PreviewPngExporter } from '../../src/export/previewPng';

const mocks = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock('../../src/export/previewPng', () => ({ capturePrintFramePng: mocks.capture }));

function harness() {
  const handlers = new Map<string, Set<(event?: { error?: unknown }) => void>>();
  let isLoaded = true;
  const parent = document.createElement('div');
  const container = document.createElement('div');
  const frame = document.createElement('div');
  frame.className = 'print-frame';
  parent.append(container, frame);
  const native = {
    on: (event: string, callback: (event?: { error?: unknown }) => void) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(callback);
    },
    off: (event: string, callback: (event?: { error?: unknown }) => void) => handlers.get(event)?.delete(callback),
    loaded: () => isLoaded,
    triggerRepaint: vi.fn(),
    getCenter: () => ({ lng: 16.37, lat: 48.21 }),
    getCanvas: () => document.createElement('canvas'),
  } as unknown as MapLibreMap;
  const references: LifecycleExportReferences = {
    availableExporter: { current: null }, container: { current: container },
    contentAdapter: { current: null }, contentReady: { current: true },
    contentState: { current: { layers: [] } }, exporterChange: { current: vi.fn() },
    map: { current: native }, mapFailed: { current: false },
    resolveExportStyle: vi.fn(), setBasemapExportVisibility: vi.fn(() => true),
  };
  const setExportVisibility = vi.fn(() => {
    if (references.map.current === native) {
      isLoaded = false;
      references.availableExporter.current = null;
    }
    return true;
  });
  references.contentAdapter.current = { setExportVisibility } as unknown as MapContentAdapter;
  const onRestoreFailure = vi.fn();
  const exporter = createLifecycleExportPreview(native, references, onRestoreFailure);
  references.availableExporter.current = exporter;
  const surface = document.createElement('canvas');
  surface.width = 20; surface.height = 10;
  mocks.capture.mockResolvedValue({ surface, width: 20, height: 10, blob: new Blob() });
  const emit = (event: string, payload?: { error?: unknown }) => {
    const listeners = handlers.get(event) ?? [];
    for (const callback of listeners) callback(payload);
  };
  const ready = () => {
    isLoaded = true;
    references.availableExporter.current = exporter;
    emit('idle');
  };
  return {
    emit, exporter, handlers, native, onRestoreFailure, ready, references, setExportVisibility, surface,
    setLoaded: (isReady: boolean) => { isLoaded = isReady; },
  };
}

async function beginRestoration(test: ReturnType<typeof harness>) {
  const capture = test.exporter({ content: 'basemap' });
  test.ready();
  await Promise.resolve();
  await Promise.resolve();
  expect(test.setExportVisibility).toHaveBeenLastCalledWith(true);
  return { capture };
}

afterEach(() => vi.useRealTimers());

it('waits for native loading and published lifecycle readiness before capture and after restoration', async () => {
  const test = harness();
  const settled = vi.fn();
  const capture = (async () => {
    settled(await test.exporter({ content: 'basemap' }));
  })();
  test.references.availableExporter.current = test.exporter;
  test.emit('render');
  await Promise.resolve();
  expect(mocks.capture).not.toHaveBeenCalled();
  test.setLoaded(true);
  test.references.availableExporter.current = null;
  test.emit('render');
  await Promise.resolve();
  expect(mocks.capture).not.toHaveBeenCalled();
  test.ready();
  await Promise.resolve();
  await Promise.resolve();
  expect(mocks.capture).toHaveBeenCalledOnce();
  expect(test.setExportVisibility.mock.calls).toEqual([[false], [true]]);
  test.emit('render');
  await Promise.resolve();
  expect(settled).not.toHaveBeenCalled();
  test.ready();
  await capture;
  expect(settled).toHaveBeenCalledWith(expect.objectContaining({ surface: test.surface }));
  expect(test.references.availableExporter.current).toBe(test.exporter);
  for (const listeners of test.handlers.values()) expect(listeners.size).toBe(0);
});

it('cancels promptly but still restores canonical visibility and readiness', async () => {
  const test = harness();
  const controller = new AbortController();
  const capture = test.exporter({ content: 'basemap', signal: controller.signal });
  const rejection = expect(capture).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort();
  await Promise.resolve();
  expect(test.setExportVisibility).toHaveBeenLastCalledWith(true);
  test.ready();
  await rejection;
  expect(test.onRestoreFailure).not.toHaveBeenCalled();
  expect(test.references.availableExporter.current).toBe(test.exporter);
  for (const listeners of test.handlers.values()) expect(listeners.size).toBe(0);
});

it('bounds restoration waiting and releases the captured surface on timeout', async () => {
  vi.useFakeTimers();
  const test = harness();
  const { capture } = await beginRestoration(test);
  const rejection = expect(capture).rejects.toThrow('could not finish restoring');
  await vi.advanceTimersByTimeAsync(MAP_READY_TIMEOUT_MS);
  await rejection;
  expect(test.onRestoreFailure).toHaveBeenCalledOnce();
  expect(test.surface).toMatchObject({ width: 0, height: 0 });
  for (const listeners of test.handlers.values()) expect(listeners.size).toBe(0);
});

it('rejects a replaced renderer without poisoning its successor or changing the successor visibility', async () => {
  const test = harness();
  const capture = test.exporter({ content: 'basemap' });
  const rejection = expect(capture).rejects.toThrow('renderer changed');
  const replacement = {} as MapLibreMap;
  const replacementExporter = vi.fn() as unknown as PreviewPngExporter;
  test.references.map.current = replacement;
  test.references.availableExporter.current = replacementExporter;
  test.emit('remove');
  await rejection;
  expect(test.references.setBasemapExportVisibility).toHaveBeenCalledExactlyOnceWith(test.native, true);
  expect(test.onRestoreFailure).not.toHaveBeenCalled();
  expect(test.references.availableExporter.current).toBe(replacementExporter);
  expect(test.references.contentReady.current).toBe(true);
  expect(test.references.mapFailed.current).toBe(false);
  for (const listeners of test.handlers.values()) expect(listeners.size).toBe(0);
});

it('releases an already-captured surface if the native renderer is replaced during restoration', async () => {
  const test = harness();
  const { capture } = await beginRestoration(test);
  const rejection = expect(capture).rejects.toThrow('could not finish restoring');
  test.references.map.current = {} as MapLibreMap;
  test.emit('remove');
  await rejection;
  expect(test.surface).toMatchObject({ width: 0, height: 0 });
  expect(test.onRestoreFailure).not.toHaveBeenCalled();
});

it('retains the original renderer error when restoration also becomes unavailable', async () => {
  const test = harness();
  const capture = test.exporter({ content: 'basemap' });
  const rejection = expect(capture).rejects.toThrow('renderer exploded');
  test.references.mapFailed.current = true;
  test.emit('error', { error: new Error('renderer exploded') });
  await rejection;
  expect(test.onRestoreFailure).toHaveBeenCalledOnce();
});
