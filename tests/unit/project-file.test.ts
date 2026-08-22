import { createInitialProjectDocument } from '../../src/domain/project';
import { parseProjectFileText } from '../../src/domain/projectFile';

describe('portable project validation', () => {
  it('parses a current portable project into a detached canonical document', () => {
    const source = createInitialProjectDocument();

    const parsed = parseProjectFileText(JSON.stringify(source));

    expect(parsed).toEqual(source);
    expect(parsed).not.toBe(source);
    expect(parsed.layers[0]).not.toBe(source.layers[0]);
    expect(parsed.layers[0].geometry).not.toBe(source.layers[0].geometry);
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
  ])('rejects %s without producing a project', (_name, text, message) => {
    expect(() => parseProjectFileText(text)).toThrow(message);
  });
});
