import { act, renderHook, waitFor } from '@testing-library/react';
import { createRef, useState } from 'react';
import { createProjectStore } from '../../../src/app/store';
import { useMapDataImport } from '../../../src/app/hooks/useMapDataImport';
import type { MapDataImportCommit } from '../../../src/app/hooks/useAppMapDataImport';
import { createInitialProjectDocument } from '../../../src/domain/project';

const route = JSON.stringify({
  type: 'Feature', properties: { name: 'Reviewed route' },
  geometry: { type: 'LineString', coordinates: [[139.7, 35.6], [139.8, 35.7]] },
});
function file(text: string | Promise<string> = route) {
  return { name: 'route.geojson', size: 100, text: () => Promise.resolve(text) } as File;
}
function setup() {
  const store = createProjectStore(createInitialProjectDocument());
  const onImport = vi.fn((commit: MapDataImportCommit) =>
    store.getState().importLayers(commit.layers, commit.documentEpoch, commit.sourceDocument));
  const finishImportWork = vi.fn();
  let work = 0;
  const triggerRef = createRef<HTMLButtonElement>();
  const hook = renderHook(({ epoch }) => {
    const [isOpen, onOpenChange] = useState(false);
    return useMapDataImport({
      documentEpoch: epoch,
      getSource: () => ({ documentEpoch: store.getState().documentEpoch, sourceDocument: store.getState().document }),
      isOpen, onOpenChange, onImport, triggerRef,
      finishImportWork, startImportWork: () => ++work,
    });
  }, { initialProps: { epoch: 0 } });
  return { ...hook, store, onImport, finishImportWork };
}

describe('map data review transaction', () => {
  it('requires review for one file and rejects direct invalid-style commit atomically', async () => {
    const { result, store, onImport } = setup();
    const before = store.getState();
    const subscriber = vi.fn();
    store.subscribe(subscriber);
    act(() => result.current.prepareFiles([file()]));
    await waitFor(() => expect(result.current.batch).not.toBeNull());
    expect(onImport).not.toHaveBeenCalled();
    expect(result.current.shouldFitView).toBe(true);
    const settings = result.current.batchAppearance!;
    act(() => result.current.setBatchAppearance({ ...settings, route: { ...settings.route, width: '' } }));
    let rejected;
    act(() => { rejected = result.current.commitReviewedImport(); });
    expect(rejected).toMatchObject({ ok: false, error: 'Route width is required. Enter 0 px or greater.' });
    expect(result.current.dialogError).toContain('Route width is required');
    expect(result.current.batchAppearance?.route.width).toBe('');
    expect(store.getState()).toBe(before);
    expect(subscriber).not.toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
    act(() => result.current.setBatchAppearance({ ...settings, route: { ...settings.route, width: '0' } }));
    act(() => { expect(result.current.commitReviewedImport()).toMatchObject({ ok: true }); });
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(store.getState().document.layers.find(({ name }) => name === 'Reviewed route')?.appearance).toMatchObject({ width: 0 });
    store.getState().undo();
    expect(store.getState().document).toEqual(before.document);
    expect(store.getState().canUndo).toBe(false);
  });

  it('keeps a stale active review with actionable feedback and unchanged state references', async () => {
    const { result, store } = setup();
    act(() => result.current.prepareFiles([file()]));
    await waitFor(() => expect(result.current.batch).not.toBeNull());
    store.getState().setProjectTitle('Changed during review');
    const before = store.getState();
    act(() => { expect(result.current.commitReviewedImport()).toMatchObject({ ok: false, code: 'stale' }); });
    expect(result.current.dialogError).toContain('Choose the data again');
    expect(result.current.batch).not.toBeNull();
    expect(store.getState()).toBe(before);
  });

  it('rejects retired commit callbacks without reopening or replacing the latest review', async () => {
    const { result, store, onImport } = setup();
    act(() => result.current.prepareFiles([file()]));
    await waitFor(() => expect(result.current.batch).not.toBeNull());
    const retiredCommit = result.current.commitReviewedImport;
    act(() => result.current.closeDialog());
    const before = store.getState();
    act(() => result.current.prepareFiles([file()]));
    await waitFor(() => expect(result.current.batch).not.toBeNull());
    const newBatch = result.current.batch;
    act(() => { expect(retiredCommit()).toMatchObject({ ok: false, code: 'stale' }); });
    expect(result.current.batch).toBe(newBatch);
    expect(result.current.dialogError).toBeNull();
    expect(store.getState()).toBe(before);
    expect(onImport).not.toHaveBeenCalled();
  });

  it.each(['cancel', 'epoch', 'unmount'] as const)('retires %s reads before parsing and releases their work once', async (reason) => {
    const { result, rerender, unmount, store, finishImportWork, onImport } = setup();
    let resolve!: (text: string) => void;
    act(() => result.current.prepareFiles([file(new Promise<string>((done) => { resolve = done; }))]));
    act(() => {
      if (reason === 'cancel') result.current.closeDialog();
      else if (reason === 'epoch') {
        store.getState().openDocument(createInitialProjectDocument());
        rerender({ epoch: store.getState().documentEpoch });
      }
      else unmount();
    });
    expect(finishImportWork).toHaveBeenCalledExactlyOnceWith(1);
    await act(async () => { resolve('INVALID RETIRED JSON'); });
    expect(finishImportWork).toHaveBeenCalledTimes(1);
    expect(onImport).not.toHaveBeenCalled();
    if (reason !== 'unmount') {
      expect(result.current.batch).toBeNull();
      expect(result.current.dialogError).toBeNull();
      expect(result.current.isReading).toBe(false);
    }
  });
});
