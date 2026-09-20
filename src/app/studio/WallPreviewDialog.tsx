import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { CSSProperties } from 'react';
import type { PageSettings } from '../../domain/project';
import type { ProjectMutationResult } from '../../domain/projectMutation';
import type { WallSettings } from '../../domain/studio';
import { StudioColor, StudioNumber, StudioSelect, StudioToggle } from './StudioFields';
import './studioComposition.css';

export function WallPreviewDialog({ open, onOpenChange, wall, page, previewUrl, error, epoch = 0, onChange }: {
  open: boolean; onOpenChange: (isOpen: boolean) => void; wall: WallSettings; page: PageSettings;
  previewUrl: string | null; error?: string; epoch?: number; onChange?: (value: WallSettings) => ProjectMutationResult;
}) {
  const style = {
    '--wall-color': wall.wallColor, '--mat-color': wall.matColor,
    '--mat-padding': `${wall.matWidthMm / page.widthMm * 100}%`,
    aspectRatio: page.widthMm / page.heightMm,
  } as CSSProperties;
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="studio-wall-dialog">
      <DialogTitle>On your wall</DialogTitle>
      <DialogDescription>A presentation preview of your finished poster. Frames, mats, and walls are not added to print exports.</DialogDescription>
      <div className="studio-wall-scene" style={{ backgroundColor: wall.wallColor }}>
        <div className={`studio-wall-frame studio-wall-frame-${wall.frame}${wall.shadow ? ' has-shadow' : ''}`} style={style}>
          {previewUrl ? <img src={previewUrl} alt="Your finished map poster in a frame" style={{ aspectRatio: page.widthMm / page.heightMm }} /> : <p role="status">{error || 'Preparing poster preview...'}</p>}
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
}
