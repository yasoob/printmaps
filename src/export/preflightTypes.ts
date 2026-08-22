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

export const MAX_SAFE_EXPORT_TILE_COUNT = 4096;

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
  maxTileCount: MAX_SAFE_EXPORT_TILE_COUNT,
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
