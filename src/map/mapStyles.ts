import type { MapStylePreset } from '../domain/project';

const STYLE_URLS: Record<MapStylePreset, string> = {
  liberty: '/styles/liberty.json',
  positron: '/styles/positron.json',
};

export function mapStyleUrl(preset: MapStylePreset): string {
  return STYLE_URLS[preset];
}