import { useState } from 'react';
import type { ContentLayer, LayerAppearance, MapMatchingInput, RouteAppearance } from '../../domain/project';
import {
  ROUTE_TRAVEL_PROFILES,
  ROUTE_TRAVEL_PROFILE_LABELS,
  type RouteTravelProfile,
} from '../../domain/routeProfiles';
import type { MapMatchingProvider } from '../../services/mapbox/contracts';
import { DirectionsProvenanceSummary } from './DirectionsProvenanceSummary';
import { ElevationProfilePanel } from './ElevationProfilePanel';
import { InspectorAccordion, PropertyRow, PropertySection } from './PropertyControls';
import { RouteMapMatchingControl } from './RouteMapMatchingControl';
import { RouteVertexControls } from './RouteVertexControls';
import { Checkbox } from './UiControls';
import { InputGroup, InputGroupAddon, InputNumber } from './InputGroup';
import { MAX_ARC_CURVATURE } from '../../domain/routeArcGeometry';

function RouteAppearanceControls({
  appearance,
  onChange,
}: {
  appearance: RouteAppearance;
  onChange: (appearance: RouteAppearance) => void;
}) {
  const [widthEdit, setWidthEdit] = useState(() => ({ source: appearance.width, value: String(appearance.width) }));
  const widthDraft = widthEdit.source === appearance.width ? widthEdit.value : String(appearance.width);
  const widthValue = Number(widthDraft);
  const isWidthInvalid = widthDraft.trim() === '' || !Number.isFinite(widthValue) || widthValue < 1 || widthValue > 16;
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
      <PropertyRow label="Width"><InputGroup><InputNumber aria-label="Route width" aria-invalid={isWidthInvalid || undefined} min={1} max={16} step={0.5} value={widthDraft} onChange={(event) => setWidthEdit({ source: appearance.width, value: event.target.value })} onBlur={(event) => commitWidth(event.currentTarget.value)} /><InputGroupAddon align="inline-end" enableScrubbing sensitivity={4}>px</InputGroupAddon></InputGroup></PropertyRow>
      <PropertyRow label="Profile"><select aria-label="Route travel profile" value={appearance.travelProfile} onChange={(event) => onChange({ ...appearance, travelProfile: event.target.value as RouteTravelProfile })}>{ROUTE_TRAVEL_PROFILES.map((profile) => <option key={profile} value={profile}>{ROUTE_TRAVEL_PROFILE_LABELS[profile]}</option>)}</select></PropertyRow>
      <Checkbox aria-label="Show travel-mode marker" isChecked={appearance.showTravelModeIcon} label="Show mode marker" onCheckedChange={(isChecked) => onChange({ ...appearance, showTravelModeIcon: isChecked })} />
    </>
  );
}

type RouteLayerPropertiesProps = {
  documentEpoch?: number;
  layer: ContentLayer;
  mapMatchingProvider?: MapMatchingProvider;
  onApplyMapMatching?: (input: MapMatchingInput, expectedDocumentEpoch: number) => boolean;
  onAppearanceChange: (appearance: LayerAppearance) => void;
  onArcCurvatureChange?: (segmentIndex: number, curvature: number) => void;
  onRouteVertexInsert: (vertexIndex: number) => void;
  onRouteVertexRemove: (vertexIndex: number) => void;
  onRouteVertexChange: (vertexIndex: number, coordinates: readonly [number, number]) => void;
};

