import { describe, expect, it, vi } from 'vitest';
import type { Map as MapLibreMap } from 'maplibre-gl';
import {
  POI_SHAPE_IMAGE_SIDE,
  createPoiShapeImage,
  poiShapeImageId,
  registerPoiShapeImages,
} from '../../src/map/PoiShapeMapImages';
import type { ContentLayer } from '../../src/domain/project';

function alphaAt(image: ReturnType<typeof createPoiShapeImage>, x: number, y: number) {
  return image.data[(y * image.width + x) * 4 + 3];
}

function poi(id: string, markerShape: 'circle' | 'square' | 'diamond', customAssetId?: string) {
  return {
    id, type: 'poi', appearance: { kind: 'poi', markerShape, ...(customAssetId && { customAssetId }) },
  } as unknown as ContentLayer;
}

describe('POI shape SDF images', () => {
  it('encodes the square edge at the MapLibre SDF cutoff', () => {
    const image = createPoiShapeImage('square');
    const center = image.width / 2;
    const half = POI_SHAPE_IMAGE_SIDE / 2;
    expect(alphaAt(image, center, center)).toBe(255);
    // Pixel centres straddle the edge, so the edge sample sits within one SDF step of 0.75.
    expect(alphaAt(image, center + half, center)).toBeGreaterThan(150);
    expect(alphaAt(image, center + half, center)).toBeLessThan(192);
    expect(alphaAt(image, 0, 0)).toBe(0);
  });

  it('cuts the diamond corners that the square fills', () => {
    const square = createPoiShapeImage('square');
    const diamond = createPoiShapeImage('diamond');
    const corner = square.width / 2 + POI_SHAPE_IMAGE_SIDE / 2 - 2;
    expect(alphaAt(square, corner, corner)).toBeGreaterThan(191);
    expect(alphaAt(diamond, corner, corner)).toBeLessThan(64);
  });

  it('registers only the shapes standard POIs use, as SDF images', () => {
    const images = new Set<string>();
    const map = {
      hasImage: vi.fn((id: string) => images.has(id)),
      addImage: vi.fn((id: string) => { images.add(id); }),
    } as unknown as MapLibreMap;
    registerPoiShapeImages(map, [poi('a', 'circle'), poi('b', 'diamond'), poi('c', 'square', 'asset')]);
    expect([...images]).toEqual([poiShapeImageId('diamond')]);
    expect(map.addImage).toHaveBeenCalledWith(poiShapeImageId('diamond'), expect.any(Object), { sdf: true, pixelRatio: 1 });
    registerPoiShapeImages(map, [poi('b', 'diamond')]);
    expect(map.addImage).toHaveBeenCalledTimes(1);
  });
});
