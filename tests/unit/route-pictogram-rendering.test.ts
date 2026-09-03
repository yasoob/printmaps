import type { Map as MapLibreMap } from 'maplibre-gl';
import { createDefaultRouteAppearance, type ContentLayer } from '../../src/domain/project';
import {
  ROUTE_PICTOGRAM_CONTENT_SCALE,
  ROUTE_PICTOGRAMS,
  createRoutePictogramImage,
  routePictogramPdfGeometry,
  routePictogramSvg,
} from '../../src/domain/routePictograms';
import { ROUTE_TRAVEL_MARKERS } from '../../src/domain/routeProfiles';
import { mapLayerDescriptors } from '../../src/map/MapContentLayerRendering';
import { routeMapFeatures } from '../../src/map/MapContentGeometry';
import { registerRoutePictogramImages } from '../../src/map/RoutePictogramMapImages';

function route(pictogram: typeof ROUTE_TRAVEL_MARKERS[number] = 'car'): ContentLayer {
  const appearance = createDefaultRouteAppearance(2);
  appearance.marker = {
    pictogram,
    placement: { type: 'repeat', spacing: 0.5 },
    orientToPath: true,
    reverseFacing: false,
  };
  appearance.segmentStyles[0] = { color: '#112233', width: 7, strokeStyle: 'dashed' };
  return {
    id: 'route',
    name: 'Route',
    type: 'route',
    route: { kind: 'straight', closed: false },
    visible: true,
    locked: false,
    opacity: 60,
    appearance,
    geometry: { type: 'LineString', coordinates: [[0, 0], [1, 0], [2, 0]] },
  };
}

describe('shared original route pictograms', () => {
  it('defines non-empty normalized primitive geometry for all six travel modes', () => {
    expect(Object.keys(ROUTE_PICTOGRAMS)).toEqual(ROUTE_TRAVEL_MARKERS);
    for (const pictogram of ROUTE_TRAVEL_MARKERS) {
      expect(ROUTE_PICTOGRAMS[pictogram].length).toBeGreaterThan(0);
      const svg = routePictogramSvg(pictogram, '#123456', {
        point: { x: 10, y: 20 },
        radius: 4,
        bearing: 90,
      });
      const pdf = routePictogramPdfGeometry(pictogram, { x: 10, y: 20 }, 8, 90);
      expect(svg).toContain(`data-route-pictogram="${pictogram}"`);
      expect(svg).toContain(`scale(${ROUTE_PICTOGRAM_CONTENT_SCALE})`);
      expect(svg).not.toContain('<text');
      expect(pdf).toHaveLength(ROUTE_PICTOGRAMS[pictogram].length + 1);
    }
  });

  it('rasterizes every pictogram from the same primitives', () => {
    const getImageData = vi.fn((_x, _y, width, height) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    }));
    const scale = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      arc: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(), fill: vi.fn(),
      getImageData, lineTo: vi.fn(), moveTo: vi.fn(), restore: vi.fn(),
      save: vi.fn(), scale, stroke: vi.fn(), translate: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    for (const pictogram of ROUTE_TRAVEL_MARKERS) {
      expect(createRoutePictogramImage(pictogram, '#123456')).toMatchObject({ width: 48, height: 48 });
    }
    expect(getImageData).toHaveBeenCalledTimes(6);
    expect(scale).toHaveBeenCalledWith(
      ROUTE_PICTOGRAM_CONTENT_SCALE,
      ROUTE_PICTOGRAM_CONTENT_SCALE,
    );
  });
});

describe('route MapLibre features and layers', () => {
  it('emits stable per-leg and derived marker features with data-driven styles', () => {
    const data = routeMapFeatures(route())!;
    if (data.type !== 'FeatureCollection') throw new Error('Expected feature collection.');
    expect(data.features.filter(({ properties }) => properties.featureKind === 'segment')).toEqual([
      expect.objectContaining({ properties: expect.objectContaining({ segmentIndex: 0, color: '#112233', width: 7, strokeStyle: 'dashed' }) }),
      expect.objectContaining({ properties: expect.objectContaining({ segmentIndex: 1, color: '#d9363e', width: 4, strokeStyle: 'solid' }) }),
    ]);
    const markers = data.features.filter(({ properties }) => properties.featureKind === 'marker');
    expect(markers).toHaveLength(4);
    expect(markers.map(({ properties }) => properties.segmentIndex)).toEqual([0, 0, 1, 1]);

    const descriptors = mapLayerDescriptors(route(), { selectedId: 'route', previewedId: null });
    expect(descriptors.map(({ id }) => id)).toEqual([
      'studio-layer-5:route:casing',
      'studio-layer-5:route:solid',
      'studio-layer-5:route:dashed',
      'studio-layer-5:route:travel-mode',
    ]);
    expect(descriptors.at(-1)?.hitTest).toBe(false);
    expect(descriptors[1].paint['line-color']).toEqual(['get', 'color']);
    expect(descriptors[2].paint['line-dasharray']).toEqual([2, 1.5]);
  });

  it('registers each required resolved-color image in a renderer', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      arc: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(), fill: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(48 * 48 * 4), width: 48, height: 48 })),
      lineTo: vi.fn(), moveTo: vi.fn(), restore: vi.fn(), save: vi.fn(),
      scale: vi.fn(), stroke: vi.fn(), translate: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    const images = new Set<string>();
    const map = {
      addImage: (id: string) => images.add(id),
      hasImage: (id: string) => images.has(id),
    } as unknown as MapLibreMap;
    const registered = registerRoutePictogramImages(map, [route('ship')]);
    expect(registered).toEqual(new Set([
      'studio-route-pictogram-ship-112233',
      'studio-route-pictogram-ship-d9363e',
    ]));
    expect(images).toEqual(registered);
  });
});
