import { useState } from "react";
import type {
  ContentLayer,
  LayerAppearance,
  MapMatchingInput,
  RouteAppearance,
} from "../../domain/project";
import { semanticRoutePositions } from "../../domain/routeGeometry";
import {
  ROUTE_TRAVEL_MARKERS,
  ROUTE_TRAVEL_MARKER_LABELS,
  type RouteTravelMarker,
} from "../../domain/routeProfiles";
import type { MapMatchingProvider } from "../../services/mapbox/contracts";
import { InputGroup, InputGroupAddon, InputNumber } from "./InputGroup";
import { PropertyRow, PropertySection } from "./PropertyControls";
import { RouteAdvancedProperties } from "./RouteAdvancedProperties";
import type { RouteExtensionEndpoint } from "./routeAuthoringActions";

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
  const widthDraft =
    widthEdit.source === appearance.width
      ? widthEdit.value
      : String(appearance.width);
  const widthValue = Number(widthDraft);
  const isWidthInvalid =
    widthDraft.trim() === "" ||
    !Number.isFinite(widthValue) ||
    widthValue < 1 ||
    widthValue > 16;
  const commitWidth = (value: string) => {
    const width = Number(value);
    if (
      value.trim() === "" ||
      !Number.isFinite(width) ||
      width < 1 ||
      width > 16
    ) {
      setWidthEdit({
        source: appearance.width,
        value: String(appearance.width),
      });
      return;
    }
    setWidthEdit({ source: width, value: String(width) });
    onChange({ ...appearance, width });
  };
  return (
    <>
      <PropertyRow label="Color">
        <label className="color-field">
          <input
            aria-label="Route color"
            type="color"
            value={appearance.color}
            onChange={(event) =>
              onChange({ ...appearance, color: event.target.value })
            }
          />
        </label>
      </PropertyRow>
      <PropertyRow label="Width">
        <InputGroup>
          <InputNumber
            aria-label="Route width"
            aria-invalid={isWidthInvalid || undefined}
            min={1}
            max={16}
            step={0.5}
            value={widthDraft}
            onChange={(event) =>
              setWidthEdit({
                source: appearance.width,
                value: event.target.value,
              })
            }
            onBlur={(event) => commitWidth(event.currentTarget.value)}
          />
          <InputGroupAddon align="inline-end" enableScrubbing sensitivity={4}>
            px
          </InputGroupAddon>
        </InputGroup>
      </PropertyRow>
      <PropertyRow label="Travel marker">
        <select
          aria-label="Route travel marker"
          value={appearance.travelMarker ?? "none"}
          onChange={(event) =>
            onChange({
              ...appearance,
              travelMarker:
                event.target.value === "none"
                  ? null
                  : (event.target.value as RouteTravelMarker),
            })
          }
        >
          <option value="none">None</option>
          {ROUTE_TRAVEL_MARKERS.map((marker) => (
            <option key={marker} value={marker}>
              {ROUTE_TRAVEL_MARKER_LABELS[marker]}
            </option>
          ))}
        </select>
      </PropertyRow>
    </>
  );
}

export type RouteLayerPropertiesProps = {
  documentEpoch?: number;
  layer: ContentLayer;
  mapMatchingProvider?: MapMatchingProvider;
  onApplyMapMatching?: (
    input: MapMatchingInput,
    expectedDocumentEpoch: number,
  ) => boolean;
  onAppearanceChange: (appearance: LayerAppearance) => void;
  onBeginExtend?: (
    endpoint: RouteExtensionEndpoint,
    trigger: HTMLButtonElement,
  ) => void;
  onArcCurvatureChange?: (segmentIndex: number, curvature: number) => void;
  onRouteVertexInsert: (vertexIndex: number) => void;
  onRouteVertexRemove: (vertexIndex: number) => void;
  onRouteVertexChange: (
    vertexIndex: number,
    coordinates: readonly [number, number],
  ) => void;
  directionsRouteEditError?: string | null;
  directionsRouteEditIsRouting?: boolean;
  directionsRouteEditWaypoints?: readonly (readonly [number, number])[] | null;
  onRetryDirectionsRouteEdit?: () => void;
  onCancelDirectionsRouteEdit?: () => void;
};

function RouteExtensionControls({
  layer,
  onBeginExtend,
}: Pick<RouteLayerPropertiesProps, "layer" | "onBeginExtend">) {
  if (!onBeginExtend) return null;
  const isDisabled = layer.locked || !layer.visible;
  return (
    <PropertySection title="Extend/Edit route">
      <p className="property-note">
        Continue this route from either endpoint without creating another layer.
      </p>
      <div className="route-extend-actions">
        <button
          type="button"
          disabled={isDisabled}
          onClick={(event) => onBeginExtend("start", event.currentTarget)}
        >
          Extend start
        </button>
        <button
          type="button"
          disabled={isDisabled}
          onClick={(event) => onBeginExtend("end", event.currentTarget)}
        >
          Extend end
        </button>
      </div>
    </PropertySection>
  );
}

export function RouteLayerProperties(props: RouteLayerPropertiesProps) {
  const { layer } = props;
  if (layer.appearance?.kind !== "route") return null;
  if (layer.geometry?.type !== "LineString" && layer.geometry?.type !== "Arc")
    return null;
  const positions =
    props.directionsRouteEditWaypoints ?? semanticRoutePositions(layer) ?? [];
  return (
    <>
      <PropertySection title="Appearance">
        <RouteAppearanceControls
          key={`${layer.id}-${layer.appearance.width}`}
          appearance={layer.appearance}
          onChange={props.onAppearanceChange}
        />
      </PropertySection>
      <RouteExtensionControls
        layer={layer}
        onBeginExtend={props.onBeginExtend}
      />
      <RouteAdvancedProperties
        {...props}
        documentEpoch={props.documentEpoch ?? 0}
        positions={positions}
      />
    </>
  );
}
