import { createMapLanguageController } from '../../src/map/MapLanguage';

describe('map language controller', () => {
  it('applies translated basemap labels with the original local expression as fallback', () => {
    const setLayoutProperty = vi.fn();
    const localName = ['coalesce', ['get', 'name:latin'], ['get', 'name']];
    const controller = createMapLanguageController({
      getStyle: () => ({
        layers: [
          { id: 'place-city', type: 'symbol', layout: { 'text-field': localName } },
          { id: 'studio-layer-poi-label', type: 'symbol', layout: { 'text-field': ['get', 'studio-label'] } },
          { id: 'road-primary', type: 'line' },
        ],
      }),
      setLayoutProperty,
    });

    controller.apply('de');

    expect(setLayoutProperty).toHaveBeenCalledOnce();
    expect(setLayoutProperty).toHaveBeenCalledWith('place-city', 'text-field', [
      'coalesce',
      ['get', 'name:de'],
      ['get', 'name_de'],
      localName,
    ]);

    controller.apply('local');
    expect(setLayoutProperty).toHaveBeenLastCalledWith('place-city', 'text-field', localName);
  });
});
