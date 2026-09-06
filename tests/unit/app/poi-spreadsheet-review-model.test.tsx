import { act, renderHook, waitFor } from '@testing-library/react';
import { createProjectStore } from '../../../src/app/store';
import { createInitialProjectDocument } from '../../../src/domain/project';
import { usePoiSpreadsheet } from '../../../src/app/hooks/usePoiSpreadsheet';
import type { SearchProvider, SearchResponse } from '../../../src/services/mapbox/contracts';
import type { PoiSpreadsheetEntry } from '../../../src/domain/poiSpreadsheet';

const candidate = (label: string) => ({ label, providerFeatureId: `address.${label}`, center: [16.3, 48.2] as const });
const response = (labels: string[]): SearchResponse => ({
  results: labels.map((label) => candidate(label)), useBoundary: 'provider-response-use-requires-terms-review',
});
function setup(search = vi.fn<SearchProvider['search']>().mockResolvedValue(response(['Vienna, Austria']))) {
  const store = createProjectStore(createInitialProjectDocument());
  const onComplete = vi.fn();
  const onSubmit = vi.fn((entries: readonly PoiSpreadsheetEntry[]) => store.getState().createPoiBatch(entries, store.getState().documentEpoch));
  const hook = renderHook(({ epoch }) => usePoiSpreadsheet({ documentEpoch: epoch, onSubmit, onComplete, searchProvider: { search } }), { initialProps: { epoch: 0 } });
  return { ...hook, store, onComplete, onSubmit, search };
}
async function lookup(hook: ReturnType<typeof setup>, text = 'Our café\tVienna') {
  act(() => { hook.result.current.changeMode('addresses'); hook.result.current.changeText(text); hook.result.current.findAddresses(); });
  await waitFor(() => expect(hook.result.current.draft.lookup).toBeNull());
}

