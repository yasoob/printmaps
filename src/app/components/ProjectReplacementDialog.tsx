import { useRef, useState, type RefObject } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useProject, useProjectStoreApi } from '../projectStoreContext';
import { downloadProjectDocument } from './projectDownload';
import type { ProjectOpeningIntent } from '../hooks/useProjectOpening';

export function ProjectReplacementDialog({ title, intent = 'open', onKeepEditing, onDiscardAndOpen, returnFocusRef }: {
  title: string;
  intent?: ProjectOpeningIntent;
  onKeepEditing: () => void;
  onDiscardAndOpen: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const store = useProjectStoreApi();
  const currentTitle = useProject((state) => state.document.title);
  const hasUnfinishedDrawing = useProject((state) => state.hasUnfinishedDrawing);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const titleText = hasUnfinishedDrawing ? 'Discard unfinished work?' : (intent === 'new' ? 'Start a new project?' : 'Replace current project?');
  const actionText = intent === 'new' ? 'Start new project' : (hasUnfinishedDrawing ? 'Discard unfinished work and open' : 'Replace project');
  const downloadCurrent = () => {
    try {
      downloadProjectDocument(store.getState().document);
      setDownloadError(null);
    } catch (error) {
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
      >
        <DialogTitle>{titleText}</DialogTitle>
        <DialogDescription>
          {intent === 'new' ? 'Starting a new project' : `Opening “${title}”`} replaces “{currentTitle}” in this browser and clears its Undo history.
        </DialogDescription>
        {hasUnfinishedDrawing && <p>Unfinished drawings, unadded point inputs and POI lists (including lookup suggestions) will be discarded. They are not saved or included in project downloads.</p>}
        <p>Download the current completed project if you need a copy. Downloading keeps this dialog open; replace the project only after saving your copy.</p>
        {downloadError && <p className="coordinate-validation" role="alert">{downloadError}</p>}
        <div className="project-replacement-actions">
          <button type="button" onClick={downloadCurrent}>Download current project</button>
          <button type="button" ref={keepEditingRef} onClick={onKeepEditing}>Keep editing</button>
          <button type="button" className="primary-button" onClick={onDiscardAndOpen}>{actionText}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
