import { act, renderHook, waitFor } from "@testing-library/react";
import { useRouteTransformOperations } from "../../../src/app/hooks/useRouteTransformOperations";
import type {
  ContentLayer,
  DirectionsRouteInput,
} from "../../../src/domain/project";
import type {
  DirectionsProvider,
  DirectionsResponse,
} from "../../../src/services/mapbox/contracts";
import type { ProjectState } from "../../../src/app/store";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function straight(): ContentLayer {
  return {
    id: "route",
    name: "Route",
    type: "route",
    route: { kind: "straight", closed: false },
    visible: true,
    locked: false,
    opacity: 80,
    appearance: {
      kind: "route",
      color: "#d9363e",
      width: 4,
      strokeStyle: "solid",
      marker: null,
      segmentStyles: [null, null],
    },
    geometry: { type: "LineString", coordinates: [[0, 0], [1, 1], [2, 0]] },
  };
}

function road(isClosed = false): ContentLayer {
  const waypoints = isClosed
    ? [[0, 0], [1, 1], [2, 0], [0, 0]] as [number, number][]
    : [[0, 0], [1, 1], [2, 0]] as [number, number][];
  return {
    ...straight(),
    route: { kind: "road", closed: isClosed },
    appearance: {
      kind: "route",
      color: "#d9363e",
      width: 4,
      strokeStyle: "solid",
      marker: null,
      segmentStyles: Array.from({ length: waypoints.length - 1 }, () => null),
    },
    geometry: { type: "LineString", coordinates: waypoints },
    provenance: {
      provider: "mapbox",
      service: "directions-v5",
      waypoints,
      profile: "walking",
      distanceMeters: 100,
      durationSeconds: 50,
    },
  };
}

const response: DirectionsResponse = {
  routes: [{
    geometry: [[0, 0], [1, 1], [2, 0]],
    distanceMeters: 120,
    durationSeconds: 60,
  }],
  useBoundary: "provider-response-use-requires-terms-review",
};

it("retains Road conversion choices after a stale failure and retries against the latest layer", async () => {
  const directions = vi.fn<DirectionsProvider["directions"]>().mockResolvedValue(response);
  const transformRoute = vi.fn()
    .mockReturnValueOnce({ ok: false as const, error: "This route changed before the operation finished." })
    .mockReturnValue({ ok: true as const, routeId: "route" });
  const updated = { ...straight(), name: "Updated route" };
  const { result, rerender } = renderHook(
    ({ layer }) => useRouteTransformOperations({
      documentEpoch: 3,
      layer,
      provider: { directions },
      transformRoute,
    }),
    { initialProps: { layer: straight() } },
  );

  act(() => {
    result.current.setTargetKind("road");
    result.current.setRoadTravelMode("bike");
  });
  act(() => result.current.beginConvert());
  expect(result.current.state?.phase).toBe("confirming");
  await act(async () => result.current.confirm());
  await waitFor(() => expect(result.current.state?.phase).toBe("error"));

  expect(result.current.targetKind).toBe("road");
  expect(result.current.roadTravelMode).toBe("bike");
  expect(directions).toHaveBeenCalledWith(expect.objectContaining({
    profile: "cycling",
    waypoints: [[0, 0], [1, 1], [2, 0]],
  }));

  rerender({ layer: updated });
  act(() => result.current.retry());
  await waitFor(() => expect(transformRoute).toHaveBeenCalledTimes(2));
  expect(transformRoute.mock.calls[1]?.[0].expectedLayer).toBe(updated);
  expect(result.current.state).toBeNull();
});

