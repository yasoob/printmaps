import type { RefObject } from 'react';
import { AutosaveCorruptionDialog, AutosaveRecoveryDialog } from './AutosaveRecoveryDialog';
import type { ProjectAutosaveState } from './useProjectAutosave';

function restoreProjectTitleFocus(projectTitleRef: RefObject<HTMLButtonElement | null>) {
  let attempts = 0;
  const focusWhenInteractive = () => {
    const title = projectTitleRef.current;
    if (title?.closest('[inert]') && attempts < 10) {
      attempts += 1;
      window.requestAnimationFrame(focusWhenInteractive);
      return;
    }
    title?.focus();
  };
  window.setTimeout(() => {
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(focusWhenInteractive);
    } else {
      focusWhenInteractive();
    }
  }, 0);
}

export function ProjectAutosaveStatus({ autosave }: { autosave: ProjectAutosaveState }) {
  return (
    <span role="status" aria-label="Autosave status">
      {autosave.statusKind === 'error' ? 'Autosave paused' : autosave.status}
    </span>
  );
}

export function ProjectAutosaveErrorNotice({ autosave }: { autosave: ProjectAutosaveState }) {
  return autosave.statusKind === 'error'
    ? <div className="autosave-error-notice" role="alert" aria-label="Autosave status">{autosave.status}</div>
    : null;
}

export function ProjectAutosaveDialogs({
  autosave,
  projectTitleRef,
}: {
  autosave: ProjectAutosaveState;
  projectTitleRef: RefObject<HTMLButtonElement | null>;
}) {
  const restoreFocus = () => restoreProjectTitleFocus(projectTitleRef);
  const discard = () => {
    void autosave.discard().then((discarded) => {
      if (discarded) restoreFocus();
    });
  };

  return (
    <>
      {autosave.recoveryDraft && (
        <AutosaveRecoveryDialog
          draft={autosave.recoveryDraft}
          busy={autosave.decisionPending}
          onRecover={() => {
            autosave.recover();
            restoreFocus();
          }}
          onDiscard={discard}
        />
      )}
      {autosave.corrupted && (
        <AutosaveCorruptionDialog busy={autosave.decisionPending} onDiscard={discard} />
      )}
    </>
  );
}
