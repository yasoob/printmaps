import type { Map as MapLibreMap } from 'maplibre-gl';
import {
  calculateNativeTileCamera,
  createNativePrintTileExport,
  renderNativeMapTile,
  scaleNativeMapStyle,
  selectNativeExportPixelRatio,
} from '../../src/map/NativeMapExport';

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  x: left,
  y: top,
  left,
  top,
  right: left + width,
  bottom: top + height,
  width,
  height,
  toJSON: () => ({}),
});

describe('native map export camera', () => {
  it('uses HiDPI rendering only when it preserves exact odd target dimensions', () => {
    expect(selectNativeExportPixelRatio({ width: 3508, height: 2480 })).toBe(2);
    expect(selectNativeExportPixelRatio({ width: 1181, height: 3543 })).toBe(1);
  });

  it('raises source zoom for target pixels and centers each overlap region on the matching frame point', () => {
    const canvas = document.createElement('canvas');
    canvas.getBoundingClientRect = () => rect(100, 50, 800, 600);
    const unproject = vi.fn(() => ({ lng: 16.4, lat: 48.2 }));
    const map = {
      getBearing: () => 25,
      getCanvas: () => canvas,
      getPitch: () => 35,
      getZoom: () => 10,
      unproject,
    } as unknown as MapLibreMap;
    const frame = document.createElement('div');
    frame.getBoundingClientRect = () => rect(300, 200, 400, 200);

    const camera = calculateNativeTileCamera(map, frame, {
      output: { width: 4000, height: 2000 },
      region: { x: 1000, y: 500, width: 1000, height: 500 },
    });

    expect(unproject).toHaveBeenCalledWith([350, 225]);
    expect(camera).toEqual({
      bearing: 25,
      center: [16.4, 48.2],
      pitch: 35,
      zoom: 10 + Math.log2(10),
    });
  });

  it('rejects target dimensions whose aspect ratio no longer matches the print frame', () => {
    const canvas = document.createElement('canvas');
    canvas.getBoundingClientRect = () => rect(0, 0, 800, 600);
    const map = {
      getBearing: () => 0,
      getCanvas: () => canvas,
      getPitch: () => 0,
      getZoom: () => 10,
      unproject: vi.fn(),
    } as unknown as MapLibreMap;
    const frame = document.createElement('div');
    frame.getBoundingClientRect = () => rect(200, 200, 400, 200);

    expect(() => calculateNativeTileCamera(map, frame, {
      output: { width: 4000, height: 1000 },
      region: { x: 0, y: 0, width: 1000, height: 1000 },
    })).toThrow('aspect ratio');
  });

  it('renders every tile in a fresh target-pixel MapLibre surface and cleans it up', async () => {
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.getBoundingClientRect = () => rect(100, 50, 800, 600);
    const sourceStyle = { version: 8 as const, sources: {}, layers: [] };
    const sourceMap = {
      getBearing: () => 25,
      getCanvas: () => sourceCanvas,
      getPitch: () => 35,
      getStyle: () => sourceStyle,
      getZoom: () => 10,
      unproject: () => ({ lng: 16.4, lat: 48.2 }),
    } as unknown as MapLibreMap;
    const frame = document.createElement('div');
    frame.getBoundingClientRect = () => rect(300, 200, 400, 200);
    const renderedCanvas = document.createElement('canvas');
    renderedCanvas.width = 1000;
    renderedCanvas.height = 500;
    const handlers = new Map<string, (event?: unknown) => void>();
    const remove = vi.fn();
    const setPaintProperty = vi.fn();
    const temporaryMap = {
      getBearing: () => 25,
      getCanvas: () => renderedCanvas,
      getCenter: () => ({ lng: 16.4, lat: 48.2 }),
      getPitch: () => 35,
      getZoom: () => 10 + Math.log2(5),
      off: (event: string) => handlers.delete(event),
      once: (event: string, callback: (event?: unknown) => void) => {
        handlers.set(event, callback);
        if (event === 'load' || event === 'idle') queueMicrotask(callback);
      },
      remove,
      setPaintProperty,
      triggerRepaint: vi.fn(),
    } as unknown as MapLibreMap;
    let temporaryContainer: HTMLElement | undefined;
    const createMap = vi.fn((options: { container: HTMLElement | string }) => {
      temporaryContainer = options.container as HTMLElement;
      return temporaryMap;
    });
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);

    const surface = await renderNativeMapTile(sourceMap, frame, {
      output: { width: 4000, height: 2000 },
      region: { x: 1000, y: 500, width: 1000, height: 500 },
    }, {
      createMap,
      layers: [{
        id: 'route-01',
        name: 'Route 01',
        type: 'route',
        visible: true,
        locked: false,
        opacity: 100,
        appearance: { kind: 'route', color: '#d9363e', width: 4 },
        geometry: { type: 'LineString', coordinates: [[16.3, 48.2], [16.4, 48.3]] },
      }],
      pixelsPerMillimetre: 10,
    } as Parameters<typeof renderNativeMapTile>[3]);

    expect(surface).toMatchObject({ width: 1000, height: 500 });
    expect(createMap).toHaveBeenCalledWith(expect.objectContaining({
      attributionControl: false,
      bearing: 25,
      center: [16.4, 48.2],
      interactive: false,
      maxCanvasSize: [1000, 500],
      pitch: 35,
      pixelRatio: 2,
      style: sourceStyle,
      zoom: 10 + Math.log2(5),
    }));
    expect(temporaryContainer?.style.width).toBe('500px');
    expect(temporaryContainer?.style.height).toBe('250px');
    expect(temporaryContainer?.dataset.nativeExportRegion).toBe('1000,500,1000,500/4000x2000');
    expect(temporaryContainer?.isConnected).toBe(false);
    expect(drawImage).toHaveBeenCalledWith(renderedCanvas, 0, 0);
    expect(setPaintProperty).toHaveBeenCalledWith(
      'studio-layer-8:route-01:main',
      'line-width',
      6,
    );
    expect(remove).toHaveBeenCalledOnce();
  });

  it('fails closed when MapLibre clamps the requested print camera', async () => {
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.getBoundingClientRect = () => rect(0, 0, 800, 600);
    const sourceMap = {
      getBearing: () => 10,
      getCanvas: () => sourceCanvas,
      getPitch: () => 20,
      getStyle: () => ({ version: 8 as const, sources: {}, layers: [] }),
      getZoom: () => 20,
      unproject: () => ({ lng: 16.4, lat: 48.2 }),
    } as unknown as MapLibreMap;
    const frame = document.createElement('div');
    frame.getBoundingClientRect = () => rect(200, 200, 400, 200);
    const renderedCanvas = document.createElement('canvas');
    renderedCanvas.width = 4000;
    renderedCanvas.height = 2000;
    const remove = vi.fn();
    const temporaryMap = {
      getBearing: () => 10,
      getCanvas: () => renderedCanvas,
      getCenter: () => ({ lng: 16.4, lat: 48.2 }),
      getPitch: () => 20,
      getZoom: () => 22,
      off: vi.fn(),
      once: vi.fn(),
      remove,
    } as unknown as MapLibreMap;

    await expect(renderNativeMapTile(sourceMap, frame, {
      output: { width: 4000, height: 2000 },
      region: { x: 0, y: 0, width: 4000, height: 2000 },
    }, { createMap: () => temporaryMap, layers: [] })).rejects.toThrow('requested print camera');
    expect(remove).toHaveBeenCalledOnce();
  });
});

