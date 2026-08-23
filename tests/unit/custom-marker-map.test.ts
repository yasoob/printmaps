import { mapLayerDescriptors, customMarkerImageId } from '../../src/map/MapContentLayerRendering';
import type { ContentLayer } from '../../src/domain/project';
import type { CustomMarkerAsset } from '../../src/domain/customMarkerAssets';

const asset: CustomMarkerAsset = {
  id: `sha256-${'a'.repeat(64)}`,
  mimeType: 'image/svg+xml',
  width: 100,
  height: 120,
  dataUri: 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEyMCI+PC9zdmc+',
};
const layer: ContentLayer = {
  id: 'custom-poi',
  name: 'Custom POI',
  type: 'poi',
  visible: true,
  locked: false,
  opacity: 80,
  appearance: {
    kind: 'poi',
    color: '#0d78b5',
    size: 24,
    markerShape: 'circle',
    markerSymbol: 'coffee',
    label: 'Museum',
    customAssetId: asset.id,
  },
  geometry: { type: 'Point', coordinates: [16.3, 48.2] },
};

describe('custom marker MapLibre descriptors', () => {
  it('uses the registered hash image at the requested marker size while retaining the label', () => {
    const descriptors = mapLayerDescriptors(layer, { selectedId: null, previewedId: null }, { [asset.id]: asset });

    expect(descriptors).toHaveLength(2);
    expect(descriptors[0]).toMatchObject({
      type: 'symbol',
      layout: {
        'icon-image': customMarkerImageId(asset.id),
        'icon-size': 0.2,
        'icon-allow-overlap': true,
      },
      paint: { 'icon-opacity': 0.8 },
    });
    expect(descriptors[1]).toMatchObject({
      type: 'symbol',
      layout: { 'text-field': 'Museum' },
    });
  });

  it('fails closed when the referenced hash asset is unavailable', () => {
    expect(() => mapLayerDescriptors(layer, { selectedId: null, previewedId: null }, {}))
      .toThrow('missing custom marker asset');
  });
});
