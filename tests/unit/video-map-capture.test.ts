import type { Map as MapLibreMap } from 'maplibre-gl';
import { createInitialProjectDocument } from '../../src/domain/project';
import type { MapRenderSnapshot } from '../../src/map/MapRenderSnapshot';
import { createMapVideoSnapshot, videoSnapshotCamera } from '../../src/video/mapCapture';
import { planVideoExport } from '../../src/video/plan';
import type { VideoCamera } from '../../src/video/camera';

function snapshot(): MapRenderSnapshot {
  return {
    style: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#ffffff' } }] },
    layers: [], assets: {},
    camera: { center: [16.37, 48.21], zoom: 10, bearing: 20, pitch: 30, roll: 0 },
    printCamera: { center: [16.37, 48.21], zoom: 10, bearing: 20, pitch: 30 },
    viewport: { width: 600, height: 424 }, frame: { x: 0, y: 0, width: 600, height: 424 },
    footprint: { corners: [[16, 48], [17, 48], [17, 47], [16, 47]], widthPx: 600, heightPx: 424, bearing: 20, pitch: 30 },
    referenceLongitude: 16.37,
  };
}

function setup() {
  const document = createInitialProjectDocument();
  const source = snapshot();
  const plan = planVideoExport({ motion: 'orbit', durationSeconds: 5, fps: 30, aspect: 'poster', quality: 'standard' }, document.page);
  const handlers = new Map<string, Set<(event?: unknown) => void>>();
  const canvas = window.document.createElement('canvas');
  canvas.width = plan.poster.width;
  canvas.height = plan.poster.height;
  let currentCamera: VideoCamera = videoSnapshotCamera(source, plan);
  const on = (event: string, handler: (event?: unknown) => void) => {
    const listeners = handlers.get(event) ?? new Set();
    listeners.add(handler);
    handlers.set(event, listeners);
  };
  const off = (event: string, handler: (event?: unknown) => void) => handlers.get(event)?.delete(handler);
  const emit = (event: string, payload?: unknown) => {
    const listeners = handlers.get(event) ?? [];
    for (const listener of listeners) listener(payload);
  };
  const remove = vi.fn();
  const map = {
    on, off, once: on, remove,
    loaded: () => true, areTilesLoaded: () => true,
    getCanvas: () => canvas, getCenter: () => ({ lng: currentCamera.center[0], lat: currentCamera.center[1] }),
    getZoom: () => currentCamera.zoom, getBearing: () => currentCamera.bearing, getPitch: () => currentCamera.pitch,
    project: () => ({ x: 30, y: 40 }),
    jumpTo: vi.fn((camera: VideoCamera) => { currentCamera = camera; }),
    triggerRepaint: () => queueMicrotask(() => emit('render')),
  } as unknown as MapLibreMap;
  const createMap = vi.fn(() => {
    queueMicrotask(() => emit('load'));
    return map;
  });
  return { source, document, plan, map, createMap, remove, emit, handlers };
}

describe('isolated video renderer', () => {
  it('uses a detached applied style/camera, restores no live state, and disposes the isolated map once', async () => {
    const test = setup();
    const before = structuredClone(test.document);
    const release = vi.fn();
    const retainStyleResources = vi.fn(() => release);
    const capture = createMapVideoSnapshot(test.source, test.document, test.plan, {
      createMap: test.createMap, retainStyleResources,
    });
    test.source.style.layers.length = 0;
    const signal = new AbortController().signal;
    const renderer = await capture.createRenderer(signal);
    const frame = await renderer.render(capture.camera, signal);
    const expectedLayer = expect.objectContaining({ id: 'background' });
    const expectedStyle = expect.objectContaining({ layers: [expectedLayer] });
    expect(test.createMap).toHaveBeenCalledWith(expect.objectContaining({
      interactive: false, attributionControl: false, pixelRatio: 1,
      style: expectedStyle,
    }));
    expect(frame.project([0, 0])).toEqual({ x: 30, y: 40 });
    expect(test.document).toEqual(before);
    expect(window.document.querySelectorAll('[data-video-export-renderer]')).toHaveLength(1);
    renderer.dispose();
    renderer.dispose();
    expect(test.remove).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
    expect(test.remove.mock.invocationCallOrder[0]).toBeLessThan(release.mock.invocationCallOrder[0]);
    expect(window.document.querySelectorAll('[data-video-export-renderer]')).toHaveLength(0);
  });

  it('rejects unsupported roll, stale frame aspect, and unretained custom terrain protocols', () => {
    const test = setup();
    expect(() => videoSnapshotCamera({ ...test.source, camera: { ...test.source.camera, roll: 5 } }, test.plan)).toThrow('roll');
    expect(() => videoSnapshotCamera({ ...test.source, frame: { ...test.source.frame, width: 100 } }, test.plan)).toThrow('aspect');
    test.source.style.sources.contours = { type: 'vector', tiles: ['pms-contours://dem/{z}/{x}/{y}'] };
    expect(() => createMapVideoSnapshot(test.source, test.document, test.plan)).toThrow('contour resources');
  });

  it('cleans up a load failure and releases resources', async () => {
    const test = setup();
    const release = vi.fn();
    test.createMap.mockImplementation(() => {
      queueMicrotask(() => test.emit('error', { error: new Error('DEM request failed') }));
      return test.map;
    });
    const capture = createMapVideoSnapshot(test.source, test.document, test.plan, { createMap: test.createMap, retainStyleResources: () => release });
    await expect(capture.createRenderer(new AbortController().signal)).rejects.toThrow('DEM request failed');
    expect(test.remove).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
    expect(window.document.querySelectorAll('[data-video-export-renderer]')).toHaveLength(0);
  });

  it('aborts pending tile readiness and detaches event handlers', async () => {
    const test = setup();
    test.map.areTilesLoaded = () => false;
    const capture = createMapVideoSnapshot(test.source, test.document, test.plan, { createMap: test.createMap });
    const controller = new AbortController();
    const renderer = await capture.createRenderer(controller.signal);
    const pending = expect(renderer.render(capture.camera, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await pending;
    renderer.dispose();
    expect(test.remove).toHaveBeenCalledOnce();
    for (const listeners of test.handlers.values()) expect(listeners.size).toBe(0);
  });

  it('does not accept browser-clamped camera or backing dimensions', async () => {
    const test = setup();
    const capture = createMapVideoSnapshot(test.source, test.document, test.plan, { createMap: test.createMap });
    const signal = new AbortController().signal;
    const renderer = await capture.createRenderer(signal);
    test.map.getZoom = () => 0;
    await expect(renderer.render(capture.camera, signal)).rejects.toThrow('requested video camera');
    renderer.dispose();
  });
});
