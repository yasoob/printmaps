import type { PoiAddressReviewRow } from '../../domain/poiAddressReview';

export type PoiSpreadsheetMode = 'coordinates' | 'addresses';
export type PoiSpreadsheetDraft = {
  documentEpoch: number;
  mode: PoiSpreadsheetMode;
  buffers: Record<PoiSpreadsheetMode, string>;
  addressView: 'edit' | 'review';
  rows: readonly PoiAddressReviewRow[];
  page: number;
  errors: Record<PoiSpreadsheetMode, string | null>;
  lookup: { total: number; completed: number } | null;
  announcement: { scope: PoiSpreadsheetMode | 'all'; message: string } | null;
};

export function createPoiSpreadsheetDraft(documentEpoch: number): PoiSpreadsheetDraft {
  return { documentEpoch, mode: 'coordinates', buffers: { coordinates: '', addresses: '' }, addressView: 'edit', rows: [], page: 0, errors: { coordinates: null, addresses: null }, lookup: null, announcement: null };
}

export function hasPoiSpreadsheetWork(draft: PoiSpreadsheetDraft): boolean {
  return Boolean(draft.buffers.coordinates.trim() || draft.buffers.addresses.trim() || draft.rows.length > 0);
}

export function visiblePoiSpreadsheetAnnouncement(draft: PoiSpreadsheetDraft): string | null {
  const announcement = draft.announcement;
  if (!announcement) return null;
  return announcement.scope === draft.mode || announcement.scope === 'all' ? announcement.message : null;
}

export function stoppedPoiLookup(draft: PoiSpreadsheetDraft): PoiSpreadsheetDraft {
  if (!draft.lookup) return draft;
  return {
    ...draft, lookup: null,
    rows: draft.rows.map((row) => row.status === 'queued' || row.status === 'loading' ? { ...row, status: 'stopped' } : row),
    announcement: { scope: 'addresses', message: 'Lookup stopped. Completed suggestions are kept. Retry unfinished rows when ready.' },
  };
}