export function RouteLayerProperties({
  documentEpoch = 0,
  layer,
  mapMatchingProvider,
  onApplyMapMatching,
  onAppearanceChange,
  onArcCurvatureChange,
  onRouteVertexInsert,
  onRouteVertexRemove,
  onRouteVertexChange,
}: RouteLayerPropertiesProps) {
  if (layer.appearance?.kind !== 'route') return null;
  if (layer.geometry?.type !== 'LineString' && layer.geometry?.type !== 'Arc') return null;
  const positions = layer.geometry.type === 'Arc' ? layer.geometry.anchors : layer.geometry.coordinates;
  return (
    <>
      <PropertySection title="Appearance">
        <RouteAppearanceControls key={`${layer.id}-${layer.appearance.width}`} appearance={layer.appearance} onChange={onAppearanceChange} />
      </PropertySection>
      <RouteAdvancedProperties
        documentEpoch={documentEpoch}
        layer={layer}
        mapMatchingProvider={mapMatchingProvider}
        onApplyMapMatching={onApplyMapMatching}
        onArcCurvatureChange={onArcCurvatureChange}
        onRouteVertexChange={onRouteVertexChange}
        onRouteVertexInsert={onRouteVertexInsert}
        onRouteVertexRemove={onRouteVertexRemove}
        positions={positions}
      />
    </>
  );
}

function RouteAdvancedProperties({
  documentEpoch,
  layer,
  mapMatchingProvider,
  onApplyMapMatching,
  onArcCurvatureChange,
  onRouteVertexChange,
  onRouteVertexInsert,
  onRouteVertexRemove,
  positions,
}: Omit<RouteLayerPropertiesProps, 'documentEpoch' | 'onAppearanceChange'> & {
  documentEpoch: number;
  positions: readonly (readonly [number, number])[];
}) {
  if (layer.appearance?.kind !== 'route') return null;
  if (layer.geometry?.type !== 'LineString' && layer.geometry?.type !== 'Arc') return null;
  const vertexProps = {
    disabled: layer.locked || !layer.visible,
    onRouteVertexChange,
    onRouteVertexInsert,
    onRouteVertexRemove,
    positions,
    routeId: layer.id,
  };
  if (layer.geometry.type === 'Arc') {
    return (
      <ArcRouteAdvanced
        {...vertexProps}
        curvatures={layer.geometry.curvatures}
        onArcCurvatureChange={onArcCurvatureChange}
      />
    );
  }
  return (
    <LineRouteAdvanced
      {...vertexProps}
      coordinates={layer.geometry.coordinates}
      documentEpoch={documentEpoch}
      layer={layer}
      appearance={layer.appearance}
      mapMatchingProvider={mapMatchingProvider}
      onApplyMapMatching={onApplyMapMatching}
    />
  );
}

type AdvancedVertexProps = {
  disabled: boolean;
  onRouteVertexChange: RouteLayerPropertiesProps['onRouteVertexChange'];
  onRouteVertexInsert: RouteLayerPropertiesProps['onRouteVertexInsert'];
  onRouteVertexRemove: RouteLayerPropertiesProps['onRouteVertexRemove'];
  positions: readonly (readonly [number, number])[];
  routeId: string;
};

function ArcRouteAdvanced({
  curvatures,
  disabled,
  onArcCurvatureChange,
  onRouteVertexChange,
  onRouteVertexInsert,
  onRouteVertexRemove,
  positions,
  routeId,
}: AdvancedVertexProps & {
  curvatures: readonly number[];
  onArcCurvatureChange?: RouteLayerPropertiesProps['onArcCurvatureChange'];
}) {
  return (
    <InspectorAccordion isDefaultExpanded={false} storageKey="print-map-studio:inspector:layer:route-advanced" summary="Curvature · Vertices" title="Advanced">
      <PropertySection title="Curvature">
        <ArcCurvatureControls curvatures={curvatures} disabled={disabled} onChange={(segmentIndex, curvature) => onArcCurvatureChange?.(segmentIndex, curvature)} />
      </PropertySection>
      <PropertySection title="Vertices">
        <RouteVertexControls key={routeId} coordinates={positions} disabled={disabled} onChange={onRouteVertexChange} onInsert={onRouteVertexInsert} onRemove={onRouteVertexRemove} />
      </PropertySection>
    </InspectorAccordion>
  );
}

