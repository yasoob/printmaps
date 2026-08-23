import { Frame, Hand, Layers3, MapPin, MousePointer2, Route, Shapes, SlidersHorizontal, Type } from 'lucide-react';
import { useMemo, useRef, useState, type RefObject } from 'react';
import type { PoiSpreadsheetEntry } from '../../domain/poiSpreadsheet';
import type { CustomMarkerAsset } from '../../domain/customMarkerAssets';
import type { CameraSettings, ContentLayer, MapFeatureVisibility, MapStylePreset, PageSettings } from '../../domain/project';
import {
  buildRouteCoordinates,
  DEFAULT_ROUTE_AUTHORING_OPTIONS,
  type RouteLineShape,
  type RouteTravelProfile,
  type RouteAuthoringOptions,
} from '../../domain/routeProfiles';
import type { PreviewPngExporter } from '../../export/previewPng';
import { MapCanvas } from '../../map/MapCanvas';
import type { MobilePanel } from '../hooks/useMobilePanels';
import { usePoiAuthoring } from '../hooks/usePoiAuthoring';
import { PoiAuthoringControls } from './PoiAuthoringControls';
import { DrawingPanel, RouteDrawingPanel } from './RouteDrawingPanel';

const tools = [
  { id: 'select', label: 'Select', shortcut: 'V', icon: MousePointer2 },
  { id: 'pan', label: 'Pan', shortcut: 'H', icon: Hand },
  { id: 'route', label: 'Route', shortcut: 'R', icon: Route },
  { id: 'pin', label: 'Pin', shortcut: 'P', icon: MapPin },
  { id: 'shape', label: 'Shape', shortcut: 'S', icon: Shapes },
  { id: 'text', label: 'Text', shortcut: 'T', icon: Type },
  { id: 'frame', label: 'Fit page', shortcut: 'Shift+1', icon: Frame, command: true },
];
const EMPTY_ROUTE_POINTS: [number, number][] = [];
const EMPTY_SHAPE_POINTS: [number, number][] = [];

function countDistinctPoints(points: readonly (readonly [number, number])[]): number {
  return new Set(points.map(([longitude, latitude]) => `${longitude},${latitude}`)).size;
}

function createRouteDraftLayers(
  routePoints: [number, number][],
  projectLayers: ContentLayer[],
  options: RouteAuthoringOptions,
): ContentLayer[] {
  const usedIds = new Set(projectLayers.map((layer) => layer.id));
  const uniqueId = (base: string) => {
    let id = base;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    return id;
  };
  const pointLayers: ContentLayer[] = routePoints.map((coordinates, index) => ({
    id: uniqueId(`route-draft-point-${index + 1}`),
    name: `Route point ${index + 1}`,
    type: 'poi',
    visible: true,
    locked: true,
    opacity: 100,
    geometry: { type: 'Point', coordinates },
  }));
  if (routePoints.length < 2) return pointLayers;
  const coordinates = buildRouteCoordinates(routePoints, options.lineShape);
  if (coordinates.length < 2) return pointLayers;
  return [...pointLayers, {
    id: uniqueId('route-draft'),
    name: 'Route draft',
    type: 'route',
    visible: true,
    locked: true,
    opacity: 100,
    appearance: {
      kind: 'route',
      color: '#d9363e',
      width: 4,
      travelProfile: options.travelProfile,
      showTravelModeIcon: options.showTravelModeIcon,
    },
    geometry: { type: 'LineString', coordinates },
  }];
}

