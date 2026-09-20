import type { ProjectDocument } from './project';
import type { StudioSettings } from './studio';
import { TERRAIN_ATTRIBUTION } from '../terrain/demTiles';

export const BASEMAP_ATTRIBUTION = 'OpenFreeMap · OpenMapTiles · © OpenStreetMap contributors';
export const MAPBOX_ATTRIBUTION = '© Mapbox';
type AttributionDocument = Pick<ProjectDocument, 'layers'> & { studio?: Pick<StudioSettings, 'terrain'> };

export function projectAttributions(document: AttributionDocument): string[] {
  const attributions = [BASEMAP_ATTRIBUTION];
  if (document.layers.some(({ provenance }) => provenance?.provider === 'mapbox')) {
    attributions.push(MAPBOX_ATTRIBUTION);
  }
  if (document.studio?.terrain.enabled || document.studio?.terrain.contours.enabled) attributions.push(TERRAIN_ATTRIBUTION);
  return attributions;
}

export function projectAttributionText(document: AttributionDocument): string {
  return projectAttributions(document).join(' · ');
}

export function fitAttributionFontSize(text: string, availableWidth: number, maximumFontSize: number): number {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0 || !Number.isFinite(maximumFontSize) || maximumFontSize <= 0) {
    throw new Error('Attribution layout requires a finite positive width and font size.');
  }
  const estimatedEmWidth = Math.max(1, [...text].length * 0.6);
  return Math.min(maximumFontSize, availableWidth / estimatedEmWidth);
}
