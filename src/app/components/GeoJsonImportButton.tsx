import { FileUp } from 'lucide-react';
import { useCallback, type RefObject } from 'react';
import type { ContentLayer, ProjectDocument } from '../../domain/project';
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
  onOpenChange: (isOpen: boolean) => void;
  onImport: (
    layers: readonly ContentLayer[],
    documentEpoch: number,
    sourceDocument: ProjectDocument,
    shouldFitView: boolean,
  ) => boolean;
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
  onOpenChange,
  onImport,
}: GeoJsonImportButtonProps) {
  const {
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
  const handleDroppedFiles = useCallback((files: readonly File[]) => {
    void prepareFiles(files, true);
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
        accept=".geojson,.gpx,.kml,application/geo+json,application/gpx+xml,application/vnd.google-earth.kml+xml"
        onChange={handleInputChange}
      />
      <button ref={buttonRef} className="quiet-button" type="button" disabled={isDisabled || isReading || isWorkActive} onClick={() => inputRef.current?.click()}>
        <FileUp size={14} /> Import
      </button>
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
        dialogError={dialogError}
        inputRef={inputRef}
        onClose={closeDialog}
        onCommit={commitReviewedImport}
        selectedNames={selectedNames}
        setShouldFitView={setShouldFitView}
        state={{ isDragActive, isOpen, isReading, shouldFitView }}
      />
    </>
  );
}