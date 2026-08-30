import {
  createDefaultLayerAppearance,
  createDefaultRouteAppearance,
  type ContentLayer,
} from '../../src/domain/project';
import {
  applyMapDataBatchAppearance,
  createMapDataBatchAppearance,
} from '../../src/import/mapDataBatchAppearance';

function importedLayer(type: 'route' | 'poi' | 'shape'): ContentLayer {
  let geometry: ContentLayer['geometry'];
  if (type === 'route') {
    geometry = { type: 'LineString', coordinates: [[16, 48], [17, 49]] };
  } else if (type === 'poi') {
    geometry = { type: 'Point', coordinates: [16, 48] };
  } else {
    geometry = { type: 'Polygon', coordinates: [[[16, 48], [17, 48], [16, 49], [16, 48]]] };
  }
  return {
    id: `imported-${type}`,
    name: `Imported ${type}`,
    type,
    ...(type === 'route' && { route: { kind: 'straight' as const, closed: false } }),
    visible: true,
    locked: false,
    opacity: 100,
    appearance: type === 'route'
      ? createDefaultRouteAppearance(1)
      : createDefaultLayerAppearance(type),
    geometry,
  };
}

describe('reviewed map-data batch appearance', () => {
  it('applies one bounded style per imported layer type without mutating the review batch', () => {
    const layers = [importedLayer('route'), importedLayer('poi'), importedLayer('shape')];
    const settings = createMapDataBatchAppearance(layers);
    settings.route.color = '#112233';
    settings.route.width = '7';
    settings.poi.color = '#445566';
    settings.poi.size = '22';
    settings.poi.markerShape = 'diamond';
    settings.shape.fillColor = '#778899';
    settings.shape.strokeColor = '#aabbcc';
    settings.shape.strokeWidth = '3';

    const styled = applyMapDataBatchAppearance(layers, settings);

    expect(styled.map(({ appearance }) => appearance)).toEqual([
      {
        kind: 'route', color: '#112233', width: 7, strokeStyle: 'solid', marker: null, segmentStyles: [null],
      },
      {
        kind: 'poi', color: '#445566', size: 22, markerShape: 'diamond', markerSymbol: 'none', label: '', customAssetId: null,
      },
      {
        kind: 'shape', fillColor: '#778899', strokeColor: '#aabbcc', strokeWidth: 3, invert: false,
      },
    ]);
    expect(layers.map(({ appearance }) => appearance)).toEqual([
      createDefaultRouteAppearance(1),
      createDefaultLayerAppearance('poi'),
      createDefaultLayerAppearance('shape'),
    ]);
  });
});
