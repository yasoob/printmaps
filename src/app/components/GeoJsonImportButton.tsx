import { FileUp } from 'lucide-react';
import { useCallback, useEffect, type RefObject } from 'react';
import type { ProjectDocument } from '../../domain/project';
import type { LayerReplacementRequest, MapDataImportCommit } from '../hooks/useAppMapDataImport';
import { useMapDataDrop } from '../hooks/useMapDataDrop';
import { useMapDataImport } from '../hooks/useMapDataImport';
import { MapDataImportPortals } from './MapDataImportPortals';

type GeoJsonImportButtonProps = {
  isDisabled: boolean;
  documentEpoch: number;
  sourceDocument: ProjectDocument;
  buttonRef: RefObject<HTMLButtonElement | null>;
  finishImportWork: (workId: number) => void;
  isWorkActive: boolean;
  startImportWork: () => number | null;
  isOpen: boolean;
  replacementRequest: LayerReplacementRequest | null;
  onOpenChange: (isOpen: boolean) => void;
  onImport: (commit: MapDataImportCommit) => boolean;
  presentation?: 'trigger' | 'headless';
};

export function GeoJsonImportButton({
  isDisabled,
  buttonRef,
  documentEpoch,
  finishImportWork,
  isWorkActive,
  sourceDocument,
  startImportWork,
  isOpen,
  replacementRequest,
  onOpenChange,
  onImport,
  presentation = 'trigger',
}: GeoJsonImportButtonProps) {
  const {
    batch,
    batchAppearance,
    chooseImportFiles,
    chooseReplacementFile,
    closeDialog,
    commitReviewedImport,
    dialogError,
    handleInputChange,
    inputRef,
    isReading,
    isBatchAppearanceValid,
    prepareFiles,
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
    triggerRef: buttonRef,
  });
  useEffect(() => {
    if (replacementRequest) chooseReplacementFile(replacementRequest.target, replacementRequest.trigger);
  }, [chooseReplacementFile, replacementRequest]);
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
        disabled={isDisabled || isReading || isWorkActive}
        accept=".geojson,.gpx,.kml,application/geo+json,application/gpx+xml,application/vnd.google-earth.kml+xml"
        onChange={handleInputChange}
      />
      {presentation === 'trigger' && (
        <button ref={buttonRef} className="quiet-button" type="button" disabled={isDisabled || isReading || isWorkActive} onClick={chooseImportFiles}>
          <FileUp size={14} /> Import
        </button>
      )}
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