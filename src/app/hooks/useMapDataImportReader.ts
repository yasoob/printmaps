import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { ContentLayer } from '../../domain/project';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import { parseMapDataFiles, type ParsedMapDataBatch } from '../../import/mapDataBatch';
import { hasSameDocumentContent } from '../storeDocument';
import type { LayerReplacementRequest, MapDataImportCommit } from './useAppMapDataImport';
import { useStableEvent } from './useStableEvent';
import { createImportAnalytics } from './useMapDataImportAnalytics';

type ImportStatus = { documentEpoch: number; kind: 'success' | 'error'; message: string };
type ImportSource = Pick<MapDataImportCommit, 'documentEpoch' | 'sourceDocument'>;
type ReadOwner = {
  source: ImportSource;
  replacementTarget: ContentLayer | null;
  controller: AbortController;
  workId: number | null;
  batch: ParsedMapDataBatch | null;
  analytics: ReturnType<typeof createImportAnalytics>;
};
type FileChoice = { documentEpoch: number; target: ContentLayer | null };

export type MapDataImportOptions = {
  documentEpoch: number;
  getSource: () => ImportSource;
  inputRef?: RefObject<HTMLInputElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  finishImportWork: (workId: number) => void;
  startImportWork: () => number | null;
  isOpen: boolean;
  onImport: (commit: MapDataImportCommit) => ProjectMutationResult;
  onOpenChange: (isOpen: boolean) => void;
};

export function reviewedSuccess(batch: ParsedMapDataBatch, documentEpoch: number): ImportStatus {
  const noun = batch.layers.length === 1 ? 'layer' : 'layers';
  const summary = batch.files.length === 1
    ? `${batch.layers.length} ${batch.files[0].format} ${noun}`
    : `${batch.files.length} files as ${batch.layers.length} ${noun}`;
  return { documentEpoch, kind: 'success', message: `Imported ${summary}. Undo removes the whole import.` };
}

export function replacementSuccess(target: ContentLayer, documentEpoch: number): ImportStatus {
  return { documentEpoch, kind: 'success', message: `Replaced ${target.name} data. Undo restores the previous geometry.` };
}

function validateReplacementBatch(batch: ParsedMapDataBatch, target: ContentLayer) {
  if (batch.files.length !== 1 || batch.layers.length !== 1) {
    throw new Error(`Replace ${target.name} with one file containing exactly one ${target.type} feature. Nothing was changed.`);
  }
  if (batch.layers[0].type !== target.type) {
    throw new Error(`Replacement data for ${target.name} must be a ${target.type} feature. Nothing was changed.`);
  }
}

function focusTarget(): HTMLElement | null {
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== document.body && active !== document.documentElement ? active : null;
}

type BatchReaderCallbacks = {
  getSource: MapDataImportOptions['getSource'];
  finishRead: (owner: ReadOwner) => void;
  onProjectChange: (epoch: number) => void;
  onBatch: (batch: ParsedMapDataBatch) => void;
  onError: (message: string) => void;
  onSettled: () => void;
};

function useBatchReader(ownerRef: RefObject<ReadOwner | null>, callbacks: BatchReaderCallbacks) {
  return useStableEvent(async (owner: ReadOwner, files: readonly File[]) => {
    try {
      const { source, replacementTarget: target } = owner;
      const existingLayers = target
        ? source.sourceDocument.layers.filter(({ id }) => id !== target.id)
        : source.sourceDocument.layers;
      const parsed = await parseMapDataFiles(files, existingLayers, owner.controller.signal);
      if (ownerRef.current !== owner) return;
      const current = callbacks.getSource();
      if (current.documentEpoch !== source.documentEpoch) {
        callbacks.onProjectChange(current.documentEpoch);
        return;
      }
      if (!hasSameDocumentContent(source.sourceDocument, current.sourceDocument)) {
        throw new Error('The project changed while checking these files. Nothing was imported. Choose the files again.');
      }
      if (target) validateReplacementBatch(parsed, target);
      owner.batch = parsed;
      callbacks.onBatch(parsed);
    } catch (error) {
      if (ownerRef.current === owner) {
        owner.analytics.finish('importFailed');
        callbacks.onError(error instanceof Error ? error.message : 'These map data files could not be imported.');
      }
    } finally {
      callbacks.finishRead(owner);
      if (ownerRef.current === owner) callbacks.onSettled();
    }
  });
}

function useReadOwnership(finishImportWork: MapDataImportOptions['finishImportWork']) {
  const ownerRef = useRef<ReadOwner | null>(null);
  const finishRead = useStableEvent((owner: ReadOwner) => {
    const workId = owner.workId;
    if (workId === null) return;
    owner.workId = null;
    finishImportWork(workId);
  });
  const retireRead = useCallback(() => {
    const owner = ownerRef.current;
    ownerRef.current = null;
    if (owner) {
      owner.analytics.finish('importCancelled');
      owner.controller.abort();
      finishRead(owner);
    }
  }, [finishRead]);
  useLayoutEffect(() => retireRead, [retireRead]);
  return { ownerRef, finishRead, retireRead };
}

