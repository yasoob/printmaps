import type { PosterSettings, PosterText } from '../../domain/studio';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import { StudioColor, StudioNumber, StudioSelect, StudioToggle } from './StudioFields';

const FONTS = [{ value: 'sans', label: 'Modern sans' }, { value: 'serif', label: 'Classic serif' }, { value: 'mono', label: 'Field notes mono' }] as const;

function TextControl({ label, value, epoch, onChange }: {
  label: string; value: PosterText; epoch: number; onChange: (value: PosterText) => ProjectMutationResult;
}) {
  return <fieldset className="studio-composition-text">
    <legend>{label}</legend>
    <StudioToggle label={`Show ${label.toLowerCase()}`} checked={value.enabled} onChange={(enabled) => onChange({ ...value, enabled })} />
    <label className="studio-composition-field"><span>{label} text</span><input aria-label={`${label} text`} value={value.text} maxLength={label === 'Title' ? 200 : 400} onChange={(event) => onChange({ ...value, text: event.target.value })} /></label>
    <StudioSelect label={`${label} font`} value={value.font} options={FONTS} onChange={(font) => onChange({ ...value, font })} />
    <StudioNumber label={`${label} size`} value={value.fontSizePt} min={6} max={120} unit="pt" epoch={epoch} onChange={(fontSizePt) => onChange({ ...value, fontSizePt })} />
    <StudioColor label={`${label} color`} value={value.color} onChange={(color) => onChange({ ...value, color })} />
  </fieldset>;
}

export function PosterControls({ value, epoch, onChange }: {
  value: PosterSettings; epoch: number; onChange: (value: PosterSettings) => ProjectMutationResult;
}) {
  return <div className="studio-composition-controls">
    <StudioToggle label="Enable poster composition" checked={value.enabled} onChange={(enabled) => onChange({ ...value, enabled })} />
    <StudioSelect label="Title placement" value={value.layout} options={[{ value: 'top', label: 'Above the map' }, { value: 'bottom', label: 'Below the map' }, { value: 'overlay', label: 'Over the map' }]} onChange={(layout) => onChange({ ...value, layout })} />
    <StudioSelect label="Text alignment" value={value.align} options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]} onChange={(align) => onChange({ ...value, align })} />
    <StudioColor label="Paper color" value={value.backgroundColor} onChange={(backgroundColor) => onChange({ ...value, backgroundColor })} />
    {(['title', 'subtitle', 'caption'] as const).map((key) => <TextControl key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} value={value[key]} epoch={epoch} onChange={(text) => onChange({ ...value, [key]: text })} />)}
    <StudioToggle label="Show map coordinates" checked={value.coordinates.enabled} onChange={(enabled) => onChange({ ...value, coordinates: { ...value.coordinates, enabled } })} />
    <StudioSelect label="Coordinate format" value={value.coordinates.format} options={[{ value: 'decimal', label: 'Decimal degrees' }, { value: 'dms', label: 'Degrees, minutes, seconds' }]} onChange={(format) => onChange({ ...value, coordinates: { ...value.coordinates, format } })} />
    <fieldset><legend>Paper margins</legend>
      {(['top', 'right', 'bottom', 'left'] as const).map((side) => <StudioNumber key={side} label={`${side.charAt(0).toUpperCase() + side.slice(1)} margin`} value={value.marginsMm[side]} epoch={epoch} onChange={(number) => onChange({ ...value, marginsMm: { ...value.marginsMm, [side]: number } })} />)}
    </fieldset>
  </div>;
}
