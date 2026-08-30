import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer } from '../domain/project';
import { createRouteArcOverlay } from './MapRouteArcOverlay';

export type NativeArcOverlay = Pick<ReturnType<typeof createRouteArcOverlay>, 'destroy' | 'sync'>
  & Partial<Pick<ReturnType<typeof createRouteArcOverlay>, 'whenIdle'>>;
export type NativeArcOverlayFactory = (map: MapLibreMap, widthScale: number) => NativeArcOverlay;

export async function attachNativeRouteArcs(
  map: MapLibreMap,
  layers: readonly ContentLayer[],
  widthScale: number,
  factory?: NativeArcOverlayFactory,
): Promise<NativeArcOverlay> {
  const overlay = factory
    ? factory(map, widthScale)
    : createRouteArcOverlay(map, { widthScale, isInterleaved: true });
  overlay.sync({ layers, selectedId: null, previewedId: null });
  // The arc renderer is fetched on demand; the tile must not be captured before it lands.
  await overlay.whenIdle?.();
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
  const context = output.getContext('2d', { willReadFrequently: true });
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