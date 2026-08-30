import { createArcGeometry } from "../domain/routeArcGeometry";
import { createDefaultRouteAppearance } from "../domain/project";
import { isValidPosition } from "../domain/routeGeometry";
import { routePointValidationError } from "../domain/routeModel";
import {
  buildRouteCoordinates,
  DEFAULT_ROUTE_AUTHORING_OPTIONS,
  isRouteAuthoringOptions,
  type RouteAuthoringOptions,
  markerAppearanceFor,
} from "../domain/routeProfiles";
import type { ProjectState } from "./store";
import {
  commitDocument,
  replaceLayers,
  type ProjectSet,
} from "./storeDocument";

function isValidLocalRouteInput(
  coordinates: readonly (readonly [number, number])[],
  options: unknown,
): options is RouteAuthoringOptions {
  if (!isRouteAuthoringOptions(options) || options.lineShape === "road")
    return false;
  if (routePointValidationError(coordinates, {
    kind: options.lineShape,
    closed: false,
  })) return false;
  return coordinates.every((position) =>
    isValidPosition(position[0], position[1]),
  );
}

export function createRouteAction(
  set: ProjectSet,
): ProjectState["createRoute"] {
  return (coordinates, options = DEFAULT_ROUTE_AUTHORING_OPTIONS) => {
    let result: ReturnType<ProjectState["createRoute"]> = {
      ok: false,
      error: "The route needs at least two valid, distinct points.",
    };
    set((state) => {
      if (!isValidLocalRouteInput(coordinates, options)) return state;
      const usedIds = new Set(state.document.layers.map((layer) => layer.id));
      let routeNumber = 0;
      let id: string;
      do {
        routeNumber += 1;
        id = `route-${String(routeNumber).padStart(2, "0")}`;
      } while (usedIds.has(id));
      const routeCoordinates = buildRouteCoordinates(
        coordinates,
        options.lineShape,
      );
      if (
        routeCoordinates.length < 2 ||
        routeCoordinates.some(
          ([longitude, latitude]) => !isValidPosition(longitude, latitude),
        )
      )
        return state;
      const geometry =
        options.lineShape === "arc"
          ? createArcGeometry(routeCoordinates)
          : { type: "LineString" as const, coordinates: routeCoordinates };
      if (!geometry) {
        result = {
          ok: false,
          error:
            "This Arc cannot be created from the selected points. Move one of the endpoints and try again.",
        };
        return state;
      }
      const defaultAppearance = createDefaultRouteAppearance(routeCoordinates.length - 1);
      const route = {
        id,
        name: `Route ${String(routeNumber).padStart(2, "0")}`,
        type: "route" as const,
        route: { kind: options.lineShape, closed: false },
        visible: true,
        locked: false,
        opacity: 100,
        appearance: {
          ...defaultAppearance,
          marker: markerAppearanceFor(options.travelMarker),
        },
        geometry,
      };
      const layers = [...state.document.layers];
      const basemapIndex = layers.findIndex(
        (layer) => layer.type === "basemap",
      );
      layers.splice(
        basemapIndex === -1 ? layers.length : basemapIndex,
        0,
        route,
      );
      result = { ok: true, routeId: id };
      return {
        ...commitDocument(state, replaceLayers(state.document, layers)),
        selectedId: id,
      };
    });
    return result;
  };
}
