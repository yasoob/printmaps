import { Clock3, MapPinned, PencilRuler } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AdministrativeArea } from '../../domain/administrativeAreas';
import { AdministrativeAreaPicker } from './AdministrativeAreaPicker';
import { DrawingPanel } from './RouteDrawingPanel';
import { didHandleRovingSelection } from './rovingSelection';

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
  onMergeAdministrativeAreas: (areas: readonly AdministrativeArea[]) => boolean;
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
  const modes = <ShapeModeTabs mode={props.mode} onChange={props.onModeChange} />;
  if (props.mode === 'administrative') {
    return (
      <div className="map-authoring-panel shape-authoring-panel">
        {modes}
        <AdministrativeAreaPicker onAdd={props.onAddAdministrativeArea} onMerge={props.onMergeAdministrativeAreas} />
        <button type="button" onClick={props.onCancel}>Cancel area</button>
      </div>
    );
  }
  if (props.mode === 'isochrone') {
    return <div className="map-authoring-panel shape-authoring-panel">{modes}{props.isochronePanel}</div>;
  }
  const vertexLabel = props.pointCount === 1 ? 'vertex' : 'vertices';
  return (
    <DrawingPanel
      statusLabel="Area drawing status"
      status={`${props.pointCount} ${vertexLabel}`}
      cancelLabel="Cancel area"
      finishLabel="Finish area"
      finishDisabled={!props.canFinish}
      undoLabel="Undo last area point"
      undoDisabled={props.pointCount === 0}
      onCancel={props.onCancel}
      onUndo={props.onUndo}
      onFinish={props.onFinish}
    >
      {modes}
      <span className="shape-drawing-hint">Click the map to outline an area</span>
    </DrawingPanel>
  );
}
