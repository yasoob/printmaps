import { readFileSync } from 'node:fs';

import {
  MAX_GEOJSON_COORDINATES,
  MAX_GEOJSON_FEATURES,
  MAX_GEOJSON_FILE_BYTES,
  MAX_GEOJSON_NAME_LENGTH,
  parseGeoJsonText,
} from '../../src/import/geojson';

const supportedFixture = readFileSync(
  'tests/fixtures/import/supported.geojson',
  'utf8',
);

describe('GeoJSON import', () => {
  it('turns supported features into detached canonical editable layers', () => {
    const layers = parseGeoJsonText(supportedFixture);

    expect(layers).toMatchObject([
      {
        id: 'geojson-cafe',
        name: 'Café Central',
        type: 'poi',
        visible: true,
        locked: false,
        opacity: 100,
        geometry: { type: 'Point', coordinates: [16.3738, 48.2082] },
      },
      {
        id: 'geojson-danube-path',
        name: 'Danube path',
        type: 'route',
        visible: true,
        locked: false,
        opacity: 100,
        geometry: {
          type: 'LineString',
          coordinates: [[16.35, 48.2], [16.4, 48.22]],
        },
      },
      {
        id: 'geojson-inner-district',
        name: 'Inner district',
        type: 'shape',
        visible: true,
        locked: false,
        opacity: 100,
        geometry: {
          type: 'Polygon',
          coordinates: [
            [[16.36, 48.2], [16.39, 48.2], [16.39, 48.22], [16.36, 48.2]],
          ],
        },
      },
    ]);

    const source = JSON.parse(supportedFixture) as {
      features: Array<{ geometry: { coordinates: unknown } }>;
    };
    expect(layers[0].geometry?.coordinates).not.toBe(source.features[0].geometry.coordinates);
  });

  it('accepts one Feature as the root and supplies a safe fallback name', () => {
    const layers = parseGeoJsonText(JSON.stringify({
      type: 'Feature',
      properties: null,
      geometry: { type: 'Point', coordinates: [0, 0] },
    }));

    expect(layers).toEqual([expect.objectContaining({
      id: 'geojson-point-1',
      name: 'Point 1',
      type: 'poi',
    })]);
  });

  it('imports bounded MultiPolygon features as canonical editable shapes', () => {
    const [layer] = parseGeoJsonText(JSON.stringify({
      type: 'Feature',
      properties: { name: 'Disconnected region' },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [[[10, 46], [11, 46], [11, 47], [10, 46]]],
          [[[12, 47], [13, 47], [13, 48], [12, 47]]],
        ],
      },
    }));

    expect(layer).toMatchObject({
      id: 'geojson-disconnected-region',
      name: 'Disconnected region',
      type: 'shape',
      geometry: { type: 'MultiPolygon' },
    });
    expect(layer.geometry?.type === 'MultiPolygon' ? layer.geometry.coordinates : []).toHaveLength(2);
  });

  it.each([
    ['malformed JSON', '{', 'not valid JSON'],
    ['a geometry root', JSON.stringify({ type: 'Point', coordinates: [0, 0] }), 'root must be a Feature or FeatureCollection'],
    ['a missing features array', JSON.stringify({ type: 'FeatureCollection' }), 'features must be an array'],
    ['a null geometry', JSON.stringify({ type: 'Feature', properties: {}, geometry: null }), 'geometry must be a JSON object'],
    ['an unsupported MultiPoint', JSON.stringify({
      type: 'Feature', properties: {}, geometry: { type: 'MultiPoint', coordinates: [[0, 0]] },
    }), 'geometry type MultiPoint is not supported'],
    ['an unsupported GeometryCollection', JSON.stringify({
      type: 'Feature', properties: {}, geometry: { type: 'GeometryCollection', geometries: [] },
    }), 'geometry type GeometryCollection is not supported'],
    ['a short LineString', JSON.stringify({
      type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[0, 0]] },
    }), 'LineString needs at least two positions'],
    ['a missing Polygon ring', JSON.stringify({
      type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [] },
    }), 'Polygon needs at least one ring'],
    ['a short Polygon ring', JSON.stringify({
      type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [0, 0]]] },
    }), 'Polygon ring 1 needs at least four positions'],
    ['an open Polygon ring', JSON.stringify({
      type: 'Feature', properties: {}, geometry: {
        type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]],
      },
    }), 'Polygon ring 1 must end at its starting position'],
    ['an empty MultiPolygon', JSON.stringify({
      type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: [] },
    }), 'MultiPolygon needs at least one polygon'],
    ['an empty MultiPolygon part', JSON.stringify({
      type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: [[]] },
    }), 'MultiPolygon polygon 1 needs at least one ring'],
    ['an open MultiPolygon ring', JSON.stringify({
      type: 'Feature', properties: {}, geometry: {
        type: 'MultiPolygon', coordinates: [[[[10, 46], [11, 46], [11, 47], [10, 47]]]],
      },
    }), 'MultiPolygon polygon 1 ring 1 must end at its starting position'],
    ['an altitude coordinate', JSON.stringify({
      type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [0, 0, 20] },
    }), 'exactly longitude and latitude'],
    ['an infinite longitude', '{"type":"Feature","properties":{},"geometry":{"type":"Point","coordinates":[1e400,0]}}', 'longitude must be a finite number'],
    ['an out-of-range longitude', JSON.stringify({
      type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [181, 0] },
    }), 'longitude must be between -180 and 180'],
    ['an out-of-range latitude', JSON.stringify({
      type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [0, 86] },
    }), 'latitude must be between -85.051129 and 85.051129'],
  ])('rejects %s without returning a partial import', (_name, text, message) => {
    expect(() => parseGeoJsonText(text)).toThrow(message);
  });
});

