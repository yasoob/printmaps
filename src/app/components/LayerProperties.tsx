import { memo, useState } from 'react';
import { MAX_MERCATOR_LATITUDE, type ContentLayer, type LayerAppearance, type MapMatchingInput, type ShapeAppearance } from '../../domain/project';
import type { CustomMarkerAsset } from '../../domain/customMarkerAssets';
import type { DirectionsProvider, MapMatchingProvider } from '../../services/mapbox/contracts';
import type { ProjectState } from '../store';
import { useOptionalStableEvent, useStableEvent } from '../hooks/useStableEvent';
import { CoordinateField } from './CoordinateField';
import { LayerIdentityProperties } from './LayerIdentityProperties';
import { MultiPartGeometryStatus } from './MultiPartGeometryStatus';
import { PoiAppearanceControls } from './PoiAppearanceControls';
import { PropertyRow, PropertySection } from './PropertyControls';
import { RouteLayerProperties } from './RouteLayerProperties';
import { ShapeVertexControls } from './ShapeVertexControls';
import { Switch } from './UiControls';
import { InputGroup, InputGroupAddon, InputNumber } from './InputGroup';
import type { RouteExtensionEndpoint } from './routeAuthoringActions';
import type { GeometryEditResult, ProjectMutationResult } from '../../domain/projectMutation';
import { useLayerNameDraft } from '../hooks/useLayerNameDraft';
import { useMutationFeedback } from '../hooks/useMutationFeedback';

type LayerPropertiesProps = {
  layer: ContentLayer;
  assets: Record<string, CustomMarkerAsset>;
  documentEpoch?: number;
  mapMatchingProvider?: MapMatchingProvider;
  directionsProvider?: DirectionsProvider;
  onApplyMapMatching?: (input: MapMatchingInput, expectedDocumentEpoch: number) => ProjectMutationResult;
  onRename: (name: string) => ProjectMutationResult;
  onOpacityChange: (opacity: number) => ProjectMutationResult;
  onAppearanceChange: (appearance: LayerAppearance) => ProjectMutationResult;
  onBeginRouteExtend?: (endpoint: RouteExtensionEndpoint, trigger: HTMLButtonElement) => void;
  directionsRouteEditError?: string | null;
  directionsRouteEditIsRouting?: boolean;
  directionsRouteEditWaypoints?: readonly (readonly [number, number])[] | null;
  onRetryDirectionsRouteEdit?: () => void;
  onCancelDirectionsRouteEdit?: () => void;
  onTransformRoute?: ProjectState['transformRoute'];
  onArcCurvatureChange?: (segmentIndex: number, curvature: number) => ProjectMutationResult;
  onPoiCoordinatesChange: (coordinates: readonly [number, number]) => ProjectMutationResult;
  onPoiCustomMarkerChange: (asset: CustomMarkerAsset | null) => ProjectMutationResult;
  onRouteVertexInsert: (vertexIndex: number) => ProjectMutationResult; onRouteVertexRemove: (vertexIndex: number) => GeometryEditResult;
  onRouteVertexChange: (vertexIndex: number, coordinates: readonly [number, number]) => GeometryEditResult;
  onShapeVertexChange: (ringIndex: number, vertexIndex: number, coordinates: readonly [number, number]) => ProjectMutationResult;
  onToggleVisibility: () => ProjectMutationResult; onToggleLock: () => ProjectMutationResult;
  onReplace: (trigger: HTMLElement | null) => void; onDuplicate: () => ProjectMutationResult; onDelete: () => void;
};

function PoiCoordinateControls({
  coordinates,
  disabled,
  onChange,
}: {
  coordinates: readonly [number, number];
  disabled: boolean;
  onChange: (coordinates: readonly [number, number]) => ProjectMutationResult;
}) {
  return (
    <>
      <CoordinateField key={`longitude-${coordinates[0]}`} ariaLabel="POI longitude" label="Longitude" disabled={disabled} minimum={-180} maximum={180} value={coordinates[0]} onCommit={(longitude) => onChange([longitude, coordinates[1]])} />
      <CoordinateField key={`latitude-${coordinates[1]}`} ariaLabel="POI latitude" label="Latitude" disabled={disabled} minimum={-MAX_MERCATOR_LATITUDE} maximum={MAX_MERCATOR_LATITUDE} value={coordinates[1]} onCommit={(latitude) => onChange([coordinates[0], latitude])} />
    </>
  );
}

