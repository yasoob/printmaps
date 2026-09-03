import type { ContentLayer, RouteAppearance } from "../../domain/project";
import type { MapMatchingProvider } from "../../services/mapbox/contracts";
import type { RouteLayerPropertiesProps } from "./RouteLayerProperties";
import { ArcCurvatureControls } from "./ArcCurvatureControls";
import { DirectionsProvenanceSummary } from "./DirectionsProvenanceSummary";
import { ElevationProfilePanel } from "./ElevationProfilePanel";
import { InspectorAccordion, PropertySection } from "./PropertyControls";
import { RouteMapMatchingControl } from "./RouteMapMatchingControl";
import { RouteVertexControls } from "./RouteVertexControls";
import { RouteStructureControls } from "./RouteStructureControls";
import {
  RouteMarkerSection,
  RouteSegmentSection,
} from "./RouteAppearanceSections";
import { DirectionsEditStatus } from "./DirectionsEditStatus";

type RouteAdvancedPropertiesProps = Omit<
  RouteLayerPropertiesProps,
  "documentEpoch"
> & {
  documentEpoch: number;
  positions: readonly (readonly [number, number])[];
};

function RouteStructureSection({
  directionsProvider,
  documentEpoch,
  layer,
  onTransformRoute,
}: Pick<
  RouteLayerPropertiesProps,
  "directionsProvider" | "layer" | "onTransformRoute"
> & { documentEpoch: number }) {
  if (!onTransformRoute) return null;
  return (
    <PropertySection title="Route structure">
      <RouteStructureControls
        documentEpoch={documentEpoch}
        layer={layer}
        onTransformRoute={onTransformRoute}
        {...(directionsProvider && { directionsProvider })}
      />
    </PropertySection>
  );
}

