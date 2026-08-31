import { useEffect } from 'react';
import type { CameraSettings, ContentLayer, MapFeatureVisibility, MapLanguage, MapStylePreset } from '../../../src/domain/project';
import type { MapStyleCustomization } from '../../../src/domain/mapStyleCustomization';
import type { MapBounds } from '../../../src/map/MapLayerBounds';
import type { ShapeEditMode } from '../../../src/map/ShapeVertexEditing';
import { mapLocationRequestDiagnostic, type MapLocationRequest } from '../../../src/map/MapLocationRequest';
import { exportMocks } from './exportMocks';
import type { RouteAuthoring } from '../../../src/map/useTerraDrawRoutes';
import type { DraftRouteEditing } from '../../../src/map/DraftRouteEditing';
import type { CameraViewportChangeMode } from '../../../src/map/MapCameraViewport';

type MapCanvasMockProps = {
  basemapVisible?: boolean;
  camera?: CameraSettings;
  stylePreset?: MapStylePreset;
  styleCustomization?: MapStyleCustomization;
  language?: MapLanguage;
  textScalePercent?: number;
  featureVisibility?: MapFeatureVisibility;
  layers?: ContentLayer[];
  selectedId?: string | null;
  previewedId?: string | null;
  shapeEditMode?: ShapeEditMode;
  onLayerSelect?: (id: string) => void;
  onCameraViewportChange?: (center: readonly [number, number], zoom: number, mode: CameraViewportChangeMode) => void;
  onMapClick?: (coordinate: [number, number]) => void;
  routeAuthoring?: RouteAuthoring;
  routeDraftEditing?: DraftRouteEditing;
  onBackgroundClick: () => void;
  onExporterChange?: (exporter: typeof exportMocks.exporter) => void;
  onFitPage?: () => void;
  fitRequest?: number;
  fitLayerId?: string | null;
  fitImportBounds?: MapBounds;
  fitImportRequest?: number;
  locationRequest?: MapLocationRequest;
  orientation?: 'landscape' | 'portrait';
  page?: { preset?: string; widthMm: number; heightMm: number };
  pageBoundaryVisible?: boolean;
  interactionMode?: string;
};

const shapeEditModeDiagnostic = (mode?: ShapeEditMode) => mode ?? '';
const interactionModeDiagnostic = (mode?: string) => mode ?? 'select';
const basemapVisibilityDiagnostic = (isVisible?: boolean) => isVisible ?? true;
const resolvedPageBoundaryVisibility = (isVisible?: boolean) => isVisible ?? true;
const DEFAULT_STYLE_CUSTOMIZATION: MapStyleCustomization = { tone: 'balanced', contrast: 50, detail: 50, colors: {} };
const resolveStyleCustomization = (customization?: MapStyleCustomization) => customization ?? DEFAULT_STYLE_CUSTOMIZATION;
const isStyleCustomized = (customization: MapStyleCustomization) => (
  Object.keys(customization.colors).length > 0
  || customization.tone !== 'balanced'
  || customization.contrast !== 50
  || customization.detail !== 50
);

