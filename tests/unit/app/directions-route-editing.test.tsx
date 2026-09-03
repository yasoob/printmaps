import { act, renderHook, waitFor } from '@testing-library/react';
import { useDirectionsRouteEditing } from '../../../src/app/hooks/useDirectionsRouteEditing';
import type { ContentLayer } from '../../../src/domain/project';
import type { DirectionsProvider } from '../../../src/services/mapbox/contracts';

const layer: ContentLayer = {
  id: 'road',
  name: 'Road',
  type: 'route',
  route: { kind: 'road', closed: false },
  visible: true,
  locked: false,
  opacity: 100,
  appearance: { kind: 'route', color: '#d9363e', width: 4, strokeStyle: 'solid', marker: null, segmentStyles: [null, null] },
  geometry: { type: 'LineString', coordinates: [[0, 0], [0.5, 0.5], [1, 1], [1.5, 1.5], [2, 2]] },
  provenance: {
    provider: 'mapbox',
    service: 'directions-v5',
    waypoints: [[0, 0], [1, 1], [2, 2]],
    profile: 'walking',
    distanceMeters: 100,
    durationSeconds: 50,
  },
};

it('reroutes a moved semantic waypoint and refreshes all provider provenance', async () => {
  const directions = vi.fn<DirectionsProvider['directions']>().mockResolvedValue({
    routes: [{ geometry: [[0, 0], [1, 1.5], [2, 2]], distanceMeters: 120, durationSeconds: 60 }],
    useBoundary: 'provider-response-use-requires-terms-review',
  });
  const replaceDirectionsRoute = vi.fn(() => ({ ok: true as const, routeId: 'road' }));
  const { result } = renderHook(() => useDirectionsRouteEditing({
    documentEpoch: 4,
    layers: [layer],
    provider: { directions },
    replaceDirectionsRoute,
  }));

  act(() => { result.current.changeWaypoint('road', 1, [1, 1.5]); });
  await waitFor(() => expect(replaceDirectionsRoute).toHaveBeenCalled());

  expect(directions).toHaveBeenCalledWith(expect.objectContaining({
    profile: 'walking',
    waypoints: [[0, 0], [1, 1.5], [2, 2]],
  }));
  expect(replaceDirectionsRoute).toHaveBeenCalledWith(expect.objectContaining({
    id: 'road',
    input: expect.objectContaining({
      geometry: [[0, 0], [1, 1.5], [2, 2]],
      waypoints: [[0, 0], [1, 1.5], [2, 2]],
      distanceMeters: 120,
      durationSeconds: 60,
    }),
    options: expect.objectContaining({ roadTravelMode: 'walk' }),
    expectedDocumentEpoch: 4,
    expectedLayer: layer,
  }));
});

it('keeps action identities stable while reading the latest layer scope', async () => {
  const directions = vi.fn<DirectionsProvider['directions']>().mockResolvedValue({
    routes: [{ geometry: [[0, 0], [1, 1.5], [2, 2]], distanceMeters: 120, durationSeconds: 60 }],
    useBoundary: 'provider-response-use-requires-terms-review',
  });
  const provider = { directions };
  const replaceDirectionsRoute = vi.fn(() => ({ ok: true as const, routeId: 'road' }));
  const updatedLayer = {
    ...layer,
    appearance: { ...layer.appearance!, color: '#000000' },
  } as ContentLayer;
  const { result, rerender } = renderHook(
    ({ documentEpoch, layers }) => useDirectionsRouteEditing({
      documentEpoch,
      layers,
      provider,
      replaceDirectionsRoute,
    }),
    {
      initialProps: {
        documentEpoch: 4,
        layers: [layer] as ContentLayer[],
      },
    },
  );
  const initialActions = {
    changeWaypoint: result.current.changeWaypoint,
    removeWaypoint: result.current.removeWaypoint,
    retry: result.current.retry,
  };

  rerender({ documentEpoch: 5, layers: [updatedLayer] });

  expect(result.current.changeWaypoint).toBe(initialActions.changeWaypoint);
  expect(result.current.removeWaypoint).toBe(initialActions.removeWaypoint);
  expect(result.current.retry).toBe(initialActions.retry);
  act(() => {
    result.current.changeWaypoint('road', 1, [1, 1.5]);
  });
  await waitFor(() => expect(replaceDirectionsRoute).toHaveBeenCalled());
  expect(replaceDirectionsRoute).toHaveBeenCalledWith(expect.objectContaining({
    expectedDocumentEpoch: 5,
    expectedLayer: updatedLayer,
  }));
});

