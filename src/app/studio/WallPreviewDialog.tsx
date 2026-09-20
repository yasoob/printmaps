import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { memo, useRef, type CSSProperties } from 'react';
import type { PageSettings } from '../../domain/project';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import type { WallSettings } from '../../domain/studio';
import { StudioColor, StudioNumber, StudioSelect, StudioToggle } from './StudioFields';
import { FeatureHelp } from '../components/FeatureHelp';
import './studioComposition.css';

export const WallPreviewDialog = memo(function WallPreviewDialog({ open, onOpenChange, wall, page, previewUrl, error, epoch = 0, onChange }: {
  open: boolean; onOpenChange: (isOpen: boolean) => void; wall: WallSettings; page: PageSettings;
  previewUrl: string | null; error?: string; epoch?: number; onChange?: (value: WallSettings) => ProjectMutationResult;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const style = {
    '--wall-color': wall.wallColor, '--mat-color': wall.matColor,
    gridTemplateColumns: `${wall.matWidthMm}fr ${page.widthMm}fr ${wall.matWidthMm}fr`,
    gridTemplateRows: `${wall.matWidthMm}fr ${page.heightMm}fr ${wall.matWidthMm}fr`,
    aspectRatio: (page.widthMm + wall.matWidthMm * 2) / (page.heightMm + wall.matWidthMm * 2),
  } as CSSProperties;
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent ref={dialogRef} initialFocus={dialogRef} className="export-dialog studio-wall-dialog" overlayClassName="export-dialog-backdrop">
      <div className="feature-help-row"><DialogTitle>On your wall</DialogTitle><FeatureHelp label="Wall preview help">Frames, mats, and walls are for presentation only. They are not added to print exports.</FeatureHelp></div>
      <DialogDescription>Preview your finished poster.</DialogDescription>
      <div className="studio-wall-scene" style={{ backgroundColor: wall.wallColor }}>
        <div className={`studio-wall-frame studio-wall-frame-${wall.frame}${wall.shadow ? ' has-shadow' : ''}`} style={style}>
          {previewUrl ? <img src={previewUrl} alt="Your finished map poster in a frame" style={{ aspectRatio: page.widthMm / page.heightMm }} /> : <p role={error ? 'alert' : 'status'}>{error || 'Preparing poster preview...'}</p>}
        </div>
        <div className="studio-wall-console" aria-hidden="true" />
      </div>
      {error && previewUrl && <p role="alert" className="studio-composition-error">{error}</p>}
      {onChange && <div className="studio-wall-controls">
        <StudioColor label="Wall color" value={wall.wallColor} onChange={(wallColor) => onChange({ ...wall, wallColor })} />
        <StudioSelect label="Frame finish" value={wall.frame} options={[{ value: 'none', label: 'Unframed' }, { value: 'black', label: 'Black' }, { value: 'white', label: 'White' }, { value: 'oak', label: 'Oak' }, { value: 'walnut', label: 'Walnut' }]} onChange={(frame) => onChange({ ...wall, frame })} />
        <StudioNumber label="Mat width" value={wall.matWidthMm} max={50} epoch={epoch} onChange={(matWidthMm) => onChange({ ...wall, matWidthMm })} />
        <StudioColor label="Mat color" value={wall.matColor} onChange={(matColor) => onChange({ ...wall, matColor })} />
        <StudioToggle label="Cast frame shadow" checked={wall.shadow} onChange={(shadow) => onChange({ ...wall, shadow })} />
      </div>}
    </DialogContent>
  </Dialog>;
});
