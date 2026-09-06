export function createAttributionController(container: HTMLDivElement) {
  let isInitialized = false;
  let resizeFrame: number | null = null;
  const viewportQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia('(max-width: 899px)')
    : null;
  const sync = (isMobile: boolean) => {
    const attribution = container.querySelector<HTMLDetailsElement>('.maplibregl-ctrl-attrib');
    if (!attribution) return;
    if (isMobile) {
      attribution.removeAttribute('open');
      attribution.classList.remove('maplibregl-compact-show');
    } else {
      attribution.setAttribute('open', '');
      attribution.classList.add('maplibregl-compact-show');
    }
  };
  const handleViewportChange = (event: MediaQueryListEvent) => {
    if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = null;
      sync(event.matches);
    });
  };
  const handleDrag = () => {
    if (viewportQuery?.matches) sync(true);
  };
  return {
    destroy: () => {
      viewportQuery?.removeEventListener('change', handleViewportChange);
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
    },
    handleDrag,
    initialize: () => {
      if (isInitialized) return;
      sync(viewportQuery?.matches ?? false);
      isInitialized = true;
    },
    listen: () => viewportQuery?.addEventListener('change', handleViewportChange),
  };
}
