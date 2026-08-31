import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type { ContentLayer, ProjectDocument } from '../../domain/project';
import { parseMapDataFiles, type ParsedMapDataBatch } from '../../import/mapDataBatch';
import type { MapDataImportCommit } from './useAppMapDataImport';

type ImportStatus = { documentEpoch: number; kind: 'success' | 'error'; message: string };
type ImportPhase = 'idle' | 'reading';
type ReviewedSource = Readonly<{ documentEpoch: number; sourceDocument: ProjectDocument }>;

export type MapDataImportOptions = {
  documentEpoch: number;
  inputRef?: RefObject<HTMLInputElement | null>;
  sourceDocument: ProjectDocument;
  triggerRef: RefObject<HTMLButtonElement | null>;
  isWorkActive: boolean;
  finishImportWork: (workId: number) => void;
  startImportWork: () => number | null;
  isOpen: boolean;
  onImport: (commit: MapDataImportCommit) => boolean;
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

export function reviewedSuccess(batch: ParsedMapDataBatch, documentEpoch: number): ImportStatus {
  const noun = batch.layers.length === 1 ? 'layer' : 'layers';
  return {
    documentEpoch,
    kind: 'success',
    message: `Imported ${batch.files.length} files as ${batch.layers.length} ${noun}. Undo removes the whole import.`,
  };
}

export function replacementSuccess(target: ContentLayer, documentEpoch: number): ImportStatus {
  return {
    documentEpoch,
    kind: 'success',
    message: `Replaced ${target.name} data. Undo restores the previous geometry.`,
  };
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

export function useMapDataImportReader(options: MapDataImportOptions) {
  const { documentEpoch, finishImportWork, isOpen, isWorkActive, onImport, onOpenChange, sourceDocument, startImportWork, triggerRef } = options;
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [status, setStatus] = useState<ImportStatus | null>(null);
  const [batch, setBatch] = useState<ParsedMapDataBatch | null>(null);
  const [replacementTarget, setReplacementTarget] = useState<ContentLayer | null>(null);
  const [selectedNames, setSelectedNames] = useState<readonly string[]>([]);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [shouldFitView, setShouldFitView] = useState(true);
  const localInputRef = useRef<HTMLInputElement>(null);
  const inputRef = options.inputRef ?? localInputRef;
  const requestIdRef = useRef(0);
  const onImportRef = useRef(onImport);
  const isReadingRef = useRef(false);
  const isMountedRef = useRef(true);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const replacementTargetRef = useRef<ContentLayer | null>(null);
  const reviewedSourceRef = useRef<ReviewedSource | null>(null);
  const shouldRestoreAfterReadRef = useRef(false);
  const isReading = phase === 'reading';

  useLayoutEffect(() => { onImportRef.current = onImport; }, [onImport]);
  useReadCompletionFocus(inputRef, isReading, shouldRestoreAfterReadRef, triggerRef);
  useImportLifecycle(isMountedRef, requestIdRef);

  const acceptParsedBatch = useCallback((parsed: ParsedMapDataBatch, requestId: number, shouldReview: boolean, requestedReplacement: ContentLayer | null) => {
    if (requestIdRef.current !== requestId) return;
    if (shouldReview) {
      reviewedSourceRef.current = { documentEpoch, sourceDocument };
      setBatch(parsed);
      return;
    }
    if (onImportRef.current({ documentEpoch, layers: parsed.layers, replacementTarget: requestedReplacement, shouldFitView: false, sourceDocument })) {
      setStatus(immediateSuccess(parsed, documentEpoch));
    }
  }, [documentEpoch, sourceDocument]);

  const settleRead = useCallback((requestId: number, workId: number, shouldReview: boolean) => {
    finishImportWork(workId);
    isReadingRef.current = false;
    if (!isMountedRef.current) return;
    if (!shouldReview && requestIdRef.current === requestId) shouldRestoreAfterReadRef.current = true;
    setPhase('idle');
  }, [finishImportWork]);

  const prepareFiles = useCallback(async (files: readonly File[], shouldReview: boolean, requestedReplacement: ContentLayer | null = replacementTargetRef.current) => {
    replacementTargetRef.current = requestedReplacement;
    const workId = startImportWork();
    if (workId === null) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    isReadingRef.current = true;
    setPhase('reading');
    setStatus(null);
    if (shouldReview) {
      if (!isOpen) {
        if (!requestedReplacement) returnFocusRef.current = focusTarget();
        setShouldFitView(true);
      }
      setReplacementTarget(requestedReplacement);
      setSelectedNames(files.map(({ name }) => name));
      reviewedSourceRef.current = null;
      setBatch(null);
      setDialogError(null);
      onOpenChange(true);
    }
    try {
      const existingLayers = requestedReplacement
        ? sourceDocument.layers.filter(({ id }) => id !== requestedReplacement.id)
        : sourceDocument.layers;
      const parsed = await parseMapDataFiles(files, existingLayers);
      if (requestedReplacement) validateReplacementBatch(parsed, requestedReplacement);
      acceptParsedBatch(parsed, requestId, shouldReview, requestedReplacement);
    } catch (error) {
      if (requestIdRef.current === requestId) {
        const message = errorMessage(error);
        if (shouldReview) setDialogError(message);
        else setStatus({ documentEpoch, kind: 'error', message });
      }
    } finally {
      settleRead(requestId, workId, shouldReview);
    }
  }, [acceptParsedBatch, documentEpoch, isOpen, onOpenChange, settleRead, sourceDocument.layers, startImportWork]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = [...(input.files ?? [])];
    input.value = '';
    if (!isWorkActive && files.length > 0) {
      const requestedReplacement = replacementTargetRef.current;
      void prepareFiles(files, Boolean(requestedReplacement) || isOpen || files.length > 1, requestedReplacement);
    }
  };

  return {
    batch, dialogError, handleInputChange, inputRef, isReading, isReadingRef, prepareFiles,
    replacementTarget, replacementTargetRef, requestIdRef, returnFocusRef, selectedNames,
    reviewedSourceRef,
    setBatch, setDialogError, setPhase, setReplacementTarget, setShouldFitView, setStatus,
    shouldFitView, status,
  };
}
