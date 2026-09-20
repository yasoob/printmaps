import { addProtocol, removeProtocol, type StyleSpecification } from 'maplibre-gl';
import { CONTOUR_PROTOCOL, type ContourWorkerRequest, type ContourWorkerResponse } from './contourWorkerMessages';

type TileResponse = { data: ArrayBuffer };
type PendingRequest = { finish: (result: ArrayBuffer | Error) => void };
type ProtocolPool = { worker: Worker; pending: Map<number, PendingRequest>; refs: number; nextId: number };
const shared: { pool: ProtocolPool | null } = { pool: null };

function send(worker: Worker, message: ContourWorkerRequest): void {
  worker.postMessage(message);
}

function requestTile(current: ProtocolPool, url: string, signal: AbortSignal): Promise<TileResponse> {
  if (signal.aborted) return Promise.reject(new DOMException('Contours cancelled.', 'AbortError'));
  return new Promise((resolve, reject) => {
    const id = ++current.nextId;
    const cancel = () => {
      send(current.worker, { kind: 'cancel', id });
      finish(new DOMException('Contours cancelled.', 'AbortError'));
    };
    const timer = setTimeout(() => {
      send(current.worker, { kind: 'cancel', id });
      finish(new Error('Contour generation timed out. Increase the contour interval or zoom in.'));
    }, 30_000);
    const finish = (result: ArrayBuffer | Error) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      current.pending.delete(id);
      if (result instanceof ArrayBuffer) resolve({ data: result });
      else reject(result);
    };
    current.pending.set(id, { finish });
    signal.addEventListener('abort', cancel, { once: true });
    send(current.worker, { kind: 'tile', id, url });
  });
}

export function retainContourProtocol(): () => void {
  if (!shared.pool) {
    const worker = new Worker(new URL('contour.worker.ts', import.meta.url), { type: 'module', name: 'terrain-contours' });
    const current: ProtocolPool = { worker, pending: new Map(), refs: 0, nextId: 0 };
    worker.addEventListener('message', (event: MessageEvent<ContourWorkerResponse>) => {
      const result = event.data;
      current.pending.get(result.id)?.finish('error' in result ? new Error(result.error) : result.data);
    });
    worker.addEventListener('error', (event) => {
      for (const request of current.pending.values()) request.finish(new Error(event.message || 'The contour worker failed.'));
    });
    addProtocol(CONTOUR_PROTOCOL, (request, controller) => requestTile(current, request.url, controller.signal));
    shared.pool = current;
  }
  const retained = shared.pool;
  retained.refs++;
  let isReleased = false;
  return () => {
    if (isReleased) return;
    isReleased = true;
    if (--retained.refs > 0) return;
    removeProtocol(CONTOUR_PROTOCOL);
    for (const request of retained.pending.values()) request.finish(new DOMException('Contour renderer released.', 'AbortError'));
    retained.worker.terminate();
    if (shared.pool === retained) shared.pool = null;
  };
}

export function retainTerrainStyleResources(style: StyleSpecification): () => void {
  const hasContours = Object.values(style.sources).some((source) => (
    'tiles' in source && source.tiles?.some((url) => url.startsWith(`${CONTOUR_PROTOCOL}://`))
  ));
  return hasContours ? retainContourProtocol() : () => {};
}
