import { Marker, type Map as MapLibreMap } from "maplibre-gl";
import { isValidPosition } from "../domain/routeGeometry";

type Position = [number, number];

export type DraftRouteMarker = {
  addTo: (map: DraftRouteMap) => DraftRouteMarker;
  getElement: () => HTMLElement;
  getLngLat: () => { lng: number; lat: number };
  on: (
    event: "dragstart" | "drag" | "dragend",
    handler: () => void,
  ) => DraftRouteMarker;
  remove: () => void;
  setLngLat: (coordinate: readonly [number, number]) => DraftRouteMarker;
};

type DraftRouteMap = Pick<MapLibreMap, "project" | "unproject">;
type MarkerFactory = (element: HTMLElement) => DraftRouteMarker;

export type DraftRouteEditing = {
  active: boolean;
  focusRequest: { index: number; request: number };
  onMoveBegin: () => void;
  onMoveCommit: () => void;
  onMovePreview: (
    index: number,
    coordinate: readonly [number, number],
  ) => boolean;
  points: readonly (readonly [number, number])[];
};

export type DraftRouteEditingSession = {
  destroy: () => void;
  focusPoint: (index: number) => void;
  update: (points: readonly (readonly [number, number])[]) => void;
};

const createMapLibreMarker: MarkerFactory = (element) =>
  new Marker({ draggable: true, element }) as unknown as DraftRouteMarker;

function normalizedCoordinate(
  longitude: number,
  latitude: number,
): Position | null {
  if (!isValidPosition(longitude, latitude)) return null;
  return [Number(longitude.toFixed(6)), Number(latitude.toFixed(6))];
}

export function installDraftRouteEditing(
  map: DraftRouteMap,
  editing: DraftRouteEditing,
  createMarker: MarkerFactory = createMapLibreMarker,
): DraftRouteEditingSession {
  let points = editing.points.map(
    ([longitude, latitude]) => [longitude, latitude] as Position,
  );
  const markers = points.map((coordinate, index) => {
    const element = document.createElement("button");
    element.type = "button";
    element.className = "draft-route-point-marker";
    element.dataset.draftPointIndex = String(index);
    element.setAttribute("aria-label", `Move draft route point ${index + 1}`);
    element.title = `Move draft route point ${index + 1} · Arrow keys nudge`;
    const marker = createMarker(element).setLngLat(coordinate).addTo(map);
    const preview = (next: Position) => {
      if (!editing.onMovePreview(index, next)) {
        marker.setLngLat(points[index]);
        return false;
      }
      marker.setLngLat(next);
      return true;
    };
    marker.on("dragstart", editing.onMoveBegin);
    marker.on("drag", () => {
      const { lng, lat } = marker.getLngLat();
      const next = normalizedCoordinate(lng, lat);
      if (next) preview(next);
    });
    marker.on("dragend", () => {
      const { lng, lat } = marker.getLngLat();
      const next = normalizedCoordinate(lng, lat);
      if (!next || !preview(next)) return;
      editing.onMoveCommit();
    });
    element.addEventListener("keydown", (event) => {
      if (
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      ) return;
      event.preventDefault();
      event.stopPropagation();
      editing.onMoveBegin();
      const current = marker.getLngLat();
      const pixel = map.project([current.lng, current.lat]);
      const step = event.shiftKey ? 1 : 8;
      switch (event.key) {
        case "ArrowLeft": {
          pixel.x -= step;
          break;
        }
        case "ArrowRight": {
          pixel.x += step;
          break;
        }
        case "ArrowUp": {
          pixel.y -= step;
          break;
        }
        case "ArrowDown": {
          pixel.y += step;
          break;
        }
      }
      const unprojected = map.unproject(pixel);
      const next = normalizedCoordinate(unprojected.lng, unprojected.lat);
      if (next && preview(next)) editing.onMoveCommit();
    });
    return marker;
  });
  return {
    destroy: () => {
      for (const marker of markers) marker.remove();
    },
    focusPoint: (index) => markers[index]?.getElement().focus(),
    update: (nextPoints) => {
      points = nextPoints.map(
        ([longitude, latitude]) => [longitude, latitude] as Position,
      );
      for (const [index, point] of points.entries()) {
        markers[index]?.setLngLat(point);
      }
    },
  };
}
