import { createInitialProjectDocument } from '../../src/domain/project';
import { parseProjectFileText } from '../../src/domain/projectFile';

describe('portable project validation', () => {
  it.each([16, 17, 18])('rejects the obsolete schema-%s format with a reset-oriented message', (schemaVersion) => {
    const obsolete = { ...createInitialProjectDocument(), schemaVersion };

    expect(() => parseProjectFileText(JSON.stringify(obsolete))).toThrow(
      `Schema version ${schemaVersion} is obsolete. Start a new project or reopen a current Print Map Studio file.`,
    );
  });

  it('requires an explicit shape invert state in the current schema', () => {
    const source = createInitialProjectDocument();
    const shape = source.layers.find(({ type }) => type === 'shape');
    if (shape?.appearance?.kind !== 'shape') throw new Error('Expected shape fixture.');
    const appearance: Partial<typeof shape.appearance> = shape.appearance;
    delete appearance.invert;

    expect(() => parseProjectFileText(JSON.stringify(source))).toThrow(
      'shape invert state must be true or false.',
    );
  });

  it('parses a current portable project into a detached canonical document', () => {
    const source = createInitialProjectDocument();

    const parsed = parseProjectFileText(JSON.stringify(source));

    expect(parsed).toEqual(source);
    expect(parsed).not.toBe(source);
    expect(parsed.layers[0]).not.toBe(source.layers[0]);
    expect(parsed.layers[0].geometry).not.toBe(source.layers[0].geometry);
  });

  it('round-trips detached canonical MultiPolygon shape geometry', () => {
    const source = createInitialProjectDocument();
    const shape = source.layers.find(({ type }) => type === 'shape');
    if (!shape) throw new Error('Expected shape fixture.');
    shape.geometry = {
      type: 'MultiPolygon',
      coordinates: [
        [[[10, 46], [11, 46], [11, 47], [10, 46]]],
        [[[12, 47], [13, 47], [13, 48], [12, 47]]],
      ],
    };

    const parsed = parseProjectFileText(JSON.stringify(source));
    const parsedShape = parsed.layers.find(({ type }) => type === 'shape');

    expect(parsedShape?.geometry).toEqual(shape.geometry);
    expect(parsedShape?.geometry).not.toBe(shape.geometry);
    expect(parsedShape?.geometry?.type === 'MultiPolygon'
      ? parsedShape.geometry.coordinates[0]
      : undefined).not.toBe(shape.geometry.coordinates[0]);
  });

  it('round-trips detached canonical Arc route geometry', () => {
    const source = createInitialProjectDocument();
    const route = source.layers.find(({ type }) => type === 'route');
    if (!route) throw new Error('Expected route fixture.');
    route.geometry = { type: 'Arc', anchors: [[179, 10], [-179, 12]] };

    const parsed = parseProjectFileText(JSON.stringify(source));
    const parsedRoute = parsed.layers.find(({ type }) => type === 'route');

    expect(parsedRoute?.geometry).toEqual(route.geometry);
    expect(parsedRoute?.geometry).not.toBe(route.geometry);
  });

  it('round-trips detached Mapbox isochrone provenance without credentials or raw responses', () => {
    const source = createInitialProjectDocument();
    const shape = source.layers.find(({ type }) => type === 'shape');
    if (!shape || shape.appearance?.kind !== 'shape') throw new Error('Expected shape fixture.');
    shape.name = '15 min walking area';
    shape.appearance = { ...shape.appearance, label: shape.name };
    shape.provenance = {
      provider: 'mapbox', service: 'isochrone-v1', center: [16.3725, 48.2084], profile: 'walking', minutes: 15,
    };

    const parsed = parseProjectFileText(JSON.stringify(source));
    const parsedShape = parsed.layers.find(({ id }) => id === shape.id);

    expect(parsedShape?.provenance).toEqual(shape.provenance);
    expect(parsedShape?.provenance).not.toBe(shape.provenance);
    expect(parsedShape?.provenance?.service === 'isochrone-v1'
      ? parsedShape.provenance.center
      : undefined).not.toBe(shape.provenance.center);
    expect(JSON.stringify(parsedShape)).not.toMatch(/access_token|rawResponse|token/i);
  });

  it('round-trips detached Mapbox directions provenance without credentials or raw responses', () => {
    const source = createInitialProjectDocument();
    const route = source.layers.find(({ type }) => type === 'route');
    if (!route) throw new Error('Expected route fixture.');
    route.geometry = {
      type: 'LineString',
      coordinates: [[16.31, 48.19], [16.355, 48.215], [16.4, 48.24]],
    };
    route.provenance = {
      provider: 'mapbox', service: 'directions-v5',
      waypoints: [[16.31, 48.19], [16.4, 48.24]], profile: 'driving',
      distanceMeters: 9200, durationSeconds: 1320,
    };

    const parsed = parseProjectFileText(JSON.stringify(source));
    const parsedRoute = parsed.layers.find(({ id }) => id === route.id);

    expect(parsedRoute?.provenance).toEqual(route.provenance);
    expect(parsedRoute?.provenance).not.toBe(route.provenance);
    expect(parsedRoute?.provenance?.service === 'directions-v5'
      ? parsedRoute.provenance.waypoints
      : undefined).not.toBe(route.provenance.waypoints);
    expect(JSON.stringify(parsedRoute)).not.toMatch(/access_token|rawResponse|token/i);
  });

  it('rejects Mapbox directions provenance on non-LineString route geometry', () => {
    const source = createInitialProjectDocument();
    const route = source.layers.find(({ type }) => type === 'route');
    if (!route) throw new Error('Expected route fixture.');
    route.geometry = { type: 'Arc', anchors: [[16.31, 48.19], [16.4, 48.24]] };
    route.provenance = {
      provider: 'mapbox', service: 'directions-v5',
      waypoints: [[16.31, 48.19], [16.4, 48.24]], profile: 'driving',
      distanceMeters: 9200, durationSeconds: 1320,
    };

    expect(() => parseProjectFileText(JSON.stringify(source))).toThrow(
      'Directions provenance requires LineString route geometry.',
    );
  });

  it('preserves a current portable project custom basemap layer name', () => {
    const source = createInitialProjectDocument();
    source.style = { ...source.style, preset: 'night-ink', textScalePercent: 100 };
    const basemap = source.layers.find((layer) => layer.type === 'basemap');
    if (!basemap) throw new Error('Expected fixture basemap.');
    basemap.name = 'Client reference map';

    const parsed = parseProjectFileText(JSON.stringify(source));

    expect(parsed.layers.find((layer) => layer.type === 'basemap')?.name).toBe('Client reference map');
  });

  it('normalizes portable viewport precision at the validation boundary', () => {
    const source = createInitialProjectDocument();
    source.camera.center = [16.41000000001, 48.23000000001];
    source.camera.zoom = 13.50000000001;

    const parsed = parseProjectFileText(JSON.stringify(source));

    expect(parsed.camera).toMatchObject({ center: [16.41, 48.23], zoom: 13.5 });
  });

  it('rejects control characters in a portable POI label', () => {
    const source = createInitialProjectDocument();
    const poi = source.layers.find(({ type }) => type === 'poi');
    if (poi?.appearance?.kind !== 'poi') throw new Error('Expected POI fixture.');
    poi.appearance.label = 'Cafe\nCentral';

    expect(() => parseProjectFileText(JSON.stringify(source))).toThrow(
      'POI label may not contain control characters.',
    );
  });

});

