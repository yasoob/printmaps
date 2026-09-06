import { useCallback, useEffect, useRef, useState } from "react";

export function useAuthoringPanelDisclosure(pointCount: number, isCompactViewport: boolean, shouldAutoCollapse = true) {
  const [settingsOpen, setSettingsOpen] = useState(!isCompactViewport);
  const previousPointCountRef = useRef(pointCount);
  const previousCompactRef = useRef(isCompactViewport);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const didAddPoint = pointCount > previousPointCountRef.current;
    const hasEnteredCompactViewport = isCompactViewport && !previousCompactRef.current;
    previousPointCountRef.current = pointCount;
    previousCompactRef.current = isCompactViewport;
    if (hasEnteredCompactViewport || (didAddPoint && shouldAutoCollapse)) setSettingsOpen(false);
  }, [isCompactViewport, pointCount, shouldAutoCollapse]);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    queueMicrotask(() => settingsButtonRef.current?.focus());
  }, []);

  return {
    closeSettings,
    openSettings,
    settingsButtonRef,
    settingsOpen,
  };
}
