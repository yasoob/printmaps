import { Map as MapLibreMap } from "maplibre-gl";

export type MapLibreMutation = {
  mapId: number;
  surface: "editor" | "shared" | "video" | "offscreen" | "unknown";
  operation: string;
  target: string | null;
};

const mapIds = new WeakMap<object, number>();
const maps = new Map<number, WeakRef<MapLibreMap>>();
const mapSequence = { next: 1 };
function mapSurface(container: HTMLElement | undefined): MapLibreMutation['surface'] {
  if (!container?.isConnected) return "offscreen";
  if (container.matches('[data-video-export-renderer]')) return "video";
  if (container.closest(".shared-project")) return "shared";
  if (container.closest('[data-testid="map-canvas"]')) return "editor";
  return "unknown";
}
function mapIdentity(map: MapLibreMap): Pick<MapLibreMutation, "mapId" | "surface"> {
  let mapId = mapIds.get(map);
  if (!mapId) {
    mapId = mapSequence.next++;
    mapIds.set(map, mapId);
    maps.set(mapId, new WeakRef(map));
  }
  const container = map.getContainer();
  const surface = mapSurface(container);
  return { mapId, surface };
}

export function readMapLibreProbeCameras() {
  return [...maps.values()].flatMap((reference) => {
    const map = reference.deref();
    if (!map?.getContainer()?.isConnected) return [];
    return [{ ...mapIdentity(map), center: map.getCenter().toArray(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() }];
  });
}

const PATCHED = Symbol.for("print-map-studio:maplibre-render-audit");
const PATCHED_SOURCE = Symbol.for(
  "print-map-studio:maplibre-source-render-audit",
);
const MAP_METHODS = [
  "addLayer",
  "addSource",
  "moveLayer",
  "removeLayer",
  "removeSource",
  "setLayoutProperty",
  "setPaintProperty",
  "setTerrain",
  "addImage",
  "removeImage",
  "setStyle",
  "jumpTo",
  "easeTo",
  "flyTo",
] as const;

type MutableMethod = (...arguments_: unknown[]) => unknown;
type MutablePrototype = Record<PropertyKey, unknown>;

function mutationTarget(method: string, argument: unknown): string | null {
  if (typeof argument === "string") return argument;
  if (argument !== null && typeof argument === "object" && (method === "addLayer" || method === "setTerrain")) {
    return String(Reflect.get(argument, method === "addLayer" ? "id" : "source"));
  }
  return null;
}

function patchSource(
  source: object,
  id: string,
  map: MapLibreMap,
  record: (mutation: MapLibreMutation) => void,
) {
  const mutable = source as MutablePrototype;
  if (Object.hasOwn(mutable, PATCHED_SOURCE)) return;
  const setData = mutable.setData;
  if (typeof setData !== "function") return;
  Object.defineProperty(source, PATCHED_SOURCE, { value: true });
  mutable.setData = new Proxy(setData as MutableMethod, {
    apply(target, thisArgument, arguments_) {
      record({ ...mapIdentity(map), operation: "setData", target: id });
      return Reflect.apply(target, thisArgument, arguments_);
    },
  });
}

export function installMapLibreMutationProbe(
  record: (mutation: MapLibreMutation) => void,
) {
  const prototype = MapLibreMap.prototype as unknown as MutablePrototype;
  if (Object.hasOwn(prototype, PATCHED)) return;
  Object.defineProperty(prototype, PATCHED, { value: true });
  for (const methodName of MAP_METHODS) {
    const method = prototype[methodName];
    if (typeof method !== "function") continue;
    prototype[methodName] = new Proxy(method as MutableMethod, {
      apply(target, thisArgument, arguments_) {
        record({
          ...mapIdentity(thisArgument),
          operation: methodName,
          target: mutationTarget(methodName, arguments_[0]),
        });
        return Reflect.apply(target, thisArgument, arguments_);
      },
    });
  }
  const getSource = prototype.getSource;
  if (typeof getSource !== "function") return;
  prototype.getSource = new Proxy(getSource as MutableMethod, {
    apply(target, thisArgument, arguments_) {
      const source = Reflect.apply(target, thisArgument, arguments_);
      const id = arguments_[0];
      if (source && typeof source === "object" && typeof id === "string") {
        patchSource(source, id, thisArgument, record);
      }
      return source;
    },
  });
}
