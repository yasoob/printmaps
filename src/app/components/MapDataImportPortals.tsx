import { FileUp, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useRef, type RefObject } from 'react';
import type { ContentLayer } from '../../domain/project';
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

function importDialogCopy(target: ContentLayer | null) {
  if (target) return {
    commitLabel: `Replace ${target.name}`,
    description: `Keep ${target.name} identity and appearance; only its geometry changes.`,
    fitLabel: 'Fit replacement content',
    legend: 'Map view after replacement',
    title: `Replace ${target.name} data`,
  };
  return {
    commitLabel: null,
    description: 'Review this local-only batch before adding it to the project.',
    fitLabel: 'Fit imported content',
    legend: 'Map view after import',
    title: 'Import map data',
  };
}

function ReplacementNote({ target }: { target: ContentLayer | null }) {
  if (!target) return null;
  return <p className="map-data-replacement-note"><strong>{`Keep ${target.name} identity and appearance`}</strong><br />Name, order, visibility, lock, opacity, and styling stay unchanged.</p>;
}

function commitLabel(replacementLabel: string | null, fileCount: number) {
  return replacementLabel ?? `Import ${fileCount} files`;
}

type MapDataImportPortalsProps = {
  batch: ParsedMapDataBatch | null;
  dialogError: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  replacementTarget: ContentLayer | null;
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
  replacementTarget,
  onClose,
  onCommit,
  selectedNames,
  setShouldFitView,
  state,
}: MapDataImportPortalsProps) {
  const { isDragActive, isOpen, isReading, shouldFitView } = state;
  const copy = importDialogCopy(replacementTarget);
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
            <div>
              <h2 id="map-data-import-title">{copy.title}</h2>
              <p>{copy.description}</p>
            </div>
            <button className="icon-button" type="button" aria-label="Close map data import" onClick={onClose}><X size={15} /></button>
          </header>
          <div className="map-data-import-body">
            <ul aria-label="Selected map data files">
              {selectedNames.map((name, index) => <li key={`${index}-${name}`}>{name}</li>)}
            </ul>
            {isReading && <p role="status">Checking files…</p>}
            {dialogError && <p className="export-error" role="alert">{dialogError}</p>}
            <ReplacementNote target={replacementTarget} />
            {batch && (
              <fieldset>
                <legend>{copy.legend}</legend>
                <label><input type="radio" name="import-view" checked={shouldFitView} onChange={() => setShouldFitView(true)} /> {copy.fitLabel}</label>
                <label><input type="radio" name="import-view" checked={!shouldFitView} onChange={() => setShouldFitView(false)} /> Keep current view</label>
              </fieldset>
            )}
          </div>
          <footer className="export-dialog-actions">
            <button ref={replaceButtonRef} type="button" disabled={isReading} onClick={() => inputRef.current?.click()}>{batch ? 'Replace files' : 'Choose replacement files'}</button>
            <button type="button" disabled={isReading} onClick={onClose}>Cancel</button>
            {batch && <button ref={importButtonRef} className="primary-button" type="button" onClick={onCommit}>{commitLabel(copy.commitLabel, batch.files.length)}</button>}
          </footer>
        </dialog>
      </div>
    )}
  </>, document.body);
}
