import type { CSSProperties } from 'react';
import type { CustomMarkerAsset } from '../domain/customMarkerAssets';
import type { CameraSettings, ContentLayer, MapFeatureVisibility, MapLanguage, MapStylePreset, PageSettings } from '../domain/project';
import type { PreviewPngExporter } from '../export/previewPng';
import type { MapBounds } from './MapLayerBounds';
import type { CameraViewportChangeMode } from './MapCameraViewport';
import { mapLocationRequestDiagnostic, resolveMapLocationRequest, type MapLocationRequest } from './MapLocationRequest';
import { useMapCanvasController } from './useMapCanvasController';

type MapCanvasProps = {
  camera?: CameraSettings;
  stylePreset?: MapStylePreset;
  language?: MapLanguage;
  textScalePercent?: number;
  featureVisibility?: MapFeatureVisibility;
  layers: ContentLayer[];
  assets: Record<string, CustomMarkerAsset>;
  selectedId: string | null;
  previewedId: string | null;
  onLayerSelect: (id: string) => void;
  onCameraViewportChange?: (center: readonly [number, number], zoom: number, mode: CameraViewportChangeMode) => void;
  onMapClick?: (coordinate: [number, number]) => void;
  onRouteVertexChange?: (id: string, vertexIndex: number, coordinate: readonly [number, number]) => void;
  onBackgroundClick: () => void;
  onExporterChange?: (exporter: PreviewPngExporter | null) => void;
  fitRequest?: number;
  fitLayerId?: string | null;
  fitLayerRequest?: number;
  fitImportBounds?: MapBounds;
  fitImportRequest?: number;
  locationRequest?: MapLocationRequest;
  orientation?: 'landscape' | 'portrait';
  page?: PageSettings;
  contentRevision?: object;
};

const DEFAULT_FEATURE_VISIBILITY: MapFeatureVisibility = {
  roads: true,
  buildings: true,
  labels: true,
  water: true,
  parks: true,
  landuse: true,
  transit: true,
};
const resolveFeatureVisibility = (visibility?: MapFeatureVisibility) => visibility ?? DEFAULT_FEATURE_VISIBILITY;
const resolveMapLanguage = (language?: MapLanguage) => language ?? 'local';

export function MapCanvas({
  camera = { bearing: 0, center: [16.3725, 48.2084], locked: false, pitch: 0, zoom: 11.2 },
  stylePreset = 'liberty',
  language,
  textScalePercent = 100,
  featureVisibility,
  layers,
  assets,
  selectedId,
  previewedId,
  onLayerSelect,
  onCameraViewportChange,
  onMapClick,
  onRouteVertexChange,
  onBackgroundClick,
  onExporterChange,
  fitRequest = 0,
  fitLayerId,
  fitLayerRequest,
  fitImportBounds,
  fitImportRequest,
  locationRequest,
  orientation = 'landscape',
  page,
  contentRevision,
}: MapCanvasProps) {
  const { container, visibleError } = useMapCanvasController({
    camera,
    stylePreset,
    language: resolveMapLanguage(language),
    textScalePercent,
    featureVisibility: resolveFeatureVisibility(featureVisibility),
    fitRequest,
    fitLayerId,
    fitLayerRequest,
    fitImportBounds,
    fitImportRequest,
    locationRequest: resolveMapLocationRequest(locationRequest),
    layers,
    assets,
    onBackgroundClick,
    onExporterChange,
    onLayerSelect,
    onCameraViewportChange,
    onMapClick,
    onRouteVertexChange,
    previewedId,
    selectedId,
    contentRevision,
  });

  return (
    <div className="canvas-surface" aria-label="Map canvas">
      <div ref={container} className="map-root" data-testid="map-canvas" data-fit-request={fitRequest} data-fit-layer-id={fitLayerId} data-fit-import-request={fitImportRequest} data-map-area-locked={camera.locked} data-map-location-request={mapLocationRequestDiagnostic(locationRequest)} />
      {visibleError && (
        <div className="map-fallback" role="status">
          <div><strong>Map preview unavailable</strong><span>{visibleError.message}</span></div>
        </div>
      )}
      <div
        className={`print-frame is-${orientation}`}
        style={{
          aspectRatio: page ? `${page.widthMm} / ${page.heightMm}` : undefined,
          '--studio-page-ratio': page ? page.widthMm / page.heightMm : 297 / 210,
        } as CSSProperties}
        aria-hidden="true"
      >
        <span className="page-label">{page?.preset ?? 'A4'} · {orientation === 'landscape' ? 'Landscape' : 'Portrait'}</span>
      </div>
    </div>
  );
}
