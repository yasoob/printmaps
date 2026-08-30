import { memo, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { MAX_MERCATOR_LATITUDE, type ContentLayer, type LayerAppearance, type MapMatchingInput, type ShapeAppearance } from '../../domain/project';
import type { CustomMarkerAsset } from '../../domain/customMarkerAssets';
import type { MapMatchingProvider } from '../../services/mapbox/contracts';
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

function useStableEvent<Arguments extends unknown[], Result>(callback: (...arguments_: Arguments) => Result) {
  const callbackRef = useRef(callback);
  useLayoutEffect(() => { callbackRef.current = callback; }, [callback]);
  return useCallback((...arguments_: Arguments) => callbackRef.current(...arguments_), []);
}

type LayerPropertiesProps = {
  layer: ContentLayer;
  assets: Record<string, CustomMarkerAsset>;
  documentEpoch?: number;
  mapMatchingProvider?: MapMatchingProvider;
  onApplyMapMatching?: (input: MapMatchingInput, expectedDocumentEpoch: number) => boolean;
  onRename: (name: string) => void;
  onOpacityChange: (opacity: number) => void;
  onAppearanceChange: (appearance: LayerAppearance) => void;
  onBeginRouteExtend?: (endpoint: RouteExtensionEndpoint, trigger: HTMLButtonElement) => void;
  directionsRouteEditError?: string | null;
  directionsRouteEditIsRouting?: boolean;
  directionsRouteEditWaypoints?: readonly (readonly [number, number])[] | null;
  onRetryDirectionsRouteEdit?: () => void;
  onCancelDirectionsRouteEdit?: () => void;
  onArcCurvatureChange?: (segmentIndex: number, curvature: number) => void;
  onPoiCoordinatesChange: (coordinates: readonly [number, number]) => void;
  onPoiCustomMarkerChange: (asset: CustomMarkerAsset | null) => void;
  onRouteVertexInsert: (vertexIndex: number) => void; onRouteVertexRemove: (vertexIndex: number) => void;
  onRouteVertexChange: (vertexIndex: number, coordinates: readonly [number, number]) => void;
  onShapeVertexChange: (ringIndex: number, vertexIndex: number, coordinates: readonly [number, number]) => void;
  onToggleVisibility: () => void; onToggleLock: () => void;
  onReplace: (trigger: HTMLElement | null) => void; onDuplicate: () => void; onDelete: () => void;
};

function PoiCoordinateControls({
  coordinates,
  onChange,
}: {
  coordinates: readonly [number, number];
  onChange: (coordinates: readonly [number, number]) => void;
}) {
  return (
    <>
      <CoordinateField key={`longitude-${coordinates[0]}`} ariaLabel="POI longitude" label="Longitude" minimum={-180} maximum={180} value={coordinates[0]} onCommit={(longitude) => onChange([longitude, coordinates[1]])} />
      <CoordinateField key={`latitude-${coordinates[1]}`} ariaLabel="POI latitude" label="Latitude" minimum={-MAX_MERCATOR_LATITUDE} maximum={MAX_MERCATOR_LATITUDE} value={coordinates[1]} onCommit={(latitude) => onChange([coordinates[0], latitude])} />
    </>
  );
}

const ShapeAppearanceControls = memo(function ShapeAppearanceControls({
  appearance,
  onChange,
}: {
  appearance: ShapeAppearance;
  onChange: (appearance: ShapeAppearance) => void;
}) {
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
    setWidthEdit({ source: strokeWidth, value: String(strokeWidth) });
    onChange({ ...appearance, strokeWidth });
  };

  return (
    <>
      <PropertyRow label="Fill"><label className="color-field"><input aria-label="Shape fill color" type="color" value={appearance.fillColor} onChange={(event) => onChange({ ...appearance, fillColor: event.target.value })} /></label></PropertyRow>
      <PropertyRow label="Outline"><label className="color-field"><input aria-label="Shape outline color" type="color" value={appearance.strokeColor} onChange={(event) => onChange({ ...appearance, strokeColor: event.target.value })} /></label></PropertyRow>
      <PropertyRow label="Width"><InputGroup><InputNumber aria-label="Shape outline width" aria-invalid={isWidthInvalid || undefined} min={0.5} max={12} step={0.5} value={widthDraft} onChange={(event) => setWidthEdit({ source: appearance.strokeWidth, value: event.target.value })} onBlur={(event) => commitWidth(event.currentTarget.value)} /><InputGroupAddon align="inline-end" enableScrubbing sensitivity={4}>px</InputGroupAddon></InputGroup></PropertyRow>
      <Switch aria-label="Invert shape fill" isChecked={appearance.invert} label="Invert outside area" onCheckedChange={(isChecked) => onChange({ ...appearance, invert: isChecked })} />
    </>
  );
}, (previous, next) => previous.appearance === next.appearance);

function PoiLayerProperties({
  layer,
  assets,
  onAppearanceChange,
  onPoiCoordinatesChange,
  onPoiCustomMarkerChange,
}: Pick<LayerPropertiesProps, 'layer' | 'assets' | 'onAppearanceChange' | 'onPoiCoordinatesChange' | 'onPoiCustomMarkerChange'>) {
  const appearance = layer.appearance?.kind === 'poi' ? layer.appearance : undefined;
  const customAsset = appearance?.customAssetId ? assets[appearance.customAssetId] : undefined;
  return (
    <>
      {appearance && (
        <PropertySection title="Appearance">
          <PoiAppearanceControls key={`${layer.id}-${appearance.size}-${appearance.label}`} appearance={appearance} customAsset={customAsset} onChange={onAppearanceChange} onCustomMarkerChange={onPoiCustomMarkerChange} />
        </PropertySection>
      )}
      {layer.geometry?.type === 'Point' && (
        <PropertySection title="Location">
          <PoiCoordinateControls coordinates={layer.geometry.coordinates} onChange={onPoiCoordinatesChange} />
        </PropertySection>
      )}
    </>
  );
}

