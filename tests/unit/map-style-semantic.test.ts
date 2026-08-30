import {
  applySemanticTokensToMap,
  applySemanticTokensToStyle,
  createSemanticMapStyleController,
  type SemanticStyleLayer,
} from '../../src/map/MapStyleSemantic';
import { MAP_STYLE_PRESETS } from '../../src/domain/mapStylePresets';

describe('semantic map style application', () => {
  const tokens = MAP_STYLE_PRESETS.find(({ id }) => id === 'signal')!.tokens;
  const style: { metadata: Record<string, unknown>; layers: SemanticStyleLayer[] } = {
    metadata: { source: 'fixture' },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#000000' } },
      { id: 'water-fill', type: 'fill', 'source-layer': 'water', paint: { 'fill-color': '#000000' } },
      { id: 'road-primary', type: 'line', 'source-layer': 'transportation', paint: { 'line-color': '#000000' } },
      { id: 'place-label', type: 'symbol', paint: { 'text-color': '#000000', 'text-halo-color': '#000000' } },
      { id: 'studio-layer-route', type: 'line', paint: { 'line-color': '#ff0000' } },
    ],
  };

  it('creates a customized export style without mutating the source or content layers', () => {
    const customized = applySemanticTokensToStyle(style, tokens);
    const [background, water, road, label, studioRoute] = customized.layers;

    expect(customized).not.toBe(style);
    expect(customized.metadata['print-map-studio:semantic-tokens']).toEqual(tokens);
    expect(background!.paint!['background-color']).toBe(tokens.canvas);
    expect(water!.paint!['fill-color']).toBe(tokens.water);
    expect(road!.paint!['line-color']).toBe(tokens.majorRoad);
    expect(label!.paint!['text-color']).toBe(tokens.label);
    expect(label!.paint!['text-halo-color']).toBe(tokens.labelHalo);
    expect(studioRoute!.paint!['line-color']).toBe('#ff0000');
    expect(style.layers[0]!.paint!['background-color']).toBe('#000000');
  });

  it('updates only existing basemap paint properties on the live map', () => {
    const setPaintProperty = vi.fn();
    const map = {
      getStyle: () => structuredClone(style),
      setPaintProperty,
    };

    applySemanticTokensToMap(map as unknown as Parameters<typeof applySemanticTokensToMap>[0], tokens);

    expect(setPaintProperty).toHaveBeenCalledWith('background', 'background-color', tokens.canvas);
    expect(setPaintProperty).toHaveBeenCalledWith('water-fill', 'fill-color', tokens.water);
    expect(setPaintProperty).toHaveBeenCalledWith('road-primary', 'line-color', tokens.majorRoad);
    expect(setPaintProperty).not.toHaveBeenCalledWith('studio-layer-route', expect.anything(), expect.anything());
  });

  it('caches semantic layer assignments for repeated live adjustments', () => {
    const getStyle = vi.fn(() => structuredClone(style));
    const setPaintProperty = vi.fn();
    const map = { getStyle, setPaintProperty };
    const controller = createSemanticMapStyleController(
      map as unknown as Parameters<typeof createSemanticMapStyleController>[0],
    );

    controller.apply(tokens);
    controller.apply(tokens);

    expect(getStyle).toHaveBeenCalledOnce();
    expect(setPaintProperty).toHaveBeenCalled();
  });
});
