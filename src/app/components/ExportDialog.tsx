import { ArrowLeft, X } from 'lucide-react';
import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { StudioDialogActions, StudioDialogBody, StudioDialogButton, StudioDialogHeader } from '@/components/ui/studio-dialog';
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
const WallWorkspacePanel = lazy(async () => {
  const module = await import('./ExportWorkspacePanels');
  return { default: module.WallWorkspacePanel };
});

export type ExportDialogProps = PrintExportProps & { documentEpoch?: number };
type Destination = 'print' | 'video' | 'relief';
const destinations = [
  { value: 'print', label: 'Print', description: 'Choose a format for the current print frame.' },
  { value: 'video', label: 'Video', description: 'Record your complete poster as an MP4.' },
  { value: 'relief', label: '3D model', description: 'Download print-area terrain for your slicer.' },
] as const;

function ExportWorkspaceContent({ preview, mode, print, panels }: {
  preview: boolean;
  mode: Destination;
  print: ComponentProps<typeof ExportDialogView>;
  panels: ComponentProps<typeof VideoWorkspacePanel>;
}) {
  if (preview) return <WallWorkspacePanel exporter={panels.exporter} blockedReason={panels.blockedReason} />;
  if (mode === 'video') return <VideoWorkspacePanel {...panels} />;
  if (mode === 'relief') return <ReliefWorkspacePanel {...panels} />;
  return <ExportDialogView {...print} />;
}

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
  const openPreview = () => {
    if (busy) return;
    setPreview(true);
    requestAnimationFrame(() => backRef.current?.focus());
  };
  const backToPrint = () => {
    setPreview(false);
    requestAnimationFrame(() => printAction()?.focus());
  };
  const panelProps = { exporter, filename: props.filename, blockedReason: props.blockedReason, onClose: props.onClose, onBusyChange: setPanelBusy };
  return <Dialog open onOpenChange={(open, details) => {
    if (open) return;
    if (busy) details.cancel();
    else props.onClose();
  }}>
    <DialogContent ref={dialogRef} initialFocus={printAction}
      className={`export-dialog export-workspace${preview ? ' is-framed-preview' : ''}`}
      overlayClassName="export-dialog-backdrop" showCloseButton={false} aria-busy={busy} tabIndex={-1}>
      <StudioDialogHeader className="export-dialog-header">
        <div><DialogTitle>Export map</DialogTitle><DialogDescription>
          {preview ? 'Preview your finished poster in a frame.' : destinations.find((item) => item.value === mode)?.description}
        </DialogDescription></div>
        <button className="icon-button close-button" type="button" aria-label="Close export" disabled={busy} onClick={props.onClose}><X size={16} /></button>
      </StudioDialogHeader>
      <div className="export-destinations">
        <StudioModeTabs choices={destinations} value={mode} disabled={busy} onValueChange={changeMode}
          label="Export destination" idPrefix="export" panelId="export-destination-panel" />
      </div>
      <div className="export-destination-panel" id="export-destination-panel" role="tabpanel" aria-labelledby={`export-${mode}-tab`} tabIndex={-1}>
        {preview && <StudioDialogActions className="export-preview-navigation">
          <StudioDialogButton ref={backRef} onClick={backToPrint}><ArrowLeft size={16} aria-hidden="true" />Back to export</StudioDialogButton>
        </StudioDialogActions>}
        <Suspense fallback={<StudioDialogBody><p role="status">Loading export settings…</p></StudioDialogBody>}>
          <ExportWorkspaceContent preview={preview} mode={mode} panels={panelProps}
            print={{ ...print, dialogRef, downloadButtonRef, cancelButtonRef, onPreview: openPreview }} />
        </Suspense>
      </div>
    </DialogContent>
  </Dialog>;
}

export function ExportDialog(props: ExportDialogProps) {
  return <ExportWorkspace key={props.documentEpoch ?? props.document.id} {...props} />;
}
