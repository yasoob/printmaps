import {
  cloneContentLayer,
  createInitialProjectDocument,
  PROJECT_SCHEMA_VERSION,
} from '../../src/domain/project';
import { parseProjectFileText } from '../../src/domain/projectFile';

function routeFixture() {
  const project = createInitialProjectDocument();
  const route = project.layers.find((layer) => layer.type === 'route')!;
  if (route.appearance?.kind !== 'route') throw new Error('Expected route appearance.');
  return { project, route, appearance: route.appearance };
}

describe('schema-24 route model', () => {
  it('is current and strictly rejects schema 23', () => {
    expect(PROJECT_SCHEMA_VERSION).toBe(24);
    const project = createInitialProjectDocument();
    expect(() => parseProjectFileText(JSON.stringify({ ...project, schemaVersion: 23 })))
      .toThrow('Schema version 23 is obsolete');
  });

  it('requires route metadata that agrees with geometry and provenance', () => {
    const { project, route } = routeFixture();
    delete route.route;
    expect(() => parseProjectFileText(JSON.stringify(project))).toThrow('route metadata must be a JSON object');

    route.route = { kind: 'arc', closed: false };
    expect(() => parseProjectFileText(JSON.stringify(project))).toThrow('Arc routes require Arc geometry');

    route.route = { kind: 'road', closed: false };
    expect(() => parseProjectFileText(JSON.stringify(project))).toThrow('Road routes require Directions provenance');
  });

  it('enforces canonical open and closed semantic point uniqueness', () => {
    const { project, route, appearance } = routeFixture();
    route.geometry = { type: 'LineString', coordinates: [[0, 0], [1, 0], [0, 0]] };
    appearance.segmentStyles = [null, null];
    expect(() => parseProjectFileText(JSON.stringify(project))).toThrow(
      'Open routes may not repeat their first semantic point last',
    );

    route.route = { kind: 'straight', closed: true };
    expect(() => parseProjectFileText(JSON.stringify(project))).toThrow(
      'Closed routes need at least three distinct semantic points',
    );

    route.geometry.coordinates = [[0, 0], [1, 0], [1, 1], [0, 0]];
    appearance.segmentStyles = [null, null, null];
    expect(parseProjectFileText(JSON.stringify(project)).layers[0].route).toEqual({
      kind: 'straight',
      closed: true,
    });

    route.geometry.coordinates = [[0, 0], [1, 0], [1, 1], [1, 0], [0, 0]];
    appearance.segmentStyles = [null, null, null, null];
    expect(() => parseProjectFileText(JSON.stringify(project))).toThrow(
      'semantic points must be distinct except for the canonical closing point',
    );
  });

  it('requires exact marker and segment-style structures', () => {
    const { project, appearance } = routeFixture();
    appearance.marker = {
      pictogram: 'bike',
      placement: { type: 'repeat', spacing: 0.2 },
      orientToPath: true,
      reverseFacing: true,
    };
    appearance.segmentStyles = [
      { color: '#ABCDEF' },
      { width: 7, strokeStyle: 'dashed' },
      null,
    ];
    const parsed = parseProjectFileText(JSON.stringify(project));
    const parsedAppearance = parsed.layers[0].appearance;
    expect(parsedAppearance).toMatchObject({
      marker: appearance.marker,
      segmentStyles: [{ color: '#abcdef' }, { width: 7, strokeStyle: 'dashed' }, null],
    });

    const malformed = structuredClone(project) as unknown as {
      layers: { appearance: Record<string, unknown> }[];
    };
    malformed.layers[0].appearance.travelMarker = 'bike';
    expect(() => parseProjectFileText(JSON.stringify(malformed))).toThrow('unsupported field "travelMarker"');

    appearance.segmentStyles = [{}, null, null];
    expect(() => parseProjectFileText(JSON.stringify(project))).toThrow('must override at least one route style');
    appearance.segmentStyles = [null];
    expect(() => parseProjectFileText(JSON.stringify(project))).toThrow(
      'exactly one segment style entry per semantic leg',
    );
  });

  it('rejects non-normal marker placement and out-of-range or unknown style fields', () => {
    const { project, appearance } = routeFixture();
    appearance.marker = {
      pictogram: 'walk',
      placement: { type: 'fraction', fraction: 1.01 },
      orientToPath: true,
      reverseFacing: false,
    };
    expect(() => parseProjectFileText(JSON.stringify(project))).toThrow(
      'fraction must be between zero and one',
    );

    appearance.marker = {
      pictogram: 'walk',
      placement: { type: 'repeat', spacing: 0 },
      orientToPath: false,
      reverseFacing: false,
    };
    expect(() => parseProjectFileText(JSON.stringify(project))).toThrow(
      'repeat spacing must be at least 0.01',
    );

    appearance.marker = {
      pictogram: 'walk',
      placement: { type: 'center' },
      orientToPath: false,
      reverseFacing: true,
    };
    expect(() => parseProjectFileText(JSON.stringify(project))).toThrow(
      'reverse-facing state requires path orientation',
    );

    appearance.marker = null;
    appearance.segmentStyles = [{ width: 17 }, null, null];
    expect(() => parseProjectFileText(JSON.stringify(project))).toThrow(
      'width must be between 1 and 16',
    );

    const unknown = structuredClone(project) as unknown as {
      layers: { appearance: { segmentStyles: Record<string, unknown>[] } }[];
    };
    unknown.layers[0].appearance.segmentStyles[0] = { opacity: 0.5 };
    expect(() => parseProjectFileText(JSON.stringify(unknown))).toThrow('unsupported field "opacity"');
  });
});

