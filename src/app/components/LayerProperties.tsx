import { useState, type ReactNode } from 'react';
import { MAX_MERCATOR_LATITUDE, type ContentLayer, type LayerAppearance, type MapMatchingInput } from '../../domain/project';
import type { CustomMarkerAsset } from '../../domain/customMarkerAssets';
import type { DirectionsProvider, MapMatchingProvider } from '../../services/mapbox/contracts';
import type { ProjectState } from '../store';
import { useOptionalStableEvent, useStableEvent } from '../hooks/useStableEvent';
import { CoordinateField } from './CoordinateField';
import { LayerIdentityProperties } from './LayerIdentityProperties';
import { MultiPartGeometryStatus } from './MultiPartGeometryStatus';
import { PoiAppearanceControls } from './PoiAppearanceControls';
import { InspectorAccordion, PropertySection } from './PropertyControls';
import { RouteLayerProperties } from './RouteLayerProperties';
import { ShapeVertexControls } from './ShapeVertexControls';
import { ShapeAppearanceControls } from './ShapeAppearanceControls';
import type { RouteExtensionEndpoint } from './routeAuthoringActions';
import type { GeometryEditResult, ProjectMutationResult } from '../../domain/projectMutation';
import { useLayerNameDraft } from '../hooks/useLayerNameDraft';

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
  onReplace: (trigger: HTMLElement | null) => void; onDuplicate: () => ProjectMutationResult; onDelete: () => void; extraSections?: ReactNode;
};

function shapeVertexSummary(rings: readonly (readonly unknown[])[]) {
  const holes = rings.length - 1;
  return `${Math.max(0, (rings[0]?.length ?? 1) - 1)} points${holes > 0 ? ` · ${holes} ${holes === 1 ? 'hole' : 'holes'}` : ''}`;
}

function PoiCoordinateControls({
  coordinates,
  disabled,
  onChange,
}: {
  coordinates: readonly [number, number];
  disabled: boolean;
  onChange: (coordinates: readonly [number, number]) => ProjectMutationResult;
}) {
  const commitLongitude = useStableEvent((longitude: number) => onChange([longitude, coordinates[1]]));
  const commitLatitude = useStableEvent((latitude: number) => onChange([coordinates[0], latitude]));
  return (
    <>
      <CoordinateField ariaLabel="POI longitude" label="Longitude" disabled={disabled} minimum={-180} maximum={180} value={coordinates[0]} onCommit={commitLongitude} />
      <CoordinateField ariaLabel="POI latitude" label="Latitude" disabled={disabled} minimum={-MAX_MERCATOR_LATITUDE} maximum={MAX_MERCATOR_LATITUDE} value={coordinates[1]} onCommit={commitLatitude} />
    </>
  );
}


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
          <PoiCoordinateControls key={`${documentEpoch}-${layer.id}`} coordinates={layer.geometry.coordinates} disabled={layer.locked} onChange={onPoiCoordinatesChange} />
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
            <InspectorAccordion title="Vertices" isDefaultExpanded={false} storageKey="print-map-studio:inspector:layer:shape-vertices"
                summary={shapeVertexSummary(layer.geometry.coordinates)}>
                <ShapeVertexControls key={layer.id} coordinates={layer.geometry.coordinates} disabled={layer.locked || !layer.visible} onChange={onShapeVertexChange} />
            </InspectorAccordion>
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
  onTransformRoute, extraSections,
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
      {extraSections}
    </div>
  );
}
