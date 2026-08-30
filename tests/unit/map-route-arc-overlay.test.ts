import { describe, expect, it, vi } from 'vitest';
import { createInitialProjectDocument } from '../../src/domain/project';
import { createRouteArcOverlay } from '../../src/map/MapRouteArcOverlay';
import { renderNativeMapTile } from '../../src/map/NativeMapExport';
import { attachNativeRouteArcs } from '../../src/map/NativeMapTileSupport';

describe('route arc overlay lifecycle', () => {
  it('does not allocate an overlay until canonical Arc content is present', async () => {
    const factory = vi.fn(() => ({ finalize: vi.fn(), pickObject: vi.fn(), setProps: vi.fn() }));
    const addControl = vi.fn();
    const controller = createRouteArcOverlay({ addControl } as never, { factory: factory as never });

    expect(controller.sync({ layers: createInitialProjectDocument().layers, selectedId: null, previewedId: null })).toBe(true);
    await controller.whenIdle();
    expect(factory).not.toHaveBeenCalled();
    expect(addControl).not.toHaveBeenCalled();
  });

  it('syncs pickable two-anchor arcs and resolves the owning project layer', async () => {
    const setProps = vi.fn();
    const finalize = vi.fn();
    const pickObject = vi.fn(() => ({ object: { layerId: 'route-01' } }));
    const overlay = { finalize, pickObject, setProps };
    const addControl = vi.fn();
    const controller = createRouteArcOverlay({ addControl } as never, { factory: () => overlay as never });
    const layers = createInitialProjectDocument().layers;
    const route = layers[0];
    if (route.appearance?.kind !== 'route') throw new Error('Route appearance unavailable');
    route.geometry = { type: 'Arc', anchors: [[16.3, 48.2], [16.5, 48.2]] };

    controller.sync({ layers, selectedId: route.id, previewedId: null });
    await controller.whenIdle();

    expect(addControl).toHaveBeenCalledOnce();
    expect(setProps).toHaveBeenCalledOnce();
    const configuredLayers = setProps.mock.calls[0][0].layers;
    expect(configuredLayers).toHaveLength(1);
    expect(configuredLayers[0].props.data).toHaveLength(1);
    expect(controller.hitTest({ x: 20, y: 30 })).toBe('route-01');
    expect(pickObject).toHaveBeenCalledWith(expect.objectContaining({ x: 20, y: 30, radius: 12 }));

    controller.destroy();
    expect(finalize).toHaveBeenCalledOnce();
  });

  it('keeps the interleaved arc layer mounted while hiding basemap-only content', async () => {
    const setProps = vi.fn();
    const overlay = { finalize: vi.fn(), pickObject: vi.fn(), setProps };
    const controller = createRouteArcOverlay({ addControl: vi.fn() } as never, { factory: () => overlay as never });
    const layers = createInitialProjectDocument().layers;
    const route = layers[0];
    if (route.appearance?.kind !== 'route') throw new Error('Route appearance unavailable');
    route.geometry = { type: 'Arc', anchors: [[16.3, 48.2], [16.5, 48.2]] };
    controller.sync({ layers, selectedId: null, previewedId: null });
    await controller.whenIdle();

    expect(controller.setExportVisibility(false)).toBe(true);
    await controller.whenIdle();
    expect(setProps.mock.calls.at(-1)?.[0].layers).toHaveLength(1);
    expect(setProps.mock.calls.at(-1)?.[0].layers[0].props.visible).toBe(false);
    expect(controller.setExportVisibility(true)).toBe(true);
    await controller.whenIdle();
    expect(setProps.mock.calls.at(-1)?.[0].layers).toHaveLength(1);
    expect(setProps.mock.calls.at(-1)?.[0].layers[0].props.visible).toBe(true);
  });

  it('renders canonical Arc routes into preview and native PNG map canvases', async () => {
    const layers = createInitialProjectDocument().layers;
    const route = layers[0];
    route.geometry = { type: 'Arc', anchors: [[16.3, 48.2], [16.5, 48.2]] };

    const previewOverlay = { finalize: vi.fn(), pickObject: vi.fn(), setProps: vi.fn() };
    const previewFactory = vi.fn(() => previewOverlay);
    const previewMap = { addControl: vi.fn() };
    const previewController = createRouteArcOverlay(previewMap as never, { factory: previewFactory as never });
    previewController.sync({ layers, selectedId: null, previewedId: null });
    await previewController.whenIdle();

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600,
      width: 800, height: 600, toJSON: () => ({}),
    });
    const sourceMap = {
      getBearing: () => 0,
      getCanvas: () => sourceCanvas,
      getPitch: () => 0,
      getStyle: () => ({ version: 8 as const, sources: {}, layers: [] }),
      getZoom: () => 10,
      unproject: () => ({ lng: 16.4, lat: 48.2 }),
    };
    const frame = document.createElement('div');
    frame.getBoundingClientRect = () => ({
      x: 200, y: 200, left: 200, top: 200, right: 600, bottom: 400,
      width: 400, height: 200, toJSON: () => ({}),
    });
    const renderedCanvas = document.createElement('canvas');
    renderedCanvas.width = 800;
    renderedCanvas.height = 400;
    const handlers = new Map<string, (event?: unknown) => void>();
    const temporaryMap = {
      getBearing: () => 0,
      getCanvas: () => renderedCanvas,
      getCenter: () => ({ lng: 16.4, lat: 48.2 }),
      getPitch: () => 0,
      getZoom: () => 10,
      off: (event: string) => handlers.delete(event),
      once: (event: string, callback: (event?: unknown) => void) => {
        handlers.set(event, callback);
        if (event === 'load' || event === 'idle') queueMicrotask(callback);
      },
      remove: vi.fn(),
      setPaintProperty: vi.fn(),
      triggerRepaint: vi.fn(),
    };
    const nativeArcOverlay = { destroy: vi.fn(), sync: vi.fn(() => true) };
    const createArcOverlay = vi.fn(() => nativeArcOverlay);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    await renderNativeMapTile(sourceMap as never, frame, {
      output: { width: 800, height: 400 },
      region: { x: 0, y: 0, width: 800, height: 400 },
    }, {
      createArcOverlay,
      createMap: () => temporaryMap as never,
      layers,
      pixelsPerMillimetre: 10,
    } as never);

    expect(previewFactory).toHaveBeenCalledWith({ interleaved: false });
    expect(createArcOverlay).toHaveBeenCalledWith(temporaryMap, 1.5);
    expect(nativeArcOverlay.sync).toHaveBeenCalledWith({ layers, selectedId: null, previewedId: null });
    expect(nativeArcOverlay.destroy).toHaveBeenCalledOnce();
  });
  it('fails the export path loudly when the arc renderer cannot be fetched', async () => {
    const layers = createInitialProjectDocument().layers;
    const route = layers[0];
    if (route.appearance?.kind !== 'route') throw new Error('Route appearance unavailable');
    route.geometry = { type: 'Arc', anchors: [[16.3, 48.2], [16.5, 48.2]] };
    const loadDeckLayers = vi.fn(() => Promise.reject(new Error('offline')));
    const controller = createRouteArcOverlay({ addControl: vi.fn() } as never, {
      factory: (() => ({ finalize: vi.fn(), pickObject: vi.fn(), setProps: vi.fn() })) as never,
      loadDeckLayers: loadDeckLayers as never,
    });

    expect(controller.sync({ layers, selectedId: null, previewedId: null })).toBe(true);
    await expect(controller.whenIdle()).rejects.toThrow('The route arc renderer could not be loaded.');
    expect(loadDeckLayers).toHaveBeenCalled();
  });

  it('stays idle after a renderer fetch failure once no arcs remain to draw', async () => {
    const layers = createInitialProjectDocument().layers;
    const route = layers[0];
    if (route.appearance?.kind !== 'route') throw new Error('Route appearance unavailable');
    route.geometry = { type: 'Arc', anchors: [[16.3, 48.2], [16.5, 48.2]] };
    const controller = createRouteArcOverlay({ addControl: vi.fn() } as never, {
      factory: (() => ({ finalize: vi.fn(), pickObject: vi.fn(), setProps: vi.fn() })) as never,
      loadDeckLayers: (() => Promise.reject(new Error('offline'))) as never,
    });

    controller.sync({ layers, selectedId: null, previewedId: null });
    await expect(controller.whenIdle()).rejects.toThrow();

    route.geometry = undefined;
    controller.sync({ layers, selectedId: null, previewedId: null });
    await expect(controller.whenIdle()).resolves.toBeUndefined();
  });

  it('recovers when a later renderer fetch succeeds after an earlier failure', async () => {
    const layers = createInitialProjectDocument().layers;
    const route = layers[0];
    if (route.appearance?.kind !== 'route') throw new Error('Route appearance unavailable');
    route.geometry = { type: 'Arc', anchors: [[16.3, 48.2], [16.5, 48.2]] };
    const setProps = vi.fn();
    const loadDeckLayers = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ arcLayer: () => ({ id: 'arc' }), defaultOverlayFactory: () => ({}) });
    const controller = createRouteArcOverlay({ addControl: vi.fn() } as never, {
      factory: (() => ({ finalize: vi.fn(), pickObject: vi.fn(), setProps })) as never,
      loadDeckLayers: loadDeckLayers as never,
    });

    controller.sync({ layers, selectedId: null, previewedId: null });
    await expect(controller.whenIdle()).rejects.toThrow();

    controller.sync({ layers, selectedId: null, previewedId: null });
    await expect(controller.whenIdle()).resolves.toBeUndefined();
    expect(setProps).toHaveBeenCalled();
  });

  it('propagates a renderer failure out of the native tile attach step', async () => {
    const layers = createInitialProjectDocument().layers;
    const failing = {
      destroy: vi.fn(),
      sync: vi.fn(() => true),
      whenIdle: vi.fn(() => Promise.reject(new Error('The route arc renderer could not be loaded.'))),
    };

    await expect(attachNativeRouteArcs({} as never, layers, 1, () => failing as never))
      .rejects.toThrow('The route arc renderer could not be loaded.');
    expect(failing.sync).toHaveBeenCalled();
  });
});
