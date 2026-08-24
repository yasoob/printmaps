import type {
  ExportFormat,
  ExportPreflightIssue,
  ExportPreflightLimits,
  ExportPreflightRequest,
  ExportPreflightResult,
} from './preflightTypes';
import type { ExportGrid } from './preflightValidation';

type Dimensions = NonNullable<ExportPreflightResult['dimensions']>;
type Estimates = NonNullable<ExportPreflightResult['estimates']>;

const ESTIMATED_TILE_PLAN_RECORD_BYTES = 256;

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
  const tilePlanBytes = grid.tileCount * ESTIMATED_TILE_PLAN_RECORD_BYTES;
  const contentWidth = Math.min(grid.contentSidePx, dimensions.widthPx);
  const contentHeight = Math.min(grid.contentSidePx, dimensions.heightPx);
  const contentRgbaBytes = contentWidth * contentHeight * 4;
  const sharedPeakBytes = peakTileRgbaBytes + tilePlanBytes;
  const peakBytes = sharedPeakBytes + (request.rasterDelivery === 'tile-package'
    ? contentRgbaBytes + Math.ceil(contentRgbaBytes * 1.05)
    : rgbaBytes + encodedOutputBytes);
  const estimates = { rgbaBytes, peakTileRgbaBytes, encodedOutputBytes, peakBytes };
  const values = [rgbaBytes, peakTileRgbaBytes, encodedOutputBytes, tilePlanBytes, peakBytes];
  if (values.some((value) => !Number.isSafeInteger(value))) {
    return {
      estimates,
      issue: {
        code: 'MEMORY_ESTIMATE_UNREPRESENTABLE',
        message: 'The export memory estimate cannot be represented safely.',
      },
    };
  }
  if (request.rasterDelivery === 'tile-package' && encodedOutputBytes >= 0xFF_FF_00_00) {
    return {
      estimates,
      issue: {
        code: 'PACKAGE_SIZE_LIMIT_EXCEEDED',
        message: 'The estimated package exceeds the 4 GiB compatible streamed ZIP limit. Reduce page dimensions or DPI.',
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
