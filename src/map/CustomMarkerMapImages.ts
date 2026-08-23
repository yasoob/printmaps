import type { Map as MapLibreMap } from 'maplibre-gl';
import { decodeCustomMarkerImage, type CustomMarkerAsset } from '../domain/customMarkerAssets';
import type { ContentLayer } from '../domain/project';

export function referencedCustomMarkerAssetIds(layers: readonly ContentLayer[]): Set<string> {
  return new Set(layers.flatMap(({ appearance }) => (
    appearance?.kind === 'poi' && appearance.customAssetId ? [appearance.customAssetId] : []
  )));
}

async function registerImage(map: MapLibreMap, assetId: string, assets: Record<string, CustomMarkerAsset>): Promise<void> {
  const asset = assets[assetId];
  if (!asset) throw new Error('A native export custom marker asset is missing.');
  const imageId = `studio-marker-${assetId}`;
  if (map.hasImage(imageId)) return;
  const image = await decodeCustomMarkerImage(asset);
  try {
    map.addImage(imageId, image);
  } finally {
    if ('close' in image && typeof image.close === 'function') image.close();
  }
}

async function registerSequence(
  map: MapLibreMap,
  assetIds: readonly string[],
  assets: Record<string, CustomMarkerAsset>,
  index = 0,
): Promise<void> {
  const assetId = assetIds[index];
  if (!assetId) return;
  await registerImage(map, assetId, assets);
  await registerSequence(map, assetIds, assets, index + 1);
}

export async function registerCustomMarkerImages(
  map: MapLibreMap,
  layers: readonly ContentLayer[],
  assets: Record<string, CustomMarkerAsset>,
): Promise<void> {
  await registerSequence(map, [...referencedCustomMarkerAssetIds(layers)], assets);
}
