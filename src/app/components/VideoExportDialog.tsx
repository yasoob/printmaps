import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectDocument } from '../../domain/project';
import type { PreviewPngExporter } from '../../export/previewPng';
import { downloadBlob } from '../../lib/downloadBlob';
import { getVideoCapability } from '../../video/capability';
import { planVideoExport } from '../../video/plan';
import type { VideoOptions, VideoProgress, VideoResult } from '../../video/types';
import { VideoExportDialogView } from './VideoExportDialogView';
import './videoExport.css';

export type VideoExportDialogProps = Readonly<{
  document: ProjectDocument;
  settings: VideoOptions;
  onSettingsChange: (settings: VideoOptions) => void;
  exporter: PreviewPngExporter | null;
  filename: string;
  onClose: () => void;
  blockedReason?: string;
}>;

function videoResultSummary(result: VideoResult): string {
  return `MP4 download started. ${result.width} × ${result.height} px; ${result.recordingSeconds.toFixed(1)} seconds. `
    + `${result.presentedFrames} composed frames presented at ${result.measuredPresentationFps.toFixed(1)} fps; `
    + `${result.missedFrameSlots} target frame slots missed. Encoder frame drops are not measurable with MediaRecorder.`;
}

function videoFilename(filename: string): string {
  return `${filename.replace(/\.(?:printmap(?:\.json)?|png|svg|pdf|psd|mp4)$/i, '') || 'map'}.mp4`;
}

function VideoExportSession(props: VideoExportDialogProps) {
  const { document, settings, onSettingsChange, exporter, filename, onClose, blockedReason } = props;
  const [capability] = useState(getVideoCapability);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<VideoProgress | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const downloadRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const hasStarted = useRef(false);
  const preflight = useMemo(() => {
    try {
      return { plan: planVideoExport(settings, document.page), error: null };
    } catch (error_) {
      return { plan: null, error: error_ instanceof Error ? error_.message : 'Video output could not be planned.' };
    }
  }, [settings, document.page]);
  const unavailable = blockedReason || preflight.error
    || (!capability.supported && capability.reason)
    || (!exporter?.captureRenderSnapshot && 'The map is not ready. Wait for the map and all tiles to load.');

  useEffect(() => () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, [document.id]);
  useEffect(() => {
    if (busy) cancelRef.current?.focus();
    else if (hasStarted.current) {
      if (unavailable) cancelRef.current?.focus();
      else downloadRef.current?.focus();
    }
  }, [busy, unavailable]);

  const cancel = () => {
    controllerRef.current?.abort();
    setStatus('Cancelling video export…');
  };
  const close = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    onClose();
  };
  const download = async () => {
    if (unavailable || controllerRef.current || !exporter?.captureRenderSnapshot) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    hasStarted.current = true;
    setBusy(true);
    setProgress(null);
    setError(null);
    setStatus('');
    try {
      const renderSnapshot = exporter.captureRenderSnapshot({ content: 'composite' });
      const project = structuredClone(document);
      const options = { ...settings };
      const { exportVideoDocument } = await import('../../video/exportVideoDocument');
      let lastPercent = -1;
      let lastPhase = '';
      const result = await exportVideoDocument({
        document: project, renderSnapshot, settings: options, signal: controller.signal,
        onProgress: (next) => {
          const percent = Math.floor(next.fraction * 100);
          if (controllerRef.current !== controller || (percent === lastPercent && next.phase === lastPhase)) return;
          lastPercent = percent;
          lastPhase = next.phase;
          setProgress(next);
        },
      });
      if (controller.signal.aborted || controllerRef.current !== controller) return;
      downloadBlob(result.blob, videoFilename(filename));
      setStatus(videoResultSummary(result));
    } catch (error_) {
      if (controllerRef.current !== controller) return;
      if (controller.signal.aborted) setStatus('Video export cancelled. No file downloaded.');
      else {
        setError(error_ instanceof Error ? error_.message : 'Video export failed.');
        setStatus('Video export failed. No file downloaded.');
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setBusy(false);
      }
    }
  };

  return <VideoExportDialogView busy={busy} unavailable={unavailable} settings={settings} onSettingsChange={onSettingsChange} plan={preflight.plan} progress={progress} status={status} error={error} cancelRef={cancelRef} downloadRef={downloadRef} onClose={close} onCancel={cancel} onDownload={() => { void download(); }} />;
}

export function VideoExportDialog(props: VideoExportDialogProps) {
  return <VideoExportSession key={props.document.id} {...props} />;
}
