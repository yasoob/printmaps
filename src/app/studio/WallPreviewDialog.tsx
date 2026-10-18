import { memo, type CSSProperties } from 'react';
import type { PageSettings } from '../../domain/project';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import type { WallSettings } from '../../domain/studio';
import { StudioColor, StudioNumber, StudioSelect } from './StudioFields';
import { Switch } from '../components/UiControls';
import { Notice } from '@/components/ui/notice';
import { FeatureHelp } from '../components/FeatureHelp';
import './studioComposition.css';

const FRAME_FINISHES = [
  { value: 'none', label: 'Unframed' }, { value: 'black', label: 'Black' }, { value: 'white', label: 'White' },
  { value: 'oak', label: 'Oak' }, { value: 'walnut', label: 'Walnut' },
] as const;

export const WallPreviewPanel = memo(function WallPreviewPanel({ wall, page, previewUrl, error }: {
  wall: WallSettings; page: PageSettings; previewUrl: string | null; error?: string;
}) {
  const style = {
    '--wall-color': wall.wallColor, '--mat-color': wall.matColor,
    '--frame-ratio': (page.widthMm + wall.matWidthMm * 2) / (page.heightMm + wall.matWidthMm * 2),
    gridTemplateColumns: `${wall.matWidthMm}fr ${page.widthMm}fr ${wall.matWidthMm}fr`,
    gridTemplateRows: `${wall.matWidthMm}fr ${page.heightMm}fr ${wall.matWidthMm}fr`,
    aspectRatio: (page.widthMm + wall.matWidthMm * 2) / (page.heightMm + wall.matWidthMm * 2),
  } as CSSProperties;
  return <div className="studio-wall-scene" style={{ backgroundColor: wall.wallColor }}>
    <div className={`studio-wall-frame studio-wall-frame-${wall.frame}${wall.shadow ? ' has-shadow' : ''}`} style={style}>
      {previewUrl
        ? <img src={previewUrl} alt="Your finished map poster in a frame" style={{ aspectRatio: page.widthMm / page.heightMm }} />
        : <p className="export-preview-message" role={error ? 'alert' : undefined}>{error || 'Preparing poster preview…'}</p>}
    </div>
  </div>;
});

export const WallSettingsControls = memo(function WallSettingsControls({ wall, epoch, error, onChange }: {
  wall: WallSettings; epoch: number; error?: string | null; onChange: (value: WallSettings) => ProjectMutationResult;
}) {
  return <>
    <div className="feature-help-row export-panel-heading"><h3 className="export-panel-title">On your wall</h3><FeatureHelp label="Wall preview help">Frames, mats, and walls are for presentation only. They are not added to print exports.</FeatureHelp></div>
    <div className="studio-wall-controls">
      <StudioSelect label="Frame finish" value={wall.frame} options={FRAME_FINISHES} onChange={(frame) => onChange({ ...wall, frame })} />
      <StudioNumber label="Mat width" value={wall.matWidthMm} max={50} epoch={epoch} onChange={(matWidthMm) => onChange({ ...wall, matWidthMm })} />
      <StudioColor label="Mat color" value={wall.matColor} onChange={(matColor) => onChange({ ...wall, matColor })} />
      <StudioColor label="Wall color" value={wall.wallColor} onChange={(wallColor) => onChange({ ...wall, wallColor })} />
      <Switch className="studio-wall-shadow" label="Cast frame shadow" labelPlacement="start" isChecked={wall.shadow} onCheckedChange={(shadow) => onChange({ ...wall, shadow })} />
    </div>
    {error && <Notice tone="error">{error}</Notice>}
  </>;
});
