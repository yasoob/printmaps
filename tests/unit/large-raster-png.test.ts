import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canStreamLargeRasterPng,
  createLargeRasterPng,
  createLargeRasterPngRegions,
  pickLargeRasterPngFile,
  type LargeRasterWritable,
} from '../../src/export/largeRasterPng';
import { planExportPreflight } from '../../src/export/preflight';

function streamingPreflight() {
  return planExportPreflight({
    format: 'png',
    page: { widthMm: 25.4, heightMm: 25.4 },
    dpi: 100,
    attributions: ['© OpenStreetMap contributors'],
    basemap: 'raster',
    vectorOverlays: true,
    cancellationSupported: true,
    rasterDelivery: 'streaming-png',
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

function joined(chunks: readonly Uint8Array[]): Uint8Array {
  const output = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function crc32(parts: readonly Uint8Array[]): number {
  let crc = 0xFF_FF_FF_FF;
  for (const bytes of parts) {
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xED_B8_83_20 & -(crc & 1));
    }
  }
  return (crc ^ 0xFF_FF_FF_FF) >>> 0;
}

function decodedPngChunk(type: string, data: Uint8Array) {
  switch (type) {
    case 'IHDR': {
      const header = new DataView(data.buffer, data.byteOffset, data.byteLength);
      return { width: header.getUint32(0), height: header.getUint32(4) };
    }
    case 'pHYs': {
      const physical = new DataView(data.buffer, data.byteOffset, data.byteLength);
      return { physicalDensity: physical.getUint32(0) };
    }
    case 'IDAT': {
      return { idat: data };
    }
    default: {
      return {};
    }
  }
}

function pngDetails(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const idat: Uint8Array[] = [];
  let width = 0;
  let height = 0;
  let physicalDensity: number | undefined;
  let physicalDensityY: number | undefined;
  let physicalUnit: number | undefined;
  let physicalCrcValid: boolean | undefined;
  const chunkTypes: string[] = [];
  let offset = 8;
  while (offset < bytes.length) {
    const length = view.getUint32(offset);
    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const type = decoder.decode(typeBytes);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    chunkTypes.push(type);
    const decoded = decodedPngChunk(type, data);
    if (decoded.width !== undefined) width = decoded.width;
    if (decoded.height !== undefined) height = decoded.height;
    if (decoded.physicalDensity !== undefined) {
      physicalDensity = decoded.physicalDensity;
      const physical = new DataView(data.buffer, data.byteOffset, data.byteLength);
      physicalDensityY = physical.getUint32(4);
      physicalUnit = physical.getUint8(8);
      physicalCrcValid = view.getUint32(offset + 8 + length) === crc32([typeBytes, data]);
    }
    if (decoded.idat) idat.push(decoded.idat);
    offset += length + 12;
  }
  return { width, height, idat, physicalDensity, physicalDensityY, physicalUnit, physicalCrcValid, chunkTypes };
}

async function inflate(chunks: readonly Uint8Array[]): Promise<Uint8Array> {
  const stream = new ReadableStream<BufferSource>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(Uint8Array.from(chunk));
      controller.close();
    },
  }).pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function installPixelCanvasMock() {
  const fillText = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext() {
    return {
      fillRect: vi.fn(),
      fillText,
      measureText: vi.fn(() => ({ width: 80 })),
      getImageData: vi.fn((_x: number, _y: number, width: number, height: number) => {
        const data = new Uint8ClampedArray(width * height * 4);
        for (let index = 0; index < data.length; index += 4) {
          data[index] = 20;
          data[index + 1] = 40;
          data[index + 2] = 60;
          data[index + 3] = 255;
        }
        return { data, width, height } as ImageData;
      }),
      set fillStyle(_value: string) {},
      set font(_value: string) {},
      set globalAlpha(_value: number) {},
      set textBaseline(_value: CanvasTextBaseline) {},
    } as unknown as CanvasRenderingContext2D;
  });
  return { fillText };
}

function noop() {}

