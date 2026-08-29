import type { MapStylePreset } from '../domain/project';
import { publicAssetUrl } from '../domain/publicAssetUrl';

export function mapStyleUrl(preset: MapStylePreset): string {
  return publicAssetUrl(`styles/${preset}.json`);
}