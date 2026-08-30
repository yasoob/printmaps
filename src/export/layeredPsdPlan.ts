import type { ProjectDocument } from '../domain/project';
import { projectAttributions } from '../domain/projectAttributions';
import { millimetresToPixels, planExportPreflight, type ExportPreflightResult } from './preflight';

export const LAYERED_PSD_TARGET_DPI = 300;
export const LAYERED_PSD_MAX_PIXEL_COUNT = 1e7;
export const LAYERED_PSD_MAX_SIDE_PX = 6000;
const LAYERED_PSD_SURFACE_BUDGET_BYTES = 256 * 1024 * 1024;

export type LayeredPsdExportPlan = Readonly<{
  compact: boolean;
  effectiveDpi: number;
  preflight: ExportPreflightResult;
}>;

function maximumPsdPixelCount(document: ProjectDocument): number {
  const layerSurfaceCount = document.layers.length + 2;
  return Math.min(
    LAYERED_PSD_MAX_PIXEL_COUNT,
    Math.floor(LAYERED_PSD_SURFACE_BUDGET_BYTES / (layerSurfaceCount * 4)),
  );
}

function maximumPsdDpi(document: ProjectDocument, maximumPixelCount: number): number {
  if (
    !Number.isFinite(document.page.widthMm)
    || document.page.widthMm <= 0
    || !Number.isFinite(document.page.heightMm)
    || document.page.heightMm <= 0
  ) return LAYERED_PSD_TARGET_DPI;
  const width = millimetresToPixels(document.page.widthMm, LAYERED_PSD_TARGET_DPI, 'round');
  const height = millimetresToPixels(document.page.heightMm, LAYERED_PSD_TARGET_DPI, 'round');
  const scale = Math.min(
    1,
    Math.sqrt(maximumPixelCount / (width * height)),
    LAYERED_PSD_MAX_SIDE_PX / Math.max(width, height),
  );
  let dpi = Math.max(36, Math.min(LAYERED_PSD_TARGET_DPI, Math.floor(LAYERED_PSD_TARGET_DPI * scale)));
  while (dpi > 36) {
    const scaledWidth = millimetresToPixels(document.page.widthMm, dpi, 'round');
    const scaledHeight = millimetresToPixels(document.page.heightMm, dpi, 'round');
    if (
      scaledWidth * scaledHeight <= maximumPixelCount
      && Math.max(scaledWidth, scaledHeight) <= LAYERED_PSD_MAX_SIDE_PX
    ) break;
    dpi -= 1;
  }
  return dpi;
}

export function planLayeredPsdExport(document: ProjectDocument): LayeredPsdExportPlan {
  const maximumPixelCount = maximumPsdPixelCount(document);
  const effectiveDpi = maximumPsdDpi(document, maximumPixelCount);
  const preflight = planExportPreflight({
    format: 'psd',
    page: { widthMm: document.page.widthMm, heightMm: document.page.heightMm },
    dpi: effectiveDpi,
    attributions: projectAttributions(document),
    basemap: 'raster',
    vectorOverlays: true,
    missing: {},
    rasterLayers: [],
    cancellationSupported: true,
  }, {
    maxOutputSidePx: LAYERED_PSD_MAX_SIDE_PX,
    maxPixelCount: maximumPixelCount,
  });
  return {
    compact: effectiveDpi < LAYERED_PSD_TARGET_DPI,
    effectiveDpi,
    preflight,
  };
}
