import mlcontour from 'maplibre-contour';
import { decodeTerrariumBlob, fetchDemBlob, MAX_DEM_ZOOM, TERRAIN_TILE_URL } from './demTiles';
import { CONTOUR_PROTOCOL, type ContourWorkerRequest, type ContourWorkerResponse } from './contourWorkerMessages';

const source = new mlcontour.DemSource({ url: TERRAIN_TILE_URL, maxzoom: MAX_DEM_ZOOM, worker: false, cacheSize: 32 });
source.manager = new mlcontour.LocalDemManager({
  demUrlPattern: TERRAIN_TILE_URL, encoding: 'terrarium', maxzoom: MAX_DEM_ZOOM, cacheSize: 32, timeoutMs: 15_000,
  getTile: async (url, controller) => ({ data: await fetchDemBlob(url, controller.signal) }),
  decodeImage: async (blob, _encoding, controller) => {
    const data = await decodeTerrariumBlob(blob, controller.signal);
    if (data.some((value) => !Number.isFinite(value))) throw new Error('Elevation data is missing in a contour tile.');
    return { width: 256, height: 256, data };
  },
});
const tasks = new Map<number, AbortController>();
const queue: Extract<ContourWorkerRequest, { kind: 'tile' }>[] = [];
const state = { running: 0 };
const post = (message: ContourWorkerResponse, transfer: Transferable[] = []) => self.postMessage(message, { transfer });

function parseRequest(url: string) {
  const parsed = new URL(url);
  const interval = Number(parsed.searchParams.get('interval'));
  const [x, y] = parsed.pathname.slice(1).split('/').map(Number);
  const z = Number(parsed.hostname);
  if (parsed.protocol !== `${CONTOUR_PROTOCOL}:` || [z, x, y].some((value) => !Number.isSafeInteger(value)) || z < 0 || z > 14 || [x, y].some((value) => value < 0 || value >= 2 ** z)) {
    throw new Error('Invalid contour tile request.');
  }
  if (!Number.isFinite(interval) || interval < 1 || interval > 10_000) throw new Error('Invalid contour interval.');
  return { z, x, y, interval };
}

function minimumInterval(zoom: number) {
  if (zoom < 8) return 500;
  if (zoom < 10) return 200;
  return zoom < 12 ? 50 : 10;
}

function protocolUrl(url: string): string {
  const { z, x, y, interval } = parseRequest(url);
  // Small-scale maps need coarser contours to bound geometry and remain legible.
  const spacing = Math.max(interval, minimumInterval(z));
  return source.contourProtocolUrl({
    thresholds: { 0: [spacing, spacing * 5] }, contourLayer: 'contours', elevationKey: 'ele', levelKey: 'level',
    extent: 4096, buffer: 1, subsampleBelow: 256,
  }).replace('{z}', () => String(z)).replace('{x}', () => String(x)).replace('{y}', () => String(y));
}

async function run(request: Extract<ContourWorkerRequest, { kind: 'tile' }>) {
  const controller = tasks.get(request.id);
  if (!controller || controller.signal.aborted) return;
  try {
    const response = await source.contourProtocolV4({ url: protocolUrl(request.url) }, controller);
    if (response.data.byteLength > 16 * 1024 * 1024) throw new Error('Contour tile exceeds the geometry limit. Increase the contour interval.');
    if (!controller.signal.aborted) post({ id: request.id, data: response.data }, [response.data]);
  } catch (error) {
    if (!controller.signal.aborted) post({ id: request.id, error: error instanceof Error ? error.message : 'Contour generation failed.' });
  } finally {
    tasks.delete(request.id);
  }
}

function drain() {
  while (state.running < 4 && queue.length > 0) {
    const request = queue.shift()!;
    state.running++;
    void run(request).finally(() => { state.running--; drain(); });
  }
}

self.addEventListener('message', (event: MessageEvent<ContourWorkerRequest>) => {
  const message = event.data;
  if (message.kind === 'cancel') {
    tasks.get(message.id)?.abort();
    tasks.delete(message.id);
    const queued = queue.findIndex(({ id }) => id === message.id);
    if (queued !== -1) queue.splice(queued, 1);
    return;
  }
  if (tasks.size >= 128) {
    post({ id: message.id, error: 'Too many contour tiles requested. Zoom in and retry.' });
    return;
  }
  tasks.set(message.id, new AbortController());
  queue.push(message);
  drain();
});
