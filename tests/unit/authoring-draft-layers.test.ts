import { describe, expect, it } from "vitest";
import { createRouteDraftLayers } from "../../src/app/components/authoringDraftLayers";
import { createInitialProjectDocument } from "../../src/domain/project";

const roadOptions = {
  lineShape: "road" as const,
  roadTravelMode: "car" as const,
  travelMarker: null,
};

describe("route authoring draft layers", () => {
  it("renders Road semantic edits as a local guide until explicitly previewed", () => {
    const points: [number, number][] = [[0, 0], [1, 1], [2, 0]];
    const layers = createRouteDraftLayers(
      points,
      createInitialProjectDocument().layers,
      roadOptions,
    );
    const guide = layers.find(({ name }) => name === "Route draft");

    expect(guide).toMatchObject({
      route: { kind: "straight", closed: false },
      geometry: { type: "LineString", coordinates: points },
    });
    expect(guide?.provenance).toBeUndefined();
  });

  it("can render Road semantic handles without duplicating a persisted route path", () => {
    const layers = createRouteDraftLayers(
      [[0, 0], [1, 1], [2, 0]],
      createInitialProjectDocument().layers,
      roadOptions,
      { showPath: false },
    );

    expect(layers.filter(({ type }) => type === "poi")).toHaveLength(3);
    expect(layers.some(({ name }) => name === "Route draft")).toBe(false);
  });

  it("uses provider geometry only for a successful Road preview", () => {
    const points: [number, number][] = [[0, 0], [1, 1], [2, 0]];
    const geometry: [number, number][] = [
      [0, 0],
      [0.5, 0.8],
      [1, 1],
      [1.5, 0.7],
      [2, 0],
    ];
    const layers = createRouteDraftLayers(
      points,
      createInitialProjectDocument().layers,
      roadOptions,
      {
        roadPreview: {
          geometry,
          waypoints: points,
          profile: "driving",
          distanceMeters: 10,
          durationSeconds: 2,
        },
      },
    );
    const preview = layers.find(({ name }) => name === "Route draft");

    expect(preview).toMatchObject({
      route: { kind: "road", closed: false },
      geometry: { type: "LineString", coordinates: geometry },
      provenance: { service: "directions-v5", waypoints: points },
    });
  });

  it("does not materialize a second handle layer for a loop's closing point", () => {
    const layers = createRouteDraftLayers(
      [[0, 0], [1, 0], [1, 1], [0, 0]],
      createInitialProjectDocument().layers,
      { ...roadOptions, lineShape: "straight" },
      { isClosed: true },
    );
    expect(layers.filter(({ type }) => type === "poi")).toHaveLength(3);
    expect(layers.find(({ name }) => name === "Route draft")?.route?.closed)
      .toBe(true);
  });
});
