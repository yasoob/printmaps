import { Frame, Hand, Layers3, MapPin, MousePointer2, Route, Shapes, SlidersHorizontal, Type } from 'lucide-react';
import { useMemo, useState, type RefObject } from 'react';
import type { ContentLayer, PageSettings } from '../../domain/project';
import type { PreviewPngExporter } from '../../export/previewPng';
import { MapCanvas } from '../../map/MapCanvas';
import type { MobilePanel } from '../hooks/useMobilePanels';

const tools = [
  { id: 'select', label: 'Select', shortcut: 'V', icon: MousePointer2 },
  { id: 'pan', label: 'Pan', shortcut: 'H', icon: Hand },
  { id: 'route', label: 'Route', shortcut: 'R', icon: Route },
  { id: 'pin', label: 'Pin', shortcut: 'P', icon: MapPin },
  { id: 'shape', label: 'Shape', shortcut: 'S', icon: Shapes },
  { id: 'text', label: 'Text', shortcut: 'T', icon: Type },
  { id: 'frame', label: 'Fit page', shortcut: 'Shift+1', icon: Frame, command: true },
];

type CanvasWorkspaceProps = {
  layers: ContentLayer[];
  selectedId: string | null;
  previewedId: string | null;
  page: PageSettings;
  activePanel: MobilePanel | null;
  layersTriggerRef: RefObject<HTMLButtonElement | null>;
  propertiesTriggerRef: RefObject<HTMLButtonElement | null>;
  onLayerSelect: (id: string | null) => void;
  onBackgroundClick: () => void;
  onExporterChange: (exporter: PreviewPngExporter | null) => void;
  openPanel: (panel: MobilePanel) => void;
};

export function CanvasWorkspace(props: CanvasWorkspaceProps) {
  const [activeTool, setActiveTool] = useState('select');
  const [fitRequest, setFitRequest] = useState(0);
  const { activePanel, layers, layersTriggerRef, onBackgroundClick, onExporterChange, onLayerSelect, openPanel, page, previewedId, propertiesTriggerRef, selectedId } = props;
  const geometryLayers = useMemo(() => layers.filter((layer) => layer.geometry), [layers]);
  return (
    <section className="canvas-region" inert={activePanel !== null}>
      <MapCanvas layers={geometryLayers} selectedId={selectedId} previewedId={previewedId} onLayerSelect={onLayerSelect} onBackgroundClick={onBackgroundClick} onExporterChange={onExporterChange} fitRequest={fitRequest} orientation={page.orientation} page={page} />
      <div className="mobile-panel-actions" aria-label="Editor panels">
        <button ref={layersTriggerRef} type="button" aria-label="Open layers" aria-controls="layers-panel" aria-expanded={activePanel === 'layers'} onClick={() => openPanel('layers')}><Layers3 size={15} /><span>Layers</span></button>
        <button ref={propertiesTriggerRef} type="button" aria-label="Open properties" aria-controls="properties-panel" aria-expanded={activePanel === 'properties'} onClick={() => openPanel('properties')}><SlidersHorizontal size={15} /><span>Properties</span></button>
      </div>
      <nav className="tool-palette" aria-label="Map tools">
        {tools.map(({ id, label, shortcut, icon: Icon, command }, index) => (
          <div className="tool-slot" key={id}>
            {index === 2 && <span className="tool-separator" />}
            <button className={`tool-button${!command && activeTool === id ? ' is-active' : ''}`} type="button" aria-label={`${label} (${shortcut})`} aria-pressed={command ? undefined : activeTool === id} title={`${label} · ${shortcut}`} onClick={() => command ? setFitRequest((request) => request + 1) : setActiveTool(id)}>
              <Icon size={17} strokeWidth={1.8} />
            </button>
          </div>
        ))}
      </nav>
      <div className="canvas-status" aria-label="Canvas status"><button type="button">100%</button><span /> <button type="button">1:20,000</button></div>
    </section>
  );
}
