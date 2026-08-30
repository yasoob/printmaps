import type { ContentLayer, RouteAppearance } from "../../domain/project";
import type { MapMatchingProvider } from "../../services/mapbox/contracts";
import type { RouteLayerPropertiesProps } from "./RouteLayerProperties";
import { ArcCurvatureControls } from "./ArcCurvatureControls";
import { DirectionsProvenanceSummary } from "./DirectionsProvenanceSummary";
import { ElevationProfilePanel } from "./ElevationProfilePanel";
import { InspectorAccordion, PropertySection } from "./PropertyControls";
import { RouteMapMatchingControl } from "./RouteMapMatchingControl";
import { RouteVertexControls } from "./RouteVertexControls";

type RouteAdvancedPropertiesProps = Omit<
  RouteLayerPropertiesProps,
  "documentEpoch" | "onAppearanceChange"
> & {
  documentEpoch: number;
  positions: readonly (readonly [number, number])[];
};

export function RouteAdvancedProperties({
  documentEpoch,
  layer,
  mapMatchingProvider,
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
}: AdvancedVertexProps & {
  curvatures: readonly number[];
  onArcCurvatureChange?: RouteLayerPropertiesProps["onArcCurvatureChange"];
}) {
  return (
    <InspectorAccordion
      isDefaultExpanded={false}
      storageKey="print-map-studio:inspector:layer:route-advanced"
      summary="Curvature · Vertices"
      title="Advanced"
    >
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

function DirectionsEditStatus({
  error,
  isRouting,
  onCancel,
  onRetry,
}: {
  error?: string | null;
  isRouting?: boolean;
  onCancel?: () => void;
  onRetry?: () => void;
}) {
  return (
    <>
      {isRouting && <p role="status">Finding an updated road route…</p>}
      {error && (
        <div className="isochrone-error" role="alert">
          <p>{error}</p>
          <div className="route-vertex-actions">
            <button type="button" onClick={onRetry}>
              Retry
            </button>
            <button type="button" onClick={onCancel}>
              Cancel edit
            </button>
          </div>
        </div>
      )}
    </>
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
  onApplyMapMatching?: RouteLayerPropertiesProps["onApplyMapMatching"];
  directionsRouteEditError?: string | null;
  directionsRouteEditIsRouting?: boolean;
  onRetryDirectionsRouteEdit?: () => void;
  onCancelDirectionsRouteEdit?: () => void;
}) {
  const isDirectionsRoute = layer.provenance?.service === "directions-v5";
  return (
    <>
      <DirectionsProvenanceSummary layer={layer} />
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
            ? "Waypoints · Elevation profile"
            : "Road matching · Vertices · Elevation profile"
        }
        title="Advanced"
      >
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
