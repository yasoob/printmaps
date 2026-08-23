import { PropertySection } from './PropertyControls';

export function MultiPartGeometryStatus({ partCount }: Readonly<{ partCount: number }>) {
  return (
    <PropertySection title="Geometry">
      <p className="multi-part-geometry-status" role="status" aria-label="Multi-part geometry status">
        {partCount} disconnected parts · vertex editing is not available for multi-part shapes
      </p>
    </PropertySection>
  );
}
