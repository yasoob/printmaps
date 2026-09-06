import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

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
        aria-labelledby="route-discard-title"
      >
        <h2 id="route-discard-title">Discard route changes?</h2>
        <p>
          Completed layers will stay unchanged, but unfinished route changes
          and unadded point inputs will be lost.
        </p>
        <div className="route-discard-actions">
          <button type="button" onClick={onKeepEditing}>
            Keep editing
          </button>
          <button className="primary-button" type="button" onClick={onDiscard}>
            Discard changes
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
