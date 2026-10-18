import { useCallback, useRef, useState } from "react";
import { trackEditorAction } from "../../analytics/editorAnalytics";
import { useLatestValue } from "./useLatestValue";

export function useAuthoringPanelDisclosure(pointCount: number, isCompactViewport: boolean, shouldAutoCollapse = true) {
  const [settingsOpen, setSettingsOpen] = useState(!isCompactViewport);
  const [previous, setPrevious] = useState({ pointCount, isCompactViewport });
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const getSettingsOpen = useLatestValue(settingsOpen);

  // Adjusting during render avoids committing the stale expanded panel first.
  if (previous.pointCount !== pointCount || previous.isCompactViewport !== isCompactViewport) {
    const didAddPoint = pointCount > previous.pointCount;
    const hasEnteredCompactViewport = isCompactViewport && !previous.isCompactViewport;
    setPrevious({ pointCount, isCompactViewport });
    if (hasEnteredCompactViewport || (didAddPoint && shouldAutoCollapse)) setSettingsOpen(false);
  }
  const openSettings = useCallback(() => {
    if (!getSettingsOpen()) trackEditorAction("drawingSettingsOpened");
    setSettingsOpen(true);
  }, [getSettingsOpen]);
  const closeSettings = useCallback(() => {
    if (getSettingsOpen()) trackEditorAction("drawingSettingsClosed");
    setSettingsOpen(false);
    queueMicrotask(() => settingsButtonRef.current?.focus());
  }, [getSettingsOpen]);

  return {
    closeSettings,
    openSettings,
    settingsButtonRef,
    settingsOpen,
  };
}