export function useMapDataImportReader(options: MapDataImportOptions) {
  const { documentEpoch, getSource, isOpen, onOpenChange, triggerRef } = options;
  const [isReading, setIsReading] = useState(false);
  const [status, setStatus] = useState<ImportStatus | null>(null);
  const [batch, setBatch] = useState<ParsedMapDataBatch | null>(null);
  const [replacementTarget, setReplacementTarget] = useState<ContentLayer | null>(null);
  const [selectedNames, setSelectedNames] = useState<readonly string[]>([]);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [shouldFitView, setShouldFitView] = useState(true);
  const localInputRef = useRef<HTMLInputElement>(null);
  const inputRef = options.inputRef ?? localInputRef;
  const { ownerRef, finishRead, retireRead } = useReadOwnership(options.finishImportWork);
  const choiceRef = useRef<FileChoice | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const shouldRestoreFocusRef = useRef(false);

  const closeDialog = useStableEvent((shouldRestoreFocus: boolean = true) => {
    shouldRestoreFocusRef.current = shouldRestoreFocus;
    retireRead();
    choiceRef.current = null;
    setIsReading(false);
    setBatch(null);
    setReplacementTarget(null);
    setSelectedNames([]);
    setDialogError(null);
    onOpenChange(false);
  });
  const finalFocus = useCallback(() => {
    if (!shouldRestoreFocusRef.current || ownerRef.current) return false;
    const target = returnFocusRef.current;
    return (target?.isConnected ? target : triggerRef.current) ?? false;
  }, [ownerRef, triggerRef]);
  const retireForProjectChange = useStableEvent((nextEpoch: number) => {
    closeDialog(false);
    setStatus({ documentEpoch: nextEpoch, kind: 'error', message: 'Import cancelled because a different project was opened. No imported layers were added. Choose the files again.' });
  });
  useLayoutEffect(() => {
    if (ownerRef.current && ownerRef.current.source.documentEpoch !== documentEpoch) {
      retireForProjectChange(documentEpoch);
    }
  }, [documentEpoch, ownerRef, retireForProjectChange]);

  const readFiles = useBatchReader(ownerRef, {
    getSource, finishRead, onProjectChange: retireForProjectChange,
    onBatch: setBatch, onError: setDialogError, onSettled: () => setIsReading(false),
  });
  const prepareFiles = useStableEvent((files: readonly File[], choice: FileChoice | null = null, importSource: 'file' | 'drop' = 'drop') => {
    const source = getSource();
    const analytics = createImportAnalytics(files, importSource);
    if (choice && choice.documentEpoch !== source.documentEpoch) {
      analytics.finish('importFailed');
      setStatus({ documentEpoch: source.documentEpoch, kind: 'error', message: 'The project changed while choosing files. Nothing was imported. Choose the files again.' });
      return;
    }
    retireRead();
    const workId = options.startImportWork();
    if (workId === null) {
      analytics.finish('importFailed');
      const message = 'Another import is still active. Finish or cancel it before choosing these files.';
      if (isOpen) setDialogError(message);
      else setStatus({ documentEpoch: source.documentEpoch, kind: 'error', message });
      return;
    }
    const target = choice?.target ?? null;
    const owner: ReadOwner = { source, replacementTarget: target, controller: new AbortController(), workId, batch: null, analytics };
    ownerRef.current = owner;
    choiceRef.current = { documentEpoch: source.documentEpoch, target };
    if (!isOpen) {
      if (!choice) returnFocusRef.current = focusTarget();
      setShouldFitView(true);
    }
    shouldRestoreFocusRef.current = false;
    setStatus(null);
    setBatch(null);
    setDialogError(null);
    setReplacementTarget(target);
    setSelectedNames(files.map(({ name }) => name));
    setIsReading(true);
    onOpenChange(true);
    void readFiles(owner, files);
  });
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = [...(input.files ?? [])];
    input.value = '';
    if (files.length > 0) prepareFiles(files, choiceRef.current, 'file');
  };
  const chooseImportFiles = useStableEvent(() => {
    choiceRef.current = { documentEpoch: getSource().documentEpoch, target: null };
    returnFocusRef.current = triggerRef.current;
    inputRef.current?.click();
  });
  const chooseReviewFiles = useStableEvent(() => {
    const source = getSource();
    const previousTarget = ownerRef.current?.replacementTarget;
    const target = previousTarget
      ? source.sourceDocument.layers.find(({ id }) => id === previousTarget.id) ?? previousTarget
      : null;
    choiceRef.current = { documentEpoch: source.documentEpoch, target };
    inputRef.current?.click();
  });
  const prepareReplacement = useStableEvent((request: LayerReplacementRequest) => {
    choiceRef.current = { documentEpoch: request.documentEpoch, target: request.target };
    returnFocusRef.current = request.trigger;
  });
  const getReview = useStableEvent((expectedBatch: ParsedMapDataBatch | null) => {
    const owner = ownerRef.current;
    return isOpen && expectedBatch && owner?.batch === expectedBatch
      && owner.source.documentEpoch === getSource().documentEpoch ? owner : null;
  });
  const reportBlockedDrop = useStableEvent(() => {
    const message = 'Files were not imported. Finish or cancel the current operation, then drop the files again.';
    if (isOpen) setDialogError(message);
    else setStatus({ documentEpoch: getSource().documentEpoch, kind: 'error', message });
  });

  return {
    batch, chooseImportFiles, chooseReviewFiles, closeDialog, dialogError, finalFocus,
    getReview, handleInputChange, inputRef, isReading, prepareFiles, prepareReplacement,
    replacementTarget, reportBlockedDrop, selectedNames, setDialogError, setShouldFitView, setStatus,
    shouldFitView, status: status?.documentEpoch === documentEpoch ? status : null, triggerRef,
  };
}
