import { afterEach, describe, expect, it, vi } from 'vitest';
import { planExportPreflight } from '../../src/export/preflight';
import { createPrintSizePng } from '../../src/export/printSizePng';

describe('print-size PNG composition', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
