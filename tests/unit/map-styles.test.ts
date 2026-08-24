import { readFileSync } from 'node:fs';
import path from 'node:path';
import { MAP_STYLE_PRESETS, MAP_STYLE_TOKEN_ROLES } from '../../src/domain/mapStylePresets';
import { mapStyleUrl } from '../../src/map/mapStyles';

const readStyle = (name: string) => JSON.parse(readFileSync(path.resolve('public/styles', `${name}.json`), 'utf8'));

describe('open map style registry', () => {
  it('provides twelve original semantic-token presets with same-origin styles and thumbnails', () => {
    expect(MAP_STYLE_PRESETS).toHaveLength(12);
    expect(new Set(MAP_STYLE_PRESETS.map(({ id }) => id))).toHaveLength(12);
    expect(new Set(MAP_STYLE_PRESETS.map(({ family }) => family)))
      .toEqual(new Set(['minimal', 'editorial', 'dark', 'soft', 'natural', 'playful']));

    for (const preset of MAP_STYLE_PRESETS) {
      expect(Object.keys(preset.tokens)).toEqual(MAP_STYLE_TOKEN_ROLES);
      expect(mapStyleUrl(preset.id)).toBe(`/styles/${preset.id}.json`);
      expect(preset.thumbnailUrl).toBe(`/style-thumbnails/${preset.id}.png`);
    }
  });

  it('keeps generated preset styles on one layer structure with embedded semantic provenance', () => {
    const baseLayerIds = readStyle('bright').layers.map(({ id }: { id: string }) => id);

    for (const preset of MAP_STYLE_PRESETS) {
      const style = readStyle(preset.id);
      expect(style.layers.map(({ id }: { id: string }) => id)).toEqual(baseLayerIds);
      expect(style.metadata?.['print-map-studio:preset']).toBe(preset.id);
      expect(style.metadata?.['print-map-studio:semantic-tokens']).toEqual(preset.tokens);
    }
  });
});