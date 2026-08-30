import { useEffect, useRef, useState } from "react";

export function useMobileRoutePanel(pointCount: number) {
  const [settingsOpen, setSettingsOpen] = useState(true);
  const previousPointCountRef = useRef(pointCount);

  useEffect(() => {
    const didAddPoint = pointCount > previousPointCountRef.current;
    previousPointCountRef.current = pointCount;
    if (didAddPoint) setSettingsOpen(false);
  }, [pointCount]);

  return {
    openSettings: () => setSettingsOpen(true),
    settingsOpen,
  };
}