describe('schema-24 route hardening', () => {
  it('enforces the practical repeat-spacing floor in parsing and runtime validation', () => {
    const { project, appearance } = routeFixture();
    appearance.marker = {
      pictogram: 'walk',
      placement: { type: 'repeat', spacing: 0.009 },
      orientToPath: true,
      reverseFacing: false,
    };

    expect(() => parseProjectFileText(JSON.stringify(project))).toThrow(
      'repeat spacing must be at least 0.01',
    );
  });

  it('rejects Road geometry when any monotonic semantic leg has no usable edge', () => {
    const { project, route, appearance } = routeFixture();
    route.route = { kind: 'road', closed: false };
    route.geometry = {
      type: 'LineString',
      coordinates: [[0, 0], [0, 0], [2, 0]],
    };
    route.provenance = {
      provider: 'mapbox',
      service: 'directions-v5',
      waypoints: [[0, 0], [1, 0], [2, 0]],
      profile: 'driving',
      distanceMeters: 2,
      durationSeconds: 2,
    };
    appearance.segmentStyles = [null, null];

    expect(() => parseProjectFileText(JSON.stringify(project))).toThrow(
      'at least one non-zero rendered edge per semantic leg',
    );
  });

  it('limits closed Road routes to 24 distinct provider waypoints', () => {
    const { project, route, appearance } = routeFixture();
    const distinct = Array.from({ length: 25 }, (_unused, index) => [index, 0] as [number, number]);
    const waypoints = [...distinct, [...distinct[0]] as [number, number]];
    route.route = { kind: 'road', closed: true };
    route.geometry = { type: 'LineString', coordinates: waypoints };
    route.provenance = {
      provider: 'mapbox',
      service: 'directions-v5',
      waypoints,
      profile: 'driving',
      distanceMeters: 25,
      durationSeconds: 25,
    };
    appearance.segmentStyles = Array.from({ length: 25 }, () => null);

    expect(() => parseProjectFileText(JSON.stringify(project))).toThrow(
      'at most 24 distinct semantic points',
    );
  });

  it('deep-clones nested marker placements, styles, metadata, and waypoints', () => {
    const { route, appearance } = routeFixture();
    appearance.marker = {
      pictogram: 'air',
      placement: { type: 'fraction', fraction: 0.25 },
      orientToPath: true,
      reverseFacing: false,
    };
    appearance.segmentStyles[0] = { color: '#112233', strokeStyle: 'dashed' };

    const copy = cloneContentLayer(route);
    if (copy.appearance?.kind !== 'route' || copy.appearance.marker?.placement.type !== 'fraction') {
      throw new Error('Expected cloned route appearance.');
    }
    copy.route!.closed = true;
    copy.appearance.marker.placement.fraction = 0.75;
    copy.appearance.segmentStyles[0]!.color = '#ffffff';

    expect(route.route?.closed).toBe(false);
    expect(appearance.marker.placement).toEqual({ type: 'fraction', fraction: 0.25 });
    expect(appearance.segmentStyles[0]).toEqual({ color: '#112233', strokeStyle: 'dashed' });
  });
});
