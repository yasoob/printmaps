import type { ProjectDocument } from './project';

export const BASEMAP_ATTRIBUTION = 'OpenFreeMap · OpenMapTiles · © OpenStreetMap contributors';
export const VIENNA_DISTRICT_ATTRIBUTION = 'City of Vienna OGD (CC BY 3.0 AT; boundaries simplified)';

const VIENNA_DISTRICT_LAYER_ID = /^admin-at-9-(?:0[1-9]|1\d|2[0-3])(?:$|-)/;

export function projectAttributions(document: Pick<ProjectDocument, 'layers'>): string[] {
  const attributions = [BASEMAP_ATTRIBUTION];
  if (document.layers.some(({ id }) => VIENNA_DISTRICT_LAYER_ID.test(id))) {
    attributions.push(VIENNA_DISTRICT_ATTRIBUTION);
  }
  return attributions;
}

export function projectAttributionText(document: Pick<ProjectDocument, 'layers'>): string {
  return projectAttributions(document).join(' · ');
}

export function fitAttributionFontSize(text: string, availableWidth: number, maximumFontSize: number): number {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0 || !Number.isFinite(maximumFontSize) || maximumFontSize <= 0) {
    throw new Error('Attribution layout requires a finite positive width and font size.');
  }
  const estimatedEmWidth = Math.max(1, [...text].length * 0.6);
  return Math.min(maximumFontSize, availableWidth / estimatedEmWidth);
}
