import { Clock3, MapPinned, PencilRuler, Shapes, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import type { ReactNode } from 'react';
import type { AdministrativeArea } from '../../domain/administrativeAreas';
import { AdministrativeAreaPicker } from './AdministrativeAreaPicker';
import { StudioModeTabs, type StudioModeTabActivation, type StudioModeTabChoice } from './StudioModeTabs';
import { ToolCardActions, ToolCardHeader } from './ToolAuthoringCard';
import { ToolSettingsButton } from './ToolSettingsButton';
import { useAuthoringPanelDisclosure } from '../hooks/useAuthoringPanelDisclosure';
import { useStableEvent } from '../hooks/useStableEvent';
import { ShapePointInputs, type ShapePointInputsProps } from './ShapePointInputs';

export type ShapeAuthoringMode = 'administrative' | 'draw' | 'isochrone';

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

const AREA_SOURCE_PANEL_ID = 'area-source-panel';
const AREA_SOURCE_CHOICES = [
  { value: 'administrative', label: 'Boundaries', shortLabel: 'Region', ariaLabel: 'Find administrative area', icon: MapPinned },
  { value: 'draw', label: 'Draw', ariaLabel: 'Draw custom area', icon: PencilRuler },
  { value: 'isochrone', label: 'Travel time', shortLabel: 'Time', ariaLabel: 'Travel time', icon: Clock3 },
] as const satisfies readonly StudioModeTabChoice<ShapeAuthoringMode>[];

export function ShapeDrawingPanel(props: ShapeDrawingPanelProps) {
  const disclosure = useAuthoringPanelDisclosure(props.pointCount, props.isCompactViewport, props.isCompactViewport && props.shouldAutoCollapse);
  // Stable so isochrone or point edits re-render the panel body, not the source tabs.
  const changeMode = useStableEvent((mode: ShapeAuthoringMode, activation: StudioModeTabActivation) => {
    props.onModeChange(mode);
    if (mode === 'draw' && props.isCompactViewport) {
      if (activation.source === 'pointer') disclosure.closeSettings();
      else disclosure.openSettings();
    }
  });
  const close = useStableEvent(props.onClose);
  const header = <ToolCardHeader closeLabel="Close Area menu" collapseLabel={props.mode === 'draw' ? 'Hide area settings' : undefined} onCollapse={disclosure.closeSettings} icon={Shapes} onClose={close} title="Area" />;
  const modes = <StudioModeTabs className="shape-mode-tabs" label="Shape source" idPrefix="area-source" panelId={AREA_SOURCE_PANEL_ID}
    choices={AREA_SOURCE_CHOICES} value={props.mode} onValueChange={changeMode} />;
  if (props.mode === 'administrative') {
    return (
      <div className="map-authoring-panel tool-authoring-card shape-authoring-panel">
        {header}
        {modes}
        <AdministrativeAreaPicker id={AREA_SOURCE_PANEL_ID} onAdd={props.onAddAdministrativeArea} onCancel={props.onCancel} />
        {props.admissionError && <Notice tone="error">{props.admissionError}</Notice>}
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
      <div id={AREA_SOURCE_PANEL_ID} className="shape-drawing-content">
        <p id="area-drawing-instructions">Click the map or enter coordinates. Use at least 3 distinct points.</p>
        <ShapePointInputs {...props.pointInput} />
        <p>With the map focused: Enter finishes; Backspace/Delete undoes a point; Escape closes and keeps the outline.</p>
        <div className="shape-drawing-progress">
          <span role="status" aria-label="Area drawing status">{props.pointCount} {vertexLabel}</span>
          <Button variant="ghost" size="sm" aria-label="Undo last area point" disabled={props.pointCount === 0} onClick={props.onUndo}>
            <Undo2 aria-hidden="true" size={16} strokeWidth={1.75} /><span>Undo point</span>
          </Button>
        </div>
      </div>
      {props.pointError && <Notice tone="error">{props.pointError}</Notice>}
      <ToolCardActions>
        <Button variant="ghost" aria-label="Cancel area" onClick={props.onCancel}>Cancel</Button>
        <Button variant="primary" aria-label="Finish area" aria-describedby="area-drawing-instructions" disabled={!props.canFinish} onClick={props.onFinish}><span className="shape-finish-full" aria-hidden="true">Finish area</span><span className="shape-finish-compact" aria-hidden="true">Finish</span></Button>
      </ToolCardActions>
    </div>
  );
}
