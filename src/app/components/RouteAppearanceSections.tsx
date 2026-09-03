import { memo } from "react";
import type { RouteAppearance } from "../../domain/project";
import {
  RouteMarkerControls,
  RouteSegmentControls,
} from "./RouteAppearanceAdvancedControls";
import type { RouteLayerPropertiesProps } from "./RouteLayerProperties";
import { PropertySection } from "./PropertyControls";

type RouteAppearanceSectionProps = {
  appearance: RouteAppearance;
  disabled: boolean;
  onChange: RouteLayerPropertiesProps["onAppearanceChange"];
};

export const RouteMarkerSection = memo(function RouteMarkerSection({
  appearance,
  disabled,
  onChange,
}: RouteAppearanceSectionProps) {
  return (
    <PropertySection title="Marker">
      <RouteMarkerControls
        appearance={appearance}
        disabled={disabled}
        onChange={onChange}
      />
    </PropertySection>
  );
});

export const RouteSegmentSection = memo(function RouteSegmentSection({
  appearance,
  disabled,
  onChange,
}: RouteAppearanceSectionProps) {
  return (
    <PropertySection title="Segments">
      <RouteSegmentControls
        appearance={appearance}
        disabled={disabled}
        onChange={onChange}
      />
    </PropertySection>
  );
});
