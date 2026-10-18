import { calculateMapScale } from './mapScaleMath';
import { memo } from 'react';

type MapScaleProps = {
  latitude: number;
  zoom: number;
  maxWidthPx?: number;
};

export const MapScale = memo(function MapScale({ latitude, zoom, maxWidthPx }: MapScaleProps) {
  const scale = calculateMapScale(latitude, zoom, maxWidthPx);
  return (
    <div
      className="map-scale"
      aria-label={`Map scale: ${scale.label}`}
      style={{ width: `${scale.widthPx.toFixed(2)}px` }}
    >
      <span>{scale.label}</span>
    </div>
  );
});
