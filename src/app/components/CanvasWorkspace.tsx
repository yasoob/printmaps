import { useEffect, useMemo, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { AdministrativeAreaId } from '../../domain/administrativeAreas';
import type { PoiSpreadsheetEntry } from '../../domain/poiSpreadsheet';
import type { CustomMarkerAsset } from '../../domain/customMarkerAssets';
import type { CameraSettings, ContentLayer, IsochroneAreaInput, MapFeatureVisibility, MapLanguage, MapStylePreset, PageSettings, ShapeGeometry } from '../../domain/project';
import {
  DEFAULT_ROUTE_AUTHORING_OPTIONS,
  type RouteLineShape,
  type RouteTravelProfile,
  type RouteAuthoringOptions,
} from '../../domain/routeProfiles';
import type { PreviewPngExporter } from '../../export/previewPng';
import { MapCanvas } from '../../map/MapCanvas';
import { canDirectlyEditShapePoints, type ShapeEditMode } from '../../map/ShapeVertexEditing';
import { LocationSearch } from './LocationSearch';
import type { MapBounds } from '../../map/MapLayerBounds';
import type { MapLocationRequest } from '../../map/MapLocationRequest';
import type { CameraViewportChangeMode } from '../../map/MapCameraViewport';
import type { MobilePanel } from '../hooks/useMobilePanels';
import { useIsochroneAuthoring } from '../hooks/useIsochroneAuthoring';
import { useDirectionsAuthoring } from '../hooks/useDirectionsAuthoring';
import type { DirectionsProvider, SearchProvider } from '../../services/mapbox/contracts';
import { usePoiAuthoring } from '../hooks/usePoiAuthoring';
import type { ShapeAuthoringMode } from './ShapeDrawingPanel';
import { IsochronePanel } from './IsochronePanel';
import { CanvasWorkspaceChrome } from './CanvasWorkspaceChrome';
import { appendRoadSearchWaypoint, canFinishRoute, finishRouteCoordinates, MAX_ROAD_ROUTE_WAYPOINTS, type CreateDirectionsRoute } from './routeAuthoringActions';
import { countDistinctPoints, createIsochroneCenterLayer, createRouteDraftLayers, createShapeDraftLayers } from './authoringDraftLayers';

const TOOL_SHORTCUTS: Record<string, string> = { v: 'select', h: 'pan', r: 'route', p: 'pin', s: 'shape' };
const EMPTY_ROUTE_POINTS: [number, number][] = [];
const EMPTY_SHAPE_POINTS: [number, number][] = [];

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    && target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]') !== null;
}

function shouldIgnoreToolShortcut(event: KeyboardEvent) {
  return event.defaultPrevented
    || event.repeat
    || event.isComposing
    || event.altKey
    || event.ctrlKey
    || event.metaKey
    || isTypingTarget(event.target);
}

function resolvedToolShortcut(event: KeyboardEvent, isMapLocked: boolean): string | null {
  if (event.key === '1' && event.shiftKey) return isMapLocked ? null : 'frame';
  if (event.shiftKey) return null;
  const toolId = TOOL_SHORTCUTS[event.key.toLowerCase()];
  if (!toolId || (isMapLocked && toolId === 'pan')) return null;
  return toolId;
}

function useToolShortcuts({ activateTool, fitPage, isMapLocked }: {
  activateTool: (id: string) => void;
  fitPage: () => void;
  isMapLocked: boolean;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreToolShortcut(event)) return;
      const toolId = resolvedToolShortcut(event, isMapLocked);
      if (!toolId) return;
      event.preventDefault();
      if (toolId === 'frame') fitPage();
      else activateTool(toolId);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activateTool, fitPage, isMapLocked]);
}

