import type { Map as MapLibreMap } from 'maplibre-gl';
import { createLifecycleExportPreview, type LifecycleExportReferences } from '../../src/map/MapLifecycleExport';

const capture = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('../../src/export/vector/capture', () => ({ captureVectorBasemap: capture.run }));

function harness() {
  const handlers = new Map<string, Set<() => void>>();
  const parent = document.createElement('div'), container = document.createElement('div'), frame = document.createElement('div');
  frame.className = 'print-frame';
  parent.append(container, frame);
  const canvas = document.createElement('canvas');
  canvas.getBoundingClientRect = frame.getBoundingClientRect = () => new DOMRect(0, 0, 512, 512);
  const map = {
    loaded: () => true, areTilesLoaded: () => true, isMoving: () => false,
    getCanvas: () => canvas, getCenter: () => ({ lng: 0, lat: 0 }),
    getZoom: () => 0, getBearing: () => 0, getPitch: () => 0, getRoll: () => 0,
    unproject: () => ({ lng: 0, lat: 0 }),
    on: (name: string, callback: () => void) => {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name)!.add(callback);
    },
    off: (name: string, callback: () => void) => handlers.get(name)?.delete(callback),
  } as unknown as MapLibreMap;
  const references: LifecycleExportReferences = {
    availableExporter: { current: null }, container: { current: container }, contentAdapter: { current: null },
    contentReady: { current: true }, contentState: { current: { layers: [] } },
    exporterChange: { current: undefined }, map: { current: map }, mapFailed: { current: false },
    resolveExportStyle: () => ({ version: 8, sources: {}, layers: [] }), setBasemapExportVisibility: vi.fn(),
  };
  const exporter = createLifecycleExportPreview(map, references, vi.fn());
  references.availableExporter.current = exporter;
  return { exporter, references, handlers };
}

it('aborts stale map captures and removes all revision listeners', async () => {
  const test = harness();
  capture.run.mockImplementation((_, options: { signal: AbortSignal }) => new Promise((resolve) => {
    options.signal.addEventListener('abort', () => resolve({}), { once: true });
  }));
  const output = test.exporter.captureVectorBasemap!();
  await vi.waitFor(() => expect(capture.run).toHaveBeenCalled());
  for (const callback of test.handlers.get('movestart')!) callback();
  await expect(output).rejects.toThrow('map changed');
  for (const listeners of test.handlers.values()) expect(listeners.size).toBe(0);
  expect(test.references.setBasemapExportVisibility).not.toHaveBeenCalled();
});

it('rejects changed canonical content even if the source map instance survives', async () => {
  const test = harness();
  capture.run.mockImplementation(async () => {
    test.references.contentState.current = { layers: [] };
    return {};
  });
  await expect(test.exporter.captureVectorBasemap!()).rejects.toThrow('map changed');
  for (const listeners of test.handlers.values()) expect(listeners.size).toBe(0);
});
