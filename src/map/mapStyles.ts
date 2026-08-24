import type { MapStylePreset } from '../domain/project';

export function mapStyleUrl(preset: MapStylePreset): string {
  return `/styles/${preset}.json`;
}