import { memo } from 'react';
import type { ContentLayer } from '../../domain/project';
import { PropertySection } from './PropertyControls';

export const DirectionsProvenanceSummary = memo(function DirectionsProvenanceSummary({
  provenance,
}: {
  provenance: ContentLayer["provenance"];
}) {
  if (provenance?.service !== 'directions-v5') return null;
  const kilometres = provenance.distanceMeters / 1000;
  const distance = `${kilometres >= 10 ? kilometres.toFixed(0) : kilometres.toFixed(1)} km`;
  const duration = `${Math.max(1, Math.round(provenance.durationSeconds / 60))} min`;
  const waypoints = `${provenance.waypoints.length} waypoints`;
  return (
    <PropertySection title="Mapbox Directions">
      <p className="property-note">{distance} · {duration} · {waypoints}</p>
      <p className="property-note">Canonical geometry stays editable and exports offline.</p>
    </PropertySection>
  );
});
