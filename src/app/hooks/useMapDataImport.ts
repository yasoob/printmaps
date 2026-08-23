import { useCallback } from 'react';
import type { ContentLayer } from '../../domain/project';
import {
  replacementSuccess,
  reviewedSuccess,
  useMapDataImportReader,
  type MapDataImportOptions,
} from './useMapDataImportReader';

export function useMapDataImport(options: MapDataImportOptions) {
  const { documentEpoch, onImport, onOpenChange, triggerRef } = options;
  const reader = useMapDataImportReader(options);
  const {
    batch, dialogError, handleInputChange, inputRef, isReading, isReadingRef, prepareFiles,
    replacementTarget, replacementTargetRef, requestIdRef, returnFocusRef, selectedNames,
    reviewedSourceRef,
    setBatch, setDialogError, setPhase, setReplacementTarget, setShouldFitView, setStatus,
    shouldFitView, status,
  } = reader;

  const closeDialog = useCallback((shouldRestoreFocus = true) => {
    requestIdRef.current += 1;
    if (!isReadingRef.current) setPhase('idle');
    setBatch(null);
    setDialogError(null);
    setReplacementTarget(null);
    replacementTargetRef.current = null;
    onOpenChange(false);
    if (shouldRestoreFocus) {
      window.setTimeout(() => {
        const target = returnFocusRef.current;
        (target?.isConnected ? target : triggerRef.current)?.focus();
      }, 0);
    }
  }, [isReadingRef, onOpenChange, replacementTargetRef, requestIdRef, returnFocusRef, setBatch, setDialogError, setPhase, setReplacementTarget, triggerRef]);

  const commitReviewedImport = () => {
    const reviewedSource = reviewedSourceRef.current;
    if (!batch || !reviewedSource) return;
    if (!onImport({
      documentEpoch: reviewedSource.documentEpoch,
      layers: batch.layers,
      replacementTarget,
      shouldFitView,
      sourceDocument: reviewedSource.sourceDocument,
    })) {
      setDialogError('The project changed before this data could be applied. Choose the replacement again.');
      return;
    }
    setStatus(replacementTarget
      ? replacementSuccess(replacementTarget, reviewedSource.documentEpoch)
      : reviewedSuccess(batch, reviewedSource.documentEpoch));
    closeDialog();
  };

  const chooseImportFiles = useCallback(() => {
    replacementTargetRef.current = null;
    setReplacementTarget(null);
    returnFocusRef.current = triggerRef.current;
    inputRef.current?.click();
  }, [inputRef, replacementTargetRef, returnFocusRef, setReplacementTarget, triggerRef]);

  const chooseReplacementFile = useCallback((target: ContentLayer, trigger: HTMLElement | null) => {
    replacementTargetRef.current = target;
    setReplacementTarget(target);
    returnFocusRef.current = trigger;
    inputRef.current?.click();
  }, [inputRef, replacementTargetRef, returnFocusRef, setReplacementTarget]);

  return {
    batch,
    chooseImportFiles,
    chooseReplacementFile,
    closeDialog,
    commitReviewedImport,
    dialogError,
    handleInputChange,
    inputRef,
    isReading,
    prepareFiles,
    replacementTarget,
    selectedNames,
    setShouldFitView,
    shouldFitView,
    status: status?.documentEpoch === documentEpoch ? status : null,
    triggerRef,
  };
}
