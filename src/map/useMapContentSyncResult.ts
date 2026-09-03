import {
  useCallback,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { MapContentAdapter } from "./MapContentAdapter";
import type { ContentError } from "./MapCanvasLifecycle";
import { bringTerraRouteHandlesToFront } from "./TerraDrawRouteHandles";

export function scheduleTerraRouteHandleOrder(map: MapLibreMap) {
  const result = bringTerraRouteHandlesToFront(map);
  if (
    result === "moved"
    || typeof map.isStyleLoaded !== "function"
    || typeof map.once !== "function"
  ) {
    return result;
  }
  const event = map.isStyleLoaded() ? "render" : "style.load";
  map.once(event, () => bringTerraRouteHandlesToFront(map));
  return result;
}

function scheduleContentReady(
  readyMap: MapLibreMap | null,
  setContentError: Dispatch<SetStateAction<ContentError | null>>,
  setTerraMap: Dispatch<SetStateAction<MapLibreMap | null>>,
) {
  queueMicrotask(() => {
    setContentError((error) => error?.source === "sync" ? null : error);
    if (!readyMap) return;
    scheduleTerraRouteHandleOrder(readyMap);
    setTerraMap((current) => current === readyMap ? current : readyMap);
  });
}

type ContentSyncResultOptions = {
  contentReadyRef: RefObject<boolean>;
  contentSyncDeferredRef: RefObject<boolean>;
  containerRef: RefObject<HTMLDivElement | null>;
  invalidateExporter: () => void;
  mapRef: RefObject<MapLibreMap | null>;
  setContentError: Dispatch<SetStateAction<ContentError | null>>;
  setTerraMap: Dispatch<SetStateAction<MapLibreMap | null>>;
};

export function useMapContentSyncResult(options: ContentSyncResultOptions) {
  const {
    contentReadyRef,
    contentSyncDeferredRef,
    containerRef,
    invalidateExporter,
    mapRef,
    setContentError,
    setTerraMap,
  } = options;
  return useCallback((
    result: ReturnType<MapContentAdapter["sync"]> | undefined,
  ) => {
    contentSyncDeferredRef.current = result === "deferred";
    if (result === "failed" || result === "deferred") {
      contentReadyRef.current = false;
      containerRef.current?.removeAttribute("data-map-ready");
      invalidateExporter();
    }
    switch (result) {
      case "failed": {
        queueMicrotask(() => setContentError({
          kind: "content",
          source: "sync",
          message: "The map content could not be rendered. Review the layer data and retry.",
        }));
        break;
      }
      case "unchanged": {
        contentReadyRef.current = true;
        break;
      }
      case "synced": {
        contentReadyRef.current = true;
        scheduleContentReady(
          mapRef.current,
          setContentError,
          setTerraMap,
        );
        break;
      }
    }
  }, [
    contentReadyRef,
    contentSyncDeferredRef,
    containerRef,
    invalidateExporter,
    mapRef,
    setContentError,
    setTerraMap,
  ]);
}
