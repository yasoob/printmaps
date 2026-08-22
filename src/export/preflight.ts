export type PixelRounding = 'round' | 'floor' | 'ceil';
export type ExportFormat = 'png' | 'pdf' | 'layered-svg';
export type BasemapMode = 'raster' | 'none';

export type RasterLayerResolution = {
  id: string;
  pixelWidth: number;
  pixelHeight: number;
  placedWidthMm?: number;
  placedHeightMm?: number;
};

export type ExportPreflightRequest = {
  format: ExportFormat;
  page: { widthMm: number; heightMm: number };
  dpi: number;
  attributions: readonly string[];
  basemap: BasemapMode;
  vectorOverlays: boolean;
  missing?: {
    assets?: readonly string[];
    tiles?: readonly string[];
    fonts?: readonly string[];
  };
  rasterLayers?: readonly RasterLayerResolution[];
  cancellationSupported: boolean;
};

export type ExportPreflightLimits = {
  minDpi: number;
  maxDpi: number;
  minPageSideMm: number;
  maxPageSideMm: number;
  maxOutputSidePx: number;
  maxPixelCount: number;
  memoryBudgetBytes: number;
  gpuMaxSidePx: number;
  preferredTileSidePx: number;
  tileOverlapPx: number;
  tileBufferCount: number;
  maxTileCount: number;
  minEffectivePpi: number;
  rounding: PixelRounding;
};

export const DEFAULT_EXPORT_PREFLIGHT_LIMITS: Readonly<ExportPreflightLimits> = Object.freeze({
  minDpi: 36,
  maxDpi: 600,
  minPageSideMm: 1,
  maxPageSideMm: 1330,
  maxOutputSidePx: 100_000,
  maxPixelCount: 250_000_000,
  memoryBudgetBytes: 512 * 1024 * 1024,
  gpuMaxSidePx: 4096,
  preferredTileSidePx: 4096,
  tileOverlapPx: 16,
  tileBufferCount: 2,
  maxTileCount: 4096,
  minEffectivePpi: 150,
  rounding: 'round',
});

export type ExportPreflightIssue = {
  code: string;
  message: string;
  details?: readonly string[];
};

export type ExportTile = {
  index: number;
  column: number;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
  renderX: number;
  renderY: number;
  renderWidth: number;
  renderHeight: number;
  cropX: number;
  cropY: number;
};

export type ExportTilePlan = {
  mode: 'single' | 'strips' | 'tiles';
  stripDirection: 'horizontal' | 'vertical' | null;
  columns: number;
  rows: number;
  overlapPx: number;
  tiles: readonly ExportTile[];
};

export type ExportPreflightResult = {
  safe: boolean;
  format: ExportFormat;
  dimensions: {
    widthPx: number;
    heightPx: number;
    pixelCount: number;
    rounding: PixelRounding;
  } | null;
  estimates: {
    rgbaBytes: number;
    peakTileRgbaBytes: number;
    encodedOutputBytes: number;
    peakBytes: number;
  } | null;
  plan: ExportTilePlan | null;
  effectivePpi: readonly { id: string; ppi: number }[];
  attributions: readonly string[];
  cancellation: {
    required: boolean;
    suitable: boolean;
    checkpoint: 'not-required' | 'tile-boundary' | 'unavailable';
  };
  warnings: readonly ExportPreflightIssue[];
  errors: readonly ExportPreflightIssue[];
};

export function millimetresToPixels(
  millimetres: number,
  dpi: number,
  rounding: PixelRounding,
): number {
  if (!Number.isFinite(millimetres) || millimetres <= 0 || !Number.isFinite(dpi) || dpi <= 0) {
    throw new RangeError('Millimetres and DPI must be positive finite numbers.');
  }

  const exactPixels = millimetres * dpi / 25.4;
  if (rounding === 'floor') return Math.floor(exactPixels);
  if (rounding === 'ceil') return Math.ceil(exactPixels);
  return Math.round(exactPixels);
}

function estimatedOutputBytes(format: ExportFormat, rgbaBytes: number): number {
  if (format === 'pdf') return Math.ceil(rgbaBytes * 1.05 + 1024 * 1024);
  if (format === 'layered-svg') return Math.ceil(rgbaBytes * 1.4 + 256 * 1024);
  return Math.ceil(rgbaBytes * 1.05);
}

