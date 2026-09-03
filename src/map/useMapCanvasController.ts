import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { CustomMarkerAsset } from '../domain/customMarkerAssets';
import type { CameraSettings, ContentLayer, MapFeatureVisibility, MapLanguage, MapStylePreset, ShapeGeometry } from '../domain/project';
import type { MapStyleCustomization } from '../domain/mapStyleCustomization';
import type { PreviewPngExporter } from '../export/previewPng';
import type { MapContentAdapter, MapContentState } from './MapContentAdapter';
import {
  startMapLifecycle,
  type ContentError,
  type MapError,
} from './MapCanvasLifecycle';
import { mapStyleUrl } from './mapStyles';
import { useMapFeatureVisibility } from './useMapFeatureVisibility';
import { useMapLanguage } from './useMapLanguage';
import { useMapTextScale } from './useMapTextScale';
import { useMapStyleCustomization } from './useMapStyleCustomization';
import { useMapFitRequests } from './useMapFitRequests';
import type { MapBounds } from './MapLayerBounds';

import type { MapLocationRequest } from './MapLocationRequest';
import { useMapLocationRequest } from './useMapLocationRequest';
import { useMapCameraSynchronization } from './useMapCameraSynchronization';
import type { CameraViewportChangeMode } from './MapCameraViewport';
import { useTerraDrawRoutes, type RouteAuthoring } from './useTerraDrawRoutes';
import { useRouteVertexEditing } from './useRouteVertexEditing';
import { useShapeTransformEditing } from './useShapeTransformEditing';
import { useShapeVertexEditing } from './useShapeVertexEditing';
import { usePointEditing } from './usePointEditing';
import type { ShapeEditMode } from './ShapeVertexEditing';
import { createArcGeometry } from '../domain/routeArcGeometry';
import type { DraftRouteEditing } from './DraftRouteEditing';
import { useDraftRouteEditing } from './useDraftRouteEditing';
import {
  useMapContentSyncResult,
} from './useMapContentSyncResult';

export { scheduleTerraRouteHandleOrder } from './useMapContentSyncResult';

const ignoreRouteGeometryChange = () => {};

type MapCanvasControllerOptions = {
  basemapVisible: boolean;
  camera: CameraSettings;
  stylePreset: MapStylePreset;
  styleCustomization: MapStyleCustomization;
  language: MapLanguage;
  textScalePercent: number;
  featureVisibility: MapFeatureVisibility;
  fitRequest: number;
  fitLayerId?: string | null;
  fitLayerRequest?: number;
  fitImportBounds?: MapBounds;
  fitImportRequest?: number;
  locationRequest: MapLocationRequest;
  layers: ContentLayer[];
  assets: Record<string, CustomMarkerAsset>;
  onBackgroundClick: () => void;
  onExporterChange?: (exporter: PreviewPngExporter | null) => void;
  onFitPage: () => void;
  onLayerSelect: (id: string) => void;
  onCameraViewportChange?: (center: readonly [number, number], zoom: number, mode: CameraViewportChangeMode) => void;
  onMapClick?: (coordinate: [number, number]) => void;
  onPoiCoordinatesChange?: (id: string, coordinate: readonly [number, number]) => void;
  onRouteEditorError?: (message: string | null) => void;
  onRouteGeometryChange?: (id: string, coordinates: readonly (readonly [number, number])[]) => void;
  onRouteVertexChange?: (id: string, vertexIndex: number, coordinate: readonly [number, number]) => void;
  onRouteVertexInsert?: (id: string, segmentIndex: number) => void;
  routeAuthoring?: RouteAuthoring;
  routeDraftEditing?: DraftRouteEditing;
  onShapeGeometryChange?: (id: string, geometry: ShapeGeometry) => void;
  previewedId: string | null;
  selectedId: string | null;
  shapeEditMode: ShapeEditMode;
  contentRevision?: object;
};

function routePreviewGeometry(layer: ContentLayer, coordinates: [number, number][]) {
  if (layer.geometry?.type === 'Arc') {
    return createArcGeometry(coordinates, layer.geometry.curvatures) ?? layer.geometry;
  }
  return { type: 'LineString' as const, coordinates };
}

