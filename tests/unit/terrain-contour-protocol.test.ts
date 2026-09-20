import type { StyleSpecification } from 'maplibre-gl';
const protocols = vi.hoisted(() => ({ add: vi.fn(), remove: vi.fn() }));
vi.mock('maplibre-gl', () => ({ addProtocol: protocols.add, removeProtocol: protocols.remove }));
import { retainContourProtocol, retainTerrainStyleResources } from '../../src/terrain/contourProtocol';

class MockWorker {
  static instances: MockWorker[] = [];
  postMessage = vi.fn();
  terminate = vi.fn();
  handlers = new Map<string, (event: { data: unknown }) => void>();
  addEventListener = (name: string, handler: (event: { data: unknown }) => void) => this.handlers.set(name, handler);
  constructor() { MockWorker.instances.push(this); }
}

beforeEach(() => {
  vi.clearAllMocks();
  MockWorker.instances = [];
  vi.stubGlobal('Worker', MockWorker);
});
afterEach(() => vi.unstubAllGlobals());

it('retains one shared worker across live/export maps and terminates it only after the last release', () => {
  const releaseLive = retainContourProtocol();
  const releaseExport = retainContourProtocol();
  expect(MockWorker.instances).toHaveLength(1);
  const worker = MockWorker.instances[0];
  releaseLive();
  expect(worker.terminate).not.toHaveBeenCalled();
  releaseExport();
  releaseExport();
  expect(worker.terminate).toHaveBeenCalledTimes(1);
  expect(protocols.remove).toHaveBeenCalledWith('pms-contours');
});

it('returns worker vector tile bytes and propagates cancellation and failure', async () => {
  const release = retainContourProtocol();
  const handler = protocols.add.mock.calls[0][1];
  const worker = MockWorker.instances[0];
  const controller = new AbortController();
  const response = handler({ url: 'pms-contours://10/5/5?interval=100' }, controller);
  const { id } = worker.postMessage.mock.calls[0][0];
  const data = new ArrayBuffer(5);
  worker.handlers.get('message')!({ data: { id, data } });
  await expect(response).resolves.toEqual({ data });
  const cancelled = handler({ url: 'pms-contours://10/5/5?interval=100' }, controller);
  controller.abort();
  await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
  expect(worker.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'cancel' }));
  const failed = handler({ url: 'pms-contours://10/5/5?interval=100' }, new AbortController());
  const failedId = worker.postMessage.mock.calls.at(-1)![0].id;
  worker.handlers.get('message')!({ data: { id: failedId, error: 'No elevation data' } });
  await expect(failed).rejects.toThrow('No elevation data');
  release();
});

it('does not allocate worker resources for a normal terrain-only or flat style', () => {
  const style: StyleSpecification = { version: 8, layers: [], sources: {} };
  retainTerrainStyleResources(style)();
  expect(MockWorker.instances).toHaveLength(0);
  style.sources.contours = { type: 'vector', tiles: ['pms-contours://{z}/{x}/{y}?interval=100'] };
  const release = retainTerrainStyleResources(style);
  expect(MockWorker.instances).toHaveLength(1);
  release();
});
