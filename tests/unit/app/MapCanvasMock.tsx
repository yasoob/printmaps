import { useEffect } from 'react';
import type { CameraSettings, ContentLayer, MapFeatureVisibility, MapStylePreset } from '../../../src/domain/project';
import { exportMocks } from './exportMocks';

type MapCanvasMockProps = {
  camera?: CameraSettings;
  stylePreset?: MapStylePreset;
  textScalePercent?: number;
  featureVisibility?: MapFeatureVisibility;
  layers?: ContentLayer[];
  selectedId?: string | null;
  previewedId?: string | null;
  onLayerSelect?: (id: string) => void;
  onMapClick?: (coordinate: [number, number]) => void;
  onBackgroundClick: () => void;
  onExporterChange?: (exporter: typeof exportMocks.exporter) => void;
  fitRequest?: number;
  orientation?: 'landscape' | 'portrait';
  page?: { preset?: string; widthMm: number; heightMm: number };
};

export function MapCanvas({
  camera = { bearing: 0, pitch: 0 },
  stylePreset = 'liberty',
  textScalePercent = 100,
  featureVisibility = { roads: true, buildings: true, labels: true },
  layers = [],
  selectedId,
  previewedId,
  onLayerSelect,
  onMapClick,
  onBackgroundClick,
  onExporterChange,
  fitRequest,
  orientation,
  page,
}: MapCanvasMockProps) {
  useEffect(() => {
    onExporterChange?.(exportMocks.exporter);
    return () => onExporterChange?.(null);
  }, [onExporterChange]);

  return (
    <div
      data-testid="map-canvas"
      data-fit-request={fitRequest}
      data-camera={`${camera.bearing},${camera.pitch}`}
      data-style-preset={stylePreset}
      data-text-scale={textScalePercent}
      data-map-feature-visibility={`roads:${featureVisibility.roads},buildings:${featureVisibility.buildings},labels:${featureVisibility.labels}`}
      data-orientation={orientation}
      data-page-preset={page?.preset}
      data-page-size={page ? `${page.widthMm}x${page.heightMm}` : ''}
      data-layer-state={layers.map(({ appearance, id, visible }) => `${id}:${visible}${appearance?.kind === 'poi' && appearance.customAssetId ? `:custom:${appearance.customAssetId}` : ''}`).join(',')}
      data-layer-geometry={layers.map(({ geometry, id }) => (
        geometry ? `${id}:${JSON.stringify(geometry.coordinates)}` : `${id}:none`
      )).join('|')}
      data-selected-layer={selectedId ?? ''}
      data-previewed-layer={previewedId ?? ''}
    >
      <button type="button" onClick={onBackgroundClick}>Map background</button>
      <button type="button" onClick={() => onLayerSelect?.('poi-cafe')}>Map Coffee stop</button>
      <button type="button" onClick={() => onMapClick?.([16.31, 48.19])}>Map route point 1</button>
      <button type="button" onClick={() => onMapClick?.([16.4, 48.24])}>Map route point 2</button>
      <button type="button" onClick={() => onMapClick?.([16.37, 48.21])}>Map POI point</button>
      <button type="button" onClick={() => onMapClick?.([16.36, 48.25])}>Map shape point 3</button>
    </div>
  );
}
