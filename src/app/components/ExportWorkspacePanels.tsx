import { ArrowLeft, Frame } from 'lucide-react';
import { memo, useCallback, useEffect, type CSSProperties, type RefObject } from 'react';
import type { PreviewPngExporter } from '../../export/previewPng';
import type { ReliefSettings, WallSettings } from '../../domain/studio';
import type { VideoOptions } from '../../video/types';
import { useProject, useProjectActions } from '../projectStoreContext';
import { useReadMapExporter } from '../mapExporterContext';
import { useMutationFeedback } from '../hooks/useMutationFeedback';
import { useStableEvent } from '../hooks/useStableEvent';
import { useWallPreview } from '../studio/useWallPreview';
import { WallPreviewPanel, WallSettingsControls } from '../studio/WallPreviewDialog';
import { VideoExportPanel } from './VideoExportDialog';
import { ReliefExportPanel } from './ReliefExportDialog';

type OutputPanelProps = {
  exporter: PreviewPngExporter | null;
  filename: string;
  blockedReason?: string;
  onClose: () => void;
  onBusyChange: (isBusy: boolean) => void;
};

export function VideoWorkspacePanel(props: OutputPanelProps) {
  const document = useProject((state) => state.document);
  const { setStudioSection } = useProjectActions();
  const feedback = useMutationFeedback(document.studio.video);
  const onSettingsChange = useStableEvent((settings: VideoOptions) => {
    feedback.report(setStudioSection('video', settings));
  });
  return <VideoExportPanel {...props} document={document} settings={document.studio.video}
    blockedReason={props.blockedReason || feedback.error || undefined} onSettingsChange={onSettingsChange} />;
}

export function ReliefWorkspacePanel(props: OutputPanelProps) {
  const settings = useProject((state) => state.document.studio.relief);
  const layers = useProject((state) => state.document.layers);
  const documentEpoch = useProject((state) => state.documentEpoch);
  const { setStudioSection } = useProjectActions();
  const onChange = useCallback((value: ReliefSettings) => setStudioSection('relief', value), [setStudioSection]);
  return <ReliefExportPanel {...props} settings={settings} layers={layers} documentEpoch={documentEpoch} onChange={onChange} />;
}

export const ExportPreviewPane = memo(function ExportPreviewPane({ exporter, blockedReason, framed, canFrame, disabled, onPreviewWall }: Pick<OutputPanelProps, 'exporter' | 'blockedReason'> & {
  framed: boolean;
  canFrame: boolean;
  disabled: boolean;
  onPreviewWall: () => void;
}) {
  const readExporter = useReadMapExporter(exporter);
  const { wall, previewUrl, error, open } = useWallPreview(readExporter, blockedReason);
  const page = useProject((state) => state.document.page);
  useEffect(() => { void open(); }, [open]);
  const ratio = page.widthMm / page.heightMm;
  return <div className="export-preview" data-framed={framed}>
    {framed ? <WallPreviewPanel wall={wall} page={page} previewUrl={previewUrl} error={error} /> : <div className="export-poster-stage" style={{ '--poster-ratio': ratio } as CSSProperties}>
      {previewUrl
        ? <img className="export-poster-image" src={previewUrl} alt="Preview of your poster" />
        : <p className="export-preview-message">{error || 'Preparing poster preview…'}</p>}
    </div>}
    {canFrame && !framed && <button type="button" className="export-preview-wall" disabled={disabled} onClick={onPreviewWall}>
      <Frame size={14} strokeWidth={1.8} aria-hidden="true" />Preview on wall
    </button>}
  </div>;
});

export const WallSettingsPanel = memo(function WallSettingsPanel({ backRef, disabled, onBack }: {
  backRef: RefObject<HTMLButtonElement | null>;
  disabled: boolean;
  onBack: () => void;
}) {
  const wall = useProject((state) => state.document.studio.wall);
  const epoch = useProject((state) => state.documentEpoch);
  const { setStudioSection } = useProjectActions();
  const feedback = useMutationFeedback(wall);
  const onChange = useStableEvent((value: WallSettings) => feedback.report(setStudioSection('wall', value)));
  useEffect(() => { backRef.current?.focus(); }, [backRef]);
  return <>
    <button ref={backRef} type="button" className="export-back-button" disabled={disabled} onClick={onBack}>
      <ArrowLeft size={14} strokeWidth={1.8} aria-hidden="true" />Back to export
    </button>
    <WallSettingsControls wall={wall} epoch={epoch} error={feedback.error} onChange={onChange} />
  </>;
});
