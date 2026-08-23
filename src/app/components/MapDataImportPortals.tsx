import { FileUp, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useRef, type RefObject } from 'react';
import type { ContentLayer } from '../../domain/project';
import {
  POI_MARKER_SHAPES,
  POI_MARKER_SHAPE_LABELS,
  type PoiMarkerShape,
} from '../../domain/poiMarkers';
import type { ParsedMapDataBatch } from '../../import/mapDataBatch';
import type { MapDataBatchAppearance } from '../../import/mapDataBatchAppearance';

function trapDialogFocus(event: React.KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== 'Tab') return;
  const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), select:not([disabled])',
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

function numericStyleIsInvalid(value: string, minimum: number, maximum: number) {
  const parsed = Number(value);
  return value.trim() === '' || !Number.isFinite(parsed) || parsed < minimum || parsed > maximum;
}

function BatchAppearanceControls({
  appearance,
  batch,
  onChange,
}: {
  appearance: MapDataBatchAppearance;
  batch: ParsedMapDataBatch;
  onChange: (appearance: MapDataBatchAppearance) => void;
}) {
  const count = (type: ContentLayer['type']) => batch.layers.filter((layer) => layer.type === type).length;
  const routeCount = count('route');
  const poiCount = count('poi');
  const shapeCount = count('shape');
  return (
    <section className="map-data-batch-styling" aria-label="Import batch styling">
      <div><strong>Style before import</strong><p>Apply one consistent starting style to each content type in this batch.</p></div>
      {routeCount > 0 && (
        <fieldset>
          <legend>Style imported routes</legend>
          <small>{routeCount} {routeCount === 1 ? 'route' : 'routes'}</small>
          <label>Color <input aria-label="Import route color" type="color" value={appearance.route.color} onChange={(event) => onChange({ ...appearance, route: { ...appearance.route, color: event.target.value } })} /></label>
          <label>Width <span className="number-field"><input aria-label="Import route width" aria-invalid={numericStyleIsInvalid(appearance.route.width, 1, 16) || undefined} inputMode="decimal" value={appearance.route.width} onChange={(event) => onChange({ ...appearance, route: { ...appearance.route, width: event.target.value } })} /><small>px</small></span></label>
        </fieldset>
      )}
      {poiCount > 0 && (
        <fieldset>
          <legend>Style imported POIs</legend>
          <small>{poiCount} {poiCount === 1 ? 'POI' : 'POIs'}</small>
          <label>Color <input aria-label="Import POI color" type="color" value={appearance.poi.color} onChange={(event) => onChange({ ...appearance, poi: { ...appearance.poi, color: event.target.value } })} /></label>
          <label>Size <span className="number-field"><input aria-label="Import POI marker size" aria-invalid={numericStyleIsInvalid(appearance.poi.size, 8, 48) || undefined} inputMode="decimal" value={appearance.poi.size} onChange={(event) => onChange({ ...appearance, poi: { ...appearance.poi, size: event.target.value } })} /><small>px</small></span></label>
          <label>Shape <select aria-label="Import POI marker shape" value={appearance.poi.markerShape} onChange={(event) => onChange({ ...appearance, poi: { ...appearance.poi, markerShape: event.target.value as PoiMarkerShape } })}>{POI_MARKER_SHAPES.map((shape) => <option key={shape} value={shape}>{POI_MARKER_SHAPE_LABELS[shape]}</option>)}</select></label>
        </fieldset>
      )}
      {shapeCount > 0 && (
        <fieldset>
          <legend>Style imported shapes</legend>
          <small>{shapeCount} {shapeCount === 1 ? 'shape' : 'shapes'}</small>
          <label>Fill <input aria-label="Import shape fill color" type="color" value={appearance.shape.fillColor} onChange={(event) => onChange({ ...appearance, shape: { ...appearance.shape, fillColor: event.target.value } })} /></label>
          <label>Outline <input aria-label="Import shape outline color" type="color" value={appearance.shape.strokeColor} onChange={(event) => onChange({ ...appearance, shape: { ...appearance.shape, strokeColor: event.target.value } })} /></label>
          <label>Width <span className="number-field"><input aria-label="Import shape outline width" aria-invalid={numericStyleIsInvalid(appearance.shape.strokeWidth, 0.5, 12) || undefined} inputMode="decimal" value={appearance.shape.strokeWidth} onChange={(event) => onChange({ ...appearance, shape: { ...appearance.shape, strokeWidth: event.target.value } })} /><small>px</small></span></label>
        </fieldset>
      )}
    </section>
  );
}

type MapDataImportPortalsProps = {
  batch: ParsedMapDataBatch | null;
  batchAppearance: MapDataBatchAppearance | null;
  dialogError: string | null;
  isBatchAppearanceValid: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  replacementTarget: ContentLayer | null;
  onClose: () => void;
  onCommit: () => void;
  selectedNames: readonly string[];
  setBatchAppearance: (appearance: MapDataBatchAppearance) => void;
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
  batchAppearance,
  dialogError,
  isBatchAppearanceValid,
  inputRef,
  replacementTarget,
  onClose,
  onCommit,
  selectedNames,
  setBatchAppearance,
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
            {batch && batchAppearance && !replacementTarget && <BatchAppearanceControls appearance={batchAppearance} batch={batch} onChange={setBatchAppearance} />}
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
            {batch && <button ref={importButtonRef} className="primary-button" type="button" disabled={!isBatchAppearanceValid} onClick={onCommit}>{commitLabel(copy.commitLabel, batch.files.length)}</button>}
          </footer>
        </dialog>
      </div>
    )}
  </>, document.body);
}
