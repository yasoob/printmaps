import type { AdministrativeArea } from "../domain/administrativeAreas";
import {
  createDefaultLayerAppearance,
  type ContentLayer,
  type ShapeGeometry,
} from "../domain/project";
import {
  parseLayerGeometry,
  geometryPositionCount,
} from "../domain/projectGeometry";
import {
  MAX_PROJECT_COORDINATES,
  MAX_PROJECT_LAYERS,
} from "../domain/projectFile";
import type { ProjectState } from "./store";
import {
  commitDocument,
  replaceLayers,
  type ProjectSet,
} from "./storeDocument";

function layerPositionCount(layer: ContentLayer): number {
  const provenancePositions =
    layer.provenance?.service === "isochrone-v1"
      ? 1
      : (layer.provenance?.service === "directions-v5"
        ? layer.provenance.waypoints.length
        : 0);
  return geometryPositionCount(layer.geometry) + provenancePositions;
}

function validatedAreaGeometry(
  area: AdministrativeArea,
  existingPositionCount: number,
): ShapeGeometry | undefined {
  try {
    const geometry = parseLayerGeometry(
      area.geometry,
      "Administrative area",
      { value: existingPositionCount },
      {
        maximumCoordinates: MAX_PROJECT_COORDINATES,
        fail: (message) => {
          throw new Error(message);
        },
      },
    );
    if (geometry.type === "Polygon" || geometry.type === "MultiPolygon")
      return geometry;
  } catch {
    return undefined;
  }
}

function createAreaLayer(
  set: ProjectSet,
  resolveArea: () => AdministrativeArea | undefined,
) {
  return () => {
    let createdId: string | null = null;
    set((state) => {
      const area = resolveArea();
      if (
        !area ||
        state.document.layers.length >= MAX_PROJECT_LAYERS ||
        area.name.trim() === "" ||
        area.name.length > 200 ||
        area.id.trim() === ""
      )
        return state;
      const existingPositionCount = state.document.layers.reduce(
        (total, layer) => total + layerPositionCount(layer),
        0,
      );
      const geometry = validatedAreaGeometry(area, existingPositionCount);
      if (!geometry) return state;
      const usedIds = new Set(state.document.layers.map((layer) => layer.id));
      const baseId = `admin-${area.id.toLowerCase().replaceAll("+", "-")}`;
      let id = baseId;
      let suffix = 2;
      while (usedIds.has(id)) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }
      if (id.length > 200) return state;
      createdId = id;
      const layer: ContentLayer = {
        id,
        name: area.name,
        type: "shape",
        visible: true,
        locked: false,
        opacity: 28,
        appearance: createDefaultLayerAppearance("shape"),
        geometry,
      };
      const layers = [...state.document.layers];
      const basemapIndex = layers.findIndex(
        (candidate) => candidate.type === "basemap",
      );
      layers.splice(
        basemapIndex === -1 ? layers.length : basemapIndex,
        0,
        layer,
      );
      return {
        ...commitDocument(state, replaceLayers(state.document, layers)),
        selectedId: id,
      };
    });
    return createdId;
  };
}

export function createAdministrativeAreaActions(
  set: ProjectSet,
): Pick<ProjectState, "createAdministrativeArea"> {
  return {
    createAdministrativeArea: (area) => createAreaLayer(set, () => area)(),
  };
}
