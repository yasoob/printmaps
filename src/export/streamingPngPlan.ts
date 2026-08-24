export const STREAMING_PNG_STRIP_BUDGET_BYTES = 64 * 1024 * 1024;

export type StreamingPngStripPlan = Readonly<{
  stripBytes: number;
  stripCount: number;
  stripHeight: number;
}>;

export function planStreamingPngStrips(
  width: number,
  height: number,
  maximumContentHeight: number,
): StreamingPngStripPlan {
  const rowBytes = width * 4;
  const maximumStripHeight = Math.max(
    1,
    Math.min(maximumContentHeight, Math.floor(STREAMING_PNG_STRIP_BUDGET_BYTES / rowBytes)),
  );
  const stripCount = Math.ceil(height / maximumStripHeight);
  const stripHeight = Math.ceil(height / stripCount);
  return { stripBytes: rowBytes * stripHeight, stripCount, stripHeight };
}
