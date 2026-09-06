import { useCallback, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { MobilePanel, useMobilePanels } from './useMobilePanels';

type MobilePanels = ReturnType<typeof useMobilePanels>;
type ModalSurface = 'export' | 'import' | 'rename' | 'project-open' | 'autosave-conflict' | MobilePanel | null;

type ModalSurfaceOptions = {
  exportButtonRef: RefObject<HTMLButtonElement | null>;
  exportOpen: boolean;
  importOpen: boolean;
  projectOpen: boolean;
  autosaveConflictOpen: boolean;
  mobile: MobilePanels;
  setExportOpen: Dispatch<SetStateAction<boolean>>;
};

function activeSurface(
  isImportOpen: boolean,
  isExportOpen: boolean,
  isRenameOpen: boolean,
  mobilePanel: MobilePanel | null,
): ModalSurface {
  switch (true) {
    case isImportOpen: { return 'import'; }
    case isExportOpen: { return 'export'; }
    case isRenameOpen: { return 'rename'; }
    default: { return mobilePanel; }
  }
}

export function useModalSurfaces({
  exportButtonRef,
  exportOpen,
  importOpen,
  projectOpen,
  autosaveConflictOpen,
  mobile,
  setExportOpen,
}: ModalSurfaceOptions) {
  const [renameOpen, setRenameOpen] = useState(false);
  const openRename = useCallback(() => setRenameOpen(true), []);
  const closeRename = useCallback(() => setRenameOpen(false), []);
  const surface: ModalSurface = autosaveConflictOpen
    ? 'autosave-conflict' : (projectOpen
      ? 'project-open' : activeSurface(importOpen, exportOpen, renameOpen, mobile.activePanel));
  const mobilePanel = surface === 'layers' || surface === 'properties' ? surface : null;

  const closeExport = useCallback((shouldRestoreFocus = true) => {
    setExportOpen(false);
    if (shouldRestoreFocus) window.setTimeout(() => exportButtonRef.current?.focus(), 0);
  }, [exportButtonRef, setExportOpen]);

  return { closeExport, closeRename, mobilePanel, openRename, surface };
}