type RouteEditingOptions = Pick<MapCanvasControllerOptions,
  'layers' | 'onRouteEditorError' | 'onRouteGeometryChange' | 'routeAuthoring' | 'selectedId'> & {
    ignoreNextMapClickRef: RefObject<boolean>;
    map: MapLibreMap | null;
  };

function guardedAuthoring(
  authoring: RouteAuthoring | undefined,
  ignoreNextMapClickRef: RefObject<boolean>,
) {
  if (!authoring) return;
  return {
    ...authoring,
    onFinish: (coordinates: [number, number][]) => {
      ignoreNextMapClickRef.current = true;
      authoring.onFinish(coordinates);
    },
  };
}

function useRouteEditing(options: RouteEditingOptions) {
  const [preview, setPreview] = useState<{ id: string; coordinates: [number, number][] } | null>(null);
  const displayLayers = useMemo(() => preview ? options.layers.map((layer) => (
    layer.id === preview.id ? { ...layer, geometry: routePreviewGeometry(layer, preview.coordinates) } : layer
  )) : options.layers, [options.layers, preview]);
  const handlePreview = useCallback((id: string, coordinates: [number, number][] | null) => {
    setPreview(coordinates ? { id, coordinates } : null);
  }, []);
  const terraEditing = useTerraDrawRoutes({
    authoring: guardedAuthoring(options.routeAuthoring, options.ignoreNextMapClickRef),
    layers: options.layers,
    map: options.map,
    onEditorError: options.onRouteEditorError,
    onRouteGeometryChange: options.onRouteGeometryChange ?? ignoreRouteGeometryChange,
    onRoutePreview: handlePreview,
    selectedId: options.onRouteGeometryChange ? options.selectedId : null,
  });
  return {
    displayLayers,
    isAuthoringReady: terraEditing.isAuthoringReady,
    updateEditingGeometry: terraEditing.updateEditingGeometry,
  };
}

function useExporterSubscription(
  onExporterChange: MapCanvasControllerOptions['onExporterChange'],
  availableExporterRef: RefObject<PreviewPngExporter | null>,
  exporterChangeRef: RefObject<MapCanvasControllerOptions['onExporterChange']>,
) {
  useEffect(() => {
    exporterChangeRef.current = onExporterChange;
    onExporterChange?.(availableExporterRef.current);
    return () => onExporterChange?.(null);
  }, [availableExporterRef, exporterChangeRef, onExporterChange]);
}

function clearMapStateAttributes(container: HTMLDivElement | null) {
  container?.removeAttribute('data-map-ready');
  container?.removeAttribute('data-map-bearing');
  container?.removeAttribute('data-map-pitch');
}

function useShapeEditing({ layers, map, onShapeGeometryChange, selectedId, shapeEditMode, stylePreset }: Pick<MapCanvasControllerOptions, 'layers' | 'onShapeGeometryChange' | 'selectedId' | 'shapeEditMode' | 'stylePreset'> & { map: RefObject<MapLibreMap | null> }) {
  useShapeVertexEditing({ active: shapeEditMode === 'points', layers, map, onShapeGeometryChange, selectedId, stylePreset });
  useShapeTransformEditing({ active: shapeEditMode === 'transform', layers, map, onShapeGeometryChange, selectedId, stylePreset });
}

