import { memo, type RefObject } from 'react';
import { AutosaveCorruptionDialog } from './AutosaveCorruptionDialog';
import type { ProjectAutosaveState } from './useProjectAutosave';
import { isInteractiveElement } from '../lib/focus';
import { useProject } from '../app/projectStoreContext';
import { useAutosaveErrorState } from './projectAutosaveContext';

function restoreInteractiveFocus(fallbackFocusRef: RefObject<HTMLElement | null>) {
  let attempts = 0;
  const focusWhenInteractive = () => {
    const fallbackTarget = fallbackFocusRef.current;
    if (isInteractiveElement(fallbackTarget)) {
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

export const ProjectAutosaveStatus = memo(function ProjectAutosaveStatus({ autosave }: { autosave: ProjectAutosaveState }) {
  const hasUnfinishedDrawing = useProject((state) => state.hasUnfinishedDrawing);
  const isEnabled = autosave.status !== 'Local draft' || hasUnfinishedDrawing;
  let status = autosave.statusKind === 'disabled' ? 'Autosave off' : (autosave.statusKind === 'error' || autosave.statusKind === 'conflict' ? 'Autosave paused' : autosave.status);
  if (hasUnfinishedDrawing) {
    if (status === 'All changes saved locally') status = 'Completed layers saved locally';
    if (status === 'Local draft') status = 'Local saving unavailable';
    status += ' · Unfinished work not saved';
  }
  return (
    <span role={isEnabled ? 'status' : undefined} aria-label={isEnabled ? 'Autosave status' : undefined}>
      {status}
    </span>
  );
});

export const ProjectAutosaveErrorNotice = memo(function ProjectAutosaveErrorNotice({ autosave }: { autosave: ProjectAutosaveState }) {
  return autosave.statusKind === 'error' && !autosave.corrupted
    ? <div className="autosave-error-notice" role="alert" aria-label="Autosave status">{autosave.status}</div>
    : null;
});

export function ProjectAutosaveOfflineNotice() {
  const autosave = useAutosaveErrorState();
  if (autosave?.statusKind === 'conflict') {
    return (
      <details className="offline-autosave-notice conflict-autosave-notice" open>
        <summary><span role="status" aria-label="Autosave conflict notice">Autosave paused: another tab saved changes</span></summary>
        <p>This tab’s version is not saved locally. Download it before replacing or closing this tab.</p>
        <button type="button" onClick={autosave.reviewConflict}>Review autosave conflict</button>
      </details>
    );
  }
  if (autosave?.statusKind !== 'disabled') return null;
  return (
    <details className="offline-autosave-notice">
      <summary><span role="status" aria-label="Offline autosave notice">Autosave off: download to keep new work</span></summary>
      <p>{autosave.status}</p>
    </details>
  );
}

export const ProjectAutosaveDialogs = memo(function ProjectAutosaveDialogs({
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
  const continueWithoutAutosave = () => {
    if (autosave.continueWithoutAutosave()) restoreFocus();
  };

  return autosave.corrupted
    ? <AutosaveCorruptionDialog busy={autosave.decisionPending} error={autosave.statusKind === 'error' ? autosave.status : null} recoveryData={autosave.recoveryData} onContinue={continueWithoutAutosave} onDiscard={discard} />
    : null;
});
