import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Download,
  Eye,
  EyeOff,
  Frame,
  GripVertical,
  Hand,
  Layers3,
  Lock,
  MapPin,
  MousePointer2,
  PanelLeftClose,
  SlidersHorizontal,
  X,
  PenLine,
  Redo2,
  Route,
  Save,
  Search,
  Share2,
  Shapes,
  Type,
  Undo2,
  Unlock,
} from 'lucide-react';
import { useStore } from 'zustand';
import type { ContentLayer, LayerType, PageSettings, StandardPagePreset } from '../domain/project';
import { startPreviewDownload, type PreviewPngExporter } from '../export/previewPng';
import { MapCanvas } from '../map/MapCanvas';
import { createProjectStore } from './store';

const layerIcons: Record<LayerType, typeof Route> = {
  route: Route,
  poi: MapPin,
  shape: Shapes,
  basemap: Layers3,
};

const tools = [
  { id: 'select', label: 'Select', shortcut: 'V', icon: MousePointer2 },
  { id: 'pan', label: 'Pan', shortcut: 'H', icon: Hand },
  { id: 'route', label: 'Route', shortcut: 'R', icon: Route },
  { id: 'pin', label: 'Pin', shortcut: 'P', icon: MapPin },
  { id: 'shape', label: 'Shape', shortcut: 'S', icon: Shapes },
  { id: 'text', label: 'Text', shortcut: 'T', icon: Type },
  { id: 'frame', label: 'Fit page', shortcut: 'Shift+1', icon: Frame, command: true },
];

type MobilePanel = 'layers' | 'properties';

