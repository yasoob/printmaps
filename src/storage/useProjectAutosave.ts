import { useEffect, useMemo, useRef, useState } from 'react';
import type { StoreApi } from 'zustand';
import type { ProjectState } from '../app/store';
import { getAutosaveFailureMessage, type AutosaveDraft, type AutosaveRepository } from './autosave';
import { AutosavePersistenceSession, autosaveLoadFailureMessage } from './AutosavePersistenceSession';

export type ProjectAutosaveState = {
  recoveryDraft: AutosaveDraft | null;
  corrupted: boolean;
  decisionPending: boolean;
  status: string;
  statusKind: 'status' | 'error';
  recover: () => void;
  discard: () => Promise<boolean>;
};

export function useProjectAutosave(
  store: StoreApi<ProjectState>,
  repository: AutosaveRepository | null,
): ProjectAutosaveState {
  const [recoveryDraft, setRecoveryDraft] = useState<AutosaveDraft | null>(null);
  const [isCorrupted, setIsCorrupted] = useState(false);
  const [recoveryGeneration, setRecoveryGeneration] = useState<object | null>(null);
  const [pendingGeneration, setPendingGeneration] = useState<object | null>(null);
  const [status, setStatus] = useState(repository ? 'Checking for a local draft…' : 'Local draft');
  const [statusKind, setStatusKind] = useState<'status' | 'error'>('status');
  const mountedRef = useRef(true);
  const phaseRef = useRef<'loading' | 'recovery' | 'ready' | 'disabled'>(repository ? 'loading' : 'disabled');
  const effectGeneration = useMemo(() => ({ repository, store }), [repository, store]);
  const effectGenerationRef = useRef<object | null>(null);
  const pendingDocumentRef = useRef<ProjectState['document'] | null>(null);
  const scheduleSaveRef = useRef<((document: ProjectState['document']) => void) | null>(null);
  const decisionPendingRef = useRef(false);

  useEffect(() => {
    const generation = effectGeneration;
    effectGenerationRef.current = generation;
    mountedRef.current = true;
    phaseRef.current = repository ? 'loading' : 'disabled';
    decisionPendingRef.current = false;
    if (!repository) return () => { mountedRef.current = false; };

    const session = new AutosavePersistenceSession({
      repository,
      store,
      generation,
      phaseRef,
      mountedRef,
      pendingDocumentRef,
      scheduleSaveRef,
      decisionPendingRef,
      onLoaded: (loadedGeneration, draft) => {
        setRecoveryGeneration(loadedGeneration);
        setRecoveryDraft(draft);
        setIsCorrupted(false);
        setStatusKind('status');
        setStatus(draft ? 'Local draft found' : 'Autosave ready');
      },
      onLoadFailed: (loadedGeneration, error, hasCorruption) => {
        setRecoveryGeneration(loadedGeneration);
        setRecoveryDraft(null);
        setIsCorrupted(hasCorruption);
        setStatusKind('error');
        setStatus(autosaveLoadFailureMessage(error, hasCorruption));
      },
      onSaveStarted: () => { setStatusKind('status'); setStatus('Saving local draft…'); },
      onSaveSucceeded: () => { setStatusKind('status'); setStatus('All changes saved locally'); },
      onSaveFailed: (error) => { setStatusKind('error'); setStatus(getAutosaveFailureMessage(error)); },
    });
    return session.start();
  }, [effectGeneration, repository, store]);

  const recover = () => {
    if (recoveryGeneration !== effectGeneration || !recoveryDraft || decisionPendingRef.current) return;
    store.getState().openDocument(recoveryDraft.document);
    pendingDocumentRef.current = null;
    phaseRef.current = 'ready';
    setRecoveryDraft(null);
    setIsCorrupted(false);
    setStatusKind('status');
    setStatus('Recovered local draft. Autosave ready.');
  };

  const finishDecision = (generation: object) => {
    if (generation === effectGenerationRef.current) decisionPendingRef.current = false;
    setPendingGeneration((current) => current === generation ? null : current);
  };

  const discard = async () => {
    if (!repository || decisionPendingRef.current) return false;
    const generation = effectGeneration;
    decisionPendingRef.current = true;
    setPendingGeneration(generation);
    try {
      await repository.discard();
    } catch (error) {
      if (mountedRef.current && generation === effectGenerationRef.current) {
        setStatusKind('error');
        setStatus(getAutosaveFailureMessage(error));
      }
      return false;
    } finally {
      finishDecision(generation);
    }
    if (!mountedRef.current || generation !== effectGenerationRef.current) return false;
    const pendingDocument = pendingDocumentRef.current;
    phaseRef.current = 'ready';
    setRecoveryDraft(null);
    setIsCorrupted(false);
    setStatusKind('status');
    setStatus('Autosave ready');
    if (pendingDocument) scheduleSaveRef.current?.(pendingDocument);
    return true;
  };

  const isDecisionPending = repository !== null && pendingGeneration === effectGeneration;
  const isRecoveryCurrent = recoveryGeneration === effectGeneration;
  return {
    recoveryDraft: isRecoveryCurrent ? recoveryDraft : null,
    corrupted: isRecoveryCurrent && isCorrupted,
    decisionPending: isDecisionPending,
    status: isRecoveryCurrent ? status : (repository ? 'Checking for a local draft…' : 'Local draft'),
    statusKind: isRecoveryCurrent ? statusKind : 'status',
    recover,
    discard,
  };
}
