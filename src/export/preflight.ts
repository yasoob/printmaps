import {
  appendDimensionIssues,
  appendMissingIssues,
  appendRasterIssues,
  appendTileCountIssue,
  createExportGrid,
  resolveCancellation,
  validateInitialRequest,
} from './preflightValidation';
import { estimateMemory } from './preflightEstimates';
import {
  DEFAULT_EXPORT_PREFLIGHT_LIMITS,
  type ExportPreflightIssue,
  type ExportPreflightLimits,
  type ExportPreflightRequest,
  type ExportPreflightResult,
  type ExportTile,
  type ExportTilePlan,
  type PixelRounding,
} from './preflightTypes';
import type { ExportGrid } from './preflightValidation';

export { DEFAULT_EXPORT_PREFLIGHT_LIMITS } from './preflightTypes';
export { getPixelSurfaceAllocationIssue } from './preflightAllocation';
export type {
  BasemapMode,
  ExportFormat,
  ExportPreflightIssue,
  ExportPreflightLimits,
  ExportPreflightRequest,
  ExportPreflightResult,
  ExportTile,
  ExportTilePlan,
  PixelRounding,
  RasterDelivery,
  RasterLayerResolution,
} from './preflightTypes';

type ResultState = Pick<
  ExportPreflightResult,
  'dimensions' | 'estimates' | 'effectivePpi' | 'attributions' | 'cancellation' | 'warnings' | 'errors'
>;

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

function tileAt(
  position: Readonly<{ column: number; row: number }>,
  dimensions: Readonly<{ widthPx: number; heightPx: number }>,
  grid: ExportGrid,
  overlapPx: number,
): ExportTile {
  const x = position.column * grid.contentSidePx;
  const y = position.row * grid.contentSidePx;
  const width = Math.min(grid.contentSidePx, dimensions.widthPx - x);
  const height = Math.min(grid.contentSidePx, dimensions.heightPx - y);
  const renderX = Math.max(0, x - overlapPx);
  const renderY = Math.max(0, y - overlapPx);
  const renderRight = Math.min(dimensions.widthPx, x + width + overlapPx);
  const renderBottom = Math.min(dimensions.heightPx, y + height + overlapPx);
  return {
    index: position.row * grid.columns + position.column,
    column: position.column,
    row: position.row,
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
  };
}

function planMode(columns: number, rows: number): ExportTilePlan['mode'] {
  if (columns === 1 && rows === 1) return 'single';
  if (columns === 1 || rows === 1) return 'strips';
  return 'tiles';
}

function stripDirection(
  mode: ExportTilePlan['mode'],
  columns: number,
): ExportTilePlan['stripDirection'] {
  if (mode !== 'strips') return null;
  return columns === 1 ? 'horizontal' : 'vertical';
}

function createTilePlan(
  dimensions: Readonly<{ widthPx: number; heightPx: number }>,
  limits: ExportPreflightLimits,
  grid: ExportGrid,
): ExportTilePlan {
  const tiles: ExportTile[] = [];
  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.columns; column += 1) {
      tiles.push(tileAt({ column, row }, dimensions, grid, limits.tileOverlapPx));
    }
  }
  const mode = planMode(grid.columns, grid.rows);
  return {
    mode,
    stripDirection: stripDirection(mode, grid.columns),
    columns: grid.columns,
    rows: grid.rows,
    overlapPx: limits.tileOverlapPx,
    tiles,
  };
}

function finishResult(
  request: ExportPreflightRequest,
  state: ResultState,
  plan: ExportTilePlan | null,
): ExportPreflightResult {
  return {
    safe: state.errors.length === 0,
    format: request.format,
    delivery: request.rasterDelivery ?? 'single-png',
    ...state,
    plan: state.errors.length === 0 ? plan : null,
  };
}

function hasUnrepresentableDimensions(
  dimensions: NonNullable<ExportPreflightResult['dimensions']>,
): boolean {
  const { widthPx, heightPx, pixelCount } = dimensions;
  const values = [widthPx, heightPx, pixelCount];
  return values.some((value) => !Number.isSafeInteger(value)) || widthPx <= 0 || heightPx <= 0;
}

export function planExportPreflight(
  request: ExportPreflightRequest,
  overrides: Partial<ExportPreflightLimits> = {},
): ExportPreflightResult {
  const limits: ExportPreflightLimits = { ...DEFAULT_EXPORT_PREFLIGHT_LIMITS, ...overrides };
  const errors: ExportPreflightIssue[] = [];
  const state: ResultState = {
    dimensions: null,
    estimates: null,
    effectivePpi: [],
    attributions: [...new Set(request.attributions.flatMap((value) => {
      const attribution = value.trim();
      return attribution ? [attribution] : [];
    }))],
    cancellation: { required: false, suitable: true, checkpoint: 'not-required' },
    warnings: outputTruthWarnings(request),
    errors,
  };

  validateInitialRequest(request, limits, errors);
  if (errors.length > 0) return finishResult(request, state, null);

  const widthPx = millimetresToPixels(request.page.widthMm, request.dpi, limits.rounding);
  const heightPx = millimetresToPixels(request.page.heightMm, request.dpi, limits.rounding);
  const dimensions = { widthPx, heightPx, pixelCount: widthPx * heightPx, rounding: limits.rounding };
  state.dimensions = dimensions;
  if (hasUnrepresentableDimensions(dimensions)) {
    errors.push({
      code: 'PIXEL_DIMENSIONS_UNREPRESENTABLE',
      message: 'Rounded pixel dimensions cannot be represented safely.',
    });
    return finishResult(request, state, null);
  }
  if (request.format === 'png' && (widthPx < 48 || heightPx < 24)) {
    errors.push({
      code: 'RASTER_OUTPUT_TOO_SMALL',
      message: 'The PNG output is too small for useful map content and legible attribution.',
    });
  }

  appendDimensionIssues(dimensions, limits, errors, request.rasterDelivery ?? 'single-png');
  const grid = createExportGrid(widthPx, heightPx, limits);
  appendTileCountIssue(grid, limits, errors);
  const memory = estimateMemory(request, dimensions, grid, limits);
  state.estimates = memory.estimates;
  if (memory.issue) errors.push(memory.issue);
  if (state.attributions.length === 0) {
    errors.push({ code: 'ATTRIBUTION_REQUIRED', message: 'Required map source attribution is missing.' });
  }
  appendMissingIssues(request, errors);
  state.effectivePpi = appendRasterIssues(request, limits, state.warnings as ExportPreflightIssue[], errors);
  state.cancellation = resolveCancellation(
    grid.tileCount,
    request.cancellationSupported,
    state.warnings as ExportPreflightIssue[],
    errors,
  );
  if (errors.length > 0) return finishResult(request, state, null);
  return finishResult(request, state, createTilePlan(dimensions, limits, grid));
}