const ShapeAppearanceControls = memo(function ShapeAppearanceControls({
  appearance,
  onChange: commit,
}: {
  appearance: ShapeAppearance;
  onChange: (appearance: ShapeAppearance) => ProjectMutationResult;
}) {
  const feedback = useMutationFeedback(appearance);
  const onChange = (next: ShapeAppearance) => feedback.report(commit(next));
  const [widthEdit, setWidthEdit] = useState(() => ({
    source: appearance.strokeWidth,
    value: String(appearance.strokeWidth),
  }));
  const widthDraft = widthEdit.source === appearance.strokeWidth
    ? widthEdit.value
    : String(appearance.strokeWidth);
  const widthValue = Number(widthDraft);
  const isWidthInvalid = widthDraft.trim() === ''
    || !Number.isFinite(widthValue)
    || widthValue < 0.5
    || widthValue > 12;
  const commitWidth = (value: string) => {
    const strokeWidth = Number(value);
    if (value.trim() === '' || !Number.isFinite(strokeWidth) || strokeWidth < 0.5 || strokeWidth > 12) {
      setWidthEdit({ source: appearance.strokeWidth, value: String(appearance.strokeWidth) });
      return;
    }
    const result = onChange({ ...appearance, strokeWidth });
    if (result.ok) setWidthEdit({ source: strokeWidth, value: String(strokeWidth) });
  };

  return (
    <>
      <PropertyRow label="Fill"><label className="color-field"><input aria-label="Shape fill color" type="color" value={appearance.fillColor} onChange={(event) => onChange({ ...appearance, fillColor: event.target.value })} /></label></PropertyRow>
      <PropertyRow label="Outline"><label className="color-field"><input aria-label="Shape outline color" type="color" value={appearance.strokeColor} onChange={(event) => onChange({ ...appearance, strokeColor: event.target.value })} /></label></PropertyRow>
      <PropertyRow label="Width"><InputGroup><InputNumber aria-label="Shape outline width" aria-invalid={isWidthInvalid || undefined} min={0.5} max={12} step={0.5} value={widthDraft} onChange={(event) => setWidthEdit({ source: appearance.strokeWidth, value: event.target.value })} onBlur={(event) => commitWidth(event.currentTarget.value)} /><InputGroupAddon align="inline-end" enableScrubbing sensitivity={4}>px</InputGroupAddon></InputGroup></PropertyRow>
      <Switch aria-label="Invert shape fill" isChecked={appearance.invert} label="Invert outside area" onCheckedChange={(isChecked) => onChange({ ...appearance, invert: isChecked })} />
      {feedback.error && <p className="coordinate-validation" role="alert">{feedback.error}</p>}
    </>
  );
}, (previous, next) => previous.appearance === next.appearance);

function PoiLayerProperties({
  layer,
  assets,
  documentEpoch,
  onAppearanceChange,
  onPoiCoordinatesChange,
  onPoiCustomMarkerChange,
}: Pick<LayerPropertiesProps, 'layer' | 'assets' | 'documentEpoch' | 'onAppearanceChange' | 'onPoiCoordinatesChange' | 'onPoiCustomMarkerChange'>) {
  const appearance = layer.appearance?.kind === 'poi' ? layer.appearance : undefined;
  const customAsset = appearance?.customAssetId ? assets[appearance.customAssetId] : undefined;
  return (
    <>
      {appearance && (
        <PropertySection title="Appearance">
          <PoiAppearanceControls key={`${documentEpoch}-${layer.id}`} appearance={appearance} customAsset={customAsset} onChange={onAppearanceChange} onCustomMarkerChange={onPoiCustomMarkerChange} />
        </PropertySection>
      )}
      {layer.geometry?.type === 'Point' && (
        <PropertySection title="Location">
          <PoiCoordinateControls coordinates={layer.geometry.coordinates} disabled={layer.locked} onChange={onPoiCoordinatesChange} />
        </PropertySection>
      )}
    </>
  );
}

