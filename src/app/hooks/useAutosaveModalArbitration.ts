import { useCallback, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { ProjectAutosaveState } from '../../storage/useProjectAutosave';
import type { MobilePanel, useMobilePanels } from './useMobilePanels';

type MobilePanels = ReturnType<typeof useMobilePanels>;
type ModalSurface = 'autosave' | 'export' | 'import' | MobilePanel | null;

type AutosaveModalArbitrationOptions = {
  autosave: ProjectAutosaveState;
  exportButtonRef: RefObject<HTMLButtonElement | null>;
  importButtonRef: RefObject<HTMLButtonElement | null>;
  exportOpen: boolean;
  importOpen: boolean;
  mobile: MobilePanels;
  setExportOpen: Dispatch<SetStateAction<boolean>>;
  setImportOpen: Dispatch<SetStateAction<boolean>>;
};

function activeSurface(
  isAutosaveDecisionOpen: boolean,
  isImportOpen: boolean,
  isExportOpen: boolean,
  mobilePanel: MobilePanel | null,
): ModalSurface {
  switch (true) {
    case isAutosaveDecisionOpen: { return 'autosave'; }
    case isImportOpen: { return 'import'; }
    case isExportOpen: { return 'export'; }
    default: { return mobilePanel; }
  }
}

export function useAutosaveModalArbitration({
  autosave,
  exportButtonRef,
  importButtonRef,
  exportOpen,
  importOpen,
  mobile,
  setExportOpen,
  setImportOpen,
}: AutosaveModalArbitrationOptions) {
  const returnFocusRef = useRef<HTMLElement>(null);
  const autosaveDecisionOpen = autosave.recoveryDraft !== null || autosave.corrupted;
  const surface = activeSurface(autosaveDecisionOpen, importOpen, exportOpen, mobile.activePanel);
  const mobilePanel = surface === 'layers' || surface === 'properties' ? surface : null;

  const closeExport = useCallback((shouldRestoreFocus = true) => {
    setExportOpen(false);
    if (shouldRestoreFocus) window.setTimeout(() => exportButtonRef.current?.focus(), 0);
  }, [exportButtonRef, setExportOpen]);

  const preemptSurface = () => {
    if (importOpen) {
      returnFocusRef.current = importButtonRef.current;
      setImportOpen(false);
    } else if (exportOpen) {
      returnFocusRef.current = exportButtonRef.current;
      closeExport(false);
    } else if (mobile.activePanel) {
      returnFocusRef.current = mobile.activePanel === 'layers'
        ? mobile.layersTriggerRef.current
        : mobile.propertiesTriggerRef.current;
      mobile.closePanel(mobile.activePanel, false);
    } else if (!returnFocusRef.current?.isConnected) {
      returnFocusRef.current = mobile.projectTitleRef.current;
    }
  };

  return { closeExport, mobilePanel, preemptSurface, returnFocusRef, surface };
}
