import { MAP_STYLE_PRESETS, MAP_STYLE_TOKEN_ROLES } from '../../src/domain/mapStylePresets';
import {
  createDefaultMapStyleCustomization,
  isMapStyleCustomized,
  resolveMapStyleTokens,
} from '../../src/domain/mapStyleCustomization';

describe('map style customization', () => {
  it('preserves the preset exactly at neutral defaults', () => {
    const paper = MAP_STYLE_PRESETS.find(({ id }) => id === 'paper')!;

    expect(resolveMapStyleTokens('paper', createDefaultMapStyleCustomization())).toEqual(paper.tokens);
    expect(isMapStyleCustomized(createDefaultMapStyleCustomization())).toBe(false);
  });

  it('resolves quick adjustments before applying explicit semantic overrides', () => {
    const customization = {
      tone: 'warm' as const,
      contrast: 80,
      detail: 20,
      colors: { water: '#123456' },
    };
    const resolved = resolveMapStyleTokens('paper', customization);
    const paper = MAP_STYLE_PRESETS.find(({ id }) => id === 'paper')!;

    expect(resolved.water).toBe('#123456');
    expect(resolved.land).not.toBe(paper.tokens.land);
    expect(resolved.label).not.toBe(paper.tokens.label);
    expect(resolved.building).not.toBe(paper.tokens.building);
    expect(isMapStyleCustomized(customization)).toBe(true);
    expect(Object.keys(resolved)).toEqual(MAP_STYLE_TOKEN_ROLES);
    expect(Object.values(resolved).every((color) => /^#[\da-f]{6}$/i.test(color))).toBe(true);
  });
});
