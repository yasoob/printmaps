import { Map as MapLibreMap } from "maplibre-gl";

export type MapLibreMutation = {
  operation: string;
  target: string | null;
};

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
] as const;

type MutableMethod = (...arguments_: unknown[]) => unknown;
type MutablePrototype = Record<PropertyKey, unknown>;

function patchSource(
  source: object,
  id: string,
  record: (mutation: MapLibreMutation) => void,
) {
  const mutable = source as MutablePrototype;
  if (Object.hasOwn(mutable, PATCHED_SOURCE)) return;
  const setData = mutable.setData;
  if (typeof setData !== "function") return;
  Object.defineProperty(source, PATCHED_SOURCE, { value: true });
  mutable.setData = new Proxy(setData as MutableMethod, {
    apply(target, thisArgument, arguments_) {
      record({ operation: "setData", target: id });
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
          operation: methodName,
          target: typeof arguments_[0] === "string" ? arguments_[0] : null,
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
        patchSource(source, id, record);
      }
      return source;
    },
  });
}
