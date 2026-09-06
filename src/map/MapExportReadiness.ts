import type { Map as MapLibreMap } from 'maplibre-gl';
import { MAP_READY_TIMEOUT_MS } from './MapLifecycleDeadline';

type ExportReadinessOptions = {
  isCurrent: () => boolean;
  isReady: () => boolean;
  signal?: AbortSignal;
};

export function waitForMapExportReady(map: MapLibreMap, options: ExportReadinessOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new DOMException('Export cancelled.', 'AbortError'));
      return;
    }
    const cleanup = () => {
      clearTimeout(timeout);
      map.off('render', handleFrame);
      map.off('idle', handleFrame);
      map.off('error', handleError);
      map.off('remove', handleUnavailable);
      map.off('webglcontextlost', handleUnavailable);
      options.signal?.removeEventListener('abort', handleAbort);
    };
    const finish = (error?: unknown) => {
      cleanup();
      if (error) reject(error); else resolve();
    };
    const handleUnavailable = () => finish(new Error('The map renderer changed while preparing the export.'));
    const handleFrame = () => {
      if (!options.isCurrent()) return handleUnavailable();
      if (map.loaded() && options.isReady()) finish();
    };
    const handleError = (event?: { error?: unknown }) => finish(
      event?.error instanceof Error ? event.error : new Error('The map renderer failed while preparing the export.'),
    );
    const handleAbort = () => finish(new DOMException('Export cancelled.', 'AbortError'));
    const timeout = setTimeout(() => finish(new Error('The map renderer timed out while preparing the export.')), MAP_READY_TIMEOUT_MS);
    options.signal?.addEventListener('abort', handleAbort, { once: true });
    try {
      // A render alone can precede source reloads and lifecycle readiness.
      map.on('render', handleFrame);
      map.on('idle', handleFrame);
      map.on('error', handleError);
      map.on('remove', handleUnavailable);
      map.on('webglcontextlost', handleUnavailable);
      if (!options.isCurrent()) return handleUnavailable();
      map.triggerRepaint();
    } catch (error) {
      finish(error);
    }
  });
}
