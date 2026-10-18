import { FileUp } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useId, useRef, type ReactNode } from 'react';
import { ColorField } from '@/components/ui/color-field';
import { Dialog } from '@/components/ui/dialog';
import { Notice } from '@/components/ui/notice';
import { StudioDialog, StudioDialogActions, StudioDialogBody, StudioDialogButton, StudioDialogHeader } from '@/components/ui/studio-dialog';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { PropertyRow } from './PropertyControls';
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
  return <>
    <PropertyRow label={label}>
      <span className="number-field">
        <input aria-label={name} aria-invalid={!validation.ok} aria-describedby={validation.ok ? undefined : errorId} inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} />
        <small>px</small>
      </span>
    </PropertyRow>
    {!validation.ok && <small id={errorId} className="map-data-style-error">{validation.error}</small>}
  </>;
}

function ImportColorField({ label, name, value, onChange }: { label: string; name: string; value: string; onChange: (value: string) => void }) {
  return <PropertyRow label={label}><ColorField label={name} value={value} onChange={onChange} /></PropertyRow>;
}

function StyleGroup({ legend, count, children }: { legend: string; count: string; children: ReactNode }) {
  return <fieldset className="map-data-style-group">
    <legend>{legend}</legend>
    <small className="map-data-style-count">{count}</small>
    {children}
  </fieldset>;
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
      <div className="map-data-batch-intro"><h3>Style before import</h3><p>Apply one consistent starting style to each content type in this batch.</p></div>
      {routeCount > 0 && (
        <StyleGroup legend="Style imported routes" count={`${routeCount} ${routeCount === 1 ? 'route' : 'routes'}`}>
          <ImportColorField label="Color" name="Import route color" value={appearance.route.color} onChange={(color) => onChange({ ...appearance, route: { ...appearance.route, color } })} />
          <ImportNumberField label="Width" name="Import route width" value={appearance.route.width} validation={validation.fields.routeWidth} onChange={(width) => onChange({ ...appearance, route: { ...appearance.route, width } })} />
        </StyleGroup>
      )}
      {poiCount > 0 && (
        <StyleGroup legend="Style imported POIs" count={`${poiCount} ${poiCount === 1 ? 'POI' : 'POIs'}`}>
          <ImportColorField label="Color" name="Import POI color" value={appearance.poi.color} onChange={(color) => onChange({ ...appearance, poi: { ...appearance.poi, color } })} />
          <ImportNumberField label="Size" name="Import POI marker size" value={appearance.poi.size} validation={validation.fields.poiSize} onChange={(size) => onChange({ ...appearance, poi: { ...appearance.poi, size } })} />
          <PropertyRow label="Shape"><select aria-label="Import POI marker shape" value={appearance.poi.markerShape} onChange={(event) => onChange({ ...appearance, poi: { ...appearance.poi, markerShape: event.target.value as PoiMarkerShape } })}>{POI_MARKER_SHAPES.map((shape) => <option key={shape} value={shape}>{POI_MARKER_SHAPE_LABELS[shape]}</option>)}</select></PropertyRow>
        </StyleGroup>
      )}
      {shapeCount > 0 && (
        <StyleGroup legend="Style imported shapes" count={`${shapeCount} ${shapeCount === 1 ? 'shape' : 'shapes'}`}>
          <ImportColorField label="Fill" name="Import shape fill color" value={appearance.shape.fillColor} onChange={(fillColor) => onChange({ ...appearance, shape: { ...appearance.shape, fillColor } })} />
          <ImportColorField label="Outline" name="Import shape outline color" value={appearance.shape.strokeColor} onChange={(strokeColor) => onChange({ ...appearance, shape: { ...appearance.shape, strokeColor } })} />
          <ImportNumberField label="Width" name="Import shape outline width" value={appearance.shape.strokeWidth} validation={validation.fields.shapeOutlineWidth} onChange={(strokeWidth) => onChange({ ...appearance, shape: { ...appearance.shape, strokeWidth } })} />
        </StyleGroup>
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
      <StudioDialog
          className="map-data-import-dialog"
          overlayClassName="map-data-import-backdrop"
          initialFocus={cancelButtonRef}
          finalFocus={finalFocus}
          tabIndex={-1}
        >
          <StudioDialogHeader title={copy.title} description={copy.description} closeLabel="Close map data import" />
          <StudioDialogBody className="map-data-import-body" role="region" aria-label="Import review" tabIndex={0}>
            <ul className="map-data-file-list" aria-label="Selected map data files">
              {selectedNames.map((name, index) => <li key={`${index}-${name}`}>{name}</li>)}
            </ul>
            {isReading && <p role="status">Checking files…</p>}
            {dialogError && <Notice tone="error">{dialogError}</Notice>}
            {replacementTarget && <ReplacementNote target={replacementTarget} />}
            {!replacementTarget && <BatchAppearanceControls appearance={batchAppearance} batch={batch} validation={batchAppearanceValidation} onChange={setBatchAppearance} />}
            {batch && (
<div className="map-data-view-row">
                <PropertyRow label="Map view">
                  <SegmentedControl label={copy.legend} value={shouldFitView ? 'fit' : 'keep'}
                    options={[{ value: 'fit', label: copy.fitLabel }, { value: 'keep', label: 'Keep current view' }]}
                    onValueChange={(view) => setShouldFitView(view === 'fit')} />
                </PropertyRow>
              </div>
            )}
          </StudioDialogBody>
          <StudioDialogActions className="map-data-import-actions"
            start={<StudioDialogButton variant="secondary" disabled={isReading} onClick={onChooseFiles}>{batch ? 'Replace files' : 'Choose replacement files'}</StudioDialogButton>}>
            <StudioDialogButton ref={cancelButtonRef} onClick={onClose}>Cancel</StudioDialogButton>
            {batch && <StudioDialogButton variant="primary" disabled={!isBatchAppearanceValid} onClick={onCommit}>{commitLabel(copy.commitLabel, batch.files.length)}</StudioDialogButton>}
          </StudioDialogActions>
      </StudioDialog>
    </Dialog>
  </>;
}
