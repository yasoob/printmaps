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
import { useMapRendererRecovery } from './useMapRendererRecovery';
import { useMapReadyInstance } from './useMapReadyInstance';
import type { CameraViewportChangeMode } from './MapCameraViewport';
import { useTerraDrawRoutes, type RouteAuthoring } from './useTerraDrawRoutes';
import { useRouteVertexEditing } from './useRouteVertexEditing';
import { useShapeTransformEditing } from './useShapeTransformEditing';
import { useShapeVertexEditing } from './useShapeVertexEditing';
import { usePointEditing } from './usePointEditing';
import type { ShapeEditMode } from './ShapeVertexEditing';
import { replaceRouteGeometry } from '../domain/routeGeometry';
import { editedRouteVertexCoordinates } from './RouteVertexCoordinates';
import type { DraftRouteEditing } from './DraftRouteEditing';
import { useDraftRouteEditing } from './useDraftRouteEditing';
import {
  useMapContentSyncResult,
} from './useMapContentSyncResult';

export { scheduleTerraRouteHandleOrder } from './useMapContentSyncResult';

const ignoreRouteGeometryChange = () => ({ ok: false as const, error: 'Route editing is not available.' });

type MapCanvasControllerOptions = {
  basemapVisible: boolean;
  camera: CameraSettings;
  getCanonicalCamera?: () => CameraSettings;
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
  onCameraViewportChange?: (
    center: readonly [number, number],
    zoom: number,
    mode: CameraViewportChangeMode,
    orientation: Pick<CameraSettings, 'bearing' | 'pitch'>,
  ) => import('../domain/projectMutation').ProjectMutationResult;
  onMapClick?: (coordinate: [number, number]) => void;
  onPoiCoordinatesChange?: (id: string, coordinate: readonly [number, number]) => import('../domain/projectMutation').ProjectMutationResult;
  onRouteEditorError?: (message: string | null) => void;
  onRouteGeometryChange?: (id: string, coordinates: readonly (readonly [number, number])[]) => import('../domain/projectMutation').ProjectMutationResult;
  onRouteVertexChange?: (id: string, vertexIndex: number, coordinate: readonly [number, number]) => import('../domain/projectMutation').GeometryEditResult;
  onRouteVertexInsert?: (id: string, segmentIndex: number) => import('../domain/projectMutation').ProjectMutationResult;
  routeAuthoring?: RouteAuthoring;
  routeDraftEditing?: DraftRouteEditing;
  onShapeGeometryChange?: (id: string, geometry: ShapeGeometry) => import('../domain/projectMutation').ProjectMutationResult;
  previewedId: string | null;
  selectedId: string | null;
  shapeEditMode: ShapeEditMode;
  contentRevision?: object;
};

type RouteEditingOptions = Pick<MapCanvasControllerOptions,
  'layers' | 'onRouteEditorError' | 'onRouteGeometryChange' | 'routeAuthoring' | 'selectedId'> & {
    ignoreNextMapClickRef: RefObject<boolean>;
    isMapAreaLocked: boolean;
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
    layer.id === preview.id ? replaceRouteGeometry(layer, preview.coordinates) ?? layer : layer
  )) : options.layers, [options.layers, preview]);
  const handlePreview = useCallback((id: string, coordinates: [number, number][] | null) => {
    setPreview(coordinates ? { id, coordinates } : null);
  }, []);
  const terraEditing = useTerraDrawRoutes({
    authoring: guardedAuthoring(options.routeAuthoring, options.ignoreNextMapClickRef),
    layers: options.layers,
    isMapAreaLocked: options.isMapAreaLocked,
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
    const coordinates = editedRouteVertexCoordinates(route, vertexIndex, coordinate);
    if (!coordinates) return { ok: false as const, error: 'This route move is invalid or no longer available.' };
    return options.onRouteGeometryChange?.(id, coordinates) ?? { ok: false as const, error: 'Route editing is no longer available.' };
  }, [options]);
  useRouteVertexEditing({
    layers: options.layers, map: options.map,
    onRouteVertexChange: options.onRouteVertexChange ?? (options.onRouteGeometryChange ? handleChange : undefined),
    onRouteVertexInsert: options.onRouteVertexInsert,
    onRouteVertexPreview: options.onRoutePreview,
    selectedId: options.selectedId, stylePreset: options.stylePreset,
  });
}

function useCameraMutationError(
  camera: CameraSettings,
  cameraState: RefObject<CameraSettings>,
  readCanonicalCamera: RefObject<(() => CameraSettings) | undefined>,
) {
  const [failure, setFailure] = useState<{ camera: CameraSettings; message: string } | null>(null);
  const reportCameraError = useCallback((message: string | null) => {
    setFailure(message === null ? null : { camera: readCanonicalCamera.current?.() ?? cameraState.current, message });
  }, [cameraState, readCanonicalCamera]);
  return { cameraError: failure?.camera === camera ? failure.message : null, reportCameraError };
}