export function RouteAdvancedProperties({
  documentEpoch,
  layer,
  mapMatchingProvider,
  directionsProvider,
  onTransformRoute,
  onAppearanceChange,
  onApplyMapMatching,
  onArcCurvatureChange,
  onRouteVertexChange,
  onRouteVertexInsert,
  onRouteVertexRemove,
  positions,
  directionsRouteEditError,
  directionsRouteEditIsRouting,
  onRetryDirectionsRouteEdit,
  onCancelDirectionsRouteEdit,
}: RouteAdvancedPropertiesProps) {
  if (layer.appearance?.kind !== "route") return null;
  if (layer.geometry?.type !== "LineString" && layer.geometry?.type !== "Arc")
    return null;
  const vertexProps = {
    disabled: layer.locked || !layer.visible,
    onRouteVertexChange,
    onRouteVertexInsert,
    onRouteVertexRemove,
    positions,
    routeId: layer.id,
  };
  if (layer.geometry.type === "Arc") {
    return (
      <ArcRouteAdvanced
        {...vertexProps}
        curvatures={layer.geometry.curvatures}
        onArcCurvatureChange={onArcCurvatureChange}
        documentEpoch={documentEpoch}
        directionsProvider={directionsProvider}
        layer={layer}
        onTransformRoute={onTransformRoute}
        onAppearanceChange={onAppearanceChange}
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
      directionsProvider={directionsProvider}
      onTransformRoute={onTransformRoute}
      onAppearanceChange={onAppearanceChange}
      onApplyMapMatching={onApplyMapMatching}
      directionsRouteEditError={directionsRouteEditError}
      directionsRouteEditIsRouting={directionsRouteEditIsRouting}
      onRetryDirectionsRouteEdit={onRetryDirectionsRouteEdit}
      onCancelDirectionsRouteEdit={onCancelDirectionsRouteEdit}
    />
  );
}

type AdvancedVertexProps = {
  disabled: boolean;
  onRouteVertexChange: RouteLayerPropertiesProps["onRouteVertexChange"];
  onRouteVertexInsert: RouteLayerPropertiesProps["onRouteVertexInsert"];
  onRouteVertexRemove: RouteLayerPropertiesProps["onRouteVertexRemove"];
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
  documentEpoch,
  directionsProvider,
  layer,
  onTransformRoute,
  onAppearanceChange,
}: AdvancedVertexProps & {
  curvatures: readonly number[];
  onArcCurvatureChange?: RouteLayerPropertiesProps["onArcCurvatureChange"];
  documentEpoch: number;
  directionsProvider?: RouteLayerPropertiesProps["directionsProvider"];
  layer: ContentLayer;
  onTransformRoute?: RouteLayerPropertiesProps["onTransformRoute"];
  onAppearanceChange: RouteLayerPropertiesProps["onAppearanceChange"];
}) {
  return (
    <InspectorAccordion
      isDefaultExpanded={false}
      storageKey="print-map-studio:inspector:layer:route-advanced"
      summary="Structure · Marker · Segments · Curvature · Vertices"
      title="Advanced"
    >
      <RouteStructureSection
        directionsProvider={directionsProvider}
        documentEpoch={documentEpoch}
        layer={layer}
        onTransformRoute={onTransformRoute}
      />
      <RouteMarkerSection appearance={layer.appearance as RouteAppearance} disabled={disabled} onChange={onAppearanceChange} />
      <RouteSegmentSection appearance={layer.appearance as RouteAppearance} disabled={disabled} onChange={onAppearanceChange} />
      <PropertySection title="Curvature">
        <ArcCurvatureControls
          curvatures={curvatures}
          disabled={disabled}
          onChange={(segmentIndex, curvature) =>
            onArcCurvatureChange?.(segmentIndex, curvature)
          }
        />
      </PropertySection>
      <PropertySection title="Vertices">
        <RouteVertexControls
          key={routeId}
          coordinates={positions}
          disabled={disabled}
          noun="Anchor"
          middleOnlyRemove
          onChange={onRouteVertexChange}
          onInsert={onRouteVertexInsert}
          onRemove={onRouteVertexRemove}
        />
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
  directionsProvider,
  onTransformRoute,
  onAppearanceChange,
  onApplyMapMatching,
  onRouteVertexChange,
  onRouteVertexInsert,
  onRouteVertexRemove,
  positions,
  routeId,
  directionsRouteEditError,
  directionsRouteEditIsRouting,
  onRetryDirectionsRouteEdit,
  onCancelDirectionsRouteEdit,
}: AdvancedVertexProps & {
  appearance: RouteAppearance;
  coordinates: readonly (readonly [number, number])[];
  documentEpoch: number;
  layer: ContentLayer;
  mapMatchingProvider?: MapMatchingProvider;
  directionsProvider?: RouteLayerPropertiesProps["directionsProvider"];
  onTransformRoute?: RouteLayerPropertiesProps["onTransformRoute"];
  onAppearanceChange: RouteLayerPropertiesProps["onAppearanceChange"];
  onApplyMapMatching?: RouteLayerPropertiesProps["onApplyMapMatching"];
  directionsRouteEditError?: string | null;
  directionsRouteEditIsRouting?: boolean;
  onRetryDirectionsRouteEdit?: () => void;
  onCancelDirectionsRouteEdit?: () => void;
}) {
  const isDirectionsRoute = layer.provenance?.service === "directions-v5";
  return (
    <>
      <DirectionsProvenanceSummary provenance={layer.provenance} />
      <DirectionsEditStatus
        error={directionsRouteEditError}
        isRouting={directionsRouteEditIsRouting}
        onRetry={onRetryDirectionsRouteEdit}
        onCancel={onCancelDirectionsRouteEdit}
      />
      <InspectorAccordion
        isDefaultExpanded={false}
        storageKey="print-map-studio:inspector:layer:route-advanced"
        summary={
          isDirectionsRoute
            ? "Structure · Marker · Segments · Waypoints · Elevation profile"
            : "Structure · Marker · Segments · Road matching · Vertices · Elevation profile"
        }
        title="Advanced"
      >
        <RouteStructureSection
          directionsProvider={directionsProvider}
          documentEpoch={documentEpoch}
          layer={layer}
          onTransformRoute={onTransformRoute}
        />
        <RouteMarkerSection appearance={appearance} disabled={disabled} onChange={onAppearanceChange} />
        <RouteSegmentSection appearance={appearance} disabled={disabled} onChange={onAppearanceChange} />
        {onApplyMapMatching && !isDirectionsRoute && (
          <PropertySection title="Road matching">
            <RouteMapMatchingControl
              key={`${layer.id}-${documentEpoch}-${layer.visible}-${layer.locked}-${JSON.stringify(coordinates)}`}
              coordinates={coordinates}
              disabled={disabled}
              documentEpoch={documentEpoch}
              onApply={onApplyMapMatching}
              provenance={
                layer.provenance?.service === "map-matching-v5"
                  ? layer.provenance
                  : undefined
              }
              {...(mapMatchingProvider && { provider: mapMatchingProvider })}
            />
          </PropertySection>
        )}
        <PropertySection title={isDirectionsRoute ? "Waypoints" : "Vertices"}>
          <RouteVertexControls
            key={routeId}
            coordinates={positions}
            disabled={disabled || directionsRouteEditIsRouting}
            noun={isDirectionsRoute ? "Waypoint" : "Anchor"}
            allowInsert={!isDirectionsRoute}
            middleOnlyRemove
            onChange={onRouteVertexChange}
            onInsert={onRouteVertexInsert}
            onRemove={onRouteVertexRemove}
          />
        </PropertySection>
        <PropertySection title="Elevation">
          <ElevationProfilePanel
            key={`${layer.id}-${JSON.stringify(coordinates)}`}
            coordinates={coordinates}
            routeName={layer.name}
            routeColor={appearance.color}
          />
        </PropertySection>
      </InspectorAccordion>
    </>
  );
}
