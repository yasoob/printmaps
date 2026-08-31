import type { RefObject } from 'react';
import { AutosaveCorruptionDialog } from './AutosaveCorruptionDialog';
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

function restoreInteractiveFocus(fallbackFocusRef: RefObject<HTMLElement | null>) {
  let attempts = 0;
  const focusWhenInteractive = () => {
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
  return autosave.statusKind === 'error' && !autosave.corrupted
    ? <div className="autosave-error-notice" role="alert" aria-label="Autosave status">{autosave.status}</div>
    : null;
}

export function ProjectAutosaveDialogs({
  autosave,
  fallbackFocusRef,
}: {
  autosave: ProjectAutosaveState;
  fallbackFocusRef: RefObject<HTMLElement | null>;
}) {
  const restoreFocus = () => restoreInteractiveFocus(fallbackFocusRef);
  const discard = () => {
    void autosave.discard().then((discarded) => {
      if (discarded) restoreFocus();
    });
  };

  return autosave.corrupted
    ? <AutosaveCorruptionDialog busy={autosave.decisionPending} error={autosave.statusKind === 'error' ? autosave.status : null} onDiscard={discard} />
    : null;
}
