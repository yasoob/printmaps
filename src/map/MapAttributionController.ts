// OSMF attribution guideline: on a browsable map the credit may collapse automatically after five
// seconds or on interaction, provided an (i) control still reveals it. Any editor interaction outside
// the credit (panning, clicking a tool, typing) collapses it, so it never sits under a tool card.
export const ATTRIBUTION_COLLAPSE_DELAY_MS = 5000;

export function createAttributionController(container: HTMLDivElement) {
  let isInitialized = false;
  let isCollapsed = false;
  let collapseTimer: ReturnType<typeof setTimeout> | null = null;
  const setOpen = (isOpen: boolean) => {
    const attribution = container.querySelector<HTMLDetailsElement>('.maplibregl-ctrl-attrib');
    if (!attribution) return;
    attribution.toggleAttribute('open', isOpen);
    attribution.classList.toggle('maplibregl-compact-show', isOpen);
  };
  const handleEditorInteraction = (event: Event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest('.maplibregl-ctrl-attrib')) collapse();
  };
  const clearTimer = () => {
    if (collapseTimer !== null) clearTimeout(collapseTimer);
    collapseTimer = null;
    document.removeEventListener('pointerdown', handleEditorInteraction, true);
    document.removeEventListener('keydown', handleEditorInteraction, true);
  };
  const collapse = () => {
    clearTimer();
    if (isCollapsed) return;
    isCollapsed = true;
    setOpen(false);
  };
  return {
    destroy: clearTimer,
    // Only user-driven camera changes (they carry an originalEvent) count as interaction.
    handleInteraction: (event?: { originalEvent?: unknown }) => {
      if (isInitialized && event?.originalEvent) collapse();
    },
    initialize: () => {
      if (isInitialized) return;
      isInitialized = true;
      setOpen(true);
      collapseTimer = setTimeout(collapse, ATTRIBUTION_COLLAPSE_DELAY_MS);
      document.addEventListener('pointerdown', handleEditorInteraction, true);
      document.addEventListener('keydown', handleEditorInteraction, true);
    },
  };
}
