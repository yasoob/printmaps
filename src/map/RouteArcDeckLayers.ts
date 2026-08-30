import { ArcLayer } from '@deck.gl/layers';
import { MapboxOverlay } from '@deck.gl/mapbox';
import type { RouteArcDatum } from './RouteArcRendering';
import type { ArcOverlay, OverlayOptions } from './RouteArcOverlayContracts';
import { ARC_LAYER_ID } from './RouteArcOverlayContracts';

/**
 * deck.gl and luma.gl are the largest dependency in the app after MapLibre, and
 * only arc-shaped routes need them. This module is the dynamic-import boundary:
 * nothing outside it may reference the deck.gl packages.
 */

export function arcLayer(data: RouteArcDatum[], widthScale: number, isVisible: boolean) {
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

export function defaultOverlayFactory(options: OverlayOptions): ArcOverlay {
  return new MapboxOverlay({ interleaved: options.interleaved, layers: [] }) as ArcOverlay;
}
