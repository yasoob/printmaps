import type {
  ExportFormat,
  ExportPreflightIssue,
  ExportPreflightLimits,
  ExportPreflightRequest,
  ExportPreflightResult,
  RasterLayerResolution,
} from './preflightTypes';

export type ExportGrid = {
  renderSidePx: number;
  contentSidePx: number;
  columns: number;
  rows: number;
  tileCount: number;
};

type Dimensions = NonNullable<ExportPreflightResult['dimensions']>;
type Estimates = NonNullable<ExportPreflightResult['estimates']>;
type Cancellation = ExportPreflightResult['cancellation'];

const isInteger = Number.isInteger.bind(Number);

function hasInvalidLimits(limits: ExportPreflightLimits): boolean {
  const positiveValues = [
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
  if (positiveValues.some((value) => !Number.isFinite(value) || value <= 0)) return true;
  const integerValues = [
    limits.maxOutputSidePx,
    limits.maxPixelCount,
    limits.gpuMaxSidePx,
    limits.preferredTileSidePx,
    limits.tileBufferCount,
    limits.maxTileCount,
  ];
  if (integerValues.some((value) => !isInteger(value))) return true;
  return limits.minDpi > limits.maxDpi || limits.minPageSideMm > limits.maxPageSideMm;
}

function hasInvalidTileConfiguration(limits: ExportPreflightLimits, renderSidePx: number): boolean {
  return !isInteger(limits.tileOverlapPx)
    || limits.tileOverlapPx < 0
    || !Number.isFinite(renderSidePx)
    || renderSidePx <= limits.tileOverlapPx * 2;
}

function hasInvalidPage(request: ExportPreflightRequest): boolean {
  const sides = [request.page.widthMm, request.page.heightMm];
  return sides.some((value) => !Number.isFinite(value) || value <= 0);
}

function isPageOutsideLimits(request: ExportPreflightRequest, limits: ExportPreflightLimits): boolean {
  const { widthMm, heightMm } = request.page;
  if ([widthMm, heightMm].some((value) => !Number.isFinite(value))) return false;
  return [widthMm, heightMm].some(
    (value) => value < limits.minPageSideMm || value > limits.maxPageSideMm,
  );
}

export function validateInitialRequest(
  request: ExportPreflightRequest,
  limits: ExportPreflightLimits,
  errors: ExportPreflightIssue[],
): number {
  if (hasInvalidLimits(limits)) {
    errors.push({
      code: 'INVALID_LIMIT_CONFIGURATION',
      message: 'Export limits must be positive, finite, internally consistent values.',
    });
  }
  const renderSidePx = Math.min(limits.preferredTileSidePx, limits.gpuMaxSidePx);
  if (hasInvalidTileConfiguration(limits, renderSidePx)) {
    errors.push({
      code: 'INVALID_TILE_CONFIGURATION',
      message: 'The GPU/tile side must leave positive content after both overlap edges.',
    });
  }
  if (!['round', 'floor', 'ceil'].includes(limits.rounding)) {
    errors.push({ code: 'INVALID_ROUNDING_RULE', message: 'Pixel rounding must be round, floor, or ceil.' });
  }
  if (hasInvalidPage(request)) {
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
  if (isPageOutsideLimits(request, limits)) {
    errors.push({
      code: 'PAGE_SIDE_LIMIT_EXCEEDED',
      message: `Page sides must be between ${limits.minPageSideMm} and ${limits.maxPageSideMm} mm.`,
    });
  }
  return renderSidePx;
}

export function createExportGrid(
  widthPx: number,
  heightPx: number,
  limits: ExportPreflightLimits,
): ExportGrid {
  const renderSidePx = Math.min(limits.preferredTileSidePx, limits.gpuMaxSidePx);
  const isSingle = widthPx <= renderSidePx && heightPx <= renderSidePx;
  const contentSidePx = isSingle ? renderSidePx : renderSidePx - limits.tileOverlapPx * 2;
  const columns = isSingle ? 1 : Math.ceil(widthPx / contentSidePx);
  const rows = isSingle ? 1 : Math.ceil(heightPx / contentSidePx);
  return { renderSidePx, contentSidePx, columns, rows, tileCount: columns * rows };
}

export function appendDimensionIssues(
  dimensions: Dimensions,
  limits: ExportPreflightLimits,
  errors: ExportPreflightIssue[],
): void {
  const { widthPx, heightPx, pixelCount } = dimensions;
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
}

export function appendTileCountIssue(
  grid: ExportGrid,
  limits: ExportPreflightLimits,
  errors: ExportPreflightIssue[],
): void {
  if (!Number.isSafeInteger(grid.tileCount) || grid.tileCount > limits.maxTileCount) {
    errors.push({
      code: 'TILE_COUNT_LIMIT_EXCEEDED',
      message: `Export needs ${grid.tileCount} tiles; the configured maximum is ${limits.maxTileCount}.`,
    });
  }
}

function estimatedOutputBytes(format: ExportFormat, rgbaBytes: number): number {
  if (format === 'pdf') return Math.ceil(rgbaBytes * 1.05 + 1024 * 1024);
  if (format === 'layered-svg') return Math.ceil(rgbaBytes * 1.4 + 256 * 1024);
  return Math.ceil(rgbaBytes * 1.05);
}

export function estimateMemory(
  request: ExportPreflightRequest,
  dimensions: Dimensions,
  grid: ExportGrid,
  limits: ExportPreflightLimits,
): { estimates: Estimates; issue?: ExportPreflightIssue } {
  const largestRenderWidth = grid.columns > 1
    ? Math.min(grid.renderSidePx, dimensions.widthPx)
    : dimensions.widthPx;
  const largestRenderHeight = grid.rows > 1
    ? Math.min(grid.renderSidePx, dimensions.heightPx)
    : dimensions.heightPx;
  const rgbaBytes = dimensions.pixelCount * 4;
  const peakTileRgbaBytes = largestRenderWidth * largestRenderHeight * 4 * limits.tileBufferCount;
  const encodedOutputBytes = estimatedOutputBytes(request.format, rgbaBytes);
  const peakBytes = rgbaBytes + peakTileRgbaBytes + encodedOutputBytes;
  const estimates = { rgbaBytes, peakTileRgbaBytes, encodedOutputBytes, peakBytes };
  const values = [rgbaBytes, peakTileRgbaBytes, encodedOutputBytes, peakBytes];
  if (values.some((value) => !Number.isSafeInteger(value))) {
    return {
      estimates,
      issue: {
        code: 'MEMORY_ESTIMATE_UNREPRESENTABLE',
        message: 'The export memory estimate cannot be represented safely.',
      },
    };
  }
  if (peakBytes > limits.memoryBudgetBytes) {
    return {
      estimates,
      issue: {
        code: 'MEMORY_BUDGET_EXCEEDED',
        message: `Estimated peak memory is ${peakBytes} bytes; the budget is ${limits.memoryBudgetBytes} bytes.`,
      },
    };
  }
  return { estimates };
}

export function appendMissingIssues(
  request: ExportPreflightRequest,
  errors: ExportPreflightIssue[],
): void {
  const missingGroups: Array<[keyof NonNullable<ExportPreflightRequest['missing']>, string, string]> = [
    ['assets', 'MISSING_ASSETS', 'Required assets are missing.'],
    ['tiles', 'MISSING_TILES', 'Required map tiles are missing.'],
    ['fonts', 'MISSING_FONTS', 'Required fonts are missing.'],
  ];
  for (const [key, code, message] of missingGroups) {
    const values = [...new Set((request.missing?.[key] ?? []).flatMap((value) => {
      const missingValue = value.trim();
      return missingValue ? [missingValue] : [];
    }))];
    if (values.length > 0) errors.push({ code, message, details: values });
  }
}

function isInvalidRasterLayer(layer: RasterLayerResolution, placedDimensions: readonly number[]): boolean {
  const dimensions = [layer.pixelWidth, layer.pixelHeight, ...placedDimensions];
  return !layer.id.trim() || dimensions.some((value) => !Number.isFinite(value) || value <= 0);
}

export function appendRasterIssues(
  request: ExportPreflightRequest,
  limits: ExportPreflightLimits,
  warnings: ExportPreflightIssue[],
  errors: ExportPreflightIssue[],
): Array<{ id: string; ppi: number }> {
  const effectivePpi: Array<{ id: string; ppi: number }> = [];
  const rasterLayers = request.rasterLayers ?? [];
  for (const layer of rasterLayers) {
    const placedWidthMm = layer.placedWidthMm ?? request.page.widthMm;
    const placedHeightMm = layer.placedHeightMm ?? request.page.heightMm;
    if (isInvalidRasterLayer(layer, [placedWidthMm, placedHeightMm])) {
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
  return effectivePpi;
}

export function resolveCancellation(
  tileCount: number,
  isSupported: boolean,
  warnings: ExportPreflightIssue[],
  errors: ExportPreflightIssue[],
): Cancellation {
  const isRequired = tileCount > 1;
  if (!isRequired) return { required: false, suitable: true, checkpoint: 'not-required' };
  if (isSupported) {
    warnings.push({
      code: 'CANCELLATION_AT_TILE_BOUNDARIES',
      message: 'The export can be cancelled between tile render operations.',
    });
    return { required: true, suitable: true, checkpoint: 'tile-boundary' };
  }
  errors.push({
    code: 'CANCELLATION_UNAVAILABLE',
    message: 'A multi-tile export must support cancellation at tile boundaries.',
  });
  return { required: true, suitable: false, checkpoint: 'unavailable' };
}