function useAccessibleRouteVertexEditing(options: Pick<MapCanvasControllerOptions,
  'layers' | 'onRouteGeometryChange' | 'onRouteVertexChange' | 'onRouteVertexInsert' | 'selectedId' | 'stylePreset'> & {
    map: RefObject<MapLibreMap | null>;
    onRoutePreview?: (coordinates: [number, number][]) => boolean;
  }) {
  const handleChange = useCallback((id: string, vertexIndex: number, coordinate: readonly [number, number]) => {
    const route = options.layers.find((layer) => layer.id === id);
    if (route?.geometry?.type !== 'LineString' && route?.geometry?.type !== 'Arc') return;
    const positions = route.geometry.type === 'Arc' ? route.geometry.anchors : route.geometry.coordinates;
    const coordinates = positions.map((candidate, index) => (
      index === vertexIndex ? [coordinate[0], coordinate[1]] as [number, number] : candidate
    ));
    options.onRouteGeometryChange?.(id, coordinates);
  }, [options]);
  useRouteVertexEditing({
    layers: options.layers, map: options.map,
    onRouteVertexChange: options.onRouteVertexChange ?? (options.onRouteGeometryChange ? handleChange : undefined),
    onRouteVertexInsert: options.onRouteVertexInsert,
    onRouteVertexPreview: options.onRoutePreview,
    selectedId: options.selectedId, stylePreset: options.stylePreset,
  });
}

