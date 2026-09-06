import { FileUp } from 'lucide-react';
import { useCallback, useLayoutEffect, type RefObject } from 'react';
import type { LayerReplacementRequest, MapDataImportCommit } from '../hooks/useAppMapDataImport';
import { useMapDataDrop } from '../hooks/useMapDataDrop';
import { useMapDataImport } from '../hooks/useMapDataImport';
import { useProject, useProjectStoreApi } from '../projectStoreContext';
import { MapDataImportPortals } from './MapDataImportPortals';
import { FileFeedback } from './FileFeedback';

type GeoJsonImportButtonProps = {
  isDisabled: boolean;
  buttonRef: RefObject<HTMLButtonElement | null>;
  inputRef: RefObject<HTMLInputElement | null>;
  finishImportWork: (workId: number) => void;
  isWorkActive: boolean;
  startImportWork: () => number | null;
  isOpen: boolean;
  replacementRequest: LayerReplacementRequest | null;
  restoreFocusRef?: RefObject<HTMLButtonElement | null>;
  onOpenChange: (isOpen: boolean) => void;
  onImport: (commit: MapDataImportCommit) => import('../../domain/projectMutation').ProjectMutationResult;
  presentation?: 'trigger' | 'headless';
};

function ImportTrigger({
  buttonRef,
  isDisabled,
  onClick,
  presentation,
}: {
  buttonRef: RefObject<HTMLButtonElement | null>;
  isDisabled: boolean;
  onClick: () => void;
  presentation: NonNullable<GeoJsonImportButtonProps['presentation']>;
}) {
if (presentation === 'headless') {
  return <button ref={buttonRef} hidden type="button" disabled={isDisabled} onClick={onClick} />;
}
  return (
    <button ref={buttonRef} className="quiet-button" type="button" disabled={isDisabled} onClick={onClick}>
      <FileUp size={14} /> Import
    </button>
  );
}

export function GeoJsonImportButton({
  isDisabled,
  buttonRef,
  inputRef: providedInputRef,
  finishImportWork,
  isWorkActive,
  startImportWork,
  isOpen,
  replacementRequest,
  restoreFocusRef,
  onOpenChange,
  onImport,
  presentation = 'trigger',
}: GeoJsonImportButtonProps) {
  const projectStore = useProjectStoreApi();
  const getSource = useCallback(() => {
    const state = projectStore.getState();
    return { documentEpoch: state.documentEpoch, sourceDocument: state.document };
  }, [projectStore]);
  const documentEpoch = useProject((state) => state.documentEpoch);
  const {
    batch,
    batchAppearance,
    chooseImportFiles,
    chooseReviewFiles,
    closeDialog,
    commitReviewedImport,
    dialogError,
    finalFocus,
    handleInputChange,
    inputRef,
    isReading,
    batchAppearanceValidation,
    prepareFiles,
    prepareReplacement,
    replacementTarget,
    reportBlockedDrop,
    selectedNames,
    setBatchAppearance,
    setShouldFitView,
    shouldFitView,
    status,
    setStatus,
    triggerRef,
  } = useMapDataImport({
    documentEpoch,
    finishImportWork,
    getSource,
    isOpen,
    onImport,
    onOpenChange,
    startImportWork,
    triggerRef: restoreFocusRef ?? buttonRef,
    inputRef: providedInputRef,
  });
  useLayoutEffect(() => {
    if (replacementRequest) prepareReplacement(replacementRequest);
  }, [prepareReplacement, replacementRequest]);
  const handleDroppedFiles = useCallback((files: readonly File[]) => {
    prepareFiles(files);
  }, [prepareFiles]);
  const isDragActive = useMapDataDrop({
    isDisabled: isDisabled || isWorkActive,
    isOpen,
    onFiles: handleDroppedFiles,
    onBlockedDrop: reportBlockedDrop,
  });

  return (
    <>
      <input
        ref={inputRef}
        hidden
        multiple
        type="file"
        disabled={isReading || isWorkActive}
        accept=".geojson,.gpx,.kml,application/geo+json,application/gpx+xml,application/vnd.google-earth.kml+xml"
        onChange={handleInputChange}
      />
      <ImportTrigger buttonRef={buttonRef} isDisabled={isDisabled || isReading || isWorkActive} onClick={chooseImportFiles} presentation={presentation} />
      {status && (
        <FileFeedback kind={status.kind} label="Map data import status" message={status.message} onDismiss={() => setStatus(null)} returnFocusRef={triggerRef} />
      )}
      <MapDataImportPortals
        batch={batch}
        batchAppearance={batchAppearance}
        dialogError={dialogError}
        batchAppearanceValidation={batchAppearanceValidation}
        finalFocus={finalFocus}
        onChooseFiles={chooseReviewFiles}
        replacementTarget={replacementTarget}
        onClose={() => closeDialog()}
        onCommit={commitReviewedImport}
        selectedNames={selectedNames}
        setBatchAppearance={setBatchAppearance}
        setShouldFitView={setShouldFitView}
        state={{ isDragActive, isOpen, isReading, shouldFitView }}
      />
    </>
  );
}