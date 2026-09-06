import { useCallback, useLayoutEffect, useRef } from 'react';
import type { PoiAddressReviewRow } from '../../domain/poiAddressReview';
import { lookupPoiAddresses } from '../../services/poiAddressLookup';
import type { SearchProvider } from '../../services/mapbox/contracts';
import { stoppedPoiLookup, type PoiSpreadsheetDraft } from './poiSpreadsheetDraft';
import { useStableEvent } from './useStableEvent';

export type PoiDraftUpdate = (update: (draft: PoiSpreadsheetDraft) => PoiSpreadsheetDraft) => void;
type LookupOwner = { documentEpoch: number; controller: AbortController };

export function usePoiAddressLookup(options: {
  documentEpoch: number;
  provider?: SearchProvider;
  update: PoiDraftUpdate;
}) {
  const ownerRef = useRef<LookupOwner | null>(null);
  const retire = useCallback(() => {
    const owner = ownerRef.current;
    ownerRef.current = null;
    owner?.controller.abort();
  }, []);
  useLayoutEffect(() => retire, [options.documentEpoch, retire]);
  const stop = useStableEvent(() => {
    retire();
    options.update(stoppedPoiLookup);
  });
  const start = useStableEvent(async (rows: readonly PoiAddressReviewRow[]) => {
    stop();
    if (!options.provider) {
      options.update((draft) => ({ ...draft, errors: { ...draft.errors, addresses: 'Configure a Mapbox public token before looking up spreadsheet addresses.' } }));
      return;
    }
    const owner = { documentEpoch: options.documentEpoch, controller: new AbortController() };
    ownerRef.current = owner;
    const ids = new Set(rows.map((row) => row.id));
    options.update((draft) => ({
      ...draft, addressView: 'review', announcement: null,
      errors: { ...draft.errors, addresses: null },
      lookup: { total: rows.length, completed: 0 },
      rows: draft.rows.map((row) => ids.has(row.id) ? { ...row, status: 'queued', candidates: [], selected: null, error: null } : row),
    }));
    try {
      await lookupPoiAddresses({
        provider: options.provider, rows, signal: owner.controller.signal,
        onStart: (id) => {
          if (ownerRef.current !== owner) return;
          options.update((draft) => ({ ...draft, rows: draft.rows.map((row) => row.id === id ? { ...row, status: 'loading' } : row) }));
        },
        onResult: (id, outcome) => {
          if (ownerRef.current !== owner) return;
          options.update((draft) => ({
            ...draft,
            lookup: draft.lookup ? { ...draft.lookup, completed: draft.lookup.completed + 1 } : null,
            rows: draft.rows.map((row) => row.id === id ? {
              ...row, ...outcome,
              status: outcome.error ? 'error' : (outcome.candidates.length > 0 ? 'found' : 'missing'),
              selected: outcome.candidates.length === 1 ? 0 : null,
            } : row),
          }));
        },
      });
    } catch (error) {
      if (!owner.controller.signal.aborted) throw error;
    } finally {
      if (ownerRef.current === owner) {
        ownerRef.current = null;
        options.update((draft) => ({ ...draft, lookup: null, announcement: { scope: 'addresses', message: 'Lookup finished. Review the matched locations before adding any POIs.' } }));
      }
    }
  });
  return { start, stop, retire };
}
