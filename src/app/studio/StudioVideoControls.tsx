import { lazy, memo, Suspense, useState } from 'react';
import type { PreviewPngExporter } from '../../export/previewPng';
import { InspectorAccordion } from '../components/PropertyControls';
import { useMutationFeedback } from '../hooks/useMutationFeedback';
import { useProject, useProjectActions } from '../projectStoreContext';

const VideoExportDialog = lazy(async () => {
  const module = await import('../components/VideoExportDialog');
  return { default: module.VideoExportDialog };
});
type VideoControlProps = { exporter: PreviewPngExporter | null; blockedReason?: string };

function VideoDialogSurface({ exporter, blockedReason, onClose }: VideoControlProps & { onClose: () => void }) {
  const document = useProject((state) => state.document);
  const { setStudioSection } = useProjectActions();
  const feedback = useMutationFeedback(document.studio.video);
  return <VideoExportDialog document={document} settings={document.studio.video}
    exporter={exporter} filename={document.id} onClose={onClose}
    blockedReason={blockedReason || feedback.error || undefined}
    onSettingsChange={(settings) => feedback.report(setStudioSection('video', settings))} />;
}

export const StudioVideoControls = memo(function StudioVideoControls({ exporter, blockedReason }: VideoControlProps) {
  const documentEpoch = useProject((state) => state.documentEpoch);
  const settings = useProject((state) => state.document.studio.video);
  const [openEpoch, setOpenEpoch] = useState<number | null>(null);
  return <InspectorAccordion title="Map video" isDefaultExpanded={false}
    storageKey="print-map-studio:inspector:video"
    summary={`${settings.durationSeconds}s · ${settings.motion === 'orbit' ? 'Orbit' : 'Sway'} · MP4`}>
    <p className="terrain-hint">Create a short rotating or swaying video from your complete poster.</p>
    <button type="button" className="secondary-button" disabled={Boolean(blockedReason)}
      onClick={() => setOpenEpoch(documentEpoch)}>Export map video</button>
    {blockedReason && <p role="status" className="terrain-hint">{blockedReason}</p>}
    {openEpoch === documentEpoch && <Suspense fallback={<p role="status">Loading video export…</p>}>
      <VideoDialogSurface exporter={exporter} blockedReason={blockedReason} onClose={() => setOpenEpoch(null)} />
    </Suspense>}
  </InspectorAccordion>;
});
