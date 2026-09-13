import { Download, TriangleAlert } from 'lucide-react';
import { trackEditorAction } from '../../analytics/editorAnalytics';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { StudioDialogActions, StudioDialogBody, StudioDialogButton, StudioDialogHeader, StudioDialogSection } from '@/components/ui/studio-dialog';
import { useProject, useProjectStoreApi } from '../projectStoreContext';
import { downloadProjectDocument } from './projectDownload';
import type { ProjectOpeningIntent } from '../hooks/useProjectOpening';
import './projectReplacementDialog.css';

export function ProjectReplacementDialog({ title, intent = 'open', onKeepEditing, onDiscardAndOpen, returnFocusRef }: {
  title: string;
  intent?: ProjectOpeningIntent;
  onKeepEditing: () => void;
  onDiscardAndOpen: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const downloadErrorRef = useRef<HTMLParagraphElement>(null);
  const descriptionId = useId();
  const unfinishedId = useId();
  const backupTitleId = useId();
  const store = useProjectStoreApi();
  const currentTitle = useProject((state) => state.document.title);
  const hasUnfinishedDrawing = useProject((state) => state.hasUnfinishedDrawing);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const titleText = hasUnfinishedDrawing ? 'Discard unfinished work?' : (intent === 'new' ? 'Start a new project?' : 'Replace current project?');
  const actionText = intent === 'new' ? 'Start new project' : (hasUnfinishedDrawing ? 'Discard unfinished work and open' : 'Replace project');
  useEffect(() => {
    if (downloadError) downloadErrorRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [downloadError]);
  const downloadCurrent = () => {
    trackEditorAction('projectSaveStarted', { format: 'project' });
    try {
      downloadProjectDocument(store.getState().document);
      trackEditorAction('projectSaveCompleted', { format: 'project' });
      setDownloadError(null);
    } catch (error) {
      trackEditorAction('projectSaveFailed', { format: 'project' });
      setDownloadError(error instanceof Error ? error.message : 'The current project could not be downloaded.');
    }
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onKeepEditing(); }}>
      <DialogContent
        className="project-replacement-dialog"
        overlayClassName="project-rename-backdrop"
        initialFocus={keepEditingRef}
        finalFocus={returnFocusRef}
        showCloseButton={false}
        aria-describedby={hasUnfinishedDrawing ? `${descriptionId} ${unfinishedId}` : descriptionId}
      >
        <StudioDialogBody className="project-replacement-content">
          <StudioDialogHeader>
            <div>
              <DialogTitle>{titleText}</DialogTitle>
              <DialogDescription id={descriptionId}>
                {intent === 'new' ? 'Starting a new project' : <>Opening “<strong>{title}</strong>”</>} replaces “<strong>{currentTitle}</strong>” in this browser and clears its Undo history.
              </DialogDescription>
            </div>
          </StudioDialogHeader>
          {hasUnfinishedDrawing && (
            <div className="project-replacement-warning">
              <TriangleAlert size={18} aria-hidden="true" />
              <div>
                <h3>Unfinished work will be lost</h3>
                <p id={unfinishedId}>Unfinished drawings, unadded point inputs and POI lists (including lookup suggestions) will be discarded. They are not saved or included in project downloads.</p>
              </div>
            </div>
          )}
          <StudioDialogSection className="project-replacement-backup" aria-labelledby={backupTitleId}>
            <div>
              <h3 id={backupTitleId}>Save a copy first</h3>
              <p>Download the current completed project before continuing. This dialog stays open while you save your copy.</p>
            </div>
            <StudioDialogButton variant="secondary" onClick={downloadCurrent}>
              <Download size={16} aria-hidden="true" />
              Download current project
            </StudioDialogButton>
            {downloadError && <p ref={downloadErrorRef} className="project-replacement-error" role="alert">{downloadError}</p>}
          </StudioDialogSection>
        </StudioDialogBody>
        <StudioDialogActions stackOnMobile>
          <StudioDialogButton ref={keepEditingRef} onClick={onKeepEditing}>Keep editing</StudioDialogButton>
          <StudioDialogButton variant="primary" onClick={onDiscardAndOpen}>{actionText}</StudioDialogButton>
        </StudioDialogActions>
      </DialogContent>
    </Dialog>
  );
}
