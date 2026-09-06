import { isPoiLabelValid, MAX_POI_LABEL_CHARACTERS } from './poiMarkers';
import { MAX_POI_ADDRESS_CHARACTERS, type PoiAddressSpreadsheetEntry, type PoiSpreadsheetEntry } from './poiSpreadsheet';
import { isValidPosition } from './routeGeometry';
import type { SearchResult } from '../services/mapbox/contracts';

export const POI_ADDRESS_MATCH_LIMIT = 5;
export const POI_ADDRESS_REVIEW_PAGE_SIZE = 5;

export type PoiAddressReviewRow = PoiAddressSpreadsheetEntry & {
  id: number;
  included: boolean;
  status: 'changed' | 'queued' | 'loading' | 'found' | 'missing' | 'error' | 'stopped';
  candidates: readonly SearchResult[];
  selected: number | null;
  error: string | null;
};

export function createPoiAddressReview(rows: readonly PoiAddressSpreadsheetEntry[]): PoiAddressReviewRow[] {
  return rows.map((row, id) => ({ ...row, id, included: true, status: 'changed', candidates: [], selected: null, error: null }));
}

export function poiAddressNameError(name: string): string | null {
  return name.trim() && isPoiLabelValid(name.trim())
    ? null : `Enter a POI name of 1–${MAX_POI_LABEL_CHARACTERS} characters without control characters.`;
}

export function poiAddressQueryError(address: string): string | null {
  const query = address.trim();
  return query && [...query].length <= MAX_POI_ADDRESS_CHARACTERS && !/[\p{Cc}\p{Cf}]/u.test(query)
    ? null : `Enter an address of 1–${MAX_POI_ADDRESS_CHARACTERS} characters without control characters.`;
}

export function validPoiAddressCandidates(results: readonly SearchResult[]): readonly SearchResult[] {
  const candidates = results.slice(0, POI_ADDRESS_MATCH_LIMIT);
  if (candidates.some((candidate) => (
    !candidate.label.trim()
    || candidate.center.length !== 2
    || !isValidPosition(candidate.center[0], candidate.center[1])
    || !candidate.providerFeatureId.trim()
  ))) throw new Error('The provider returned unusable location data. Correct the address or retry.');
  return candidates.map((candidate) => ({ ...candidate, center: [...candidate.center] as [number, number] }));
}

export function selectedPoiAddress(row: PoiAddressReviewRow): SearchResult | undefined {
  return row.status === 'found' && row.selected !== null ? row.candidates[row.selected] : undefined;
}

export function poiAddressCommitError(rows: readonly PoiAddressReviewRow[]): string | null {
  const selected = rows.filter((row) => row.included);
  if (selected.length === 0) return 'Select at least one row to add.';
  for (const row of selected) {
    const nameError = poiAddressNameError(row.name);
    if (nameError) return `Row ${row.id + 1}: ${nameError}`;
    if (!selectedPoiAddress(row)) return `Row ${row.id + 1}: choose a matched location, look up the address again, or exclude this row.`;
  }
  return null;
}

export function poiAddressEntries(rows: readonly PoiAddressReviewRow[]): PoiSpreadsheetEntry[] {
  const error = poiAddressCommitError(rows);
  if (error) throw new Error(error);
  return rows.filter((row) => row.included).map((row) => {
    const candidate = selectedPoiAddress(row)!;
    return { name: row.name.trim(), coordinates: [...candidate.center], providerFeatureId: candidate.providerFeatureId };
  });
}
