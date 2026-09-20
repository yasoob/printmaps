import { memo } from 'react';
import type { TerrainSettings } from '../../domain/studio';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import { InspectorAccordion, PropertyRow } from './PropertyControls';
import { ValidatedNumberField } from './ValidatedNumberField';
import { Checkbox } from './UiControls';
import { useMutationFeedback } from '../hooks/useMutationFeedback';
import { FeatureHelp } from './FeatureHelp';
import './terrainControls.css';
import type { ComponentProps } from 'react';
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
export type TerrainPropertiesProps = {
  documentEpoch: number;
  terrain: TerrainSettings;
  onTerrainChange: (settings: TerrainSettings) => ProjectMutationResult;
};

export function TerrainProperties(props: TerrainPropertiesProps) {
  const { terrain, documentEpoch, onTerrainChange } = props;
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
    <InspectorAccordion isDefaultExpanded={false} storageKey="print-map-studio:inspector:terrain" title="Terrain" summary={`${terrain.enabled ? '3D terrain' : 'Flat map'}${terrain.contours.enabled ? ' · Contours' : ''}`}>
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
      <TerrainToggle isChecked={terrain.buildings.enabled} label="Show 3D buildings" onCheckedChange={toggleBuildings} helpLabel="3D buildings help" help="Only buildings with mapped height data are extruded." />
      {feedback.error && <p role="alert" className="coordinate-validation">{feedback.error}</p>}
    </InspectorAccordion>
  );
}
