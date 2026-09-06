import {
  createMapResourceRecovery, mapFailureMessage, TILE_RECOVERY_TIMEOUT_MS, TILE_RETRY_DELAYS,
  type MapFailureEvent,
} from '../../src/map/MapResourceRecovery';

function tileFailure(status = 0) {
  return {
    error: { status, url: 'https://tiles.example/1/0/0.pbf' },
    sourceId: 'basemap',
    source: { type: 'vector' },
    tile: { state: 'errored', tileID: { canonical: { x: 0, y: 0, z: 1 } } },
  };
}

function harness() {
  const map = { refreshTiles: vi.fn(), triggerRepaint: vi.fn() };
  const report = vi.fn();
  return { map, report, recovery: createMapResourceRecovery(map as never, report) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('retries a failed tile without treating MapLibre idle or errored-as-loaded as success', () => {
  const { recovery, map, report } = harness();
  const event = tileFailure();
  expect(recovery.handleError(event)).toBe(true);
  expect(recovery.canPublishReady()).toBe(false);
  vi.advanceTimersByTime(TILE_RETRY_DELAYS[0]);
  expect(map.refreshTiles).toHaveBeenCalledExactlyOnceWith('basemap', [{ x: 0, y: 0, z: 1 }]);
  event.tile.state = 'loading';
  expect(recovery.canPublishReady()).toBe(false);
  event.tile.state = 'loaded';
  expect(recovery.canPublishReady()).toBe(true);
  expect(report).toHaveBeenLastCalledWith(null);
  vi.advanceTimersByTime(TILE_RECOVERY_TIMEOUT_MS);
  expect(report).toHaveBeenLastCalledWith(null);
});

it('coalesces errors and caps persistent failure at two retry rounds', () => {
  const { recovery, map, report } = harness();
  const event = tileFailure(503);
  for (let index = 0; index < 10; index++) recovery.handleError(event);
  vi.advanceTimersByTime(TILE_RETRY_DELAYS[0]);
  recovery.handleError(event);
  vi.advanceTimersByTime(TILE_RETRY_DELAYS[1]);
  for (let index = 0; index < 10; index++) recovery.handleError(event);
  vi.advanceTimersByTime(60_000);
  expect(map.refreshTiles).toHaveBeenCalledTimes(2);
  expect(recovery.canPublishReady()).toBe(false);
  expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'resource', message: expect.stringContaining('still unavailable') }));
});

it('bounds a retry whose request never settles', () => {
  const { recovery, map, report } = harness();
  recovery.handleError(tileFailure());
  vi.advanceTimersByTime(TILE_RECOVERY_TIMEOUT_MS);
  expect(map.refreshTiles).toHaveBeenCalledTimes(1);
  expect(report).toHaveBeenLastCalledWith(expect.not.objectContaining({ retrying: true }));
  expect(recovery.canPublishReady()).toBe(false);
});

it('keeps recovery bounded when the failed tile retires but the rest of the map never becomes ready', () => {
  const { recovery, map, report } = harness();
  const event = tileFailure();
  recovery.handleError(event);
  event.tile.state = 'unloaded';
  vi.advanceTimersByTime(TILE_RECOVERY_TIMEOUT_MS);
  expect(map.refreshTiles).not.toHaveBeenCalled();
  expect(report).toHaveBeenLastCalledWith(expect.not.objectContaining({ retrying: true }));
  expect(recovery.canPublishReady()).toBe(true);
});

it.each(['unloaded', 'loaded'])('retires a %s tile without keeping a stale failure after viewport changes', (state) => {
  const { recovery, map, report } = harness();
  const event = tileFailure();
  recovery.handleError(event);
  event.tile.state = state;
  vi.advanceTimersByTime(TILE_RETRY_DELAYS[0]);
  expect(recovery.canPublishReady()).toBe(true);
  expect(report).toHaveBeenLastCalledWith(null);
  vi.advanceTimersByTime(TILE_RECOVERY_TIMEOUT_MS);
  expect(map.refreshTiles).not.toHaveBeenCalled();
  expect(report).toHaveBeenLastCalledWith(null);
});

it.each([
  { error: new Error('Invalid layer data'), source: { type: 'geojson' } },
  { error: new Error('Invalid style property'), layer: { id: 'bad' } },
  { error: new Error('WebGL context lost') },
  tileFailure(401),
  tileFailure(403),
  { ...tileFailure(503), tile: undefined },
  { ...tileFailure(503), source: { type: 'geojson' } },
])('does not automatically retry renderer, content, authorization, or non-tile failures: %j', (event) => {
  const { recovery, map } = harness();
  expect(recovery.handleError(event as MapFailureEvent)).toBe(false);
  vi.advanceTimersByTime(60_000);
  expect(map.refreshTiles).not.toHaveBeenCalled();
});

it('classifies structured network errors rather than matching ambiguous error text', () => {
  expect(mapFailureMessage(tileFailure(), true).kind).toBe('resource');
  expect(mapFailureMessage({ error: new Error('Failed to fetch') }, true).kind).toBe('renderer');
  expect(mapFailureMessage({ layer: { id: 'bad' } }, true).kind).toBe('content');
  expect(mapFailureMessage(undefined, false).kind).toBe('style');
});

it('cancels all delayed work on disposal', () => {
  const { recovery, map, report } = harness();
  recovery.handleError(tileFailure());
  recovery.dispose();
  report.mockClear();
  vi.advanceTimersByTime(60_000);
  expect(map.refreshTiles).not.toHaveBeenCalled();
  expect(report).not.toHaveBeenCalled();
  expect(recovery.handleError(tileFailure())).toBe(false);
  expect(recovery.canPublishReady()).toBe(false);
});
