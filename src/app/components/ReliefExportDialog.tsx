import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { StudioDialogActions, StudioDialogBody, StudioDialogButton, StudioDialogHeader } from '@/components/ui/studio-dialog';
import type { PreviewPngExporter } from '../../export/previewPng';
import { exportTerrainRelief, reliefAttributionNotice } from '../../terrain/reliefExport';
import { terrainFrame } from '../../terrain/terrainFootprint';
import { downloadBlob } from '../../lib/downloadBlob';
import { ReliefSettingsControls, type ReliefControlsProps } from './ReliefSettingsControls';
import './terrainControls.css';

type ReliefExportDialogProps = ReliefControlsProps & {
  exporter: PreviewPngExporter | null;
  onClose: () => void;
};

export function ReliefExportDialog({ exporter, onClose, ...controls }: ReliefExportDialogProps) {
  const [progress, setProgress] = useState({ fraction: 0, message: 'Fit model dimensions to the current print frame, then download.' });
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const running = useRef<AbortController | null>(null);
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; running.current?.abort(); };
  }, []);
  const capture = () => {
    if (!exporter?.captureRenderSnapshot) throw new Error('The map is not ready. Wait for the preview or retry the map.');
    return exporter.captureRenderSnapshot();
  };
  const fitDimensions = () => {
    try {
      const frame = terrainFrame(capture().footprint);
      const heightMm = controls.settings.widthMm * frame.heightMeters / frame.widthMeters;
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
    setIsBusy(true);
    setError(null);
    try {
      const snapshot = capture();
      const settings = structuredClone(controls.settings);
      const blob = await exportTerrainRelief(snapshot, settings, {
        signal: controller.signal,
        onProgress: (fraction, message) => { if (isMounted.current) setProgress({ fraction, message }); },
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
  return <Dialog open onOpenChange={(open, details) => { if (!open && isBusy) details.cancel(); else if (!open) onClose(); }}>
    <DialogContent className="relief-export-dialog" showCloseButton={false} aria-busy={isBusy}>
      <StudioDialogHeader><DialogTitle>Export 3D terrain relief</DialogTitle><DialogDescription>A watertight binary STL of the actual print area. Set Pitch to 0; bearing is preserved.</DialogDescription></StudioDialogHeader>
      <StudioDialogBody>
        <fieldset disabled={isBusy} className="relief-fields">
          <ReliefSettingsControls {...controls} />
          <button type="button" className="secondary-button" disabled={!exporter?.captureRenderSnapshot} onClick={fitDimensions}>Fit dimensions to print frame</button>
        </fieldset>
        <p className="terrain-hint">The lowest terrain sample sits on the base. Relief height uses physical map scale at the frame center, multiplied by exaggeration. Elevation tiles are an approximation, not survey data.</p>
        <p className="terrain-hint">{reliefAttributionNotice()}</p>
        <progress max={1} value={progress.fraction} aria-label="Terrain export progress" />
        <p role="status">{progress.message}</p>
        {!exporter?.captureRenderSnapshot && <p role="status">Waiting for the map preview to finish loading.</p>}
        {error && <p role="alert" className="coordinate-validation">{error}</p>}
      </StudioDialogBody>
      <StudioDialogActions>
        <StudioDialogButton onClick={isBusy ? () => running.current?.abort() : onClose}>{isBusy ? 'Cancel export' : 'Close'}</StudioDialogButton>
        <StudioDialogButton variant="primary" disabled={isBusy || !exporter?.captureRenderSnapshot} onClick={() => { void start(); }}>{isBusy ? 'Generating terrain…' : 'Download STL'}</StudioDialogButton>
      </StudioDialogActions>
    </DialogContent>
  </Dialog>;
}
