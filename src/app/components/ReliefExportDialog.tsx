import { Scan } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { StudioDialog, StudioDialogActions, StudioDialogBody, StudioDialogButton, StudioDialogFeedback, StudioDialogHeader } from '@/components/ui/studio-dialog';
import type { PreviewPngExporter } from '../../export/previewPng';
import { exportTerrainRelief, reliefAttributionNotice } from '../../terrain/reliefExport';
import { terrainFrame } from '../../terrain/terrainFootprint';
import { downloadBlob } from '../../lib/downloadBlob';
import { ReliefSettingsControls, type ReliefControlsProps } from './ReliefSettingsControls';
import { FeatureHelp } from './FeatureHelp';
import './terrainControls.css';

export type ReliefExportDialogProps = ReliefControlsProps & {
  exporter: PreviewPngExporter | null;
  blockedReason?: string;
  onClose: () => void;
};

function isExportAvailable(exporter: PreviewPngExporter | null, blockedReason?: string) {
  return !!exporter?.captureRenderSnapshot && !blockedReason;
}

export function ReliefExportDialog(props: ReliefExportDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  return <Dialog open onOpenChange={(open, details) => { if (!open && busy) details.cancel(); else if (!open) props.onClose(); }}>
    <StudioDialog ref={dialogRef} initialFocus={dialogRef} className="export-dialog relief-export-dialog" overlayClassName="export-dialog-backdrop" aria-busy={busy}>
      <StudioDialogHeader title="Export 3D terrain relief" description="Print-area terrain model · STL · millimeters" showClose={!busy} />
      <ReliefExportPanel {...props} onBusyChange={setBusy} />
    </StudioDialog>
  </Dialog>;
}

function dismissLabel(isBusy: boolean, isComplete: boolean) {
  if (isBusy) return 'Cancel export';
  return isComplete ? 'Done' : 'Cancel';
}

function ReliefFeedback({ isBusy, progress, blockedReason, canExport, error }: {
  isBusy: boolean; progress: { fraction: number; message: string }; blockedReason?: string; canExport: boolean; error: string | null;
}) {
  return <StudioDialogFeedback data-empty={!progress.message && !blockedReason && canExport && !error}>
    {(isBusy || progress.fraction === 1) && <progress max={1} value={progress.fraction} aria-label="Terrain export progress" />}
    <p role="status" className="video-export-status">{progress.message}</p>
    {blockedReason && <p role="status">{blockedReason}</p>}
    {!canExport && !blockedReason && <p role="status">Waiting for the map preview to finish loading.</p>}
    {error && <p role="alert" className="export-error">{error}</p>}
  </StudioDialogFeedback>;
}

export function ReliefExportPanel({ exporter, onClose, blockedReason, onBusyChange, ...controls }: ReliefExportDialogProps & { onBusyChange: (isBusy: boolean) => void }) {
  const canExport = isExportAvailable(exporter, blockedReason);
  const [progress, setProgress] = useState({ fraction: 0, message: '' });
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const running = useRef<AbortController | null>(null);
  const isMounted = useRef(true);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const downloadRef = useRef<HTMLButtonElement>(null);
  const hasStarted = useRef(false);
  useLayoutEffect(() => { onBusyChange(isBusy); }, [isBusy, onBusyChange]);
  useEffect(() => {
    if (isBusy) cancelRef.current?.focus();
    else if (hasStarted.current) (canExport ? downloadRef : cancelRef).current?.focus();
  }, [isBusy, canExport]);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; running.current?.abort(); };
  }, []);
  useEffect(() => () => running.current?.abort(), [controls.documentEpoch]);
  useEffect(() => { if (blockedReason) running.current?.abort(); }, [blockedReason]);
  const capture = () => {
    if (blockedReason) throw new Error(blockedReason);
    if (!exporter?.captureRenderSnapshot) throw new Error('The map is not ready. Wait for the preview or retry the map.');
    return exporter.captureRenderSnapshot();
  };
  const fitDimensions = () => {
    try {
      const frame = terrainFrame(capture().footprint);
      const heightMm = Number((controls.settings.widthMm * frame.heightMeters / frame.widthMeters).toFixed(3));
      const result = controls.onChange({ ...controls.settings, heightMm });
      if (!result.ok) throw new Error(result.error);
      setError(null);
      setProgress({ fraction: 0, message: 'Dimensions match the print frame. Width and height now scale together.' });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not read the print frame.');
    }
  };
  const start = async () => {
    if (running.current) return;
    const controller = new AbortController();
    running.current = controller;
    hasStarted.current = true;
    setIsBusy(true);
    setError(null);
    try {
      const snapshot = capture();
      const settings = structuredClone(controls.settings);
      const blob = await exportTerrainRelief(snapshot, settings, {
        signal: controller.signal,
        onProgress: (fraction, message) => { if (isMounted.current && running.current === controller && !controller.signal.aborted) setProgress({ fraction, message }); },
      });
      if (controller.signal.aborted || !isMounted.current) return;
      downloadBlob(blob, 'terrain-relief-mm.stl');
      setProgress({ fraction: 1, message: 'STL downloaded. Import as millimeters in your slicer.' });
    } catch (error) {
      if (!isMounted.current) return;
      if (controller.signal.aborted) setProgress({ fraction: 0, message: 'Terrain export cancelled. No file downloaded.' });
      else setError(error instanceof Error ? error.message : 'Terrain export failed. No STL was generated.');
    } finally {
      running.current = null;
      if (isMounted.current) setIsBusy(false);
    }
  };
  return <>
      <ReliefFeedback isBusy={isBusy} progress={progress} blockedReason={blockedReason} canExport={canExport} error={error} />
      <StudioDialogBody className="export-dialog-body">
        <div className="feature-help-row export-panel-heading"><h3 className="export-panel-title">Terrain relief · STL</h3><FeatureHelp label="Terrain STL help">
          <p>A watertight binary STL of the print area. Set Pitch to 0; bearing is preserved. Import as millimeters in your slicer.</p>
          <p>The lowest sample sits on the base. The four elevation-aware frame corners are interpolated across the model; scale uses average edge lengths at the frame center. Exaggeration multiplies relief height. Elevation tiles are approximate, not survey data.</p>
          <p><strong>Elevation data & credits.</strong> {reliefAttributionNotice()}</p>
        </FeatureHelp></div>
        <fieldset disabled={isBusy || !!blockedReason} className="relief-fields">
          <ReliefSettingsControls {...controls} fitAction={<StudioDialogButton variant="secondary" size="sm" className="relief-fit-button" disabled={!canExport} onClick={fitDimensions}>
            <Scan aria-hidden="true" strokeWidth={1.75} />Fit dimensions to print frame
          </StudioDialogButton>} />
        </fieldset>
      </StudioDialogBody>
      <StudioDialogActions>
        <StudioDialogButton ref={cancelRef} onClick={isBusy ? () => running.current?.abort() : onClose}>{dismissLabel(isBusy, progress.fraction === 1)}</StudioDialogButton>
        <StudioDialogButton ref={downloadRef} variant="primary" disabled={isBusy || !canExport} onClick={() => { void start(); }}>{isBusy ? 'Generating terrain…' : 'Download STL'}</StudioDialogButton>
      </StudioDialogActions>
  </>;
}
