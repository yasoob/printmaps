import type { Map as MapLibreMap } from 'maplibre-gl';
import { routeArcData, type RouteArcDatum } from './RouteArcRendering';
import {
  ARC_LAYER_ID,
  type ArcDeckLayers,
  type ArcDeckLayersLoader,
  type ArcOverlay,
  type RouteArcState,
} from './RouteArcOverlayContracts';

export type { OverlayFactory, RouteArcState } from './RouteArcOverlayContracts';

const loadArcDeckLayers: ArcDeckLayersLoader = () => import('./RouteArcDeckLayers');

export type RouteArcOverlayOptions = Readonly<{
  factory?: ArcDeckLayers['defaultOverlayFactory'];
  widthScale?: number;
  isInterleaved?: boolean;
  loadDeckLayers?: ArcDeckLayersLoader;
}>;

/**
 * Arc routes are the only feature that needs deck.gl, and most projects have
 * none, so the renderer is fetched the first time arc data actually appears.
 * `sync` stays synchronous for the map adapter's error handling; callers that
 * must observe the result — the print exporter above all — await `whenIdle`.
 */
export function createRouteArcOverlay(map: MapLibreMap, options: RouteArcOverlayOptions = {}) {
  const {
    factory,
    widthScale = 1,
    isInterleaved = false,
    loadDeckLayers = loadArcDeckLayers,
  } = options;
  let overlay: ArcOverlay | null = null;
  let deckLayers: ArcDeckLayers | null = null;
  let pendingRender: Promise<void> | null = null;
  let data: RouteArcDatum[] = [];
  let isExportVisible = true;
  let isDestroyed = false;
  let loadFailure: unknown = null;

  const ensureOverlay = (loaded: ArcDeckLayers) => {
    if (overlay) return overlay;
    overlay = (factory ?? loaded.defaultOverlayFactory)({ interleaved: isInterleaved });
    map.addControl(overlay as never);
    return overlay;
  };

  const renderWith = (loaded: ArcDeckLayers) => {
    if (isDestroyed) return;
    if (!overlay && data.length === 0) return;
    ensureOverlay(loaded).setProps({
      layers: data.length > 0 ? [loaded.arcLayer(data, widthScale, isExportVisible)] : [],
    });
  };

  const renderWhenLoaded = async (previous: Promise<void> | null) => {
    await previous;
    try {
      deckLayers ??= await loadDeckLayers();
      loadFailure = null;
    } catch (error) {
      // Interactive panning must not reject, so the failure is recorded and
      // surfaced through `whenIdle` instead, where export can act on it.
      loadFailure = error;
      return;
    }
    renderWith(deckLayers);
  };

  const render = () => {
    if (deckLayers) {
      renderWith(deckLayers);
      return;
    }
    if (!overlay && data.length === 0) return;
    pendingRender = renderWhenLoaded(pendingRender);
  };

  return {
    destroy: () => {
      if (isDestroyed) return;
      isDestroyed = true;
      overlay?.finalize();
    },
    hitTest: ({ x, y }: { x: number; y: number }) => {
      if (!overlay || !isExportVisible || isDestroyed) return null;
      try {
        const picked = overlay.pickObject({ x, y, radius: 12, layerIds: [ARC_LAYER_ID] });
        const object = picked?.object as Partial<RouteArcDatum> | undefined;
        return typeof object?.layerId === 'string' ? object.layerId : null;
      } catch {
        return null;
      }
    },
    setExportVisibility: (isVisible: boolean) => {
      if (isDestroyed) return false;
      isExportVisible = isVisible;
      try {
        render();
        return true;
      } catch {
        return false;
      }
    },
    sync: (state: RouteArcState) => {
      if (isDestroyed) return false;
      data = routeArcData(state.layers, state);
      render();
      return true;
    },
    /**
     * Resolves once every render queued so far has been applied, including the
     * on-demand fetch of the arc renderer. Throws when arcs are still waiting on
     * a renderer that failed to load, so an export fails loudly rather than
     * silently omitting routes.
     */
    whenIdle: async () => {
      await pendingRender;
      if (loadFailure && data.length > 0) {
        throw new Error('The route arc renderer could not be loaded.', { cause: loadFailure });
      }
    },
  };
}
