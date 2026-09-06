import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createInitialProjectDocument, createNewProjectDocument } from '../../../src/domain/project';
import { useProjectOpening } from '../../../src/app/hooks/useProjectOpening';
import { ProjectStoreContext, useProject } from '../../../src/app/projectStoreContext';
import { createProjectStore } from '../../../src/app/store';

function openingHarness() {
  const store = createProjectStore(createInitialProjectDocument());
  const onOpened = vi.fn();
  function Wrapper({ children }: { children: ReactNode }) {
    return <ProjectStoreContext value={store}>{children}</ProjectStoreContext>;
  }
  const hook = renderHook(() => useProjectOpening(useProject((state) => state.documentEpoch), onOpened), { wrapper: Wrapper });
  return { store, onOpened, hook };
}

it('invalidates an outstanding replacement when the document epoch changes', () => {
  const { store, onOpened, hook } = openingHarness();
  act(() => hook.result.current.open({ ...createNewProjectDocument(), title: 'Pending choice' }));
  const staleConfirmation = hook.result.current.discardAndOpen;
  act(() => store.getState().openDocument({ ...createNewProjectDocument(), title: 'New document' }));
  const current = store.getState();
  expect(hook.result.current.pendingDocument).toBeNull();
  act(() => staleConfirmation());
  expect(store.getState()).toBe(current);
  expect(onOpened).not.toHaveBeenCalled();
});

it('gives each pending request a new identity and opens only the latest choice', () => {
  const { store, onOpened, hook } = openingHarness();
  const next = createNewProjectDocument();
  act(() => hook.result.current.open({ ...next, title: 'Earlier choice' }));
  const firstId = hook.result.current.pendingRequestId;
  act(() => hook.result.current.open({ ...next, title: 'Latest choice' }));
  expect(hook.result.current.pendingRequestId).not.toBe(firstId);
  expect(store.getState().document.title).toBe('Vienna field guide');
  act(() => hook.result.current.discardAndOpen());
  expect(store.getState().document.title).toBe('Latest choice');
  expect(store.getState().canUndo).toBe(false);
  expect(store.getState().canRedo).toBe(false);
  expect(onOpened).toHaveBeenCalledOnce();
  expect(hook.result.current.pendingDocument).toBeNull();
});

it('does not revive canceled or superseded confirmations when requesting a new project', () => {
  const { store, hook } = openingHarness();
  const before = store.getState();
  act(() => hook.result.current.open({ ...createNewProjectDocument(), title: 'Older file' }));
  const confirmOlder = hook.result.current.discardAndOpen;
  act(() => hook.result.current.open(createNewProjectDocument(), 'new'));
  expect(hook.result.current.pendingIntent).toBe('new');
  act(() => confirmOlder());
  expect(store.getState()).toBe(before);
  const confirmNew = hook.result.current.discardAndOpen;
  act(() => hook.result.current.keepEditing());
  act(() => confirmNew());
  expect(store.getState()).toBe(before);
});
