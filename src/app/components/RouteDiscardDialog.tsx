import { useRef } from "react";
import { Dialog } from "@/components/ui/dialog";
import { StudioDialog, StudioDialogActions, StudioDialogButton, StudioDialogHeader } from "@/components/ui/studio-dialog";

export function RouteDiscardDialog({
  onDiscard,
  onKeepEditing,
}: Readonly<{
  onDiscard: () => void;
  onKeepEditing: () => void;
}>) {
  const keepRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onKeepEditing(); }}>
      <StudioDialog size="sm" className="route-discard-dialog" overlayClassName="route-discard-backdrop" initialFocus={keepRef}>
        <StudioDialogHeader
          title="Discard route changes?"
          description="Completed layers will stay unchanged, but unfinished route changes and unadded point inputs will be lost."
        />
        <StudioDialogActions stackOnMobile>
          <StudioDialogButton ref={keepRef} onClick={onKeepEditing}>Keep editing</StudioDialogButton>
          <StudioDialogButton variant="destructive" onClick={onDiscard}>Discard changes</StudioDialogButton>
        </StudioDialogActions>
      </StudioDialog>
    </Dialog>
  );
}
