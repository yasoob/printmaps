import { readFileSync } from 'node:fs';

import {
  MAX_GPX_KML_COORDINATES,
  MAX_GPX_KML_FEATURES,
  MAX_GPX_KML_FILE_BYTES,
  MAX_GPX_KML_NAME_LENGTH,
  parseGpxText,
  parseKmlText,
} from '../../src/import/gpxKml';

const gpxFixture = readFileSync('tests/fixtures/import/wave2/namespaced.gpx', 'utf8');
const kmlFixture = readFileSync('tests/fixtures/import/wave2/namespaced.kml', 'utf8');

describe('GPX and KML import', () => {
  it('imports namespaced GPX waypoints, routes, and tracks as detached 2D layers', () => {
    expect(parseGpxText(gpxFixture)).toMatchObject([
      {
        id: 'gpx-cafe-central',
        name: 'Café Central',
        type: 'poi',
        visible: true,
        locked: false,
        opacity: 100,
        geometry: { type: 'Point', coordinates: [16.3738, 48.2082] },
      },
      {
        id: 'gpx-danube-route',
        name: 'Danube route',
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
        id: 'gpx-morgenweg',
        name: 'Morgenweg 東京',
        type: 'route',
        visible: true,
        locked: false,
        opacity: 100,
        geometry: {
          type: 'LineString',
          coordinates: [[16.41, 48.23], [16.42, 48.24]],
        },
      },
    ]);
  });

  it('imports namespaced KML points, lines, and polygons from nested folders', () => {
    expect(parseKmlText(kmlFixture)).toMatchObject([
      {
        id: 'kml-cafe-point',
        name: 'Café point',
        type: 'poi',
        visible: true,
        locked: false,
        opacity: 100,
        geometry: { type: 'Point', coordinates: [16.3738, 48.2082] },
      },
      {
        id: 'kml-rio-line',
        name: 'Río line',
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
        id: 'kml-polygon',
        name: '公園 polygon',
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
  });

  it.each([
    ['GPX', '<gpx xmlns="http://www.topografix.com/GPX/1/1"/>', parseGpxText],
    ['KML', '<kml xmlns="http://www.opengis.net/kml/2.2"/>', parseKmlText],
  ])('rejects an empty %s document', (format, text, parse) => {
    expect(() => parse(text)).toThrow(`${format} contains no supported features`);
  });

  it('rejects DTD and entity declarations before XML parsing', () => {
    const text = `<!DOCTYPE gpx [<!ENTITY xxe SYSTEM "https://example.invalid/secret">]>
      <gpx><wpt lat="0" lon="0"><name>&xxe;</name></wpt></gpx>`;

    expect(() => parseGpxText(text)).toThrow('DTD and entity declarations are not allowed');
  });

  it('rejects unsupported KML geometry instead of silently dropping it', () => {
    const text = `<kml><Placemark><name>Many</name><MultiGeometry>
      <Point><coordinates>0,0</coordinates></Point>
    </MultiGeometry></Placemark></kml>`;

    expect(() => parseKmlText(text)).toThrow('Placemark 1 geometry type MultiGeometry is not supported');
  });

  it('imports KML polygon inner boundaries as detached rings', () => {
    const text = `<kml><Placemark><Polygon>
      <outerBoundaryIs><LinearRing><coordinates>0,0 4,0 4,4 0,0</coordinates></LinearRing></outerBoundaryIs>
      <innerBoundaryIs><LinearRing><coordinates>1,1 2,1 2,2 1,1</coordinates></LinearRing></innerBoundaryIs>
    </Polygon></Placemark></kml>`;

    expect(parseKmlText(text)[0].geometry).toEqual({
      type: 'Polygon',
      coordinates: [
        [[0, 0], [4, 0], [4, 4], [0, 0]],
        [[1, 1], [2, 1], [2, 2], [1, 1]],
      ],
    });
  });

  it.each([
    ['GPX', '<evil:gpx xmlns:evil="https://example.invalid"><evil:wpt lat="0" lon="0"/></evil:gpx>', parseGpxText],
    ['KML', '<evil:kml xmlns:evil="https://example.invalid"><evil:Placemark><evil:Point><evil:coordinates>0,0</evil:coordinates></evil:Point></evil:Placemark></evil:kml>', parseKmlText],
  ])('rejects a %s root in an unrelated namespace', (format, text, parse) => {
    expect(() => parse(text)).toThrow(`${format} root namespace is not supported`);
  });

  it('rejects multi-segment GPX tracks rather than inventing a connecting line', () => {
    const text = `<gpx><trk><trkseg><trkpt lat="0" lon="0"/><trkpt lat="1" lon="1"/></trkseg>
      <trkseg><trkpt lat="2" lon="2"/><trkpt lat="3" lon="3"/></trkseg></trk></gpx>`;

    expect(() => parseGpxText(text)).toThrow('Track 1 has multiple segments, which are not supported');
  });

  it.each([
    ['malformed GPX XML', '<gpx>', parseGpxText, 'not valid GPX XML'],
    ['a non-GPX root', '<kml/>', parseGpxText, 'GPX root element must be gpx'],
    ['a GPX waypoint without latitude', '<gpx><wpt lon="0"/></gpx>', parseGpxText, 'latitude must be a finite number'],
    ['a GPX route with one position', '<gpx><rte><rtept lat="0" lon="0"/></rte></gpx>', parseGpxText, 'needs at least two positions'],
    ['an out-of-range GPX longitude', '<gpx><wpt lat="0" lon="181"/></gpx>', parseGpxText, 'longitude must be between -180 and 180'],
    ['malformed KML XML', '<kml>', parseKmlText, 'not valid KML XML'],
    ['a non-KML root', '<gpx/>', parseKmlText, 'KML root element must be kml'],
    ['a KML placemark without geometry', '<kml><Placemark/></kml>', parseKmlText, 'Placemark 1 has no geometry'],
    ['a malformed KML tuple', '<kml><Placemark><Point><coordinates>0,0,</coordinates></Point></Placemark></kml>', parseKmlText, 'optional altitude'],
    ['a KML point with two positions', '<kml><Placemark><Point><coordinates>0,0 1,1</coordinates></Point></Placemark></kml>', parseKmlText, 'exactly one position'],
    ['a short KML line', '<kml><Placemark><LineString><coordinates>0,0</coordinates></LineString></Placemark></kml>', parseKmlText, 'needs at least two positions'],
    ['an open KML polygon', '<kml><Placemark><Polygon><outerBoundaryIs><LinearRing><coordinates>0,0 1,0 1,1 0,1</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></kml>', parseKmlText, 'must end at its starting position'],
    ['an out-of-range KML latitude', '<kml><Placemark><Point><coordinates>0,-91</coordinates></Point></Placemark></kml>', parseKmlText, 'latitude must be between -90 and 90'],
  ])('rejects %s without returning a partial import', (_case, text, parse, message) => {
    expect(() => parse(text)).toThrow(message);
  });

  it('measures the shared UTF-8 XML file limit before parsing', () => {
    const text = 'é'.repeat(Math.floor(MAX_GPX_KML_FILE_BYTES / 2) + 1);

    expect(text.length).toBeLessThan(MAX_GPX_KML_FILE_BYTES);
    expect(() => parseGpxText(text)).toThrow(
      `GPX files may be at most ${MAX_GPX_KML_FILE_BYTES} bytes`,
    );
  });

  it('rejects KML above the feature limit before geometry conversion', () => {
    const placemark = '<Placemark><Point><coordinates>0,0</coordinates></Point></Placemark>';
    const text = `<kml>${placemark.repeat(MAX_GPX_KML_FEATURES + 1)}</kml>`;

    expect(() => parseKmlText(text)).toThrow(
      `KML may contain at most ${MAX_GPX_KML_FEATURES} features`,
    );
  });

  it('rejects KML above the aggregate coordinate limit', () => {
    const coordinates = '0,0 '.repeat(MAX_GPX_KML_COORDINATES + 1);
    const text = `<kml><Placemark><LineString><coordinates>${coordinates}</coordinates></LineString></Placemark></kml>`;

    expect(() => parseKmlText(text)).toThrow(
      `GPX/KML may contain at most ${MAX_GPX_KML_COORDINATES} positions`,
    );
  });

  it('sanitizes and bounds names while assigning deterministic collision-free IDs', () => {
    const rawName = `  Café\u{202E}\n stop ${'😀'.repeat(MAX_GPX_KML_NAME_LENGTH)}  `;
    const text = `<kml><Placemark><name>${rawName}</name><Point><coordinates>0,0</coordinates></Point></Placemark>
      <Placemark><name>Café stop</name><Point><coordinates>1,1</coordinates></Point></Placemark></kml>`;
    const options = { existingLayerIds: ['kml-cafe-stop'] };

    const first = parseKmlText(text, options);
    const second = parseKmlText(text, options);

    expect(first.map(({ id }) => id)).toEqual(['kml-cafe-stop-2', 'kml-cafe-stop-3']);
    expect(first[0].name).not.toContain('\u{202E}');
    expect(first[0].name).not.toContain('\n');
    expect([...first[0].name]).toHaveLength(MAX_GPX_KML_NAME_LENGTH);
    expect(second).toEqual(first);
    expect(second[0].geometry).not.toBe(first[0].geometry);
  });

  it.each([
    ['GPX', '<gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:evil="https://example.invalid"><evil:wpt lat="0" lon="0"/></gpx>', parseGpxText],
    ['KML', '<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:evil="https://example.invalid"><evil:Placemark><evil:Point><evil:coordinates>0,0</evil:coordinates></evil:Point></evil:Placemark></kml>', parseKmlText],
  ])('does not treat foreign-namespace %s extensions as native features', (format, text, parse) => {
    expect(() => parse(text)).toThrow(`${format} contains no supported features`);
  });
});

describe('GPX and KML numeric syntax', () => {
  it.each(['0x10', '0b10', '0o10'].flatMap((value) => [
    [`GPX coordinate ${value}`, `<gpx><wpt lat="0" lon="${value}"/></gpx>`, parseGpxText],
    [`KML coordinate ${value}`, `<kml><Placemark><Point><coordinates>${value},0</coordinates></Point></Placemark></kml>`, parseKmlText],
    [`KML altitude ${value}`, `<kml><Placemark><Point><coordinates>0,0,${value}</coordinates></Point></Placemark></kml>`, parseKmlText],
  ] as const))('rejects non-decimal %s syntax', (_case, text, parse) => {
    expect(() => parse(text)).toThrow('must be a finite number');
  });

  it('accepts complete decimal coordinate and altitude syntax', () => {
    expect(parseGpxText('<gpx><wpt lat="-4.8e1" lon="+16.5"/></gpx>')[0].geometry).toEqual({
      type: 'Point',
      coordinates: [16.5, -48],
    });
    expect(parseKmlText('<kml><Placemark><Point><coordinates>+.5,-.25,1.2e3</coordinates></Point></Placemark></kml>')[0].geometry).toEqual({
      type: 'Point',
      coordinates: [0.5, -0.25],
    });
  });
});
