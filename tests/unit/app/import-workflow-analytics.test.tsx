import { act, renderHook, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';
import { useMapDataImport } from '../../../src/app/hooks/useMapDataImport';
import { createNewProjectDocument } from '../../../src/domain/project';
import type { ProjectMutationResult } from '../../../src/domain/projectMutation';
import { deferred, recordWorkflowAnalytics } from '../workflowAnalyticsTestUtils';

const { events } = recordWorkflowAnalytics();
const contents = JSON.stringify({
  type: 'Feature', properties: { name: 'Secret cafe' },
  geometry: { type: 'Point', coordinates: [16.12345, 48.54321] },
});

function mapFile(text: string | Promise<string> = contents, name = 'private.geojson') {
  const file = new File([], name);
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(text) });
  return file;
}

function harness(onImport = vi.fn<() => ProjectMutationResult>(() => ({ ok: true }))) {
  const document = createNewProjectDocument();
  const hook = renderHook(({ epoch }) => {
    const [isOpen, onOpenChange] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    return useMapDataImport({
      documentEpoch: epoch,
      getSource: () => ({ documentEpoch: epoch, sourceDocument: document }),
      onImport, onOpenChange, isOpen, triggerRef,
      startImportWork: () => 1, finishImportWork: vi.fn(),
    });
  }, { initialProps: { epoch: 0 } });
  return { ...hook, onImport };
}

it('reports an import completion only after review commits and never includes file or layer details', async () => {
  const hook = harness();
  expect(events()).toEqual([]);
  act(() => hook.result.current.prepareFiles([mapFile()], null, 'file'));
  await waitFor(() => expect(hook.result.current.batch).not.toBeNull());
  expect(events()).toEqual([{ action: 'importStarted', format: 'geojson', source: 'file' }]);
  act(() => hook.result.current.commitReviewedImport());
  expect(events()).toEqual([
    { action: 'importStarted', format: 'geojson', source: 'file' },
    { action: 'importCompleted', format: 'geojson', source: 'file' },
  ]);
  act(() => hook.result.current.closeDialog());
  hook.unmount();
  expect(events()).toHaveLength(2);
  expect(JSON.stringify(events())).not.toMatch(/private|Secret|16\.12345|48\.54321/);
});

it('distinguishes failed parsing, canceled review, and a stale read without duplicate outcomes', async () => {
  const hook = harness();
  act(() => hook.result.current.prepareFiles([mapFile('not json')]));
  await waitFor(() => expect(hook.result.current.dialogError).toBeTruthy());
  act(() => hook.result.current.closeDialog());
  expect(events().map(({ action }) => action)).toEqual(['importStarted', 'importFailed']);
  const pending = deferred<string>();
  act(() => hook.result.current.prepareFiles([mapFile(pending.promise), mapFile(pending.promise, 'private.gpx')]));
  act(() => hook.result.current.closeDialog());
  await act(async () => pending.resolve(contents));
  expect(events().slice(2)).toEqual([
    { action: 'importStarted', format: 'mixed', source: 'drop' },
    { action: 'importCancelled', format: 'mixed', source: 'drop' },
  ]);
  act(() => hook.result.current.prepareFiles([mapFile()]));
  await waitFor(() => expect(hook.result.current.batch).not.toBeNull());
  hook.rerender({ epoch: 1 });
  expect(events().at(-1)?.action).toBe('importCancelled');
  expect(hook.onImport).not.toHaveBeenCalled();
});

it('tracks a rejected commit and its successful retry as separate attempts', async () => {
  const onImport = vi.fn<() => ProjectMutationResult>()
    .mockReturnValueOnce({ ok: false, error: 'Secret internal reason' })
    .mockReturnValueOnce({ ok: true });
  const hook = harness(onImport);
  act(() => hook.result.current.prepareFiles([mapFile()]));
  await waitFor(() => expect(hook.result.current.batch).not.toBeNull());
  act(() => hook.result.current.commitReviewedImport());
  act(() => hook.result.current.commitReviewedImport());
  expect(events().map(({ action }) => action)).toEqual([
    'importStarted', 'importFailed', 'importStarted', 'importCompleted',
  ]);
  expect(JSON.stringify(events())).not.toContain('Secret');
});