function createShapeDraftLayers(
  shapePoints: [number, number][],
  projectLayers: ContentLayer[],
): ContentLayer[] {
  const usedIds = new Set(projectLayers.map((layer) => layer.id));
  const uniqueId = (base: string) => {
    let id = base;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    return id;
  };
  const pointLayers: ContentLayer[] = shapePoints.map((coordinates, index) => ({
    id: uniqueId(`shape-draft-point-${index + 1}`),
    name: `Shape vertex ${index + 1}`,
    type: 'poi',
    visible: true,
    locked: true,
    opacity: 100,
    geometry: { type: 'Point', coordinates },
  }));
  if (shapePoints.length < 2) return pointLayers;
  if (countDistinctPoints(shapePoints) < 3) return [...pointLayers, {
    id: uniqueId('shape-draft-outline'),
    name: 'Shape draft outline',
    type: 'route',
    visible: true,
    locked: true,
    opacity: 100,
    geometry: { type: 'LineString', coordinates: shapePoints },
  }];
  return [...pointLayers, {
    id: uniqueId('shape-draft'),
    name: 'Shape draft',
    type: 'shape',
    visible: true,
    locked: true,
    opacity: 28,
    geometry: { type: 'Polygon', coordinates: [[...shapePoints, shapePoints[0]]] },
  }];
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

type CanvasWorkspaceProps = {
  layers: ContentLayer[];
  assets: Record<string, CustomMarkerAsset>;
  camera: CameraSettings;
  stylePreset: MapStylePreset;
  textScalePercent: number;
  featureVisibility: MapFeatureVisibility;
  selectedId: string | null;
  previewedId: string | null;
  page: PageSettings;
  documentEpoch: number;
  activePanel: MobilePanel | null;
  layersTriggerRef: RefObject<HTMLButtonElement | null>;
  propertiesTriggerRef: RefObject<HTMLButtonElement | null>;
  onLayerSelect: (id: string | null) => void;
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
  const [storedRoutePoints, setStoredRoutePoints] = useState<[number, number][]>([]);
  const { routeLineShape, routeTravelProfile, showTravelModeIcon, routeOptions, setRouteLineShape, setRouteTravelProfile, setShowTravelModeIcon } = useRouteAuthoringOptions();
  const [storedShapePoints, setStoredShapePoints] = useState<[number, number][]>([]);
  const [toolDocumentEpoch, setToolDocumentEpoch] = useState(props.documentEpoch);
  const [fitRequest, setFitRequest] = useState(0);
  const selectToolRef = useRef<HTMLButtonElement>(null);
  const { activePanel, assets, camera, documentEpoch, featureVisibility, layers, layersTriggerRef, onAuthoringChange, onBackgroundClick, onCreatePoi, onCreatePoiBatch, onCreateRoute, onCreateShape, onExporterChange, onLayerSelect, openPanel, page, previewedId, propertiesTriggerRef, selectedId, stylePreset, textScalePercent } = props;
  const activeTool = toolDocumentEpoch === documentEpoch ? storedActiveTool : 'select';
  const routePoints = toolDocumentEpoch === documentEpoch ? storedRoutePoints : EMPTY_ROUTE_POINTS;
  const shapePoints = toolDocumentEpoch === documentEpoch ? storedShapePoints : EMPTY_SHAPE_POINTS;
  const poiAuthoring = usePoiAuthoring({
    active: activeTool === 'pin',
    documentEpoch,
    selectToolRef,
    setActiveTool: setStoredActiveTool,
    onAuthoringChange,
    onCreatePoi,
    onCreatePoiBatch,
  });
  const canFinishRoute = countDistinctPoints(routePoints) >= 2
    && buildRouteCoordinates(routePoints, routeOptions.lineShape).length >= 2;
  const canFinishShape = countDistinctPoints(shapePoints) >= 3;
  const geometryLayers = useMemo(() => [
    ...createRouteDraftLayers(routePoints, layers, routeOptions),
    ...createShapeDraftLayers(shapePoints, layers),
    ...layers.filter((layer) => layer.geometry),
  ], [layers, routeOptions, routePoints, shapePoints]);
  const activateTool = (id: string) => {
    setToolDocumentEpoch(documentEpoch);
    setStoredActiveTool(id);
    if (id !== 'route' || toolDocumentEpoch !== documentEpoch) setStoredRoutePoints([]);
    if (id !== 'shape' || toolDocumentEpoch !== documentEpoch) setStoredShapePoints([]);
    if (id !== 'pin' || toolDocumentEpoch !== documentEpoch) poiAuthoring.resetSpreadsheet();
    onAuthoringChange(documentEpoch, ['route', 'pin', 'shape'].includes(id));
  };
  const finishRoute = () => {
    if (!canFinishRoute) return;
    selectToolRef.current?.focus();
    onCreateRoute(routePoints, routeOptions);
    setStoredRoutePoints([]);
    setStoredActiveTool('select');
    onAuthoringChange(documentEpoch, false);
  };
  const cancelRoute = () => {
    selectToolRef.current?.focus();
    setStoredRoutePoints([]);
    setStoredActiveTool('select');
    onAuthoringChange(documentEpoch, false);
  };
  const finishShape = () => {
    if (!canFinishShape) return;
    selectToolRef.current?.focus();
    onCreateShape(shapePoints);
    setStoredShapePoints([]);
    setStoredActiveTool('select');
    onAuthoringChange(documentEpoch, false);
  };
  const cancelShape = () => {
    selectToolRef.current?.focus();
    setStoredShapePoints([]);
    setStoredActiveTool('select');
    onAuthoringChange(documentEpoch, false);
  };

  let handleMapClick: ((coordinate: [number, number]) => void) | undefined;
  switch (activeTool) {
    case 'route': {
      handleMapClick = (coordinate) => {
        setToolDocumentEpoch(documentEpoch);
        setStoredRoutePoints((points) => toolDocumentEpoch === documentEpoch ? [...points, coordinate] : [coordinate]);
      };
      break;
    }
    case 'pin': {
      handleMapClick = poiAuthoring.spreadsheetOpen ? undefined : poiAuthoring.place;
      break;
    }
    case 'shape': {
      handleMapClick = (coordinate) => {
        setToolDocumentEpoch(documentEpoch);
        setStoredShapePoints((points) => toolDocumentEpoch === documentEpoch ? [...points, coordinate] : [coordinate]);
      };
      break;
    }
  }

  return (
    <section className="canvas-region" inert={activePanel !== null}>
      <MapCanvas camera={camera} stylePreset={stylePreset} textScalePercent={textScalePercent} featureVisibility={featureVisibility} layers={geometryLayers} assets={assets} contentRevision={geometryLayers} selectedId={selectedId} previewedId={previewedId} onLayerSelect={onLayerSelect} onMapClick={handleMapClick} onBackgroundClick={onBackgroundClick} onExporterChange={onExporterChange} fitRequest={fitRequest} orientation={page.orientation} page={page} />
      <div className="mobile-panel-actions" aria-label="Editor panels">
        <button ref={layersTriggerRef} type="button" aria-label="Open layers" aria-controls="layers-panel" aria-expanded={activePanel === 'layers'} onClick={() => openPanel('layers')}><Layers3 size={15} /><span>Layers</span></button>
        <button ref={propertiesTriggerRef} type="button" aria-label="Open properties" aria-controls="properties-panel" aria-expanded={activePanel === 'properties'} onClick={() => openPanel('properties')}><SlidersHorizontal size={15} /><span>Properties</span></button>
      </div>
      <nav className="tool-palette" aria-label="Map tools">
        {tools.map(({ id, label, shortcut, icon: Icon, command }, index) => (
          <div className="tool-slot" key={id}>
            {index === 2 && <span className="tool-separator" />}
            <button ref={id === 'select' ? selectToolRef : undefined} className={`tool-button${!command && activeTool === id ? ' is-active' : ''}`} type="button" aria-label={`${label} (${shortcut})`} aria-pressed={command ? undefined : activeTool === id} title={`${label} · ${shortcut}`} onClick={() => command ? setFitRequest((request) => request + 1) : activateTool(id)}>
              <Icon size={17} strokeWidth={1.8} />
            </button>
          </div>
        ))}
      </nav>
      {activeTool === 'route' && (
        <RouteDrawingPanel pointCount={routePoints.length} canFinish={canFinishRoute} lineShape={routeLineShape} travelProfile={routeTravelProfile} showTravelModeIcon={showTravelModeIcon} onLineShapeChange={setRouteLineShape} onTravelProfileChange={setRouteTravelProfile} onShowTravelModeIconChange={setShowTravelModeIcon} onCancel={cancelRoute} onFinish={finishRoute} />
      )}
      <PoiAuthoringControls active={activeTool === 'pin'} spreadsheetOpen={poiAuthoring.spreadsheetOpen} spreadsheetTriggerRef={poiAuthoring.spreadsheetTriggerRef} onCancel={poiAuthoring.cancel} onCancelSpreadsheet={poiAuthoring.cancelSpreadsheet} onOpenSpreadsheet={poiAuthoring.openSpreadsheet} onSubmitSpreadsheet={poiAuthoring.submitSpreadsheet} />
      {activeTool === 'shape' && (
        <DrawingPanel statusLabel="Shape drawing status" status={`Polygon shape · ${shapePoints.length} ${shapePoints.length === 1 ? 'vertex' : 'vertices'}`} cancelLabel="Cancel shape" finishLabel="Finish shape" finishDisabled={!canFinishShape} onCancel={cancelShape} onFinish={finishShape} />
      )}
      <div className="canvas-status" aria-label="Canvas status"><button type="button">100%</button><span /> <button type="button">1:20,000</button></div>
    </section>
  );
}
