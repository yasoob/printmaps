import { useCallback, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { ProjectAutosaveState } from '../../storage/useProjectAutosave';
import type { MobilePanel, useMobilePanels } from './useMobilePanels';

type MobilePanels = ReturnType<typeof useMobilePanels>;
type ModalSurface = 'autosave' | 'export' | MobilePanel | null;

type AutosaveModalArbitrationOptions = {
  autosave: ProjectAutosaveState;
  exportButtonRef: RefObject<HTMLButtonElement | null>;
  exportOpen: boolean;
  mobile: MobilePanels;
  setExportOpen: Dispatch<SetStateAction<boolean>>;
};

export function useAutosaveModalArbitration({
  autosave,
  exportButtonRef,
  exportOpen,
  mobile,
  setExportOpen,
}: AutosaveModalArbitrationOptions) {
  const returnFocusRef = useRef<HTMLElement>(null);
  const autosaveDecisionOpen = autosave.recoveryDraft !== null || autosave.corrupted;
  const surface: ModalSurface = autosaveDecisionOpen
    ? 'autosave'
    : (exportOpen
      ? 'export'
      : mobile.activePanel);
  const mobilePanel = surface === 'layers' || surface === 'properties' ? surface : null;

  const closeExport = useCallback((shouldRestoreFocus = true) => {
    setExportOpen(false);
    if (shouldRestoreFocus) window.setTimeout(() => exportButtonRef.current?.focus(), 0);
  }, [exportButtonRef, setExportOpen]);

  const preemptSurface = () => {
    if (exportOpen) {
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