function useRouteAuthoringOptions() {
  const [routeLineShape, setRouteLineShape] = useState<RouteLineShape>(DEFAULT_ROUTE_AUTHORING_OPTIONS.lineShape);
  const [routeTravelProfile, setRouteTravelProfile] = useState<RouteTravelProfile>(DEFAULT_ROUTE_AUTHORING_OPTIONS.travelProfile);
  const [showTravelModeIcon, setShowTravelModeIcon] = useState(DEFAULT_ROUTE_AUTHORING_OPTIONS.showTravelModeIcon);
  const routeOptions = useMemo<RouteAuthoringOptions>(() => ({
    lineShape: routeLineShape,
    travelProfile: routeTravelProfile,
    showTravelModeIcon,
  }), [routeLineShape, routeTravelProfile, showTravelModeIcon]);
  return { routeLineShape, routeTravelProfile, showTravelModeIcon, routeOptions, setRouteLineShape, setRouteTravelProfile, setShowTravelModeIcon };
}

type MapClickOptions = {
  activeTool: string;
  documentEpoch: number;
  placePoi?: (coordinate: [number, number]) => void;
  setShapePoints: Dispatch<SetStateAction<[number, number][]>>;
  setIsochroneCenter?: (coordinate: [number, number]) => void;
  setToolDocumentEpoch: Dispatch<SetStateAction<number>>;
  shapeMode: ShapeAuthoringMode;
  toolDocumentEpoch: number;
};

function mapClickForAuthoring(options: MapClickOptions) {
  if (options.activeTool === 'pin') return options.placePoi;
  if (options.activeTool === 'shape' && options.shapeMode === 'isochrone') return options.setIsochroneCenter;
  if (options.activeTool !== 'shape' || options.shapeMode !== 'draw') return;
  return (coordinate: [number, number]) => {
    options.setToolDocumentEpoch(options.documentEpoch);
    options.setShapePoints((points) => options.toolDocumentEpoch === options.documentEpoch
      ? [...points, coordinate]
      : [coordinate]);
  };
}

function resolvedShapeEditMode(
  selectedId: string | null,
  canEditPoints: boolean,
  stored: { id: string; mode: ShapeEditMode } | null,
): ShapeEditMode {
  if (stored?.id === selectedId) return stored.mode;
  return canEditPoints ? 'points' : 'transform';
}

type CanvasWorkspaceProps = {
  layers: ContentLayer[];
  assets: Record<string, CustomMarkerAsset>;
  camera: CameraSettings;
  stylePreset: MapStylePreset;
  language: MapLanguage;
  textScalePercent: number;
  featureVisibility: MapFeatureVisibility;
  selectedId: string | null;
  previewedId: string | null;
  page: PageSettings;
  documentEpoch: number;
  importFitRequest: { bounds?: MapBounds; request: number };
  locationRequest?: MapLocationRequest;
  activePanel: MobilePanel | null;
  layersTriggerRef: RefObject<HTMLButtonElement | null>;
  propertiesTriggerRef: RefObject<HTMLButtonElement | null>;
  onLayerSelect: (id: string | null) => void;
  onLocate?: (coordinate: [number, number], onApplied: () => void) => void;
  onRouteGeometryChange?: (id: string, coordinates: readonly (readonly [number, number])[]) => void;
  onShapeGeometryChange?: (id: string, geometry: ShapeGeometry) => void;
  onCameraViewportChange: (center: readonly [number, number], zoom: number, mode: CameraViewportChangeMode) => void;
  onCreateAdministrativeArea: (id: AdministrativeAreaId) => string | null;
  onCreateAdministrativeAreas: (ids: readonly AdministrativeAreaId[]) => string | null;
  onCreateDirectionsRoute: CreateDirectionsRoute;
  directionsProvider?: DirectionsProvider;
  searchProvider?: SearchProvider;
  onCreateIsochroneArea: (input: IsochroneAreaInput, expectedDocumentEpoch: number) => string | null;
  onCreatePoi: (coordinates: readonly [number, number]) => void;
  onCreatePoiBatch: (entries: readonly PoiSpreadsheetEntry[]) => void;
  onCreateRoute: (
    coordinates: readonly (readonly [number, number])[],
    options?: RouteAuthoringOptions,
  ) => void;
  onCreateShape: (coordinates: readonly (readonly [number, number])[]) => void;
  onAuthoringChange: (documentEpoch: number, isActive: boolean) => void;
  onBackgroundClick: () => void;
  onExporterChange: (exporter: PreviewPngExporter | null) => void;
  openPanel: (panel: MobilePanel) => void;
};

