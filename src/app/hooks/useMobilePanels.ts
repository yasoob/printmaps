import { useEffect, useRef, useState } from 'react';

export type MobilePanel = 'layers' | 'properties';

const MOBILE_VIEWPORT_QUERY = '(max-width: 899px)';

export function useMobilePanels() {
  const [mobilePanel, setMobilePanel] = useState<MobilePanel | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(() => (
    typeof window.matchMedia === 'function' && window.matchMedia(MOBILE_VIEWPORT_QUERY).matches
  ));
  const layersTriggerRef = useRef<HTMLButtonElement>(null);
  const propertiesTriggerRef = useRef<HTMLButtonElement>(null);
  const layersPanelRef = useRef<HTMLElement>(null);
  const propertiesPanelRef = useRef<HTMLElement>(null);
  const projectTitleRef = useRef<HTMLButtonElement>(null);
  const focusTimerRef = useRef<number | null>(null);
  const activePanel = isMobileViewport ? mobilePanel : null;

  const getPanelElements = (panel: MobilePanel) => {
    const panelElement = panel === 'layers' ? layersPanelRef.current : propertiesPanelRef.current;
    return panelElement
      ? [...panelElement.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      : [];
  };

  const scheduleFocus = (callback: () => void, delay = 180) => {
    if (focusTimerRef.current !== null) window.clearTimeout(focusTimerRef.current);
    const reducedMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    focusTimerRef.current = window.setTimeout(() => {
      focusTimerRef.current = null;
      if (document.querySelector('.recovery-dialog')) return;
      callback();
    }, reducedMotion ? 0 : delay);
  };

  const closePanel = (panel: MobilePanel | null = activePanel, shouldRestoreFocus = true) => {
    if (focusTimerRef.current !== null) {
      window.clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }
    setMobilePanel(null);
    if (shouldRestoreFocus && panel && isMobileViewport) {
      scheduleFocus(() => (panel === 'layers' ? layersTriggerRef.current : propertiesTriggerRef.current)?.focus(), 32);
    }
  };

  const openPanel = (panel: MobilePanel) => {
    if (!isMobileViewport) return;
    if (activePanel === panel) {
      closePanel(panel);
      return;
    }
    setMobilePanel(panel);
    scheduleFocus(() => getPanelElements(panel)[0]?.focus());
  };

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLElement>, panel: MobilePanel) => {
    if (activePanel !== panel) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closePanel(panel);
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = getPanelElements(panel);
    if (focusable.length === 0) return;
    const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
    if (event.shiftKey && currentIndex <= 0) {
      event.preventDefault();
      focusable.at(-1)?.focus();
    } else if (!event.shiftKey && currentIndex === focusable.length - 1) {
      event.preventDefault();
      focusable[0]?.focus();
    }
  };

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      const isHadOpenDialog = document.querySelector('[aria-modal="true"]') !== null;
      setIsMobileViewport(event.matches);
      if (!event.matches) {
        if (focusTimerRef.current !== null) {
          window.clearTimeout(focusTimerRef.current);
          focusTimerRef.current = null;
        }
        setMobilePanel(null);
        if (isHadOpenDialog) requestAnimationFrame(() => projectTitleRef.current?.focus());
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => () => {
    if (focusTimerRef.current !== null) window.clearTimeout(focusTimerRef.current);
  }, []);

  return {
    activePanel,
    closePanel,
    handlePanelKeyDown,
    layersPanelRef,
    layersTriggerRef,
    openPanel,
    projectTitleRef,
    propertiesPanelRef,
    propertiesTriggerRef,
  };
}
