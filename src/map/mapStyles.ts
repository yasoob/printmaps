import type { MapStylePreset } from '../domain/project';

const STYLE_URLS: Record<MapStylePreset, string> = {
  bright: '/styles/bright.json',
  liberty: '/styles/liberty.json',
  positron: '/styles/positron.json',
};

export function mapStyleUrl(preset: MapStylePreset): string {
  return STYLE_URLS[preset];
}