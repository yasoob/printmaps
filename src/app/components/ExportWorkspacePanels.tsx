import { useCallback, useEffect } from 'react';
import type { PreviewPngExporter } from '../../export/previewPng';
import type { ReliefSettings, WallSettings } from '../../domain/studio';
import type { VideoOptions } from '../../video/types';
import { useProject, useProjectActions } from '../projectStoreContext';
import { useReadMapExporter } from '../mapExporterContext';
import { useMutationFeedback } from '../hooks/useMutationFeedback';
import { useStableEvent } from '../hooks/useStableEvent';
import { useWallPreview } from '../studio/useWallPreview';
import { WallPreviewPanel } from '../studio/WallPreviewDialog';
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

export function WallWorkspacePanel({ exporter, blockedReason }: Pick<OutputPanelProps, 'exporter' | 'blockedReason'>) {
  const readExporter = useReadMapExporter(exporter);
  const preview = useWallPreview(readExporter, blockedReason);
  const page = useProject((state) => state.document.page);
  const epoch = useProject((state) => state.documentEpoch);
  const { setStudioSection } = useProjectActions();
  const { open, setError } = preview;
  useEffect(() => { void open(); }, [open]);
  const onChange = useCallback((value: WallSettings) => {
    const result = setStudioSection('wall', value);
    if (!result.ok) setError(result.error);
    return result;
  }, [setStudioSection, setError]);
  return <WallPreviewPanel wall={preview.wall} page={page} previewUrl={preview.previewUrl} error={preview.error} epoch={epoch} onChange={onChange} />;
}
