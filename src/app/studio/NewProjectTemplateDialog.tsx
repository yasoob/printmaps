import { useState, type RefObject } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { TemplateGallery, type TemplateGalleryProps } from './TemplateGallery';

export function NewProjectTemplateDialog({ onClose, onSelect, returnFocusRef }: {
  onClose: () => void;
  onSelect: TemplateGalleryProps['onSelect'];
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const [error, setError] = useState('');
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="template-project-dialog" overlayClassName="project-rename-backdrop" finalFocus={returnFocusRef}>
      <div className="template-project-heading"><DialogTitle>New from template</DialogTitle></div>
      <div className="template-project-body">
        {error && <p className="coordinate-validation" role="alert">{error}</p>}
        <TemplateGallery mode="new-project" onSelect={(id, starter) => {
          try { onSelect(id, starter); }
          catch (error_) { setError(error_ instanceof Error ? error_.message : 'The project could not be created.'); }
        }} />
      </div>
    </DialogContent>
  </Dialog>;
}
