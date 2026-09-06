import { useCallback, useMemo, useRef, useState, type RefObject } from 'react';
import type { StoreApi } from 'zustand';
import type { ProjectState } from '../app/store';
import { useBeforeUnloadWarning } from '../app/hooks/useBeforeUnloadWarning';
import { AutosaveCorruptionError, type AutosaveRepository } from './autosave';

type Options = {
  active: boolean;
  store: StoreApi<ProjectState>;
  repository: AutosaveRepository | null;
  mountedRef: RefObject<boolean>;
  decisionPendingRef: RefObject<boolean>;
  onLoaded: () => void;
};

export type AutosaveConflictRecoveryState = {
  conflictOpen: boolean;
  conflictPending: boolean;
  conflictError: string | null;
  reviewConflict: () => void;
  keepEditingConflict: () => void;
  loadSavedVersion: () => Promise<boolean>;
};

function hasSameWork(current: ProjectState, source: ProjectState) {
  return current.document === source.document && current.documentEpoch === source.documentEpoch
    && current.hasUnfinishedDrawing === source.hasUnfinishedDrawing;
}

function conflictReadError(error: unknown) {
  if (error instanceof AutosaveCorruptionError) {
    return 'The other saved version is damaged or unsupported. This tab has been kept; you can still download it.';
  }
  return error instanceof Error ? error.message : 'The saved version could not be read. This tab has been kept.';
}

export function useAutosaveConflictRecovery({
  active, store, repository, mountedRef, decisionPendingRef, onLoaded,
}: Options): AutosaveConflictRecoveryState {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  useBeforeUnloadWarning(active);
  const reviewConflict = useCallback(() => {
    if (!active) return;
    setError(null);
    setOpen(true);
  }, [active]);
  const keepEditingConflict = useCallback(() => {
    requestId.current += 1;
    setOpen(false);
  }, []);
  const loadSavedVersion = useCallback(async () => {
    if (!active || !open || !repository || decisionPendingRef.current) return false;
    decisionPendingRef.current = true;
    const request = ++requestId.current;
    const source = store.getState();
    const isCurrent = () => mountedRef.current && requestId.current === request;
    setPending(true);
    setError(null);
    try {
      // The conflicted persistence session is permanently stopped before this
      // explicit read adopts another record identity. No old save can resume.
      const draft = await repository.load();
      if (!isCurrent()) return false;
      if (!draft) throw new Error('There is no saved project to load. This tab has been kept.');
      const current = store.getState();
      if (!hasSameWork(current, source)) {
        throw new Error('This tab changed while the saved version was loading. Nothing was replaced. Review your work and try again.');
      }
      current.openDocument(draft.document);
      if (store.getState().documentEpoch !== source.documentEpoch + 1) {
        throw new Error('The saved version could not be opened. This tab has been kept.');
      }
      setOpen(false);
      onLoaded();
      return true;
    } catch (error_) {
      if (isCurrent()) {
        setError(conflictReadError(error_));
      }
      return false;
    } finally {
      decisionPendingRef.current = false;
      if (mountedRef.current) setPending(false);
    }
  }, [active, decisionPendingRef, mountedRef, onLoaded, open, repository, store]);
  return useMemo(() => ({
    conflictOpen: active && open, conflictPending: pending, conflictError: error, reviewConflict, keepEditingConflict, loadSavedVersion,
  }), [active, open, pending, error, reviewConflict, keepEditingConflict, loadSavedVersion]);
}