it('keeps a closed Road endpoint canonical when either duplicate is edited', async () => {
  const closedLayer: ContentLayer = {
    ...layer,
    route: { kind: 'road', closed: true },
    appearance: {
      kind: 'route',
      color: '#d9363e',
      width: 4,
      strokeStyle: 'solid',
      marker: null,
      segmentStyles: [null, null, null],
    },
    geometry: {
      type: 'LineString',
      coordinates: [[0, 0], [1, 0], [1, 1], [0, 0]],
    },
    provenance: {
      provider: 'mapbox',
      service: 'directions-v5',
      waypoints: [[0, 0], [1, 0], [1, 1], [0, 0]],
      profile: 'walking',
      distanceMeters: 100,
      durationSeconds: 50,
    },
  };
  const directions = vi.fn<DirectionsProvider['directions']>().mockResolvedValue({
    routes: [{
      geometry: [[0.25, 0.25], [1, 0], [1, 1], [0.25, 0.25]],
      distanceMeters: 120,
      durationSeconds: 60,
    }],
    useBoundary: 'provider-response-use-requires-terms-review',
  });
  const replaceDirectionsRoute = vi.fn(() => ({ ok: true as const, routeId: 'road' }));
  const { result } = renderHook(() => useDirectionsRouteEditing({
    documentEpoch: 4,
    layers: [closedLayer],
    provider: { directions },
    replaceDirectionsRoute,
  }));

  act(() => {
    result.current.changeWaypoint('road', 0, [0.25, 0.25]);
  });
  await waitFor(() => expect(replaceDirectionsRoute).toHaveBeenCalled());

  const canonical = [[0.25, 0.25], [1, 0], [1, 1], [0.25, 0.25]];
  expect(directions).toHaveBeenCalledWith(expect.objectContaining({
    waypoints: canonical,
  }));
  expect(replaceDirectionsRoute).toHaveBeenCalledWith(expect.objectContaining({
    input: expect.objectContaining({ waypoints: canonical }),
    expectedLayer: expect.objectContaining({
      route: { kind: 'road', closed: true },
    }),
  }));

  act(() => {
    result.current.changeWaypoint('road', 3, [0.5, 0.5]);
  });
  await waitFor(() => expect(directions).toHaveBeenCalledTimes(2));
  expect(directions.mock.calls[1]?.[0].waypoints).toEqual([
    [0.5, 0.5], [1, 0], [1, 1], [0.5, 0.5],
  ]);
});

it('keeps failed waypoint edits recoverable for retry or cancel', async () => {
  const directions = vi.fn<DirectionsProvider['directions']>().mockRejectedValue(new Error('No route found.'));
  const { result } = renderHook(() => useDirectionsRouteEditing({
    documentEpoch: 4,
    layers: [layer],
    provider: { directions },
    replaceDirectionsRoute: vi.fn(),
  }));

  act(() => { result.current.removeWaypoint('road', 1); });
  await waitFor(() => expect(result.current.error).toBe('No route found.'));
  expect(result.current.pendingWaypoints).toEqual([[0, 0], [2, 2]]);
  expect(result.current.statusLayerId).toBe('road');

  act(() => { result.current.retry(); });
  await waitFor(() => expect(directions).toHaveBeenCalledTimes(2));
  act(() => { result.current.cancel(); });
  expect(result.current.pendingWaypoints).toBeNull();
  expect(result.current.error).toBeNull();
});

it('composes a later waypoint edit onto the recoverable pending waypoints', async () => {
  const directions = vi.fn<DirectionsProvider['directions']>().mockRejectedValue(new Error('No route found.'));
  const { result } = renderHook(() => useDirectionsRouteEditing({
    documentEpoch: 4,
    layers: [layer],
    provider: { directions },
    replaceDirectionsRoute: vi.fn(),
  }));

  act(() => { result.current.changeWaypoint('road', 1, [1, 1.5]); });
  await waitFor(() => expect(result.current.error).toBe('No route found.'));
  act(() => { result.current.changeWaypoint('road', 2, [2, 2.5]); });
  await waitFor(() => expect(directions).toHaveBeenCalledTimes(2));

  expect(directions.mock.calls[1]?.[0].waypoints).toEqual([
    [0, 0], [1, 1.5], [2, 2.5],
  ]);
});

it('rebases retry onto compatible current layer metadata', async () => {
  const directions = vi.fn<DirectionsProvider['directions']>().mockResolvedValue({
    routes: [{ geometry: [[0, 0], [1, 1.5], [2, 2]], distanceMeters: 120, durationSeconds: 60 }],
    useBoundary: 'provider-response-use-requires-terms-review',
  });
  const replaceDirectionsRoute = vi.fn()
    .mockReturnValueOnce({ ok: false as const, error: 'The route changed before routing finished.' })
    .mockReturnValue({ ok: true as const, routeId: 'road' });
  const updatedLayer = {
    ...layer,
    appearance: { ...layer.appearance!, color: '#000000' },
  } as ContentLayer;
  const { result, rerender } = renderHook(
    ({ layers }) => useDirectionsRouteEditing({
      documentEpoch: 4,
      layers,
      provider: { directions },
      replaceDirectionsRoute,
    }),
    { initialProps: { layers: [layer] as ContentLayer[] } },
  );

  act(() => { result.current.changeWaypoint('road', 1, [1, 1.5]); });
  await waitFor(() => expect(result.current.error).toBe('The route changed before routing finished.'));
  rerender({ layers: [updatedLayer] });
  act(() => { result.current.retry(); });
  await waitFor(() => expect(replaceDirectionsRoute).toHaveBeenCalledTimes(2));

  expect(replaceDirectionsRoute.mock.calls[1]?.[0].expectedLayer).toBe(updatedLayer);
});
