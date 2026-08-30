import {
  createProjectStore,
  type RouteTransformOperation,
} from "../../src/app/store";
import {
  createInitialProjectDocument,
  type DirectionsRouteInput,
} from "../../src/domain/project";
import { semanticRoutePoints } from "../../src/domain/routeModel";

function selectedRoute(store: ReturnType<typeof createProjectStore>) {
  return store.getState().document.layers.find(({ id }) => id === "route-01")!;
}

function roadInput(
  waypoints: readonly (readonly [number, number])[],
  profile: DirectionsRouteInput["profile"] = "walking",
): DirectionsRouteInput {
  return {
    geometry: waypoints.map(([longitude, latitude]) => [longitude, latitude]),
    waypoints: waypoints.map(([longitude, latitude]) => [longitude, latitude]),
    profile,
    distanceMeters: 1200,
    durationSeconds: 480,
  };
}

function reversedCopy<T>(values: readonly T[]): T[] {
  return values.map((_, index) => values[values.length - index - 1]);
}

describe("atomic route store transformations", () => {
  it("converts, reverses, closes, and opens local routes in one history entry each", () => {
    const store = createProjectStore(createInitialProjectDocument());
    store.getState().selectLayer("route-01");
    const source = selectedRoute(store);
    if (source.appearance?.kind !== "route") throw new Error("Expected route.");
    source.appearance.marker = {
      pictogram: "bike",
      placement: { type: "fraction", fraction: 0.3 },
      orientToPath: true,
      reverseFacing: true,
    };
    source.appearance.segmentStyles[0] = { color: "#123456", width: 7 };
    const epoch = store.getState().documentEpoch;
    const apply = (operation: RouteTransformOperation) => {
      const expectedLayer = selectedRoute(store);
      const before = store.getState().past.length;
      const result = store.getState().transformRoute({
        id: expectedLayer.id,
        operation,
        expectedDocumentEpoch: epoch,
        expectedLayer,
      });
      expect(result.ok).toBe(true);
      expect(store.getState().past).toHaveLength(before + 1);
    };

    apply({ type: "convert", targetKind: "arc" });
    expect(selectedRoute(store)).toMatchObject({
      id: source.id,
      name: source.name,
      opacity: source.opacity,
      visible: source.visible,
      locked: source.locked,
      route: { kind: "arc", closed: false },
      appearance: {
        marker: source.appearance.marker,
        segmentStyles: source.appearance.segmentStyles,
      },
    });
    apply({ type: "reverse" });
    const reversed = selectedRoute(store);
    expect(semanticRoutePoints(reversed)).toEqual(
      reversedCopy(semanticRoutePoints(source) ?? []),
    );
    expect(reversed.appearance?.kind === "route"
      ? reversed.appearance.segmentStyles
      : []).toEqual(reversedCopy(source.appearance.segmentStyles));
    apply({ type: "close" });
    expect(selectedRoute(store).route).toEqual({ kind: "arc", closed: true });
    apply({ type: "open" });
    expect(selectedRoute(store).route).toEqual({ kind: "arc", closed: false });
    const beforeStraight = selectedRoute(store);
    apply({ type: "convert", targetKind: "straight" });

    store.getState().undo();
    expect(selectedRoute(store)).toEqual(beforeStraight);
    expect(store.getState().selectedId).toBe("route-01");
  });

  it("commits Road conversions and reroutes using semantic waypoints and the persisted profile", () => {
    const store = createProjectStore(createInitialProjectDocument());
    const epoch = store.getState().documentEpoch;
    const applyRoad = (
      operation: RouteTransformOperation,
      waypoints: readonly (readonly [number, number])[],
    ) => {
      const expectedLayer = selectedRoute(store);
      const historyLength = store.getState().past.length;
      const result = store.getState().transformRoute({
        id: expectedLayer.id,
        operation,
        road: roadInput(waypoints),
        expectedDocumentEpoch: epoch,
        expectedLayer,
      });
      if (result.ok) expect(store.getState().past).toHaveLength(historyLength + 1);
      return result;
    };
    const originalPoints = semanticRoutePoints(selectedRoute(store))!;

    expect(applyRoad(
      { type: "convert", targetKind: "road" },
      originalPoints,
    ).ok).toBe(true);
    expect(selectedRoute(store).provenance).toMatchObject({
      service: "directions-v5",
      profile: "walking",
      waypoints: originalPoints,
    });

    const reversedPoints = reversedCopy(originalPoints);
    expect(applyRoad({ type: "reverse" }, reversedPoints).ok).toBe(true);
    expect(selectedRoute(store).provenance).toMatchObject({
      profile: "walking",
      waypoints: reversedPoints,
    });

    const closedPoints = [
      ...reversedPoints,
      [...reversedPoints[0]] as [number, number],
    ];
    expect(applyRoad({ type: "close" }, closedPoints).ok).toBe(true);
    expect(selectedRoute(store).route?.closed).toBe(true);
    expect(applyRoad({ type: "open" }, reversedPoints).ok).toBe(true);
    expect(selectedRoute(store).route?.closed).toBe(false);

    const road = selectedRoute(store);
    expect(store.getState().transformRoute({
      id: road.id,
      operation: { type: "convert", targetKind: "straight" },
      expectedDocumentEpoch: epoch,
      expectedLayer: road,
    }).ok).toBe(true);
    expect(selectedRoute(store).provenance).toBeUndefined();
    expect(selectedRoute(store).geometry).toEqual({
      type: "LineString",
      coordinates: reversedPoints,
    });
  });

  it("rejects stale epochs, stale layer identities, invalid responses, and locked routes without history", () => {
    const store = createProjectStore(createInitialProjectDocument());
    const epoch = store.getState().documentEpoch;
    const expectedLayer = selectedRoute(store);
    const staleEpoch = store.getState().transformRoute({
      id: expectedLayer.id,
      operation: { type: "reverse" },
      expectedDocumentEpoch: epoch + 1,
      expectedLayer,
    });

    expect(staleEpoch).toEqual({ ok: false, error: expect.stringContaining("project changed") });

    store.getState().renameLayer(expectedLayer.id, "Changed");
    const historyLength = store.getState().past.length;
    const staleLayer = store.getState().transformRoute({
      id: expectedLayer.id,
      operation: { type: "reverse" },
      expectedDocumentEpoch: epoch,
      expectedLayer,
    });
    expect(staleLayer).toEqual({ ok: false, error: expect.stringContaining("route changed") });
    expect(store.getState().past).toHaveLength(historyLength);

    const current = selectedRoute(store);
    const invalidRoad = store.getState().transformRoute({
      id: current.id,
      operation: { type: "convert", targetKind: "road" },
      expectedDocumentEpoch: epoch,
      expectedLayer: current,
      road: roadInput([[0, 0], [1, 1]]),
    });
    expect(invalidRoad.ok).toBe(false);
    expect(selectedRoute(store)).toBe(current);
    expect(store.getState().past).toHaveLength(historyLength);

    store.getState().toggleLayerLock(current.id);
    const locked = selectedRoute(store);
    const lockedResult = store.getState().transformRoute({
      id: locked.id,
      operation: { type: "reverse" },
      expectedDocumentEpoch: epoch,
      expectedLayer: locked,
    });
    expect(lockedResult).toEqual({
      ok: false,
      error: "Unlock and show this route before changing its structure.",
    });
  });
});

