import { ArcLayer } from '@deck.gl/layers';
import { MapboxOverlay } from '@deck.gl/mapbox';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer } from '../domain/project';
import { routeArcData, type RouteArcDatum } from './RouteArcRendering';

const ARC_LAYER_ID = 'studio-route-arcs';

type RouteArcState = {
  layers: readonly ContentLayer[];
  selectedId: string | null;
  previewedId: string | null;
};

type ArcOverlay = {
  finalize: () => void;
  pickObject: (options: { x: number; y: number; radius: number; layerIds: string[] }) => { object?: unknown } | null;
  setProps: (props: { layers: ArcLayer<RouteArcDatum>[] }) => void;
};

type OverlayOptions = { interleaved: boolean };
type OverlayFactory = (options: OverlayOptions) => ArcOverlay;

function arcLayer(data: RouteArcDatum[], widthScale: number, isVisible: boolean) {
  return new ArcLayer<RouteArcDatum>({
    id: ARC_LAYER_ID,
    data,
    pickable: true,
    getSourcePosition: (datum) => datum.source,
    getTargetPosition: (datum) => datum.target,
    getSourceColor: (datum) => datum.color,
    getTargetColor: (datum) => datum.color,
    getWidth: (datum) => datum.width * widthScale,
    getHeight: 0.35,
    visible: isVisible,
    widthUnits: 'pixels',
    wrapLongitude: true,
  });
}

function defaultOverlayFactory(options: OverlayOptions): ArcOverlay {
  return new MapboxOverlay({ interleaved: options.interleaved, layers: [] }) as ArcOverlay;
}

export function createRouteArcOverlay(
  map: MapLibreMap,
  factory: OverlayFactory = defaultOverlayFactory,
  widthScale = 1,
  isInterleaved = false,
) {
  let overlay: ArcOverlay | null = null;
  let data: RouteArcDatum[] = [];
  let isExportVisible = true;
  let isDestroyed = false;
  const ensureOverlay = () => {
    if (overlay) return overlay;
    overlay = factory({ interleaved: isInterleaved });
    map.addControl(overlay as never);
    return overlay;
  };
  const render = () => {
    if (!overlay && data.length === 0) return;
    ensureOverlay().setProps({
      layers: data.length > 0 ? [arcLayer(data, widthScale, isExportVisible)] : [],
    });
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
  };
}