export function CanvasWorkspace(props: CanvasWorkspaceProps) {
  const [storedActiveTool, setStoredActiveTool] = useState('select');
  const [storedRoutePoints, setStoredRoutePoints] = useState<[number, number][]>([]), [routeUndoRequest, setRouteUndoRequest] = useState(0), [routeWaypointError, setRouteWaypointError] = useState<string | null>(null);
  const { routeLineShape, routeTravelProfile, showTravelModeIcon, routeOptions, setRouteLineShape, setRouteTravelProfile, setShowTravelModeIcon } = useRouteAuthoringOptions();
  const [storedShapePoints, setStoredShapePoints] = useState<[number, number][]>([]);
  const [shapeMode, setShapeMode] = useState<ShapeAuthoringMode>('administrative');
  const [storedShapeEditMode, setStoredShapeEditMode] = useState<{ id: string; mode: ShapeEditMode } | null>(null);
  const [toolDocumentEpoch, setToolDocumentEpoch] = useState(props.documentEpoch);
  const [fitRequest, setFitRequest] = useState(0);
  const [fitLayerRequest, setFitLayerRequest] = useState({ id: null as string | null, request: 0 });
  const selectToolRef = useRef<HTMLButtonElement>(null);
  const { activePanel, assets, camera, directionsProvider, documentEpoch, featureVisibility, importFitRequest, language, layers, layersTriggerRef, locationRequest = { request: 0 }, onAuthoringChange, onBackgroundClick, onCameraViewportChange, onCreateAdministrativeArea, onCreateAdministrativeAreas, onCreateDirectionsRoute, onCreateIsochroneArea, onCreatePoi, onCreatePoiBatch, onCreateRoute, onCreateShape, onExporterChange, onLayerSelect, onLocate, onRouteGeometryChange, onShapeGeometryChange, openPanel, page, previewedId, propertiesTriggerRef, searchProvider, selectedId, stylePreset, textScalePercent } = props;
  const activeTool = toolDocumentEpoch === documentEpoch ? storedActiveTool : 'select';
  const selectedLayer = layers.find((layer) => layer.id === selectedId);
  const canEditShapePoints = canDirectlyEditShapePoints(selectedLayer);
  const shapeEditMode = resolvedShapeEditMode(selectedId, canEditShapePoints, storedShapeEditMode);
  const routePoints = toolDocumentEpoch === documentEpoch ? storedRoutePoints : EMPTY_ROUTE_POINTS;
  const shapePoints = toolDocumentEpoch === documentEpoch ? storedShapePoints : EMPTY_SHAPE_POINTS;
  const poiAuthoring = usePoiAuthoring({ active: activeTool === 'pin', documentEpoch, selectToolRef, setActiveTool: setStoredActiveTool, onAuthoringChange, onCreatePoi, onCreatePoiBatch });
  const directions = useDirectionsAuthoring({ active: activeTool === 'route' && routeLineShape === 'road', documentEpoch, onCreate: onCreateDirectionsRoute, provider: directionsProvider });
  const canFinishRouteValue = canFinishRoute(routePoints, routeOptions);
  const canFinishShape = countDistinctPoints(shapePoints) >= 3;
  const exitAuthoring = (draft: 'route' | 'shape') => {
    selectToolRef.current?.focus();
    if (draft === 'route') { setStoredRoutePoints([]); setRouteWaypointError(null); } else setStoredShapePoints([]);
    setStoredActiveTool('select');
    onAuthoringChange(documentEpoch, false);
  };
  const isochrone = useIsochroneAuthoring({
    active: activeTool === 'shape' && shapeMode === 'isochrone',
    documentEpoch,
    onCreate: onCreateIsochroneArea,
    onCreated: (id) => {
      setFitLayerRequest((current) => ({ id, request: current.request + 1 }));
      exitAuthoring('shape');
    },
  });
  const geometryLayers = useMemo(() => [
    ...createRouteDraftLayers(routePoints, layers, routeOptions),
    ...(shapeMode === 'draw' ? createShapeDraftLayers(shapePoints, layers) : []),
    ...createIsochroneCenterLayer(
      activeTool === 'shape' && shapeMode === 'isochrone' ? isochrone.center?.coordinate : undefined,
      layers,
    ),
    ...layers.filter((layer) => layer.geometry),
  ], [activeTool, isochrone.center, layers, routeOptions, routePoints, shapeMode, shapePoints]);
  const activateTool = (id: string) => {
    if (id !== 'route') directions.cancel();
    setToolDocumentEpoch(documentEpoch);
    setStoredActiveTool(id);
    if (['route', 'pin', 'shape'].includes(id)) onLayerSelect(null);
    if (id !== 'route' || toolDocumentEpoch !== documentEpoch) setStoredRoutePoints([]);
    if (id !== 'shape' || toolDocumentEpoch !== documentEpoch) setStoredShapePoints([]);
    if (id === 'shape') setShapeMode('administrative');
    if (id !== 'pin' || toolDocumentEpoch !== documentEpoch) poiAuthoring.resetSpreadsheet();
    onAuthoringChange(documentEpoch, ['route', 'pin', 'shape'].includes(id));
  };
  const fitPage = () => setFitRequest((request) => request + 1);
  useToolShortcuts({ activateTool, fitPage, isMapLocked: camera.locked });
  const finishRouteWith = (coordinates: [number, number][]) => finishRouteCoordinates({
    coordinates,
    directions,
    exit: () => exitAuthoring('route'),
    onCreateRoute,
    routeOptions,
  });
  const finishRoute = () => finishRouteWith(routePoints);
  const cancelRoute = () => { directions.cancel(); exitAuthoring('route'); };
  const undoRoutePoint = () => {
    setStoredRoutePoints((points) => points.slice(0, -1));
    setRouteUndoRequest((request) => request + 1);
  };
  const finishShape = () => {
    if (!canFinishShape) return;
    onCreateShape(shapePoints);
    exitAuthoring('shape');
  };
  const cancelShape = () => { isochrone.cancel(); exitAuthoring('shape'); };
  const undoShapePoint = () => setStoredShapePoints((points) => points.slice(0, -1));
  const addAdministrativeArea = (id: AdministrativeAreaId) => {
    const createdId = onCreateAdministrativeArea(id);
    if (createdId) setFitLayerRequest((current) => ({ id: createdId, request: current.request + 1 }));
    exitAuthoring('shape');
  };
  const mergeAdministrativeAreas = (ids: readonly AdministrativeAreaId[]) => {
    const createdId = onCreateAdministrativeAreas(ids);
    if (!createdId) return false;
    setFitLayerRequest((current) => ({ id: createdId, request: current.request + 1 }));
    exitAuthoring('shape');
    return true;
  };

  const handleMapClick = activeTool === 'route' ? () => {} : mapClickForAuthoring({
    activeTool,
    documentEpoch,
    placePoi: poiAuthoring.spreadsheetOpen ? undefined : poiAuthoring.place,
    setIsochroneCenter: (coordinate) => isochrone.setCenter({ coordinate, label: 'Selected map point' }),
    setShapePoints: setStoredShapePoints,
    setToolDocumentEpoch,
    shapeMode,
    toolDocumentEpoch,
  });

  return (
    <section className="canvas-region" inert={activePanel !== null}>
      <LocationSearch provider={searchProvider} proximity={camera.center} onSelect={(coordinate, result) => {
        onLocate?.(coordinate, () => {});
        if (activeTool === 'route' && routeLineShape === 'road') {
          directions.cancel();
          setToolDocumentEpoch(documentEpoch);
          const next = appendRoadSearchWaypoint(routePoints, coordinate);
          setRouteWaypointError(next.error); setStoredRoutePoints(next.points);
        }
        if (activeTool === 'shape' && shapeMode === 'isochrone') {
          isochrone.setCenter({ coordinate, label: result.label });
        }
      }} />
      <MapCanvas camera={camera} stylePreset={stylePreset} language={language} textScalePercent={textScalePercent} featureVisibility={featureVisibility} layers={geometryLayers} assets={assets} contentRevision={geometryLayers} selectedId={selectedId} previewedId={previewedId} shapeEditMode={shapeEditMode} onLayerSelect={onLayerSelect} onCameraViewportChange={onCameraViewportChange} onMapClick={handleMapClick} onRouteGeometryChange={onRouteGeometryChange} routeAuthoring={{ active: activeTool === 'route', lineShape: routeLineShape, onFinish: finishRouteWith, onPreview: (points) => { directions.cancel(); const bounded = routeLineShape === 'road' ? points.slice(0, MAX_ROAD_ROUTE_WAYPOINTS) : points; setRouteWaypointError(bounded.length < points.length ? 'Road routes support up to 25 waypoints.' : null); setStoredRoutePoints(bounded); }, undoRequest: routeUndoRequest }} onShapeGeometryChange={onShapeGeometryChange} onBackgroundClick={onBackgroundClick} onExporterChange={onExporterChange} fitRequest={fitRequest} fitLayerId={fitLayerRequest.id} fitLayerRequest={fitLayerRequest.request} fitImportBounds={importFitRequest.bounds} fitImportRequest={importFitRequest.request} locationRequest={locationRequest} orientation={page.orientation} page={page} />
      <CanvasWorkspaceChrome activePanel={activePanel} activeTool={activeTool} camera={camera} layersTriggerRef={layersTriggerRef} onActivateTool={activateTool} onFitPage={fitPage} onOpenPanel={openPanel} poiPanelProps={{ active: activeTool === 'pin', spreadsheetOpen: poiAuthoring.spreadsheetOpen, spreadsheetTriggerRef: poiAuthoring.spreadsheetTriggerRef, onCancel: poiAuthoring.cancel, onCancelSpreadsheet: poiAuthoring.cancelSpreadsheet, onOpenSpreadsheet: poiAuthoring.openSpreadsheet, onSubmitSpreadsheet: poiAuthoring.submitSpreadsheet }} propertiesTriggerRef={propertiesTriggerRef} routePanelProps={{ pointCount: routePoints.length, canFinish: canFinishRouteValue, lineShape: routeLineShape, travelProfile: routeTravelProfile, showTravelModeIcon, isRouting: directions.isRouting, error: routeWaypointError ?? directions.error, onLineShapeChange: (shape) => { directions.cancel(); setRouteWaypointError(null); setRouteLineShape(shape); setStoredRoutePoints([]); }, onTravelProfileChange: (profile) => { directions.cancel(); setRouteTravelProfile(profile); }, onShowTravelModeIconChange: setShowTravelModeIcon, onCancel: cancelRoute, onUndo: () => { setRouteWaypointError(null); undoRoutePoint(); }, onFinish: finishRoute }} selectToolRef={selectToolRef} selectedShape={{ canEditPoints: canEditShapePoints, mode: shapeEditMode, onChange: setStoredShapeEditMode, selectedId }} shapePanelProps={{ pointCount: shapePoints.length, canFinish: canFinishShape, mode: shapeMode, onModeChange: (mode) => { isochrone.cancel(); setShapeMode(mode); setStoredShapePoints([]); }, onAddAdministrativeArea: addAdministrativeArea, onMergeAdministrativeAreas: mergeAdministrativeAreas, onCancel: cancelShape, onUndo: undoShapePoint, onFinish: finishShape, isochronePanel: <IsochronePanel center={isochrone.center} error={isochrone.error} isGenerating={isochrone.isGenerating} minutes={isochrone.minutes} profile={isochrone.profile} onCancel={cancelShape} onGenerate={() => { void isochrone.generate(); }} onMinutesChange={isochrone.setMinutes} onProfileChange={isochrone.setProfile} /> }} />
    </section>
  );
}