describe('owned POI spreadsheet review', () => {
  it('never adds on lookup completion and commits selected matches with one Undo', async () => {
    const hook = setup(vi.fn<SearchProvider['search']>().mockResolvedValue(response(['Vienna, Austria', 'Vienna, Virginia'])));
    const before = hook.store.getState();
    await lookup(hook);
    expect(hook.store.getState()).toBe(before);
    expect(hook.onSubmit).not.toHaveBeenCalled();
    expect(hook.result.current.commitError).toContain('choose a matched location');
    act(() => hook.result.current.changeRow(0, { selected: 1 }));
    act(() => { expect(hook.result.current.commit()).toMatchObject({ ok: true }); });
    expect(hook.onSubmit).toHaveBeenCalledTimes(1);
    expect(hook.store.getState().document.layers.find(({ name }) => name === 'Our café')?.provenance).toMatchObject({ providerFeatureId: 'address.Vienna, Virginia' });
    hook.store.getState().undo();
    expect(hook.store.getState().document).toEqual(before.document);
    expect(hook.store.getState().canUndo).toBe(false);
  });

  it('keeps both exact buffers, row corrections, matches and exclusions across modes and back navigation', async () => {
    const hook = setup();
    const coordinates = '  Coordinates\t16.3\t48.2\r\n';
    const addresses = 'Name\tAddress\r\nOur café\tVienna\r\n';
    act(() => hook.result.current.changeText(coordinates));
    await lookup(hook, addresses);
    act(() => hook.result.current.changeRow(0, { name: 'Desired name', included: false }));
    act(() => hook.result.current.changeRow(0, { address: 'Corrected address' }));
    expect(hook.result.current.draft.rows[0].candidates).toEqual([]);
    act(() => hook.result.current.retry(0));
    await waitFor(() => expect(hook.result.current.draft.lookup).toBeNull());
    const reviewed = hook.result.current.draft.rows;
    act(() => hook.result.current.backToEdit());
    expect(hook.result.current.draft.buffers.addresses).toBe(addresses);
    act(() => hook.result.current.changeMode('coordinates'));
    expect(hook.result.current.draft.buffers.coordinates).toBe(coordinates);
    act(() => { hook.result.current.changeMode('addresses'); hook.result.current.returnToReview(); });
    expect(hook.result.current.draft.rows).toBe(reviewed);
    expect(hook.result.current.draft.rows[0]).toMatchObject({ name: 'Desired name', address: 'Corrected address', included: false });
    expect(hook.search).toHaveBeenCalledTimes(2);
    act(() => { hook.result.current.backToEdit(); hook.result.current.changeText(`${addresses}Changed\tElsewhere`); });
    expect(hook.result.current.draft.rows).toEqual([]);
    expect(hook.search).toHaveBeenCalledTimes(2);
  });

  it('preserves the other mode after successful coordinate addition instead of closing over it', async () => {
    const hook = setup();
    await lookup(hook);
    const reviewed = hook.result.current.draft.rows;
    act(() => { hook.result.current.changeMode('coordinates'); hook.result.current.changeText('Coordinate\t16.4\t48.2'); });
    act(() => { expect(hook.result.current.commit()).toMatchObject({ ok: true }); });
    expect(hook.onComplete).not.toHaveBeenCalled();
    expect(hook.result.current.draft.mode).toBe('addresses');
    expect(hook.result.current.draft.rows).toBe(reviewed);
    expect(hook.result.current.draft.buffers.coordinates).toBe('');
  });

  it('retries only unfinished included rows and keeps successful suggestions', async () => {
    const search = vi.fn<SearchProvider['search']>()
      .mockResolvedValueOnce(response(['Found']))
      .mockRejectedValueOnce(new Error('Unavailable'))
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response(['Retry succeeded']));
    const hook = setup(search);
    await lookup(hook, 'First\tA\nSecond\tB\nThird\tC');
    expect(hook.result.current.draft.rows.map(({ status }) => status)).toEqual(['found', 'error', 'missing']);
    const successful = hook.result.current.draft.rows[0].candidates;
    act(() => hook.result.current.changeRow(2, { included: false }));
    act(() => hook.result.current.retry());
    await waitFor(() => expect(hook.result.current.draft.lookup).toBeNull());
    expect(search).toHaveBeenCalledTimes(4);
    expect(search.mock.calls[3][0].query).toBe('B');
    expect(hook.result.current.draft.rows[0].candidates).toBe(successful);
  });

  it.each(['layer', 'position', 'byte'])('retains work and actual %s capacity feedback on rejected admission', async (kind) => {
    const hook = setup();
    await lookup(hook);
    const before = hook.store.getState();
    const rows = hook.result.current.draft.rows;
    const buffers = hook.result.current.draft.buffers;
    hook.onSubmit.mockReturnValueOnce({ ok: false, code: 'capacity', error: `${kind} capacity exceeded` });
    act(() => { expect(hook.result.current.commit()).toMatchObject({ ok: false, error: `${kind} capacity exceeded` }); });
    expect(hook.result.current.draft.rows).toBe(rows);
    expect(hook.result.current.draft.buffers).toBe(buffers);
    expect(hook.result.current.draft.errors.addresses).toBe(`${kind} capacity exceeded`);
    expect(hook.store.getState()).toBe(before);
    expect(hook.onComplete).not.toHaveBeenCalled();
  });

  it('retires a pending request on mode switch without letting it overwrite a newer retry', async () => {
    let finishOld!: (value: SearchResponse) => void;
    const search = vi.fn<SearchProvider['search']>()
      .mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }))
      .mockResolvedValueOnce(response(['Current match']));
    const hook = setup(search);
    act(() => { hook.result.current.changeMode('addresses'); hook.result.current.changeText('Name\tAddress\nName\tOld'); hook.result.current.findAddresses(); });
    const signal = search.mock.calls[0][0].signal;
    act(() => hook.result.current.changeMode('coordinates'));
    expect(signal?.aborted).toBe(true);
    expect(hook.result.current.draft.rows[0].status).toBe('stopped');
    act(() => { hook.result.current.changeMode('addresses'); hook.result.current.retry(); });
    await waitFor(() => expect(hook.result.current.draft.lookup).toBeNull());
    const current = hook.result.current.draft;
    await act(async () => finishOld(response(['Obsolete match'])));
    expect(hook.result.current.draft).toBe(current);
    expect(current.rows[0].candidates[0].label).toBe('Current match');
    expect(hook.onSubmit).not.toHaveBeenCalled();
  });

  it.each(['epoch', 'unmount'] as const)('prevents late requests from surviving %s retirement', async (kind) => {
    let finish!: (value: SearchResponse) => void;
    const search = vi.fn<SearchProvider['search']>(() => new Promise((resolve) => { finish = resolve; }));
    const hook = setup(search);
    act(() => { hook.result.current.changeMode('addresses'); hook.result.current.changeText('Name\tOld address'); hook.result.current.findAddresses(); });
    const signal = search.mock.calls[0][0].signal;
    if (kind === 'epoch') hook.rerender({ epoch: 1 });
    else hook.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => finish(response(['Old match'])));
    expect(hook.onSubmit).not.toHaveBeenCalled();
    if (kind === 'epoch') {
      expect(hook.result.current.draft.buffers).toEqual({ coordinates: '', addresses: '' });
      expect(hook.result.current.draft.rows).toEqual([]);
    }
  });
});