describe('native map export job', () => {
  it('scales fixed and interpolated style pixels to canonical print pixels', () => {
    const style = {
      version: 8 as const,
      sources: {},
      layers: [{
        id: 'roads',
        type: 'line' as const,
        paint: {
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 14, 4],
          'line-opacity': 0.8,
        },
      }, {
        id: 'labels',
        type: 'symbol' as const,
        layout: { 'text-size': 12, 'text-field': '{name}' },
        paint: { 'text-halo-width': 1 },
      }],
    };

    const scaled = scaleNativeMapStyle(
      style as unknown as ReturnType<MapLibreMap['getStyle']>,
      3,
    );

    expect(scaled.layers?.[0]?.paint).toEqual({
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 3, 14, 12],
      'line-opacity': 0.8,
    });
    expect(scaled.layers?.[1]).toMatchObject({
      layout: { 'text-size': 36 },
      paint: { 'text-halo-width': 3 },
    });
    expect(style.layers[0]?.paint['line-width']).toEqual([
      'interpolate', ['linear'], ['zoom'], 8, 1, 14, 4,
    ]);
  });

  it('rejects pitched multi-region jobs instead of composing incompatible sub-frustums', () => {
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.getBoundingClientRect = () => rect(0, 0, 800, 600);
    const sourceMap = {
      getBearing: () => 25,
      getCanvas: () => sourceCanvas,
      getPitch: () => 35,
      getStyle: () => ({ version: 8 as const, sources: {}, layers: [] }),
      getZoom: () => 10,
      unproject: () => ({ lng: 16.4, lat: 48.2 }),
    } as unknown as MapLibreMap;
    const frame = document.createElement('div');
    frame.getBoundingClientRect = () => rect(200, 200, 400, 200);

    expect(() => createNativePrintTileExport({
      isReady: () => true,
      map: sourceMap,
      resolveLayers: () => [],
      resolvePrintFrame: () => frame,
    }, {
      output: { width: 4000, height: 2000 },
      regions: [
        { x: 0, y: 0, width: 2000, height: 2000 },
        { x: 2000, y: 0, width: 2000, height: 2000 },
      ],
      pixelsPerMillimetre: 10,
      symbolsVisible: false,
    } as Parameters<typeof createNativePrintTileExport>[1])).toThrow('pitch');
  });

  it('rejects multi-region jobs with independent visible symbol placement', () => {
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.getBoundingClientRect = () => rect(0, 0, 800, 600);
    const sourceMap = {
      getBearing: () => 0,
      getCanvas: () => sourceCanvas,
      getPitch: () => 0,
      getStyle: () => ({
        version: 8 as const,
        sources: {},
        layers: [{ id: 'labels', type: 'symbol' as const, layout: { 'text-field': '{name}' } }],
      }),
      getZoom: () => 10,
      unproject: () => ({ lng: 16.4, lat: 48.2 }),
    } as unknown as MapLibreMap;
    const frame = document.createElement('div');
    frame.getBoundingClientRect = () => rect(200, 200, 400, 200);

    expect(() => createNativePrintTileExport({
      isReady: () => true,
      map: sourceMap,
      resolveLayers: () => [],
      resolvePrintFrame: () => frame,
    }, {
      output: { width: 4000, height: 2000 },
      regions: [
        { x: 0, y: 0, width: 2000, height: 2000 },
        { x: 2000, y: 0, width: 2000, height: 2000 },
      ],
      pixelsPerMillimetre: 10,
      symbolsVisible: true,
    } as Parameters<typeof createNativePrintTileExport>[1])).toThrow('Turn off Show labels');
  });

  it('snapshots a multi-tile job and rejects every tile after source readiness changes', async () => {
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.getBoundingClientRect = () => rect(0, 0, 800, 600);
    let sourceZoom = 10;
    let sourceStyle = { version: 8 as const, name: 'initial', sources: {}, layers: [] };
    let isReady = true;
    const sourceMap = {
      getBearing: () => 0,
      getCanvas: () => sourceCanvas,
      getPitch: () => 0,
      getStyle: () => sourceStyle,
      getZoom: () => sourceZoom,
      unproject: ([x]: [number, number]) => ({ lng: x, lat: 48.2 }),
    } as unknown as MapLibreMap;
    const frame = document.createElement('div');
    frame.getBoundingClientRect = () => rect(200, 200, 400, 200);
    const layers: never[] = [];
    const renderer = createNativePrintTileExport({
      isReady: () => isReady,
      map: sourceMap,
      resolveLayers: () => layers,
      resolvePrintFrame: () => frame,
    }, {
        output: { width: 4000, height: 2000 },
        regions: [
          { x: 0, y: 0, width: 2000, height: 2000 },
          { x: 2000, y: 0, width: 2000, height: 2000 },
        ],
        pixelsPerMillimetre: 10,
        symbolsVisible: false,
      });

    sourceZoom = 15;
    sourceStyle = { version: 8 as const, name: 'changed', sources: {}, layers: [] };
    isReady = false;

    await expect(renderer({
      output: { width: 4000, height: 2000 },
      region: { x: 0, y: 0, width: 2000, height: 2000 },
    })).rejects.toThrow('source map changed');
  });
});
