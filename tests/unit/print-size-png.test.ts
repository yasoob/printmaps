import { afterEach, describe, expect, it, vi } from 'vitest';
import { planExportPreflight } from '../../src/export/preflight';
import { createPrintSizePng } from '../../src/export/printSizePng';

async function verifyNativeTileComposition() {
  const drawImage = vi.fn();
  const fillRect = vi.fn();
  const fillText = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage,
    fillRect,
    fillText,
    measureText: vi.fn(() => ({ width: 80 })),
    set fillStyle(_value: string) {},
    set font(_value: string) {},
    set globalAlpha(_value: number) {},
    set textBaseline(_value: CanvasTextBaseline) {},
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
    callback(new Blob(['png'], { type: 'image/png' }));
  });
  const preflight = planExportPreflight({
    format: 'png',
    page: { widthMm: 25.4, heightMm: 25.4 },
    dpi: 100,
    attributions: ['© OpenStreetMap contributors'],
    basemap: 'raster',
    vectorOverlays: true,
    cancellationSupported: true,
  }, {
    gpuMaxSidePx: 64,
    preferredTileSidePx: 64,
    tileOverlapPx: 4,
  });
  const renderedRegions: Array<{ x: number; y: number; width: number; height: number }> = [];
  const stages: string[] = [];

  const result = await createPrintSizePng({
    onStage: (stage) => { stages.push(stage); },
    preflight,
    renderTile: ({ region }) => {
      renderedRegions.push(region);
      const surface = document.createElement('canvas');
      surface.width = region.width;
      surface.height = region.height;
      return Promise.resolve(surface);
    },
  });

  expect(result).toMatchObject({ width: 100, height: 100 });
  expect(stages).toEqual([
    'rendering', 'composing',
    'rendering', 'composing',
    'rendering', 'composing',
    'rendering', 'composing',
    'encoding',
  ]);
  expect(renderedRegions).toEqual(preflight.plan?.tiles.map((tile) => ({
    x: tile.renderX,
    y: tile.renderY,
    width: tile.renderWidth,
    height: tile.renderHeight,
  })));
  expect(drawImage).toHaveBeenCalledTimes(4);
  expect(drawImage.mock.calls.every((call) => {
    const sourceX = call[1] as number;
    const sourceY = call[2] as number;
    const sourceWidth = call[3] as number;
    const sourceHeight = call[4] as number;
    const destinationWidth = call[7] as number;
    const destinationHeight = call[8] as number;
    return sourceX >= 0
      && sourceY >= 0
      && sourceWidth === destinationWidth
      && sourceHeight === destinationHeight;
  })).toBe(true);
  expect(fillRect).toHaveBeenCalledOnce();
  expect(fillText).toHaveBeenCalledWith(
    '© OpenStreetMap contributors',
    expect.any(Number),
    expect.any(Number),
    expect.any(Number),
  );
}

