import { memo, useMemo } from 'react';
import type { ContentLayer } from '../../domain/project';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import type { DecorationSettings } from '../../domain/studio';
import { StudioColor, StudioNumber, StudioSelect } from './StudioFields';
import { ToggleSection } from '../../components/ui/toggle-section';
import { Notice } from '../../components/ui/notice';
import { Switch } from '../components/UiControls';
import { FeatureHelp } from '../components/FeatureHelp';
import { useSettingActions } from '../hooks/useSettingActions';
import { useStableEvent } from '../hooks/useStableEvent';

const POSITIONS = [
  { value: 'top-left', label: 'Top left' }, { value: 'top-right', label: 'Top right' },
  { value: 'bottom-left', label: 'Bottom left' }, { value: 'bottom-right', label: 'Bottom right' },
] as const;
const STYLES = [{ value: 'arrow', label: 'Arrow' }, { value: 'rose', label: 'Rose' }] as const;
const UNITS = [{ value: 'metric', label: 'Metric' }, { value: 'imperial', label: 'Imperial' }] as const;
const DECORATION_KEYS = ['compass', 'scale', 'grid', 'qr'] as const;
const COMPASS_KEYS = ['enabled', 'position', 'style', 'sizeMm', 'color'] as const;
const SCALE_KEYS = ['enabled', 'units', 'position', 'widthMm'] as const;
const GRID_KEYS = ['enabled', 'intervalDegrees', 'showLabels', 'color'] as const;
const QR_KEYS = ['enabled', 'position', 'sizeMm'] as const;
const qrHelp = <FeatureHelp label="Location QR code help">Scanning opens the location in Google Maps. The white quiet zone around the code is included in every export so it can be scanned.</FeatureHelp>;

export const DecorationControls = memo(function DecorationControls({ value, epoch, pointLayers, isFlat, onChange }: {
  value: DecorationSettings; epoch: number; pointLayers: readonly Pick<ContentLayer, 'id' | 'name'>[]; isFlat: boolean;
  onChange: (value: DecorationSettings) => ProjectMutationResult;
}) {
  const change = useSettingActions(value, onChange, DECORATION_KEYS);
  const compass = useSettingActions(value.compass, change.compass, COMPASS_KEYS);
  const scale = useSettingActions(value.scale, change.scale, SCALE_KEYS);
  const grid = useSettingActions(value.grid, change.grid, GRID_KEYS);
  const qr = useSettingActions(value.qr, change.qr, QR_KEYS);
  const pointOptions = useMemo(() => [{ value: '', label: 'Current map center' }, ...pointLayers.map((layer) => ({ value: layer.id, label: layer.name }))], [pointLayers]);
  const destination = useStableEvent((layerId: string) => change.qr({ ...value.qr, target: layerId ? 'layer' : 'map-center', layerId: layerId || null }));
  return <div className="studio-composition-controls">
    <ToggleSection title="North compass" switchLabel="Show compass" checked={value.compass.enabled} onCheckedChange={compass.enabled}>
      <StudioSelect label="Compass corner" rowLabel="Corner" value={value.compass.position} options={POSITIONS} onChange={compass.position} />
      <StudioSelect label="Compass style" rowLabel="Style" value={value.compass.style} options={STYLES} onChange={compass.style} />
      <StudioNumber label="Compass size" rowLabel="Size" value={value.compass.sizeMm} min={8} max={40} epoch={epoch} onChange={compass.sizeMm} />
      <StudioColor label="Compass color" rowLabel="Color" value={value.compass.color} onChange={compass.color} />
    </ToggleSection>
    {!isFlat && <Notice tone="warning" className="studio-composition-notice">Scale bars and grids need pitch 0 and terrain off. Turn existing ones off before exporting a pitched map.</Notice>}
    <ToggleSection title="Ground scale" switchLabel="Show scale bar" checked={value.scale.enabled} disabled={!isFlat && !value.scale.enabled} onCheckedChange={scale.enabled}>
      <StudioSelect label="Scale units" rowLabel="Units" value={value.scale.units} options={UNITS} onChange={scale.units} />
      <StudioSelect label="Scale corner" rowLabel="Corner" value={value.scale.position} options={POSITIONS} onChange={scale.position} />
      <StudioNumber label="Scale width" rowLabel="Width" value={value.scale.widthMm} min={10} max={100} epoch={epoch} onChange={scale.widthMm} />
    </ToggleSection>
    <ToggleSection title="Coordinate grid" switchLabel="Show coordinate grid" checked={value.grid.enabled} disabled={!isFlat && !value.grid.enabled} onCheckedChange={grid.enabled}>
      <StudioNumber label="Grid interval" rowLabel="Interval" value={value.grid.intervalDegrees} min={0.01} max={90} unit="°" epoch={epoch} onChange={grid.intervalDegrees} />
      <StudioColor label="Grid color" rowLabel="Color" value={value.grid.color} onChange={grid.color} />
      <Switch label="Label grid lines" labelPlacement="start" isChecked={value.grid.showLabels} onCheckedChange={grid.showLabels} />
    </ToggleSection>
    <ToggleSection title="Location QR code" switchLabel="Show location QR" help={qrHelp} checked={value.qr.enabled} onCheckedChange={qr.enabled}>
      <StudioSelect label="QR destination" rowLabel="Opens" value={value.qr.target === 'map-center' ? '' : value.qr.layerId ?? ''} options={pointOptions} onChange={destination} />
      <StudioSelect label="QR corner" rowLabel="Corner" value={value.qr.position} options={POSITIONS} onChange={qr.position} />
      <StudioNumber label="QR size" rowLabel="Size" value={value.qr.sizeMm} min={16} max={60} epoch={epoch} onChange={qr.sizeMm} />
    </ToggleSection>
  </div>;
});
