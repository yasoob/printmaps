import { createArcGeometry } from "../../domain/routeArcGeometry";
import type { ContentLayer } from "../../domain/project";
import type { DirectionsRouteInput } from "../../domain/project";
import {
  buildRouteCoordinates,
  markerAppearanceFor,
  type RouteAuthoringOptions,
} from "../../domain/routeProfiles";

export function countDistinctPoints(
  points: readonly (readonly [number, number])[],
): number {
  return new Set(
    points.map(([longitude, latitude]) => `${longitude},${latitude}`),
  ).size;
}

function uniqueLayerId(projectLayers: readonly ContentLayer[]) {
  const usedIds = new Set(projectLayers.map((layer) => layer.id));
  return (base: string) => {
    let id = base;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    return id;
  };
}

export function createIsochroneCenterLayer(
  center: readonly [number, number] | undefined,
  projectLayers: ContentLayer[],
): ContentLayer[] {
  if (!center) return [];
  const id = uniqueLayerId(projectLayers)("isochrone-center");
  return [
    {
      id,
      name: "Travel-time center",
      type: "poi",
      visible: true,
      locked: true,
      opacity: 100,
      appearance: {
        kind: "poi",
        color: "#202124",
        size: 16,
        markerShape: "circle",
        markerSymbol: "information",
        label: "",
        customAssetId: null,
      },
      geometry: { type: "Point", coordinates: [center[0], center[1]] },
    },
  ];
}

function routeDraftCoordinates(
  routePoints: [number, number][],
  options: RouteAuthoringOptions,
  roadPreview: DirectionsRouteInput | null,
) {
  if (roadPreview) return roadPreview.geometry;
  const lineShape = options.lineShape === "road" ? "straight" : options.lineShape;
  return buildRouteCoordinates(routePoints, lineShape);
}

function routeDraftGeometry(
  coordinates: [number, number][],
  lineShape: RouteAuthoringOptions["lineShape"],
) {
  if (lineShape !== "arc") {
    return { type: "LineString" as const, coordinates };
  }
  return createArcGeometry(coordinates);
}

function routeDraftKind(
  lineShape: RouteAuthoringOptions["lineShape"],
  hasRoadPreview: boolean,
) {
  if (hasRoadPreview) return "road" as const;
  return lineShape === "road" ? "straight" as const : lineShape;
}

export function createRouteDraftLayers(
  routePoints: [number, number][],
  projectLayers: ContentLayer[],
  options: RouteAuthoringOptions,
  draftOptions: {
    isClosed?: boolean;
    roadPreview?: DirectionsRouteInput | null;
    showPath?: boolean;
  } = {},
): ContentLayer[] {
  const isClosed = draftOptions.isClosed ?? false;
  const roadPreview = draftOptions.roadPreview ?? null;
  const showPath = draftOptions.showPath ?? true;
  const uniqueId = uniqueLayerId(projectLayers);
  const editablePoints = isClosed ? routePoints.slice(0, -1) : routePoints;
  const pointLayers: ContentLayer[] = editablePoints.map((coordinates, index) => ({
    id: uniqueId(`route-draft-point-${index + 1}`),
    name: `Route point ${index + 1}`,
    type: "poi",
    visible: true,
    locked: true,
    opacity: 100,
    geometry: { type: "Point", coordinates },
  }));
  if (!showPath || routePoints.length < 2) return pointLayers;
  const coordinates = routeDraftCoordinates(routePoints, options, roadPreview);
  if (coordinates.length < 2) return pointLayers;
  const geometry = routeDraftGeometry(coordinates, options.lineShape);
  if (!geometry) return pointLayers;
  return [
    ...pointLayers,
    {
      id: uniqueId("route-draft"),
      name: "Route draft",
      type: "route",
      route: {
        kind: routeDraftKind(options.lineShape, roadPreview !== null),
        closed: isClosed,
      },
      visible: true,
      locked: true,
      opacity: 100,
      appearance: {
        kind: "route",
        color: "#d9363e",
        width: 4,
        strokeStyle: "solid",
        marker: markerAppearanceFor(options.travelMarker),
        segmentStyles: Array.from({ length: routePoints.length - 1 }, () => null),
      },
      geometry,
      ...(roadPreview && {
        provenance: {
          provider: "mapbox" as const,
          service: "directions-v5" as const,
          waypoints: roadPreview.waypoints.map(
            ([longitude, latitude]) => [longitude, latitude] as [number, number],
          ),
          profile: roadPreview.profile,
          distanceMeters: roadPreview.distanceMeters,
          durationSeconds: roadPreview.durationSeconds,
        },
      }),
    },
  ];
}

export function createShapeDraftLayers(
  shapePoints: [number, number][],
  projectLayers: ContentLayer[],
): ContentLayer[] {
  const uniqueId = uniqueLayerId(projectLayers);
  const pointLayers: ContentLayer[] = shapePoints.map((coordinates, index) => ({
    id: uniqueId(`shape-draft-point-${index + 1}`),
    name: `Shape vertex ${index + 1}`,
    type: "poi",
    visible: true,
    locked: true,
    opacity: 100,
    geometry: { type: "Point", coordinates },
  }));
  if (shapePoints.length < 2) return pointLayers;
  if (countDistinctPoints(shapePoints) < 3)
    return [
      ...pointLayers,
      {
        id: uniqueId("shape-draft-outline"),
        name: "Shape draft outline",
        type: "route",
        route: { kind: "straight", closed: false },
        visible: true,
        locked: true,
        opacity: 100,
        appearance: {
          kind: "route",
          color: "#d9363e",
          width: 4,
          strokeStyle: "solid",
          marker: null,
          segmentStyles: Array.from({ length: shapePoints.length - 1 }, () => null),
        },
        geometry: { type: "LineString", coordinates: shapePoints },
      },
    ];
  return [
    ...pointLayers,
    {
      id: uniqueId("shape-draft"),
      name: "Shape draft",
      type: "shape",
      visible: true,
      locked: true,
      opacity: 28,
      geometry: {
        type: "Polygon",
        coordinates: [[...shapePoints, shapePoints[0]]],
      },
    },
  ];
}
