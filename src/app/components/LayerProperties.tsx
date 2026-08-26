import { memo, useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { ContentLayer, LayerAppearance, RouteAppearance, ShapeAppearance } from '../../domain/project';
import type { CustomMarkerAsset } from '../../domain/customMarkerAssets';
import {
  ROUTE_TRAVEL_PROFILES,
  ROUTE_TRAVEL_PROFILE_LABELS,
  type RouteTravelProfile,
} from '../../domain/routeProfiles';
import { CoordinateField } from './CoordinateField';
import { DirectionsProvenanceSummary } from './DirectionsProvenanceSummary';
import { ElevationProfilePanel } from './ElevationProfilePanel';
import { LayerIdentityProperties } from './LayerIdentityProperties';
import { MultiPartGeometryStatus } from './MultiPartGeometryStatus';
import { PoiAppearanceControls } from './PoiAppearanceControls';
import { InspectorAccordion, PropertyRow, PropertySection } from './PropertyControls';
import { RouteVertexControls } from './RouteVertexControls';
import { ShapeVertexControls } from './ShapeVertexControls';
import { Checkbox, Switch } from './UiControls';

function useStableEvent<Arguments extends unknown[], Result>(callback: (...arguments_: Arguments) => Result) {
  const callbackRef = useRef(callback);
  useLayoutEffect(() => { callbackRef.current = callback; }, [callback]);
  return useCallback((...arguments_: Arguments) => callbackRef.current(...arguments_), []);
}

type LayerPropertiesProps = {
  layer: ContentLayer;
  assets: Record<string, CustomMarkerAsset>;
  onRename: (name: string) => void;
  onOpacityChange: (opacity: number) => void;
  onAppearanceChange: (appearance: LayerAppearance) => void;
  onPoiCoordinatesChange: (coordinates: readonly [number, number]) => void;
  onPoiCustomMarkerChange: (asset: CustomMarkerAsset | null) => void;
  onRouteVertexInsert: (vertexIndex: number) => void; onRouteVertexRemove: (vertexIndex: number) => void;
  onRouteVertexChange: (vertexIndex: number, coordinates: readonly [number, number]) => void;
  onShapeVertexChange: (ringIndex: number, vertexIndex: number, coordinates: readonly [number, number]) => void;
  onToggleVisibility: () => void; onToggleLock: () => void;
  onReplace: (trigger: HTMLElement | null) => void; onDuplicate: () => void; onDelete: () => void;
};

function RouteAppearanceControls({
  appearance,
  onChange,
}: {
  appearance: RouteAppearance;
  onChange: (appearance: RouteAppearance) => void;
}) {
  const [widthEdit, setWidthEdit] = useState(() => ({
    source: appearance.width,
    value: String(appearance.width),
  }));
  const widthDraft = widthEdit.source === appearance.width ? widthEdit.value : String(appearance.width);
  const widthValue = Number(widthDraft);
  const isWidthInvalid = widthDraft.trim() === ''
    || !Number.isFinite(widthValue)
    || widthValue < 1
    || widthValue > 16;
  const commitWidth = (value: string) => {
    const width = Number(value);
    if (value.trim() === '' || !Number.isFinite(width) || width < 1 || width > 16) {
      setWidthEdit({ source: appearance.width, value: String(appearance.width) });
      return;
    }
    setWidthEdit({ source: width, value: String(width) });
    onChange({ ...appearance, width });
  };

  return (
    <>
      <PropertyRow label="Color"><label className="color-field"><input aria-label="Route color" type="color" value={appearance.color} onChange={(event) => onChange({ ...appearance, color: event.target.value })} /></label></PropertyRow>
      <PropertyRow label="Width"><label className="number-field"><input aria-label="Route width" aria-invalid={isWidthInvalid || undefined} value={widthDraft} onChange={(event) => setWidthEdit({ source: appearance.width, value: event.target.value })} onBlur={(event) => commitWidth(event.currentTarget.value)} /><small>px</small></label></PropertyRow>
      <PropertyRow label="Profile"><select aria-label="Route travel profile" value={appearance.travelProfile} onChange={(event) => onChange({ ...appearance, travelProfile: event.target.value as RouteTravelProfile })}>{ROUTE_TRAVEL_PROFILES.map((profile) => <option key={profile} value={profile}>{ROUTE_TRAVEL_PROFILE_LABELS[profile]}</option>)}</select></PropertyRow>
      <Checkbox aria-label="Show travel-mode marker" isChecked={appearance.showTravelModeIcon} label="Show mode marker" onCheckedChange={(isChecked) => onChange({ ...appearance, showTravelModeIcon: isChecked })} />
    </>
  );
}

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
      <CoordinateField key={`latitude-${coordinates[1]}`} ariaLabel="POI latitude" label="Latitude" minimum={-90} maximum={90} value={coordinates[1]} onCommit={(latitude) => onChange([coordinates[0], latitude])} />
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
      <PropertyRow label="Width"><label className="number-field"><input aria-label="Shape outline width" aria-invalid={isWidthInvalid || undefined} value={widthDraft} onChange={(event) => setWidthEdit({ source: appearance.strokeWidth, value: event.target.value })} onBlur={(event) => commitWidth(event.currentTarget.value)} /><small>px</small></label></PropertyRow>
      <Switch aria-label="Invert shape fill" isChecked={appearance.invert} label="Invert outside area" onCheckedChange={(isChecked) => onChange({ ...appearance, invert: isChecked })} />
    </>
  );
}, (previous, next) => previous.appearance === next.appearance);