function useMobilePanels() {
  const [mobilePanel, setMobilePanel] = useState<MobilePanel | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(() => (
    typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 760px)').matches
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
      callback();
    }, reducedMotion ? 0 : delay);
  };

  const closePanel = (panel: MobilePanel | null = activePanel) => {
    setMobilePanel(null);
    if (panel && isMobileViewport) {
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
    const mediaQuery = window.matchMedia('(max-width: 760px)');
    const handleChange = (event: MediaQueryListEvent) => {
      const hadOpenDialog = document.querySelector('[aria-modal="true"]') !== null;
      setIsMobileViewport(event.matches);
      if (!event.matches) {
        if (focusTimerRef.current !== null) {
          window.clearTimeout(focusTimerRef.current);
          focusTimerRef.current = null;
        }
        setMobilePanel(null);
        if (hadOpenDialog) requestAnimationFrame(() => projectTitleRef.current?.focus());
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

export function App() {
  const [projectStore] = useState(() => createProjectStore());
  const project = useStore(projectStore);
  const [activeTool, setActiveTool] = useState('select');
  const [previewedLayerId, setPreviewedLayerId] = useState<string | null>(null);
  const [fitRequest, setFitRequest] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [mapExporter, setMapExporter] = useState<{ run: PreviewPngExporter } | null>(null);
  const draggedLayerIdRef = useRef<string | null>(null);
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const {
    activePanel: activeMobilePanel,
    closePanel: closeMobilePanel,
    handlePanelKeyDown: handleMobilePanelKeyDown,
    layersPanelRef,
    layersTriggerRef,
    openPanel: openMobilePanel,
    projectTitleRef,
    propertiesPanelRef,
    propertiesTriggerRef,
  } = useMobilePanels();

  const layers = project.document.layers;
  const mapPreviewedLayerId = previewedLayerId !== null && layers.some((layer) => (
    layer.id === previewedLayerId && layer.visible && layer.geometry
  )) ? previewedLayerId : null;
  const selectedLayer = layers.find((layer) => layer.id === project.selectedId) ?? null;
  const selectedIndex = selectedLayer
    ? layers.findIndex((layer) => layer.id === selectedLayer.id)
    : -1;
  const selectLayer = project.selectLayer;
  const clearSelection = useCallback(() => selectLayer(null), [selectLayer]);
  const handleExporterChange = useCallback((exporter: PreviewPngExporter | null) => {
    setMapExporter(exporter ? { run: exporter } : null);
  }, []);
  const closeExport = () => {
    setExportOpen(false);
    window.setTimeout(() => exportButtonRef.current?.focus(), 0);
  };

  return (
    <>
      <main className="studio-shell" inert={exportOpen}>
      <header className="topbar" inert={activeMobilePanel !== null}>
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true"><PenLine size={16} strokeWidth={2} /></div>
          <span className="brand-name">Print Map Studio</span>
          <span className="top-divider" />
          <button ref={projectTitleRef} className="project-title" type="button">{project.document.title}</button>
        </div>
        <div className="history-actions" aria-label="History">
          <button className="icon-button" type="button" aria-label="Undo" title="Undo" disabled={!project.canUndo} onClick={project.undo}><Undo2 size={15} /></button>
          <button className="icon-button" type="button" aria-label="Redo" title="Redo" disabled={!project.canRedo} onClick={project.redo}><Redo2 size={15} /></button>
        </div>
        <div className="document-actions">
          <button className="quiet-button" type="button"><Save size={14} /> Save</button>
          <button className="quiet-button" type="button"><Share2 size={14} /> Share</button>
          <button ref={exportButtonRef} className="primary-button" type="button" onClick={() => setExportOpen(true)}><Download size={14} /> Export</button>
        </div>
      </header>

      <aside
        ref={layersPanelRef}
        id="layers-panel"
        className={`left-sidebar${activeMobilePanel === 'layers' ? ' is-mobile-open' : ''}`}
        aria-label="Layers sidebar"
        role={activeMobilePanel === 'layers' ? 'dialog' : undefined}
        aria-modal={activeMobilePanel === 'layers' ? true : undefined}
        inert={activeMobilePanel === 'properties'}
        onKeyDown={(event) => handleMobilePanelKeyDown(event, 'layers')}
      >
        <div className="panel-header">
          <span>Layers</span>
          <button className="icon-button" type="button" aria-label="Collapse layers" onClick={() => closeMobilePanel('layers')}><PanelLeftClose size={15} /></button>
        </div>
        <label className="panel-search">
          <Search size={14} aria-hidden="true" />
          <input aria-label="Filter layers" placeholder="Filter layers" />
        </label>
        <ul className="layer-tree" aria-label="Map layers">
          {layers.map((layer, index) => {
              const Icon = layerIcons[layer.type];
              const selected = project.selectedId === layer.id;
              return (
                <li
                  className={`layer-row${selected ? ' is-selected' : ''}`}
                  key={layer.id}
                  onMouseEnter={() => setPreviewedLayerId(layer.visible && layer.geometry ? layer.id : null)}
                  onMouseLeave={() => setPreviewedLayerId((current) => current === layer.id ? null : current)}
                >
                  <button
                    className="layer-visibility"
                    type="button"
                    aria-label={`${layer.visible ? 'Hide' : 'Show'} ${layer.name}`}
                    onClick={() => {
                      setPreviewedLayerId((current) => current === layer.id ? null : current);
                      project.toggleLayerVisibility(layer.id);
                    }}
                  >
                    {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  <button className="layer-select" type="button" data-layer-select={layer.id} aria-current={selected ? 'true' : undefined} onClick={() => { project.selectLayer(layer.id); if (activeMobilePanel === 'layers') closeMobilePanel('layers'); }} aria-label={`Select ${layer.name}`}>
                    <Icon size={14} />
                    <span>{layer.name}</span>
                  </button>
                  <button
                    className="layer-lock"
                    type="button"
                    aria-label={`${layer.locked ? 'Unlock' : 'Lock'} ${layer.name}`}
                    onClick={() => project.toggleLayerLock(layer.id)}
                  >
                    {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
                  </button>
                  <button
                    className="layer-drag"
                    type="button"
                    draggable
                    aria-label={`Reorder ${layer.name}`}
                    title="Drag to reorder · Alt+Arrow keys"
                    onKeyDown={(event) => {
                      if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
                        event.preventDefault();
                        project.moveLayer(layer.id, index + (event.key === 'ArrowUp' ? -1 : 1));
                      }
                    }}
                    onDragStart={() => { draggedLayerIdRef.current = layer.id; }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (draggedLayerIdRef.current) project.moveLayer(draggedLayerIdRef.current, layers.findIndex((candidate) => candidate.id === layer.id));
                      draggedLayerIdRef.current = null;
                    }}
                    onDragEnd={() => { draggedLayerIdRef.current = null; }}
                  >
                    <GripVertical size={13} />
                  </button>
                </li>
              );
          })}
        </ul>
        <div className="sidebar-footer"><span>{layers.length} layers</span><span>Local draft</span></div>
      </aside>

      <section className="canvas-region" inert={activeMobilePanel !== null}>
        <MapCanvas
          layers={layers.filter((layer) => layer.geometry)}
          selectedId={project.selectedId}
          previewedId={mapPreviewedLayerId}
          onLayerSelect={project.selectLayer}
          onBackgroundClick={clearSelection}
          onExporterChange={handleExporterChange}
          fitRequest={fitRequest}
          orientation={project.document.page.orientation}
          page={project.document.page}
        />
        <div className="mobile-panel-actions" aria-label="Editor panels">
          <button ref={layersTriggerRef} type="button" aria-label="Open layers" aria-controls="layers-panel" aria-expanded={activeMobilePanel === 'layers'} onClick={() => openMobilePanel('layers')}><Layers3 size={15} /><span>Layers</span></button>
          <button ref={propertiesTriggerRef} type="button" aria-label="Open properties" aria-controls="properties-panel" aria-expanded={activeMobilePanel === 'properties'} onClick={() => openMobilePanel('properties')}><SlidersHorizontal size={15} /><span>Properties</span></button>
        </div>
        <nav className="tool-palette" aria-label="Map tools">
          {tools.map(({ id, label, shortcut, icon: Icon, command }, index) => (
            <div className="tool-slot" key={id}>
              {index === 2 && <span className="tool-separator" />}
              <button
                className={`tool-button${!command && activeTool === id ? ' is-active' : ''}`}
                type="button"
                aria-label={`${label} (${shortcut})`}
                aria-pressed={command ? undefined : activeTool === id}
                title={`${label} · ${shortcut}`}
                onClick={() => {
                  if (command) {
                    setFitRequest((request) => request + 1);
                  } else {
                    setActiveTool(id);
                  }
                }}
              >
                <Icon size={17} strokeWidth={1.8} />
              </button>
            </div>
          ))}
        </nav>
        <div className="canvas-status" aria-label="Canvas status">
          <button type="button">100%</button><span /> <button type="button">1:20,000</button>
        </div>
      </section>

      {activeMobilePanel && <button className="mobile-panel-backdrop" type="button" aria-label="Close open panel" onClick={() => closeMobilePanel()} />}

      <aside
        ref={propertiesPanelRef}
        id="properties-panel"
        className={`right-sidebar${activeMobilePanel === 'properties' ? ' is-mobile-open' : ''}`}
        aria-label="Properties sidebar"
        role={activeMobilePanel === 'properties' ? 'dialog' : undefined}
        aria-modal={activeMobilePanel === 'properties' ? true : undefined}
        inert={activeMobilePanel === 'layers'}
        onKeyDown={(event) => handleMobilePanelKeyDown(event, 'properties')}
      >
        <button className="mobile-drawer-close" type="button" aria-label="Close properties" onClick={() => closeMobilePanel('properties')}><X size={16} /></button>
        {selectedLayer ? (
          <LayerProperties
            layer={selectedLayer}
            onRename={(name) => project.renameLayer(selectedLayer.id, name)}
            onOpacityChange={(opacity) => project.setLayerOpacity(selectedLayer.id, opacity)}
            onToggleVisibility={() => {
              setPreviewedLayerId((current) => current === selectedLayer.id ? null : current);
              project.toggleLayerVisibility(selectedLayer.id);
            }}
            onToggleLock={() => project.toggleLayerLock(selectedLayer.id)}
            onDuplicate={() => {
              project.duplicateLayer(selectedLayer.id);
              window.setTimeout(() => {
                const focusTarget = activeMobilePanel === 'properties'
                  ? propertiesPanelRef.current?.querySelector<HTMLElement>('[aria-label="Layer menu"]')
                  : [...document.querySelectorAll<HTMLElement>('[data-layer-select]')]
                    .find((element) => element.getAttribute('aria-current') === 'true');
                focusTarget?.focus();
              }, 0);
            }}
            onDelete={() => {
              const focusLayer = layers[selectedIndex + 1] ?? layers[selectedIndex - 1];
              setPreviewedLayerId((current) => current === selectedLayer.id ? null : current);
              project.deleteLayer(selectedLayer.id);
              window.setTimeout(() => {
                const focusTarget = activeMobilePanel === 'properties'
                  ? propertiesPanelRef.current?.querySelector<HTMLElement>('[aria-label="Layer menu"], [data-project-heading]')
                  : focusLayer
                    ? [...document.querySelectorAll<HTMLElement>('[data-layer-select]')]
                      .find((element) => element.dataset.layerSelect === focusLayer.id)
                    : document.querySelector<HTMLElement>('[data-project-heading]');
                focusTarget?.focus();
              }, 0);
            }}
          />
        ) : (
          <ProjectProperties
            page={project.document.page}
            onDimensionChange={project.setPageDimension}
            onOrientationChange={project.setPageOrientation}
            onPresetChange={project.setPagePreset}
          />
        )}
      </aside>
      </main>
      {exportOpen && (
        <ExportDialog
          exporter={mapExporter?.run ?? null}
          filename={`${project.document.id}.png`}
          onClose={closeExport}
        />
      )}
    </>
  );
}

type ExportDialogProps = {
  exporter: PreviewPngExporter | null;
  filename: string;
  onClose: () => void;
};

function ExportDialog({ exporter, filename, onClose }: ExportDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const downloadButtonRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Ready to export the current print-frame preview.');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    downloadButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (busy) dialogRef.current?.focus();
  }, [busy]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (!busy) onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])];
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
    if (event.shiftKey && currentIndex <= 0) {
      event.preventDefault();
      focusable.at(-1)?.focus();
    } else if (!event.shiftKey && currentIndex === focusable.length - 1) {
      event.preventDefault();
      focusable[0]?.focus();
    }
  };

  const download = async () => {
    if (!exporter) {
      setError('The live map preview is not ready yet. Wait for the map to load and try again.');
      return;
    }

    setBusy(true);
    setError(null);
    setStatus('Preparing PNG…');
    try {
      const result = await exporter();
      startPreviewDownload(result.blob, filename);
      setStatus(`Download started for ${result.width} × ${result.height} PNG.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'PNG export failed.');
      setStatus('Export failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="export-overlay">
      <div className="export-backdrop" aria-hidden="true" onClick={busy ? undefined : onClose} />
      <div
        ref={dialogRef}
        className="export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        aria-busy={busy}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="export-dialog-header">
          <div><span className="eyebrow">Export</span><h2 id="export-title">Export map</h2></div>
          <button className="icon-button" type="button" aria-label="Close export" disabled={busy} onClick={onClose}><X size={16} /></button>
        </div>
        <div className="export-dialog-body">
          <strong>PNG preview</strong>
          <p>Downloads the current print-frame preview at the browser’s rendered resolution. High-resolution tiled PNG, PDF, and layered SVG remain upcoming export stages.</p>
          <p role="status">{status}</p>
          {error && <p className="export-error" role="alert">{error}</p>}
        </div>
        <div className="export-dialog-actions">
          <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
          <button ref={downloadButtonRef} className="primary-button" type="button" disabled={busy} onClick={download}>{busy ? 'Preparing…' : 'Download PNG'}</button>
        </div>
      </div>
    </div>
  );
}

function isValidPageDimension(draft: string) {
  const value = Number(draft);
  return draft.trim() !== '' && Number.isFinite(value) && value > 0;
}

function PageDimensionField({
  label,
  ariaLabel,
  dimension,
  value,
  onCommit,
}: {
  label: string;
  ariaLabel: string;
  dimension: 'widthMm' | 'heightMm';
  value: number;
  onCommit: (dimension: 'widthMm' | 'heightMm', value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const dirtyRef = useRef(false);
  const commit = () => {
    if (!dirtyRef.current) return;
    if (!isValidPageDimension(draft)) {
      setDraft(String(value));
      dirtyRef.current = false;
      return;
    }
    const nextValue = Number(draft);
    setDraft(String(nextValue));
    dirtyRef.current = false;
    onCommit(dimension, nextValue);
  };

  return (
    <label>
      <span>{label}</span>
      <input
        aria-label={ariaLabel}
        inputMode="decimal"
        value={draft}
        aria-invalid={!isValidPageDimension(draft)}
        onChange={(event) => {
          setDraft(event.target.value);
          dirtyRef.current = true;
        }}
        onBlur={commit}
      />
      <small>mm</small>
    </label>
  );
}

function ProjectProperties({
  page,
  onDimensionChange,
  onOrientationChange,
  onPresetChange,
}: {
  page: PageSettings;
  onDimensionChange: (dimension: 'widthMm' | 'heightMm', value: number) => void;
  onOrientationChange: (orientation: PageSettings['orientation']) => void;
  onPresetChange: (preset: StandardPagePreset) => void;
}) {
  return (
    <div className="properties-panel">
      <div className="properties-title"><div><span className="eyebrow">Properties</span><h2 data-project-heading tabIndex={-1}>Project</h2></div><button className="icon-button" type="button" aria-label="Project menu">•••</button></div>
      <PropertySection title="Page">
        <PropertyRow label="Preset"><select aria-label="Page preset" value={page.preset} onChange={(event) => onPresetChange(event.target.value as StandardPagePreset)}><option>A4</option><option>A3</option><option>Letter</option><option disabled>Custom</option></select></PropertyRow>
        <div className="paired-fields">
          <PageDimensionField
            key={`width-${page.widthMm}-${page.preset}`}
            label="W"
            ariaLabel="Page width"
            dimension="widthMm"
            value={page.widthMm}
            onCommit={onDimensionChange}
          />
          <PageDimensionField
            key={`height-${page.heightMm}-${page.preset}`}
            label="H"
            ariaLabel="Page height"
            dimension="heightMm"
            value={page.heightMm}
            onCommit={onDimensionChange}
          />
        </div>
        <PropertyRow label="Orientation"><div className="segmented"><button className={page.orientation === 'landscape' ? 'is-active' : undefined} type="button" aria-pressed={page.orientation === 'landscape'} onClick={() => onOrientationChange('landscape')}>Landscape</button><button className={page.orientation === 'portrait' ? 'is-active' : undefined} type="button" aria-pressed={page.orientation === 'portrait'} onClick={() => onOrientationChange('portrait')}>Portrait</button></div></PropertyRow>
      </PropertySection>
      <PropertySection title="Map">
        <PropertyRow label="Style"><select aria-label="Map style" defaultValue="Liberty"><option>Liberty</option><option>Positron</option><option>Dark</option></select></PropertyRow>
        <PropertyRow label="Bearing"><NumberField value="0" suffix="°" ariaLabel="Bearing" /></PropertyRow>
        <PropertyRow label="Pitch"><NumberField value="0" suffix="°" ariaLabel="Pitch" /></PropertyRow>
        <PropertyRow label="Text scale"><NumberField value="100" suffix="%" ariaLabel="Text scale" /></PropertyRow>
      </PropertySection>
      <PropertySection title="Export">
        <PropertyRow label="Resolution"><select aria-label="Export resolution" value="Browser preview" disabled><option>Browser preview</option></select></PropertyRow>
        <label className="check-row"><input type="checkbox" checked disabled readOnly /> Include map attribution</label>
      </PropertySection>
    </div>
  );
}

type LayerPropertiesProps = {
  layer: ContentLayer;
  onRename: (name: string) => void;
  onOpacityChange: (opacity: number) => void;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

function LayerProperties({
  layer,
  onRename,
  onOpacityChange,
  onToggleVisibility,
  onToggleLock,
  onDuplicate,
  onDelete,
}: LayerPropertiesProps) {
  const [nameEdit, setNameEdit] = useState(() => ({ source: layer.name, value: layer.name }));
  const [opacityEdit, setOpacityEdit] = useState(() => ({ source: layer.opacity, value: String(layer.opacity) }));
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const nameDraft = nameEdit.source === layer.name ? nameEdit.value : layer.name;
  const opacityDraft = opacityEdit.source === layer.opacity ? opacityEdit.value : String(layer.opacity);

  const commitName = () => {
    const name = nameDraft.trim();
    if (!name) {
      setNameEdit({ source: layer.name, value: layer.name });
      return;
    }
    setNameEdit({ source: name, value: name });
    onRename(name);
  };

  const commitOpacity = () => {
    const opacity = Number(opacityDraft);
    if (opacityDraft.trim() === '' || !Number.isFinite(opacity)) {
      setOpacityEdit({ source: layer.opacity, value: String(layer.opacity) });
      return;
    }
    const clampedOpacity = Math.max(0, Math.min(100, opacity));
    setOpacityEdit({ source: clampedOpacity, value: String(clampedOpacity) });
    onOpacityChange(clampedOpacity);
  };

  return (
    <div className="properties-panel">
      <div className="properties-title">
        <div><span className="eyebrow">Layer properties</span><h2>{layer.name}</h2></div>
        <button
          ref={menuButtonRef}
          className="icon-button"
          type="button"
          aria-label="Layer menu"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => {
            if (menuOpen) {
              setMenuOpen(false);
            } else {
              setMenuOpen(true);
              queueMicrotask(() => menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
            }
          }}
        >•••</button>
        {menuOpen && (
          <div
            ref={menuRef}
            className="layer-menu"
            role="menu"
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
                const currentIndex = items.indexOf(document.activeElement as HTMLElement);
                const direction = event.key === 'ArrowDown' ? 1 : -1;
                items[(currentIndex + direction + items.length) % items.length]?.focus();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                setMenuOpen(false);
                queueMicrotask(() => menuButtonRef.current?.focus());
              }
            }}
          >
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDuplicate(); }}>Duplicate layer</button>
            <button className="danger-button" type="button" role="menuitem" onClick={onDelete}>Delete layer</button>
          </div>
        )}
      </div>
      <PropertySection title="Layer">
        <PropertyRow label="Name"><input aria-label="Layer name" value={nameDraft} onChange={(event) => setNameEdit({ source: layer.name, value: event.target.value })} onBlur={commitName} /></PropertyRow>
        <PropertyRow label="Opacity"><label className="number-field"><input aria-label="Layer opacity" value={opacityDraft} onChange={(event) => setOpacityEdit({ source: layer.opacity, value: event.target.value })} onBlur={commitOpacity} /><small>%</small></label></PropertyRow>
        <PropertyRow label="Visible"><button aria-label="Toggle layer visibility" className={`toggle${layer.visible ? ' is-on' : ''}`} type="button" aria-pressed={layer.visible} onClick={onToggleVisibility}><span /></button></PropertyRow>
        <PropertyRow label="Locked"><button aria-label="Toggle layer lock" className={`toggle${layer.locked ? ' is-on' : ''}`} type="button" aria-pressed={layer.locked} onClick={onToggleLock}><span /></button></PropertyRow>
      </PropertySection>
      <PropertySection title="Appearance">
        <PropertyRow label="Stroke"><label className="color-field"><span style={{ background: 'var(--studio-route)' }} /><input aria-label="Layer stroke color" value="Route red" readOnly /></label></PropertyRow>
        <PropertyRow label="Width"><NumberField value="3" suffix="px" ariaLabel="Layer stroke width" /></PropertyRow>
        <PropertyRow label="Blend"><select aria-label="Layer blend mode" defaultValue="Normal"><option>Normal</option><option>Multiply</option><option>Screen</option></select></PropertyRow>
      </PropertySection>
    </div>
  );
}

function PropertySection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="property-section"><h3>{title}</h3>{children}</section>;
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="property-row"><span aria-hidden="true">{label}</span><div className="property-control">{children}</div></div>;
}

function NumberField({ value, suffix, ariaLabel }: { value: string; suffix: string; ariaLabel?: string }) {
  return <label className="number-field"><input aria-label={ariaLabel} value={value} readOnly /><small>{suffix}</small></label>;
}
