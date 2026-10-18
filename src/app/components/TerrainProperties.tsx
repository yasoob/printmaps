import { memo } from 'react';
import type { TerrainSettings } from '../../domain/studio';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import { InspectorAccordion, PropertyRow } from './PropertyControls';
import { ValidatedNumberField } from './ValidatedNumberField';
import { useMutationFeedback } from '../hooks/useMutationFeedback';
import { FeatureHelp } from './FeatureHelp';
import { ColorField } from '../../components/ui/color-field';
import { ToggleSection } from '../../components/ui/toggle-section';
import './terrainControls.css';
import type { ComponentProps } from 'react';
import { useSettingActions } from '../hooks/useSettingActions';
import { useStableEvent } from '../hooks/useStableEvent';

const TERRAIN_KEYS = ['enabled', 'exaggeration', 'contours', 'buildings'] as const;
const CONTOUR_KEYS = ['enabled', 'intervalMeters', 'width', 'color'] as const;
const BUILDING_KEYS = ['enabled'] as const;

const TERRAIN_HELP = <FeatureHelp label="3D terrain help">Increase camera Pitch to see terrain in perspective. Terrain is included in raster exports.</FeatureHelp>;
const CONTOUR_HELP = <FeatureHelp label="Elevation contours help">Real elevation isolines. Intervals adapt from at least 10 m up to 500 m when zoomed out; contours appear from zoom 5.</FeatureHelp>;
const BUILDING_HELP = <FeatureHelp label="3D buildings help">Only buildings with mapped height data are extruded.</FeatureHelp>;
const TerrainNumber = memo(function TerrainNumber({ rowLabel, ...props }: ComponentProps<typeof ValidatedNumberField> & { rowLabel: string }) {
  return <PropertyRow label={rowLabel}><ValidatedNumberField {...props} /></PropertyRow>;
});
const TerrainColor = memo(function TerrainColor({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return <PropertyRow label="Line color"><ColorField label="Contour line color" value={value} onChange={onChange} /></PropertyRow>;
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
      <ToggleSection title="3D terrain" switchLabel="Show 3D terrain" help={TERRAIN_HELP} checked={terrain.enabled} onCheckedChange={toggleTerrain}>
        <TerrainNumber rowLabel="Exaggeration" {...numericProps} label="Terrain exaggeration" value={terrain.exaggeration} minimum={0} maximum={10} unit="×" onCommit={change.exaggeration} />
      </ToggleSection>
      <ToggleSection title="Elevation contours" switchLabel="Show elevation contours" help={CONTOUR_HELP} checked={terrain.contours.enabled} onCheckedChange={toggleContours}>
        <TerrainNumber rowLabel="Interval" {...numericProps} label="Contour interval" value={terrain.contours.intervalMeters} minimum={10} maximum={10_000} step={10} unit="m" onCommit={contours.intervalMeters} />
        <TerrainNumber rowLabel="Line width" {...numericProps} label="Contour line width" value={terrain.contours.width} minimum={0.1} maximum={10} unit="px" onCommit={contours.width} />
        <TerrainColor value={terrain.contours.color} onChange={contourColor} />
      </ToggleSection>
      <ToggleSection title="3D buildings" switchLabel="Show 3D buildings" help={BUILDING_HELP} checked={terrain.buildings.enabled} onCheckedChange={toggleBuildings} />
      {feedback.error && <p role="alert" className="coordinate-validation">{feedback.error}</p>}
    </InspectorAccordion>
  );
}
