import { memo, useCallback, type RefObject } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { StudioDialogActions, StudioDialogBody, StudioDialogButton, StudioDialogFeedback, StudioDialogHeader } from '@/components/ui/studio-dialog';
import type { VideoOptions, VideoPlan, VideoProgress } from '../../video/types';
import { VideoExportSettings } from './VideoExportSettings';
import { FeatureHelp } from './FeatureHelp';

type Props = Readonly<{
  busy: boolean;
  unavailable: string | false | null | undefined;
  settings: VideoOptions;
  onSettingsChange: (settings: VideoOptions) => void;
  plan: VideoPlan | null;
  progress: VideoProgress | null;
  status: string;
  error: string | null;
  cancelRef: RefObject<HTMLButtonElement | null>;
  downloadRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onCancel: () => void;
  onDownload: () => void;
}>;

function progressLabel(progress: VideoProgress | null): string {
  if (!progress || progress.phase === 'preparing') return 'Preparing isolated map and composition…';
  if (progress.phase === 'finalizing') return 'Finalizing and verifying MP4…';
  return `Recording ${Math.floor(progress.fraction * 100)}% · ${progress.presentedFrames} frames presented · ${progress.missedFrameSlots} target slots missed`;
}

function VideoExportMessages({ busy, progress, status, error }: Pick<Props, 'busy' | 'progress' | 'status' | 'error'>) {
  return <StudioDialogFeedback hidden={!busy && !status && !error}>
    {busy ? <progress aria-label="Video export progress" max={1} value={progress?.fraction ?? 0} /> : null}
    <p role="status" className="video-export-status">{busy ? `${progressLabel(progress)} Keep this tab visible.` : status}</p>
    {error ? <p role="alert" className="export-error">{error}</p> : null}
  </StudioDialogFeedback>;
}

const VideoExportHelp = memo(function VideoExportHelp() {
  return <FeatureHelp label="Video recording help">
    <p>Real-time recording is best-effort, not fixed frame rate. Slow tiles or devices can repeat frames. Keep this tab visible while recording.</p>
    <p>Frame counts and fps measure presented frames, not encoded frames. Encoder frame drops are not measurable with MediaRecorder.</p>
    <p>The video uses an isolated poster snapshot. The editor camera and undo history are not animated.</p>
  </FeatureHelp>;
});

const videoHeader = <StudioDialogHeader>
        <div>
          <DialogTitle>Export map video</DialogTitle>
          <DialogDescription>MP4 video of your poster.</DialogDescription>
        </div>
      </StudioDialogHeader>;

const VideoExportActions = memo(function VideoExportActions({ busy, completed, unavailable, cancelRef, downloadRef, onCancel, onClose, onDownload }: Pick<Props, 'busy' | 'unavailable' | 'cancelRef' | 'downloadRef' | 'onCancel' | 'onClose' | 'onDownload'> & { completed: boolean }) {
  return <StudioDialogActions>
    <StudioDialogButton ref={cancelRef} onClick={busy ? onCancel : onClose}>{busy ? 'Cancel recording' : (completed ? 'Done' : 'Cancel')}</StudioDialogButton>
    <StudioDialogButton ref={downloadRef} variant="primary" disabled={busy || !!unavailable} onClick={onDownload}>{busy ? 'Recording…' : 'Download MP4'}</StudioDialogButton>
  </StudioDialogActions>;
});

export function VideoExportDialogView(props: Props) {
  const { busy, unavailable, cancelRef, downloadRef, onClose } = props;
  const onOpenChange = useCallback((isOpen: boolean) => { if (!isOpen) onClose(); }, [onClose]);
  return <Dialog open onOpenChange={onOpenChange}>
    <DialogContent className="export-dialog video-export-dialog" overlayClassName="export-dialog-backdrop" showCloseButton={false} initialFocus={unavailable ? cancelRef : downloadRef} aria-busy={busy}>
      {videoHeader}
      <VideoExportPanelView {...props} />
    </DialogContent>
  </Dialog>;
}

export function VideoExportPanelView(props: Props) {
  const { busy, unavailable, settings, onSettingsChange, plan, progress, status, error, cancelRef, downloadRef, onClose, onCancel, onDownload } = props;
  return <>
      <VideoExportMessages busy={busy} progress={progress} status={status} error={error} />
      <StudioDialogBody className="export-dialog-body">
        {unavailable && !busy ? <div role="alert" className="export-notice is-warning"><strong>Video export unavailable</strong><p>{unavailable}</p></div> : null}
        <div className="export-panel-heading">
          <div className="feature-help-row"><h3 className="export-panel-title">MP4 video</h3><VideoExportHelp /></div>
          {plan ? <p className="video-export-output"><strong>{plan.width} × {plan.height} px</strong> · {settings.durationSeconds} seconds · {settings.fps} fps target</p> : null}
        </div>
        <VideoExportSettings settings={settings} busy={busy} onChange={onSettingsChange} />
      </StudioDialogBody>
      <VideoExportActions busy={busy} completed={status.startsWith('MP4 download started')} unavailable={unavailable} cancelRef={cancelRef} downloadRef={downloadRef} onCancel={onCancel} onClose={onClose} onDownload={onDownload} />
  </>;
}
