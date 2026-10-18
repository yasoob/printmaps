import type { Map as MapLibreMap } from 'maplibre-gl';
import { decodeCustomMarkerImage, type DecodedCustomMarkerImage } from '../domain/customMarkerAssets';
import { referencedCustomMarkerAssetIds } from '../map/CustomMarkerMapImages';
import type { MapRenderSnapshot } from '../map/MapRenderSnapshot';
import { visibleContentLayers } from '../map/MapContentLayerRendering';
import { requireVideoActive } from './abort';

function releaseImage(image: DecodedCustomMarkerImage): void {
  if ('close' in image) image.close();
}

function decodeImage(
  asset: Parameters<typeof decodeCustomMarkerImage>[0],
  signal: AbortSignal,
): Promise<DecodedCustomMarkerImage> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    void (async () => {
      try {
        requireVideoActive(signal);
        const image = await decodeCustomMarkerImage(asset);
        if (signal.aborted) releaseImage(image);
        else resolve(image);
      } catch (error) {
        reject(error);
      } finally {
        signal.removeEventListener('abort', abort);
      }
    })();
  });
}

export async function prepareVideoMapImages(snapshot: MapRenderSnapshot, signal: AbortSignal) {
  const images = new Map<string, DecodedCustomMarkerImage>();
  const dispose = () => {
    for (const image of images.values()) releaseImage(image);
    images.clear();
  };
  try {
    const layers = visibleContentLayers([...snapshot.layers]);
    for (const id of referencedCustomMarkerAssetIds(layers)) {
      requireVideoActive(signal);
      const asset = snapshot.assets[id];
      if (!asset) throw new Error('A video custom marker asset is missing from the snapshot.');
      // Sequential decode bounds memory and checks cancellation between custom marker assets.
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      images.set(`studio-marker-${id}`, await decodeImage(asset, signal));
    }
    return {
      register: (map: MapLibreMap) => {
        requireVideoActive(signal);
        for (const [id, image] of images) map.addImage(id, image);
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
