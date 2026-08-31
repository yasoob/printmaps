import { FileUp } from 'lucide-react';
import { useCallback, useEffect, type RefObject } from 'react';
import type { LayerReplacementRequest, MapDataImportCommit } from '../hooks/useAppMapDataImport';
import { useMapDataDrop } from '../hooks/useMapDataDrop';
import { useMapDataImport } from '../hooks/useMapDataImport';
import { useProject, useProjectDocumentContent } from '../projectStoreContext';
import { MapDataImportPortals } from './MapDataImportPortals';

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
  onImport: (commit: MapDataImportCommit) => boolean;
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
  // The import guard compares content, so this snapshot only has to refresh when
  // content does. Subscribing to the document itself would rebuild it on every
  // camera write, which land at pointer rate while a file is being read.
  const sourceDocument = useProjectDocumentContent();
  const documentEpoch = useProject((state) => state.documentEpoch);
  const {
    batch,
    batchAppearance,
    chooseImportFiles,
    closeDialog,
    commitReviewedImport,
    dialogError,
    handleInputChange,
    inputRef,
    isReading,
    isBatchAppearanceValid,
    prepareFiles,
    prepareReplacement,
    replacementTarget,
    selectedNames,
    setBatchAppearance,
    setShouldFitView,
    shouldFitView,
    status,
  } = useMapDataImport({
    documentEpoch,
    finishImportWork,
    isOpen,
    isWorkActive,
    onImport,
    onOpenChange,
    sourceDocument,
    startImportWork,
    triggerRef: restoreFocusRef ?? buttonRef,
    inputRef: providedInputRef,
  });
  useEffect(() => {
    if (replacementRequest) prepareReplacement(replacementRequest.target, replacementRequest.trigger);
  }, [prepareReplacement, replacementRequest]);
  const handleDroppedFiles = useCallback((files: readonly File[]) => {
    void prepareFiles(files, true, null);
  }, [prepareFiles]);
  const isDragActive = useMapDataDrop({
    isDisabled: isDisabled || isWorkActive,
    isOpen,
    onFiles: handleDroppedFiles,
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
        <div
          className={`project-file-status${status.kind === 'error' ? ' is-error' : ''}`}
          role={status.kind === 'error' ? 'alert' : 'status'}
          aria-label="Map data import status"
        >
          {status.message}
        </div>
      )}
      <MapDataImportPortals
        batch={batch}
        batchAppearance={batchAppearance}
        dialogError={dialogError}
        isBatchAppearanceValid={isBatchAppearanceValid}
        inputRef={inputRef}
        replacementTarget={replacementTarget}
        onClose={closeDialog}
        onCommit={commitReviewedImport}
        selectedNames={selectedNames}
        setBatchAppearance={setBatchAppearance}
        setShouldFitView={setShouldFitView}
        state={{ isDragActive, isOpen, isReading, shouldFitView }}
      />
    </>
  );
}