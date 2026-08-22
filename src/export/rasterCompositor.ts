import type { ExportTilePlan } from './preflight';

type Awaitable<T> = T | PromiseLike<T>;

const CANCELLATION_MESSAGE = 'Raster composition was cancelled.';

function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw new DOMException(CANCELLATION_MESSAGE, 'AbortError');
  }
}

function yieldToBrowserTask(): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, 0);
  });
}

async function runAndRelease(
  run: () => Awaitable<void>,
  release: () => Awaitable<void>,
): Promise<void> {
  let isStageFailed = false;
  let stageFailure: unknown;
  try {
    await run();
  } catch (error) {
    isStageFailed = true;
    stageFailure = error;
  }

  try {
    await release();
  } catch (error) {
    if (!isStageFailed) throw error;
  }

  if (isStageFailed) throw stageFailure;
}

type TileIdentity = Readonly<{
  index: number;
  column: number;
  row: number;
}>;

type PixelRegion = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type RenderedRasterTile<Resource> = Readonly<{
  value: Resource;
  release: () => Awaitable<void>;
}>;

export type RasterTileRenderRequest = Readonly<{
  tile: TileIdentity;
  region: PixelRegion;
  signal: AbortSignal | undefined;
}>;

export type RasterTileWriteRequest<Resource> = Readonly<{
  tile: TileIdentity;
  resource: Resource;
  source: PixelRegion;
  destination: PixelRegion;
  signal: AbortSignal | undefined;
}>;

export type RasterProgress = Readonly<{
  completedTiles: number;
  totalTiles: number;
  fraction: number;
  tile: TileIdentity;
}>;

export type RasterCompositorCallbacks<Resource> = Readonly<{
  renderTile: (request: RasterTileRenderRequest) => Awaitable<RenderedRasterTile<Resource>>;
  writeTile: (request: RasterTileWriteRequest<Resource>) => Awaitable<void>;
  onProgress?: (progress: RasterProgress) => Awaitable<void>;
}>;

export type RasterCompositorOptions = Readonly<{
  signal?: AbortSignal;
}>;

export async function composeRasterTiles<Resource>(
  plan: ExportTilePlan,
  callbacks: RasterCompositorCallbacks<Resource>,
  options: RasterCompositorOptions = {},
): Promise<void> {
  throwIfCancelled(options.signal);
  let completedTiles = 0;
  for (const currentTile of plan.tiles) {
    throwIfCancelled(options.signal);
    const tile = {
      index: currentTile.index,
      column: currentTile.column,
      row: currentTile.row,
    };
    const rendered = await callbacks.renderTile({
      tile,
      region: {
        x: currentTile.renderX,
        y: currentTile.renderY,
        width: currentTile.renderWidth,
        height: currentTile.renderHeight,
      },
      signal: options.signal,
    });
    await runAndRelease(async () => {
      throwIfCancelled(options.signal);
      await callbacks.writeTile({
        tile,
        resource: rendered.value,
        source: {
          x: currentTile.cropX,
          y: currentTile.cropY,
          width: currentTile.width,
          height: currentTile.height,
        },
        destination: {
          x: currentTile.x,
          y: currentTile.y,
          width: currentTile.width,
          height: currentTile.height,
        },
        signal: options.signal,
      });
      throwIfCancelled(options.signal);
    }, rendered.release);
    throwIfCancelled(options.signal);
    completedTiles += 1;
    await callbacks.onProgress?.({
      completedTiles,
      totalTiles: plan.tiles.length,
      fraction: completedTiles / plan.tiles.length,
      tile,
    });
    if (completedTiles < plan.tiles.length) await yieldToBrowserTask();
  }
}
