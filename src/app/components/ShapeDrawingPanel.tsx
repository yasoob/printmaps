import type { AdministrativeAreaId } from '../../domain/administrativeAreas';
import { AdministrativeAreaPicker } from './AdministrativeAreaPicker';
import { DrawingPanel } from './RouteDrawingPanel';

type ShapeDrawingPanelProps = Readonly<{
  pointCount: number;
  canFinish: boolean;
  onAddAdministrativeArea: (id: AdministrativeAreaId) => void;
  onCancel: () => void;
  onFinish: () => void;
}>;

export function ShapeDrawingPanel(props: ShapeDrawingPanelProps) {
  const vertexLabel = props.pointCount === 1 ? 'vertex' : 'vertices';
  return (
    <DrawingPanel statusLabel="Shape drawing status" status={`Polygon shape · ${props.pointCount} ${vertexLabel}`} cancelLabel="Cancel shape" finishLabel="Finish shape" finishDisabled={!props.canFinish} onCancel={props.onCancel} onFinish={props.onFinish}>
      <AdministrativeAreaPicker onAdd={props.onAddAdministrativeArea} />
    </DrawingPanel>
  );
}
