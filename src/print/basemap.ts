import { serializeVectorBasemap } from '../export/vector/svg';
import { vectorXml } from '../export/vector/scene';
import type { VectorBasemapScene } from '../export/vector/scene';

export type RasterBasemapAsset = Readonly<{ dataUri: string; pixelWidth: number; pixelHeight: number }>;
export type PrintBasemapAsset = RasterBasemapAsset | VectorBasemapScene;

export function serializeBasemapAsset(asset: PrintBasemapAsset, width: number, height: number): string {
  if ('kind' in asset) return serializeVectorBasemap(asset, width, height);
  return `<image href="${vectorXml(asset.dataUri)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" data-pixel-width="${asset.pixelWidth}" data-pixel-height="${asset.pixelHeight}"/>`;
}
