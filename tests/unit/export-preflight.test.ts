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
      peakBytes: (3508 * 2480 * 4 * 3) + Math.ceil(3508 * 2480 * 4 * 1.05) + 256,
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

  it('plans an A1 300 DPI PDF with bounded raster memory instead of a full-page canvas', () => {
    const result = planExportPreflight(completeRequest({
      format: 'pdf',
      page: { widthMm: 841, heightMm: 594 },
    }));

    expect(result.safe).toBe(true);
    expect(result.dimensions).toMatchObject({ widthPx: 9933, heightPx: 7016 });
    expect(result.plan?.tiles.length).toBeGreaterThan(1);
    expect(result.estimates?.peakBytes).toBeLessThan(512 * 1024 * 1024);
  });

  it('offers bounded streaming PNG planning when one canvas exceeds memory', () => {
    const single = planExportPreflight(completeRequest({
      page: { widthMm: 1330, heightMm: 1330 },
    }));
    const packaged = planExportPreflight(completeRequest({
      page: { widthMm: 1330, heightMm: 1330 },
      rasterDelivery: 'streaming-png',
    }));

    expect(single.safe).toBe(false);
    expect(single.errors.map(({ code }) => code)).toContain('MEMORY_BUDGET_EXCEEDED');
    expect(packaged.safe).toBe(true);
    expect(packaged.delivery).toBe('streaming-png');
    expect(packaged.plan).toMatchObject({ mode: 'tiles', columns: 4, rows: 4 });
    expect(packaged.estimates?.peakBytes).toBeLessThan(512 * 1024 * 1024);
    expect(packaged.estimates?.encodedOutputBytes).toBeGreaterThan(512 * 1024 * 1024);
  });

  it('allows a streamed PNG beyond the ordinary page-side policy', () => {
    const packaged = planExportPreflight(completeRequest({
      page: { widthMm: 1400, heightMm: 210 },
      rasterDelivery: 'streaming-png',
    }));

    expect(packaged.safe).toBe(true);
    expect(packaged.errors.map(({ code }) => code)).not.toContain('PAGE_SIDE_LIMIT_EXCEEDED');
    expect(packaged.plan?.tiles.length).toBeGreaterThan(1);
  });

  it('retains a configurable streamed-PNG side limit', () => {
    const streamed = planExportPreflight(completeRequest({
      page: { widthMm: 1400, heightMm: 210 },
      rasterDelivery: 'streaming-png',
    }), { maxOutputSidePx: 10_000 });

    expect(streamed.safe).toBe(false);
    expect(streamed.errors.map(({ code }) => code)).toContain('OUTPUT_SIDE_LIMIT_EXCEEDED');
  });

  it('counts the full-width streaming strip in the memory budget', () => {
    const streamed = planExportPreflight(completeRequest({
      page: { widthMm: 10_000, heightMm: 100 },
      dpi: 254,
      rasterDelivery: 'streaming-png',
    }), { memoryBudgetBytes: 60 * 1024 * 1024 });

    expect(streamed.safe).toBe(false);
    expect(streamed.errors.map(({ code }) => code)).toContain('MEMORY_BUDGET_EXCEEDED');
    expect(streamed.estimates?.peakBytes).toBeGreaterThan(60 * 1024 * 1024);
  });

  it('validates the actual streamed-region count rather than the coarser square grid', () => {
    const streamed = planExportPreflight(completeRequest({
      page: { widthMm: 10_000, heightMm: 10_000 },
      dpi: 254,
      rasterDelivery: 'streaming-png',
    }));

    expect(streamed.safe).toBe(false);
    expect(streamed.errors.map(({ code }) => code)).toContain('TILE_COUNT_LIMIT_EXCEEDED');
  });

  it('does not impose the removed ZIP 4 GiB limit on a streamed PNG', () => {
    const streamed = planExportPreflight(completeRequest({
      page: { widthMm: 3000, heightMm: 3000 },
      rasterDelivery: 'streaming-png',
    }));

    expect(streamed.safe).toBe(true);
    expect(streamed.errors.map(({ code }) => code)).not.toContain('PACKAGE_SIZE_LIMIT_EXCEEDED');
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
    ['an output too small for useful map content and attribution', completeRequest({ page: { widthMm: 1, heightMm: 1 } }), {}, 'RASTER_OUTPUT_TOO_SMALL'],
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


});

describe('export preflight readiness', () => {
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

describe('export preflight allocation safety', () => {
  it('includes conservative tile-plan record storage in peak memory', () => {
    const result = planExportPreflight(completeRequest({
      page: { widthMm: 100, heightMm: 100 },
      dpi: 254,
    }), {
      gpuMaxSidePx: 512,
      preferredTileSidePx: 512,
      tileOverlapPx: 16,
      memoryBudgetBytes: 256 * 1024 * 1024,
    });
    const rgbaBytes = 1000 * 1000 * 4;
    const peakTileRgbaBytes = 512 * 512 * 4 * 2;
    const encodedOutputBytes = Math.ceil(rgbaBytes * 1.05);

    expect(result.plan?.tiles).toHaveLength(9);
    expect(result.estimates?.peakBytes)
      .toBe(rgbaBytes + peakTileRgbaBytes + encodedOutputBytes + 9 * 256);
  });

  it('enforces a hard tile-plan ceiling before a million-record plan can be allocated', () => {
    const originalPush = Array.prototype.push;
    Array.prototype.push = function guardedPush(this: unknown[], ...items: unknown[]) {
      const isTileRecord = items.some((item) => (
        typeof item === 'object'
        && item !== null
        && 'renderWidth' in item
        && 'cropX' in item
      ));
      if (isTileRecord) throw new Error('Tile plan allocation was attempted.');
      return Reflect.apply(originalPush, this, items);
    };

    try {
      const result = planExportPreflight(completeRequest({
        page: { widthMm: 254, heightMm: 254 },
        dpi: 100,
      }), {
        gpuMaxSidePx: 1,
        preferredTileSidePx: 1,
        tileOverlapPx: 0,
        maxTileCount: 1_000_000,
      });

      expect(result.safe).toBe(false);
      expect(result.plan).toBeNull();
      expect(result.errors.map(({ code }) => code)).toContain('TILE_COUNT_LIMIT_EXCEEDED');
    } finally {
      Array.prototype.push = originalPush;
    }
  });
});