type RouteTypePropertiesProps = {
  documentEpoch: number | undefined;
  layer: ContentLayer;
  mapMatchingProvider: MapMatchingProvider | undefined;
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
};

function RouteTypeProperties(props: RouteTypePropertiesProps) {
  return <RouteLayerProperties layer={props.layer} {...(props.documentEpoch !== undefined && { documentEpoch: props.documentEpoch })} {...(props.mapMatchingProvider && { mapMatchingProvider: props.mapMatchingProvider })} {...(props.onApplyMapMatching && { onApplyMapMatching: props.onApplyMapMatching })} {...(props.onArcCurvatureChange && { onArcCurvatureChange: props.onArcCurvatureChange })} {...(props.onBeginRouteExtend && { onBeginExtend: props.onBeginRouteExtend })} directionsRouteEditError={props.directionsRouteEditError} directionsRouteEditIsRouting={props.directionsRouteEditIsRouting} directionsRouteEditWaypoints={props.directionsRouteEditWaypoints} onRetryDirectionsRouteEdit={props.onRetryDirectionsRouteEdit} onCancelDirectionsRouteEdit={props.onCancelDirectionsRouteEdit} onAppearanceChange={props.onAppearanceChange} onRouteVertexInsert={props.onRouteVertexInsert} onRouteVertexRemove={props.onRouteVertexRemove} onRouteVertexChange={props.onRouteVertexChange} />;
}

function LayerTypeProperties({
  documentEpoch,
  layer,
  mapMatchingProvider,
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
}: Pick<LayerPropertiesProps, 'documentEpoch' | 'layer' | 'assets' | 'mapMatchingProvider' | 'onApplyMapMatching' | 'onAppearanceChange' | 'onBeginRouteExtend' | 'onArcCurvatureChange' | 'onPoiCoordinatesChange' | 'onPoiCustomMarkerChange' | 'onRouteVertexInsert' | 'onRouteVertexRemove' | 'onRouteVertexChange' | 'onShapeVertexChange' | 'directionsRouteEditError' | 'directionsRouteEditIsRouting' | 'directionsRouteEditWaypoints' | 'onRetryDirectionsRouteEdit' | 'onCancelDirectionsRouteEdit'>) {
  switch (layer.type) {
    case 'route': {
      return <RouteTypeProperties documentEpoch={documentEpoch} layer={layer} mapMatchingProvider={mapMatchingProvider} onApplyMapMatching={onApplyMapMatching} onAppearanceChange={onAppearanceChange} onBeginRouteExtend={onBeginRouteExtend} onArcCurvatureChange={onArcCurvatureChange} onRouteVertexInsert={onRouteVertexInsert} onRouteVertexRemove={onRouteVertexRemove} onRouteVertexChange={onRouteVertexChange} directionsRouteEditError={directionsRouteEditError} directionsRouteEditIsRouting={directionsRouteEditIsRouting} directionsRouteEditWaypoints={directionsRouteEditWaypoints} onRetryDirectionsRouteEdit={onRetryDirectionsRouteEdit} onCancelDirectionsRouteEdit={onCancelDirectionsRouteEdit} />;
    }
    case 'poi': {
      return <PoiLayerProperties layer={layer} assets={assets} onAppearanceChange={onAppearanceChange} onPoiCoordinatesChange={onPoiCoordinatesChange} onPoiCustomMarkerChange={onPoiCustomMarkerChange} />;
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
}: LayerPropertiesProps) {
  const [nameEdit, setNameEdit] = useState(() => ({ source: layer.name, value: layer.name }));
  const [opacityEdit, setOpacityEdit] = useState(() => ({ source: layer.opacity, value: String(layer.opacity) }));
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
  const deleteLayer = useStableEvent(onDelete);
  const duplicateLayer = useStableEvent(onDuplicate);
  const replaceLayer = useStableEvent(onReplace);
  const toggleLayerLock = useStableEvent(onToggleLock);
  const toggleLayerVisibility = useStableEvent(onToggleVisibility);
  const changeNameDraft = useStableEvent((value: string) => setNameEdit({ source: layer.name, value }));
  const changeOpacityDraft = useStableEvent((value: string) => setOpacityEdit({ source: layer.opacity, value }));
  const commitNameDraft = useStableEvent(commitName);
  const commitOpacityDraft = useStableEvent(commitOpacity);

  return (
    <div className="properties-panel">
      <LayerIdentityProperties
        layer={layer}
        nameDraft={nameDraft}
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
      <LayerTypeProperties documentEpoch={documentEpoch} layer={layer} assets={assets} mapMatchingProvider={mapMatchingProvider} onApplyMapMatching={onApplyMapMatching} onAppearanceChange={onAppearanceChange} onBeginRouteExtend={onBeginRouteExtend} onArcCurvatureChange={onArcCurvatureChange} onPoiCoordinatesChange={onPoiCoordinatesChange} onPoiCustomMarkerChange={onPoiCustomMarkerChange} onRouteVertexInsert={onRouteVertexInsert} onRouteVertexRemove={onRouteVertexRemove} onRouteVertexChange={onRouteVertexChange} onShapeVertexChange={onShapeVertexChange} directionsRouteEditError={directionsRouteEditError} directionsRouteEditIsRouting={directionsRouteEditIsRouting} directionsRouteEditWaypoints={directionsRouteEditWaypoints} onRetryDirectionsRouteEdit={onRetryDirectionsRouteEdit} onCancelDirectionsRouteEdit={onCancelDirectionsRouteEdit} />
    </div>
  );
}