function outputTruthWarnings(request: ExportPreflightRequest): ExportPreflightIssue[] {
  const warnings: ExportPreflightIssue[] = [{
    code: 'RGB_COLOR_SPACE',
    message: 'Export uses RGB color and is not a press-certified CMYK workflow.',
  }];
  if (request.basemap === 'raster') {
    warnings.push({
      code: 'RASTER_BASEMAP',
      message: 'The basemap is raster content, including in PDF and layered SVG output.',
    });
  }
  if (request.vectorOverlays) {
    warnings.push(request.format === 'png' ? {
      code: 'OVERLAYS_RASTERIZED',
      message: 'Vector overlays are rasterized in PNG output.',
    } : {
      code: 'VECTOR_OVERLAYS_REMAIN_VECTOR',
      message: `User overlays remain vector in ${request.format === 'pdf' ? 'PDF' : 'layered SVG'} output.`,
    });
  }
  if (request.format === 'pdf') {
    warnings.push({ code: 'NOT_PDF_X', message: 'PDF output is not PDF/X or press-certified.' });
  }
  if (request.format === 'layered-svg' && request.basemap === 'raster') {
    warnings.push({
      code: 'LAYERED_SVG_CONTAINS_RASTER',
      message: 'Layered SVG is not fully vector because its basemap is embedded raster content.',
    });
  }
  return warnings;
}

function createTilePlan(
  widthPx: number,
  heightPx: number,
  limits: ExportPreflightLimits,
): ExportTilePlan {
  const renderSidePx = Math.min(limits.preferredTileSidePx, limits.gpuMaxSidePx);
  const isSingle = widthPx <= renderSidePx && heightPx <= renderSidePx;
  const contentSidePx = isSingle ? renderSidePx : renderSidePx - limits.tileOverlapPx * 2;
  const columns = isSingle ? 1 : Math.ceil(widthPx / contentSidePx);
  const rows = isSingle ? 1 : Math.ceil(heightPx / contentSidePx);
  const tiles: ExportTile[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = column * contentSidePx;
      const y = row * contentSidePx;
      const width = Math.min(contentSidePx, widthPx - x);
      const height = Math.min(contentSidePx, heightPx - y);
      const renderX = Math.max(0, x - limits.tileOverlapPx);
      const renderY = Math.max(0, y - limits.tileOverlapPx);
      const renderRight = Math.min(widthPx, x + width + limits.tileOverlapPx);
      const renderBottom = Math.min(heightPx, y + height + limits.tileOverlapPx);
      tiles.push({
        index: tiles.length,
        column,
        row,
        x,
        y,
        width,
        height,
        renderX,
        renderY,
        renderWidth: renderRight - renderX,
        renderHeight: renderBottom - renderY,
        cropX: x - renderX,
        cropY: y - renderY,
      });
    }
  }

  const mode = columns === 1 && rows === 1
    ? 'single'
    : columns === 1 || rows === 1 ? 'strips' : 'tiles';
  return {
    mode,
    stripDirection: mode !== 'strips' ? null : columns === 1 ? 'horizontal' : 'vertical',
    columns,
    rows,
    overlapPx: limits.tileOverlapPx,
    tiles,
  };
}

