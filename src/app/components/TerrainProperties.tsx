import { lazy, Suspense, useState } from 'react';
import type { ContentLayer } from '../../domain/project';
import type { TerrainSettings, ReliefSettings } from '../../domain/studio';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import type { PreviewPngExporter } from '../../export/previewPng';
import { InspectorAccordion, PropertyRow } from './PropertyControls';
import { ValidatedNumberField } from './ValidatedNumberField';
import { Checkbox } from './UiControls';
import { useMutationFeedback } from '../hooks/useMutationFeedback';
import { FeatureHelp } from './FeatureHelp';
import './terrainControls.css';
import { useAvailableMapExporter } from '../mapExporterContext';
import type { ComponentProps } from 'react';
import { useProject } from '../projectStoreContext';

const ReliefExportDialog = lazy(async () => {
  const module = await import('./ReliefExportDialog');
  return { default: module.ReliefExportDialog };
});

export type TerrainPropertiesProps = {
  documentEpoch: number;
  terrain: TerrainSettings;
  relief: ReliefSettings;
  layers?: readonly ContentLayer[];
  exporter?: PreviewPngExporter | null;
  blockedReason?: string;
  onTerrainChange: (settings: TerrainSettings) => ProjectMutationResult;
  onReliefChange: (settings: ReliefSettings) => ProjectMutationResult;
};

function ReliefDocumentLayers(props: Omit<ComponentProps<typeof ReliefExportDialog>, 'layers'>) {
  const layers = useProject((state) => state.document.layers);
  return <ReliefExportDialog {...props} layers={layers} />;
}

function ReliefDialogSurface(props: Omit<ComponentProps<typeof ReliefExportDialog>, 'exporter' | 'layers'> & { exporter?: PreviewPngExporter | null; layers?: readonly ContentLayer[] }) {
  const exporter = useAvailableMapExporter(props.exporter);
  return props.layers ? <ReliefExportDialog {...props} exporter={exporter} layers={props.layers} />
    : <ReliefDocumentLayers {...props} exporter={exporter} />;
}

export function TerrainProperties(props: TerrainPropertiesProps) {
  const { terrain, documentEpoch, onTerrainChange } = props;
  const [isReliefOpen, setIsReliefOpen] = useState(false);
  const feedback = useMutationFeedback(terrain);
  const change = (value: TerrainSettings) => feedback.report(onTerrainChange(value));
  const numericProps = { resetKey: documentEpoch, step: 0.1 };
  return (
    <InspectorAccordion isDefaultExpanded={false} storageKey="print-map-studio:inspector:terrain" title="Terrain & 3D relief" summary={`${terrain.enabled ? '3D terrain' : 'Flat map'}${terrain.contours.enabled ? ' · Contours' : ''}`}>
      <div className="feature-help-row"><Checkbox isChecked={terrain.enabled} label="Show 3D terrain" onCheckedChange={(enabled) => change({ ...terrain, enabled })} /><FeatureHelp label="3D terrain help">Increase camera Pitch to see terrain in perspective. Terrain is included in raster exports.</FeatureHelp></div>
      {terrain.enabled && <>
        <PropertyRow label="Exaggeration"><ValidatedNumberField {...numericProps} label="Terrain exaggeration" value={terrain.exaggeration} minimum={0} maximum={10} unit="×" onCommit={(exaggeration) => onTerrainChange({ ...terrain, exaggeration })} /></PropertyRow>
      </>}
      <div className="feature-help-row"><Checkbox isChecked={terrain.contours.enabled} label="Show elevation contours" onCheckedChange={(enabled) => change({ ...terrain, contours: { ...terrain.contours, enabled } })} /><FeatureHelp label="Elevation contours help">Real elevation isolines. Intervals adapt from at least 10 m up to 500 m when zoomed out; contours appear from zoom 5.</FeatureHelp></div>
      {terrain.contours.enabled && <>
        <PropertyRow label="Interval"><ValidatedNumberField {...numericProps} label="Contour interval" value={terrain.contours.intervalMeters} minimum={10} maximum={10_000} step={10} unit="m" onCommit={(intervalMeters) => onTerrainChange({ ...terrain, contours: { ...terrain.contours, intervalMeters } })} /></PropertyRow>
        <PropertyRow label="Line width"><ValidatedNumberField {...numericProps} label="Contour line width" value={terrain.contours.width} minimum={0.1} maximum={10} unit="px" onCommit={(width) => onTerrainChange({ ...terrain, contours: { ...terrain.contours, width } })} /></PropertyRow>
        <PropertyRow label="Line color"><input type="color" aria-label="Contour line color" value={terrain.contours.color} onChange={(event) => change({ ...terrain, contours: { ...terrain.contours, color: event.target.value } })} /></PropertyRow>
      </>}
      <div className="feature-help-row"><Checkbox isChecked={terrain.buildings.enabled} label="Show 3D buildings" onCheckedChange={(enabled) => change({ ...terrain, buildings: { ...terrain.buildings, enabled } })} /><FeatureHelp label="3D buildings help">Only buildings with mapped height data are extruded. Buildings are not included in STL.</FeatureHelp></div>
      {feedback.error && <p role="alert" className="coordinate-validation">{feedback.error}</p>}
      <div className="feature-help-row"><button type="button" className="secondary-button" disabled={!!props.blockedReason} onClick={() => setIsReliefOpen(true)}>Export 3D terrain STL</button><FeatureHelp label="Terrain model download help">Download a solid terrain model for your own slicer. No printing or shipping service.</FeatureHelp></div>
      {props.blockedReason && <p role="status" className="terrain-hint">{props.blockedReason}</p>}
      {isReliefOpen && <Suspense fallback={<p role="status">Loading terrain export…</p>}><ReliefDialogSurface key={documentEpoch} settings={props.relief} layers={props.layers} exporter={props.exporter} blockedReason={props.blockedReason} documentEpoch={documentEpoch} onChange={props.onReliefChange} onClose={() => setIsReliefOpen(false)} /></Suspense>}
    </InspectorAccordion>
  );
}
