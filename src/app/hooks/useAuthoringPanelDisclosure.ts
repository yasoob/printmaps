import { useCallback, useEffect, useRef, useState } from "react";
import { trackEditorAction } from "../../analytics/editorAnalytics";
import { useLatestValue } from "./useLatestValue";

export function useAuthoringPanelDisclosure(pointCount: number, isCompactViewport: boolean, shouldAutoCollapse = true) {
  const [settingsOpen, setSettingsOpen] = useState(!isCompactViewport);
  const previousPointCountRef = useRef(pointCount);
  const previousCompactRef = useRef(isCompactViewport);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const getSettingsOpen = useLatestValue(settingsOpen);

  useEffect(() => {
    const didAddPoint = pointCount > previousPointCountRef.current;
    const hasEnteredCompactViewport = isCompactViewport && !previousCompactRef.current;
    previousPointCountRef.current = pointCount;
    previousCompactRef.current = isCompactViewport;
    if (hasEnteredCompactViewport || (didAddPoint && shouldAutoCollapse)) setSettingsOpen(false);
  }, [isCompactViewport, pointCount, shouldAutoCollapse]);
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
