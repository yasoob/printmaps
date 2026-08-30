import { useCallback, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { MobilePanel, useMobilePanels } from './useMobilePanels';

type MobilePanels = ReturnType<typeof useMobilePanels>;
type ModalSurface = 'export' | 'import' | MobilePanel | null;

type ModalSurfaceOptions = {
  exportButtonRef: RefObject<HTMLButtonElement | null>;
  exportOpen: boolean;
  importOpen: boolean;
  mobile: MobilePanels;
  setExportOpen: Dispatch<SetStateAction<boolean>>;
};

function activeSurface(
  isImportOpen: boolean,
  isExportOpen: boolean,
  mobilePanel: MobilePanel | null,
): ModalSurface {
  switch (true) {
    case isImportOpen: { return 'import'; }
    case isExportOpen: { return 'export'; }
    default: { return mobilePanel; }
  }
}

export function useModalSurfaces({
  exportButtonRef,
  exportOpen,
  importOpen,
  mobile,
  setExportOpen,
}: ModalSurfaceOptions) {
  const surface = activeSurface(importOpen, exportOpen, mobile.activePanel);
  const mobilePanel = surface === 'layers' || surface === 'properties' ? surface : null;

  const closeExport = useCallback((shouldRestoreFocus = true) => {
    setExportOpen(false);
    if (shouldRestoreFocus) window.setTimeout(() => exportButtonRef.current?.focus(), 0);
  }, [exportButtonRef, setExportOpen]);

  return { closeExport, mobilePanel, surface };
}