describe('portable project rejection', () => {
  it.each([
    ['malformed JSON', '{', 'not valid JSON'],
    ['a non-object root', 'null', 'must be a JSON object'],
    ['an unsupported schema', JSON.stringify({ schemaVersion: 99 }), 'Schema version 99 is not supported'],
    ['a missing project ID', JSON.stringify({ ...createInitialProjectDocument(), id: '' }), 'Project ID must be a non-empty string'],
    ['an invalid page width', JSON.stringify({
      ...createInitialProjectDocument(),
      page: { ...createInitialProjectDocument().page, widthMm: -1 },
    }), 'Page width must be a positive finite number'],
    ['duplicate layer IDs', JSON.stringify({
      ...createInitialProjectDocument(),
      layers: [createInitialProjectDocument().layers[0], createInitialProjectDocument().layers[0]],
    }), 'Layer IDs must be unique'],
    ['an invalid line', JSON.stringify({
      ...createInitialProjectDocument(),
      layers: [{
        ...createInitialProjectDocument().layers[0],
        geometry: { type: 'LineString', coordinates: [[16.3, 48.2]] },
      }],
    }), 'LineString geometry needs at least two positions'],
    ['an out-of-range point', JSON.stringify({
      ...createInitialProjectDocument(),
      layers: [{
        ...createInitialProjectDocument().layers[1],
        geometry: { type: 'Point', coordinates: [16, 86] },
      }],
    }), 'latitude must be between -85.051129 and 85.051129'],
    ['an empty MultiPolygon', JSON.stringify({
      ...createInitialProjectDocument(),
      layers: [{
        ...createInitialProjectDocument().layers[2],
        geometry: { type: 'MultiPolygon', coordinates: [] },
      }],
    }), 'MultiPolygon geometry needs at least one polygon'],
    ['an empty MultiPolygon part', JSON.stringify({
      ...createInitialProjectDocument(),
      layers: [{
        ...createInitialProjectDocument().layers[2],
        geometry: { type: 'MultiPolygon', coordinates: [[]] },
      }],
    }), 'MultiPolygon polygon 1 needs at least one ring'],
    ['an open MultiPolygon ring', JSON.stringify({
      ...createInitialProjectDocument(),
      layers: [{
        ...createInitialProjectDocument().layers[2],
        geometry: { type: 'MultiPolygon', coordinates: [[[[10, 46], [11, 46], [11, 47], [10, 47]]]] },
      }],
    }), 'Each MultiPolygon polygon 1 ring must end at its starting position'],
    ['geometry that contradicts its layer type', JSON.stringify({
      ...createInitialProjectDocument(),
      layers: [{
        ...createInitialProjectDocument().layers[0],
        geometry: { type: 'Point', coordinates: [16.3, 48.2] },
      }],
    }), 'Route layers may only contain LineString or Arc geometry'],
    ['an Arc with one anchor', JSON.stringify({
      ...createInitialProjectDocument(),
      layers: [{
        ...createInitialProjectDocument().layers[0],
        geometry: { type: 'Arc', anchors: [[16.3, 48.2]] },
      }],
    }), 'Arc geometry needs exactly two anchors'],
    ['an Arc with duplicate anchors', JSON.stringify({
      ...createInitialProjectDocument(),
      layers: [{
        ...createInitialProjectDocument().layers[0],
        geometry: { type: 'Arc', anchors: [[16.3, 48.2], [16.3, 48.2]] },
      }],
    }), 'Arc geometry anchors must be distinct and unambiguous'],
    ['standard preset dimensions that are not canonical', JSON.stringify({
      ...createInitialProjectDocument(),
      page: { preset: 'A4', widthMm: 300, heightMm: 210, orientation: 'landscape' },
    }), 'A4 page dimensions must be 297 × 210 mm in landscape'],
    ['an out-of-range camera bearing', JSON.stringify({
      ...createInitialProjectDocument(),
      camera: { ...createInitialProjectDocument().camera, bearing: 181 },
    }), 'Camera bearing must be between -180 and 180'],
    ['an out-of-range camera pitch', JSON.stringify({
      ...createInitialProjectDocument(),
      camera: { ...createInitialProjectDocument().camera, pitch: 61 },
    }), 'Camera pitch must be between 0 and 60'],
    ['a missing map-area lock state', JSON.stringify({
      ...createInitialProjectDocument(),
      camera: { bearing: 0, center: [16.3725, 48.2084], pitch: 0, zoom: 11.2 },
    }), 'Map area lock state must be true or false'],
    ['an unsupported map style', JSON.stringify({
      ...createInitialProjectDocument(),
      style: { preset: 'satellite' },
    }), 'Map style preset is not supported by this version of Print Map Studio'],
    ['an unsupported map language', JSON.stringify({
      ...createInitialProjectDocument(),
      style: { ...createInitialProjectDocument().style, language: 'klingon' },
    }), 'Map language must be local, en, de, fr, it, es, or zh'],
    ['an out-of-range map text scale', JSON.stringify({
      ...createInitialProjectDocument(),
      style: { ...createInitialProjectDocument().style, textScalePercent: 201 },
    }), 'Map text scale must be between 50 and 200 percent'],
    ['a non-boolean map feature visibility value', JSON.stringify({
      ...createInitialProjectDocument(),
      style: {
        ...createInitialProjectDocument().style,
        visibility: { roads: 'yes', buildings: true, labels: true },
      },
    }), 'Map road visibility must be true or false'],
  ])('rejects %s without producing a project', (_name, text, message) => {
    expect(() => parseProjectFileText(text)).toThrow(message);
  });
});
