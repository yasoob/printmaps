import { parseMapDataFiles } from '../../import/mapDataBatch';
import { createElevationProfilePng, serializeElevationProfileSvg } from '../../export/elevationProfile';
import { sampleRouteCoordinates, type ElevationProfile } from '../../elevation/profile';
import type { LocalProfileRoute, ProfileChartOptions } from './profileSessionTypes';

export type ProfileExportFormat = 'svg' | 'png' | 'pdf';
export async function readProfileRoute(file: File, signal: AbortSignal): Promise<LocalProfileRoute> {
  const { layers } = await parseMapDataFiles([file], [], signal);
  signal.throwIfAborted();
  const routes = layers.filter((layer) => layer.type === 'route' && layer.geometry?.type === 'LineString');
  if (routes.length !== 1 || routes[0].geometry?.type !== 'LineString') {
    throw new Error('Choose a GPX, KML, or GeoJSON file containing exactly one route.');
  }
  sampleRouteCoordinates(routes[0].geometry.coordinates);
  return { coordinates: routes[0].geometry.coordinates, filename: file.name, name: routes[0].name };
}

export async function createProfileBlob(format: ProfileExportFormat, profile: ElevationProfile, name: string, options: ProfileChartOptions): Promise<Blob> {
  if (format === 'svg') return new Blob([serializeElevationProfileSvg(profile, name, options)], { type: 'image/svg+xml' });
  if (format === 'png') return createElevationProfilePng(profile, name, options);
  const { createElevationProfilePdf } = await import('../../export/elevationProfilePdf');
  return createElevationProfilePdf(profile, name, options);
}

export function profileFilename(name: string, format: ProfileExportFormat) {
  const base = name.replaceAll(/[^a-z0-9._-]+/gi, '-').replaceAll(/^[-.]+|[-.]+$/g, '') || 'route';
  return `${base}.elevation.${format}`;
}
