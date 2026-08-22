import type { RefObject } from 'react';
import { AutosaveCorruptionDialog, AutosaveRecoveryDialog } from './AutosaveRecoveryDialog';
import type { ProjectAutosaveState } from './useProjectAutosave';

function isInteractive(element: HTMLElement | null) {
  const checkVisibility = element && 'checkVisibility' in element
    ? element.checkVisibility.bind(element)
    : null;
  return element?.isConnected === true
    && !element.closest('[inert]')
    && !element.hasAttribute('disabled')
    && (checkVisibility === null || checkVisibility());
}

function restoreInteractiveFocus(
  returnFocusRef: RefObject<HTMLElement | null>,
  fallbackFocusRef: RefObject<HTMLElement | null>,
) {
  let attempts = 0;
  const focusWhenInteractive = () => {
    const returnTarget = returnFocusRef.current;
    if (isInteractive(returnTarget)) {
      returnTarget?.focus();
      return;
    }
    if (returnTarget?.isConnected && attempts < 10) {
      attempts += 1;
      window.requestAnimationFrame(focusWhenInteractive);
      return;
    }
    const fallbackTarget = fallbackFocusRef.current;
    if (isInteractive(fallbackTarget)) {
      fallbackTarget?.focus();
      return;
    }
    if (attempts < 10) {
      attempts += 1;
      window.requestAnimationFrame(focusWhenInteractive);
    }
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
  const isEnabled = autosave.status !== 'Local draft';
  return (
    <span role={isEnabled ? 'status' : undefined} aria-label={isEnabled ? 'Autosave status' : undefined}>
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
  onBeforeDecision,
  returnFocusRef,
  fallbackFocusRef,
}: {
  autosave: ProjectAutosaveState;
  onBeforeDecision: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
  fallbackFocusRef: RefObject<HTMLElement | null>;
}) {
  const restoreFocus = () => restoreInteractiveFocus(returnFocusRef, fallbackFocusRef);
  const discard = () => {
    onBeforeDecision();
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
            onBeforeDecision();
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