function LineRouteAdvanced({
  appearance,
  coordinates,
  disabled,
  documentEpoch,
  layer,
  mapMatchingProvider,
  onApplyMapMatching,
  onRouteVertexChange,
  onRouteVertexInsert,
  onRouteVertexRemove,
  positions,
  routeId,
}: AdvancedVertexProps & {
  appearance: RouteAppearance;
  coordinates: readonly (readonly [number, number])[];
  documentEpoch: number;
  layer: ContentLayer;
  mapMatchingProvider?: MapMatchingProvider;
  onApplyMapMatching?: RouteLayerPropertiesProps['onApplyMapMatching'];
}) {
  return (
    <>
      <DirectionsProvenanceSummary layer={layer} />
      <InspectorAccordion isDefaultExpanded={false} storageKey="print-map-studio:inspector:layer:route-advanced" summary="Road matching · Vertices · Elevation profile" title="Advanced">
        {onApplyMapMatching && <PropertySection title="Road matching">
          <RouteMapMatchingControl
            key={`${layer.id}-${documentEpoch}-${layer.visible}-${layer.locked}-${appearance.travelProfile}-${JSON.stringify(coordinates)}`}
            coordinates={coordinates}
            disabled={disabled}
            documentEpoch={documentEpoch}
            onApply={onApplyMapMatching}
            profile={appearance.travelProfile}
            provenance={layer.provenance?.service === 'map-matching-v5' ? layer.provenance : undefined}
            {...(mapMatchingProvider && { provider: mapMatchingProvider })}
          />
        </PropertySection>}
        <PropertySection title="Vertices">
          <RouteVertexControls key={routeId} coordinates={positions} disabled={disabled} onChange={onRouteVertexChange} onInsert={onRouteVertexInsert} onRemove={onRouteVertexRemove} />
        </PropertySection>
        <PropertySection title="Elevation">
          <ElevationProfilePanel key={`${layer.id}-${JSON.stringify(coordinates)}`} coordinates={coordinates} routeName={layer.name} routeColor={appearance.color} />
        </PropertySection>
      </InspectorAccordion>
    </>
  );
}

function ArcCurvatureControls({
  curvatures,
  disabled,
  onChange,
}: {
  curvatures: readonly number[];
  disabled: boolean;
  onChange: (segmentIndex: number, curvature: number) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const segmentIndex = Math.min(selectedIndex, curvatures.length - 1);
  const curvature = curvatures[segmentIndex] ?? 0;
  const [amountEdit, setAmountEdit] = useState(() => ({
    segmentIndex,
    source: curvature,
    value: String(Math.abs(curvature)),
  }));
  const amountDraft = amountEdit.segmentIndex === segmentIndex && amountEdit.source === curvature
    ? amountEdit.value
    : String(Math.abs(curvature));
  const amount = Number(amountDraft);
  const isInvalid = amountDraft.trim() === '' || !Number.isFinite(amount) || amount < 0 || amount > MAX_ARC_CURVATURE;
  const commitAmount = () => {
    if (isInvalid) {
      setAmountEdit({ segmentIndex, source: curvature, value: String(Math.abs(curvature)) });
      return;
    }
    setAmountEdit({ segmentIndex, source: curvature, value: String(amount) });
    onChange(segmentIndex, amount * (curvature < 0 ? -1 : 1));
  };
  return (
    <>
      <PropertyRow label="Segment">
        <select aria-label="Arc segment" disabled={disabled} value={segmentIndex} onChange={(event) => {
          setSelectedIndex(Number(event.target.value));
        }}>
          {curvatures.map((_value, index) => <option key={index} value={index}>Segment {index + 1}</option>)}
        </select>
      </PropertyRow>
      <PropertyRow label="Bend">
        <InputGroup>
          <InputNumber aria-label="Arc curvature amount" aria-invalid={isInvalid || undefined} disabled={disabled} min={0} max={MAX_ARC_CURVATURE} step={0.05} value={amountDraft} onChange={(event) => setAmountEdit({ segmentIndex, source: curvature, value: event.target.value })} onBlur={commitAmount} />
          <InputGroupAddon align="inline-end">×</InputGroupAddon>
        </InputGroup>
      </PropertyRow>
      <button type="button" aria-label="Flip arc direction" disabled={disabled || curvature === 0} onClick={() => onChange(segmentIndex, -curvature)}>Flip direction</button>
    </>
  );
}
