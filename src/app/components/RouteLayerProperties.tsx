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
  onRouteVertexInsert,
  onRouteVertexRemove,
  onRouteVertexChange,
}: RouteLayerPropertiesProps) {
  if (layer.appearance?.kind !== 'route') return null;
  if (layer.geometry?.type !== 'LineString') {
    return <><PropertySection title="Appearance"><RouteAppearanceControls appearance={layer.appearance} onChange={onAppearanceChange} /></PropertySection><DirectionsProvenanceSummary layer={layer} /></>;
  }
  return (
    <>
      <PropertySection title="Appearance">
        <RouteAppearanceControls key={`${layer.id}-${layer.appearance.width}`} appearance={layer.appearance} onChange={onAppearanceChange} />
      </PropertySection>
      <DirectionsProvenanceSummary layer={layer} />
      <InspectorAccordion isDefaultExpanded={false} storageKey="print-map-studio:inspector:layer:route-advanced" summary="Road matching · Vertices · Elevation profile" title="Advanced">
        {onApplyMapMatching && (
          <PropertySection title="Road matching">
            <RouteMapMatchingControl
              key={`${layer.id}-${documentEpoch}-${layer.visible}-${layer.locked}-${layer.appearance.travelProfile}-${JSON.stringify(layer.geometry.coordinates)}`}
              coordinates={layer.geometry.coordinates}
              disabled={layer.locked || !layer.visible}
              documentEpoch={documentEpoch}
              onApply={onApplyMapMatching}
              profile={layer.appearance.travelProfile}
              provenance={layer.provenance?.service === 'map-matching-v5' ? layer.provenance : undefined}
              {...(mapMatchingProvider && { provider: mapMatchingProvider })}
            />
          </PropertySection>
        )}
        <PropertySection title="Vertices">
          <RouteVertexControls key={layer.id} coordinates={layer.geometry.coordinates} disabled={layer.locked || !layer.visible} onChange={onRouteVertexChange} onInsert={onRouteVertexInsert} onRemove={onRouteVertexRemove} />
        </PropertySection>
        <PropertySection title="Elevation">
          <ElevationProfilePanel key={`${layer.id}-${JSON.stringify(layer.geometry.coordinates)}`} coordinates={layer.geometry.coordinates} routeName={layer.name} routeColor={layer.appearance.color} />
        </PropertySection>
      </InspectorAccordion>
    </>
  );
}