type RouteTypePropertiesProps = {
  documentEpoch: number | undefined;
  layer: ContentLayer;
  mapMatchingProvider: MapMatchingProvider | undefined;
  directionsProvider: DirectionsProvider | undefined;
  onApplyMapMatching: LayerPropertiesProps['onApplyMapMatching'];
  onAppearanceChange: LayerPropertiesProps['onAppearanceChange'];
  onBeginRouteExtend: LayerPropertiesProps['onBeginRouteExtend'];
  onArcCurvatureChange: LayerPropertiesProps['onArcCurvatureChange'];
  onRouteVertexInsert: LayerPropertiesProps['onRouteVertexInsert'];
  onRouteVertexRemove: LayerPropertiesProps['onRouteVertexRemove'];
  onRouteVertexChange: LayerPropertiesProps['onRouteVertexChange'];
  directionsRouteEditError: LayerPropertiesProps['directionsRouteEditError'];
  directionsRouteEditIsRouting: LayerPropertiesProps['directionsRouteEditIsRouting'];
  directionsRouteEditWaypoints: LayerPropertiesProps['directionsRouteEditWaypoints'];
  onRetryDirectionsRouteEdit: LayerPropertiesProps['onRetryDirectionsRouteEdit'];
  onCancelDirectionsRouteEdit: LayerPropertiesProps['onCancelDirectionsRouteEdit'];
  onTransformRoute: LayerPropertiesProps['onTransformRoute'];
};

function RouteTypeProperties(props: RouteTypePropertiesProps) {
  return <RouteLayerProperties layer={props.layer} {...(props.documentEpoch !== undefined && { documentEpoch: props.documentEpoch })} {...(props.directionsProvider && { directionsProvider: props.directionsProvider })} {...(props.mapMatchingProvider && { mapMatchingProvider: props.mapMatchingProvider })} {...(props.onApplyMapMatching && { onApplyMapMatching: props.onApplyMapMatching })} {...(props.onArcCurvatureChange && { onArcCurvatureChange: props.onArcCurvatureChange })} {...(props.onBeginRouteExtend && { onBeginExtend: props.onBeginRouteExtend })} {...(props.onTransformRoute && { onTransformRoute: props.onTransformRoute })} directionsRouteEditError={props.directionsRouteEditError} directionsRouteEditIsRouting={props.directionsRouteEditIsRouting} directionsRouteEditWaypoints={props.directionsRouteEditWaypoints} onRetryDirectionsRouteEdit={props.onRetryDirectionsRouteEdit} onCancelDirectionsRouteEdit={props.onCancelDirectionsRouteEdit} onAppearanceChange={props.onAppearanceChange} onRouteVertexInsert={props.onRouteVertexInsert} onRouteVertexRemove={props.onRouteVertexRemove} onRouteVertexChange={props.onRouteVertexChange} />;
}