export function useMapCanvasController({
  basemapVisible, camera, getCanonicalCamera, stylePreset, styleCustomization, language, textScalePercent, featureVisibility,
  fitRequest, fitLayerId, fitLayerRequest, fitImportBounds, fitImportRequest, locationRequest,
  layers, assets,
  onBackgroundClick, onExporterChange, onFitPage, onLayerSelect,
  onCameraViewportChange, onMapClick, onPoiCoordinatesChange,
  onRouteEditorError, onRouteGeometryChange, onRouteVertexChange, onRouteVertexInsert,
  routeAuthoring, routeDraftEditing,
  onShapeGeometryChange, previewedId, selectedId, shapeEditMode, contentRevision,
}: MapCanvasControllerOptions) {
  const container = useRef<HTMLDivElement>(null), map = useRef<MapLibreMap | null>(null), contentAdapter = useRef<MapContentAdapter | null>(null), ignoreNextMapClickRef = useRef(false);
  const cameraViewportChange = useRef(onCameraViewportChange), cameraState = useRef(camera), exporterChangeRef = useRef(onExporterChange);
  const cameraViewportChangeMode = useRef<CameraViewportChangeMode>('history');
  const readCanonicalCamera = useRef(getCanonicalCamera);
  const { cameraError, reportCameraError } = useCameraMutationError(getCanonicalCamera?.() ?? camera, cameraState, readCanonicalCamera);
  const { generation, getInitialCamera, onMapCreated, retryMap } = useMapRendererRecovery(map, cameraState, { cameraViewportChange, cameraViewportChangeMode }, { onCameraError: reportCameraError, canonicalCamera: readCanonicalCamera });
  const { map: terraMap, setMap: setTerraMap } = useMapReadyInstance(`${stylePreset}:${generation}`);
  const routeEditing = useRouteEditing({ ignoreNextMapClickRef, isMapAreaLocked: camera.locked, layers, map: terraMap, onRouteEditorError, onRouteGeometryChange, routeAuthoring, selectedId });
  const { displayLayers } = routeEditing;
  const renderedContentRevision = displayLayers === layers ? contentRevision : displayLayers;
  const contentState = useRef<MapContentState>({ layers: displayLayers, assets, selectedId, previewedId, contentRevision: renderedContentRevision }), contentSyncDeferred = useRef(false), contentReady = useRef(false), mapFailed = useRef(false);
  const layerSelect = useRef(onLayerSelect), backgroundClick = useRef(onBackgroundClick);
  const mapClick = useRef(routeAuthoring?.active && routeEditing.isAuthoringReady ? undefined : onMapClick);
  const fitPage = useRef(onFitPage);
  const availableExporterRef = useRef<PreviewPngExporter | null>(null);
  const [mapError, setMapError] = useState<MapError | null>(null), [contentError, setContentError] = useState<ContentError | null>(null);
  const boundMap = useMemo(() => ({ current: terraMap }), [terraMap]);

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
    readCanonicalCamera.current = getCanonicalCamera;
    backgroundClick.current = onBackgroundClick;
    cameraViewportChange.current = onCameraViewportChange;
    fitPage.current = onFitPage;
    layerSelect.current = onLayerSelect;
    mapClick.current = routeAuthoring?.active && routeEditing.isAuthoringReady ? undefined : onMapClick;
  }, [camera, getCanonicalCamera, onBackgroundClick, onCameraViewportChange, onFitPage, onLayerSelect, onMapClick, routeAuthoring?.active, routeEditing.isAuthoringReady]);

  useExporterSubscription(onExporterChange, availableExporterRef, exporterChangeRef);

  useEffect(() => {
    contentState.current = { layers: displayLayers, assets, selectedId, previewedId, contentRevision: renderedContentRevision };
    handleContentSyncResult(contentAdapter.current?.sync(contentState.current));
  }, [assets, renderedContentRevision, displayLayers, handleContentSyncResult, previewedId, selectedId]);

  usePointEditing({ layers, map: boundMap, onPoiCoordinatesChange, selectedId, stylePreset }); useShapeEditing({ layers, map: boundMap, onShapeGeometryChange, selectedId, shapeEditMode, stylePreset }); useAccessibleRouteVertexEditing({ layers, map: boundMap, onRouteGeometryChange, onRouteVertexChange, onRouteVertexInsert, onRoutePreview: routeEditing.updateEditingGeometry, selectedId, stylePreset }); useDraftRouteEditing(terraMap, routeDraftEditing);
  useMapCameraSynchronization({ camera, container, map, instance: terraMap, stylePreset }); useMapLocationRequest({ container, locationRequest, map: boundMap, stylePreset });
  useMapFitRequests({ camera, cameraViewportChangeMode, container, fitImportBounds, fitImportRequest, fitLayerId, fitLayerRequest, fitRequest, layers, map: boundMap });

  // A changed lifetime detaches editing above before this effect removes the
  // native renderer. Controllers must never clean up against a removed map.
  useEffect(() => {
    contentReady.current = false;
    contentSyncDeferred.current = false;
    clearMapStateAttributes(container.current);
    resetFeatureVisibility(); resetMapLanguage(); resetStyleCustomization(); resetTextScale();
    invalidateExporter();
    queueMicrotask(() => {
      setTerraMap(null);
      setMapError(generation > 0 ? { kind: 'renderer', retrying: true, message: 'Restarting the map preview. Your work is preserved…' } : null);
      setContentError(null);
    });
    container.current?.setAttribute('data-style-preset', stylePreset);
    return startMapLifecycle({
      handleContentSyncResult,
      initialCamera: getInitialCamera(),
      getCanonicalCamera: () => readCanonicalCamera.current?.() ?? cameraState.current,
      onCameraError: reportCameraError,
      onMapCreated,
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
  }, [generation, getInitialCamera, onMapCreated, handleContentSyncResult, invalidateExporter, reportCameraError, resetFeatureVisibility, resetMapLanguage, resetStyleCustomization, resetTextScale, resolveExportStyle, setBasemapExportVisibility, setTerraMap, stylePreset, synchronizeFeatureVisibility, synchronizeMapLanguage, synchronizeStyleCustomization, synchronizeTextScale]);

  return { cameraError, container, retryMap, visibleError: mapError ?? contentError };
}
