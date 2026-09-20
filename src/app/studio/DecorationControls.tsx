import type { ContentLayer } from '../../domain/project';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import type { DecorationSettings } from '../../domain/studio';
import { StudioColor, StudioNumber, StudioSelect, StudioToggle } from './StudioFields';
import { FeatureHelp } from '../components/FeatureHelp';

const POSITIONS = [
  { value: 'top-left', label: 'Top left' }, { value: 'top-right', label: 'Top right' },
  { value: 'bottom-left', label: 'Bottom left' }, { value: 'bottom-right', label: 'Bottom right' },
] as const;

export function DecorationControls({ value, epoch, pointLayers, isFlat, onChange }: {
  value: DecorationSettings; epoch: number; pointLayers: readonly ContentLayer[]; isFlat: boolean;
  onChange: (value: DecorationSettings) => ProjectMutationResult;
}) {
  return <div className="studio-composition-controls">
    <fieldset><legend>North compass</legend>
      <StudioToggle label="Show compass" checked={value.compass.enabled} onChange={(enabled) => onChange({ ...value, compass: { ...value.compass, enabled } })} />
      <StudioSelect label="Compass corner" value={value.compass.position} options={POSITIONS} onChange={(position) => onChange({ ...value, compass: { ...value.compass, position } })} />
      <StudioSelect label="Compass style" value={value.compass.style} options={[{ value: 'arrow', label: 'Arrow' }, { value: 'rose', label: 'Rose' }]} onChange={(style) => onChange({ ...value, compass: { ...value.compass, style } })} />
      <StudioNumber label="Compass size" value={value.compass.sizeMm} min={8} max={40} epoch={epoch} onChange={(sizeMm) => onChange({ ...value, compass: { ...value.compass, sizeMm } })} />
      <StudioColor label="Compass color" value={value.compass.color} onChange={(color) => onChange({ ...value, compass: { ...value.compass, color } })} />
    </fieldset>
    <fieldset><legend>Ground scale</legend>
      {!isFlat && <p role="status">Scale requires pitch 0 and terrain off. Existing scale bars must be disabled before exporting a pitched map.</p>}
      <StudioToggle label="Show scale bar" checked={value.scale.enabled} disabled={!isFlat && !value.scale.enabled} onChange={(enabled) => onChange({ ...value, scale: { ...value.scale, enabled } })} />
      <StudioSelect label="Scale units" value={value.scale.units} options={[{ value: 'metric', label: 'Metric' }, { value: 'imperial', label: 'Imperial' }]} onChange={(units) => onChange({ ...value, scale: { ...value.scale, units } })} />
      <StudioSelect label="Scale corner" value={value.scale.position} options={POSITIONS} onChange={(position) => onChange({ ...value, scale: { ...value.scale, position } })} />
      <StudioNumber label="Scale width" value={value.scale.widthMm} min={10} max={100} epoch={epoch} onChange={(widthMm) => onChange({ ...value, scale: { ...value.scale, widthMm } })} />
    </fieldset>
    <fieldset><legend>Coordinate grid</legend>
      <StudioToggle label="Show coordinate grid" checked={value.grid.enabled} disabled={!isFlat && !value.grid.enabled} onChange={(enabled) => onChange({ ...value, grid: { ...value.grid, enabled } })} />
      <StudioNumber label="Grid interval" value={value.grid.intervalDegrees} min={0.01} max={90} unit="degrees" epoch={epoch} onChange={(intervalDegrees) => onChange({ ...value, grid: { ...value.grid, intervalDegrees } })} />
      <StudioToggle label="Label grid lines" checked={value.grid.showLabels} onChange={(showLabels) => onChange({ ...value, grid: { ...value.grid, showLabels } })} />
      <StudioColor label="Grid color" value={value.grid.color} onChange={(color) => onChange({ ...value, grid: { ...value.grid, color } })} />
    </fieldset>
    <fieldset><legend>Location QR code</legend>
      <div className="feature-help-row"><span>Opens Google Maps</span><FeatureHelp label="Location QR code help">The white quiet zone around the code is included in every export so it can be scanned.</FeatureHelp></div>
      <StudioToggle label="Show location QR" checked={value.qr.enabled} onChange={(enabled) => onChange({ ...value, qr: { ...value.qr, enabled } })} />
      <StudioSelect label="QR destination" value={value.qr.target === 'map-center' ? '' : value.qr.layerId ?? ''} options={[{ value: '', label: 'Current map center' }, ...pointLayers.map((layer) => ({ value: layer.id, label: layer.name }))]} onChange={(layerId) => onChange({ ...value, qr: { ...value.qr, target: layerId ? 'layer' : 'map-center', layerId: layerId || null } })} />
      <StudioSelect label="QR corner" value={value.qr.position} options={POSITIONS} onChange={(position) => onChange({ ...value, qr: { ...value.qr, position } })} />
      <StudioNumber label="QR size" value={value.qr.sizeMm} min={16} max={60} epoch={epoch} onChange={(sizeMm) => onChange({ ...value, qr: { ...value.qr, sizeMm } })} />
    </fieldset>
  </div>;
}