function LayerTypeProperties({
  documentEpoch,
  layer,
  mapMatchingProvider,
  directionsProvider,
  onApplyMapMatching,
  assets,
  onAppearanceChange,
  onBeginRouteExtend,
  onArcCurvatureChange,
  onPoiCoordinatesChange,
  onPoiCustomMarkerChange,
  onRouteVertexInsert,
  onRouteVertexRemove,
  onRouteVertexChange,
  onShapeVertexChange,
  directionsRouteEditError,
  directionsRouteEditIsRouting,
  directionsRouteEditWaypoints,
  onRetryDirectionsRouteEdit,
  onCancelDirectionsRouteEdit,
  onTransformRoute,
}: Pick<LayerPropertiesProps, 'documentEpoch' | 'layer' | 'assets' | 'directionsProvider' | 'mapMatchingProvider' | 'onApplyMapMatching' | 'onAppearanceChange' | 'onBeginRouteExtend' | 'onArcCurvatureChange' | 'onPoiCoordinatesChange' | 'onPoiCustomMarkerChange' | 'onRouteVertexInsert' | 'onRouteVertexRemove' | 'onRouteVertexChange' | 'onShapeVertexChange' | 'directionsRouteEditError' | 'directionsRouteEditIsRouting' | 'directionsRouteEditWaypoints' | 'onRetryDirectionsRouteEdit' | 'onCancelDirectionsRouteEdit' | 'onTransformRoute'>) {
  switch (layer.type) {
    case 'route': {
      return <RouteTypeProperties documentEpoch={documentEpoch} layer={layer} directionsProvider={directionsProvider} mapMatchingProvider={mapMatchingProvider} onApplyMapMatching={onApplyMapMatching} onAppearanceChange={onAppearanceChange} onBeginRouteExtend={onBeginRouteExtend} onArcCurvatureChange={onArcCurvatureChange} onRouteVertexInsert={onRouteVertexInsert} onRouteVertexRemove={onRouteVertexRemove} onRouteVertexChange={onRouteVertexChange} directionsRouteEditError={directionsRouteEditError} directionsRouteEditIsRouting={directionsRouteEditIsRouting} directionsRouteEditWaypoints={directionsRouteEditWaypoints} onRetryDirectionsRouteEdit={onRetryDirectionsRouteEdit} onCancelDirectionsRouteEdit={onCancelDirectionsRouteEdit} onTransformRoute={onTransformRoute} />;
    }
    case 'poi': {
      return <PoiLayerProperties layer={layer} assets={assets} {...(documentEpoch !== undefined && { documentEpoch })} onAppearanceChange={onAppearanceChange} onPoiCoordinatesChange={onPoiCoordinatesChange} onPoiCustomMarkerChange={onPoiCustomMarkerChange} />;
    }
    case 'shape': {
      if (layer.appearance?.kind !== 'shape') return null;
      return (
        <>
          <PropertySection title="Appearance">
            <ShapeAppearanceControls key={`${layer.id}-${layer.appearance.strokeWidth}`} appearance={layer.appearance} onChange={onAppearanceChange} />
          </PropertySection>
          {layer.geometry?.type === 'Polygon' && (
            <PropertySection title="Vertices">
              <ShapeVertexControls key={layer.id} coordinates={layer.geometry.coordinates} disabled={layer.locked || !layer.visible} onChange={onShapeVertexChange} />
            </PropertySection>
          )}
          {layer.geometry?.type === 'MultiPolygon' && (
            <MultiPartGeometryStatus partCount={layer.geometry.coordinates.length} />
          )}
        </>
      );
    }
    default: {
      return null;
    }
  }
}