function RouteLayerProperties({
  layer,
  onAppearanceChange,
  onRouteVertexInsert,
  onRouteVertexRemove,
  onRouteVertexChange,
}: Pick<LayerPropertiesProps, 'layer' | 'onAppearanceChange' | 'onRouteVertexInsert' | 'onRouteVertexRemove' | 'onRouteVertexChange'>) {
  if (layer.appearance?.kind !== 'route') return null;
  return (
    <>
      <PropertySection title="Appearance">
        <RouteAppearanceControls key={`${layer.id}-${layer.appearance.width}`} appearance={layer.appearance} onChange={onAppearanceChange} />
      </PropertySection>
      <DirectionsProvenanceSummary layer={layer} />
      {layer.geometry?.type === 'LineString' && (
        <InspectorAccordion
          isDefaultExpanded={false}
          storageKey="print-map-studio:inspector:layer:route-advanced"
          summary="Vertices · Elevation profile"
          title="Advanced"
        >
          <PropertySection title="Vertices">
            <RouteVertexControls key={layer.id} coordinates={layer.geometry.coordinates} disabled={layer.locked || !layer.visible} onChange={onRouteVertexChange} onInsert={onRouteVertexInsert} onRemove={onRouteVertexRemove} />
          </PropertySection>
          <PropertySection title="Elevation">
            <ElevationProfilePanel
              key={`${layer.id}-${JSON.stringify(layer.geometry.coordinates)}`}
              coordinates={layer.geometry.coordinates}
              routeName={layer.name}
              routeColor={layer.appearance.color}
            />
          </PropertySection>
        </InspectorAccordion>
      )}
    </>
  );
}

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

function LayerTypeProperties({
  layer,
  assets,
  onAppearanceChange,
  onPoiCoordinatesChange,
  onPoiCustomMarkerChange,
  onRouteVertexInsert,
  onRouteVertexRemove,
  onRouteVertexChange,
  onShapeVertexChange,
}: Pick<LayerPropertiesProps, 'layer' | 'assets' | 'onAppearanceChange' | 'onPoiCoordinatesChange' | 'onPoiCustomMarkerChange' | 'onRouteVertexInsert' | 'onRouteVertexRemove' | 'onRouteVertexChange' | 'onShapeVertexChange'>) {
  switch (layer.type) {
    case 'route': {
      return <RouteLayerProperties layer={layer} onAppearanceChange={onAppearanceChange} onRouteVertexInsert={onRouteVertexInsert} onRouteVertexRemove={onRouteVertexRemove} onRouteVertexChange={onRouteVertexChange} />;
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
  onRename,
  onOpacityChange,
  onAppearanceChange,
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
      <LayerTypeProperties layer={layer} assets={assets} onAppearanceChange={onAppearanceChange} onPoiCoordinatesChange={onPoiCoordinatesChange} onPoiCustomMarkerChange={onPoiCustomMarkerChange} onRouteVertexInsert={onRouteVertexInsert} onRouteVertexRemove={onRouteVertexRemove} onRouteVertexChange={onRouteVertexChange} onShapeVertexChange={onShapeVertexChange} />
    </div>
  );
}
