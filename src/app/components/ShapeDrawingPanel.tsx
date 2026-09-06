import { Clock3, MapPinned, PencilRuler, Shapes, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AdministrativeArea } from '../../domain/administrativeAreas';
import { AdministrativeAreaPicker } from './AdministrativeAreaPicker';
import { didHandleRovingSelection } from './rovingSelection';
import { ToolCardActions, ToolCardHeader } from './ToolAuthoringCard';
import { ToolSettingsButton } from './ToolSettingsButton';
import { useAuthoringPanelDisclosure } from '../hooks/useAuthoringPanelDisclosure';
import { ShapePointInputs, type ShapePointInputsProps } from './ShapePointInputs';

export type ShapeAuthoringMode = 'administrative' | 'draw' | 'isochrone';

function handleShapeModeKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
  if (!didHandleRovingSelection(event, '[role="tab"]')) return;
  queueMicrotask(() => document.querySelector<HTMLButtonElement>('.shape-mode-tabs [role="tab"][tabindex="0"]')?.focus());
}

type ShapeDrawingPanelProps = Readonly<{
  isCompactViewport: boolean;
  pointCount: number;
  pointInput: ShapePointInputsProps;
  pointError: string | null;
  admissionError?: string | null;
  shouldAutoCollapse: boolean;
  canFinish: boolean;
  mode: ShapeAuthoringMode;
  onModeChange: (mode: ShapeAuthoringMode) => void;
  onAddAdministrativeArea: (area: AdministrativeArea) => void;
  onCancel: () => void;
  onClose: () => void;
  onUndo: () => void;
  onFinish: () => void;
  isochronePanel: ReactNode;
}>;

function ShapeModeTabs({ mode, onChange }: Readonly<{
  mode: ShapeAuthoringMode;
  onChange: (mode: ShapeAuthoringMode, isPointerActivation: boolean) => void;
}>) {
  return (
    <div className="shape-mode-tabs" role="tablist" aria-label="Shape source" onKeyDown={handleShapeModeKeyDown}>
      <button type="button" role="tab" aria-label="Find administrative area" aria-selected={mode === 'administrative'} tabIndex={mode === 'administrative' ? 0 : -1} onClick={(event) => onChange('administrative', event.detail !== 0)}>
        <MapPinned aria-hidden="true" size={15} /> Boundaries
      </button>
      <button type="button" role="tab" aria-label="Draw custom area" aria-selected={mode === 'draw'} tabIndex={mode === 'draw' ? 0 : -1} onClick={(event) => onChange('draw', event.detail !== 0)}>
        <PencilRuler aria-hidden="true" size={15} /> Draw
      </button>
      <button type="button" role="tab" aria-selected={mode === 'isochrone'} tabIndex={mode === 'isochrone' ? 0 : -1} onClick={(event) => onChange('isochrone', event.detail !== 0)}>
        <Clock3 aria-hidden="true" size={15} /> Travel time
      </button>
    </div>
  );
}

export function ShapeDrawingPanel(props: ShapeDrawingPanelProps) {
  const disclosure = useAuthoringPanelDisclosure(props.pointCount, props.isCompactViewport, props.isCompactViewport && props.shouldAutoCollapse);
  const header = <ToolCardHeader closeLabel="Close Area menu" collapse={props.mode === 'draw' ? { label: 'Hide area settings', onCollapse: disclosure.closeSettings } : undefined} icon={Shapes} onClose={props.onClose} title="Area" />;
  const modes = <ShapeModeTabs mode={props.mode} onChange={(mode, isPointerActivation) => {
    props.onModeChange(mode);
    if (mode === 'draw' && props.isCompactViewport) {
      if (isPointerActivation) disclosure.closeSettings();
      else disclosure.openSettings();
    }
  }} />;
  if (props.mode === 'administrative') {
    return (
      <div className="map-authoring-panel tool-authoring-card shape-authoring-panel">
        {header}
        {modes}
        <AdministrativeAreaPicker onAdd={props.onAddAdministrativeArea} onCancel={props.onCancel} />
        {props.admissionError && <p className="coordinate-validation" role="alert">{props.admissionError}</p>}
      </div>
    );
  }
  if (props.mode === 'isochrone') {
    return <div className="map-authoring-panel tool-authoring-card shape-authoring-panel">{header}{modes}{props.isochronePanel}</div>;
  }
  const vertexLabel = props.pointCount === 1 ? 'vertex' : 'vertices';
  const compactSummary = props.pointCount < 3 ? `${props.pointCount} / 3 vertices` : `${props.pointCount} ${vertexLabel}`;
  return (
    <div className="map-authoring-panel tool-authoring-card shape-authoring-panel" data-settings-expanded={disclosure.settingsOpen}>
      {header}
      {modes}
      {!disclosure.settingsOpen && <>
        <p className="tool-compact-summary" aria-hidden="true">{compactSummary}</p>
        <ToolSettingsButton buttonRef={disclosure.settingsButtonRef} label="Show area settings" onOpen={disclosure.openSettings} />
      </>}
      <div className="shape-drawing-content">
        <span className="shape-control-label">Outline</span>
        <p id="area-drawing-instructions">Click the map or enter coordinates. Use at least 3 distinct points.</p>
        <ShapePointInputs {...props.pointInput} />
        <p>With the map focused: Enter finishes; Backspace/Delete undoes a point; Escape closes and keeps the outline.</p>
        <div className="shape-drawing-progress">
          <span role="status" aria-label="Area drawing status">{props.pointCount} {vertexLabel}</span>
          <button type="button" aria-label="Undo last area point" disabled={props.pointCount === 0} onClick={props.onUndo}>
            <Undo2 aria-hidden="true" size={14} /><span>Undo point</span>
          </button>
        </div>
      </div>
      {props.pointError && <p className="coordinate-validation" role="alert">{props.pointError}</p>}
      <ToolCardActions>
        <button type="button" aria-label="Cancel area" onClick={props.onCancel}>Cancel</button>
        <button className="primary-button" type="button" aria-label="Finish area" aria-describedby="area-drawing-instructions" disabled={!props.canFinish} onClick={props.onFinish}><span className="shape-finish-full" aria-hidden="true">Finish area</span><span className="shape-finish-compact" aria-hidden="true">Finish</span></button>
      </ToolCardActions>
    </div>
  );
}
