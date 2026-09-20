import {
  observeMapFrameProjection,
  type FrameProjectionMap,
  type MapFrameProjection,
} from '../../src/map/MapFrameProjection';

function harness() {
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextId = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callbacks.set(++nextId, callback);
    return nextId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
  let resize: (() => void) | undefined;
  const disconnect = vi.fn();
  vi.stubGlobal('ResizeObserver', class {
    observe = vi.fn();
    disconnect = disconnect;
    constructor(callback: () => void) { resize = callback; }
  });
  const listeners = new Map<string, () => void>();
  const canvas = document.createElement('canvas');
  canvas.getBoundingClientRect = () => new DOMRect(10, 20, 400, 300);
  const frame = document.createElement('div');
  frame.getBoundingClientRect = () => new DOMRect(50, 40, 200, 100);
  const map: FrameProjectionMap = {
    getCanvas: () => canvas,
    getCenter: () => ({ lng: 14 }),
    getBearing: () => 20,
    getPitch: () => 10,
    project: ([x, y]) => ({ x: x * 10, y: y * 10 }),
    on: (event, listener) => listeners.set(event, listener),
    off: (event) => listeners.delete(event),
  };
  const changes: (MapFrameProjection | null)[] = [];
  const stop = observeMapFrameProjection(map, () => frame, (value) => { changes.push(value); });
  const flush = () => {
    const pending = [...callbacks.values()];
    callbacks.clear();
    for (const callback of pending) callback(0);
  };
  return { callbacks, changes, disconnect, flush, frame, listeners, resize: () => resize?.(), stop };
}

afterEach(() => vi.unstubAllGlobals());

it('reports normalized live projection against the actual print frame', () => {
  const test = harness();
  test.flush();
  expect(test.changes).toHaveLength(1);
  expect(test.changes[0]).toMatchObject({
    frame: { x: 40, y: 20, width: 200, height: 100 },
    referenceLongitude: 14, bearing: 20, pitch: 10,
  });
  expect(test.changes[0]?.projectToFrame([14, 7])).toEqual({ x: 0.5, y: 0.5 });
  test.stop();
});

it('coalesces move/resize updates and observes frame-only layout changes', () => {
  const test = harness();
  test.flush();
  test.listeners.get('move')?.();
  test.listeners.get('resize')?.();
  test.resize();
  expect(test.callbacks.size).toBe(1);
  test.frame.getBoundingClientRect = () => new DOMRect(50, 40, 100, 100);
  test.flush();
  expect(test.changes.at(-1)?.frame.width).toBe(100);
  test.stop();
});

it('invalidates unmounted projectors and removes all scheduled work/listeners', () => {
  const test = harness();
  test.flush();
  const oldProjection = test.changes[0];
  test.listeners.get('move')?.();
  test.stop();
  expect(test.callbacks.size).toBe(0);
  expect(test.listeners.size).toBe(0);
  expect(test.disconnect).toHaveBeenCalledOnce();
  expect(test.changes.at(-1)).toBeNull();
  expect(() => oldProjection?.projectToFrame([0, 0])).toThrow('no longer available');
  test.flush();
  expect(test.changes).toHaveLength(2);
});

it('reports unavailable layout rather than an invalid coordinate transform', () => {
  const test = harness();
  test.frame.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);
  test.flush();
  expect(test.changes).toEqual([null]);
  test.stop();
});
