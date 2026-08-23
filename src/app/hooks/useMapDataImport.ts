import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { ContentLayer, ProjectDocument } from '../../domain/project';
import {
  parseMapDataFiles,
  type ParsedMapDataBatch,
} from '../../import/mapDataBatch';

type ImportStatus = { documentEpoch: number; kind: 'success' | 'error'; message: string };
type ImportPhase = 'idle' | 'reading';

type MapDataImportOptions = {
  documentEpoch: number;
  sourceDocument: ProjectDocument;
  triggerRef: RefObject<HTMLButtonElement | null>;
  isWorkActive: boolean;
  finishImportWork: (workId: number) => void;
  startImportWork: () => number | null;
  isOpen: boolean;
  onImport: (
    layers: readonly ContentLayer[],
    documentEpoch: number,
    sourceDocument: ProjectDocument,
    shouldFitView: boolean,
  ) => boolean;
  onOpenChange: (isOpen: boolean) => void;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'These map data files could not be imported.';
}

function immediateSuccess(batch: ParsedMapDataBatch, documentEpoch: number): ImportStatus {
  const [file] = batch.files;
  const noun = batch.layers.length === 1 ? 'layer' : 'layers';
  return {
    documentEpoch,
    kind: 'success',
    message: `Imported ${batch.layers.length} ${file.format} ${noun}. Undo removes the whole import.`,
  };
}

function reviewedSuccess(batch: ParsedMapDataBatch, documentEpoch: number): ImportStatus {
  const noun = batch.layers.length === 1 ? 'layer' : 'layers';
  return {
    documentEpoch,
    kind: 'success',
    message: `Imported ${batch.files.length} files as ${batch.layers.length} ${noun}. Undo removes the whole import.`,
  };
}

function focusTarget(): HTMLElement | null {
  const activeElement = document.activeElement;
  return activeElement instanceof HTMLElement
    && activeElement !== document.body
    && activeElement !== document.documentElement
    ? activeElement
    : null;
}

function useReadCompletionFocus(
  inputRef: RefObject<HTMLInputElement | null>,
  isReading: boolean,
  shouldRestoreAfterReadRef: RefObject<boolean>,
  triggerRef: RefObject<HTMLButtonElement | null>,
) {
  useEffect(() => {
    if (isReading || !shouldRestoreAfterReadRef.current) return;
    shouldRestoreAfterReadRef.current = false;
    const activeElement = document.activeElement;
    const shouldRestore = !activeElement
      || activeElement === document.body
      || activeElement === document.documentElement
      || activeElement === inputRef.current
      || activeElement === triggerRef.current;
    if (shouldRestore) triggerRef.current?.focus();
  }, [inputRef, isReading, shouldRestoreAfterReadRef, triggerRef]);
}

function useImportLifecycle(isMountedRef: RefObject<boolean>, requestIdRef: RefObject<number>) {
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, [isMountedRef, requestIdRef]);
}

export function useMapDataImport(options: MapDataImportOptions) {
  const { documentEpoch, finishImportWork, isOpen, isWorkActive, onImport, onOpenChange, sourceDocument, startImportWork, triggerRef } = options;
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [status, setStatus] = useState<ImportStatus | null>(null);
  const [batch, setBatch] = useState<ParsedMapDataBatch | null>(null);
  const [selectedNames, setSelectedNames] = useState<readonly string[]>([]);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [shouldFitView, setShouldFitView] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const onImportRef = useRef(onImport);

  const isReadingRef = useRef(false);
  const isMountedRef = useRef(true);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const shouldRestoreAfterReadRef = useRef(false);
  const isReading = phase === 'reading';

  useLayoutEffect(() => { onImportRef.current = onImport; }, [onImport]);
  useReadCompletionFocus(inputRef, isReading, shouldRestoreAfterReadRef, triggerRef);
  useImportLifecycle(isMountedRef, requestIdRef);

  const closeDialog = useCallback((shouldRestoreFocus = true) => {
    requestIdRef.current += 1;
    if (!isReadingRef.current) setPhase('idle');
    setBatch(null);
    setDialogError(null);
    onOpenChange(false);
    if (shouldRestoreFocus) {
      window.setTimeout(() => {
        const target = returnFocusRef.current;
        (target?.isConnected ? target : triggerRef.current)?.focus();
      }, 0);
    }
  }, [onOpenChange, triggerRef]);

  const acceptParsedBatch = useCallback((
    parsed: ParsedMapDataBatch,
    requestId: number,
    shouldReview: boolean,
  ) => {
    if (requestIdRef.current !== requestId) return;
    if (shouldReview) {
      setBatch(parsed);
      return;
    }
    if (onImportRef.current(parsed.layers, documentEpoch, sourceDocument, false)) {
      setStatus(immediateSuccess(parsed, documentEpoch));
    }
  }, [documentEpoch, sourceDocument]);

  const reportReadError = useCallback((error: unknown, requestId: number, statusEpoch: number, shouldReview: boolean) => {
    if (requestIdRef.current !== requestId) return;
    const message = errorMessage(error);
    if (shouldReview) setDialogError(message);
    else setStatus({ documentEpoch: statusEpoch, kind: 'error', message });
  }, []);

  const settleRead = useCallback((requestId: number, workId: number, shouldReview: boolean) => {
    finishImportWork(workId);
    isReadingRef.current = false;
    if (!isMountedRef.current) return;
    if (!shouldReview && requestIdRef.current === requestId) shouldRestoreAfterReadRef.current = true;
    setPhase('idle');
  }, [finishImportWork]);

  const prepareFiles = useCallback(async (files: readonly File[], shouldReview: boolean) => {
    const workId = startImportWork();
    if (workId === null) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    isReadingRef.current = true;
    setPhase('reading');
    setStatus(null);
    if (shouldReview) {
      if (!isOpen) {
        returnFocusRef.current = focusTarget();
        setShouldFitView(true);
      }
      setSelectedNames(files.map(({ name }) => name));
      setBatch(null);
      setDialogError(null);
      onOpenChange(true);
    }
    try {
      const parsed = await parseMapDataFiles(files, sourceDocument.layers);
      acceptParsedBatch(parsed, requestId, shouldReview);
    } catch (error) {
      reportReadError(error, requestId, documentEpoch, shouldReview);
    } finally {
      settleRead(requestId, workId, shouldReview);
    }
  }, [acceptParsedBatch, documentEpoch, isOpen, onOpenChange, reportReadError, settleRead, sourceDocument.layers, startImportWork]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = [...(input.files ?? [])];
    input.value = '';
    if (!isWorkActive && files.length > 0) {
      void prepareFiles(files, isOpen || files.length > 1);
    }
  };

  const commitReviewedImport = () => {
    if (!batch || !onImport(batch.layers, documentEpoch, sourceDocument, shouldFitView)) return;
    setStatus(reviewedSuccess(batch, documentEpoch));
    closeDialog();
  };

  return {
    batch,
    closeDialog,
    commitReviewedImport,
    dialogError,
    handleInputChange,
    inputRef,
    isReading,
    prepareFiles,
    selectedNames,
    setShouldFitView,
    shouldFitView,
    status: status?.documentEpoch === documentEpoch ? status : null,
    triggerRef,
  };
}
