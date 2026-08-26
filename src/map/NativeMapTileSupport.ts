import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer } from '../domain/project';
import { createRouteArcOverlay } from './MapRouteArcOverlay';

export type NativeArcOverlay = Pick<ReturnType<typeof createRouteArcOverlay>, 'destroy' | 'sync'>;
export type NativeArcOverlayFactory = (map: MapLibreMap, widthScale: number) => NativeArcOverlay;

export function attachNativeRouteArcs(
  map: MapLibreMap,
  layers: readonly ContentLayer[],
  widthScale: number,
  factory?: NativeArcOverlayFactory,
): NativeArcOverlay {
  const overlay = factory
    ? factory(map, widthScale)
    : createRouteArcOverlay(map, undefined, widthScale, true);
  overlay.sync({ layers, selectedId: null, previewedId: null });
  return overlay;
}

export function copyNativeMapCanvas(
  rendered: HTMLCanvasElement,
  width: number,
  height: number,
): HTMLCanvasElement {
  const output = document.createElement('canvas');
  output.width = width;
  output.height = height;
  const context = output.getContext('2d');
  if (!context) {
    output.width = 0;
    output.height = 0;
    throw new Error('The browser cannot copy the native print tile.');
  }
  try {
    context.drawImage(rendered, 0, 0);
  } catch {
    output.width = 0;
    output.height = 0;
    throw new Error('The browser could not capture the native print tile.');
  }
  return output;
}