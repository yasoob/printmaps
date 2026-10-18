import { X } from 'lucide-react';
import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { StudioDialogBody, StudioDialogHeader } from '@/components/ui/studio-dialog';
import { useStableEvent } from '../hooks/useStableEvent';
import { useAvailableMapExporter } from '../mapExporterContext';
import { ExportDialogView } from './ExportDialogView';
import { usePrintExportController, type PrintExportProps } from './usePrintExportController';
import { StudioModeTabs } from './StudioModeTabs';
import './exportWorkspace.css';
import type { ComponentProps } from 'react';

const VideoWorkspacePanel = lazy(async () => {
  const module = await import('./ExportWorkspacePanels');
  return { default: module.VideoWorkspacePanel };
});
const ReliefWorkspacePanel = lazy(async () => {
  const module = await import('./ExportWorkspacePanels');
  return { default: module.ReliefWorkspacePanel };
});
const WallSettingsPanel = lazy(async () => {
  const module = await import('./ExportWorkspacePanels');
  return { default: module.WallSettingsPanel };
});
const ExportPreviewPane = lazy(async () => {
  const module = await import('./ExportWorkspacePanels');
  return { default: module.ExportPreviewPane };
});

export type ExportDialogProps = PrintExportProps & { documentEpoch?: number };
type Destination = 'print' | 'video' | 'relief';
const destinations = [
  { value: 'print', label: 'Print', description: 'Choose a format for the current print frame.' },
  { value: 'video', label: 'Video', description: 'Record your complete poster as an MP4.' },
  { value: 'relief', label: '3D model', description: 'Download print-area terrain for your slicer.' },
] as const;

function ExportWorkspaceContent({ mode, print, panels, wall }: {
  mode: Destination;
  print: ComponentProps<typeof ExportDialogView>;
  panels: ComponentProps<typeof VideoWorkspacePanel>;
  wall: ComponentProps<typeof WallSettingsPanel> | null;
}) {
  if (mode === 'video') return <VideoWorkspacePanel {...panels} />;
  if (mode === 'relief') return <ReliefWorkspacePanel {...panels} />;
  return <ExportDialogView {...print} settings={wall && <Suspense fallback={null}><WallSettingsPanel {...wall} /></Suspense>} />;
}

const previewFallback = <div className="export-preview" aria-hidden="true" />;

function ExportWorkspace(props: ExportDialogProps) {
  const [mode, setMode] = useState<Destination>('print');
  const [preview, setPreview] = useState(false);
  const [panelBusy, setPanelBusy] = useState(false);
  const exporter = useAvailableMapExporter(props.exporter);
  const { dialogRef, downloadButtonRef, cancelButtonRef, ...print } = usePrintExportController({ ...props, exporter });
  const busy = print.busy || panelBusy;
  const backRef = useRef<HTMLButtonElement>(null);
  const printAction = () => {
    const download = downloadButtonRef.current;
    return download && !download.disabled ? download : cancelButtonRef.current;
  };
  const changeMode = useCallback((destination: Destination) => {
    if (busy) return;
    setPreview(false);
    setMode(destination);
  }, [busy]);
  const openPreview = useStableEvent(() => {
    if (busy) return;
    setPreview(true);
  });
  const backToPrint = useStableEvent(() => {
    setPreview(false);
    requestAnimationFrame(() => printAction()?.focus());
  });
  const framed = preview && mode === 'print';
  const panelProps = { exporter, filename: props.filename, blockedReason: props.blockedReason, onClose: props.onClose, onBusyChange: setPanelBusy };
  return <Dialog open onOpenChange={(open, details) => {
    if (open) return;
    if (busy) details.cancel();
    else props.onClose();
  }}>
    <DialogContent ref={dialogRef} initialFocus={printAction}
      className="export-dialog export-workspace" data-framed={framed}
      overlayClassName="export-dialog-backdrop" showCloseButton={false} aria-busy={busy} tabIndex={-1}>
      <StudioDialogHeader className="export-dialog-header">
        <div><DialogTitle>Export map</DialogTitle><DialogDescription>
          {framed ? 'Preview your finished poster in a frame.' : destinations.find((item) => item.value === mode)?.description}
        </DialogDescription></div>
        <button className="icon-button close-button" type="button" aria-label="Close export" disabled={busy} onClick={props.onClose}><X size={16} /></button>
      </StudioDialogHeader>
      <div className="export-destinations">
        <StudioModeTabs choices={destinations} value={mode} disabled={busy} onValueChange={changeMode}
          label="Export destination" idPrefix="export" panelId="export-destination-panel" />
      </div>
      <div className="export-workspace-layout">
        <Suspense fallback={previewFallback}>
          <ExportPreviewPane exporter={exporter} blockedReason={props.blockedReason} framed={framed}
            canFrame={mode === 'print'} disabled={busy} onPreviewWall={openPreview} />
        </Suspense>
        <div className="export-destination-panel" id="export-destination-panel" role="tabpanel" aria-labelledby={`export-${mode}-tab`} tabIndex={-1}>
          <Suspense fallback={<StudioDialogBody><p>Loading export settings…</p></StudioDialogBody>}>
            <ExportWorkspaceContent mode={mode} panels={panelProps}
              wall={framed ? { backRef, disabled: busy, onBack: backToPrint } : null}
              print={{ ...print, dialogRef, downloadButtonRef, cancelButtonRef }} />
          </Suspense>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}

export function ExportDialog(props: ExportDialogProps) {
  return <ExportWorkspace key={props.documentEpoch ?? props.document.id} {...props} />;
}
