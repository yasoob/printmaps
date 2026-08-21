import { useCallback, useState } from 'react';
import {
  BringToFront,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  Frame,
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
import { MapCanvas } from '../map/MapCanvas';

type LayerType = 'route' | 'poi' | 'shape' | 'basemap';

type Layer = {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;
  opacity: number;
};

const initialLayers: Layer[] = [
  { id: 'route-01', name: 'Route 01', type: 'route', visible: true, locked: false, opacity: 100 },
  { id: 'poi-cafe', name: 'Coffee stop', type: 'poi', visible: true, locked: false, opacity: 100 },
  { id: 'area-center', name: 'City center', type: 'shape', visible: true, locked: false, opacity: 28 },
  { id: 'basemap', name: 'Liberty basemap', type: 'basemap', visible: true, locked: true, opacity: 100 },
];

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
  { id: 'frame', label: 'Fit page', shortcut: '1', icon: Frame },
];

export function App() {
  const [layers, setLayers] = useState(initialLayers);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState('select');
  const [pageExpanded, setPageExpanded] = useState(true);

  const selectedLayer = layers.find((layer) => layer.id === selectedId) ?? null;
  const clearSelection = useCallback(() => setSelectedId(null), []);

  const updateLayer = (id: string, patch: Partial<Layer>) => {
    setLayers((current) => current.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)));
  };

  return (
    <main className="studio-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true"><PenLine size={16} strokeWidth={2} /></div>
          <span className="brand-name">Print Map Studio</span>
          <span className="top-divider" />
          <button className="project-title" type="button">Vienna field guide</button>
        </div>
        <div className="history-actions" aria-label="History">
          <button className="icon-button" type="button" aria-label="Undo" title="Undo"><Undo2 size={15} /></button>
          <button className="icon-button" type="button" aria-label="Redo" title="Redo"><Redo2 size={15} /></button>
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
        <div className="section-row">
          <button className="disclosure" type="button" onClick={() => setPageExpanded((value) => !value)} aria-expanded={pageExpanded}>
            {pageExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Frame size={14} />
            <span>Page 1</span>
          </button>
          <button className="icon-button" type="button" aria-label="Add page"><BringToFront size={14} /></button>
        </div>
        {pageExpanded && (
          <div className="layer-tree" role="tree" aria-label="Map layers">
            {layers.map((layer) => {
              const Icon = layerIcons[layer.type];
              const selected = selectedId === layer.id;
              return (
                <div className={`layer-row${selected ? ' is-selected' : ''}`} key={layer.id} role="treeitem" aria-selected={selected}>
                  <button
                    className="layer-visibility"
                    type="button"
                    aria-label={`${layer.visible ? 'Hide' : 'Show'} ${layer.name}`}
                    onClick={() => updateLayer(layer.id, { visible: !layer.visible })}
                  >
                    {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  <button className="layer-select" type="button" onClick={() => setSelectedId(layer.id)} aria-label={`Select ${layer.name}`}>
                    <Icon size={14} />
                    <span>{layer.name}</span>
                  </button>
                  <button
                    className="layer-lock"
                    type="button"
                    aria-label={`${layer.locked ? 'Unlock' : 'Lock'} ${layer.name}`}
                    onClick={() => updateLayer(layer.id, { locked: !layer.locked })}
                  >
                    {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="sidebar-footer"><span>4 layers</span><span>Local draft</span></div>
      </aside>

      <section className="canvas-region">
        <MapCanvas onBackgroundClick={clearSelection} />
        <nav className="tool-palette" aria-label="Map tools">
          {tools.map(({ id, label, shortcut, icon: Icon }, index) => (
            <div className="tool-slot" key={id}>
              {index === 2 && <span className="tool-separator" />}
              <button
                className={`tool-button${activeTool === id ? ' is-active' : ''}`}
                type="button"
                aria-label={`${label} (${shortcut})`}
                title={`${label} · ${shortcut}`}
                onClick={() => setActiveTool(id)}
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
          <LayerProperties layer={selectedLayer} onUpdate={(patch) => updateLayer(selectedLayer.id, patch)} />
        ) : (
          <ProjectProperties />
        )}
      </aside>
    </main>
  );
}

function ProjectProperties() {
  return (
    <div className="properties-panel">
      <div className="properties-title"><div><span className="eyebrow">Properties</span><h2>Project</h2></div><button className="icon-button" type="button" aria-label="Project menu">•••</button></div>
      <PropertySection title="Page">
        <PropertyRow label="Preset"><select defaultValue="A4"><option>A4</option><option>A3</option><option>Letter</option><option>Custom</option></select></PropertyRow>
        <div className="paired-fields"><label><span>W</span><input defaultValue="297" /><small>mm</small></label><label><span>H</span><input defaultValue="210" /><small>mm</small></label></div>
        <PropertyRow label="Orientation"><div className="segmented"><button className="is-active" type="button">Landscape</button><button type="button">Portrait</button></div></PropertyRow>
      </PropertySection>
      <PropertySection title="Map">
        <PropertyRow label="Style"><select defaultValue="Liberty"><option>Liberty</option><option>Positron</option><option>Dark</option></select></PropertyRow>
        <PropertyRow label="Bearing"><NumberField value="0" suffix="°" /></PropertyRow>
        <PropertyRow label="Pitch"><NumberField value="0" suffix="°" /></PropertyRow>
        <PropertyRow label="Text scale"><NumberField value="100" suffix="%" /></PropertyRow>
      </PropertySection>
      <PropertySection title="Export">
        <PropertyRow label="Resolution"><select defaultValue="300 dpi"><option>150 dpi</option><option>300 dpi</option><option>600 dpi</option></select></PropertyRow>
        <label className="check-row"><input type="checkbox" defaultChecked /> Include map attribution</label>
      </PropertySection>
    </div>
  );
}

function LayerProperties({ layer, onUpdate }: { layer: Layer; onUpdate: (patch: Partial<Layer>) => void }) {
  return (
    <div className="properties-panel">
      <div className="properties-title"><div><span className="eyebrow">Layer properties</span><h2>{layer.name}</h2></div><button className="icon-button" type="button" aria-label="Layer menu">•••</button></div>
      <PropertySection title="Layer">
        <PropertyRow label="Name"><input value={layer.name} onChange={(event) => onUpdate({ name: event.target.value })} /></PropertyRow>
        <PropertyRow label="Opacity"><NumberField value={String(layer.opacity)} suffix="%" ariaLabel="Layer opacity" onChange={(value) => onUpdate({ opacity: value })} /></PropertyRow>
        <PropertyRow label="Visible"><button className={`toggle${layer.visible ? ' is-on' : ''}`} type="button" aria-pressed={layer.visible} onClick={() => onUpdate({ visible: !layer.visible })}><span /></button></PropertyRow>
        <PropertyRow label="Locked"><button className={`toggle${layer.locked ? ' is-on' : ''}`} type="button" aria-pressed={layer.locked} onClick={() => onUpdate({ locked: !layer.locked })}><span /></button></PropertyRow>
      </PropertySection>
      <PropertySection title="Appearance">
        <PropertyRow label="Stroke"><label className="color-field"><span style={{ background: 'var(--studio-route)' }} /><input defaultValue="#FF4F3D" /></label></PropertyRow>
        <PropertyRow label="Width"><NumberField value="3" suffix="px" /></PropertyRow>
        <PropertyRow label="Blend"><select defaultValue="Normal"><option>Normal</option><option>Multiply</option><option>Screen</option></select></PropertyRow>
      </PropertySection>
      <div className="properties-actions"><button type="button">Duplicate</button><button className="danger-button" type="button">Delete layer</button></div>
    </div>
  );
}

function PropertySection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="property-section"><h3>{title}</h3>{children}</section>;
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="property-row"><span>{label}</span><div className="property-control">{children}</div></div>;
}

function NumberField({ value, suffix, ariaLabel, onChange }: { value: string; suffix: string; ariaLabel?: string; onChange?: (value: number) => void }) {
  return <label className="number-field"><input aria-label={ariaLabel} value={value} onChange={(event) => onChange?.(Number(event.target.value))} readOnly={!onChange} /><small>{suffix}</small></label>;
}