describe('GeoJSON import limits and identity', () => {
  it('rejects the entire collection when a later feature is invalid', () => {
    const collection = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { name: 'Valid' }, geometry: { type: 'Point', coordinates: [0, 0] } },
        { type: 'Feature', properties: { name: 'Invalid' }, geometry: { type: 'MultiLineString', coordinates: [] } },
      ],
    };

    expect(() => parseGeoJsonText(JSON.stringify(collection))).toThrow(
      'Feature 2 geometry type MultiLineString is not supported',
    );
  });

  it('measures the UTF-8 byte limit before parsing', () => {
    const oversizedUtf8 = 'é'.repeat(Math.floor(MAX_GEOJSON_FILE_BYTES / 2) + 1);

    expect(oversizedUtf8.length).toBeLessThan(MAX_GEOJSON_FILE_BYTES);
    expect(() => parseGeoJsonText(oversizedUtf8)).toThrow(
      `GeoJSON files may be at most ${MAX_GEOJSON_FILE_BYTES} bytes`,
    );
  });

  it('rejects a collection above the feature limit before converting any feature', () => {
    const feature = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [0, 0] },
    };
    const text = JSON.stringify({
      type: 'FeatureCollection',
      features: Array.from({ length: MAX_GEOJSON_FEATURES + 1 }, () => feature),
    });

    expect(() => parseGeoJsonText(text)).toThrow(
      `GeoJSON may contain at most ${MAX_GEOJSON_FEATURES} features`,
    );
  });

  it('rejects an import above the aggregate coordinate limit', () => {
    const coordinates = Array.from(
      { length: MAX_GEOJSON_COORDINATES + 1 },
      (_, index) => [index % 180, 0],
    );
    const text = JSON.stringify({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates },
    });

    expect(() => parseGeoJsonText(text)).toThrow(
      `GeoJSON may contain at most ${MAX_GEOJSON_COORDINATES} positions`,
    );
  });

  it('creates deterministic unique IDs without colliding with existing layers', () => {
    const text = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', id: 'Station', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } },
        { type: 'Feature', id: 'Station', properties: {}, geometry: { type: 'Point', coordinates: [1, 1] } },
      ],
    });
    const options = { existingLayerIds: ['geojson-station', 'geojson-station-2'] };

    const first = parseGeoJsonText(text, options);
    const second = parseGeoJsonText(text, options);

    expect(first.map(({ id }) => id)).toEqual(['geojson-station-3', 'geojson-station-4']);
    expect(second.map(({ id }) => id)).toEqual(first.map(({ id }) => id));
  });

  it('normalizes, strips controls from, and bounds imported names by Unicode code point', () => {
    const rawName = `  Café\u{202E}\n  stop ${'😀'.repeat(MAX_GEOJSON_NAME_LENGTH)}  `;
    const text = JSON.stringify({
      type: 'Feature',
      properties: { name: rawName },
      geometry: { type: 'Point', coordinates: [0, 0] },
    });

    const [{ name }] = parseGeoJsonText(text);

    expect(name).toMatch(/^Café stop/);
    expect(name).not.toContain('\u{202E}');
    expect(name).not.toContain('\n');
    expect([...name]).toHaveLength(MAX_GEOJSON_NAME_LENGTH);
  });

  it('rejects a non-string, non-finite feature ID', () => {
    const text = '{"type":"Feature","id":1e400,"properties":{},"geometry":{"type":"Point","coordinates":[0,0]}}';

    expect(() => parseGeoJsonText(text)).toThrow('Feature 1 ID must be a string or finite number');
  });
});
