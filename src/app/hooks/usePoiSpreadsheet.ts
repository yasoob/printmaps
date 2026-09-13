import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPoiAddressReview, poiAddressCommitError, poiAddressEntries, type PoiAddressReviewRow } from '../../domain/poiAddressReview';
import { parsePoiAddressSpreadsheet, parsePoiSpreadsheet, type PoiSpreadsheetEntry } from '../../domain/poiSpreadsheet';
import { mutationRejected, type ProjectMutationResult } from '../../domain/projectMutation';
import type { SearchProvider } from '../../services/mapbox/contracts';
import { createPoiSpreadsheetDraft, hasPoiSpreadsheetWork, type PoiSpreadsheetMode } from './poiSpreadsheetDraft';
import { usePoiAddressLookup, type PoiDraftUpdate } from './usePoiAddressLookup';
import { useStableEvent } from './useStableEvent';
import { trackEditorAction } from '../../analytics/editorAnalytics';

type PoiSpreadsheetOptions = {
  documentEpoch: number;
  onSubmit: (entries: readonly PoiSpreadsheetEntry[]) => ProjectMutationResult;
  onComplete: () => void;
  searchProvider?: SearchProvider;
};

function useSpreadsheetDraft(documentEpoch: number) {
  const initial = useMemo(() => createPoiSpreadsheetDraft(documentEpoch), [documentEpoch]);
  const [stored, setStored] = useState(initial);
  const draftRef = useRef(initial);
  const aliveRef = useRef(true);
  if (stored.documentEpoch !== documentEpoch) setStored(initial);
  useLayoutEffect(() => {
    aliveRef.current = true;
    draftRef.current = initial;
    return () => { aliveRef.current = false; };
  }, [initial]);
  const update = useCallback<PoiDraftUpdate>((change) => {
    if (!aliveRef.current) return;
    const next = change(draftRef.current);
    draftRef.current = next;
    setStored(next);
  }, []);
  const getCurrent = useCallback(() => aliveRef.current ? draftRef.current : null, []);
  return { draft: stored.documentEpoch === documentEpoch ? stored : initial, getCurrent, update };
}

export function usePoiSpreadsheet(options: PoiSpreadsheetOptions) {
  const { draft, getCurrent, update } = useSpreadsheetDraft(options.documentEpoch);
  const lookup = usePoiAddressLookup({ documentEpoch: options.documentEpoch, provider: options.searchProvider, update });
  const setError = useStableEvent((message: string) => update((current) => ({
    ...current, errors: { ...current.errors, [current.mode]: message },
  })));
  const changeMode = useStableEvent((mode: PoiSpreadsheetMode) => {
    if (getCurrent()?.mode !== mode) trackEditorAction('poiListModeSelected');
    lookup.stop();
    update((current) => ({ ...current, mode }));
  });
  const changeText = useStableEvent((text: string) => {
    const current = getCurrent();
    if (current && current.buffers[current.mode] !== text) trackEditorAction('poiListEdited', {}, { debounce: true });
    lookup.stop();
    update((current) => ({
      ...current, buffers: { ...current.buffers, [current.mode]: text },
      errors: { ...current.errors, [current.mode]: null }, announcement: null,
      ...(current.mode === 'addresses' && { rows: [], addressView: 'edit', page: 0 }),
    }));
  });
  const findAddresses = useStableEvent(() => {
    const current = getCurrent();
    if (!current || current.documentEpoch !== options.documentEpoch) return;
    try {
      const rows = createPoiAddressReview(parsePoiAddressSpreadsheet(current.buffers.addresses));
      update((value) => ({ ...value, rows, page: 0 }));
      void lookup.start(rows);
    } catch (error) {
      trackEditorAction('poiListValidationFailed');
      setError(error instanceof Error ? error.message : 'The POI list could not be read.');
    }
  });
  const changeRow = useStableEvent((id: number, patch: Partial<Pick<PoiAddressReviewRow, 'name' | 'address' | 'included' | 'selected'>>) => {
    trackEditorAction('poiListRowEdited', {}, { debounce: true });
    lookup.stop();
    update((current) => ({
      ...current, errors: { ...current.errors, addresses: null },
      rows: current.rows.map((row) => row.id === id ? {
        ...row, ...patch,
        ...(patch.address !== undefined && patch.address !== row.address && { status: 'changed', candidates: [], selected: null, error: null }),
      } : row),
    }));
  });
  const retry = useStableEvent((id?: number) => {
    const current = getCurrent();
    if (!current) return;
    const rows = current.rows.filter((row) => id === undefined
      ? row.included && row.status !== 'found' : row.id === id);
    if (rows.length > 0) void lookup.start(rows);
  });
  const backToEdit = useStableEvent(() => {
    trackEditorAction('poiListReviewClosed');
    lookup.stop();
    update((current) => ({ ...current, addressView: 'edit' }));
  });
  const returnToReview = useStableEvent(() => {
    trackEditorAction('poiListReviewOpened');
    update((current) => ({ ...current, addressView: 'review' }));
  });
  const discard = useStableEvent(() => {
    trackEditorAction('poiListDiscarded');
    lookup.retire();
    update(() => createPoiSpreadsheetDraft(options.documentEpoch));
  });
  const commit = useStableEvent((): ProjectMutationResult => {
    const current = getCurrent();
    if (!current || current.documentEpoch !== options.documentEpoch) return mutationRejected('This POI list belongs to a different session.', 'stale');
    if (current.lookup) return mutationRejected('Stop lookup or wait for it to finish before adding POIs.');
    if (current.mode === 'addresses' && current.addressView !== 'review') return mutationRejected('Return to address review before adding POIs.');
    trackEditorAction('poiListCommitStarted');
    let entries: PoiSpreadsheetEntry[];
    try {
      entries = current.mode === 'coordinates' ? parsePoiSpreadsheet(current.buffers.coordinates) : poiAddressEntries(current.rows);
    } catch (error) {
      trackEditorAction('poiListCommitFailed');
      const message = error instanceof Error ? error.message : 'Check the POI list before adding it.';
      setError(message);
      return mutationRejected(message);
    }
    const result = options.onSubmit(entries);
    if (!result.ok) { trackEditorAction('poiListCommitFailed'); setError(result.error); return result; }
    trackEditorAction('poiListCommitCompleted');
    const otherMode = current.mode === 'coordinates' ? 'addresses' : 'coordinates';
    update((value) => ({
      ...value, mode: otherMode, buffers: { ...value.buffers, [current.mode]: '' },
      errors: { ...value.errors, [current.mode]: null },
      ...(current.mode === 'addresses' && { rows: [], addressView: 'edit', page: 0 }),
      announcement: { scope: 'all', message: `Added ${entries.length} ${entries.length === 1 ? 'POI' : 'POIs'}. Your other list is still unadded.` },
    }));
    if (!current.buffers[otherMode].trim()) options.onComplete();
    return result;
  });
  const setPage = useStableEvent((page: number) => update((current) => ({ ...current, page })));
  return {
    draft, hasWork: hasPoiSpreadsheetWork(draft), commitError: poiAddressCommitError(draft.rows),
    getCurrent, changeMode, changeText, findAddresses, changeRow, retry, backToEdit,
    returnToReview, discard, commit, setPage, stopLookup: lookup.stop, retireLookup: lookup.retire,
  };
}