export function MapCanvas({
  basemapVisible,
  camera = { bearing: 0, center: [16.3725, 48.2084], locked: false, pitch: 0, zoom: 11.2 },
  stylePreset = 'paper',
  styleCustomization,
  language = 'local',
  textScalePercent = 100,
  featureVisibility = { roads: true, buildings: true, labels: true, water: true, parks: true, landuse: true, transit: true },
  layers = [],
  selectedId,
  previewedId,
  shapeEditMode,
  onLayerSelect,
  onCameraViewportChange,
  onMapClick,
  routeAuthoring,
  routeDraftEditing,
  onBackgroundClick,
  onExporterChange,
  onFitPage,
  fitRequest,
  fitLayerId,
  fitImportRequest,
  locationRequest,
  orientation,
  page,
  pageBoundaryVisible,
  interactionMode,
}: MapCanvasMockProps) {
  useEffect(() => {
    onExporterChange?.(exportMocks.exporter);
    return () => onExporterChange?.(null);
  }, [onExporterChange]);
  useEffect(() => {
    if (locationRequest?.coordinate) locationRequest.onApplied?.();
  }, [locationRequest]);

  return (
    <div
      data-testid="map-canvas"
      data-interaction-mode={interactionModeDiagnostic(interactionMode)}
      data-fit-request={fitRequest}
      data-fit-layer-id={fitLayerId ?? ''}
      data-camera-fit-import={fitImportRequest}
      data-camera={`${camera.center.join(',')},${camera.zoom},${camera.bearing},${camera.pitch}`}
      data-map-area-locked={camera.locked}
      data-map-location-request={mapLocationRequestDiagnostic(locationRequest)}
      data-style-preset={stylePreset}
      data-style-customized={isStyleCustomized(resolveStyleCustomization(styleCustomization))}
      data-map-language={language}
      data-text-scale={textScalePercent}
      data-map-feature-visibility={`roads:${featureVisibility.roads},buildings:${featureVisibility.buildings},labels:${featureVisibility.labels},water:${featureVisibility.water},parks:${featureVisibility.parks},landuse:${featureVisibility.landuse},transit:${featureVisibility.transit}`}
      data-map-basemap-visible={basemapVisibilityDiagnostic(basemapVisible)}
      data-orientation={orientation}
      data-page-preset={page?.preset}
      data-page-size={page ? `${page.widthMm}x${page.heightMm}` : ''}
      data-page-boundary-visible={resolvedPageBoundaryVisibility(pageBoundaryVisible)}
      data-layer-state={layers.map(({ appearance, id, visible }) => `${id}:${visible}${appearance?.kind === 'poi' && appearance.customAssetId ? `:custom:${appearance.customAssetId}` : ''}`).join(',')}
      data-layer-geometry={layers.map(({ geometry, id }) => {
        if (!geometry) return `${id}:none`;
        const positions = geometry.type === 'Arc' ? geometry.anchors : geometry.coordinates;
        return `${id}:${JSON.stringify(positions)}`;
      }).join('|')}
      data-selected-layer={selectedId ?? ''}
      data-shape-edit-mode={shapeEditModeDiagnostic(shapeEditMode)}
      data-previewed-layer={previewedId ?? ''}
    >
      <button type="button" disabled={camera.locked} onClick={onFitPage}>Fit page</button>
      <button type="button" onClick={onBackgroundClick}>Map background</button>
      <button type="button" onClick={() => onCameraViewportChange?.([16.41, 48.23], 13.5, 'history')}>Finish map movement</button>
      <button type="button" onClick={() => onLayerSelect?.('poi-cafe')}>Map Coffee stop</button>
      <button type="button" onClick={() => routeAuthoring?.active
        ? routeAuthoring.onPreview([[16.31, 48.19]])
        : onMapClick?.([16.31, 48.19])}>Map route point 1</button>
      <button type="button" onClick={() => {
        const coordinates: [number, number][] = [[16.31, 48.19], [16.4, 48.24]];
        if (routeAuthoring?.active) routeAuthoring.onPreview(coordinates);
        else onMapClick?.([16.4, 48.24]);
      }}>Map route point 2</button>
      <button type="button" onClick={() => onMapClick?.([16.46, 48.2])}>Map route point 3</button>
      <button type="button" onClick={() => onMapClick?.([16.3261, 48.1941])}>Map nearby route anchor</button>
      <button type="button" onClick={() => onMapClick?.([16.37, 48.21])}>Map POI point</button>
      <button type="button" onClick={() => onMapClick?.([16.36, 48.25])}>Map shape point 3</button>
      <button type="button" onClick={() => {
        routeDraftEditing?.onMoveBegin();
        routeDraftEditing?.onMovePreview(0, [16.32, 48.2]);
      }}>Preview drag route point 1</button>
    </div>
  );
}
