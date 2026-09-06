import { memo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
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
import type { MapError } from './MapCanvasLifecycle';

import type { GeometryEditResult, ProjectMutationResult } from '../domain/projectMutation';
import { useGeometryMutationFeedback } from './useGeometryMutationFeedback';

type MapCanvasProps = {
  cameraNoticeContainer?: HTMLDivElement | null;
  basemapVisible?: boolean;
  camera?: CameraSettings;
  getCanonicalCamera?: () => CameraSettings;
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
  onCameraViewportChange?: (
    center: readonly [number, number],
    zoom: number,
    mode: CameraViewportChangeMode,
    orientation: Pick<CameraSettings, 'bearing' | 'pitch'>,
  ) => ProjectMutationResult;
  onMapClick?: (coordinate: [number, number]) => void;
  onPoiCoordinatesChange?: (id: string, coordinate: readonly [number, number]) => ProjectMutationResult;
  onRouteGeometryChange?: (id: string, coordinates: readonly (readonly [number, number])[]) => ProjectMutationResult;
  onRouteVertexChange?: (id: string, vertexIndex: number, coordinate: readonly [number, number]) => GeometryEditResult;
  onRouteVertexInsert?: (id: string, segmentIndex: number) => ProjectMutationResult;
  routeAuthoring?: RouteAuthoring;
  routeDraftEditing?: DraftRouteEditing;
  onShapeGeometryChange?: (id: string, geometry: ShapeGeometry) => ProjectMutationResult;
  onBackgroundClick: () => void;
  onExporterChange?: (exporter: PreviewPngExporter | null) => void;
  onFitPage?: () => void;
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
const ignoreFitPage = () => {};
const resolveFitPage = (fitPage?: () => void) => fitPage ?? ignoreFitPage;
const resolveStyleCustomization = (customization?: MapStyleCustomization) => customization ?? DEFAULT_STYLE_CUSTOMIZATION;
const printFrameClassName = (orientation: 'landscape' | 'portrait', isVisible?: boolean) => (
  `print-frame is-${orientation}${isVisible === false ? ' is-boundary-hidden' : ''}`
);

const RouteEditorError = memo(function RouteEditorError({ mutationError, loadError }: { mutationError: string | null; loadError: string | null }) {
  const message = mutationError ?? loadError;
  return message ? <div className="map-route-editor-error" role="alert">{message}</div> : null;
});

function MapPreviewError({ error, onRetry }: { error: MapError; onRetry: () => void }) {
  const isResourceError = error.kind === 'resource';
  return (
    <div className={`map-fallback${isResourceError ? ' is-resource-error' : ''}`} role="status">
      <div>
        <strong>{isResourceError ? 'Map preview incomplete' : 'Map preview unavailable'}</strong>
        <span>{error.message}</span>
        <button type="button" disabled={error.retrying} onClick={onRetry}>Retry map</button>
      </div>
    </div>
  );
}

const DEFAULT_CAMERA: CameraSettings = { bearing: 0, center: [16.3725, 48.2084], locked: false, pitch: 0, zoom: 11.2 };

function CameraMutationError({ error, container }: { error: string | null; container?: HTMLDivElement | null }) {
  if (!error) return null;
  const notice = <details className="map-camera-mutation-error" role="alert" aria-label="Camera change not saved">
    <summary>Map view not saved · Previous map view restored</summary>
    <p tabIndex={0}>{error}</p>
  </details>;
  return container ? createPortal(notice, container) : notice;
}

export function MapCanvas({
  cameraNoticeContainer,
  basemapVisible,
  camera = DEFAULT_CAMERA,
  getCanonicalCamera,
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
  onFitPage,
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
  const mutationFeedback = useGeometryMutationFeedback({
    layers, onPoiCoordinatesChange, onRouteGeometryChange, onRouteVertexChange, onRouteVertexInsert, onShapeGeometryChange,
  });
  const { cameraError, container, retryMap, visibleError } = useMapCanvasController({
    basemapVisible: resolveBasemapVisibility(basemapVisible),
    camera,
    getCanonicalCamera,
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
    onFitPage: resolveFitPage(onFitPage),
    onLayerSelect,
    onCameraViewportChange,
    onMapClick,
    onRouteEditorError: setRouteEditorError,
    ...mutationFeedback.callbacks,
    routeAuthoring,
    routeDraftEditing,
    previewedId,
    selectedId,
    shapeEditMode: resolveShapeEditMode(shapeEditMode),
    contentRevision,
  });

  return (
    <>
      <div className="canvas-surface" aria-label="Map canvas">
        <div ref={container} className="map-root" data-testid="map-canvas" data-interaction-mode={resolveInteractionMode(interactionMode)} data-fit-request={fitRequest} data-fit-layer-id={fitLayerId} data-fit-import-request={fitImportRequest} data-map-area-locked={camera.locked} data-map-location-request={mapLocationRequestDiagnostic(locationRequest)} />
        <RouteEditorError mutationError={mutationFeedback.error} loadError={routeEditorError} />
        <CameraMutationError error={cameraError} container={cameraNoticeContainer} />
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
      {visibleError && <MapPreviewError error={visibleError} onRetry={retryMap} />}
    </>
  );
}
