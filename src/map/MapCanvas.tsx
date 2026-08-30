import { useState, type CSSProperties } from 'react';
import type { CustomMarkerAsset } from '../domain/customMarkerAssets';
import type { CameraSettings, ContentLayer, MapFeatureVisibility, MapLanguage, MapStylePreset, PageSettings, ShapeGeometry } from '../domain/project';
import { createDefaultMapStyleCustomization, type MapStyleCustomization } from '../domain/mapStyleCustomization';
import type { PreviewPngExporter } from '../export/previewPng';
import type { MapBounds } from './MapLayerBounds';
import type { CameraViewportChangeMode } from './MapCameraViewport';
import type { ShapeEditMode } from './ShapeVertexEditing';
import type { RouteAuthoring } from './useTerraDrawRoutes';
import type { DraftRouteEditing } from './DraftRouteEditing';
import { mapLocationRequestDiagnostic, resolveMapLocationRequest, type MapLocationRequest } from './MapLocationRequest';
import { useMapCanvasController } from './useMapCanvasController';

type MapCanvasProps = {
  basemapVisible?: boolean;
  camera?: CameraSettings;
  stylePreset?: MapStylePreset;
  styleCustomization?: MapStyleCustomization;
  language?: MapLanguage;
  textScalePercent?: number;
  featureVisibility?: MapFeatureVisibility;
  layers: ContentLayer[];
  assets: Record<string, CustomMarkerAsset>;
  selectedId: string | null;
  previewedId: string | null;
  shapeEditMode?: ShapeEditMode;
  onLayerSelect: (id: string) => void;
  onCameraViewportChange?: (center: readonly [number, number], zoom: number, mode: CameraViewportChangeMode) => void;
  onMapClick?: (coordinate: [number, number]) => void;
  onPoiCoordinatesChange?: (id: string, coordinate: readonly [number, number]) => void;
  onRouteGeometryChange?: (id: string, coordinates: readonly (readonly [number, number])[]) => void;
  onRouteVertexChange?: (id: string, vertexIndex: number, coordinate: readonly [number, number]) => void;
  onRouteVertexInsert?: (id: string, segmentIndex: number) => void;
  routeAuthoring?: RouteAuthoring;
  routeDraftEditing?: DraftRouteEditing;
  onShapeGeometryChange?: (id: string, geometry: ShapeGeometry) => void;
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
  pageBoundaryVisible?: boolean;
  contentRevision?: object;
  interactionMode?: string;
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
const resolveBasemapVisibility = (isVisible?: boolean) => isVisible ?? true;
const resolveMapLanguage = (language?: MapLanguage) => language ?? 'local';
const resolveShapeEditMode = (mode?: ShapeEditMode): ShapeEditMode => mode ?? 'transform';
const resolveInteractionMode = (mode?: string) => mode ?? 'select';
const DEFAULT_STYLE_CUSTOMIZATION = createDefaultMapStyleCustomization();
const resolveStyleCustomization = (customization?: MapStyleCustomization) => customization ?? DEFAULT_STYLE_CUSTOMIZATION;
const printFrameClassName = (orientation: 'landscape' | 'portrait', isVisible?: boolean) => (
  `print-frame is-${orientation}${isVisible === false ? ' is-boundary-hidden' : ''}`
);

function RouteEditorError({ message }: { message: string | null }) {
  return message ? <div className="map-route-editor-error" role="alert">{message}</div> : null;
}

export function MapCanvas({
  basemapVisible,
  camera = { bearing: 0, center: [16.3725, 48.2084], locked: false, pitch: 0, zoom: 11.2 },
  stylePreset = 'paper',
  styleCustomization,
  language,
  textScalePercent = 100,
  featureVisibility,
  layers,
  assets,
  selectedId,
  previewedId,
  shapeEditMode,
  onLayerSelect,
  onCameraViewportChange,
  onMapClick,
  onPoiCoordinatesChange,
  onRouteGeometryChange,
  onRouteVertexChange,
  onRouteVertexInsert,
  routeAuthoring,
  routeDraftEditing,
  onShapeGeometryChange,
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
  pageBoundaryVisible,
  contentRevision,
  interactionMode,
}: MapCanvasProps) {
  const [routeEditorError, setRouteEditorError] = useState<string | null>(null);
  const { container, visibleError } = useMapCanvasController({
    basemapVisible: resolveBasemapVisibility(basemapVisible),
    camera,
    stylePreset,
    styleCustomization: resolveStyleCustomization(styleCustomization),
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
    onPoiCoordinatesChange,
    onRouteEditorError: setRouteEditorError,
    onRouteGeometryChange,
    onRouteVertexChange,
    onRouteVertexInsert,
    routeAuthoring,
    routeDraftEditing,
    onShapeGeometryChange,
    previewedId,
    selectedId,
    shapeEditMode: resolveShapeEditMode(shapeEditMode),
    contentRevision,
  });

  return (
    <div className="canvas-surface" aria-label="Map canvas">
      <div ref={container} className="map-root" data-testid="map-canvas" data-interaction-mode={resolveInteractionMode(interactionMode)} data-fit-request={fitRequest} data-fit-layer-id={fitLayerId} data-fit-import-request={fitImportRequest} data-map-area-locked={camera.locked} data-map-location-request={mapLocationRequestDiagnostic(locationRequest)} />
      {visibleError && (
        <div className="map-fallback" role="status">
          <div><strong>Map preview unavailable</strong><span>{visibleError.message}</span></div>
        </div>
      )}
      <RouteEditorError message={routeEditorError} />
      <div
        className={printFrameClassName(orientation, pageBoundaryVisible)}
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
