import { memo } from 'react';
import type { PosterSettings, PosterText } from '../../domain/studio';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import { StudioColor, StudioNumber, StudioSelect } from './StudioFields';
import { ToggleSection } from '../../components/ui/toggle-section';
import { useSettingActions } from '../hooks/useSettingActions';
import { PropertyRow, PropertySubheading } from '../components/PropertyControls';
import { Input } from '../../components/ui/input';

const FONTS = [{ value: 'sans', label: 'Modern sans' }, { value: 'serif', label: 'Classic serif' }, { value: 'mono', label: 'Field notes mono' }] as const;
const LAYOUTS = [{ value: 'top', label: 'Above the map' }, { value: 'bottom', label: 'Below the map' }, { value: 'overlay', label: 'Over the map' }] as const;
const ALIGNMENTS = [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }] as const;
const FORMATS = [{ value: 'decimal', label: 'Decimal degrees' }, { value: 'dms', label: 'Degrees, minutes, seconds' }] as const;
const TEXT_KEYS = ['enabled', 'text', 'font', 'fontSizePt', 'color'] as const;
const POSTER_KEYS = ['layout', 'align', 'title', 'subtitle', 'caption', 'coordinates'] as const;
const COORDINATE_KEYS = ['enabled', 'format'] as const;

const TextControl = memo(function TextControl({ label, epoch, onChange, ...value }: PosterText & {
  label: string; epoch: number; onChange: (value: PosterText) => ProjectMutationResult;
}) {
  const change = useSettingActions(value, onChange, TEXT_KEYS);
  return <ToggleSection title={label} switchLabel={`Show ${label.toLowerCase()}`} checked={value.enabled} onCheckedChange={change.enabled}>
    <PropertyRow label="Text"><Input aria-label={`${label} text`} placeholder={`Add a ${label.toLowerCase()}`} value={value.text} maxLength={label === 'Title' ? 200 : 400} onChange={(event) => change.text(event.target.value)} /></PropertyRow>
    <StudioSelect label={`${label} font`} rowLabel="Font" value={value.font} options={FONTS} onChange={change.font} />
    <StudioNumber label={`${label} size`} rowLabel="Size" value={value.fontSizePt} min={6} max={120} unit="pt" epoch={epoch} onChange={change.fontSizePt} />
    <StudioColor label={`${label} color`} rowLabel="Color" value={value.color} onChange={change.color} />
  </ToggleSection>;
});

export const PosterControls = memo(function PosterControls({ value, epoch, onChange }: {
  value: PosterSettings; epoch: number; onChange: (value: PosterSettings) => ProjectMutationResult;
}) {
  const change = useSettingActions(value, onChange, POSTER_KEYS);
  const coordinates = useSettingActions(value.coordinates, change.coordinates, COORDINATE_KEYS);
  const hasText = value.title.enabled || value.subtitle.enabled || value.caption.enabled || value.coordinates.enabled;
  return <div className="studio-composition-controls">
    {(['title', 'subtitle', 'caption'] as const).map((key) => <TextControl key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} {...value[key]} epoch={epoch} onChange={change[key]} />)}
    <ToggleSection title="Coordinates" switchLabel="Show map coordinates" checked={value.coordinates.enabled} onCheckedChange={coordinates.enabled}>
      <StudioSelect label="Coordinate format" rowLabel="Format" value={value.coordinates.format} options={FORMATS} onChange={coordinates.format} />
    </ToggleSection>
    {hasText && <>
      <PropertySubheading>Placement</PropertySubheading>
      <StudioSelect label="Title placement" rowLabel="Position" value={value.layout} options={LAYOUTS} onChange={change.layout} />
      <StudioSelect label="Text alignment" rowLabel="Alignment" value={value.align} options={ALIGNMENTS} onChange={change.align} />
    </>}
  </div>;
});
