import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StoreApi } from 'zustand';
import type { ProjectState } from '../app/store';
import {
  AutosaveCorruptionError,
  getAutosaveFailureMessage,
  isAutosaveConflict,
  type AutosaveRepository,
} from './autosave';
import { AutosavePersistenceSession } from './AutosavePersistenceSession';
import { getRecoveryDiscardFailureMessage } from './autosaveRecovery';
import { useBeforeUnloadWarning } from '../app/hooks/useBeforeUnloadWarning';
import { useAutosaveConflictRecovery, type AutosaveConflictRecoveryState } from './useAutosaveConflictRecovery';

export type ProjectAutosaveState = AutosaveConflictRecoveryState & {
  corrupted: boolean;
  decisionPending: boolean;
  status: string;
  statusKind: 'status' | 'error' | 'disabled' | 'conflict';
  recoveryData: { record: unknown } | undefined;
  continueWithoutAutosave: () => boolean;
  discard: () => Promise<boolean>;
};

export function useProjectAutosave(
  store: StoreApi<ProjectState>,
  repository: AutosaveRepository | null,
  loadError: unknown | null,
): ProjectAutosaveState {
  const isInitialCorruption = loadError instanceof AutosaveCorruptionError;
  const [corrupted, setCorrupted] = useState(isInitialCorruption);
  const [enabled, setEnabled] = useState(repository !== null && loadError === null);
  const [decisionPending, setDecisionPending] = useState(false);
  const decisionPendingRef = useRef(false);
  const [status, setStatus] = useState(() => {
    if (!repository) return 'Local draft';
    if (isInitialCorruption) {
      return loadError.message;
    }
    return loadError === null ? 'Autosave ready' : getAutosaveFailureMessage(loadError);
  });
  const [statusKind, setStatusKind] = useState<ProjectAutosaveState['statusKind']>(() => (
    repository && loadError !== null ? 'error' : 'status'
  ));
  const mountedRef = useRef(true);
  const persistenceRepositoryRef = useRef<AutosaveRepository | null>(null);
  const [hasUnsavedOfflineChanges, setHasUnsavedOfflineChanges] = useState(false);
  const recoveryData = isInitialCorruption ? loadError.recoveryData : undefined;
  const savedVersionLoaded = useCallback(() => {
    setEnabled(true);
    setStatusKind('status');
    setStatus('Autosave ready');
  }, []);
  const conflict = useAutosaveConflictRecovery({
    active: statusKind === 'conflict', store, repository, mountedRef, decisionPendingRef, onLoaded: savedVersionLoaded,
  });
  useBeforeUnloadWarning(hasUnsavedOfflineChanges);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  useEffect(() => {
    if (statusKind !== 'disabled') return;
    return store.subscribe((state, previous) => {
      if (state.document !== previous.document) {
        setHasUnsavedOfflineChanges(true);
      }
    });
  }, [statusKind, store]);

  useEffect(() => () => {
    if (repository && persistenceRepositoryRef.current !== repository) repository.close();
  }, [repository]);

  useEffect(() => {
    if (!repository || !enabled) return;

    persistenceRepositoryRef.current = repository;
    const session = new AutosavePersistenceSession({
      repository,
      store,
      onSaveStarted: () => { setStatusKind('status'); setStatus('Saving local draft…'); },
      onSaveSucceeded: () => { setStatusKind('status'); setStatus('All changes saved locally'); },
      onSaveFailed: (error) => {
        if (isAutosaveConflict(error)) setEnabled(false);
        setStatusKind(isAutosaveConflict(error) ? 'conflict' : 'error');
        setStatus(getAutosaveFailureMessage(error));
      },
    });
    const stop = session.start();
    return () => {
      stop();
      persistenceRepositoryRef.current = null;
    };
  }, [enabled, repository, store]);

  const discard = useCallback(async () => {
    if (!repository || !corrupted || decisionPendingRef.current) return false;
    decisionPendingRef.current = true;
    setDecisionPending(true);
    try {
      await repository.discard();
    } catch (error) {
      if (mountedRef.current) {
        setStatusKind('error');
        setStatus(getRecoveryDiscardFailureMessage(error));
      }
      return false;
    } finally {
      decisionPendingRef.current = false;
      if (mountedRef.current) setDecisionPending(false);
    }
    if (!mountedRef.current) return false;
    setCorrupted(false);
    setEnabled(true);
    setStatusKind('status');
    setStatus('Autosave ready');
    return true;
  }, [corrupted, repository]);

  const continueWithoutAutosave = useCallback(() => {
    if (!corrupted || decisionPendingRef.current) return false;
    setCorrupted(false);
    setEnabled(false);
    setStatusKind('disabled');
    setStatus('Autosave is off. The damaged local draft is preserved. New work is not saved locally: use Project > Download project to keep it. Browsers may not warn before closing.');
    return true;
  }, [corrupted]);

  return useMemo(
    () => ({
      corrupted,
      decisionPending,
      status,
      statusKind,
      discard,
      recoveryData,
      continueWithoutAutosave,
      ...conflict,
    }),
    [corrupted, decisionPending, discard, status, statusKind, recoveryData, continueWithoutAutosave, conflict],
  );
}