export function LayerProperties({
  layer,
  assets,
  documentEpoch,
  mapMatchingProvider,
  directionsProvider,
  onApplyMapMatching,
  onRename,
  onOpacityChange,
  onAppearanceChange,
  onBeginRouteExtend,
  directionsRouteEditError,
  directionsRouteEditIsRouting,
  directionsRouteEditWaypoints,
  onRetryDirectionsRouteEdit,
  onCancelDirectionsRouteEdit,
  onArcCurvatureChange,
  onPoiCoordinatesChange,
  onPoiCustomMarkerChange,
  onRouteVertexInsert,
  onRouteVertexRemove,
  onRouteVertexChange,
  onShapeVertexChange,
  onToggleVisibility,
  onToggleLock,
  onReplace,
  onDuplicate,
  onDelete,
  onTransformRoute,
}: LayerPropertiesProps) {
  const [operationError, setOperationError] = useState<{ layer: ContentLayer; message: string } | null>(null);
  const reportMutation = <T extends GeometryEditResult,>(result: T) => {
    setOperationError('ok' in result && !result.ok ? { layer, message: result.error } : null);
    return result;
  };
  const { draft: nameDraft, error: nameError, change: changeNameDraft, commit: commitNameDraft } = useLayerNameDraft(
    layer.name, onRename,
  );
  const [opacityEdit, setOpacityEdit] = useState(() => ({ source: layer.opacity, value: String(layer.opacity) }));
  const opacityDraft = opacityEdit.source === layer.opacity ? opacityEdit.value : String(layer.opacity);
  const commitOpacity = () => {
    const opacity = Number(opacityDraft);
    if (opacityDraft.trim() === '' || !Number.isFinite(opacity)) {
      setOpacityEdit({ source: layer.opacity, value: String(layer.opacity) });
      return;
    }
    const clampedOpacity = Math.max(0, Math.min(100, opacity));
    const result = reportMutation(onOpacityChange(clampedOpacity));
    if (result.ok) setOpacityEdit({ source: clampedOpacity, value: String(clampedOpacity) });
  };
  const deleteLayer = useStableEvent(onDelete);
  const duplicateLayer = useStableEvent(() => {
    const result = onDuplicate();
    setOperationError(result.ok ? null : { layer, message: result.error });
  });
  const replaceLayer = useStableEvent(onReplace);
  const toggleLayerLock = useStableEvent(() => reportMutation(onToggleLock()));
  const toggleLayerVisibility = useStableEvent(() => reportMutation(onToggleVisibility()));
  const applyMapMatching = useOptionalStableEvent(onApplyMapMatching);
  const changeAppearance = useStableEvent(onAppearanceChange);
  const beginRouteExtend = useOptionalStableEvent(onBeginRouteExtend);
  const changeArcCurvature = useOptionalStableEvent(onArcCurvatureChange
    ? (index: number, curvature: number) => reportMutation(onArcCurvatureChange(index, curvature)) : undefined);
  const changePoiCoordinates = useStableEvent(onPoiCoordinatesChange);
  const changePoiCustomMarker = useStableEvent(onPoiCustomMarkerChange);
  const insertRouteVertex = useStableEvent((index: number) => reportMutation(onRouteVertexInsert(index)));
  const removeRouteVertex = useStableEvent((index: number) => reportMutation(onRouteVertexRemove(index)));
  const changeRouteVertex = useStableEvent((index: number, coordinate: readonly [number, number]) => reportMutation(onRouteVertexChange(index, coordinate)));
  const changeShapeVertex = useStableEvent((ring: number, index: number, coordinate: readonly [number, number]) => reportMutation(onShapeVertexChange(ring, index, coordinate)));
  const retryDirectionsRouteEdit = useOptionalStableEvent(onRetryDirectionsRouteEdit);
  const cancelDirectionsRouteEdit = useOptionalStableEvent(onCancelDirectionsRouteEdit);
  const transformRoute = useOptionalStableEvent(onTransformRoute);
  const changeOpacityDraft = useStableEvent((value: string) => setOpacityEdit({ source: layer.opacity, value }));
  const commitOpacityDraft = useStableEvent(commitOpacity);

  return (
    <div className="properties-panel">
      <LayerIdentityProperties
        layer={layer}
        nameDraft={nameDraft}
        nameError={nameError}
        opacityDraft={opacityDraft}
        onDelete={deleteLayer}
        onDuplicate={duplicateLayer}
        onNameChange={changeNameDraft}
        onNameCommit={commitNameDraft}
        onOpacityChange={changeOpacityDraft}
        onOpacityCommit={commitOpacityDraft}
        onReplace={replaceLayer}
        onToggleLock={toggleLayerLock}
        onToggleVisibility={toggleLayerVisibility}
      />
      {operationError?.layer === layer && <p className="coordinate-validation" role="alert">{operationError.message}</p>}
      <LayerTypeProperties documentEpoch={documentEpoch} layer={layer} assets={assets} directionsProvider={directionsProvider} mapMatchingProvider={mapMatchingProvider} onApplyMapMatching={applyMapMatching} onAppearanceChange={changeAppearance} onBeginRouteExtend={beginRouteExtend} onArcCurvatureChange={changeArcCurvature} onPoiCoordinatesChange={changePoiCoordinates} onPoiCustomMarkerChange={changePoiCustomMarker} onRouteVertexInsert={insertRouteVertex} onRouteVertexRemove={removeRouteVertex} onRouteVertexChange={changeRouteVertex} onShapeVertexChange={changeShapeVertex} directionsRouteEditError={directionsRouteEditError} directionsRouteEditIsRouting={directionsRouteEditIsRouting} directionsRouteEditWaypoints={directionsRouteEditWaypoints} onRetryDirectionsRouteEdit={retryDirectionsRouteEdit} onCancelDirectionsRouteEdit={cancelDirectionsRouteEdit} onTransformRoute={transformRoute} />
    </div>
  );
}