export function useMapCanvasController({
  basemapVisible, camera, stylePreset, styleCustomization, language, textScalePercent, featureVisibility,
  fitRequest, fitLayerId, fitLayerRequest, fitImportBounds, fitImportRequest, locationRequest,
  layers, assets,
  onBackgroundClick, onExporterChange, onFitPage, onLayerSelect,
  onCameraViewportChange, onMapClick, onPoiCoordinatesChange,
  onRouteEditorError, onRouteGeometryChange, onRouteVertexChange, onRouteVertexInsert,
  routeAuthoring, routeDraftEditing,
  onShapeGeometryChange, previewedId, selectedId, shapeEditMode, contentRevision,
}: MapCanvasControllerOptions) {
  const container = useRef<HTMLDivElement>(null), map = useRef<MapLibreMap | null>(null), contentAdapter = useRef<MapContentAdapter | null>(null), ignoreNextMapClickRef = useRef(false);
  const [terraMap, setTerraMap] = useState<MapLibreMap | null>(null), routeEditing = useRouteEditing({ ignoreNextMapClickRef, layers, map: terraMap, onRouteEditorError, onRouteGeometryChange, routeAuthoring, selectedId });
  const { displayLayers } = routeEditing;
  const contentState = useRef<MapContentState>({ layers: displayLayers, assets, selectedId, previewedId, contentRevision }), contentSyncDeferred = useRef(false), contentReady = useRef(false), mapFailed = useRef(false);
  const layerSelect = useRef(onLayerSelect), backgroundClick = useRef(onBackgroundClick);
  const mapClick = useRef(routeAuthoring?.active && routeEditing.isAuthoringReady ? undefined : onMapClick);
  const cameraViewportChange = useRef(onCameraViewportChange), cameraState = useRef(camera), exporterChangeRef = useRef(onExporterChange);
  const fitPage = useRef(onFitPage);
  const cameraViewportChangeMode = useRef<CameraViewportChangeMode>('history'), availableExporterRef = useRef<PreviewPngExporter | null>(null);
  const [mapError, setMapError] = useState<MapError | null>(null), [contentError, setContentError] = useState<ContentError | null>(null);

  const invalidateExporter = useCallback(() => {
    if (!availableExporterRef.current) return;
    availableExporterRef.current = null;
    exporterChangeRef.current?.(null);
  }, []);
  const { resetStyleCustomization, synchronizeStyleCustomization } = useMapStyleCustomization({
    containerRef: container,
    contentReadyRef: contentReady,
    customization: styleCustomization,
    invalidateExporter,
    mapFailedRef: mapFailed,
    mapRef: map,
    preset: stylePreset,
    setMapError,
  });
  const { resetTextScale, synchronizeTextScale } = useMapTextScale({ containerRef: container, contentReadyRef: contentReady, invalidateExporter, mapFailedRef: mapFailed, mapRef: map, setMapError, textScalePercent });
  const mapVisibility = useMapFeatureVisibility({ basemapVisible, containerRef: container, contentReadyRef: contentReady, featureVisibility, invalidateExporter, mapFailedRef: mapFailed, mapRef: map, setMapError }), { resetFeatureVisibility, resolveExportStyle, setBasemapExportVisibility, synchronizeFeatureVisibility } = mapVisibility;
  const { resetMapLanguage, synchronizeMapLanguage } = useMapLanguage({ containerRef: container, contentReadyRef: contentReady, invalidateExporter, language, mapFailedRef: mapFailed, mapRef: map, setMapError });

  const handleContentSyncResult = useMapContentSyncResult({
    contentReadyRef: contentReady,
    contentSyncDeferredRef: contentSyncDeferred,
    containerRef: container,
    invalidateExporter,
    mapRef: map,
    setContentError,
    setTerraMap,
  });

  useLayoutEffect(() => {
    cameraState.current = camera;
    backgroundClick.current = onBackgroundClick;
    cameraViewportChange.current = onCameraViewportChange;
    fitPage.current = onFitPage;
    layerSelect.current = onLayerSelect;
    mapClick.current = routeAuthoring?.active && routeEditing.isAuthoringReady ? undefined : onMapClick;
  }, [camera, onBackgroundClick, onCameraViewportChange, onFitPage, onLayerSelect, onMapClick, routeAuthoring?.active, routeEditing.isAuthoringReady]);

  useExporterSubscription(onExporterChange, availableExporterRef, exporterChangeRef);

  useEffect(() => {
    contentState.current = { layers: displayLayers, assets, selectedId, previewedId, contentRevision };
    handleContentSyncResult(contentAdapter.current?.sync(contentState.current));
  }, [assets, contentRevision, displayLayers, handleContentSyncResult, previewedId, selectedId]);

  useEffect(() => {
    contentReady.current = false;
    contentSyncDeferred.current = false;
    clearMapStateAttributes(container.current);
    resetFeatureVisibility(); resetMapLanguage(); resetStyleCustomization(); resetTextScale();
    invalidateExporter();
    queueMicrotask(() => {
      setTerraMap(null);
      setMapError(null);
      setContentError(null);
    });
    container.current?.setAttribute('data-style-preset', stylePreset);
    return startMapLifecycle({
      handleContentSyncResult,
      initialCamera: cameraState.current,
      references: {
        availableExporter: availableExporterRef,
        backgroundClick,
        cameraViewportChange,
        cameraViewportChangeMode,
        container,
        contentAdapter,
        contentReady,
        contentState,
        contentSyncDeferred,
        exporterChange: exporterChangeRef,
        fitPage,
        ignoreNextMapClick: ignoreNextMapClickRef,
        layerSelect,
        mapClick,
        map, mapFailed, resolveExportStyle, setBasemapExportVisibility,
        synchronizeFeatureVisibility: { current: synchronizeFeatureVisibility },
        synchronizeMapLanguage: { current: synchronizeMapLanguage },
        synchronizeStyleCustomization: { current: synchronizeStyleCustomization },
        synchronizeTextScale: { current: synchronizeTextScale },
      },
      setContentError,
      setMapError,
      styleUrl: mapStyleUrl(stylePreset),
    });
  }, [cameraState, handleContentSyncResult, invalidateExporter, resetFeatureVisibility, resetMapLanguage, resetStyleCustomization, resetTextScale, resolveExportStyle, setBasemapExportVisibility, stylePreset, synchronizeFeatureVisibility, synchronizeMapLanguage, synchronizeStyleCustomization, synchronizeTextScale]);

  usePointEditing({ layers, map, onPoiCoordinatesChange, selectedId, stylePreset }); useShapeEditing({ layers, map, onShapeGeometryChange, selectedId, shapeEditMode, stylePreset }); useAccessibleRouteVertexEditing({ layers, map, onRouteGeometryChange, onRouteVertexChange, onRouteVertexInsert, onRoutePreview: routeEditing.updateEditingGeometry, selectedId, stylePreset }); useDraftRouteEditing(terraMap, routeDraftEditing);

  useMapCameraSynchronization({ camera, container, map, stylePreset }); useMapLocationRequest({ container, locationRequest, map, stylePreset });
  useMapFitRequests({ camera, cameraViewportChangeMode, container, fitImportBounds, fitImportRequest, fitLayerId, fitLayerRequest, fitRequest, layers, map });

  return { container, visibleError: mapError ?? contentError };
}
