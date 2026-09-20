import { memo, useMemo } from 'react';
import type { ContentLayer } from '../../domain/project';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import type { DecorationSettings } from '../../domain/studio';
import { StudioColor, StudioNumber, StudioSelect, StudioToggle } from './StudioFields';
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
const qrHelp = <FeatureHelp label="Location QR code help">The white quiet zone around the code is included in every export so it can be scanned.</FeatureHelp>;

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
    <fieldset><legend>North compass</legend>
      <StudioToggle label="Show compass" checked={value.compass.enabled} onChange={compass.enabled} />
      <StudioSelect label="Compass corner" value={value.compass.position} options={POSITIONS} onChange={compass.position} />
      <StudioSelect label="Compass style" value={value.compass.style} options={STYLES} onChange={compass.style} />
      <StudioNumber label="Compass size" value={value.compass.sizeMm} min={8} max={40} epoch={epoch} onChange={compass.sizeMm} />
      <StudioColor label="Compass color" value={value.compass.color} onChange={compass.color} />
    </fieldset>
    <fieldset><legend>Ground scale</legend>
      {!isFlat && <p role="status">Scale requires pitch 0 and terrain off. Existing scale bars must be disabled before exporting a pitched map.</p>}
      <StudioToggle label="Show scale bar" checked={value.scale.enabled} disabled={!isFlat && !value.scale.enabled} onChange={scale.enabled} />
      <StudioSelect label="Scale units" value={value.scale.units} options={UNITS} onChange={scale.units} />
      <StudioSelect label="Scale corner" value={value.scale.position} options={POSITIONS} onChange={scale.position} />
      <StudioNumber label="Scale width" value={value.scale.widthMm} min={10} max={100} epoch={epoch} onChange={scale.widthMm} />
    </fieldset>
    <fieldset><legend>Coordinate grid</legend>
      <StudioToggle label="Show coordinate grid" checked={value.grid.enabled} disabled={!isFlat && !value.grid.enabled} onChange={grid.enabled} />
      <StudioNumber label="Grid interval" value={value.grid.intervalDegrees} min={0.01} max={90} unit="degrees" epoch={epoch} onChange={grid.intervalDegrees} />
      <StudioToggle label="Label grid lines" checked={value.grid.showLabels} onChange={grid.showLabels} />
      <StudioColor label="Grid color" value={value.grid.color} onChange={grid.color} />
    </fieldset>
    <fieldset><legend>Location QR code</legend>
      <div className="feature-help-row"><span>Opens Google Maps</span>{qrHelp}</div>
      <StudioToggle label="Show location QR" checked={value.qr.enabled} onChange={qr.enabled} />
      <StudioSelect label="QR destination" value={value.qr.target === 'map-center' ? '' : value.qr.layerId ?? ''} options={pointOptions} onChange={destination} />
      <StudioSelect label="QR corner" value={value.qr.position} options={POSITIONS} onChange={qr.position} />
      <StudioNumber label="QR size" value={value.qr.sizeMm} min={16} max={60} epoch={epoch} onChange={qr.sizeMm} />
    </fieldset>
  </div>;
});
