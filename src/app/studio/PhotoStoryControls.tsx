import { memo, useMemo, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import type { ContentLayer } from '../../domain/project';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import type { PhotoSettings } from '../../domain/studio';
import { StudioColor, StudioNumber, StudioSelect } from './StudioFields';
import { Button } from '../../components/ui/button';
import { Notice } from '../../components/ui/notice';
import { ToggleSection } from '../../components/ui/toggle-section';
import { Switch } from '../components/UiControls';
import { FeatureHelp } from '../components/FeatureHelp';
import { useSettingActions } from '../hooks/useSettingActions';
import { Input } from '../../components/ui/input';
import { IconTooltip } from '../components/IconTooltip';

export type PhotoUpload = (file: File, layerId: string | null, expectedDocumentEpoch: number) => Promise<ProjectMutationResult>;
const PHOTO_KEYS = ['map', 'strip'] as const;
const MAP_KEYS = ['enabled', 'shape', 'sizeMm', 'borderColor'] as const;
const STRIP_KEYS = ['enabled', 'position', 'heightMm', 'showCaptions'] as const;
const SHAPES = [{ value: 'circle', label: 'Circle' }, { value: 'square', label: 'Square' }] as const;
const POSITIONS = [{ value: 'top', label: 'Top' }, { value: 'bottom', label: 'Bottom' }] as const;
const photoHelp = <FeatureHelp label="Local photo help">
  <p>Photos stay on this device and inside your project file. PNG or JPEG, up to 1 MiB and 2048 pixels per side. Photos are center-cropped, never stretched.</p>
  <p>Move or hide a point with the map tools. Removing a photo keeps its point; deleting a point removes its photo.</p>
</FeatureHelp>;

export const PhotoStoryControls = memo(function PhotoStoryControls({ value, pointLayers, epoch, onChange, onUpload, onRemove }: {
  value: PhotoSettings; pointLayers: readonly Pick<ContentLayer, 'id' | 'name'>[]; epoch: number;
  onChange: (value: PhotoSettings) => ProjectMutationResult; onUpload: PhotoUpload; onRemove: (id: string) => ProjectMutationResult;
}) {
  const [selectedLayer, setSelectedLayer] = useState('');
  const [isUploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const change = useSettingActions(value, onChange, PHOTO_KEYS);
  const map = useSettingActions(value.map, change.map, MAP_KEYS);
  const strip = useSettingActions(value.strip, change.strip, STRIP_KEYS);
  const pointOptions = useMemo(() => [{ value: '', label: 'New pin at center' }, ...pointLayers.map((layer) => ({ value: layer.id, label: layer.name }))], [pointLayers]);
  async function upload(file: File) {
    setError('');
    setUploading(true);
    try {
      const result = await onUpload(file, selectedLayer || null, epoch);
      if (!result.ok) setError(result.error);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'The photo could not be added.');
    } finally {
      setUploading(false);
    }
  }
  return <div className="studio-composition-controls">
    <StudioSelect label="Attach photo to" rowLabel="Attach to" value={selectedLayer} options={pointOptions} onChange={setSelectedLayer} />
    <input ref={input} className="sr-only" type="file" accept="image/png,image/jpeg" aria-label="Upload story photo" disabled={isUploading} onChange={(event) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      if (file) void upload(file);
    }} />
    <div className="feature-help-row studio-photo-add">
      <Button variant="secondary" busy={isUploading} onClick={() => input.current?.click()}>
        {!isUploading && <ImagePlus aria-hidden="true" />}{isUploading ? 'Adding photo...' : 'Add local photo'}
      </Button>
      {photoHelp}
    </div>
    {error && <Notice tone="error" className="studio-composition-notice">{error}</Notice>}
    {value.stops.length > 0 && <ol className="studio-photo-list">{value.stops.map((stop, index) => <li key={stop.id}>
      <img src={value.assets[stop.assetId]?.dataUri} alt="" />
      <Input aria-label={`Stop ${index + 1} caption`} placeholder={`Caption for photo ${index + 1}`} maxLength={200} value={stop.caption} onChange={(event) => onChange({ ...value, stops: value.stops.map((candidate) => candidate.id === stop.id ? { ...candidate, caption: event.target.value } : candidate) })} />
      <IconTooltip label="Remove photo"><Button variant="ghost" size="icon" aria-label={`Remove photo ${index + 1}`} onClick={() => {
        const result = onRemove(stop.id);
        setError(result.ok ? '' : result.error);
      }}><Trash2 aria-hidden="true" /></Button></IconTooltip>
    </li>)}</ol>}
    <ToggleSection title="Photos on the map" switchLabel="Show anchored photos" checked={value.map.enabled} onCheckedChange={map.enabled}>
      <StudioSelect label="Photo shape" rowLabel="Shape" value={value.map.shape} options={SHAPES} onChange={map.shape} />
      <StudioNumber label="Photo size" rowLabel="Size" value={value.map.sizeMm} min={5} max={100} epoch={epoch} onChange={map.sizeMm} />
      <StudioColor label="Photo border" rowLabel="Border" value={value.map.borderColor} onChange={map.borderColor} />
    </ToggleSection>
    <ToggleSection title="Numbered photo strip" switchLabel="Show numbered photo strip" checked={value.strip.enabled} onCheckedChange={strip.enabled}>
      <StudioSelect label="Strip position" rowLabel="Position" value={value.strip.position} options={POSITIONS} onChange={strip.position} />
      <StudioNumber label="Strip height" rowLabel="Height" value={value.strip.heightMm} min={12} max={100} epoch={epoch} onChange={strip.heightMm} />
      <Switch label="Show photo captions" labelPlacement="start" isChecked={value.strip.showCaptions} onCheckedChange={strip.showCaptions} />
    </ToggleSection>
  </div>;
});
