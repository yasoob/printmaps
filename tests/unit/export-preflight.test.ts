import {
  millimetresToPixels,
  planExportPreflight,
  type ExportPreflightRequest,
} from '../../src/export/preflight';

const completeRequest = (overrides: Partial<ExportPreflightRequest> = {}): ExportPreflightRequest => ({
  format: 'png',
  page: { widthMm: 297, heightMm: 210 },
  dpi: 300,
  attributions: ['© OpenStreetMap contributors'],
  basemap: 'raster',
  vectorOverlays: true,
  missing: {},
  rasterLayers: [],
  cancellationSupported: true,
  ...overrides,
});

describe('export preflight planning', () => {
  it('converts millimetres to pixels with an explicit rounding rule', () => {
    expect(millimetresToPixels(210, 300, 'round')).toBe(2480);
    expect(millimetresToPixels(210, 300, 'floor')).toBe(2480);
    expect(millimetresToPixels(210, 300, 'ceil')).toBe(2481);
    expect(() => millimetresToPixels(0, 300, 'round')).toThrow(RangeError);
  });

  it('reports exact raster dimensions, memory estimates, and output truth before rendering', () => {
    const result = planExportPreflight(completeRequest());

    expect(result.safe).toBe(true);
    expect(result.dimensions).toEqual({
      widthPx: 3508,
      heightPx: 2480,
      pixelCount: 3508 * 2480,
      rounding: 'round',
    });
    expect(result.estimates).toEqual({
      rgbaBytes: 3508 * 2480 * 4,
      peakTileRgbaBytes: 3508 * 2480 * 4 * 2,
      encodedOutputBytes: Math.ceil(3508 * 2480 * 4 * 1.05),
      peakBytes: (3508 * 2480 * 4 * 3) + Math.ceil(3508 * 2480 * 4 * 1.05),
    });
    expect(result.plan).toMatchObject({ mode: 'single', columns: 1, rows: 1, overlapPx: 16 });
    expect(result.plan?.tiles).toHaveLength(1);
    expect(result.warnings.map(({ code }) => code)).toEqual(expect.arrayContaining([
      'RASTER_BASEMAP',
      'OVERLAYS_RASTERIZED',
      'RGB_COLOR_SPACE',
    ]));
    expect(result.errors).toEqual([]);
  });

  it('plans overlapping strips or tiles whose render surfaces stay inside the GPU limit', () => {
    const limits = {
      gpuMaxSidePx: 512,
      preferredTileSidePx: 512,
      tileOverlapPx: 16,
      memoryBudgetBytes: 256 * 1024 * 1024,
    };

    const tiled = planExportPreflight(completeRequest({
      page: { widthMm: 100, heightMm: 100 },
      dpi: 254,
    }), limits);
    expect(tiled.safe).toBe(true);
    expect(tiled.plan).toMatchObject({ mode: 'tiles', columns: 3, rows: 3, overlapPx: 16 });
    expect(tiled.plan?.tiles).toHaveLength(9);
    expect(tiled.plan?.tiles.every((tile) => tile.renderWidth <= 512 && tile.renderHeight <= 512)).toBe(true);
    expect(tiled.plan?.tiles[4]).toMatchObject({
      x: 480,
      y: 480,
      width: 480,
      height: 480,
      renderX: 464,
      renderY: 464,
      renderWidth: 512,
      renderHeight: 512,
      cropX: 16,
      cropY: 16,
    });
    expect(tiled.cancellation).toEqual({
      required: true,
      suitable: true,
      checkpoint: 'tile-boundary',
    });
    expect(tiled.warnings.map(({ code }) => code)).toContain('CANCELLATION_AT_TILE_BOUNDARIES');

    const stripped = planExportPreflight(completeRequest({
      page: { widthMm: 40, heightMm: 100 },
      dpi: 254,
    }), limits);
    expect(stripped.plan).toMatchObject({
      mode: 'strips',
      stripDirection: 'horizontal',
      columns: 1,
      rows: 3,
    });
  });

  it.each([
    ['non-finite page dimensions', completeRequest({ page: { widthMm: NaN, heightMm: 210 } }), {}, 'INVALID_PAGE_DIMENSIONS'],
    ['DPI outside the configured range', completeRequest({ dpi: 1200 }), {}, 'DPI_OUT_OF_RANGE'],
    ['a page side beyond the configured range', completeRequest({ page: { widthMm: 1331, heightMm: 210 } }), {}, 'PAGE_SIDE_LIMIT_EXCEEDED'],
    ['an output side beyond the configured range', completeRequest({ page: { widthMm: 100, heightMm: 100 }, dpi: 254 }), { maxOutputSidePx: 999 }, 'OUTPUT_SIDE_LIMIT_EXCEEDED'],
    ['a pixel count beyond the configured range', completeRequest({ page: { widthMm: 100, heightMm: 100 }, dpi: 254 }), { maxPixelCount: 999_999 }, 'PIXEL_COUNT_LIMIT_EXCEEDED'],
    ['an impossible overlap/GPU configuration', completeRequest(), { gpuMaxSidePx: 32, preferredTileSidePx: 32, tileOverlapPx: 16 }, 'INVALID_TILE_CONFIGURATION'],
    ['a tile count beyond the configured range', completeRequest({ page: { widthMm: 100, heightMm: 100 }, dpi: 254 }), { gpuMaxSidePx: 512, preferredTileSidePx: 512, tileOverlapPx: 16, maxTileCount: 8 }, 'TILE_COUNT_LIMIT_EXCEEDED'],
    ['the memory budget', completeRequest(), { memoryBudgetBytes: 1024 }, 'MEMORY_BUDGET_EXCEEDED'],
  ])('refuses unsafe jobs exceeding %s before returning an allocation plan', (_name, request, limits, code) => {
    const result = planExportPreflight(request, limits);

    expect(result.safe).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.errors.map((issue) => issue.code)).toContain(code);
  });

  it('blocks incomplete or non-cancellable tiled jobs with named readiness errors', () => {
    const result = planExportPreflight(completeRequest({
      page: { widthMm: 100, heightMm: 100 },
      dpi: 254,
      attributions: ['  '],
      missing: {
        assets: ['marker-logo'],
        tiles: ['12/2200/1400'],
        fonts: ['Inter Bold'],
      },
      cancellationSupported: false,
    }), {
      gpuMaxSidePx: 512,
      preferredTileSidePx: 512,
      tileOverlapPx: 16,
      memoryBudgetBytes: 256 * 1024 * 1024,
    });

    expect(result.safe).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.errors.map(({ code }) => code)).toEqual(expect.arrayContaining([
      'ATTRIBUTION_REQUIRED',
      'MISSING_ASSETS',
      'MISSING_TILES',
      'MISSING_FONTS',
      'CANCELLATION_UNAVAILABLE',
    ]));
    expect(result.cancellation).toEqual({
      required: true,
      suitable: false,
      checkpoint: 'unavailable',
    });
  });

  it('reports raster effective PPI and preserves honest PDF/layered-SVG semantics', () => {
    const layered = planExportPreflight(completeRequest({
      format: 'layered-svg',
      page: { widthMm: 100, heightMm: 100 },
      dpi: 300,
      attributions: [' © OpenStreetMap contributors ', '© OpenStreetMap contributors'],
      rasterLayers: [{
        id: 'aerial-photo',
        pixelWidth: 1000,
        pixelHeight: 1000,
        placedWidthMm: 100,
        placedHeightMm: 100,
      }],
    }), { memoryBudgetBytes: 256 * 1024 * 1024 });

    expect(layered.safe).toBe(true);
    expect(layered.effectivePpi[0]).toMatchObject({ id: 'aerial-photo' });
    expect(layered.effectivePpi[0].ppi).toBeCloseTo(254);
    expect(layered.attributions).toEqual(['© OpenStreetMap contributors']);
    expect(layered.warnings.map(({ code }) => code)).toEqual(expect.arrayContaining([
      'RASTER_BASEMAP',
      'VECTOR_OVERLAYS_REMAIN_VECTOR',
      'LAYERED_SVG_CONTAINS_RASTER',
      'EFFECTIVE_PPI_BELOW_TARGET',
    ]));

    const pdf = planExportPreflight(completeRequest({ format: 'pdf' }));
    expect(pdf.warnings.map(({ code }) => code)).toEqual(expect.arrayContaining([
      'VECTOR_OVERLAYS_REMAIN_VECTOR',
      'NOT_PDF_X',
    ]));
  });

  it('blocks raster layers below the minimum effective PPI', () => {
    const result = planExportPreflight(completeRequest({
      rasterLayers: [{
        id: 'tiny-image',
        pixelWidth: 100,
        pixelHeight: 100,
        placedWidthMm: 100,
        placedHeightMm: 100,
      }],
    }));

    expect(result.safe).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.effectivePpi[0].ppi).toBeCloseTo(25.4);
    expect(result.errors.map(({ code }) => code)).toContain('EFFECTIVE_PPI_TOO_LOW');
  });

  it('does not claim a raster basemap when an export has vector overlays only', () => {
    const result = planExportPreflight(completeRequest({
      format: 'layered-svg',
      basemap: 'none',
      attributions: ['Project-authored data'],
    }));

    expect(result.safe).toBe(true);
    expect(result.warnings.map(({ code }) => code)).not.toContain('RASTER_BASEMAP');
    expect(result.warnings.map(({ code }) => code)).not.toContain('LAYERED_SVG_CONTAINS_RASTER');
    expect(result.warnings.find(({ code }) => code === 'VECTOR_OVERLAYS_REMAIN_VECTOR')?.message)
      .toBe('User overlays remain vector in layered SVG output.');
  });
});
