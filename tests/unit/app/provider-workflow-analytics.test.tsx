import { act, renderHook } from '@testing-library/react';
import { useDirectionsAuthoring } from '../../../src/app/hooks/useDirectionsAuthoring';
import { useIsochroneAuthoring } from '../../../src/app/hooks/useIsochroneAuthoring';
import { usePoiAddressLookup } from '../../../src/app/hooks/usePoiAddressLookup';
import { createPoiAddressReview } from '../../../src/domain/poiAddressReview';
import type { DirectionsResponse, IsochroneResponse, SearchResponse } from '../../../src/services/mapbox/contracts';
import { deferred, recordWorkflowAnalytics } from '../workflowAnalyticsTestUtils';

const { events } = recordWorkflowAnalytics();
const route: DirectionsResponse = {
  routes: [{ geometry: [[16, 48], [17, 49]], distanceMeters: 1200, durationSeconds: 30 }],
  useBoundary: 'provider-response-use-requires-terms-review',
};
const area: IsochroneResponse = {
  geometry: { type: 'Polygon', coordinates: [[[16, 48], [17, 48], [17, 49], [16, 48]]] },
  useBoundary: 'provider-response-use-requires-terms-review',
};
const authoringOptions = { lineShape: 'road' as const, roadTravelMode: 'car' as const, travelMarker: null };

it('reports directions provider outcomes without duplicating the store route commit', async () => {
  const pending = deferred<DirectionsResponse>();
  const directions = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(route)
    .mockRejectedValueOnce(new Error('Secret provider URL and coordinates'));
  const onCreate = vi.fn(() => ({ ok: true as const, routeId: 'private-route-id' }));
  const hook = renderHook(() => useDirectionsAuthoring({ active: true, documentEpoch: 1, provider: { directions }, onCreate }));
  const waypoints = [[16, 48], [17, 49]] as const;
  let canceled!: ReturnType<typeof hook.result.current.route>;
  act(() => { canceled = hook.result.current.route(waypoints, authoringOptions); });
  act(() => hook.result.current.cancel());
  await act(async () => { pending.resolve(route); await canceled; });
  await act(async () => { await hook.result.current.route(waypoints, authoringOptions); });
  await act(async () => { await hook.result.current.route(waypoints, authoringOptions); });
  expect(events()).toEqual([
    { action: 'directionsStarted' }, { action: 'directionsCancelled' },
    { action: 'directionsStarted' }, { action: 'directionsCompleted' },
    { action: 'directionsStarted' }, { action: 'directionsFailed' },
  ]);
  expect(onCreate).toHaveBeenCalledOnce();
});

it('reports isochrone commit rejection, completion, and lifecycle cancellation once per request', async () => {
  const pending = deferred<IsochroneResponse>();
  const isochrone = vi.fn().mockResolvedValueOnce(area).mockResolvedValueOnce(area).mockReturnValueOnce(pending.promise);
  const onCreate = vi.fn().mockReturnValueOnce({ ok: false, error: 'Private mutation failure' })
    .mockReturnValueOnce({ ok: true, layerId: 'private-id' });
  const hook = renderHook(({ active }) => useIsochroneAuthoring({
    active, documentEpoch: 1, provider: { isochrone }, onCreate,
  }), { initialProps: { active: true } });
  act(() => hook.result.current.setCenter({ coordinate: [16, 48], label: 'Private center name' }));
  expect(events()).toEqual([]);
  await act(async () => hook.result.current.generate());
  await act(async () => hook.result.current.generate());
  let canceled!: Promise<void>;
  act(() => { canceled = hook.result.current.generate(); });
  hook.rerender({ active: false });
  await act(async () => { pending.resolve(area); await canceled; });
  expect(events()).toEqual([
    { action: 'isochroneStarted' }, { action: 'isochroneFailed' },
    { action: 'isochroneStarted' }, { action: 'isochroneCompleted' },
    { action: 'isochroneStarted' }, { action: 'isochroneCancelled' },
  ]);
});

it('reports address lookup at the batch level, including provider failures and late cancellations', async () => {
  const rows = createPoiAddressReview([{ name: 'Private person', address: 'Private home address' }]);
  const response: SearchResponse = {
    results: [{ providerFeatureId: 'private-id', label: 'Private home', center: [16, 48] }],
    useBoundary: 'provider-response-use-requires-terms-review',
  };
  const pending = deferred<SearchResponse>();
  const search = vi.fn().mockResolvedValueOnce(response)
    .mockRejectedValueOnce(new Error('Private provider reason')).mockReturnValueOnce(pending.promise);
  const hook = renderHook(() => usePoiAddressLookup({ documentEpoch: 1, provider: { search }, update: vi.fn() }));
  await act(async () => hook.result.current.start(rows));
  await act(async () => hook.result.current.start(rows));
  let canceled!: Promise<void>;
  act(() => { canceled = hook.result.current.start(rows); });
  act(() => hook.result.current.stop());
  await act(async () => { pending.resolve(response); await canceled; });
  expect(events()).toEqual([
    { action: 'poiAddressLookupStarted' }, { action: 'poiAddressLookupCompleted' },
    { action: 'poiAddressLookupStarted' }, { action: 'poiAddressLookupFailed' },
    { action: 'poiAddressLookupStarted' }, { action: 'poiAddressLookupCancelled' },
  ]);
});