export function planExportPreflight(
  request: ExportPreflightRequest,
  overrides: Partial<ExportPreflightLimits> = {},
): ExportPreflightResult {
  const limits: ExportPreflightLimits = { ...DEFAULT_EXPORT_PREFLIGHT_LIMITS, ...overrides };
  const warnings = outputTruthWarnings(request);
  const errors: ExportPreflightIssue[] = [];
  const attributions = [...new Set(request.attributions.map((value) => value.trim()).filter(Boolean))];
  let dimensions: ExportPreflightResult['dimensions'] = null;
  let estimates: ExportPreflightResult['estimates'] = null;
  const effectivePpi: Array<{ id: string; ppi: number }> = [];
  let cancellation: ExportPreflightResult['cancellation'] = {
    required: false,
    suitable: true,
    checkpoint: 'not-required',
  };

  const finish = (plan: ExportTilePlan | null): ExportPreflightResult => ({
    safe: errors.length === 0,
    format: request.format,
    dimensions,
    estimates,
    plan: errors.length === 0 ? plan : null,
    effectivePpi,
    attributions,
    cancellation,
    warnings,
    errors,
  });

  const limitNumbers = [
    limits.minDpi,
    limits.maxDpi,
    limits.minPageSideMm,
    limits.maxPageSideMm,
    limits.maxOutputSidePx,
    limits.maxPixelCount,
    limits.memoryBudgetBytes,
    limits.gpuMaxSidePx,
    limits.preferredTileSidePx,
    limits.tileBufferCount,
    limits.maxTileCount,
    limits.minEffectivePpi,
  ];
  if (limitNumbers.some((value) => !Number.isFinite(value) || value <= 0)
    || !Number.isInteger(limits.maxOutputSidePx)
    || !Number.isInteger(limits.maxPixelCount)
    || !Number.isInteger(limits.gpuMaxSidePx)
    || !Number.isInteger(limits.preferredTileSidePx)
    || !Number.isInteger(limits.tileBufferCount)
    || !Number.isInteger(limits.maxTileCount)
    || limits.minDpi > limits.maxDpi
    || limits.minPageSideMm > limits.maxPageSideMm) {
    errors.push({
      code: 'INVALID_LIMIT_CONFIGURATION',
      message: 'Export limits must be positive, finite, internally consistent values.',
    });
  }
  const renderSidePx = Math.min(limits.preferredTileSidePx, limits.gpuMaxSidePx);
  if (!Number.isInteger(limits.tileOverlapPx)
    || limits.tileOverlapPx < 0
    || !Number.isFinite(renderSidePx)
    || renderSidePx <= limits.tileOverlapPx * 2) {
    errors.push({
      code: 'INVALID_TILE_CONFIGURATION',
      message: 'The GPU/tile side must leave positive content after both overlap edges.',
    });
  }
  if (!['round', 'floor', 'ceil'].includes(limits.rounding)) {
    errors.push({ code: 'INVALID_ROUNDING_RULE', message: 'Pixel rounding must be round, floor, or ceil.' });
  }
  if (!Number.isFinite(request.page.widthMm)
    || request.page.widthMm <= 0
    || !Number.isFinite(request.page.heightMm)
    || request.page.heightMm <= 0) {
    errors.push({
      code: 'INVALID_PAGE_DIMENSIONS',
      message: 'Page width and height must be positive finite millimetre values.',
    });
  }
  if (!Number.isFinite(request.dpi) || request.dpi <= 0) {
    errors.push({ code: 'INVALID_DPI', message: 'DPI must be a positive finite number.' });
  } else if (request.dpi < limits.minDpi || request.dpi > limits.maxDpi) {
    errors.push({
      code: 'DPI_OUT_OF_RANGE',
      message: `DPI must be between ${limits.minDpi} and ${limits.maxDpi}.`,
    });
  }
  if (Number.isFinite(request.page.widthMm)
    && Number.isFinite(request.page.heightMm)
    && (request.page.widthMm < limits.minPageSideMm
      || request.page.heightMm < limits.minPageSideMm
      || request.page.widthMm > limits.maxPageSideMm
      || request.page.heightMm > limits.maxPageSideMm)) {
    errors.push({
      code: 'PAGE_SIDE_LIMIT_EXCEEDED',
      message: `Page sides must be between ${limits.minPageSideMm} and ${limits.maxPageSideMm} mm.`,
    });
  }
  if (errors.length > 0) return finish(null);

  const widthPx = millimetresToPixels(request.page.widthMm, request.dpi, limits.rounding);
  const heightPx = millimetresToPixels(request.page.heightMm, request.dpi, limits.rounding);
  const pixelCount = widthPx * heightPx;
  dimensions = { widthPx, heightPx, pixelCount, rounding: limits.rounding };
  if (!Number.isSafeInteger(widthPx)
    || !Number.isSafeInteger(heightPx)
    || !Number.isSafeInteger(pixelCount)
    || widthPx <= 0
    || heightPx <= 0) {
    errors.push({
      code: 'PIXEL_DIMENSIONS_UNREPRESENTABLE',
      message: 'Rounded pixel dimensions cannot be represented safely.',
    });
    return finish(null);
  }
  if (widthPx > limits.maxOutputSidePx || heightPx > limits.maxOutputSidePx) {
    errors.push({
      code: 'OUTPUT_SIDE_LIMIT_EXCEEDED',
      message: `Output sides may not exceed ${limits.maxOutputSidePx} pixels.`,
    });
  }
  if (pixelCount > limits.maxPixelCount) {
    errors.push({
      code: 'PIXEL_COUNT_LIMIT_EXCEEDED',
      message: `Output may not exceed ${limits.maxPixelCount} pixels.`,
    });
  }

  const isSingle = widthPx <= renderSidePx && heightPx <= renderSidePx;
  const contentSidePx = isSingle ? renderSidePx : renderSidePx - limits.tileOverlapPx * 2;
  const columns = isSingle ? 1 : Math.ceil(widthPx / contentSidePx);
  const rows = isSingle ? 1 : Math.ceil(heightPx / contentSidePx);
  const tileCount = columns * rows;
  if (!Number.isSafeInteger(tileCount) || tileCount > limits.maxTileCount) {
    errors.push({
      code: 'TILE_COUNT_LIMIT_EXCEEDED',
      message: `Export needs ${tileCount} tiles; the configured maximum is ${limits.maxTileCount}.`,
    });
  }

  const largestRenderWidth = columns > 1 ? Math.min(renderSidePx, widthPx) : widthPx;
  const largestRenderHeight = rows > 1 ? Math.min(renderSidePx, heightPx) : heightPx;
  const rgbaBytes = pixelCount * 4;
  const peakTileRgbaBytes = largestRenderWidth * largestRenderHeight * 4 * limits.tileBufferCount;
  const outputBytes = estimatedOutputBytes(request.format, rgbaBytes);
  const peakBytes = rgbaBytes + peakTileRgbaBytes + outputBytes;
  estimates = {
    rgbaBytes,
    peakTileRgbaBytes,
    encodedOutputBytes: outputBytes,
    peakBytes,
  };
  if (![rgbaBytes, peakTileRgbaBytes, outputBytes, peakBytes].every(Number.isSafeInteger)) {
    errors.push({
      code: 'MEMORY_ESTIMATE_UNREPRESENTABLE',
      message: 'The export memory estimate cannot be represented safely.',
    });
  } else if (peakBytes > limits.memoryBudgetBytes) {
    errors.push({
      code: 'MEMORY_BUDGET_EXCEEDED',
      message: `Estimated peak memory is ${peakBytes} bytes; the budget is ${limits.memoryBudgetBytes} bytes.`,
    });
  }

  if (attributions.length === 0) {
    errors.push({
      code: 'ATTRIBUTION_REQUIRED',
      message: 'Required map source attribution is missing.',
    });
  }
  const missingGroups: Array<[keyof NonNullable<ExportPreflightRequest['missing']>, string, string]> = [
    ['assets', 'MISSING_ASSETS', 'Required assets are missing.'],
    ['tiles', 'MISSING_TILES', 'Required map tiles are missing.'],
    ['fonts', 'MISSING_FONTS', 'Required fonts are missing.'],
  ];
  for (const [key, code, message] of missingGroups) {
    const values = [...new Set((request.missing?.[key] ?? []).map((value) => value.trim()).filter(Boolean))];
    if (values.length > 0) errors.push({ code, message, details: values });
  }

  for (const layer of request.rasterLayers ?? []) {
    const placedWidthMm = layer.placedWidthMm ?? request.page.widthMm;
    const placedHeightMm = layer.placedHeightMm ?? request.page.heightMm;
    if (!layer.id.trim()
      || !Number.isFinite(layer.pixelWidth)
      || layer.pixelWidth <= 0
      || !Number.isFinite(layer.pixelHeight)
      || layer.pixelHeight <= 0
      || !Number.isFinite(placedWidthMm)
      || placedWidthMm <= 0
      || !Number.isFinite(placedHeightMm)
      || placedHeightMm <= 0) {
      errors.push({
        code: 'INVALID_RASTER_LAYER_DIMENSIONS',
        message: 'Raster layers need an ID plus positive pixel and placed dimensions.',
        details: layer.id.trim() ? [layer.id] : undefined,
      });
      continue;
    }
    const ppi = Math.min(
      layer.pixelWidth * 25.4 / placedWidthMm,
      layer.pixelHeight * 25.4 / placedHeightMm,
    );
    effectivePpi.push({ id: layer.id, ppi });
    if (ppi < limits.minEffectivePpi) {
      errors.push({
        code: 'EFFECTIVE_PPI_TOO_LOW',
        message: `${layer.id} is ${ppi.toFixed(1)} PPI; minimum is ${limits.minEffectivePpi} PPI.`,
        details: [layer.id],
      });
    } else if (ppi < request.dpi) {
      warnings.push({
        code: 'EFFECTIVE_PPI_BELOW_TARGET',
        message: `${layer.id} is ${ppi.toFixed(1)} PPI, below the ${request.dpi} DPI target.`,
        details: [layer.id],
      });
    }
  }

  const cancellationRequired = tileCount > 1;
  cancellation = cancellationRequired ? {
    required: true,
    suitable: request.cancellationSupported,
    checkpoint: request.cancellationSupported ? 'tile-boundary' : 'unavailable',
  } : { required: false, suitable: true, checkpoint: 'not-required' };
  if (cancellationRequired && request.cancellationSupported) {
    warnings.push({
      code: 'CANCELLATION_AT_TILE_BOUNDARIES',
      message: 'The export can be cancelled between tile render operations.',
    });
  } else if (cancellationRequired) {
    errors.push({
      code: 'CANCELLATION_UNAVAILABLE',
      message: 'A multi-tile export must support cancellation at tile boundaries.',
    });
  }

  if (errors.length > 0) return finish(null);
  return finish(createTilePlan(widthPx, heightPx, limits));
}
