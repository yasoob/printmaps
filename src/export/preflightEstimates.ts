import type {
  ExportFormat,
  ExportPreflightIssue,
  ExportPreflightLimits,
  ExportPreflightRequest,
  ExportPreflightResult,
} from './preflightTypes';
import type { ExportGrid } from './preflightValidation';
import { planStreamingPngStrips } from './streamingPngPlan';

type Dimensions = NonNullable<ExportPreflightResult['dimensions']>;
type Estimates = NonNullable<ExportPreflightResult['estimates']>;

const ESTIMATED_TILE_PLAN_RECORD_BYTES = 256;

function estimatedOutputBytes(format: ExportFormat, rgbaBytes: number): number {
  if (format === 'pdf') return Math.ceil(rgbaBytes * (3 / 4) * 1.01 + 1024 * 1024);
  if (format === 'layered-svg') return Math.ceil(rgbaBytes * 1.4 + 256 * 1024);
  if (format === 'psd') return Math.ceil(rgbaBytes * 4 + 1024 * 1024);
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
  const contentHeight = Math.min(grid.contentSidePx, dimensions.heightPx);
  const sharedPeakBytes = peakTileRgbaBytes + tilePlanBytes;
  const streaming = planStreamingPngStrips(dimensions.widthPx, dimensions.heightPx, contentHeight);
  const streamingWorkingBytes = streaming.stripBytes + dimensions.widthPx * 8 + 1024 * 1024;
  let bufferedOutputBytes = rgbaBytes + encodedOutputBytes;
  if (request.rasterDelivery === 'streaming-png') bufferedOutputBytes = streamingWorkingBytes;
  else if (request.format === 'pdf') bufferedOutputBytes = encodedOutputBytes;
  const peakBytes = sharedPeakBytes + bufferedOutputBytes;
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
