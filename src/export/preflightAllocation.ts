import {
  DEFAULT_EXPORT_PREFLIGHT_LIMITS,
  type ExportPreflightIssue,
  type ExportPreflightLimits,
} from './preflightTypes';

type PixelSurfaceLimits = Pick<
  ExportPreflightLimits,
  'maxOutputSidePx' | 'maxPixelCount' | 'memoryBudgetBytes'
>;

export function getPixelSurfaceAllocationIssue(
  widthPx: number,
  heightPx: number,
  limits: PixelSurfaceLimits = DEFAULT_EXPORT_PREFLIGHT_LIMITS,
): ExportPreflightIssue | null {
  const pixelCount = widthPx * heightPx;
  const dimensions = [widthPx, heightPx, pixelCount];
  if (dimensions.some((value) => !Number.isSafeInteger(value)) || widthPx <= 0 || heightPx <= 0) {
    return {
      code: 'PIXEL_DIMENSIONS_UNREPRESENTABLE',
      message: 'Pixel surface dimensions cannot be represented safely.',
    };
  }
  if (widthPx > limits.maxOutputSidePx || heightPx > limits.maxOutputSidePx) {
    return {
      code: 'OUTPUT_SIDE_LIMIT_EXCEEDED',
      message: `Pixel surface sides may not exceed ${limits.maxOutputSidePx} pixels.`,
    };
  }
  if (pixelCount > limits.maxPixelCount) {
    return {
      code: 'PIXEL_COUNT_LIMIT_EXCEEDED',
      message: `Pixel surface may not exceed ${limits.maxPixelCount} pixels.`,
    };
  }
  const rgbaBytes = pixelCount * 4;
  if (!Number.isSafeInteger(rgbaBytes)) {
    return {
      code: 'MEMORY_ESTIMATE_UNREPRESENTABLE',
      message: 'The pixel surface memory estimate cannot be represented safely.',
    };
  }
  if (rgbaBytes > limits.memoryBudgetBytes) {
    return {
      code: 'MEMORY_BUDGET_EXCEEDED',
      message: `Pixel surface needs ${rgbaBytes} bytes; the budget is ${limits.memoryBudgetBytes} bytes.`,
    };
  }
  return null;
}
