import { useEffect, useRef, useState } from 'react';
import type { StoreApi } from 'zustand';
import type { ProjectState } from '../app/store';
import {
  AutosaveCorruptionError,
  getAutosaveFailureMessage,
  type AutosaveDraft,
  type AutosaveRepository,
} from './autosave';

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
  const [corrupted, setCorrupted] = useState(false);
  const [decisionPending, setDecisionPending] = useState(false);
  const [status, setStatus] = useState(repository ? 'Checking for a local draft…' : 'Local draft');
  const [statusKind, setStatusKind] = useState<'status' | 'error'>('status');
  const mountedRef = useRef(true);
  const phaseRef = useRef<'loading' | 'recovery' | 'ready' | 'disabled'>(repository ? 'loading' : 'disabled');
  const saveTimerRef = useRef<number | null>(null);
  const saveRevisionRef = useRef(0);
  const saveQueueRef = useRef<Promise<void> | null>(null);
  const debouncedDocumentRef = useRef<ProjectState['document'] | null>(null);
  const pendingDocumentRef = useRef<ProjectState['document'] | null>(null);
  const scheduleSaveRef = useRef<((document: ProjectState['document']) => void) | null>(null);
  const decisionPendingRef = useRef(false);

  useEffect(() => {
    let active = true;
    mountedRef.current = true;
    if (!repository) return () => {
      active = false;
      mountedRef.current = false;
    };

    const scheduleSave = (document: ProjectState['document']) => {
      pendingDocumentRef.current = null;
      debouncedDocumentRef.current = document;
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      const revision = ++saveRevisionRef.current;
      setStatusKind('status');
      setStatus('Saving local draft…');
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        debouncedDocumentRef.current = null;
        saveQueueRef.current = (saveQueueRef.current ?? Promise.resolve())
          .catch(() => undefined)
          .then(() => (active ? repository.save(document) : undefined))
          .then(() => {
            if (active && revision === saveRevisionRef.current) {
              setStatusKind('status');
              setStatus('All changes saved locally');
            }
          }, (reason) => {
            if (active && revision === saveRevisionRef.current) {
              setStatusKind('error');
              setStatus(getAutosaveFailureMessage(reason));
            }
          });
      }, 300);
    };
    scheduleSaveRef.current = scheduleSave;

    const flushDebouncedSave = () => {
      const document = debouncedDocumentRef.current;
      if (saveTimerRef.current === null || !document) return;
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      debouncedDocumentRef.current = null;
      const revision = saveRevisionRef.current;
      const priorSave = saveQueueRef.current?.catch(() => undefined) ?? Promise.resolve();
      const immediateSave = repository.save(document).then(() => {
        if (active && revision === saveRevisionRef.current) {
          setStatusKind('status');
          setStatus('All changes saved locally');
        }
      }, (reason) => {
        if (active && revision === saveRevisionRef.current) {
          setStatusKind('error');
          setStatus(getAutosaveFailureMessage(reason));
        }
      });
      saveQueueRef.current = Promise.all([priorSave, immediateSave]).then(() => undefined);
    };
    window.addEventListener('pagehide', flushDebouncedSave);

    void repository.load().then((draft) => {
      if (!active) return;
      setRecoveryDraft(draft);
      phaseRef.current = draft ? 'recovery' : 'ready';
      setStatusKind('status');
      setStatus(draft ? 'Local draft found' : 'Autosave ready');
      if (!draft && pendingDocumentRef.current) scheduleSave(pendingDocumentRef.current);
    }, (reason) => {
      if (!active) return;
      const isCorrupted = reason instanceof AutosaveCorruptionError;
      phaseRef.current = isCorrupted ? 'recovery' : 'disabled';
      setCorrupted(isCorrupted);
      setStatusKind('error');
      setStatus(isCorrupted
        ? 'The local autosave is damaged or unsupported. Discard it before autosave can continue.'
        : getAutosaveFailureMessage(reason));
    });

    const unsubscribe = store.subscribe((state, previousState) => {
      if (state.document === previousState.document) return;
      if (phaseRef.current === 'loading' || phaseRef.current === 'recovery') {
        pendingDocumentRef.current = state.document;
        return;
      }
      if (phaseRef.current === 'ready') scheduleSave(state.document);
    });

    return () => {
      active = false;
      mountedRef.current = false;
      unsubscribe();
      scheduleSaveRef.current = null;
      window.removeEventListener('pagehide', flushDebouncedSave);
      flushDebouncedSave();
      repository.close();
    };
  }, [repository, store]);

  const recover = () => {
    if (!recoveryDraft || decisionPendingRef.current) return;
    store.getState().openDocument(recoveryDraft.document);
    pendingDocumentRef.current = null;
    phaseRef.current = 'ready';
    setRecoveryDraft(null);
    setCorrupted(false);
    setStatusKind('status');
    setStatus('Recovered local draft. Autosave ready.');
  };

  const discard = async () => {
    if (!repository || decisionPendingRef.current) return false;
    decisionPendingRef.current = true;
    setDecisionPending(true);
    try {
      await repository.discard();
    } catch (reason) {
      if (mountedRef.current) {
        setStatusKind('error');
        setStatus(getAutosaveFailureMessage(reason));
      }
      return false;
    } finally {
      decisionPendingRef.current = false;
      if (mountedRef.current) setDecisionPending(false);
    }
    if (!mountedRef.current) return false;
    const pendingDocument = pendingDocumentRef.current;
    phaseRef.current = 'ready';
    setRecoveryDraft(null);
    setCorrupted(false);
    setStatusKind('status');
    setStatus('Autosave ready');
    if (pendingDocument) scheduleSaveRef.current?.(pendingDocument);
    return true;
  };

  return { recoveryDraft, corrupted, decisionPending, status, statusKind, recover, discard };
}
