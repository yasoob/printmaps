import { lazy, memo, Suspense, useState } from 'react';
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
import { useSettingActions } from '../hooks/useSettingActions';
import { useStableEvent } from '../hooks/useStableEvent';

const TERRAIN_KEYS = ['enabled', 'exaggeration', 'contours', 'buildings'] as const;
const CONTOUR_KEYS = ['enabled', 'intervalMeters', 'width', 'color'] as const;
const BUILDING_KEYS = ['enabled'] as const;

const TerrainToggle = memo(function TerrainToggle({ help, helpLabel, ...props }: ComponentProps<typeof Checkbox> & { help: string; helpLabel: string }) {
  return <div className="feature-help-row"><Checkbox {...props} /><FeatureHelp label={helpLabel}>{help}</FeatureHelp></div>;
});
const TerrainNumber = memo(function TerrainNumber({ rowLabel, ...props }: ComponentProps<typeof ValidatedNumberField> & { rowLabel: string }) {
  return <PropertyRow label={rowLabel}><ValidatedNumberField {...props} /></PropertyRow>;
});
const TerrainColor = memo(function TerrainColor({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return <PropertyRow label="Line color"><input type="color" aria-label="Contour line color" value={value} onChange={(event) => onChange(event.target.value)} /></PropertyRow>;
});
const terrainExportHelp = <FeatureHelp label="Terrain model download help">Download a solid terrain model for your own slicer. No printing or shipping service.</FeatureHelp>;

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
  const change = useSettingActions(terrain, onTerrainChange, TERRAIN_KEYS);
  const contours = useSettingActions(terrain.contours, change.contours, CONTOUR_KEYS);
  const buildings = useSettingActions(terrain.buildings, change.buildings, BUILDING_KEYS);
  const toggleTerrain = useStableEvent((isEnabled: boolean) => feedback.report(change.enabled(isEnabled)));
  const toggleContours = useStableEvent((isEnabled: boolean) => feedback.report(contours.enabled(isEnabled)));
  const toggleBuildings = useStableEvent((isEnabled: boolean) => feedback.report(buildings.enabled(isEnabled)));
  const contourColor = useStableEvent((color: string) => feedback.report(contours.color(color)));
  const numericProps = { resetKey: documentEpoch, step: 0.1 };
  return (
    <InspectorAccordion isDefaultExpanded={false} storageKey="print-map-studio:inspector:terrain" title="Terrain & 3D relief" summary={`${terrain.enabled ? '3D terrain' : 'Flat map'}${terrain.contours.enabled ? ' · Contours' : ''}`}>
      <TerrainToggle isChecked={terrain.enabled} label="Show 3D terrain" onCheckedChange={toggleTerrain} helpLabel="3D terrain help" help="Increase camera Pitch to see terrain in perspective. Terrain is included in raster exports." />
      {terrain.enabled && <>
        <TerrainNumber rowLabel="Exaggeration" {...numericProps} label="Terrain exaggeration" value={terrain.exaggeration} minimum={0} maximum={10} unit="×" onCommit={change.exaggeration} />
      </>}
      <TerrainToggle isChecked={terrain.contours.enabled} label="Show elevation contours" onCheckedChange={toggleContours} helpLabel="Elevation contours help" help="Real elevation isolines. Intervals adapt from at least 10 m up to 500 m when zoomed out; contours appear from zoom 5." />
      {terrain.contours.enabled && <>
        <TerrainNumber rowLabel="Interval" {...numericProps} label="Contour interval" value={terrain.contours.intervalMeters} minimum={10} maximum={10_000} step={10} unit="m" onCommit={contours.intervalMeters} />
        <TerrainNumber rowLabel="Line width" {...numericProps} label="Contour line width" value={terrain.contours.width} minimum={0.1} maximum={10} unit="px" onCommit={contours.width} />
        <TerrainColor value={terrain.contours.color} onChange={contourColor} />
      </>}
      <TerrainToggle isChecked={terrain.buildings.enabled} label="Show 3D buildings" onCheckedChange={toggleBuildings} helpLabel="3D buildings help" help="Only buildings with mapped height data are extruded. Buildings are not included in STL." />
      {feedback.error && <p role="alert" className="coordinate-validation">{feedback.error}</p>}
      <div className="feature-help-row"><button type="button" className="secondary-button" disabled={!!props.blockedReason} onClick={() => setIsReliefOpen(true)}>Export 3D terrain STL</button>{terrainExportHelp}</div>
      {props.blockedReason && <p role="status" className="terrain-hint">{props.blockedReason}</p>}
      {isReliefOpen && <Suspense fallback={<p role="status">Loading terrain export…</p>}><ReliefDialogSurface key={documentEpoch} settings={props.relief} layers={props.layers} exporter={props.exporter} blockedReason={props.blockedReason} documentEpoch={documentEpoch} onChange={props.onReliefChange} onClose={() => setIsReliefOpen(false)} /></Suspense>}
    </InspectorAccordion>
  );
}
