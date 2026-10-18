import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer } from '../domain/project';
import type { PoiMarkerShape } from '../domain/poiMarkers';

/*
 * Square and diamond POI markers are signed-distance-field images rather than font glyphs.
 * Glyphs such as '■'/'◆' depend on the glyph server's font coverage and metrics, so they never
 * matched the exact geometry that SVG/PDF exports draw. An SDF keeps the live and native raster
 * outputs geometric while `icon-color`/`icon-halo-*` still recolour and outline the marker.
 */
type PolygonShape = Exclude<PoiMarkerShape, 'circle'>;

// Marker side (square) or diagonal (diamond) in image pixels; icon-size = marker size / this.
export const POI_SHAPE_IMAGE_SIDE = 24;
// MapLibre's SDF shader expects TinySDF encoding: edge at alpha 0.75, 1/8 alpha per pixel.
const SDF_RADIUS = 8;
const SDF_CUTOFF = 0.25;
const PADDING = 12;
const IMAGE_SIZE = POI_SHAPE_IMAGE_SIDE + PADDING * 2;
const POLYGON_SHAPES: readonly PolygonShape[] = ['square', 'diamond'];

export function poiShapeImageId(shape: PolygonShape): string {
  return `studio-poi-shape-${shape}`;
}

function squareDistance(x: number, y: number, half: number): number {
  const dx = Math.abs(x) - half;
  const dy = Math.abs(y) - half;
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0);
}

function signedDistance(shape: PolygonShape, x: number, y: number): number {
  const half = POI_SHAPE_IMAGE_SIDE / 2;
  if (shape === 'square') return squareDistance(x, y, half);
  // A diamond with vertices at ±half is a square of half-side half/√2 rotated by 45°.
  return squareDistance((x + y) / Math.SQRT2, (x - y) / Math.SQRT2, half / Math.SQRT2);
}

export function createPoiShapeImage(shape: PolygonShape): { width: number; height: number; data: Uint8Array } {
  const data = new Uint8Array(IMAGE_SIZE * IMAGE_SIZE * 4);
  const center = IMAGE_SIZE / 2;
  for (let row = 0; row < IMAGE_SIZE; row += 1) {
    for (let column = 0; column < IMAGE_SIZE; column += 1) {
      const distance = signedDistance(shape, column + 0.5 - center, row + 0.5 - center);
      const alpha = 255 - 255 * (distance / SDF_RADIUS + SDF_CUTOFF);
      const offset = (row * IMAGE_SIZE + column) * 4;
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
      data[offset + 3] = Math.round(Math.min(255, Math.max(0, alpha)));
    }
  }
  return { width: IMAGE_SIZE, height: IMAGE_SIZE, data };
}

export function registerPoiShapeImages(map: MapLibreMap, layers: readonly ContentLayer[]): void {
  const needed = new Set<PolygonShape>();
  for (const layer of layers) {
    const appearance = layer.appearance;
    if (appearance?.kind !== 'poi' || appearance.customAssetId) continue;
    if (appearance.markerShape !== 'circle') needed.add(appearance.markerShape);
  }
  for (const shape of POLYGON_SHAPES) {
    const id = poiShapeImageId(shape);
    if (needed.has(shape) && !map.hasImage(id)) {
      map.addImage(id, createPoiShapeImage(shape), { sdf: true, pixelRatio: 1 });
    }
  }
}
