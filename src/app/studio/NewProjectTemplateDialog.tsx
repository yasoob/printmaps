import { useState, type RefObject } from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { StudioDialogBody, StudioDialogHeader } from '@/components/ui/studio-dialog';
import { TemplateGallery, type TemplateGalleryProps } from './TemplateGallery';

export function NewProjectTemplateDialog({ onClose, onSelect, returnFocusRef }: {
  onClose: () => void;
  onSelect: TemplateGalleryProps['onSelect'];
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const [error, setError] = useState('');
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="template-project-dialog" overlayClassName="project-rename-backdrop" finalFocus={returnFocusRef} showCloseButton={false}>
      <StudioDialogHeader>
        <div><DialogTitle>New from template</DialogTitle><DialogDescription>Choose a design or start with a place.</DialogDescription></div>
        <button className="icon-button close-button" type="button" aria-label="Close" onClick={onClose}><X size={16} /></button>
      </StudioDialogHeader>
      <StudioDialogBody className="template-project-body">
        {error && <p className="coordinate-validation" role="alert">{error}</p>}
        <TemplateGallery mode="new-project" onSelect={(id, starter) => {
          try { onSelect(id, starter); }
          catch (error_) { setError(error_ instanceof Error ? error_.message : 'The project could not be created.'); }
        }} />
      </StudioDialogBody>
    </DialogContent>
  </Dialog>;
}
