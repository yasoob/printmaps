import { FileUp, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useRef, type RefObject } from 'react';
import type { ParsedMapDataBatch } from '../../import/mapDataBatch';

function trapDialogFocus(event: React.KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== 'Tab') return;
  const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled])',
  )].filter((element) => !element.hidden);
  if (focusable.length === 0) {
    event.preventDefault();
    event.currentTarget.focus();
    return;
  }
  const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
  if (event.shiftKey && currentIndex <= 0) {
    event.preventDefault();
    focusable.at(-1)?.focus();
  } else if (!event.shiftKey && currentIndex === focusable.length - 1) {
    event.preventDefault();
    focusable[0].focus();
  }
}

type MapDataImportPortalsProps = {
  batch: ParsedMapDataBatch | null;
  dialogError: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onCommit: () => void;
  selectedNames: readonly string[];
  setShouldFitView: (shouldFitView: boolean) => void;
  state: {
    isDragActive: boolean;
    isOpen: boolean;
    isReading: boolean;
    shouldFitView: boolean;
  };
};

export function MapDataImportPortals({
  batch,
  dialogError,
  inputRef,
  onClose,
  onCommit,
  selectedNames,
  setShouldFitView,
  state,
}: MapDataImportPortalsProps) {
  const { isDragActive, isOpen, isReading, shouldFitView } = state;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const importButtonRef = useRef<HTMLButtonElement>(null);
  const replaceButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (isReading) dialogRef.current?.focus();
    else if (batch) importButtonRef.current?.focus();
    else replaceButtonRef.current?.focus();
  }, [batch, isOpen, isReading]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    trapDialogFocus(event);
  };

  return createPortal(<>
    {isDragActive && (
      <div className="map-data-drop-overlay" aria-hidden="true">
        <div><FileUp size={22} /> <strong>Drop GeoJSON, GPX, or KML files</strong></div>
      </div>
    )}
    {isOpen && (
      <div className="map-data-import-overlay">
        <button className="export-backdrop" type="button" aria-label="Cancel map data import" onClick={onClose} />
        <dialog
          ref={dialogRef}
          className="map-data-import-dialog"
          open
          aria-modal="true"
          aria-labelledby="map-data-import-title"
          aria-busy={isReading}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
        >
          <header className="export-dialog-header">
            <div><h2 id="map-data-import-title">Import map data</h2><p>Review this local-only batch before adding it to the project.</p></div>
            <button className="icon-button" type="button" aria-label="Close map data import" onClick={onClose}><X size={15} /></button>
          </header>
          <div className="map-data-import-body">
            <ul aria-label="Selected map data files">
              {selectedNames.map((name, index) => <li key={`${index}-${name}`}>{name}</li>)}
            </ul>
            {isReading && <p role="status">Checking files…</p>}
            {dialogError && <p className="export-error" role="alert">{dialogError}</p>}
            {batch && (
              <fieldset>
                <legend>Map view after import</legend>
                <label><input type="radio" name="import-view" checked={shouldFitView} onChange={() => setShouldFitView(true)} /> Fit imported content</label>
                <label><input type="radio" name="import-view" checked={!shouldFitView} onChange={() => setShouldFitView(false)} /> Keep current view</label>
              </fieldset>
            )}
          </div>
          <footer className="export-dialog-actions">
            <button ref={replaceButtonRef} type="button" disabled={isReading} onClick={() => inputRef.current?.click()}>{batch ? 'Replace files' : 'Choose replacement files'}</button>
            <button type="button" disabled={isReading} onClick={onClose}>Cancel</button>
            {batch && <button ref={importButtonRef} className="primary-button" type="button" onClick={onCommit}>Import {batch.files.length} files</button>}
          </footer>
        </dialog>
      </div>
    )}
  </>, document.body);
}
