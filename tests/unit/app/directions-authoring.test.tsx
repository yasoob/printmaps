import { act, renderHook } from '@testing-library/react';
import { useDirectionsAuthoring } from '../../../src/app/hooks/useDirectionsAuthoring';
import type { DirectionsProvider, DirectionsResponse } from '../../../src/services/mapbox/contracts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
}

const response: DirectionsResponse = {
  routes: [{
    geometry: [[16.31, 48.19], [16.355, 48.215], [16.4, 48.24]],
    distanceMeters: 9200,
    durationSeconds: 1320,
  }],
  useBoundary: 'provider-response-use-requires-terms-review',
};

const options = {
  lineShape: 'road' as const,
  roadTravelMode: 'car' as const,
  travelMarker: null,
};

it('aborts and clears a pending road route when authoring is deactivated', async () => {
  const pending = deferred<DirectionsResponse>();
  const provider: DirectionsProvider = { directions: vi.fn(() => pending.promise) };
  const onCreate = vi.fn(() => ({ ok: true as const, routeId: 'route-02' }));
  const { result, rerender } = renderHook(({ active }) => useDirectionsAuthoring({
    active, documentEpoch: 2, onCreate, provider,
  }), { initialProps: { active: true } });
  let request!: ReturnType<typeof result.current.route>;
  await act(async () => {
    request = result.current.route([[16.31, 48.19], [16.4, 48.24]], options);
  });

  rerender({ active: false });
  rerender({ active: true });

  expect((provider.directions as ReturnType<typeof vi.fn>).mock.calls[0][0].signal.aborted).toBe(true);
  expect(result.current.isRouting).toBe(false);
  pending.resolve(response);
  await act(async () => request);
  expect(onCreate).not.toHaveBeenCalled();
});
