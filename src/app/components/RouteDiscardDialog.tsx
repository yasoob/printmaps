import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { StudioDialogActions, StudioDialogButton, StudioDialogHeader } from "@/components/ui/studio-dialog";

export function RouteDiscardDialog({
  onDiscard,
  onKeepEditing,
}: Readonly<{
  onDiscard: () => void;
  onKeepEditing: () => void;
}>) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onKeepEditing(); }}>
      <DialogContent
        className="route-discard-dialog"
        overlayClassName="route-discard-backdrop"
        showCloseButton={false}
      >
        <StudioDialogHeader>
          <div>
            <DialogTitle>Discard route changes?</DialogTitle>
            <DialogDescription>
              Completed layers will stay unchanged, but unfinished route changes
              and unadded point inputs will be lost.
            </DialogDescription>
          </div>
        </StudioDialogHeader>
        <StudioDialogActions stackOnMobile>
          <StudioDialogButton onClick={onKeepEditing}>Keep editing</StudioDialogButton>
          <StudioDialogButton variant="primary" onClick={onDiscard}>Discard changes</StudioDialogButton>
        </StudioDialogActions>
      </DialogContent>
    </Dialog>
  );
}
