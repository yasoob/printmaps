import { useLayoutEffect, useRef } from "react";

export function RouteDiscardDialog({
  onDiscard,
  onKeepEditing,
}: Readonly<{
  onDiscard: () => void;
  onKeepEditing: () => void;
}>) {
  const keepButtonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    keepButtonRef.current?.focus();
  }, []);

  return (
    <div className="route-discard-overlay">
      <div className="export-backdrop" aria-hidden="true" />
      <dialog
        className="route-discard-dialog"
        open
        aria-modal="true"
        aria-labelledby="route-discard-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onKeepEditing();
          } else if (event.key === "Tab") {
            const buttons = [
              ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                "button:not([disabled])",
              ),
            ];
            const current = buttons.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            const next =
              (current + (event.shiftKey ? buttons.length - 1 : 1)) %
              buttons.length;
            event.preventDefault();
            buttons[next]?.focus();
          }
        }}
      >
        <h2 id="route-discard-title">Discard route changes?</h2>
        <p>
          The saved map will stay unchanged, but the new draft points will be
          lost.
        </p>
        <div className="route-discard-actions">
          <button ref={keepButtonRef} type="button" onClick={onKeepEditing}>
            Keep editing
          </button>
          <button className="primary-button" type="button" onClick={onDiscard}>
            Discard changes
          </button>
        </div>
      </dialog>
    </div>
  );
}
