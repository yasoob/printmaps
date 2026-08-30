import { Clock3, MapPinned, PencilRuler, Shapes, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AdministrativeArea } from '../../domain/administrativeAreas';
import { AdministrativeAreaPicker } from './AdministrativeAreaPicker';
import { didHandleRovingSelection } from './rovingSelection';
import { ToolCardActions, ToolCardHeader } from './ToolAuthoringCard';

export type ShapeAuthoringMode = 'administrative' | 'draw' | 'isochrone';

function handleShapeModeKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
  if (!didHandleRovingSelection(event, '[role="tab"]')) return;
  queueMicrotask(() => document.querySelector<HTMLButtonElement>('.shape-mode-tabs [role="tab"][tabindex="0"]')?.focus());
}

type ShapeDrawingPanelProps = Readonly<{
  pointCount: number;
  canFinish: boolean;
  mode: ShapeAuthoringMode;
  onModeChange: (mode: ShapeAuthoringMode) => void;
  onAddAdministrativeArea: (area: AdministrativeArea) => void;
  onCancel: () => void;
  onUndo: () => void;
  onFinish: () => void;
  isochronePanel: ReactNode;
}>;

function ShapeModeTabs({ mode, onChange }: Readonly<{
  mode: ShapeAuthoringMode;
  onChange: (mode: ShapeAuthoringMode) => void;
}>) {
  return (
    <div className="shape-mode-tabs" role="tablist" aria-label="Shape source" onKeyDown={handleShapeModeKeyDown}>
      <button type="button" role="tab" aria-label="Find administrative area" aria-selected={mode === 'administrative'} tabIndex={mode === 'administrative' ? 0 : -1} onClick={() => onChange('administrative')}>
        <MapPinned aria-hidden="true" size={15} /> Boundaries
      </button>
      <button type="button" role="tab" aria-label="Draw custom area" aria-selected={mode === 'draw'} tabIndex={mode === 'draw' ? 0 : -1} onClick={() => onChange('draw')}>
        <PencilRuler aria-hidden="true" size={15} /> Draw
      </button>
      <button type="button" role="tab" aria-selected={mode === 'isochrone'} tabIndex={mode === 'isochrone' ? 0 : -1} onClick={() => onChange('isochrone')}>
        <Clock3 aria-hidden="true" size={15} /> Travel time
      </button>
    </div>
  );
}

export function ShapeDrawingPanel(props: ShapeDrawingPanelProps) {
  const header = <ToolCardHeader closeLabel="Close Area menu" icon={Shapes} onClose={props.onCancel} title="Area" />;
  const modes = <ShapeModeTabs mode={props.mode} onChange={props.onModeChange} />;
  if (props.mode === 'administrative') {
    return (
      <div className="map-authoring-panel tool-authoring-card shape-authoring-panel">
        {header}
        {modes}
        <AdministrativeAreaPicker onAdd={props.onAddAdministrativeArea} onCancel={props.onCancel} />
      </div>
    );
  }
  if (props.mode === 'isochrone') {
    return <div className="map-authoring-panel tool-authoring-card shape-authoring-panel">{header}{modes}{props.isochronePanel}</div>;
  }
  const vertexLabel = props.pointCount === 1 ? 'vertex' : 'vertices';
  return (
    <div className="map-authoring-panel tool-authoring-card shape-authoring-panel">
      {header}
      {modes}
      <div className="shape-drawing-content">
        <span className="shape-control-label">Outline</span>
        <p>Click around the area on the map. Add at least three points to close the shape.</p>
        <div className="shape-drawing-progress">
          <span role="status" aria-label="Area drawing status">{props.pointCount} {vertexLabel}</span>
          <button type="button" aria-label="Undo last area point" disabled={props.pointCount === 0} onClick={props.onUndo}>
            <Undo2 aria-hidden="true" size={14} />Undo point
          </button>
        </div>
      </div>
      <ToolCardActions>
        <button type="button" aria-label="Cancel area" onClick={props.onCancel}>Cancel</button>
        <button className="primary-button" type="button" disabled={!props.canFinish} onClick={props.onFinish}>Finish area</button>
      </ToolCardActions>
    </div>
  );
}
