import { FileUp, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useId, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { ContentLayer } from '../../domain/project';
import {
  POI_MARKER_SHAPES,
  POI_MARKER_SHAPE_LABELS,
  type PoiMarkerShape,
} from '../../domain/poiMarkers';
import type { ParsedMapDataBatch } from '../../import/mapDataBatch';
import type { ImportNumberValidation, MapDataBatchAppearance, MapDataBatchValidation } from '../../import/mapDataBatchAppearance';

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
  return replacementLabel ?? `Import ${fileCount} ${fileCount === 1 ? 'file' : 'files'}`;
}

function ImportNumberField({ label, name, value, validation, onChange }: {
  label: string;
  name: string;
  value: string;
  validation: ImportNumberValidation;
  onChange: (value: string) => void;
}) {
  const errorId = useId();
  return <label>{label}
    <span className="number-field">
      <input aria-label={name} aria-invalid={!validation.ok} aria-describedby={validation.ok ? undefined : errorId} inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} />
      <small>px</small>
    </span>
    {!validation.ok && <small id={errorId} className="map-data-style-error">{validation.error}</small>}
  </label>;
}

function BatchAppearanceControls({
  appearance,
  batch,
  validation,
  onChange,
}: {
  appearance: MapDataBatchAppearance | null;
  batch: ParsedMapDataBatch | null;
  validation: MapDataBatchValidation | null;
  onChange: (appearance: MapDataBatchAppearance) => void;
}) {
  if (!appearance || !batch || !validation) return null;
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
          <ImportNumberField label="Width" name="Import route width" value={appearance.route.width} validation={validation.fields.routeWidth} onChange={(width) => onChange({ ...appearance, route: { ...appearance.route, width } })} />
        </fieldset>
      )}
      {poiCount > 0 && (
        <fieldset>
          <legend>Style imported POIs</legend>
          <small>{poiCount} {poiCount === 1 ? 'POI' : 'POIs'}</small>
          <label>Color <input aria-label="Import POI color" type="color" value={appearance.poi.color} onChange={(event) => onChange({ ...appearance, poi: { ...appearance.poi, color: event.target.value } })} /></label>
          <ImportNumberField label="Size" name="Import POI marker size" value={appearance.poi.size} validation={validation.fields.poiSize} onChange={(size) => onChange({ ...appearance, poi: { ...appearance.poi, size } })} />
          <label>Shape <select aria-label="Import POI marker shape" value={appearance.poi.markerShape} onChange={(event) => onChange({ ...appearance, poi: { ...appearance.poi, markerShape: event.target.value as PoiMarkerShape } })}>{POI_MARKER_SHAPES.map((shape) => <option key={shape} value={shape}>{POI_MARKER_SHAPE_LABELS[shape]}</option>)}</select></label>
        </fieldset>
      )}
      {shapeCount > 0 && (
        <fieldset>
          <legend>Style imported shapes</legend>
          <small>{shapeCount} {shapeCount === 1 ? 'shape' : 'shapes'}</small>
          <label>Fill <input aria-label="Import shape fill color" type="color" value={appearance.shape.fillColor} onChange={(event) => onChange({ ...appearance, shape: { ...appearance.shape, fillColor: event.target.value } })} /></label>
          <label>Outline <input aria-label="Import shape outline color" type="color" value={appearance.shape.strokeColor} onChange={(event) => onChange({ ...appearance, shape: { ...appearance.shape, strokeColor: event.target.value } })} /></label>
          <ImportNumberField label="Width" name="Import shape outline width" value={appearance.shape.strokeWidth} validation={validation.fields.shapeOutlineWidth} onChange={(strokeWidth) => onChange({ ...appearance, shape: { ...appearance.shape, strokeWidth } })} />
        </fieldset>
      )}
    </section>
  );
}

type MapDataImportPortalsProps = {
  batch: ParsedMapDataBatch | null;
  batchAppearance: MapDataBatchAppearance | null;
  batchAppearanceValidation: MapDataBatchValidation | null;
  dialogError: string | null;
  finalFocus: () => HTMLElement | false;
  onChooseFiles: () => void;
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
  batchAppearanceValidation,
  dialogError,
  finalFocus,
  onChooseFiles,
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
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const isBatchAppearanceValid = replacementTarget !== null || batchAppearanceValidation?.error === null;

  return <>
    {isDragActive && createPortal(
      <div className="map-data-drop-overlay" aria-hidden="true">
        <div><FileUp size={22} /> <strong>Drop GeoJSON, GPX, or KML files</strong></div>
      </div>,
      document.body,
    )}
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
          className="map-data-import-dialog"
          overlayClassName="map-data-import-backdrop"
          showCloseButton={false}
          initialFocus={cancelButtonRef}
          finalFocus={finalFocus}
          aria-labelledby="map-data-import-title"
          tabIndex={-1}
        >
          <header className="export-dialog-header">
            <div>
              <h2 id="map-data-import-title">{copy.title}</h2>
              <p>{copy.description}</p>
            </div>
            <button className="icon-button close-button" type="button" aria-label="Close map data import" onClick={onClose}><X size={15} /></button>
          </header>
          <div className="map-data-import-body" role="region" aria-label="Import review" tabIndex={0}>
            <ul aria-label="Selected map data files">
              {selectedNames.map((name, index) => <li key={`${index}-${name}`}>{name}</li>)}
            </ul>
            {isReading && <p role="status">Checking files…</p>}
            {dialogError && <p className="export-error" role="alert">{dialogError}</p>}
            <ReplacementNote target={replacementTarget} />
            {!replacementTarget && <BatchAppearanceControls appearance={batchAppearance} batch={batch} validation={batchAppearanceValidation} onChange={setBatchAppearance} />}
            {batch && (
              <fieldset>
                <legend>{copy.legend}</legend>
                <label><input type="radio" name="import-view" checked={shouldFitView} onChange={() => setShouldFitView(true)} /> {copy.fitLabel}</label>
                <label><input type="radio" name="import-view" checked={!shouldFitView} onChange={() => setShouldFitView(false)} /> Keep current view</label>
              </fieldset>
            )}
          </div>
          <footer className="export-dialog-actions">
            <button type="button" disabled={isReading} onClick={onChooseFiles}>{batch ? 'Replace files' : 'Choose replacement files'}</button>
            <button ref={cancelButtonRef} type="button" onClick={onClose}>Cancel</button>
            {batch && <button className="primary-button" type="button" disabled={!isBatchAppearanceValid} onClick={onCommit}>{commitLabel(copy.commitLabel, batch.files.length)}</button>}
          </footer>
      </DialogContent>
    </Dialog>
  </>;
}
