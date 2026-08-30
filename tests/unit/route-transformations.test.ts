import {
  createDefaultRouteAppearance,
  type ContentLayer,
} from '../../src/domain/project';
import { createArcGeometry, sampleArc } from '../../src/domain/routeArcGeometry';
import {
  closeRoute,
  convertRoute,
  extendRoute,
  insertRoutePoint,
  openRoute,
  removeRoutePoint,
  reorderRoutePoints,
  reverseRoute,
} from '../../src/domain/routeTransformations';

function straight(points = [[0, 0], [1, 0], [2, 0]] as [number, number][]): ContentLayer {
  const appearance = createDefaultRouteAppearance(points.length - 1);
  appearance.marker = {
    pictogram: 'air',
    placement: { type: 'fraction', fraction: 0.25 },
    orientToPath: true,
    reverseFacing: false,
  };
  appearance.segmentStyles = [{ color: '#112233' }, { width: 6 }];
  return {
    id: 'route',
    name: 'Route',
    type: 'route',
    route: { kind: 'straight', closed: false },
    visible: false,
    locked: true,
    opacity: 45,
    appearance,
    geometry: { type: 'LineString', coordinates: points },
  };
}

function reversedCopy<T>(values: readonly T[]): T[] {
  return values.map((_, index) => values[values.length - index - 1]);
}

function normalizedArcPoint(point: readonly [number, number]) {
  return [
    Number(((((point[0] + 180) % 360 + 360) % 360) - 180).toFixed(6)),
    point[1],
  ];
}

describe('pure route transformations', () => {
  it('converts only semantic anchors and preserves route identity and leg styles', () => {
    const source = straight();
    const arc = convertRoute(source, 'arc')!;
    expect(arc.geometry).toEqual({
      type: 'Arc',
      anchors: [[0, 0], [1, 0], [2, 0]],
      curvatures: [0.35, 0.35],
    });
    expect(arc.appearance.segmentStyles).toEqual(source.appearance?.kind === 'route'
      ? source.appearance.segmentStyles
      : []);
    expect(arc).toMatchObject({
      id: 'route', name: 'Route', visible: false, locked: true, opacity: 45,
      route: { kind: 'arc', closed: false },
    });
    expect(convertRoute(arc, 'straight')!.geometry).toEqual(source.geometry);
  });

  it.each([
    [[[0, 0], [1, 1], [3, -1]], [0.2, -0.65]],
    [[[179, 5], [-179, 7], [-175, 2]], [0.5, -0.3]],
  ] as const)('reverses Arc anchors and curvatures without changing its sampled locus', (anchors, curvatures) => {
    const geometry = createArcGeometry(anchors, curvatures)!;
    const source = straight(anchors.map((point) => [...point]));
    source.route = { kind: 'arc', closed: false };
    source.geometry = geometry;
    const reversed = reverseRoute(source)!;
    if (reversed.geometry.type !== 'Arc') throw new Error('Expected Arc.');

    expect(reversed.geometry.curvatures).toEqual(reversedCopy(curvatures));
    expect(sampleArc(reversed.geometry, 12).map((point) => normalizedArcPoint(point))).toEqual(
      reversedCopy(sampleArc(geometry, 12)).map((point) => normalizedArcPoint(point)),
    );
    expect(reversed.appearance.segmentStyles).toEqual([
      { width: 6 },
      { color: '#112233' },
    ]);
    expect(reversed.appearance.marker?.placement).toEqual({ type: 'fraction', fraction: 0.25 });
  });

  it('closes and opens canonically while changing only the closing curvature and style', () => {
    const arc = convertRoute(straight(), 'arc')!;
    const closed = closeRoute(arc)!;
    expect(closed.geometry.type === 'Arc' && closed.geometry.anchors).toEqual([
      [0, 0], [1, 0], [2, 0], [0, 0],
    ]);
    expect(closed.geometry.type === 'Arc' && closed.geometry.curvatures).toEqual([0.35, 0.35, 0.35]);
    expect(closed.appearance.segmentStyles).toEqual([{ color: '#112233' }, { width: 6 }, null]);
    expect(openRoute(closed)).toEqual(arc);
  });

  it('duplicates split styles for insertion and closed endpoint extension', () => {
    const inserted = insertRoutePoint(straight(), 0, [0.5, 0.5])!;
    expect(inserted.appearance.segmentStyles).toEqual([
      { color: '#112233' }, { color: '#112233' }, { width: 6 },
    ]);

    const closed = closeRoute(straight())!;
    closed.appearance.segmentStyles[2] = { strokeStyle: 'dashed' };
    const extended = extendRoute(closed, 'end', [[3, 1]])!;
    expect(extended.geometry.type === 'LineString' && extended.geometry.coordinates).toEqual([
      [0, 0], [1, 0], [2, 0], [3, 1], [0, 0],
    ]);
    expect(extended.appearance.segmentStyles.slice(-2)).toEqual([
      { strokeStyle: 'dashed' }, { strokeStyle: 'dashed' },
    ]);
  });

  it('adds inherited styles when extending either end of an open route', () => {
    expect(extendRoute(straight(), 'end', [[3, 0]])!.appearance.segmentStyles).toEqual([
      { color: '#112233' }, { width: 6 }, null,
    ]);
    expect(extendRoute(straight(), 'start', [[-1, 0]])!.appearance.segmentStyles).toEqual([
      null, { color: '#112233' }, { width: 6 },
    ]);
  });

  it('retains styles only for unchanged undirected pairs during reorder', () => {
    const source = straight([[0, 0], [1, 0], [2, 0], [3, 0]]);
    if (source.appearance?.kind !== 'route') throw new Error('Expected appearance.');
    source.appearance.segmentStyles = [{ color: '#111111' }, { color: '#222222' }, { color: '#333333' }];
    const reordered = reorderRoutePoints(source, [1, 0, 2, 3])!;
    expect(reordered.appearance.segmentStyles).toEqual([
      { color: '#111111' }, null, { color: '#333333' },
    ]);
  });

  it('merges only equal effective style fields when removing a point', () => {
    const source = straight();
    if (source.appearance?.kind !== 'route') throw new Error('Expected appearance.');
    source.appearance.segmentStyles = [
      { color: '#112233', width: 7 },
      { color: '#112233', width: 9, strokeStyle: 'dashed' },
    ];
    expect(removeRoutePoint(source, 1)!.appearance.segmentStyles).toEqual([{ color: '#112233' }]);
  });

  it('converts Road routes from persisted waypoints and clears provenance', () => {
    const source = straight();
    const roadInput = {
      geometry: [[0, 0], [0.5, 0.2], [1, 0], [1.5, -0.2], [2, 0]] as [number, number][],
      waypoints: [[0, 0], [1, 0], [2, 0]] as [number, number][],
      profile: 'walking' as const,
      distanceMeters: 2500,
      durationSeconds: 1200,
    };
    const road = convertRoute(source, 'road', roadInput)!;
    const local = convertRoute(road, 'straight')!;
    expect(local.geometry).toEqual({ type: 'LineString', coordinates: roadInput.waypoints });
    expect(local.provenance).toBeUndefined();
  });
});
