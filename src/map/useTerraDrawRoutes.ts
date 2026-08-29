import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { ContentLayer } from '../domain/project';
import type { RouteLineShape } from '../domain/routeProfiles';
import { createTerraRouteDraw } from './TerraDrawRouteFactory';
import { createTerraRouteSession } from './TerraDrawRouteEditing';

export type RouteAuthoring = {
  active: boolean;
  lineShape: RouteLineShape;
  onFinish: (coordinates: [number, number][]) => void;
  onPreview: (coordinates: [number, number][]) => void;
  undoRequest: number;
};

type TerraDrawRoutesOptions = {
  authoring?: RouteAuthoring;
  layers: ContentLayer[];
  map: MapLibreMap | null;
  onRouteGeometryChange: (id: string, coordinates: readonly (readonly [number, number])[]) => void;
  onRoutePreview: (id: string, coordinates: [number, number][] | null) => void;
  selectedId: string | null;
};

type RouteCallbacks = {
  authoringFinish?: RouteAuthoring['onFinish'];
  authoringPreview?: RouteAuthoring['onPreview'];
  onRouteGeometryChange: TerraDrawRoutesOptions['onRouteGeometryChange'];
  onRoutePreview: TerraDrawRoutesOptions['onRoutePreview'];
};

type RouteSession = ReturnType<typeof createTerraRouteSession>;
type EditableRoute = ContentLayer;

function editableRouteFor(options: TerraDrawRoutesOptions): EditableRoute | null {
  const layer = options.layers.find((candidate) => candidate.id === options.selectedId);
  if (layer?.type !== 'route' || !layer.visible || layer.locked) return null;
  if (layer.geometry?.type !== 'LineString' && layer.geometry?.type !== 'Arc') return null;
  return layer;
}

function routeLineShape(layer: EditableRoute | null): RouteLineShape | undefined {
  if (layer?.geometry?.type === 'Arc') return 'arc';
  if (layer?.geometry?.type === 'LineString') return 'straight';
}

function routeCoordinates(layer: EditableRoute | null) {
  if (layer?.geometry?.type === 'Arc') return layer.geometry.anchors;
  if (layer?.geometry?.type === 'LineString') return layer.geometry.coordinates;
}

function useLatestCallbacks(options: TerraDrawRoutesOptions) {
  const callbacks = useRef<RouteCallbacks>({
    authoringFinish: options.authoring?.onFinish,
    authoringPreview: options.authoring?.onPreview,
    onRouteGeometryChange: options.onRouteGeometryChange,
    onRoutePreview: options.onRoutePreview,
  });
  useLayoutEffect(() => {
    callbacks.current = {
      authoringFinish: options.authoring?.onFinish,
      authoringPreview: options.authoring?.onPreview,
      onRouteGeometryChange: options.onRouteGeometryChange,
      onRoutePreview: options.onRoutePreview,
    };
  });
  return callbacks;
}

function createAuthoringSession(
  draw: ReturnType<typeof createTerraRouteDraw>,
  callbacks: RefObject<RouteCallbacks>,
): RouteSession {
  return createTerraRouteSession({
    draw,
    mode: 'draw',
    onFinish: (coordinates) => callbacks.current.authoringFinish?.(coordinates),
    onPreview: (coordinates) => callbacks.current.authoringPreview?.(coordinates),
  });
}

function createEditingSession(
  draw: ReturnType<typeof createTerraRouteDraw>,
  route: EditableRoute,
  callbacks: RefObject<RouteCallbacks>,
): RouteSession | null {
  const coordinates = routeCoordinates(route);
  if (!coordinates) return null;
  return createTerraRouteSession({
    draw,
    initial: { id: route.id, coordinates },
    mode: 'edit',
    onCommit: (nextCoordinates) => {
      callbacks.current.onRoutePreview(route.id, null);
      callbacks.current.onRouteGeometryChange(route.id, nextCoordinates);
    },
    onPreview: (nextCoordinates) => callbacks.current.onRoutePreview(route.id, nextCoordinates),
  });
}

function sessionFor(
  draw: ReturnType<typeof createTerraRouteDraw>,
  isAuthoring: boolean,
  editableRoute: EditableRoute | null,
  callbacks: RefObject<RouteCallbacks>,
) {
  if (isAuthoring) return createAuthoringSession(draw, callbacks);
  if (editableRoute) return createEditingSession(draw, editableRoute, callbacks);
  return null;
}

function useRouteSession(options: TerraDrawRoutesOptions, callbacks: RefObject<RouteCallbacks>) {
  const session = useRef<RouteSession | null>(null);
  const isAuthoring = options.authoring?.active === true;
  const editableRoute = editableRouteFor(options);
  const lineShape = isAuthoring ? options.authoring?.lineShape : routeLineShape(editableRoute);

  useEffect(() => {
    if (!lineShape || !options.map) return;
    const draw = createTerraRouteDraw(options.map, lineShape, isAuthoring);
    const { onRoutePreview } = callbacks.current;
    session.current = sessionFor(draw, isAuthoring, editableRoute, callbacks);
    return () => {
      session.current?.destroy();
      session.current = null;
      if (editableRoute) onRoutePreview(editableRoute.id, null);
    };
  }, [callbacks, editableRoute, isAuthoring, lineShape, options.map]);

  return { isAuthoring, session };
}

export function useTerraDrawRoutes(options: TerraDrawRoutesOptions) {
  const callbacks = useLatestCallbacks(options);
  const { isAuthoring, session } = useRouteSession(options, callbacks);
  const lastUndoRequest = useRef(options.authoring?.undoRequest ?? 0);

  useEffect(() => {
    const undoRequest = options.authoring?.undoRequest ?? 0;
    if (!isAuthoring || undoRequest === lastUndoRequest.current) return;
    lastUndoRequest.current = undoRequest;
    session.current?.undo();
  }, [isAuthoring, options.authoring?.undoRequest, session]);

  const updateEditingGeometry = useCallback((coordinates: [number, number][]) => (
    session.current?.updateGeometry(coordinates) ?? false
  ), [session]);
  return { updateEditingGeometry };
}
