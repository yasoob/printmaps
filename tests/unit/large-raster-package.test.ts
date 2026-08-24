import { strFromU8, unzipSync } from 'fflate';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createLargeRasterPackage,
  pickLargeRasterPackageFile,
  canStreamLargeRasterPackage,
  type LargeRasterWritable,
} from '../../src/export/largeRasterPackage';
import { planExportPreflight } from '../../src/export/preflight';

function packagePreflight() {
  return planExportPreflight({
    format: 'png',
    page: { widthMm: 25.4, heightMm: 25.4 },
    dpi: 100,
    attributions: ['© OpenStreetMap contributors'],
    basemap: 'raster',
    vectorOverlays: true,
    cancellationSupported: true,
    rasterDelivery: 'tile-package',
  }, {
    gpuMaxSidePx: 64,
    preferredTileSidePx: 64,
    tileOverlapPx: 4,
  });
}

function memoryWritable() {
  const chunks: Uint8Array[] = [];
  const writable: LargeRasterWritable = {
    write: vi.fn((chunk: Uint8Array) => { chunks.push(Uint8Array.from(chunk)); }),
    close: vi.fn(),
    abort: vi.fn(),
  };
  return { chunks, writable };
}

function installCanvasPngMock() {
  let encodedTile = 0;
  const drawImage = vi.fn();
  const fillText = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage,
    fillRect: vi.fn(),
    fillText,
    measureText: vi.fn(() => ({ width: 80 })),
    set fillStyle(_value: string) {},
    set font(_value: string) {},
    set globalAlpha(_value: number) {},
    set textBaseline(_value: CanvasTextBaseline) {},
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) => {
    encodedTile += 1;
    callback(new Blob([`png-${encodedTile}`], { type: type ?? 'image/png' }));
  });
  return { drawImage, fillText };
}

function joined(chunks: readonly Uint8Array[]): Uint8Array {
  const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

describe('large raster tile package', () => {
  afterEach(() => vi.restoreAllMocks());

  it('streams deterministic independently encoded tiles and an assembly manifest', async () => {
    const { drawImage, fillText } = installCanvasPngMock();
    const { chunks, writable } = memoryWritable();
    const preflight = packagePreflight();
    let completedRenders = 0;

    const result = await createLargeRasterPackage({
      preflight,
      writable,
      renderTile: async ({ region }) => {
        if (completedRenders > 0) expect(chunks.length).toBeGreaterThan(0);
        const surface = document.createElement('canvas');
        surface.width = region.width;
        surface.height = region.height;
        completedRenders += 1;
        return surface;
      },
    });

    const files = unzipSync(joined(chunks));
    expect(Object.keys(files)).toEqual([
      'tiles/tile-r000-c000.png',
      'tiles/tile-r000-c001.png',
      'tiles/tile-r001-c000.png',
      'tiles/tile-r001-c001.png',
      'manifest.json',
    ]);
    const manifest = JSON.parse(strFromU8(files['manifest.json'])) as Record<string, unknown>;
    expect(manifest).toMatchObject({
      format: 'print-map-tile-package-v1',
      assembly: { width: 100, height: 100, columns: 2, rows: 2 },
      attributionEmbeddedIn: 'tiles/tile-r001-c000.png',
    });
    expect((manifest.tiles as unknown[])).toHaveLength(4);
    expect(drawImage).toHaveBeenCalledTimes(4);
    expect(fillText).toHaveBeenCalledOnce();
    expect(writable.close).toHaveBeenCalledOnce();
    expect(writable.abort).not.toHaveBeenCalled();
    expect(result).toMatchObject({ width: 100, height: 100, tileCount: 4 });
    expect(result.bytesWritten).toBe(joined(chunks).length);
  });

  it('aborts the destination and releases the current tile when cancelled', async () => {
    installCanvasPngMock();
    const { writable } = memoryWritable();
    const controller = new AbortController();
    const tiles: HTMLCanvasElement[] = [];

    const exportPromise = createLargeRasterPackage({
      preflight: packagePreflight(),
      writable,
      signal: controller.signal,
      renderTile: async ({ region }) => {
        const surface = document.createElement('canvas');
        surface.width = region.width;
        surface.height = region.height;
        tiles.push(surface);
        controller.abort();
        return surface;
      },
    });

    await expect(exportPromise).rejects.toMatchObject({ name: 'AbortError' });
    expect(writable.abort).toHaveBeenCalledOnce();
    expect(writable.close).not.toHaveBeenCalled();
    expect(tiles[0]).toMatchObject({ width: 0, height: 0 });
  });

  it('aborts a partially written destination when final commit fails', async () => {
    installCanvasPngMock();
    const failure = new Error('disk full while closing');
    const { writable } = memoryWritable();
    vi.mocked(writable.close).mockRejectedValue(failure);

    await expect(createLargeRasterPackage({
      preflight: packagePreflight(),
      writable,
      renderTile: async ({ region }) => {
        const surface = document.createElement('canvas');
        surface.width = region.width;
        surface.height = region.height;
        return surface;
      },
    })).rejects.toBe(failure);

    expect(writable.abort).toHaveBeenCalledWith(failure);
  });

  it('opens the browser file picker immediately and returns its writable stream', async () => {
    const { writable } = memoryWritable();
    const createWritable = vi.fn().mockResolvedValue(writable);
    const picker = vi.fn().mockResolvedValue({ createWritable });
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: picker });

    const destination = pickLargeRasterPackageFile('My map.png');

    expect(canStreamLargeRasterPackage()).toBe(true);
    expect(picker).toHaveBeenCalledOnce();
    expect(picker).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: 'My-map.tiles.zip' }));
    await expect(destination).resolves.toBe(writable);
    expect(createWritable).toHaveBeenCalledOnce();
  });

  it('gives unsupported browsers an actionable fallback before rendering', async () => {
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined });

    expect(canStreamLargeRasterPackage()).toBe(false);
    await expect(pickLargeRasterPackageFile('map')).rejects.toThrow('Chrome or Edge');
  });
});