describe('large streamed PNG', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders bounded regions but writes one valid target-size PNG', async () => {
    const { fillText } = installPixelCanvasMock();
    const { chunks, writable } = memoryWritable();
    let renders = 0;

    const result = await createLargeRasterPng({
      preflight: streamingPreflight(),
      writable,
      renderTile: async ({ region }) => {
        expect(chunks.length).toBeGreaterThan(0);
        const surface = document.createElement('canvas');
        surface.width = region.width;
        surface.height = region.height;
        renders += 1;
        return surface;
      },
    });

    const bytes = joined(chunks);
    expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const png = pngDetails(bytes);
    expect(png).toMatchObject({ width: 100, height: 100 });
    const scanlines = await inflate(png.idat);
    expect(scanlines).toHaveLength(100 * (1 + 100 * 4));
    expect([...new Set(Array.from({ length: 100 }, (_, row) => scanlines[row * 401]))]).toEqual([0]);
    expect(fillText).toHaveBeenCalledOnce();
    expect(renders).toBeGreaterThan(1);
    expect(writable.close).toHaveBeenCalledOnce();
    expect(writable.abort).not.toHaveBeenCalled();
    expect(result).toMatchObject({ width: 100, height: 100, bytesWritten: bytes.length });
  });

  it('embeds 300 DPI metadata in the streamed PNG', async () => {
    installPixelCanvasMock();
    const { chunks, writable } = memoryWritable();

    await createLargeRasterPng({
      preflight: streamingPreflight(),
      writable,
      renderTile: async ({ region }) => {
        const surface = document.createElement('canvas');
        surface.width = region.width;
        surface.height = region.height;
        return surface;
      },
    });

    const png = pngDetails(joined(chunks));
    expect(png.physicalDensity).toBe(11_811);
    expect(png.physicalDensityY).toBe(11_811);
    expect(png.physicalUnit).toBe(1);
    expect(png.physicalCrcValid).toBe(true);
    expect(png.chunkTypes.slice(0, 3)).toEqual(['IHDR', 'pHYs', 'IDAT']);
    expect(png.chunkTypes.filter((type) => type === 'pHYs')).toHaveLength(1);
  });

  it('balances strip heights so the final strip is not a tiny remainder', () => {
    const heights = [...new Set(createLargeRasterPngRegions(streamingPreflight())
      .map(({ destination }) => destination.height))];

    expect(heights).toEqual([50]);
  });

  it('aborts the destination when encoder initialization fails', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const { writable } = memoryWritable();

    await expect(createLargeRasterPng({
      preflight: streamingPreflight(),
      writable,
      renderTile: vi.fn(),
    })).rejects.toThrow('render PNG attribution');

    expect(writable.abort).toHaveBeenCalledOnce();
    expect(writable.close).not.toHaveBeenCalled();
  });

  it('aborts the destination when encoder planning rejects the preflight', async () => {
    const { writable } = memoryWritable();
    const invalid = { ...streamingPreflight(), delivery: 'single-png' as const };

    await expect(createLargeRasterPng({
      preflight: invalid,
      writable,
      renderTile: vi.fn(),
    })).rejects.toThrow('preflight must pass');

    expect(writable.abort).toHaveBeenCalledOnce();
  });

  it('aborts the destination and releases the current tile when cancelled', async () => {
    installPixelCanvasMock();
    const { writable } = memoryWritable();
    const controller = new AbortController();
    const tiles: HTMLCanvasElement[] = [];

    const exportPromise = createLargeRasterPng({
      preflight: streamingPreflight(),
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

  it('aborts instead of reporting success when cancellation arrives during final file commit', async () => {
    installPixelCanvasMock();
    const { writable } = memoryWritable();
    const controller = new AbortController();
    let releaseClose = noop;
    let markCloseStarted = noop;
    const closeStarted = new Promise<void>((resolve) => { markCloseStarted = resolve; });
    vi.mocked(writable.close).mockImplementation(() => new Promise<void>((resolve) => {
      releaseClose = resolve;
      markCloseStarted();
    }));

    const exportPromise = createLargeRasterPng({
      preflight: streamingPreflight(),
      writable,
      signal: controller.signal,
      renderTile: async ({ region }) => {
        const surface = document.createElement('canvas');
        surface.width = region.width;
        surface.height = region.height;
        return surface;
      },
    });
    await closeStarted;
    controller.abort();
    releaseClose();

    await expect(exportPromise).rejects.toMatchObject({ name: 'AbortError' });
    expect(writable.abort).toHaveBeenCalledOnce();
  });

  it('aborts a partially written PNG when final file commit fails', async () => {
    installPixelCanvasMock();
    const failure = new Error('disk full while closing');
    const { writable } = memoryWritable();
    vi.mocked(writable.close).mockRejectedValue(failure);

    await expect(createLargeRasterPng({
      preflight: streamingPreflight(),
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

  it('opens a PNG destination before rendering', async () => {
    const { writable } = memoryWritable();
    const createWritable = vi.fn().mockResolvedValue(writable);
    const picker = vi.fn().mockResolvedValue({ createWritable });
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: picker });

    const destination = pickLargeRasterPngFile('My map.zip');

    expect(canStreamLargeRasterPng()).toBe(true);
    expect(picker).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: 'My-map.png' }));
    await expect(destination).resolves.toBe(writable);
  });

  it('gives unsupported browsers an actionable fallback before rendering', async () => {
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined });

    expect(canStreamLargeRasterPng()).toBe(false);
    await expect(pickLargeRasterPngFile('map')).rejects.toThrow('Chrome or Edge');
  });
});
