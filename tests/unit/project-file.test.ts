import { createInitialProjectDocument } from '../../src/domain/project';
import { parseProjectFileText } from '../../src/domain/projectFile';

describe('portable project validation', () => {
  it('migrates a version-5 project to the default global text scale', () => {
    const source = createInitialProjectDocument();
    const versionFive = {
      ...source,
      schemaVersion: 5,
      style: { preset: source.style.preset },
    };

    const parsed = parseProjectFileText(JSON.stringify(versionFive));

    expect(parsed.schemaVersion).toBe(7);
    expect(parsed.style).toEqual({
      preset: 'liberty',
      textScalePercent: 100,
      visibility: { roads: true, buildings: true, labels: true },
    });
  });

  it('migrates a version-6 project to default feature visibility', () => {
    const source = createInitialProjectDocument();
    const versionSix = {
      ...source,
      schemaVersion: 6,
      style: { preset: source.style.preset, textScalePercent: 125 },
    };

    const parsed = parseProjectFileText(JSON.stringify(versionSix));

    expect(parsed.schemaVersion).toBe(7);
    expect(parsed.style).toEqual({
      preset: 'liberty',
      textScalePercent: 125,
      visibility: { roads: true, buildings: true, labels: true },
    });
  });

  it('parses a current portable project into a detached canonical document', () => {
    const source = createInitialProjectDocument();

    const parsed = parseProjectFileText(JSON.stringify(source));

    expect(parsed).toEqual(source);
    expect(parsed).not.toBe(source);
    expect(parsed.layers[0]).not.toBe(source.layers[0]);
    expect(parsed.layers[0].geometry).not.toBe(source.layers[0].geometry);
  });

  it('preserves a current portable project custom basemap layer name', () => {
    const source = createInitialProjectDocument();
    source.style = { ...source.style, preset: 'positron', textScalePercent: 100 };
    const basemap = source.layers.find((layer) => layer.type === 'basemap');
    if (!basemap) throw new Error('Expected fixture basemap.');
    basemap.name = 'Client reference map';

    const parsed = parseProjectFileText(JSON.stringify(source));

    expect(parsed.layers.find((layer) => layer.type === 'basemap')?.name).toBe('Client reference map');
  });

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
        geometry: { type: 'Point', coordinates: [181, 48.2] },
      }],
    }), 'longitude must be between -180 and 180'],
    ['geometry that contradicts its layer type', JSON.stringify({
      ...createInitialProjectDocument(),
      layers: [{
        ...createInitialProjectDocument().layers[0],
        geometry: { type: 'Point', coordinates: [16.3, 48.2] },
      }],
    }), 'Route layers may only contain LineString geometry'],
    ['standard preset dimensions that are not canonical', JSON.stringify({
      ...createInitialProjectDocument(),
      page: { preset: 'A4', widthMm: 300, heightMm: 210, orientation: 'landscape' },
    }), 'A4 page dimensions must be 297 × 210 mm in landscape'],
    ['an out-of-range camera bearing', JSON.stringify({
      ...createInitialProjectDocument(),
      camera: { bearing: 181, pitch: 0 },
    }), 'Camera bearing must be between -180 and 180'],
    ['an out-of-range camera pitch', JSON.stringify({
      ...createInitialProjectDocument(),
      camera: { bearing: 0, pitch: 61 },
    }), 'Camera pitch must be between 0 and 60'],
    ['an unsupported map style', JSON.stringify({
      ...createInitialProjectDocument(),
      style: { preset: 'satellite' },
    }), 'Map style preset must be liberty or positron'],
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
