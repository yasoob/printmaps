import type { ProjectDocument } from './project';
import type { TerrainSettings } from './studio';
import { TERRAIN_ATTRIBUTION } from '../terrain/demTiles';

export const BASEMAP_ATTRIBUTION = 'OpenFreeMap · OpenMapTiles · © OpenStreetMap contributors';
// OSMF attribution guideline for printed maps: the credit sits beside the map and the licence URL is printed out.
export const PRINT_BASEMAP_ATTRIBUTIONS = ['© OpenStreetMap contributors (openstreetmap.org/copyright)', 'OpenMapTiles', 'OpenFreeMap'] as const;
export const MAPBOX_ATTRIBUTION = '© Mapbox';
export type TerrainAttributionSettings = Pick<TerrainSettings, 'enabled'> & {
  contours: Pick<TerrainSettings['contours'], 'enabled'>;
};
/**
 * `mapboxCredit` lets views that carry a filtered layer list (the live poster preview) state whether
 * any project layer uses Mapbox data, so their credit matches the export exactly.
 */
export type AttributionDocument = Pick<ProjectDocument, 'layers'> & {
  mapboxCredit?: boolean;
  studio?: { terrain: TerrainAttributionSettings };
};

export function hasMapboxCredit(document: Pick<ProjectDocument, 'layers'>): boolean {
  return document.layers.some(({ provenance }) => provenance?.provider === 'mapbox');
}

function providerAttributions(document: AttributionDocument): string[] {
  const attributions: string[] = [];
  if (document.mapboxCredit ?? hasMapboxCredit(document)) attributions.push(MAPBOX_ATTRIBUTION);
  if (document.studio?.terrain.enabled || document.studio?.terrain.contours.enabled) attributions.push(TERRAIN_ATTRIBUTION);
  return attributions;
}

/**
Screen credit, used beside interactive maps that also link to the sources.
*/
export function projectAttributions(document: AttributionDocument): string[] {
  return [BASEMAP_ATTRIBUTION, ...providerAttributions(document)];
}

export function projectAttributionText(document: AttributionDocument): string {
  return projectAttributions(document).join(' · ');
}

/**
Printed credit for every export format; it includes the licence URL because print cannot link.
*/
export function projectPrintAttributions(document: AttributionDocument): string[] {
  return [...PRINT_BASEMAP_ATTRIBUTIONS, ...providerAttributions(document)];
}

export function projectPrintAttributionText(document: AttributionDocument): string {
  return projectPrintAttributions(document).join(' · ');
}
