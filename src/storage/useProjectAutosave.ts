import { useEffect, useMemo, useRef, useState } from 'react';
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
    let active = true;
    let closing = false;
    let closed = false;
    let saveTimer: number | null = null;
    let saveRevision = 0;
    let saveInFlight = false;
    let debouncedDocument: ProjectState['document'] | null = null;
    let pendingSaveIntent: {
      document: ProjectState['document'];
      revision: number;
      lifecycle: boolean;
    } | null = null;
    mountedRef.current = true;
    phaseRef.current = repository ? 'loading' : 'disabled';
    decisionPendingRef.current = false;
    if (!repository) return () => {
      active = false;
      mountedRef.current = false;
    };

    const closeIfIdle = () => {
      if (closing && !closed && !saveInFlight && pendingSaveIntent === null) {
        closed = true;
        repository.close();
      }
    };

    const startNextSave = () => {
      if (saveInFlight) return;
      const intent = pendingSaveIntent;
      if (!intent || (!active && !intent.lifecycle)) return;
      pendingSaveIntent = null;
      saveInFlight = true;
      let saving: Promise<void>;
      try {
        saving = repository.save(intent.document);
      } catch (reason) {
        saving = Promise.reject(reason);
      }
      void saving.then(() => {
        if (active && intent.revision === saveRevision) {
          setStatusKind('status');
          setStatus('All changes saved locally');
        }
      }, (reason) => {
        if (active && intent.revision === saveRevision) {
          setStatusKind('error');
          setStatus(getAutosaveFailureMessage(reason));
        }
      }).then(() => {
        saveInFlight = false;
        if (active || pendingSaveIntent?.lifecycle) startNextSave();
        else pendingSaveIntent = null;
        closeIfIdle();
      });
    };

    const queueSave = (
      document: ProjectState['document'],
      revision: number,
      lifecycle = false,
    ) => {
      pendingSaveIntent = { document, revision, lifecycle };
      startNextSave();
    };

    const scheduleSave = (document: ProjectState['document']) => {
      pendingDocumentRef.current = null;
      debouncedDocument = document;
      if (saveTimer !== null) window.clearTimeout(saveTimer);
      const revision = ++saveRevision;
      setStatusKind('status');
      setStatus('Saving local draft…');
      saveTimer = window.setTimeout(() => {
        saveTimer = null;
        debouncedDocument = null;
        queueSave(document, revision);
      }, 300);
    };
    scheduleSaveRef.current = scheduleSave;

    const flushDebouncedSave = (promotePending: boolean) => {
      if (saveTimer !== null && debouncedDocument) {
        const document = debouncedDocument;
        window.clearTimeout(saveTimer);
        saveTimer = null;
        debouncedDocument = null;
        queueSave(document, saveRevision, true);
        return;
      }
      if (promotePending && pendingSaveIntent) {
        pendingSaveIntent = { ...pendingSaveIntent, lifecycle: true };
        startNextSave();
      }
    };
    const handlePagehide = () => flushDebouncedSave(true);
    window.addEventListener('pagehide', handlePagehide);

    void repository.load().then((draft) => {
      if (!active) return;
      setRecoveryGeneration(generation);
      setRecoveryDraft(draft);
      setCorrupted(false);
      phaseRef.current = draft ? 'recovery' : 'ready';
      setStatusKind('status');
      setStatus(draft ? 'Local draft found' : 'Autosave ready');
      if (!draft && pendingDocumentRef.current) scheduleSave(pendingDocumentRef.current);
    }, (reason) => {
      if (!active) return;
      const isCorrupted = reason instanceof AutosaveCorruptionError;
      setRecoveryGeneration(generation);
      setRecoveryDraft(null);
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
      closing = true;
      mountedRef.current = false;
      unsubscribe();
      scheduleSaveRef.current = null;
      window.removeEventListener('pagehide', handlePagehide);
      const handoffDocument = debouncedDocument ?? pendingSaveIntent?.document;
      if (handoffDocument) pendingDocumentRef.current = handoffDocument;
      flushDebouncedSave(false);
      closeIfIdle();
    };
  }, [effectGeneration, repository, store]);

  const recover = () => {
    if (
      recoveryGeneration !== effectGeneration
      || !recoveryDraft
      || decisionPendingRef.current
    ) return;
    store.getState().openDocument(recoveryDraft.document);
    pendingDocumentRef.current = null;
    phaseRef.current = 'ready';
    setRecoveryDraft(null);
    setCorrupted(false);
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
    } catch (reason) {
      if (mountedRef.current && generation === effectGenerationRef.current) {
        setStatusKind('error');
        setStatus(getAutosaveFailureMessage(reason));
      }
      return false;
    } finally {
      finishDecision(generation);
    }
    if (!mountedRef.current || generation !== effectGenerationRef.current) return false;
    const pendingDocument = pendingDocumentRef.current;
    phaseRef.current = 'ready';
    setRecoveryDraft(null);
    setCorrupted(false);
    setStatusKind('status');
    setStatus('Autosave ready');
    if (pendingDocument) scheduleSaveRef.current?.(pendingDocument);
    return true;
  };

  const decisionPending = repository !== null && pendingGeneration === effectGeneration;
  const recoveryIsCurrent = recoveryGeneration === effectGeneration;
  return {
    recoveryDraft: recoveryIsCurrent ? recoveryDraft : null,
    corrupted: recoveryIsCurrent && corrupted,
    decisionPending,
    status: recoveryIsCurrent
      ? status
      : (repository ? 'Checking for a local draft…' : 'Local draft'),
    statusKind: recoveryIsCurrent ? statusKind : 'status',
    recover,
    discard,
  };
}
