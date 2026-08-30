import {
  createDefaultRouteAppearance,
  type ContentLayer,
  type DirectionsProvenance,
} from '../../src/domain/project';
import { createArcGeometry } from '../../src/domain/routeArcGeometry';
import {
  deriveRenderedRoute,
  partitionRoadGeometry,
} from '../../src/domain/renderedRoute';
import { reverseRoute } from '../../src/domain/routeTransformations';

function route(
  coordinates: [number, number][],
  marker: NonNullable<ReturnType<typeof createDefaultRouteAppearance>['marker']> | null = null,
): ContentLayer {
  const appearance = createDefaultRouteAppearance(coordinates.length - 1);
  appearance.marker = marker;
  appearance.segmentStyles[0] = { color: '#112233', width: 7, strokeStyle: 'dashed' };
  return {
    id: 'route',
    name: 'Route',
    type: 'route',
    route: { kind: 'straight', closed: false },
    visible: true,
    locked: false,
    opacity: 100,
    appearance,
    geometry: { type: 'LineString', coordinates },
  };
}

describe('shared rendered-route derivation', () => {
  it('returns complete and per-leg Straight paths with resolved styles', () => {
    const rendered = deriveRenderedRoute(route([[0, 0], [1, 0], [2, 1]]))!;
    expect(rendered.path).toEqual([[0, 0], [1, 0], [2, 1]]);
    expect(rendered.legs).toEqual([
      {
        index: 0,
        path: [[0, 0], [1, 0]],
        style: { color: '#112233', width: 7, strokeStyle: 'dashed' },
      },
      {
        index: 1,
        path: [[1, 0], [2, 1]],
        style: { color: '#d9363e', width: 4, strokeStyle: 'solid' },
      },
    ]);
  });

  it('samples every Arc leg from canonical curvature', () => {
    const layer = route([[0, 0], [1, 0], [2, 0]]);
    layer.route = { kind: 'arc', closed: false };
    layer.geometry = createArcGeometry([[0, 0], [1, 0], [2, 0]], [0.5, -0.5])!;
    const rendered = deriveRenderedRoute(layer)!;
    expect(rendered.legs).toHaveLength(2);
    expect(rendered.legs[0].path).toHaveLength(25);
    expect(rendered.legs[0].path[12][1]).toBeGreaterThan(0);
    expect(rendered.legs[1].path[12][1]).toBeLessThan(0);
    expect(rendered.path).toHaveLength(49);
  });

  it('partitions backtracking Road geometry at nearest monotonic waypoint indices', () => {
    const geometry = [[0, 0], [1, 0], [2, 0], [1.05, 0], [3, 0], [4, 0]] as const;
    const legs = partitionRoadGeometry(geometry, [[0, 0], [1, 0], [3, 0], [4, 0]])!;
    expect(legs.map((leg) => leg.map((point) => point[0]))).toEqual([
      [0, 1],
      [1, 2, 1.05, 3],
      [3, 4],
    ]);
    expect(legs.every((leg) => leg.length >= 2)).toBe(true);

    const layer = route([[0, 0], [1, 0], [3, 0], [4, 0]]);
    layer.route = { kind: 'road', closed: false };
    layer.geometry = { type: 'LineString', coordinates: geometry.map((point) => [...point]) };
    layer.provenance = {
      provider: 'mapbox',
      service: 'directions-v5',
      waypoints: [[0, 0], [1, 0], [3, 0], [4, 0]],
      profile: 'driving',
      distanceMeters: 4,
      durationSeconds: 4,
    } satisfies DirectionsProvenance;
    if (layer.appearance?.kind === 'route') {
      layer.appearance.segmentStyles = [null, null, null];
    }
    expect(deriveRenderedRoute(layer)?.legs.map((leg) => leg.path)).toEqual(legs);
  });

  it('places center, endpoint fraction, and half-spacing repeat markers with tangents', () => {
    const centered = route([[0, 0], [2, 0]], {
      pictogram: 'bike',
      placement: { type: 'center' },
      orientToPath: true,
      reverseFacing: false,
    });

    expect(deriveRenderedRoute(centered)?.markers[0]).toMatchObject({
      position: [1, 0],
      bearing: 90,
      fraction: 0.5,
    });

    if (centered.appearance?.kind !== 'route') throw new Error('Expected appearance.');
    centered.appearance.marker = {
      pictogram: 'bike',
      placement: { type: 'fraction', fraction: 0 },
      orientToPath: true,
      reverseFacing: true,
    };
    expect(deriveRenderedRoute(centered)?.markers[0]).toMatchObject({
      position: [0, 0],
      bearing: 270,
      fraction: 0,
    });

    centered.appearance.marker = {
      pictogram: 'bike',
      placement: { type: 'repeat', spacing: 0.25 },
      orientToPath: false,
      reverseFacing: false,
    };
    expect(deriveRenderedRoute(centered)?.markers.map(({ fraction, bearing }) => [fraction, bearing])).toEqual([
      [0.125, 0], [0.375, 0], [0.625, 0], [0.875, 0],
    ]);
  });

  it('caps repeated marker generation even at the minimum accepted spacing', () => {
    const repeated = route([[0, 0], [2, 0]], {
      pictogram: 'bike',
      placement: { type: 'repeat', spacing: 0.01 },
      orientToPath: true,
      reverseFacing: false,
    });

    expect(deriveRenderedRoute(repeated)?.markers).toHaveLength(100);

    if (repeated.appearance?.kind !== 'route' || !repeated.appearance.marker) {
      throw new Error('Expected marker appearance.');
    }
    repeated.appearance.marker.placement = { type: 'repeat', spacing: Number.MIN_VALUE };
    expect(deriveRenderedRoute(repeated)).toBeNull();
  });

  it('rejects a Road partition whose reserved leg contains only zero-length edges', () => {
    expect(partitionRoadGeometry(
      [[0, 0], [0, 0], [2, 0]],
      [[0, 0], [1, 0], [2, 0]],
    )).toBeNull();
  });

  it('preserves numeric fractions so reversing mirrors marker geography', () => {
    const source = route([[0, 0], [4, 0]], {
      pictogram: 'air',
      placement: { type: 'fraction', fraction: 0.25 },
      orientToPath: true,
      reverseFacing: false,
    });
    const before = deriveRenderedRoute(source)!.markers[0];
    const after = deriveRenderedRoute(reverseRoute(source)!)!.markers[0];
    expect(before.position).toEqual([1, 0]);
    expect(after.position).toEqual([3, 0]);
    expect(after.fraction).toBe(0.25);
    expect(after.bearing).toBe(270);
  });
});
