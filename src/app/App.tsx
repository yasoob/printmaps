import { useCallback, useRef, useState } from 'react';
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
import type { ContentLayer, LayerType } from '../domain/project';
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

export function App() {
  const [projectStore] = useState(() => createProjectStore());
  const project = useStore(projectStore);
  const [activeTool, setActiveTool] = useState('select');
  const [fitRequest, setFitRequest] = useState(0);
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const draggedLayerIdRef = useRef<string | null>(null);

  const layers = project.document.layers;
  const selectedLayer = layers.find((layer) => layer.id === project.selectedId) ?? null;
  const selectedIndex = selectedLayer
    ? layers.findIndex((layer) => layer.id === selectedLayer.id)
    : -1;
  const selectLayer = project.selectLayer;
  const clearSelection = useCallback(() => selectLayer(null), [selectLayer]);

  return (
    <main className="studio-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true"><PenLine size={16} strokeWidth={2} /></div>
          <span className="brand-name">Print Map Studio</span>
          <span className="top-divider" />
          <button className="project-title" type="button">{project.document.title}</button>
        </div>
        <div className="history-actions" aria-label="History">
          <button className="icon-button" type="button" aria-label="Undo" title="Undo" disabled={!project.canUndo} onClick={project.undo}><Undo2 size={15} /></button>
          <button className="icon-button" type="button" aria-label="Redo" title="Redo" disabled={!project.canRedo} onClick={project.redo}><Redo2 size={15} /></button>
        </div>
        <div className="document-actions">
          <button className="quiet-button" type="button"><Save size={14} /> Save</button>
          <button className="quiet-button" type="button"><Share2 size={14} /> Share</button>
          <button className="primary-button" type="button"><Download size={14} /> Export</button>
        </div>
      </header>

      <aside className="left-sidebar" aria-label="Layers sidebar">
        <div className="panel-header">
          <span>Layers</span>
          <button className="icon-button" type="button" aria-label="Collapse layers"><PanelLeftClose size={15} /></button>
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
                <li className={`layer-row${selected ? ' is-selected' : ''}`} key={layer.id}>
                  <button
                    className="layer-visibility"
                    type="button"
                    aria-label={`${layer.visible ? 'Hide' : 'Show'} ${layer.name}`}
                    onClick={() => project.toggleLayerVisibility(layer.id)}
                  >
                    {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  <button className="layer-select" type="button" data-layer-select={layer.id} aria-current={selected ? 'true' : undefined} onClick={() => project.selectLayer(layer.id)} aria-label={`Select ${layer.name}`}>
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

      <section className="canvas-region">
        <MapCanvas onBackgroundClick={clearSelection} fitRequest={fitRequest} orientation={orientation} />
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

      <aside className="right-sidebar" aria-label="Properties sidebar">
        {selectedLayer ? (
          <LayerProperties
            layer={selectedLayer}
            onRename={(name) => project.renameLayer(selectedLayer.id, name)}
            onOpacityChange={(opacity) => project.setLayerOpacity(selectedLayer.id, opacity)}
            onToggleVisibility={() => project.toggleLayerVisibility(selectedLayer.id)}
            onToggleLock={() => project.toggleLayerLock(selectedLayer.id)}
            onDuplicate={() => {
              project.duplicateLayer(selectedLayer.id);
              queueMicrotask(() => {
                [...document.querySelectorAll<HTMLElement>('[data-layer-select]')]
                  .find((element) => element.getAttribute('aria-current') === 'true')
                  ?.focus();
              });
            }}
            onDelete={() => {
              const focusLayer = layers[selectedIndex + 1] ?? layers[selectedIndex - 1];
              project.deleteLayer(selectedLayer.id);
              queueMicrotask(() => {
                const focusTarget = focusLayer
                  ? [...document.querySelectorAll<HTMLElement>('[data-layer-select]')]
                    .find((element) => element.dataset.layerSelect === focusLayer.id)
                  : document.querySelector<HTMLElement>('[data-project-heading]');
                focusTarget?.focus();
              });
            }}
          />
        ) : (
          <ProjectProperties orientation={orientation} onOrientationChange={setOrientation} />
        )}
      </aside>
    </main>
  );
}

function ProjectProperties({
  orientation,
  onOrientationChange,
}: {
  orientation: 'landscape' | 'portrait';
  onOrientationChange: (orientation: 'landscape' | 'portrait') => void;
}) {
  return (
    <div className="properties-panel">
      <div className="properties-title"><div><span className="eyebrow">Properties</span><h2 data-project-heading tabIndex={-1}>Project</h2></div><button className="icon-button" type="button" aria-label="Project menu">•••</button></div>
      <PropertySection title="Page">
        <PropertyRow label="Preset"><select aria-label="Page preset" defaultValue="A4"><option>A4</option><option>A3</option><option>Letter</option><option>Custom</option></select></PropertyRow>
        <div className="paired-fields"><label><span>W</span><input aria-label="Page width" value={orientation === 'landscape' ? '297' : '210'} readOnly /><small>mm</small></label><label><span>H</span><input aria-label="Page height" value={orientation === 'landscape' ? '210' : '297'} readOnly /><small>mm</small></label></div>
        <PropertyRow label="Orientation"><div className="segmented"><button className={orientation === 'landscape' ? 'is-active' : undefined} type="button" aria-pressed={orientation === 'landscape'} onClick={() => onOrientationChange('landscape')}>Landscape</button><button className={orientation === 'portrait' ? 'is-active' : undefined} type="button" aria-pressed={orientation === 'portrait'} onClick={() => onOrientationChange('portrait')}>Portrait</button></div></PropertyRow>
      </PropertySection>
      <PropertySection title="Map">
        <PropertyRow label="Style"><select aria-label="Map style" defaultValue="Liberty"><option>Liberty</option><option>Positron</option><option>Dark</option></select></PropertyRow>
        <PropertyRow label="Bearing"><NumberField value="0" suffix="°" ariaLabel="Bearing" /></PropertyRow>
        <PropertyRow label="Pitch"><NumberField value="0" suffix="°" ariaLabel="Pitch" /></PropertyRow>
        <PropertyRow label="Text scale"><NumberField value="100" suffix="%" ariaLabel="Text scale" /></PropertyRow>
      </PropertySection>
      <PropertySection title="Export">
        <PropertyRow label="Resolution"><select aria-label="Export resolution" defaultValue="300 dpi"><option>150 dpi</option><option>300 dpi</option><option>600 dpi</option></select></PropertyRow>
        <label className="check-row"><input type="checkbox" defaultChecked /> Include map attribution</label>
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
