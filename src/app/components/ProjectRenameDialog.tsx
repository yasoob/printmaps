import { Pencil } from 'lucide-react';
import { useId, useRef, useState, type RefObject } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { StudioDialog, StudioDialogActions, StudioDialogBody, StudioDialogButton, StudioDialogHeader } from '@/components/ui/studio-dialog';
import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { useProject, useProjectActions } from '../projectStoreContext';

export function ProjectIdentityMenu({ onRename }: { onRename: () => void }) {
  const title = useProject((state) => state.document.title);
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel className="project-menu-identity">
        <span>Current project</span>
        <strong>{title}</strong>
      </DropdownMenuLabel>
      <DropdownMenuItem className="project-file-menu-item" onClick={onRename}>
        <Pencil aria-hidden="true" size={15} /> Rename project
      </DropdownMenuItem>
    </DropdownMenuGroup>
  );
}

export function ProjectRenameDialog({ onClose, returnFocusRef }: {
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const title = useProject((state) => state.document.title);
  const { setProjectTitle } = useProjectActions();
  const [draft, setDraft] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const canSave = draft.trim().length > 0;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <StudioDialog
        size="sm"
        className="project-rename-dialog"
        overlayClassName="project-rename-backdrop"
        initialFocus={inputRef}
        finalFocus={returnFocusRef}
      >
        <StudioDialogHeader title="Rename project" />
        <form onSubmit={(event) => {
          event.preventDefault();
          if (!canSave) return;
          const result = setProjectTitle(draft);
          if (result.ok) onClose();
          else setError(result.error);
        }}>
          <StudioDialogBody className="project-rename-body">
            <label htmlFor={inputId}>Project name</label>
            <input
              ref={inputRef}
              id={inputId}
              className="project-title-input"
              aria-describedby={hintId}
              aria-invalid={!canSave || !!error}
              maxLength={120}
              value={draft}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => { setDraft(event.currentTarget.value); setError(null); }}
            />
            <p id={hintId} role={canSave && !error ? undefined : 'alert'} className={canSave && !error ? undefined : 'is-error'}>
              {error ?? (canSave ? 'Up to 120 characters.' : 'Enter a project name.')}
            </p>
          </StudioDialogBody>
          <StudioDialogActions>
            <StudioDialogButton onClick={onClose}>Cancel</StudioDialogButton>
            <StudioDialogButton variant="primary" type="submit" disabled={!canSave}>Rename</StudioDialogButton>
          </StudioDialogActions>
        </form>
      </StudioDialog>
    </Dialog>
  );
}
