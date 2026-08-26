import { calculateMapScale } from './mapScaleMath';

type MapScaleProps = {
  latitude: number;
  zoom: number;
};

export function MapScale({ latitude, zoom }: MapScaleProps) {
  const scale = calculateMapScale(latitude, zoom);
  return (
    <div
      className="map-scale"
      aria-label={`Map scale: ${scale.label}`}
      style={{ width: `${scale.widthPx.toFixed(2)}px` }}
    >
      <span>{scale.label}</span>
    </div>
  );
}