it.each([
  {
    name: "reverse",
    layer: road(),
    begin: "beginReverse" as const,
    waypoints: [[2, 0], [1, 1], [0, 0]],
  },
  {
    name: "close",
    layer: road(),
    begin: "beginClose" as const,
    waypoints: [[0, 0], [1, 1], [2, 0], [0, 0]],
  },
  {
    name: "open",
    layer: road(true),
    begin: "beginOpen" as const,
    waypoints: [[0, 0], [1, 1], [2, 0]],
  },
])("reroutes Road $name with persisted profile and semantic waypoints", async ({
  begin,
  layer,
  waypoints,
}) => {
  const directions = vi.fn<DirectionsProvider["directions"]>().mockResolvedValue(response);
  const transformRoute = vi.fn<ProjectState["transformRoute"]>(
    () => ({ ok: true as const, routeId: "route" }),
  );
  const { result } = renderHook(() => useRouteTransformOperations({
    documentEpoch: 0,
    layer,
    provider: { directions },
    transformRoute,
  }));

  act(() => result.current[begin]());
  await act(async () => result.current.confirm());
  await waitFor(() => expect(transformRoute).toHaveBeenCalledTimes(1));

  expect(directions).toHaveBeenCalledWith(expect.objectContaining({
    profile: "walking",
    waypoints,
  }));
  const roadInput = transformRoute.mock.calls[0]?.[0].road as DirectionsRouteInput;
  expect(roadInput.waypoints).toEqual(waypoints);
  expect(roadInput.profile).toBe("walking");
});

it("aborts superseded requests and ignores their late responses", async () => {
  const first = deferred<DirectionsResponse>();
  const second = deferred<DirectionsResponse>();
  const directions = vi.fn<DirectionsProvider["directions"]>()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const transformRoute = vi.fn(() => ({ ok: true as const, routeId: "route" }));
  const { result } = renderHook(() => useRouteTransformOperations({
    documentEpoch: 0,
    layer: road(),
    provider: { directions },
    transformRoute,
  }));

  act(() => result.current.beginReverse());
  act(() => result.current.confirm());
  const firstSignal = directions.mock.calls[0]?.[0].signal;
  act(() => result.current.beginReverse());
  expect(firstSignal?.aborted).toBe(true);
  act(() => result.current.confirm());

  second.resolve(response);
  await waitFor(() => expect(transformRoute).toHaveBeenCalledTimes(1));
  first.resolve(response);
  await act(async () => Promise.all([first.promise, second.promise]));
  expect(transformRoute).toHaveBeenCalledTimes(1);
});

it("clears an aborted operation when selection changes", async () => {
  const pending = deferred<DirectionsResponse>();
  const directions = vi.fn<DirectionsProvider["directions"]>().mockReturnValue(pending.promise);
  const transformRoute = vi.fn(() => ({ ok: true as const, routeId: "route" }));
  const first = road();
  const second = { ...straight(), id: "other-route" };
  const { result, rerender } = renderHook(
    ({ layer }) => useRouteTransformOperations({
      documentEpoch: 0,
      layer,
      provider: { directions },
      transformRoute,
    }),
    { initialProps: { layer: first } },
  );

  act(() => result.current.beginReverse());
  act(() => result.current.confirm());
  const signal = directions.mock.calls[0]?.[0].signal;
  expect(result.current.state?.phase).toBe("routing");

  rerender({ layer: second });
  expect(signal?.aborted).toBe(true);
  expect(result.current.state).toBeNull();
  rerender({ layer: first });
  expect(result.current.state).toBeNull();
});

it("leaves local operations provider-free", async () => {
  const directions = vi.fn<DirectionsProvider["directions"]>();
  const transformRoute = vi.fn(() => ({ ok: true as const, routeId: "route" }));
  const { result } = renderHook(() => useRouteTransformOperations({
    documentEpoch: 0,
    layer: straight(),
    provider: { directions },
    transformRoute,
  }));

  act(() => result.current.beginReverse());
  await waitFor(() => expect(transformRoute).toHaveBeenCalledWith(expect.objectContaining({
    operation: { type: "reverse" },
  })));
  expect(directions).not.toHaveBeenCalled();
});
