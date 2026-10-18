import { useState, type RefObject } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Notice } from '@/components/ui/notice';
import { StudioDialog, StudioDialogBody, StudioDialogHeader } from '@/components/ui/studio-dialog';
import { TemplateGallery, type TemplateGalleryProps } from './TemplateGallery';

export function NewProjectTemplateDialog({ onClose, onSelect, returnFocusRef }: {
  onClose: () => void;
  onSelect: TemplateGalleryProps['onSelect'];
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const [error, setError] = useState('');
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <StudioDialog size="lg" className="template-project-dialog" overlayClassName="project-rename-backdrop" finalFocus={returnFocusRef}>
      <StudioDialogHeader title="New from template" description="Choose a design or start with a place." />
      <StudioDialogBody className="template-project-body">
        {error && <Notice tone="error">{error}</Notice>}
        <TemplateGallery mode="new-project" onSelect={(id, starter) => {
          try { onSelect(id, starter); }
          catch (error_) { setError(error_ instanceof Error ? error_.message : 'The project could not be created.'); }
        }} />
      </StudioDialogBody>
    </StudioDialog>
  </Dialog>;
}
