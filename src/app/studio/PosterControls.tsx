import { memo } from 'react';
import type { PosterSettings, PosterText } from '../../domain/studio';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import { StudioColor, StudioNumber, StudioSelect, StudioToggle } from './StudioFields';
import { useSettingActions } from '../hooks/useSettingActions';
import { PropertyRow } from '../components/PropertyControls';

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
  return <fieldset className="studio-composition-text">
    <legend>{label}</legend>
    <StudioToggle label={`Show ${label.toLowerCase()}`} checked={value.enabled} onChange={change.enabled} />
    {value.enabled && <>
      <PropertyRow label={`${label} text`}><input aria-label={`${label} text`} value={value.text} maxLength={label === 'Title' ? 200 : 400} onChange={(event) => change.text(event.target.value)} /></PropertyRow>
      <StudioSelect label={`${label} font`} value={value.font} options={FONTS} onChange={change.font} />
      <StudioNumber label={`${label} size`} value={value.fontSizePt} min={6} max={120} unit="pt" epoch={epoch} onChange={change.fontSizePt} />
      <StudioColor label={`${label} color`} value={value.color} onChange={change.color} />
    </>}
  </fieldset>;
});

export const PosterControls = memo(function PosterControls({ value, epoch, onChange }: {
  value: PosterSettings; epoch: number; onChange: (value: PosterSettings) => ProjectMutationResult;
}) {
  const change = useSettingActions(value, onChange, POSTER_KEYS);
  const coordinates = useSettingActions(value.coordinates, change.coordinates, COORDINATE_KEYS);
  const hasText = value.title.enabled || value.subtitle.enabled || value.caption.enabled || value.coordinates.enabled;
  return <div className="studio-composition-controls">
    {(['title', 'subtitle', 'caption'] as const).map((key) => <TextControl key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} {...value[key]} epoch={epoch} onChange={change[key]} />)}
    <fieldset className="studio-composition-text">
      <legend>Coordinates</legend>
      <StudioToggle label="Show map coordinates" checked={value.coordinates.enabled} onChange={coordinates.enabled} />
      {value.coordinates.enabled && <StudioSelect label="Coordinate format" value={value.coordinates.format} options={FORMATS} onChange={coordinates.format} />}
    </fieldset>
    {hasText && <fieldset className="studio-composition-text">
      <legend>Placement</legend>
      <StudioSelect label="Title placement" value={value.layout} options={LAYOUTS} onChange={change.layout} />
      <StudioSelect label="Text alignment" value={value.align} options={ALIGNMENTS} onChange={change.align} />
    </fieldset>}
  </div>;
});