describe('print-size PNG composition', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('composes native target-resolution tiles without resampling a browser preview', verifyNativeTileComposition);

  it('composes the preflight tile plan and reports monotonic progress', async () => {
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob(['png'], { type: 'image/png' }));
    });
    const source = document.createElement('canvas');
    source.width = 50;
    source.height = 50;
    const preflight = planExportPreflight({
      format: 'png',
      page: { widthMm: 25.4, heightMm: 25.4 },
      dpi: 100,
      attributions: ['© OpenStreetMap contributors'],
      basemap: 'raster',
      vectorOverlays: true,
      cancellationSupported: true,
    }, {
      gpuMaxSidePx: 64,
      preferredTileSidePx: 64,
      tileOverlapPx: 4,
    });
    const progress: number[] = [];

    const result = await createPrintSizePng({
      source: { blob: new Blob(['source']), width: 50, height: 50, surface: source },
      preflight,
      onProgress: ({ fraction }) => {
        progress.push(fraction);
      },
    });

    expect(result).toMatchObject({ width: 100, height: 100 });
    expect(progress).toEqual([0.25, 0.5, 0.75, 1]);
    expect(drawImage).toHaveBeenCalled();
  });

  it('rejects and releases the output when cancelled during PNG encoding', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    let finishEncoding: BlobCallback | undefined;
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      finishEncoding = callback;
    });
    const source = document.createElement('canvas');
    source.width = 50;
    source.height = 50;
    const created: HTMLCanvasElement[] = [];
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName, options);
      if (element instanceof HTMLCanvasElement) created.push(element);
      return element;
    });
    const preflight = planExportPreflight({
      format: 'png',
      page: { widthMm: 25.4, heightMm: 25.4 },
      dpi: 100,
      attributions: ['© OpenStreetMap contributors'],
      basemap: 'raster',
      vectorOverlays: true,
      cancellationSupported: true,
    }, {
      gpuMaxSidePx: 64,
      preferredTileSidePx: 64,
      tileOverlapPx: 4,
    });
    const controller = new AbortController();

    const result = createPrintSizePng({
      source: { blob: new Blob(['source']), width: 50, height: 50, surface: source },
      preflight,
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(finishEncoding).toBeDefined());

    controller.abort();
    finishEncoding?.(new Blob(['png'], { type: 'image/png' }));

    await expect(result).rejects.toMatchObject({
      name: 'AbortError',
      message: 'Print-size PNG export was cancelled.',
    });
    expect(created[0]).toMatchObject({ width: 0, height: 0 });
  });

  it('releases the output allocation when cancellation stops a tiled job', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob');
    const source = document.createElement('canvas');
    source.width = 50;
    source.height = 50;
    const created: HTMLCanvasElement[] = [];
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName, options);
      if (element instanceof HTMLCanvasElement) created.push(element);
      return element;
    });
    const preflight = planExportPreflight({
      format: 'png',
      page: { widthMm: 25.4, heightMm: 25.4 },
      dpi: 100,
      attributions: ['© OpenStreetMap contributors'],
      basemap: 'raster',
      vectorOverlays: true,
      cancellationSupported: true,
    }, {
      gpuMaxSidePx: 64,
      preferredTileSidePx: 64,
      tileOverlapPx: 4,
    });
    const controller = new AbortController();

    const result = createPrintSizePng({
      source: { blob: new Blob(['source']), width: 50, height: 50, surface: source },
      preflight,
      signal: controller.signal,
      onProgress: () => controller.abort(),
    });

    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(created[0]).toMatchObject({ width: 0, height: 0 });
    expect(toBlob).not.toHaveBeenCalled();
  });

  it('releases a native tile when a composing-stage observer fails', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    const tile = document.createElement('canvas');
    tile.width = 100;
    tile.height = 100;
    const preflight = planExportPreflight({
      format: 'png',
      page: { widthMm: 25.4, heightMm: 25.4 },
      dpi: 100,
      attributions: ['© OpenStreetMap contributors'],
      basemap: 'raster',
      vectorOverlays: true,
      cancellationSupported: true,
    });

    await expect(createPrintSizePng({
      onStage: (stage) => {
        if (stage === 'composing') throw new Error('Stage observer failed.');
      },
      preflight,
      renderTile: () => Promise.resolve(tile),
    })).rejects.toThrow('Stage observer failed.');

    expect(tile).toMatchObject({ width: 0, height: 0 });
  });

  it('releases the output allocation when the browser refuses its drawing context', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const source = document.createElement('canvas');
    source.width = 50;
    source.height = 50;
    const created: HTMLCanvasElement[] = [];
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName, options);
      if (element instanceof HTMLCanvasElement) created.push(element);
      return element;
    });
    const preflight = planExportPreflight({
      format: 'png',
      page: { widthMm: 25.4, heightMm: 25.4 },
      dpi: 100,
      attributions: ['© OpenStreetMap contributors'],
      basemap: 'raster',
      vectorOverlays: true,
      cancellationSupported: true,
    });

    await expect(createPrintSizePng({
      source: { blob: new Blob(['source']), width: 50, height: 50, surface: source },
      preflight,
    })).rejects.toThrow('composition is unavailable');
    expect(created[0]).toMatchObject({ width: 0, height: 0 });
  });
});
