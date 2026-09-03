import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StoreApi } from 'zustand';
import type { ProjectState } from '../app/store';
import {
  AutosaveCorruptionError,
  getAutosaveFailureMessage,
  type AutosaveRepository,
} from './autosave';
import { AutosavePersistenceSession } from './AutosavePersistenceSession';

export type ProjectAutosaveState = {
  corrupted: boolean;
  decisionPending: boolean;
  status: string;
  statusKind: 'status' | 'error';
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
  const [status, setStatus] = useState(() => {
    if (!repository) return 'Local draft';
    if (isInitialCorruption) {
      return 'The local autosave is damaged or unsupported. Discard it before autosave can continue.';
    }
    return loadError === null ? 'Autosave ready' : getAutosaveFailureMessage(loadError);
  });
  const [statusKind, setStatusKind] = useState<'status' | 'error'>(() => (
    repository && loadError !== null ? 'error' : 'status'
  ));
  const mountedRef = useRef(true);
  const persistenceRepositoryRef = useRef<AutosaveRepository | null>(null);

  useEffect(() => () => {
    if (repository && persistenceRepositoryRef.current !== repository) repository.close();
  }, [repository]);

  useEffect(() => {
    mountedRef.current = true;
    if (!repository || !enabled) return () => { mountedRef.current = false; };

    persistenceRepositoryRef.current = repository;
    const session = new AutosavePersistenceSession({
      repository,
      store,
      onSaveStarted: () => { setStatusKind('status'); setStatus('Saving local draft…'); },
      onSaveSucceeded: () => { setStatusKind('status'); setStatus('All changes saved locally'); },
      onSaveFailed: (error) => { setStatusKind('error'); setStatus(getAutosaveFailureMessage(error)); },
    });
    return session.start();
  }, [enabled, repository, store]);

  const discard = useCallback(async () => {
    if (!repository || !corrupted || decisionPending) return false;
    setDecisionPending(true);
    try {
      await repository.discard();
    } catch (error) {
      if (mountedRef.current) {
        setStatusKind('error');
        setStatus(getAutosaveFailureMessage(error));
      }
      return false;
    } finally {
      if (mountedRef.current) setDecisionPending(false);
    }
    if (!mountedRef.current) return false;
    setCorrupted(false);
    setEnabled(true);
    setStatusKind('status');
    setStatus('Autosave ready');
    return true;
  }, [corrupted, decisionPending, repository]);

  return useMemo(
    () => ({
      corrupted,
      decisionPending,
      status,
      statusKind,
      discard,
    }),
    [corrupted, decisionPending, discard, status, statusKind],
  );
}