describe("semantic draft store commits", () => {
  it("atomically commits a full semantic draft and rejects stale draft snapshots", () => {
    const store = createProjectStore(createInitialProjectDocument());
    const source = selectedRoute(store);
    if (source.appearance?.kind !== "route") throw new Error("Expected route.");
    source.appearance.segmentStyles[0] = { color: "#123456" };
    source.appearance.segmentStyles[1] = { width: 8 };
    const points = semanticRoutePoints(source)!;
    const reordered = [points[0], points[2], points[1], points[3]];
    const epoch = store.getState().documentEpoch;
    const result = store.getState().replaceRouteDraft({
      id: source.id,
      points: reordered,
      travelMarker: "bike",
      expectedDocumentEpoch: epoch,
      expectedLayer: source,
    });

    expect(result.ok).toBe(true);
    expect(semanticRoutePoints(selectedRoute(store))).toEqual(reordered);
    expect(selectedRoute(store).appearance).toMatchObject({
      marker: { pictogram: "bike" },
      segmentStyles: [null, { width: 8 }, null],
    });
    expect(store.getState().past).toHaveLength(1);

    const committed = selectedRoute(store);
    const stale = store.getState().replaceRouteDraft({
      id: committed.id,
      points: reordered,
      travelMarker: null,
      expectedDocumentEpoch: epoch + 1,
      expectedLayer: committed,
    });
    expect(stale).toEqual({
      ok: false,
      error: expect.stringContaining("project changed"),
    });
    expect(selectedRoute(store)).toBe(committed);
    expect(store.getState().past).toHaveLength(1);
  });

  it("uses extension splitting and point-removal merging for draft commits", () => {
    const closedDocument = createInitialProjectDocument();
    const closed = closedDocument.layers.find(({ id }) => id === "route-01")!;
    closed.route = { kind: "straight", closed: true };
    closed.geometry = {
      type: "LineString",
      coordinates: [[0, 0], [1, 0], [1, 1], [0, 0]],
    };
    if (closed.appearance?.kind !== "route") throw new Error("Expected route.");
    closed.appearance.segmentStyles = [null, null, { width: 8 }];
    const closedStore = createProjectStore(closedDocument);
    const closedSource = selectedRoute(closedStore);

    expect(closedStore.getState().replaceRouteDraft({
      id: closedSource.id,
      points: [[0, 0], [1, 0], [1, 1], [2, 1]],
      travelMarker: null,
      expectedDocumentEpoch: 0,
      expectedLayer: closedSource,
    }).ok).toBe(true);
    expect(selectedRoute(closedStore).appearance).toMatchObject({
      segmentStyles: [null, null, { width: 8 }, { width: 8 }],
    });

    const openDocument = createInitialProjectDocument();
    const open = openDocument.layers.find(({ id }) => id === "route-01")!;
    open.geometry = { type: "LineString", coordinates: [[0, 0], [1, 0], [2, 0]] };
    if (open.appearance?.kind !== "route") throw new Error("Expected route.");
    open.appearance.segmentStyles = [{ color: "#123456" }, { color: "#123456" }];
    const openStore = createProjectStore(openDocument);
    const openSource = selectedRoute(openStore);

    expect(openStore.getState().replaceRouteDraft({
      id: openSource.id,
      points: [[0, 0], [2, 0]],
      travelMarker: null,
      expectedDocumentEpoch: 0,
      expectedLayer: openSource,
    }).ok).toBe(true);
    expect(selectedRoute(openStore).appearance).toMatchObject({
      segmentStyles: [{ color: "#123456" }],
    });
  });
});
