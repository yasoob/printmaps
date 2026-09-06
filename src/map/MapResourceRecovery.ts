import type { Map as MapLibreMap } from 'maplibre-gl';
import type { MapError } from './MapCanvasLifecycle';

export const TILE_RETRY_DELAYS = [750, 1500] as const;
export const TILE_RECOVERY_TIMEOUT_MS = 12_000;

type FailedTile = {
  aborted?: boolean;
  state: string;
  tileID: { canonical: { x: number; y: number; z: number } };
};

export type MapFailureEvent = {
  error?: { message?: string; name?: string; status?: number; url?: string };
  sourceId?: string;
  source?: { type?: string };
  tile?: FailedTile;
  layer?: unknown;
};

export function isNetworkMapFailure(event?: MapFailureEvent): boolean {
  return typeof event?.error?.status === 'number' && typeof event.error.url === 'string';
}

function isTransientTileFailure(event?: MapFailureEvent): event is MapFailureEvent & { sourceId: string; tile: FailedTile } {
  if (!isNetworkMapFailure(event) || !event?.tile?.tileID?.canonical || !event.sourceId) return false;
  return ['vector', 'raster', 'raster-dem'].includes(event.source?.type ?? '')
    && isTransientStatus(event.error!.status!);
}

function isTransientStatus(status: number) {
  return status === 0 || status === 408 || status === 429 || (status >= 500 && status < 600);
}

export function mapFailureMessage(event: MapFailureEvent | undefined, isStyleLoaded: boolean): MapError {
  if (isNetworkMapFailure(event)) {
    return { kind: 'resource', message: 'Map resources could not be loaded. Check your connection, then retry the map.' };
  }
  if (event?.source?.type === 'geojson' || event?.layer) {
    return { kind: 'content', message: 'The map content could not be rendered. Review the layer data, then retry the map.' };
  }
  return isStyleLoaded
    ? { kind: 'renderer', message: 'The map renderer encountered an error. Retry the map without reloading your project.' }
    : { kind: 'style', message: 'The map style could not be loaded. Check the style and your connection, then retry the map.' };
}

export function createMapResourceRecovery(
  map: MapLibreMap,
  report: (error: MapError | null) => void,
) {
  const pending = new Map<FailedTile, string>();
  let attempts = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let isExhausted = false;
  let isDisposed = false;
  let hasFailures = false;

  const clearTimers = () => {
    clearTimeout(retryTimer);
    clearTimeout(deadline);
    retryTimer = undefined;
    deadline = undefined;
  };
  const pruneResolved = () => {
    // MapLibre counts errored tiles as loaded. Only success or actual retirement
    // of the failed tile makes it safe to forget that failure.
    for (const tile of pending.keys()) {
      if (tile.state === 'loaded' || tile.state === 'unloaded' || tile.aborted) pending.delete(tile);
    }
  };
  const giveUp = () => {
    clearTimers();
    isExhausted = true;
    report({ kind: 'resource', message: 'Map resources are still unavailable. Check your connection, then retry the map.' });
  };
  const retry = () => {
    retryTimer = undefined;
    if (isDisposed) return;
    pruneResolved();
    if (pending.size === 0) return;
    attempts += 1;
    try {
      const sources = new Map<string, FailedTile['tileID']['canonical'][]>();
      for (const [tile, source] of pending) {
        const tiles = sources.get(source) ?? [];
        tiles.push(tile.tileID.canonical);
        sources.set(source, tiles);
      }
      for (const [source, tiles] of sources) map.refreshTiles(source, tiles);
      map.triggerRepaint();
    } catch {
      giveUp();
    }
  };

  return {
    handleError(event?: MapFailureEvent) {
      if (isDisposed || !isTransientTileFailure(event)) return false;
      hasFailures = true;
      pending.set(event.tile, event.sourceId);
      if (isExhausted || attempts >= TILE_RETRY_DELAYS.length) {
        giveUp();
        return true;
      }
      report({ kind: 'resource', retrying: true, message: 'Some map resources did not load. Retrying automatically…' });
      deadline ??= setTimeout(giveUp, TILE_RECOVERY_TIMEOUT_MS);
      retryTimer ??= setTimeout(retry, TILE_RETRY_DELAYS[attempts]);
      return true;
    },
    canPublishReady() {
      if (isDisposed) return false;
      pruneResolved();
      if (pending.size > 0) return false;
      if (hasFailures) {
        clearTimers();
        attempts = 0;
        isExhausted = false;
        hasFailures = false;
        report(null);
      }
      return true;
    },
    dispose() {
      isDisposed = true;
      clearTimers();
      pending.clear();
    },
  };
}
