import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer } from '../../src/domain/project';
import type { CustomMarkerAsset } from '../../src/domain/customMarkerAssets';
import { createMapLibreContentAdapter } from '../../src/map/MapContentAdapter';

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
  opacity: 100,
  appearance: {
    kind: 'poi', color: '#0d78b5', size: 24, markerShape: 'circle', markerSymbol: 'none', label: '', customAssetId: asset.id,
  },
  geometry: { type: 'Point', coordinates: [16.3, 48.2] },
};

describe('custom marker map image lifecycle', () => {
  it('defers content until the hash image is decoded and registered, then cleans it up', async () => {
    const sources = new Set<string>();
    const layers = new Set<string>();
    const images = new Set<string>();
    const repaint = vi.fn();
    const map = {
      isStyleLoaded: () => true,
      hasImage: (id: string) => images.has(id),
      addImage: (id: string) => { images.add(id); },
      removeImage: (id: string) => { images.delete(id); },
      addSource: (id: string) => { sources.add(id); },
      getSource: (id: string) => sources.has(id) ? {} : undefined,
      removeSource: (id: string) => { sources.delete(id); },
      addLayer: ({ id }: { id: string }) => { layers.add(id); },
      getLayer: (id: string) => layers.has(id) ? {} : undefined,
      removeLayer: (id: string) => { layers.delete(id); },
      setPaintProperty: vi.fn(),
      setLayoutProperty: vi.fn(),
      queryRenderedFeatures: () => [],
      triggerRepaint: repaint,
    } as unknown as MapLibreMap;
    const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
    const decodeImage = vi.fn(async () => bitmap);
    const adapter = createMapLibreContentAdapter(map, document.createElement('div'), { decodeImage });
    const state = { layers: [layer], assets: { [asset.id]: asset }, selectedId: null, previewedId: null };

    expect(adapter.sync(state)).toBe('deferred');
    expect(sources).toHaveLength(0);
    await vi.waitFor(() => expect(repaint).toHaveBeenCalledOnce());
    expect(decodeImage).toHaveBeenCalledWith(asset);
    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(adapter.sync(state)).toBe('synced');
    expect(images).toHaveLength(1);
    expect(layers).toHaveLength(1);

    expect(adapter.sync({ ...state, layers: [] })).toBe('synced');
    expect(images).toHaveLength(0);

    adapter.destroy();
    expect(images).toHaveLength(0);
    expect(layers).toHaveLength(0);
    expect(sources).toHaveLength(0);
  });

  it('does not register an image whose marker was removed while decoding', async () => {
    const sources = new Set<string>();
    const layers = new Set<string>();
    const images = new Set<string>();
    const repaint = vi.fn();
    const map = {
      isStyleLoaded: () => true,
      hasImage: (id: string) => images.has(id),
      addImage: (id: string) => { images.add(id); },
      removeImage: (id: string) => { images.delete(id); },
      addSource: (id: string) => { sources.add(id); },
      getSource: (id: string) => sources.has(id) ? {} : undefined,
      removeSource: (id: string) => { sources.delete(id); },
      addLayer: ({ id }: { id: string }) => { layers.add(id); },
      getLayer: (id: string) => layers.has(id) ? {} : undefined,
      removeLayer: (id: string) => { layers.delete(id); },
      setPaintProperty: vi.fn(), setLayoutProperty: vi.fn(), queryRenderedFeatures: () => [], triggerRepaint: repaint,
    } as unknown as MapLibreMap;
    let resolveImage!: (image: ImageBitmap) => void;
    const decodeImage = vi.fn(() => new Promise<ImageBitmap>((resolve) => { resolveImage = resolve; }));
    const adapter = createMapLibreContentAdapter(map, document.createElement('div'), { decodeImage });
    const state = { layers: [layer], assets: { [asset.id]: asset }, selectedId: null, previewedId: null };

    expect(adapter.sync(state)).toBe('deferred');
    expect(adapter.sync({ ...state, layers: [] })).toBe('synced');
    const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
    resolveImage(bitmap);
    await vi.waitFor(() => expect(repaint).toHaveBeenCalledOnce());
    expect(images).toHaveLength(0);
    expect(bitmap.close).toHaveBeenCalledOnce();
    adapter.destroy();
  });
});
