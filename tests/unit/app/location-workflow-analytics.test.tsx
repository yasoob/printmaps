import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useLocationSearch } from '../../../src/app/hooks/useLocationSearch';
import { GeolocationControl } from '../../../src/app/components/GeolocationControl';
import type { SearchResponse } from '../../../src/services/mapbox/contracts';
import { deferred, recordWorkflowAnalytics } from '../workflowAnalyticsTestUtils';

const { events } = recordWorkflowAnalytics();
const response: SearchResponse = {
  results: [{ providerFeatureId: 'private-id', label: 'Private address', center: [16.12345, 48.54321] }],
  useBoundary: 'provider-response-use-requires-terms-review',
};

it('tracks settled searches and selection without recording query, provider details, or coordinates', async () => {
  const search = vi.fn(async () => response);
  const { result, rerender } = renderHook(() => useLocationSearch({ search }, [16, 48]));
  rerender();
  expect(events()).toEqual([]);
  await act(async () => result.current.search('Secret query'));
  act(() => result.current.choose(response.results[0]));
  expect(events()).toEqual([
    { action: 'locationSearchStarted' },
    { action: 'locationSearchCompleted' },
    { action: 'locationSelected', source: 'search' },
  ]);
  expect(JSON.stringify(events())).not.toMatch(/Secret|Private|private-id|16\.12345/);
});

it('does not classify a canceled stale search as a success or expose provider failures', async () => {
  const pending = deferred<SearchResponse>();
  const search = vi.fn().mockReturnValueOnce(pending.promise)
    .mockRejectedValueOnce(new Error('Secret query failed at https://provider.invalid'));
  const { result } = renderHook(() => useLocationSearch({ search }, [16, 48]));
  let request!: Promise<void>;
  act(() => { request = result.current.search('Secret query'); });
  act(() => result.current.close());
  await act(async () => { pending.resolve(response); await request; });
  await act(async () => result.current.search('Other query'));
  expect(events()).toEqual([
    { action: 'locationSearchStarted' }, { action: 'locationSearchCancelled' },
    { action: 'locationSearchStarted' }, { action: 'locationSearchFailed' },
  ]);
});

it('waits for the map application callback before geolocation success and cancels on a scope change', () => {
  let success!: PositionCallback;
  const getCurrentPosition = vi.fn((callback: PositionCallback) => { success = callback; });
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } });
  let applied!: () => void;
  const onLocate = vi.fn((_coordinate: [number, number], callback: () => void) => { applied = callback; });
  const view = render(<GeolocationControl locked={false} onLocate={onLocate} requestScope={0} />);
  fireEvent.click(screen.getByRole('button', { name: 'Use my location' }));
  act(() => success({ coords: { longitude: 16.12345, latitude: 48.54321 } } as GeolocationPosition));
  expect(events()).toEqual([{ action: 'geolocationStarted' }]);
  act(() => applied());
  act(() => applied());
  expect(events()).toEqual([{ action: 'geolocationStarted' }, { action: 'geolocationCompleted' }]);
  fireEvent.click(screen.getByRole('button', { name: 'Use my location' }));
  view.rerender(<GeolocationControl locked={false} onLocate={onLocate} requestScope={1} />);
  act(() => success({ coords: { longitude: 16.12345, latitude: 48.54321 } } as GeolocationPosition));
  expect(events().slice(2)).toEqual([{ action: 'geolocationStarted' }, { action: 'geolocationCancelled' }]);
});

it('records unavailable geolocation as a failure without a raw browser error', () => {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
  render(<GeolocationControl locked={false} onLocate={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Use my location' }));
  expect(events()).toEqual([{ action: 'geolocationStarted' }, { action: 'geolocationFailed' }]);
});
